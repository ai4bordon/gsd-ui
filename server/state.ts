import { readdir, readFile, stat } from "node:fs/promises"
import { join, basename, relative, extname } from "node:path"
import type {
  GsdState,
  ProjectState,
  Phase,
  Plan,
  Milestone,
  Decision,
  SearchEntry,
  ResearchDocument,
  Todo,
  MarkdownDocument,
} from "./types.ts"
import { parseConfig } from "./parsers/config.ts"
import { parseState } from "./parsers/state.ts"
import { parseRoadmap, roadmapMilestonesToMilestones } from "./parsers/roadmap.ts"
import { parseRequirements } from "./parsers/requirements.ts"
import { parsePlan } from "./parsers/plan.ts"
import { parseSummary } from "./parsers/summary.ts"
import { parseVerification } from "./parsers/verification.ts"
import { parseTodo } from "./parsers/todo.ts"
import { parseMarkdown } from "./parsers/markdown.ts"

/**
 * Build the complete GsdState from a .planning/ directory.
 */
export async function buildInitialState(
  planningPath: string
): Promise<GsdState> {
  const projectPath = join(planningPath, "..")

  const state: GsdState = {
    projectPath,
    planningPath,
    config: null,
    state: null,
    projectDoc: null,
    milestones: [],
    currentMilestone: null,
    phases: [],
    requirements: [],
    todos: [],
    research: [],
    decisions: [],
    searchIndex: [],
  }

  // Parse top-level files in parallel
  const [configRaw, stateRaw, roadmapRaw, requirementsRaw, projectRaw] =
    await Promise.all([
      readFileSafe(join(planningPath, "config.json")),
      readFileSafe(join(planningPath, "STATE.md")),
      readFileSafe(join(planningPath, "ROADMAP.md")),
      readFileSafe(join(planningPath, "REQUIREMENTS.md")),
      readFileSafe(join(planningPath, "PROJECT.md")),
    ])

  if (configRaw) state.config = parseConfig(configRaw)
  if (stateRaw) state.state = parseState(stateRaw)
  if (requirementsRaw) state.requirements = parseRequirements(requirementsRaw)
  if (projectRaw) {
    state.projectDoc = parseMarkdown(
      projectRaw,
      "PROJECT.md",
      join(planningPath, "PROJECT.md")
    )
  }

  // Parse roadmap and create milestones
  const roadmapParsedBase = roadmapRaw ? parseRoadmap(roadmapRaw) : []
  const roadmapParsed = await mergeMilestoneRoadmaps(planningPath, roadmapParsedBase)
  let roadmapMilestones: Milestone[] = []
  if (roadmapParsed.length > 0) {
    roadmapMilestones = roadmapMilestonesToMilestones(roadmapParsed)
  }

  // Parse phases from filesystem
  const phasesDir = join(planningPath, "phases")
  state.phases = await parsePhases(phasesDir, planningPath)
  enrichPhasesFromRoadmap(state.phases, roadmapParsed)

  // Parse research documents
  state.research = await parseResearchDocs(planningPath, state.phases)

  // Parse todos
  state.todos = await parseTodos(planningPath)

  // Assign phases to milestones
  state.milestones = assignPhasesToMilestones(
    roadmapMilestones,
    state.phases
  )
  syncMilestonesFromRequirements(state)

  // Determine current milestone
  if (state.state?.milestoneName) {
    state.currentMilestone =
      state.milestones.find(
        (m) => m.version === state.state?.milestoneName
      ) ?? null
  }

  // Cross-reference requirements to plans
  crossReferenceRequirements(state)

  // Extract decisions from summaries
  state.decisions = extractAllDecisions(state.phases)

  // Build search index
  state.searchIndex = buildSearchIndex(state)

  const roadmapPhaseCount = roadmapParsed.reduce(
    (sum, milestone) => sum + (milestone.phases?.length ?? 0),
    0
  )
  applyStateFallbacks(state, roadmapPhaseCount)

  return state
}

