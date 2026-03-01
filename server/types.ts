export interface GsdState {
  projectPath: string
  planningPath: string
  config: ProjectConfig | null
  state: ProjectState | null
  projectDoc: MarkdownDocument | null
  milestones: Milestone[]
  currentMilestone: Milestone | null
  phases: Phase[]
  requirements: Requirement[]
  todos: Todo[]
  research: ResearchDocument[]
  decisions: Decision[]
  searchIndex: SearchEntry[]
}

export interface ProjectConfig {
  mode: string
  depth: string
  parallelization: boolean
  commit_docs: boolean
  model_profile: string
  workflow: { research: boolean; plan_check: boolean; verifier: boolean }
  git: { branching_strategy: string }
  created: string
}

export interface ProjectState {
  currentPhase: number
  totalPhases: number
  phaseName: string
  status: string
  lastActivity: string
  progressPercent: number
  milestoneName: string
  velocity: { totalPlans: number; avgDuration: number; totalDuration: number }
  phaseMetrics: Array<{
    phase: string
    plans: number
    totalMinutes: number
    avgPerPlan: number
  }>
  decisions: string[]
  blockers: string[]
  sessionContinuity: { lastSession: string; stoppedAt: string }
}

export interface Milestone {
  version: string
  name: string
  phaseRange: string
  status: "shipped" | "in_progress" | "planned"
  category: "shipped" | "go_live_gate" | "post_launch"
  completed?: string
  duration?: string
  planCount?: number
  delivered?: string[]
  keyDecisions?: Array<{ decision: string; rationale: string }>
  stats?: string
  phases: Phase[]
  archivedRequirements?: string
  archivedRoadmap?: string
}

export interface Requirement {
  id: string
  description: string
  status: "complete" | "in_progress" | "pending"
  section: string
  milestone: string
  fulfilledByPlans?: string[]
}

export interface Phase {
  number: number | string
  slug: string
  dirName: string
  dirPath: string
  goal: string
  milestone: string
  status: "planned" | "researched" | "executing" | "summarized" | "verified"
  plans: Plan[]
  research?: MarkdownDocument
  context?: MarkdownDocument
  uat?: MarkdownDocument
  verification?: PhaseVerification
  metrics?: { planCount: number; totalMinutes: number; avgPerPlan: number }
}

export interface Plan {
  phase: string
  planNumber: number
  fileName: string
  filePath: string
  type: string
  wave: number
  dependsOn: string[]
  filesModified: string[]
  autonomous: boolean
  requirements: string[]
  mustHaves: {
    truths: string[]
    artifacts: Array<{
      path: string
      provides: string
      contains?: string
      exports?: string[]
    }>
    keyLinks: Array<{
      from: string
      to: string
      via: string
      pattern: string
    }>
  }
  objective: string | null
  context: string | null
  tasks: string | null
  status: "planned" | "executing" | "complete" | "failed"
  summary?: PlanSummary
}

export interface PlanSummary {
  phase: string
  plan: number
  status: string
  started: string
  completed: string
  duration: string
  subsystem?: string
  tags?: string[]
  oneLiner: string
  filesCreated: string[]
  filesModified: string[]
  decisions: Array<{ decision: string; rationale: string }>
  body: string
}

export interface PhaseVerification {
  phase: string
  verified: string
  status: string
  score: string
  scoreNum: number
  scoreTotal: number
  reVerification: boolean
  humanVerification?: Array<{
    test: string
    expected: string
    whyHuman: string
  }>
  goalAchievement: string
  body: string
}

export interface Todo {
  date: string
  slug: string
  fileName: string
  title: string
  area: string
  files: string[]
  status: "pending" | "done"
  problem: string
  solution: string
  body: string
}

export interface ResearchDocument {
  fileName: string
  filePath: string
  title: string
  type: "phase" | "standalone"
  phase?: string
  body: string
  headings: string[]
}

export interface MarkdownDocument {
  filePath: string
  fileName: string
  frontmatter: Record<string, unknown>
  body: string
  headings: Array<{ level: number; text: string }>
}

export interface Decision {
  decision: string
  rationale: string
  phase: string
  plan: string
  source: string
}

export interface SearchEntry {
  title: string
  path: string
  type:
    | "plan"
    | "summary"
    | "verification"
    | "research"
    | "todo"
    | "milestone"
    | "requirement"
    | "document"
  phase?: string
  milestone?: string
  content: string
  preview: string
}

export interface FileEvent {
  type: "add" | "change" | "unlink"
  path: string
}
