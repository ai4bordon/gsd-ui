import type { Todo } from "../types.ts"
import { parseFrontmatter } from "./frontmatter.ts"

/**
 * Parse a todo file from todos/pending/ or todos/done/.
 *
 * Expected format:
 * ---
 * created: 2026-02-21T13:30:00.000Z
 * title: MCP test hardening -- SSE parsing, session lifecycle, error sanitization
 * area: testing
 * files:
 *   - src/mcp/protocol.test.ts
 *   - src/routes/mcp.test.ts
 * ---
 *
 * ## Problem
 *
 * Description of the problem...
 *
 * ## Solution
 *
 * Description of the solution...
 */
export function parseTodo(
  raw: string,
  fileName: string,
  isDone: boolean
): Todo {
  const { data, content } = parseFrontmatter(raw)
  const normalizedContent = content.replace(/\r\n?/g, "\n")

  const title = String(data.title ?? "")
  const area = String(data.area ?? "")
  const created = String(data.created ?? "")
  const files = asStringArray(data.files)

  // Extract date from filename: "2026-02-21-mcp-test-hardening.md"
  const dateMatch = fileName.match(/^(\d{4}-\d{2}-\d{2})/)
  const date = dateMatch?.[1] ?? created.substring(0, 10)

  // Extract slug from filename
  const slugMatch = fileName.match(
    /^\d{4}-\d{2}-\d{2}-(.+)\.md$/
  )
  const slug = slugMatch?.[1] ?? fileName.replace(/\.md$/, "")

  // Extract Problem section
  const problemMatch = normalizedContent.match(
    /## Problem\n\n([\s\S]*?)(?=\n## |$)/
  )
  const problem = problemMatch?.[1]?.trim() ?? ""

  // Extract Solution section
  const solutionMatch = normalizedContent.match(
    /## Solution\n\n([\s\S]*?)(?=\n## |$)/
  )
  const solution = solutionMatch?.[1]?.trim() ?? ""

  return {
    date,
    slug,
    fileName,
    title,
    area,
    files,
    status: isDone ? "done" : "pending",
    problem,
    solution,
    body: normalizedContent,
  }
}

function asStringArray(val: unknown): string[] {
  if (!val) return []
  if (Array.isArray(val)) return val.map(String)
  if (typeof val === "string") return [val]
  return []
}