async function mergeMilestoneRoadmaps(
  planningPath: string,
  primary: ReturnType<typeof parseRoadmap>
): Promise<ReturnType<typeof parseRoadmap>> {
  const byVersion = new Map<string, ReturnType<typeof parseRoadmap>[number]>()

  for (const milestone of primary) {
    byVersion.set(milestone.version, milestone)
  }

  const milestonesDir = join(planningPath, "milestones")
  if (!(await dirExists(milestonesDir))) {
    return [...byVersion.values()]
  }

  let entries: Array<{ isDirectory(): boolean; name: string }> = []
  try {
    entries = (await readdir(milestonesDir, { withFileTypes: true })) as Array<{
      isDirectory(): boolean
      name: string
    }>
  } catch {
    return [...byVersion.values()]
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const dirVersion = String(entry.name)
    const milestoneDir = join(milestonesDir, dirVersion)
    const roadmapPath = join(milestoneDir, "ROADMAP.md")
    const statePath = join(milestoneDir, "STATE.md")

    const roadmapRaw = await readFileSafe(roadmapPath)
    if (!roadmapRaw) continue

    const parsed = parseRoadmap(roadmapRaw)
    if (parsed.length === 0) continue

    const inferredStatus = inferMilestoneStatusFromState(await readFileSafe(statePath))

    for (const milestone of parsed) {
      const normalized: ReturnType<typeof parseRoadmap>[number] = {
        ...milestone,
        version: dirVersion,
        name: /^milestone\s+v\d/i.test(milestone.name)
          ? `Milestone ${dirVersion}`
          : milestone.name,
        status: inferredStatus ?? milestone.status,
        category:
          (inferredStatus ?? milestone.status) === "shipped"
            ? "shipped"
            : milestone.category,
      }

      if (!byVersion.has(normalized.version)) {
        byVersion.set(normalized.version, normalized)
      }
    }
  }

  return [...byVersion.values()]
}

function inferMilestoneStatusFromState(
  raw: string | null
): Milestone["status"] | null {
  if (!raw) return null

  const normalized = raw.replace(/\r\n?/g, "\n")

  if (
    /(?:status|статус)\s*:\s*(?:phase\s+complete|milestone\s+complete|completed|завершен|завершено)/i.test(normalized) ||
    /\b100%\b/.test(normalized)
  ) {
    return "shipped"
  }

  if (/(?:status|статус)\s*:\s*(?:in\s*progress|milestone\s+initialized|в\s*работе|инициализирован)/i.test(normalized)) {
    return "in_progress"
  }

  return null
}

/**
 * Incrementally update state for a file change event.
 * For simplicity, this does a targeted re-parse of the changed file
 * and updates the relevant portion of state.
 */
export async function updateStateForFile(
  state: GsdState,
  filePath: string,
  event: "add" | "change" | "unlink"
): Promise<void> {
  const rel = relative(state.planningPath, filePath).replace(/\\/g, "/")
  const fileName = basename(filePath)

  // Handle top-level files
  if (fileName === "config.json") {
    if (event === "unlink") {
      state.config = null
    } else {
      const raw = await readFileSafe(filePath)
      state.config = raw ? parseConfig(raw) : null
    }
    return
  }

  if (fileName === "STATE.md") {
    if (event === "unlink") {
      state.state = null
    } else {
      const raw = await readFileSafe(filePath)
      state.state = raw ? parseState(raw) : null
      applyStateFallbacks(state)
    }
    return
  }

  if (fileName === "PROJECT.md") {
    if (event === "unlink") {
      state.projectDoc = null
    } else {
      const raw = await readFileSafe(filePath)
      state.projectDoc = raw
        ? parseMarkdown(raw, "PROJECT.md", filePath)
        : null
    }
    return
  }

  if (fileName === "ROADMAP.md" || fileName === "REQUIREMENTS.md") {
    // Full rebuild for roadmap/requirements changes -- they affect milestones and cross-refs
    const rebuilt = await buildInitialState(state.planningPath)
    Object.assign(state, rebuilt)
    return
  }

  // Handle phase files
  if (rel.startsWith("phases/")) {
    const previousPhases = state.phases

    // Re-parse all phases (simpler and safe for file adds/removes)
    const phasesDir = join(state.planningPath, "phases")
    state.phases = await parsePhases(phasesDir, state.planningPath)
    copyPhaseMetadata(previousPhases, state.phases)

    // Re-assign to milestones
    state.milestones = assignPhasesToMilestones(
      state.milestones.map((m) => ({ ...m, phases: [] })),
      state.phases
    )
    syncMilestonesFromRequirements(state)

    // Re-extract decisions
    state.decisions = extractAllDecisions(state.phases)

    // Rebuild research index (phase research docs can change under phases/)
    state.research = await parseResearchDocs(state.planningPath, state.phases)

    // Update current milestone
    if (state.state?.milestoneName) {
      state.currentMilestone =
        state.milestones.find(
          (m) => m.version === state.state?.milestoneName
        ) ?? null
    }

    crossReferenceRequirements(state)
    state.searchIndex = buildSearchIndex(state)
    return
  }

  // Handle todo files
  if (rel.startsWith("todos/")) {
    state.todos = await parseTodos(state.planningPath)
    state.searchIndex = buildSearchIndex(state)
    return
  }

  // Handle research files
  if (rel.startsWith("research/")) {
    state.research = await parseResearchDocs(state.planningPath, state.phases)
    state.searchIndex = buildSearchIndex(state)
    return
  }
}

