import type { Plan } from "../types.ts"
import { parseFrontmatter } from "./frontmatter.ts"

/**
 * Parse a PLAN.md file from a phase directory.
 *
 * Expected format:
 * ---
 * phase: 03-enrichment-and-pagination
 * plan: 01
 * type: execute
 * wave: 1
 * depends_on: []
 * files_modified:
 *   - src/services/task.service.ts
 * autonomous: true
 * requirements: [MCP-01, MCP-02]
 * must_haves:
 *   truths: [...]
 *   artifacts: [{ path, provides, contains?, exports? }]
 *   key_links: [{ from, to, via, pattern }]
 * ---
 *
 * <objective>...</objective>
 * <context>...</context>
 * <tasks>...</tasks>
 */
export function parsePlan(
  raw: string,
  fileName: string,
  filePath: string
): Plan {
  const { data, content } = parseFrontmatter(raw)

  const phase = String(data.phase ?? "")
  const frontmatterPlanNumber =
    typeof data.plan === "number"
      ? data.plan
      : parseInt(String(data.plan ?? "0"), 10)
  const planNumberFromFile = parsePlanNumberFromFileName(fileName)
  const planNumber =
    Number.isFinite(frontmatterPlanNumber) && frontmatterPlanNumber > 0
      ? frontmatterPlanNumber
      : planNumberFromFile
  const type = String(data.type ?? "execute")
  const wave = typeof data.wave === "number" ? data.wave : parseInt(String(data.wave ?? "1"), 10)
  const dependsOn = asStringArray(data.depends_on)
  const filesModified = asStringArray(data.files_modified)
  const autonomous = Boolean(data.autonomous ?? false)
  const requirements = asStringArray(data.requirements)

  // Parse must_haves
  const mustHavesRaw = data.must_haves as Record<string, unknown> | undefined
  const mustHaves = {
    truths: asStringArray(mustHavesRaw?.truths),
    artifacts: asArtifactArray(mustHavesRaw?.artifacts),
    keyLinks: asKeyLinkArray(mustHavesRaw?.key_links),
  }

  // Extract XML-like sections from body
  const objective = extractTag(content, "objective")
  const context = extractTag(content, "context") ?? extractTag(content, "execution_context")
  const tasks = extractTag(content, "tasks")

  return {
    phase,
    planNumber,
    fileName,
    filePath,
    type,
    wave,
    dependsOn,
    filesModified,
    autonomous,
    requirements,
    mustHaves,
    objective,
    context,
    tasks,
    status: "planned", // Default; will be upgraded by state builder when summary exists
  }
}

function parsePlanNumberFromFileName(fileName: string): number {
  const match = fileName.match(/^(\d+)-(\d+)-PLAN\.md$/i)
  if (!match?.[2]) return 0
  const parsed = parseInt(match[2], 10)
  return Number.isFinite(parsed) ? parsed : 0
}

/** Extract content between <tag>...</tag> */
function extractTag(content: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i")
  const match = content.match(regex)
  return match ? (match[1] ?? "").trim() : null
}

function asStringArray(val: unknown): string[] {
  if (!val) return []
  if (Array.isArray(val)) return val.map(String)
  if (typeof val === "string") return [val]
  return []
}

function asArtifactArray(
  val: unknown
): Array<{ path: string; provides: string; contains?: string; exports?: string[] }> {
  if (!Array.isArray(val)) return []
  return val.map((item: Record<string, unknown>) => ({
    path: String(item?.path ?? ""),
    provides: String(item?.provides ?? ""),
    contains: item?.contains ? String(item.contains) : undefined,
    exports: item?.exports
      ? asStringArray(item.exports)
      : undefined,
  }))
}

function asKeyLinkArray(
  val: unknown
): Array<{ from: string; to: string; via: string; pattern: string }> {
  if (!Array.isArray(val)) return []
  return val.map((item: Record<string, unknown>) => ({
    from: String(item?.from ?? ""),
    to: String(item?.to ?? ""),
    via: String(item?.via ?? ""),
    pattern: String(item?.pattern ?? ""),
  }))
}
