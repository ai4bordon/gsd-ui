import { readFile } from "node:fs/promises"
import { join, resolve, relative, isAbsolute } from "node:path"
import type { GsdState, SearchEntry } from "./types.ts"

/**
 * Sanitize state before sending to clients.
 * Strips absolute filesystem paths to prevent information disclosure.
 */
function sanitizeState(state: GsdState) {
  const planningBase = state.planningPath
  const toClientPath = (value: string) => value.replace(/\\/g, "/")

  const relativize = (absPath: string): string => {
    if (!absPath) return absPath
    try {
      return toClientPath(relative(resolve(planningBase, ".."), absPath))
    } catch {
      return toClientPath(absPath)
    }
  }

  return {
    ...state,
    projectPath: toClientPath(resolve(state.projectPath)),
    planningPath: toClientPath(resolve(state.planningPath)),
    phases: state.phases.map((phase) => ({
      ...phase,
      dirPath: relativize(phase.dirPath),
      research: phase.research
        ? { ...phase.research, filePath: relativize(phase.research.filePath) }
        : undefined,
      context: phase.context
        ? { ...phase.context, filePath: relativize(phase.context.filePath) }
        : undefined,
      uat: phase.uat
        ? { ...phase.uat, filePath: relativize(phase.uat.filePath) }
        : undefined,
      plans: phase.plans.map((plan) => ({
        ...plan,
        filePath: relativize(plan.filePath),
      })),
    })),
    research: state.research.map((doc) => ({
      ...doc,
      filePath: relativize(doc.filePath),
    })),
    projectDoc: state.projectDoc
      ? { ...state.projectDoc, filePath: relativize(state.projectDoc.filePath) }
      : null,
    searchIndex: state.searchIndex.map((entry) => ({
      ...entry,
      path: relativize(entry.path),
    })),
  }
}

/**
 * Sanitize state for WebSocket broadcast (same sanitization as API).
 */
export function sanitizeStateForWs(state: GsdState) {
  return sanitizeState(state)
}

/**
 * Handle GET /api/state -- returns the sanitized GsdState object.
 */
export function handleGetState(state: GsdState): Response {
  return Response.json(sanitizeState(state), {
    headers: { "Content-Type": "application/json" },
  })
}

/**
 * Handle GET /api/search?q=... -- searches the search index.
 * Returns matching entries ranked by simple relevance scoring.
 */
export function handleSearch(
  state: GsdState,
  url: URL,
): Response {
  const planningBase = state.planningPath
  const toClientPath = (value: string) => value.replace(/\\/g, "/")
  const relativize = (absPath: string): string => {
    if (!absPath) return absPath
    try {
      return toClientPath(relative(resolve(planningBase, ".."), absPath))
    } catch {
      return toClientPath(absPath)
    }
  }
  const query = url.searchParams.get("q")?.toLowerCase().trim()
  if (!query) {
    return Response.json({ results: [], query: "" })
  }

  const terms = query.split(/\s+/).filter(Boolean)

  const scored: Array<{ entry: SearchEntry; score: number }> = []

  for (const entry of state.searchIndex) {
    let score = 0
    const titleLower = entry.title.toLowerCase()
    const contentLower = entry.content.toLowerCase()

    for (const term of terms) {
      // Title match is worth more
      if (titleLower.includes(term)) {
        score += 10
        // Exact word match in title is worth even more
        if (titleLower.split(/\W+/).includes(term)) {
          score += 5
        }
      }
      // Content match
      if (contentLower.includes(term)) {
        score += 1
        // Count occurrences (cap at 5 for scoring)
        const occurrences = Math.min(
          (contentLower.match(new RegExp(escapeRegex(term), "g"))?.length ?? 0),
          5
        )
        score += occurrences
      }
      // Type match
      if (entry.type.includes(term)) {
        score += 3
      }
      // Phase/milestone match
      if (entry.phase?.toLowerCase().includes(term)) {
        score += 2
      }
      if (entry.milestone?.toLowerCase().includes(term)) {
        score += 2
      }
    }

    if (score > 0) {
      scored.push({ entry, score })
    }
  }

  // Sort by score descending, then by title
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.entry.title.localeCompare(b.entry.title)
  })

  // Return top 50 results with sanitized paths
  const results = scored.slice(0, 50).map((s) => ({
    ...s.entry,
    path: relativize(s.entry.path),
    score: s.score,
  }))

  return Response.json({ results, query })
}

/**
 * Handle GET /api/document?path=... -- returns raw markdown content of a file.
 * The path is relative to the .planning/ directory.
 */
export async function handleGetDocument(
  state: GsdState,
  url: URL
): Promise<Response> {
  const requestedPath = url.searchParams.get("path")
  if (!requestedPath) {
    return Response.json(
      { error: "Missing 'path' query parameter" },
      { status: 400 }
    )
  }

  // Resolve the path relative to the planning directory
  const fullPath = resolve(state.planningPath, requestedPath)

  // Security: ensure the resolved path is strictly within the planning directory
  const normalizedPlanning = resolve(state.planningPath)
  const rel = relative(normalizedPlanning, fullPath)
  if (rel.startsWith("..") || isAbsolute(rel)) {
    return Response.json(
      { error: "Path is outside planning directory" },
      { status: 403 }
    )
  }

  try {
    const content = await readFile(fullPath, "utf-8")
    return Response.json({ path: requestedPath, content })
  } catch {
    return Response.json(
      { error: `File not found: ${requestedPath}` },
      { status: 404 }
    )
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