function phaseNumberKey(value: number | string): string {
  return String(value)
}

function samePhaseNumber(a: number | string, b: number | string): boolean {
  const numA = typeof a === "number" ? a : parseFloat(String(a))
  const numB = typeof b === "number" ? b : parseFloat(String(b))
  if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
    return numA === numB
  }
  return String(a) === String(b)
}

function enrichPhasesFromRoadmap(
  phases: Phase[],
  roadmapMilestones: ReturnType<typeof parseRoadmap>
): void {
  for (const milestone of roadmapMilestones) {
    for (const phaseStub of milestone.phases) {
      const target = phases.find((phase) =>
        samePhaseNumber(phase.number, phaseStub.number)
      )
      if (!target) continue
      if (!target.goal && phaseStub.goal) {
        target.goal = phaseStub.goal
      }
      if (!target.slug && phaseStub.slug) {
        target.slug = phaseStub.slug
      }
    }
  }
}

function copyPhaseMetadata(previous: Phase[], next: Phase[]): void {
  const previousByNumber = new Map<string, Phase>()
  for (const phase of previous) {
    previousByNumber.set(phaseNumberKey(phase.number), phase)
  }

  for (const phase of next) {
    const old = previousByNumber.get(phaseNumberKey(phase.number))
    if (!old) continue
    if (!phase.goal && old.goal) {
      phase.goal = old.goal
    }
    if (!phase.slug && old.slug) {
      phase.slug = old.slug
    }
  }
}

function parseDurationMinutes(value: string | undefined): number | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  if (!normalized || normalized === "pending") return null

  const hmsMatch = normalized.match(/^(\d+):(\d{2}):(\d{2})$/)
  if (hmsMatch) {
    const hours = parseInt(hmsMatch[1] ?? "0", 10)
    const minutes = parseInt(hmsMatch[2] ?? "0", 10)
    const seconds = parseInt(hmsMatch[3] ?? "0", 10)
    return hours * 60 + minutes + seconds / 60
  }

  const mmssMatch = normalized.match(/^(\d+):(\d{2})$/)
  if (mmssMatch) {
    const minutes = parseInt(mmssMatch[1] ?? "0", 10)
    const seconds = parseInt(mmssMatch[2] ?? "0", 10)
    return minutes + seconds / 60
  }

  let minutes = 0
  let matched = false

  const hourMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:h|hr|hrs|hour|hours|ч)/)
  if (hourMatch?.[1]) {
    minutes += parseFloat(hourMatch[1].replace(",", ".")) * 60
    matched = true
  }

  const minuteMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:m|min|mins|minute|minutes|м|мин)/)
  if (minuteMatch?.[1]) {
    minutes += parseFloat(minuteMatch[1].replace(",", "."))
    matched = true
  }

  const secondMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:s|sec|secs|second|seconds|с|сек)/)
  if (secondMatch?.[1]) {
    minutes += parseFloat(secondMatch[1].replace(",", ".")) / 60
    matched = true
  }

  if (matched) {
    return minutes
  }

  const numericOnly = normalized.match(/^(\d+(?:[.,]\d+)?)$/)
  if (numericOnly?.[1]) {
    return parseFloat(numericOnly[1].replace(",", "."))
  }

  return null
}

