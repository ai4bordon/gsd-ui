import { resolve, join, relative, isAbsolute } from "node:path"
import { connect } from "node:net"
import type { ServerWebSocket } from "bun"
import type { GsdState } from "./types.ts"
import { buildInitialState, updateStateForFile } from "./state.ts"
import { handleGetState, handleSearch, handleGetDocument, sanitizeStateForWs } from "./api.ts"
import { createWatcher } from "./watcher.ts"

function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect(port, "127.0.0.1")
    socket.once("connect", () => {
      socket.destroy()
      resolve(true)
    })
    socket.once("error", () => {
      socket.destroy()
      resolve(false)
    })
  })
}

async function findAvailablePort(preferred: number, explicit: boolean): Promise<number> {
  if (!(await isPortInUse(preferred))) return preferred

  if (explicit) {
    console.error(`[gsd-ui] Port ${preferred} is already in use.`)
    process.exit(1)
  }

  for (let offset = 1; offset <= 10; offset++) {
    const candidate = preferred + offset
    if (!(await isPortInUse(candidate))) {
      console.log(`[gsd-ui] Port ${preferred} is in use, using ${candidate} instead`)
      return candidate
    }
  }

  console.error(`[gsd-ui] Ports ${preferred}-${preferred + 10} are all in use.`)
  process.exit(1)
}

export async function startServer(planningPath: string, port: number, portExplicit = false) {
  console.log(`[gsd-ui] Loading .planning/ from: ${planningPath}`)

  // Build initial state
  const startTime = performance.now()
  let state: GsdState = await buildInitialState(planningPath)
  const elapsed = (performance.now() - startTime).toFixed(0)
  console.log(
    `[gsd-ui] Parsed ${state.phases.length} phases, ` +
      `${state.phases.reduce((s, p) => s + p.plans.length, 0)} plans, ` +
      `${state.todos.length} todos, ` +
      `${state.milestones.length} milestones, ` +
      `${state.searchIndex.length} search entries ` +
      `in ${elapsed}ms`
  )

  // ---- WebSocket connections ----

  const wsClients = new Set<ServerWebSocket<unknown>>()

  function broadcastState() {
    const json = JSON.stringify(sanitizeStateForWs(state))
    for (const ws of wsClients) {
      try {
        ws.send(json)
      } catch {
        wsClients.delete(ws)
      }
    }
  }

  // ---- File watcher ----

  const watcher = createWatcher(planningPath, async (events) => {
    console.log(
      `[gsd-ui] File changes detected: ${events.map((e) => `${e.type} ${e.path}`).join(", ")}`
    )

    for (const event of events) {
      await updateStateForFile(state, event.path, event.type)
    }

    broadcastState()
  })

  // ---- HTTP Server ----

  const distDir = resolve(import.meta.dir, "..", "dist")

  const MAX_WS_CLIENTS = 50

  const serverOptions = {
    hostname: "127.0.0.1",

    fetch(req: Request, server: any) {
      const url = new URL(req.url)

      // WebSocket upgrade
      if (url.pathname === "/ws") {
        // Validate origin to prevent cross-site WebSocket hijacking
        const origin = req.headers.get("origin")
        if (origin && !origin.startsWith("http://localhost:") && !origin.startsWith("http://127.0.0.1:")) {
          return new Response("Forbidden origin", { status: 403 })
        }
        if (wsClients.size >= MAX_WS_CLIENTS) {
          return new Response("Too many connections", { status: 503 })
        }
        const upgraded = server.upgrade(req)
        if (!upgraded) {
          return new Response("WebSocket upgrade failed", { status: 400 })
        }
        return undefined
      }

      // API routes
      if (url.pathname === "/api/state") {
        return handleGetState(state)
      }

      if (url.pathname === "/api/search") {
        return handleSearch(state, url)
      }

      if (url.pathname === "/api/document") {
        return handleGetDocument(state, url)
      }

      // Static files from dist/
      return serveStatic(url.pathname)
    },

    websocket: {
      open(ws: any) {
        wsClients.add(ws)
        // Send current state immediately on connect
        ws.send(JSON.stringify(sanitizeStateForWs(state)))
      },
      message(_ws: any, _message: any) {
        // No client-to-server messages expected
      },
      close(ws: any) {
        wsClients.delete(ws)
      },
    },
  }

  port = await findAvailablePort(port, portExplicit)

  const server = Bun.serve({ ...serverOptions, port })

  console.log(
    `[gsd-ui] Server running at http://localhost:${server.port}`
  )
  console.log(`[gsd-ui] Watching for changes in: ${planningPath}`)

  // ---- Static file serving ----

  async function serveStatic(pathname: string): Promise<Response> {
    // Map / to /index.html
    let filePath = pathname === "/" ? "/index.html" : pathname

    // Resolve and ensure path stays within distDir (prevent path traversal)
    let fullPath = resolve(distDir, "." + filePath)
    const rel = relative(distDir, fullPath)
    if (rel.startsWith("..") || isAbsolute(rel)) {
      return new Response("Forbidden", { status: 403 })
    }

    let file = Bun.file(fullPath)
    if (await file.exists()) {
      return new Response(file, {
        headers: {
          "Content-Type": getMimeType(fullPath),
          "X-Content-Type-Options": "nosniff",
        },
      })
    }

    // SPA fallback: serve index.html for any non-file path
    fullPath = join(distDir, "index.html")
    file = Bun.file(fullPath)
    if (await file.exists()) {
      return new Response(file, {
        headers: {
          "Content-Type": "text/html",
          "X-Content-Type-Options": "nosniff",
        },
      })
    }

    return new Response("Not Found", { status: 404 })
  }

  function getMimeType(path: string): string {
    if (path.endsWith(".html")) return "text/html"
    if (path.endsWith(".js")) return "application/javascript"
    if (path.endsWith(".css")) return "text/css"
    if (path.endsWith(".json")) return "application/json"
    if (path.endsWith(".svg")) return "image/svg+xml"
    if (path.endsWith(".png")) return "image/png"
    if (path.endsWith(".ico")) return "image/x-icon"
    if (path.endsWith(".woff2")) return "font/woff2"
    if (path.endsWith(".woff")) return "font/woff"
    return "application/octet-stream"
  }

  // ---- Graceful shutdown ----

  process.on("SIGINT", () => {
    console.log("\n[gsd-ui] Shutting down...")
    watcher.close()
    server.stop()
    process.exit(0)
  })

  process.on("SIGTERM", () => {
    console.log("\n[gsd-ui] Shutting down...")
    watcher.close()
    server.stop()
    process.exit(0)
  })
}
