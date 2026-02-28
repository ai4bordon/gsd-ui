import { describe, expect, test } from "bun:test"
import { parseRequirements } from "./requirements.ts"

describe("parseRequirements", () => {
  test("tracks milestone by section and applies traceability references", () => {
    const raw = `# Requirements: Product (v1.0)

## Core (v1.0)
### Pools
- [x] POOLS-01: Create pool

## v2 / Deferred
### Sharing
- [ ] SHARE-01: Invite by link

## Traceability
| Requirement | Phase | Status |
| --- | --- | --- |
| POOLS-01 | v1.0 / Phase 1 | Complete |
| SHARE-01 | v2 / Phase TBD | Pending |
`

    const requirements = parseRequirements(raw)

    const pools = requirements.find((r) => r.id === "POOLS-01")
    const share = requirements.find((r) => r.id === "SHARE-01")

    expect(pools?.milestone).toBe("v1.0")
    expect(pools?.status).toBe("complete")
    expect(pools?.fulfilledByPlans).toEqual(["v1.0 / Phase 1"])

    expect(share?.milestone).toBe("v2")
    expect(share?.status).toBe("pending")
    expect(share?.fulfilledByPlans).toEqual(["v2 / Phase TBD"])
  })
})