function computeVelocityFromPhases(phases: Phase[]): {
  totalPlans: number
  avgDuration: number
  totalDuration: number
  phaseMetrics: ProjectState["phaseMetrics"]
} {
  let completedPlans = 0
  let plansWithDuration = 0
  let totalDuration = 0

  const phaseMetrics: ProjectState["phaseMetrics"] = []

  for (const phase of phases) {
    const completed = phase.plans.filter((plan) => !!plan.summary)
    completedPlans += completed.length

    let phaseDuration = 0
    let phasePlansWithDuration = 0

    for (const plan of completed) {
      const minutes = parseDurationMinutes(plan.summary?.duration)
      if (minutes == null || Number.isNaN(minutes) || minutes <= 0) continue
      phaseDuration += minutes
      phasePlansWithDuration += 1
    }

    plansWithDuration += phasePlansWithDuration
    totalDuration += phaseDuration

    if (completed.length > 0) {
      phaseMetrics.push({
        phase: `P${phase.number}`,
        plans: completed.length,
        totalMinutes: Math.round(phaseDuration),
        avgPerPlan:
          phasePlansWithDuration > 0
            ? Math.round(phaseDuration / phasePlansWithDuration)
            : 0,
      })
    }
  }

  return {
    totalPlans: completedPlans,
    avgDuration:
      plansWithDuration > 0
        ? totalDuration / plansWithDuration
        : 0,
    totalDuration,
    phaseMetrics,
  }
}

function applyStateFallbacks(state: GsdState, roadmapPhaseCount = 0): void {
  if (!state.state) return

  const derived = computeVelocityFromPhases(state.phases)

  if (
    (!state.state.velocity ||
      (state.state.velocity.totalPlans === 0 &&
        state.state.velocity.avgDuration === 0 &&
        state.state.velocity.totalDuration === 0)) &&
    (derived.totalPlans > 0 || derived.totalDuration > 0)
  ) {
    state.state.velocity = {
      totalPlans: derived.totalPlans,
      avgDuration: Math.round(derived.avgDuration),
      totalDuration: Math.round(derived.totalDuration),
    }
  }

  if (
    (!state.state.phaseMetrics || state.state.phaseMetrics.length === 0) &&
    derived.phaseMetrics.length > 0
  ) {
    state.state.phaseMetrics = derived.phaseMetrics
  }

  if (state.state.totalPhases === 0) {
    const phasesFromMilestones = state.milestones.reduce(
      (sum, milestone) => sum + (milestone.phases?.length ?? 0),
      0
    )
    const fallbackTotal = roadmapPhaseCount || phasesFromMilestones || state.phases.length
    if (fallbackTotal > 0) {
      state.state.totalPhases = fallbackTotal
    }
  }

  if (state.state.currentPhase === 0 && state.phases.length > 0) {
    const numericPhases = state.phases
      .map((phase) => {
        const n = parseFloat(String(phase.number))
        return Number.isNaN(n) ? null : n
      })
      .filter((n): n is number => n != null)
    if (numericPhases.length > 0) {
      state.state.currentPhase = Math.max(...numericPhases)
    }
  }

  if (
    state.state.progressPercent === 0 &&
    state.state.currentPhase > 0 &&
    state.state.totalPhases > 0
  ) {
    const calculated = Math.round(
      (state.state.currentPhase / state.state.totalPhases) * 100
    )
    state.state.progressPercent = Math.max(0, Math.min(100, calculated))
  }
}

// ---- Internal helpers ----

async function readFileSafe(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf-8")
  } catch {
    return null
  }
}

async function dirExists(path: string): Promise<boolean> {
  try {
    const s = await stat(path)
    return s.isDirectory()
  } catch {
    return false
  }
}

/**
 * Parse all phase directories under phases/.
 * Handles naming patterns:
 * - "01-core-endpoint"
 * - "07.1-api-response-consistency"
 * - "phase-41"
 */
async function parsePhases(
  phasesDir: string,
  planningPath: string
): Promise<Phase[]> {
  if (!(await dirExists(phasesDir))) return []

  const entries = await readdir(phasesDir, { withFileTypes: true })
  const phaseDirs = entries.filter((e) => e.isDirectory())

  const phases: Phase[] = []

  for (const dir of phaseDirs) {
    const dirPath = join(phasesDir, dir.name)
    const phase = await parsePhaseDirectory(dir.name, dirPath, planningPath)
    if (phase) phases.push(phase)
  }

  // Sort by phase number
  phases.sort((a, b) => {
    const numA = typeof a.number === "number" ? a.number : parseFloat(String(a.number))
    const numB = typeof b.number === "number" ? b.number : parseFloat(String(b.number))
    return numA - numB
  })

  return phases
}

