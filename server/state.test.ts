import { describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { buildInitialState } from "./state.ts"

async function write(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, content, "utf8")
}

describe("buildInitialState", () => {
  test("derives velocity metrics and syncs requirements milestones", async () => {
    const root = await mkdtemp(join(tmpdir(), "gsd-ui-test-"))
    const planningPath = join(root, ".planning")

    try {
      await mkdir(planningPath, { recursive: true })

      await write(
        join(planningPath, "STATE.md"),
        `# Planning State
Phase: 1 of 2 (01-core)
Status: In progress
Progress: v1.0 [##########..........] 50%
`
      )

      await write(
        join(planningPath, "ROADMAP.md"),
        `# ROADMAP: Product (v1.0)

## Phase 01 - Core
**Goal:** Build core capabilities.
- [x] 01-01-PLAN.md - core implementation
`
      )

      await write(
        join(planningPath, "REQUIREMENTS.md"),
        `# Requirements: Product (v1.0)

## Core (v1.0)
- [x] CORE-01: Done requirement

## v2 / Deferred
### Sharing
- [ ] SHARE-01: Invite by link
`
      )

      await write(
        join(planningPath, "phases", "01-core", "01-01-PLAN.md"),
        `---
phase: 01-core
plan: 1
requirements: [CORE-01]
---
<objective>Core objective</objective>
`
      )

      await write(
        join(planningPath, "phases", "01-core", "01-01-SUMMARY.md"),
        `---
phase: 01-core
plan: 1
duration: 2m 30s
completed: 2026-02-28
---

## Decisions Made
- Keep API stateless
`
      )

      await write(
        join(planningPath, "phases", "01-core", "01-RESEARCH.md"),
        `# Phase 01 Research

## Findings
- Research note
`
      )

      await write(
        join(planningPath, "phases", "02-growth", "02-01-PLAN.md"),
        `---
phase: 02-growth
plan: 1
requirements: [SHARE-01]
---
<objective>Growth objective</objective>
`
      )

      await write(
        join(planningPath, "phases", "02-growth", "02-01-SUMMARY.md"),
        `---
phase: 02-growth
plan: 1
duration: "00:06:00"
completed: 2026-02-28
---

## Decisions Made
- Add retry policy
`
      )

      const state = await buildInitialState(planningPath)

      expect(state.state?.velocity.totalPlans).toBe(2)
      expect(state.state?.velocity.totalDuration).toBe(9)
      expect(state.state?.velocity.avgDuration).toBe(4)
      expect(state.state?.phaseMetrics.length).toBeGreaterThanOrEqual(2)

      const versions = state.milestones.map((m) => m.version)
      expect(versions).toContain("v1.0")
      expect(versions).toContain("v2")

      const v2 = state.milestones.find((m) => m.version === "v2")
      expect(v2?.phases.length).toBe(1)
      expect(v2?.phases[0]?.goal).toContain("Sharing")

      const shareReq = state.requirements.find((r) => r.id === "SHARE-01")
      expect(shareReq?.fulfilledByPlans).toContain("2/1")

      const phaseResearch = state.research.filter((doc) => doc.type === "phase")
      expect(phaseResearch).toHaveLength(1)
      expect(phaseResearch[0]?.phase).toBe("1")
      expect(phaseResearch[0]?.title).toBe("Phase 01 Research")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
