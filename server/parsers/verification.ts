import type { PhaseVerification } from "../types.ts"
import { parseFrontmatter } from "./frontmatter.ts"

/**
 * Parse a VERIFICATION.md file from a phase directory.
 */
export function parseVerification(raw: string): PhaseVerification {
  const { data, content } = parseFrontmatter(raw)
  const normalizedContent = content.replace(/\r\n?/g, "\n")

  const phase = String(data.phase ?? "")
  const verified = String(data.verified ?? "")
  const status = String(data.status ?? "unknown")
  const scoreRaw = String(data.score ?? "0/0")

  // Parse score: "7/7 must-haves verified" -> { num: 7, total: 7 }
  const scoreMatch = scoreRaw.match(/(\d+)\s*\/\s*(\d+)/)
  const scoreNum = scoreMatch
    ? parseInt(scoreMatch[1] ?? "0", 10)
    : 0
  const scoreTotal = scoreMatch
    ? parseInt(scoreMatch[2] ?? "0", 10)
    : 0

  // Re-verification detection
  const reVerifMatch = normalizedContent.match(
    /\*\*Re-verification:\*\*\s*(Yes|No)/i
  )
  const reVerification =
    (reVerifMatch?.[1] ?? "no").toLowerCase() === "yes"

  // Human verification items (if present)
  const humanVerification: NonNullable<PhaseVerification["humanVerification"]> =
    []
  const humanSection = normalizedContent.match(
    /(?:### Human Verification|## Human Verification)\n([\s\S]*?)(?=\n## |$)/
  )
  if (humanSection) {
    const sectionContent = humanSection[1] ?? ""
    const rowRegex =
      /\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/g
    let rowMatch: RegExpExecArray | null
    let headerSeen = false
    while ((rowMatch = rowRegex.exec(sectionContent)) !== null) {
      const col1 = (rowMatch[1] ?? "").trim()
      const col2 = (rowMatch[2] ?? "").trim()
      const col3 = (rowMatch[3] ?? "").trim()
      if (col1 === "Test" || col1.startsWith("---")) {
        headerSeen = true
        continue
      }
      if (!headerSeen) continue
      if (col1.startsWith("---")) continue

      humanVerification.push({
        test: col1,
        expected: col2,
        whyHuman: col3,
      })
    }
  }

  // Goal achievement summary
  const goalSection = normalizedContent.match(
    /## (?:Goal Achievement|Summary)\n([\s\S]*?)(?=\n## |$)/
  )
  const goalAchievement = (goalSection?.[1] ?? "").trim()

  return {
    phase,
    verified,
    status,
    score: scoreRaw,
    scoreNum,
    scoreTotal,
    reVerification,
    humanVerification:
      humanVerification.length > 0 ? humanVerification : undefined,
    goalAchievement,
    body: normalizedContent,
  }
}