async function parsePhaseDirectory(
  dirName: string,
  dirPath: string,
  planningPath: string
): Promise<Phase | null> {
  // Extract phase number and slug from directory name
  // "01-core-endpoint" -> number=1, slug="core-endpoint"
  // "07.1-api-response-consistency" -> number="7.1", slug="api-response-consistency"
  // "phase-41" -> number=41, slug=""
  let phaseNumber: number | string = 0
  let slug = ""

  const phaseNNMatch = dirName.match(/^phase-(\d+)$/)
  const numberedMatch = dirName.match(/^(\d+(?:\.\d+)?)-(.+)$/)

  if (phaseNNMatch) {
    phaseNumber = parseInt(phaseNNMatch[1] ?? "0", 10)
    slug = ""
  } else if (numberedMatch) {
    const numStr = numberedMatch[1] ?? "0"
    phaseNumber = numStr.includes(".")
      ? numStr
      : parseInt(numStr, 10)
    slug = numberedMatch[2] ?? ""
  } else {
    // Unknown naming format -- skip
    return null
  }

  // Read all files in the phase directory
  let files: string[] = []
  try {
    const entries = await readdir(dirPath)
    files = entries.filter((f) => f.endsWith(".md"))
  } catch {
    return null
  }

  const plans: Plan[] = []
  let research: MarkdownDocument | undefined
  let context: MarkdownDocument | undefined
  let uat: MarkdownDocument | undefined
  let verification = undefined

  // Prefix for matching files: "03" for "03-enrichment-and-pagination", "43" for "phase-43"
  const phasePrefix = String(
    typeof phaseNumber === "number" ? phaseNumber : phaseNumber
  ).replace(".", "")

  for (const file of files) {
    const filePath = join(dirPath, file)
    const raw = await readFileSafe(filePath)
    if (!raw) continue

    if (file.match(/-PLAN\.md$/i)) {
      // Plan file: 03-01-PLAN.md, 43-01-PLAN.md
      const plan = parsePlan(raw, file, filePath)
      plans.push(plan)
    } else if (file.match(/-SUMMARY\.md$/i)) {
      // Summary file: 03-01-SUMMARY.md
      const summary = parseSummary(raw, file)
      // Match summary to plan by plan number
      const planNumMatch = file.match(/(\d+)-(\d+)-SUMMARY/i)
      if (planNumMatch) {
        const planNum = parseInt(planNumMatch[2] ?? "0", 10)
        const matchingPlan = plans.find((p) => p.planNumber === planNum)
        if (matchingPlan) {
          matchingPlan.summary = summary
          matchingPlan.status = "complete"
        }
      }
    } else if (file.match(/-VERIFICATION\.md$/i)) {
      // Verification file: 03-VERIFICATION.md
      verification = parseVerification(raw)
    } else if (file.match(/-RESEARCH\.md$/i)) {
      // Research file: 03-RESEARCH.md
      research = parseMarkdown(raw, file, filePath)
    } else if (file.match(/-CONTEXT\.md$/i)) {
      // Context file: 03-CONTEXT.md
      context = parseMarkdown(raw, file, filePath)
    } else if (file.match(/-UAT\.md$/i)) {
      // UAT file: 03-UAT.md
      uat = parseMarkdown(raw, file, filePath)
    }
  }

  // Sort plans by plan number
  plans.sort((a, b) => a.planNumber - b.planNumber)

  // Second pass: match summaries that weren't matched in first pass
  // (happens when summaries are parsed before their corresponding plans)
  for (const file of files) {
    if (!file.match(/-SUMMARY\.md$/i)) continue
    const planNumMatch = file.match(/(\d+)-(\d+)-SUMMARY/i)
    if (!planNumMatch) continue
    const planNum = parseInt(planNumMatch[2] ?? "0", 10)
    const matchingPlan = plans.find((p) => p.planNumber === planNum)
    if (matchingPlan && !matchingPlan.summary) {
      const filePath = join(dirPath, file)
      const raw = await readFileSafe(filePath)
      if (raw) {
        matchingPlan.summary = parseSummary(raw, file)
        matchingPlan.status = "complete"
      }
    }
  }

  // Derive phase status
  const phaseStatus = derivePhaseStatus(plans, verification, research)

  // Calculate metrics from state.md phase metrics table (or from plan data)
  const planCount = plans.length
  const metrics =
    planCount > 0
      ? {
          planCount,
          totalMinutes: 0,
          avgPerPlan: 0,
        }
      : undefined

  // Determine milestone from plan frontmatter or directory path
  const milestone = "" // Will be assigned by assignPhasesToMilestones

  return {
    number: phaseNumber,
    slug,
    dirName,
    dirPath,
    goal: "", // Will be enriched from roadmap
    milestone,
    status: phaseStatus,
    plans,
    research,
    context,
    uat,
    verification,
    metrics,
  }
}

