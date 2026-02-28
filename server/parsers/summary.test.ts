import { describe, expect, test } from "bun:test"
import { parseSummary } from "./summary.ts"

describe("parseSummary", () => {
  test("parses decisions from bullet lists and duration from frontmatter", () => {
    const raw = `---
phase: 01-core
plan: 01
duration: 3m 40s
completed: 2026-02-28
---

# Phase 01 Plan 01 Summary

## Decisions Made
- Keep API stateless
- Use retries - improves resilience
- Add circuit breaker
`

    const parsed = parseSummary(raw, "01-01-SUMMARY.md")

    expect(parsed.duration).toBe("3m 40s")
    expect(parsed.completed).toBe("2026-02-28")
    expect(parsed.decisions).toEqual([
      { decision: "Keep API stateless", rationale: "" },
      { decision: "Use retries", rationale: "improves resilience" },
      { decision: "Add circuit breaker", rationale: "" },
    ])
  })

  test("parses Russian bold duration fallback when frontmatter is missing", () => {
    const raw = `# Отчет

## Performance
- **Длительность:** 7m 10s

## Решения
- Упростить валидацию входа
`

    const parsed = parseSummary(raw, "01-02-SUMMARY.md")

    expect(parsed.duration).toBe("7m 10s")
    expect(parsed.decisions).toEqual([
      { decision: "Упростить валидацию входа", rationale: "" },
    ])
  })
})
