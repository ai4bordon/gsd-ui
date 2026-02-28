import type { PlanSummary } from "../types.ts"
import { parseFrontmatter } from "./frontmatter.ts"

/**
 * Parse a SUMMARY.md file from a phase directory.
 */
export function parseSummary(raw: string, fileName: string): PlanSummary {
  const { data, content } = parseFrontmatter(raw)

  const body = content.replace(/\r\n?/g, "\n")

  // Extract inline metadata
  const phase =
    String(data.phase ?? "") || (extractInline(body, "phase") ?? "")
  const plan =
    typeof data.plan === "number"
      ? data.plan
      : parseInt(extractInline(body, "plan") ?? "0", 10)
  const subsystem =
    String(data.subsystem ?? "") || (extractInline(body, "subsystem") ?? undefined)
  const tags = data.tags
    ? asStringArray(data.tags)
    : extractTagsList(body, "tags")

  // One-liner
  const oneLinerMatch = body.match(/\*\*One-liner:\*\*\s*(.+)/)
  const oneLiner = (oneLinerMatch?.[1] ?? "").trim()

  // Duration/completed/started from frontmatter first, then body fallbacks
  const duration =
    asScalarString(data.duration) ||
    extractInline(body, "duration") ||
    extractBoldMetric(body, ["Duration", "Длительность"]) ||
    ""

  const completed =
    asScalarString(data.completed) ||
    extractInline(body, "completed") ||
    extractBoldMetric(body, ["Completed", "Завершено"]) ||
    ""

  const started =
    asScalarString(data.started) ||
    extractInline(body, "started") ||
    extractBoldMetric(body, ["Started", "Старт"]) ||
    ""

  const statusMatch = body.match(/status:\s*(.+?)$/m)
  const status = (statusMatch?.[1] ?? "complete").trim()

  // Files created and modified
  const filesCreated = extractFileList(body, "Created")
  const filesModified = extractFileList(body, "Modified")

  // Decisions table
  const decisions = extractDecisionsTable(body)

  return {
    phase,
    plan,
    status,
    started,
    completed,
    duration,
    subsystem: subsystem || undefined,
    tags: tags.length > 0 ? tags : undefined,
    oneLiner,
    filesCreated,
    filesModified,
    decisions,
    body,
  }
}

function extractInline(body: string, key: string): string | null {
  const regex = new RegExp(`^${key}:\\s*(.+)$`, "m")
  const match = body.match(regex)
  return match ? (match[1] ?? "").trim() : null
}

function extractTagsList(body: string, key: string): string[] {
  const regex = new RegExp(`^${key}:\\s*\\[(.+)\\]$`, "m")
  const match = body.match(regex)
  if (!match) return []
  return (match[1] ?? "").split(",").map((s) => s.trim())
}

function asStringArray(val: unknown): string[] {
  if (!val) return []
  if (Array.isArray(val)) return val.map(String)
  if (typeof val === "string") return [val]
  return []
}

function asScalarString(val: unknown): string {
  if (typeof val === "string") return val.trim()
  if (typeof val === "number") return String(val)
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return val.toISOString().slice(0, 10)
  }
  return ""
}

function extractBoldMetric(body: string, labels: string[]): string | null {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const regex = new RegExp(`^\\s*[-*]?\\s*\\*\\*${escaped}:\\*\\*\\s*(.+)$`, "im")
    const match = body.match(regex)
    if (match?.[1]) {
      return match[1].trim()
    }
  }
  return null
}

function extractFileList(body: string, heading: string): string[] {
  const regex = new RegExp(
    `### ${heading}\\n([\\s\\S]*?)(?=\\n### |\\n## |$)`
  )
  const match = body.match(regex)
  if (!match) return []

  const files: string[] = []
  const content = match[1] ?? ""
  const lines = content.split("\n")
  for (const line of lines) {
    const fileMatch = line.match(/^- (.+)/)
    if (fileMatch) {
      files.push((fileMatch[1] ?? "").trim())
    }
  }
  return files
}

function extractDecisionsTable(
  body: string
): Array<{ decision: string; rationale: string }> {
  const decisions: Array<{ decision: string; rationale: string }> = []

  const sectionMatch = body.match(
    /##\s*(?:Decisions(?:\s+Made)?|Решения)\n([\s\S]*?)(?=\n## |$)/i
  )
  if (!sectionMatch) return decisions

  const sectionContent = sectionMatch[1] ?? ""

  // Parse markdown table rows: | Decision | Rationale |
  const rowRegex = /\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/g
  let rowMatch: RegExpExecArray | null
  let headerSeen = false
  while ((rowMatch = rowRegex.exec(sectionContent)) !== null) {
    const col1 = (rowMatch[1] ?? "").trim()
    const col2 = (rowMatch[2] ?? "").trim()

    // Skip header and separator rows
    if (col1 === "Decision" || col1.startsWith("---")) {
      headerSeen = true
      continue
    }
    if (!headerSeen) continue
    if (col1.startsWith("---")) continue

    decisions.push({
      decision: col1,
      rationale: col2,
    })
  }

  if (decisions.length > 0) {
    return decisions
  }

  // Fallback: bullet/numbered decisions without a markdown table
  const lines = sectionContent.split("\n")
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || /^none\.?$/i.test(line) || /^нет\.?$/i.test(line)) {
      continue
    }
    const listMatch = line.match(/^(?:[-*]|\d+\.)\s+(.+)$/)
    if (!listMatch) continue

    const text = (listMatch[1] ?? "").trim()
    if (!text) continue

    const splitMatch = text.match(/^(.+?)\s+[—–-]\s+(.+)$/)
    if (splitMatch) {
      decisions.push({
        decision: (splitMatch[1] ?? "").trim(),
        rationale: (splitMatch[2] ?? "").trim(),
      })
    } else {
      decisions.push({
        decision: text,
        rationale: "",
      })
    }
  }

  return decisions
}