function derivePhaseStatus(
  plans: Plan[],
  verification: Phase["verification"],
  research: MarkdownDocument | undefined
): Phase["status"] {
  if (verification) return "verified"
  if (plans.length > 0 && plans.every((p) => p.summary)) return "summarized"
  if (plans.length > 0 && plans.some((p) => p.summary)) return "executing"
  if (research) return "researched"
  return "planned"
}

/**
 * Assign filesystem Phase objects into milestones based on phase number ranges.
 */
function assignPhasesToMilestones(
  milestones: Milestone[],
  phases: Phase[]
): Milestone[] {
  for (const milestone of milestones) {
    milestone.phases = []

    // Parse phase range: "Phases 1-3", "Phase 4", "Phases 40-45"
    const rangeMatch = milestone.phaseRange.match(
      /(\d+)(?:\s*[-–]\s*(\d+))?/
    )
    if (!rangeMatch) continue

    const rangeStart = parseInt(rangeMatch[1] ?? "0", 10)
    const rangeEnd = rangeMatch[2]
      ? parseInt(rangeMatch[2], 10)
      : rangeStart

    for (const phase of phases) {
      const phaseNum =
        typeof phase.number === "number"
          ? phase.number
          : parseFloat(String(phase.number))
      if (phaseNum >= rangeStart && phaseNum <= rangeEnd) {
        phase.milestone = milestone.version
        milestone.phases.push(phase)
      }
    }
  }

  return milestones
}

function syncMilestonesFromRequirements(state: GsdState): void {
  const existing = new Set(state.milestones.map((m) => m.version.toLowerCase()))
  const currentMilestone = state.state?.milestoneName ?? ""

  const reqByMilestone = new Map<string, { total: number; complete: number; pending: number }>()
  for (const req of state.requirements) {
    const milestone = req.milestone?.trim()
    if (!milestone) continue
    if (!isMilestoneLike(milestone)) continue

    const bucket = reqByMilestone.get(milestone) ?? {
      total: 0,
      complete: 0,
      pending: 0,
    }
    bucket.total += 1
    if (req.status === "complete") {
      bucket.complete += 1
    } else {
      bucket.pending += 1
    }
    reqByMilestone.set(milestone, bucket)
  }

  for (const [milestone, stats] of reqByMilestone.entries()) {
    if (existing.has(milestone.toLowerCase())) continue

    const inferredStatus: Milestone["status"] =
      stats.pending === 0
        ? "shipped"
        : stats.complete > 0
          ? "in_progress"
          : "planned"

    const isFuture = isFutureMilestone(milestone, currentMilestone)
    const inferredCategory: Milestone["category"] =
      inferredStatus === "shipped"
        ? "shipped"
        : isFuture
          ? "post_launch"
          : "go_live_gate"

    const virtualPhases = buildVirtualPhasesFromRequirements(
      state,
      milestone
    )

    state.milestones.push({
      version: milestone,
      name: `Milestone ${milestone}`,
      phaseRange: "",
      status: inferredStatus,
      category: inferredCategory,
      phases: virtualPhases,
      stats: `Requirements: ${stats.complete}/${stats.total} complete`,
    })
  }

  state.milestones.sort((a, b) => compareMilestoneVersions(a.version, b.version))
}

function buildVirtualPhasesFromRequirements(
  state: GsdState,
  milestone: string
): Phase[] {
  const grouped = new Map<string, typeof state.requirements>()

  for (const req of state.requirements) {
    if ((req.milestone ?? "").trim() !== milestone) continue
    const section = req.section?.trim() || "Uncategorized"
    const bucket = grouped.get(section) ?? []
    bucket.push(req)
    grouped.set(section, bucket)
  }

  const phases: Phase[] = []
  let index = 1
  for (const [section, reqs] of grouped.entries()) {
    const complete = reqs.filter((r) => r.status === "complete").length
    const total = reqs.length

    const status: Phase["status"] =
      complete === total
        ? "summarized"
        : complete > 0
          ? "executing"
          : "planned"

    const slug = section
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")

    phases.push({
      number: `R${index}`,
      slug,
      dirName: "",
      dirPath: "",
      goal: `${section} (${complete}/${total} complete)`,
      milestone,
      status,
      plans: [],
    })

    index += 1
  }

  return phases
}

