import { describe, expect, test } from "bun:test"
import { parseRoadmap } from "./roadmap.ts"

describe("parseRoadmap", () => {
  test("parses English fallback roadmap format", () => {
    const raw = `# ROADMAP: Platform (v2.1)

## Phase 01 - Foundation
**Goal:** Ship auth baseline.
- [x] 01-01-PLAN.md - setup auth

## Phase 02 - API
**Goal:** Ship API contracts.
- [ ] 02-01-PLAN.md - add endpoints
`

    const milestones = parseRoadmap(raw)

    expect(milestones).toHaveLength(1)
    expect(milestones[0]?.version).toBe("v2.1")
    expect(milestones[0]?.name).toBe("Platform")
    expect(milestones[0]?.phaseRange).toBe("1-2")
    expect(milestones[0]?.phases).toHaveLength(2)
    expect(milestones[0]?.phases[0]?.goal).toBe("Ship auth baseline.")
  })

  test("parses Russian fallback roadmap format", () => {
    const raw = `# Дорожная карта: v1.1

## Фаза 01: Расширенное деление трат
**Цель:** Добавить shares/percent.
- [ ] 01-01-PLAN.md - backend

## Фаза 02: Детализация итогов
**Цель:** Сделать объяснимые итоги.
- [ ] 02-01-PLAN.md - UI
`

    const milestones = parseRoadmap(raw)

    expect(milestones).toHaveLength(1)
    expect(milestones[0]?.version).toBe("v1.1")
    expect(milestones[0]?.phaseRange).toBe("1-2")
    expect(milestones[0]?.phases[0]?.goal).toBe("Добавить shares/percent.")
    expect(milestones[0]?.phases[1]?.goal).toBe("Сделать объяснимые итоги.")
  })
})
