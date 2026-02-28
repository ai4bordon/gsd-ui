#!/usr/bin/env bun

import { resolve, join, relative } from "node:path"
import { readdir, stat } from "node:fs/promises"
import { createInterface } from "node:readline"
import { startServer } from "./server/index.ts"

const VERSION = "0.1.0"
const REPO = "Stolkmeister/gsd-ui"

const HELP = `
gsd-ui v${VERSION} — GSD project dashboard

Usage:
  gsd-ui [options] [path]

Options:
  -h, --help       Show this help message
  -v, --version    Show version number
  -p, --port NUM   Port to listen on (default: 4567, or PORT env)
  -u, --update     Update gsd-ui to the latest version

Arguments:
  path             Path to project or .planning/ directory.
                   If omitted, auto-discovers .planning/ dirs in cwd.

Examples:
  gsd-ui                     # auto-discover in current directory
  gsd-ui ./my-project        # use my-project/.planning/
  gsd-ui .planning            # use .planning/ directly
  gsd-ui --port 3000         # custom port
  gsd-ui --update            # update to latest version
`.trim()

// ---- Update check ----

async function getRemoteVersion(): Promise<string | null> {
  try {
    const res = await fetch(
      `https://raw.githubusercontent.com/${REPO}/main/package.json`,
      { signal: AbortSignal.timeout(3000) }
    )
    if (!res.ok) return null
    const pkg = await res.json() as { version?: string }
    return pkg.version ?? null
  } catch {
    return null
  }
}

function checkForUpdateInBackground() {
  getRemoteVersion().then((remote) => {
    if (remote && remote !== VERSION) {
      console.log(
        `\n[gsd-ui] Update available: v${VERSION} → v${remote}` +
          `\n[gsd-ui] Run: gsd-ui --update\n`
      )
    }
  })
}

async function runUpdate() {
  console.log("[gsd-ui] Updating...")
  const proc = Bun.spawn(
    ["bun", "install", "-g", `github:${REPO}`],
    { stdout: "inherit", stderr: "inherit" }
  )
  const code = await proc.exited
  if (code === 0) {
    // Check what version we got
    const remote = await getRemoteVersion()
    console.log(`[gsd-ui] Updated to v${remote ?? "latest"}`)
  } else {
    console.error("[gsd-ui] Update failed")
    process.exit(1)
  }
}

// ---- Parse args ----

let port = parseInt(process.env.PORT || "") || 4567
let portExplicit = false
let explicitPath: string | undefined

const args = process.argv.slice(2)
for (let i = 0; i < args.length; i++) {
  const arg = args[i]
  if (arg === "-h" || arg === "--help") {
    console.log(HELP)
    process.exit(0)
  }
  if (arg === "-v" || arg === "--version") {
    console.log(VERSION)
    process.exit(0)
  }
  if (arg === "-u" || arg === "--update") {
    await runUpdate()
    process.exit(0)
  }
  if (arg === "-p" || arg === "--port") {
    const next = args[++i]
    if (!next || isNaN(parseInt(next))) {
      console.error("Error: --port requires a number")
      process.exit(1)
    }
    port = parseInt(next)
    portExplicit = true
    continue
  }
  // Treat as path argument
  explicitPath = arg
}

// ---- Path resolution ----

async function isDirectory(path: string): Promise<boolean> {
  try {
    const s = await stat(path)
    return s.isDirectory()
  } catch {
    return false
  }
}

async function resolvePlanningPath(pathArg: string): Promise<string> {
  const resolved = resolve(pathArg)

  // If the path itself is a .planning directory, use it directly
  if (resolved.endsWith(".planning") && await isDirectory(resolved)) {
    return resolved
  }

  // Look for .planning/ inside the given path
  const withPlanning = join(resolved, ".planning")
  if (await isDirectory(withPlanning)) {
    return withPlanning
  }

  // Maybe the path IS the planning directory (just not named .planning)
  if (await isDirectory(resolved)) {
    return resolved
  }

  console.error(`Error: "${pathArg}" is not a valid directory`)
  process.exit(1)
}

// ---- Auto-discovery ----

const SKIP_DIRS = new Set([".git", "node_modules"])

async function discoverPlanningDirs(): Promise<string[]> {
  const found: string[] = []
  const cwd = process.cwd()

  // Check cwd itself
  const cwdPlanning = join(cwd, ".planning")
  if (await isDirectory(cwdPlanning)) {
    found.push(cwdPlanning)
  }

  // Check 1 level of subdirectories
  try {
    const entries = await readdir(cwd, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (SKIP_DIRS.has(entry.name)) continue
      if (entry.name.startsWith(".")) continue

      const subPlanning = join(cwd, entry.name, ".planning")
      if (await isDirectory(subPlanning)) {
        found.push(subPlanning)
      }
    }
  } catch {
    // Ignore errors reading directory
  }

  return found
}

async function promptSelection(dirs: string[]): Promise<string> {
  const cwd = process.cwd()
  console.log("\nMultiple .planning/ directories found:\n")
  for (let i = 0; i < dirs.length; i++) {
    // Show path relative to cwd for readability
    const relativePath = relative(cwd, dirs[i])
    console.log(`  ${i + 1}) ${relativePath.startsWith("..") ? dirs[i] : relativePath}`)
  }
  console.log()

  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question("Select a directory (number): ", (answer) => {
      rl.close()
      const idx = parseInt(answer) - 1
      if (isNaN(idx) || idx < 0 || idx >= dirs.length) {
        console.error("Invalid selection")
        process.exit(1)
      }
      resolve(dirs[idx])
    })
  })
}

// ---- Main ----

// Check for updates in the background (non-blocking)
checkForUpdateInBackground()

let planningPath: string

if (explicitPath) {
  planningPath = await resolvePlanningPath(explicitPath)
} else {
  const dirs = await discoverPlanningDirs()

  if (dirs.length === 0) {
    console.error(
      "No .planning/ directory found.\n\n" +
        "Run gsd-ui from a directory containing a .planning/ folder,\n" +
        "or provide a path: gsd-ui ./my-project"
    )
    process.exit(1)
  }

  if (dirs.length === 1) {
    planningPath = dirs[0]
  } else {
    planningPath = await promptSelection(dirs)
  }
}

await startServer(planningPath, port, portExplicit)