function isMilestoneLike(value: string): boolean {
  return /^v\d+(?:\.\d+)*$/i.test(value) || value.toLowerCase() === "future"
}

function isFutureMilestone(candidate: string, current: string): boolean {
  if (candidate.toLowerCase() === "future") return true
  if (!/^v\d+(?:\.\d+)*$/i.test(candidate)) return false

  const currentParts = parseVersionParts(current)
  const candidateParts = parseVersionParts(candidate)
  if (!currentParts || !candidateParts) {
    return true
  }
  return compareVersionParts(candidateParts, currentParts) > 0
}

function parseVersionParts(value: string): number[] | null {
  const match = value.match(/^v(\d+(?:\.\d+)*)$/i)
  if (!match) return null
  return (match[1] ?? "")
    .split(".")
    .map((part) => Number.parseInt(part, 10))
    .filter((n) => Number.isFinite(n))
}

function compareVersionParts(a: number[], b: number[]): number {
  const maxLen = Math.max(a.length, b.length)
  for (let i = 0; i < maxLen; i += 1) {
    const av = a[i] ?? 0
    const bv = b[i] ?? 0
    if (av !== bv) return av - bv
  }
  return 0
}

function compareMilestoneVersions(a: string, b: string): number {
  const aParts = parseVersionParts(a)
  const bParts = parseVersionParts(b)

  if (aParts && bParts) {
    return compareVersionParts(aParts, bParts)
  }

  if (aParts) return -1
  if (bParts) return 1
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
}

/**
 * Cross-reference requirements to plans by matching plan frontmatter requirements field.
 */
function crossReferenceRequirements(state: GsdState): void {
  for (const req of state.requirements) {
    const existing = req.fulfilledByPlans ?? []
    req.fulfilledByPlans = [...new Set(existing.filter(Boolean))]
  }

  for (const phase of state.phases) {
    for (const plan of phase.plans) {
      if (plan.requirements.length === 0) continue
      for (const reqId of plan.requirements) {
        const req = state.requirements.find((r) => r.id === reqId)
        if (req) {
          const planRef = `${phase.number}/${plan.planNumber}`
          if (!req.fulfilledByPlans) req.fulfilledByPlans = []
          if (!req.fulfilledByPlans.includes(planRef)) {
            req.fulfilledByPlans.push(planRef)
          }
        }
      }
    }
  }
}

/**
 * Extract all decisions from plan summaries across all phases.
 */
function extractAllDecisions(phases: Phase[]): Decision[] {
  const decisions: Decision[] = []

  for (const phase of phases) {
    for (const plan of phase.plans) {
      if (!plan.summary?.decisions) continue
      for (const d of plan.summary.decisions) {
        decisions.push({
          decision: d.decision,
          rationale: d.rationale,
          phase: plan.phase,
          plan: `${plan.phase}/${plan.fileName}`,
          source: plan.summary.oneLiner || plan.fileName,
        })
      }
    }
  }

  return decisions
}

/**
 * Parse all research documents from the research/ directory and phase research files.
 */
async function parseResearchDocs(
  planningPath: string,
  phases: Phase[] = []
): Promise<ResearchDocument[]> {
  const docs: ResearchDocument[] = []

  // Standalone research in research/ directory
  const researchDir = join(planningPath, "research")
  if (await dirExists(researchDir)) {
    try {
      const files = await readdir(researchDir)
      for (const file of files) {
        if (!file.endsWith(".md")) continue
        const filePath = join(researchDir, file)
        const raw = await readFileSafe(filePath)
        if (!raw) continue
        const md = parseMarkdown(raw, file, filePath)
        const titleHeading = md.headings.find((h) => h.level === 1)
        docs.push({
          fileName: file,
          filePath,
          title: titleHeading?.text ?? file.replace(/\.md$/, ""),
          type: "standalone",
          body: md.body,
          headings: md.headings.map((h) => h.text),
        })
      }
    } catch {
      // research directory may not exist
    }
  }

  // Phase research docs parsed from phase directories
  for (const phase of phases) {
    const md = phase.research
    if (!md) continue
    const titleHeading = md.headings.find((h) => h.level === 1)
    docs.push({
      fileName: md.fileName,
      filePath: md.filePath,
      title:
        titleHeading?.text ??
        `Phase ${phase.number} Research`,
      type: "phase",
      phase: String(phase.number),
      body: md.body,
      headings: md.headings.map((h) => h.text),
    })
  }

  docs.sort((a, b) => a.filePath.localeCompare(b.filePath))

  return docs
}

