import { useState, useMemo } from 'react'
import { Link } from 'react-router'
import { ClipboardList, Search, Filter } from 'lucide-react'
import { useLiveState } from '@/hooks/use-live-state'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/status-badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { Requirement } from '../../server/types'

function parsePlanRef(ref: string): { phase: string; plan: string } | null {
  const direct = ref.match(/^([^/]+)\/(\d+)$/)
  if (direct) {
    return {
      phase: direct[1] ?? '',
      plan: direct[2] ?? '',
    }
  }

  const legacyFileRef = ref.match(/^([^/]+)\/(\d+)-(\d+)-PLAN\.md$/i)
  if (legacyFileRef) {
    return {
      phase: legacyFileRef[2] ?? '',
      plan: legacyFileRef[3] ?? '',
    }
  }

  return null
}

export function RequirementsView() {
  const { state, loading } = useLiveState()
  const [filter, setFilter] = useState('')
  const [milestoneFilter, setMilestoneFilter] = useState<string>('all')

  const requirements = state?.requirements ?? []

  const uniqueMilestones = useMemo(() => {
    const milestones = new Set<string>()
    requirements.forEach((r) => {
      if (r.milestone) milestones.add(r.milestone)
    })
    return [...milestones].sort()
  }, [requirements])

  const filtered = useMemo(() => {
    return requirements.filter((r) => {
      const matchesText =
        !filter ||
        r.id.toLowerCase().includes(filter.toLowerCase()) ||
        r.description.toLowerCase().includes(filter.toLowerCase())
      const matchesMilestone = milestoneFilter === 'all' || r.milestone === milestoneFilter
      return matchesText && matchesMilestone
    })
  }, [requirements, filter, milestoneFilter])

  // Group by section
  const sections = useMemo(() => {
    const grouped = new Map<string, Requirement[]>()
    for (const req of filtered) {
      const section = req.section || 'Uncategorized'
      const existing = grouped.get(section) ?? []
      existing.push(req)
      grouped.set(section, existing)
    }
    return [...grouped.entries()]
  }, [filtered])

  const completedCount = requirements.filter((r) => r.status === 'complete').length

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Requirements</h1>
        <span className="text-sm text-muted-foreground">
          {completedCount} of {requirements.length} complete
        </span>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filter requirements..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-muted-foreground" />
          <select
            value={milestoneFilter}
            onChange={(e) => setMilestoneFilter(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="all">All Milestones</option>
            {uniqueMilestones.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Requirements grouped by section */}
      {sections.length > 0 ? (
        <div className="space-y-6">
          {sections.map(([section, reqs]) => (
            <div key={section}>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {section} ({reqs.length})
              </h2>
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase w-24">ID</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Description</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase w-28">Status</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase w-24">Milestone</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">Fulfilled By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reqs.map((req) => (
                          <tr key={req.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                            <td className="py-3 px-4 font-mono text-xs">{req.id}</td>
                            <td className="py-3 px-4">{req.description}</td>
                            <td className="py-3 px-4">
                              <StatusBadge status={req.status} />
                            </td>
                            <td className="py-3 px-4 text-xs text-muted-foreground">{req.milestone}</td>
                            <td className="py-3 px-4">
                              {req.fulfilledByPlans && req.fulfilledByPlans.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {req.fulfilledByPlans.map((planRef) => {
                                    const route = parsePlanRef(planRef)
                                    if (route) {
                                      return (
                                        <Link key={planRef} to={`/plan/${route.phase}/${route.plan}`}>
                                          <Badge variant="outline" className="text-xs hover:bg-accent cursor-pointer">
                                            {planRef}
                                          </Badge>
                                        </Link>
                                      )
                                    }

                                    return (
                                      <Badge key={planRef} variant="outline" className="text-xs">
                                        {planRef}
                                      </Badge>
                                    )
                                  })}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">--</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <ClipboardList size={48} className="mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-lg font-semibold">No requirements found</h2>
          <p className="text-sm text-muted-foreground mt-2">
            {filter || milestoneFilter !== 'all'
              ? 'Try adjusting your filters.'
              : 'No requirements have been defined yet.'}
          </p>
        </div>
      )}
    </div>
  )
}
