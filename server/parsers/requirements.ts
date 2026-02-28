import type { Requirement } from "../types.ts"

/**
 * Parse REQUIREMENTS.md to extract individual requirement items.
 */
export function parseRequirements(raw: string): Requirement[] {
  const normalized = raw.replace(/\r\n?/g, "\n")
  const requirements: Requirement[] = []

  // Extract current milestone from header
  const headerMatch = normalized.match(/# Requirements:.*?(v[\d.]+)/)
  const defaultMilestone = headerMatch?.[1] ?? ""

  // Build a traceability map: requirement ID -> references (phase rows)
  const traceMap = new Map<string, string[]>()
  const traceSection = normalized.match(
    /## Traceability\n([\s\S]*?)(?=\n## |$)/
  )
  if (traceSection) {
    const traceContent = traceSection[1] ?? ""
    const rowRegex = /\|\s*([A-Z]+-\d+)\s*\|\s*([^|]+)\|\s*([^|]+)\|/g
    let rowMatch: RegExpExecArray | null
    while ((rowMatch = rowRegex.exec(traceContent)) !== null) {
      const reqId = rowMatch[1] ?? ""
      const phaseRef = (rowMatch[2] ?? "").trim()
      if (!phaseRef || /^[-\s]+$/.test(phaseRef)) continue
      const existing = traceMap.get(reqId) ?? []
      if (!existing.includes(phaseRef)) {
        existing.push(phaseRef)
      }
      traceMap.set(reqId, existing)
    }
  }

  // Parse requirement entries
  let currentSection = ""
  let currentMilestone = defaultMilestone

  const lines = normalized.split("\n")
  for (const line of lines) {
    // Track sections: ## Core (v1.0), ### Brand Application
    const sectionMatch = line.match(/^(#{2,3})\s+(.+)$/)
    if (sectionMatch) {
      const level = (sectionMatch[1] ?? "").length
      currentSection = (sectionMatch[2] ?? "").trim()

      const milestoneMatch = currentSection.match(/\b(v\d+(?:\.\d+)*)\b/i)
      if (milestoneMatch?.[1]) {
        currentMilestone = milestoneMatch[1]
      } else if (level === 2) {
        if (/\b(future|deferred|v2)\b/i.test(currentSection)) {
          currentMilestone = "future"
        } else {
          currentMilestone = defaultMilestone
        }
      }
      continue
    }

    // Match requirement entries:
    // - [x] **BRAND-01**: Description
    // - [x] BRAND-01: Description
    const reqMatch = line.match(
      /^- \[([x ])\]\s*(?:\*\*)?([A-Z]+-\d+)(?:\*\*)?:\s*(.+)$/
    )
    if (reqMatch) {
      const isComplete = (reqMatch[1] ?? "") === "x"
      const id = reqMatch[2] ?? ""
      const description = (reqMatch[3] ?? "").trim()
      const traceRefs = traceMap.get(id)

      requirements.push({
        id,
        description,
        status: isComplete ? "complete" : "pending",
        section: currentSection,
        milestone: currentMilestone,
        fulfilledByPlans: traceRefs && traceRefs.length > 0 ? [...traceRefs] : undefined,
      })
      continue
    }

    const reqWithoutCheckboxMatch = line.match(
      /^-\s*(?:\*\*)?([A-Z]+-\d+)(?:\*\*)?:\s*(.+)$/
    )
    if (reqWithoutCheckboxMatch) {
      const id = reqWithoutCheckboxMatch[1] ?? ""
      const traceRefs = traceMap.get(id)
      requirements.push({
        id,
        description: (reqWithoutCheckboxMatch[2] ?? "").trim(),
        status: "pending",
        section: currentSection,
        milestone: currentMilestone,
        fulfilledByPlans: traceRefs && traceRefs.length > 0 ? [...traceRefs] : undefined,
      })
    }
  }

  // Also parse "Future Requirements" and "Deferred Features" sections
  // These use - **ID**: Description (no checkbox)
  const futureSection = normalized.match(
    /## Future Requirements\n([\s\S]*?)(?=\n## |$)/
  )
  if (futureSection) {
    const futureContent = futureSection[1] ?? ""
    let futureSubsection = "Future"
    for (const line of futureContent.split("\n")) {
      const subMatch = line.match(/^###\s+(.+)$/)
      if (subMatch) {
        futureSubsection = (subMatch[1] ?? "").trim()
        continue
      }
      const futureReqMatch = line.match(
        /^- \*\*([A-Z]+-\d+)\*\*:\s*(.+)$/
      )
      if (futureReqMatch) {
        requirements.push({
          id: futureReqMatch[1] ?? "",
          description: (futureReqMatch[2] ?? "").trim(),
          status: "pending",
          section: futureSubsection,
          milestone: "future",
        })
      }
    }
  }

  return requirements
}