/**
 * Parse all todo files from todos/pending/ and todos/done/.
 */
async function parseTodos(planningPath: string): Promise<Todo[]> {
  const todos: Todo[] = []

  for (const status of ["pending", "done"] as const) {
    const dir = join(planningPath, "todos", status)
    if (!(await dirExists(dir))) continue

    try {
      const files = await readdir(dir)
      for (const file of files) {
        if (!file.endsWith(".md")) continue
        const filePath = join(dir, file)
        const raw = await readFileSafe(filePath)
        if (!raw) continue
        const todo = parseTodo(raw, file, status === "done")
        todos.push(todo)
      }
    } catch {
      // directory may not exist
    }
  }

  // Sort by date descending
  todos.sort((a, b) => b.date.localeCompare(a.date))

  return todos
}

/**
 * Build a search index from all parsed content for quick full-text search.
 */
function buildSearchIndex(state: GsdState): SearchEntry[] {
  const entries: SearchEntry[] = []

  // Index plans
  for (const phase of state.phases) {
    for (const plan of phase.plans) {
      const content = [
        plan.objective ?? "",
        plan.context ?? "",
        plan.tasks ?? "",
        plan.mustHaves.truths.join(" "),
        plan.filesModified.join(" "),
        plan.requirements.join(" "),
      ].join(" ")

      entries.push({
        title: `Plan ${plan.planNumber}: ${plan.objective?.substring(0, 80) ?? plan.fileName}`,
        path: plan.filePath,
        type: "plan",
        phase: plan.phase,
        milestone: phase.milestone,
        content,
        preview: plan.objective?.substring(0, 200) ?? "",
      })
    }

    // Index summaries
    for (const plan of phase.plans) {
      if (!plan.summary) continue
      entries.push({
        title: `Summary: ${plan.summary.oneLiner || plan.fileName}`,
        path: plan.filePath.replace("-PLAN.md", "-SUMMARY.md"),
        type: "summary",
        phase: plan.phase,
        milestone: phase.milestone,
        content: plan.summary.body,
        preview: plan.summary.oneLiner,
      })
    }

    // Index verification
    if (phase.verification) {
      entries.push({
        title: `Verification: Phase ${phase.number}`,
        path: join(phase.dirPath, `${phase.dirName.split("-")[0]}-VERIFICATION.md`),
        type: "verification",
        phase: phase.dirName,
        milestone: phase.milestone,
        content: phase.verification.body,
        preview: `${phase.verification.status} - ${phase.verification.score}`,
      })
    }
  }

  // Index research
  for (const doc of state.research) {
    entries.push({
      title: doc.title,
      path: doc.filePath,
      type: "research",
      content: doc.body,
      preview: doc.body.substring(0, 200),
    })
  }

  // Index todos
  for (const todo of state.todos) {
    entries.push({
      title: todo.title,
      path: join(
        state.planningPath,
        "todos",
        todo.status,
        todo.fileName
      ),
      type: "todo",
      content: `${todo.problem} ${todo.solution} ${todo.body}`,
      preview: todo.problem.substring(0, 200),
    })
  }

  // Index milestones
  for (const milestone of state.milestones) {
    entries.push({
      title: `${milestone.version} ${milestone.name}`,
      path: join(state.planningPath, "ROADMAP.md"),
      type: "milestone",
      milestone: milestone.version,
      content: `${milestone.name} ${milestone.phaseRange} ${milestone.status}`,
      preview: `${milestone.version} ${milestone.name} - ${milestone.status}`,
    })
  }

  // Index requirements
  for (const req of state.requirements) {
    entries.push({
      title: `${req.id}: ${req.description.substring(0, 80)}`,
      path: join(state.planningPath, "REQUIREMENTS.md"),
      type: "requirement",
      milestone: req.milestone,
      content: `${req.id} ${req.description} ${req.section}`,
      preview: req.description.substring(0, 200),
    })
  }

  // Index project doc
  if (state.projectDoc) {
    entries.push({
      title: "PROJECT.md",
      path: state.projectDoc.filePath,
      type: "document",
      content: state.projectDoc.body,
      preview: state.projectDoc.body.substring(0, 200),
    })
  }

  return entries
}
