import { useParams, Link } from 'react-router'
import {
  Layers,
  Clock,
  ChevronRight,
  FileText,
  CheckCircle2,
} from 'lucide-react'
import { useLiveState } from '@/hooks/use-live-state'
import { Breadcrumb } from '@/components/breadcrumb'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/status-badge'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import type { Phase, Milestone } from '../../server/types'

function PhaseCard({ phase, canNavigate }: { phase: Phase; canNavigate: boolean }) {
  const planCount = phase.plans?.length ?? 0
  const completedPlans = phase.plans?.filter(
    (p) => p.status === 'complete' || (p.status as string) === 'summarized'
  ).length ?? 0
  const progress = planCount > 0 ? Math.round((completedPlans / planCount) * 100) : 0

  const content = (
    <Card className="group cursor-pointer transition-colors hover:border-zinc-600">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground bg-zinc-800 px-1.5 py-0.5 rounded">
              P{phase.number}
            </span>
            <StatusBadge status={phase.status} />
          </div>
          {canNavigate && (
            <ChevronRight
              size={16}
              className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
            />
          )}
        </div>
        <h3 className="text-sm font-semibold mb-1 truncate">
          {phase.goal || phase.slug || `Phase ${phase.number}`}
        </h3>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
          <span className="flex items-center gap-1">
            <Layers size={12} />
            {planCount} plans
          </span>
          {phase.metrics && (
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {phase.metrics.totalMinutes}m total
            </span>
          )}
        </div>
        {planCount > 0 && (
          <div className="mt-3 flex items-center gap-2">
            <Progress value={progress} className="flex-1 h-1.5" />
            <span className="text-xs font-mono text-muted-foreground">
              {completedPlans}/{planCount}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )

  if (!canNavigate) {
    return content
  }

  return (
    <Link to={`/phase/${phase.number}`}>
      {content}
    </Link>
  )
}

export function MilestoneView() {
  const { version } = useParams<{ version: string }>()
  const { state, loading } = useLiveState()

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    )
  }

  if (!state) return null

  const milestone = state.milestones?.find(
    (m) => m.version === version || m.version === decodeURIComponent(version ?? '')
  )
  const realPhaseKeys = new Set((state.phases ?? []).map((p) => String(p.number)))

  if (!milestone) {
    return (
      <div className="py-20 text-center">
        <h2 className="text-lg font-semibold">Milestone not found</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Version "{version}" does not match any milestone.
        </p>
        <Link to="/" className="mt-4 inline-block text-sm text-blue-400 hover:text-blue-300">
          Back to Roadmap
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: 'Roadmap', href: '/' },
          { label: milestone.version },
        ]}
      />

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold">{milestone.name}</h1>
          <StatusBadge status={milestone.status} />
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="font-mono">{milestone.version}</span>
          {milestone.phaseRange && (
            <span>Phases: {milestone.phaseRange}</span>
          )}
          {milestone.completed && (
            <span className="flex items-center gap-1">
              <CheckCircle2 size={14} />
              Completed: {milestone.completed}
            </span>
          )}
          {milestone.duration && (
            <span className="flex items-center gap-1">
              <Clock size={14} />
              {milestone.duration}
            </span>
          )}
        </div>
      </div>

      {/* Delivered items */}
      {milestone.delivered && milestone.delivered.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Delivered</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {milestone.delivered.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <CheckCircle2
                    size={16}
                    className="mt-0.5 shrink-0 text-emerald-500"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Key Decisions */}
      {milestone.keyDecisions && milestone.keyDecisions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Key Decisions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4 text-xs font-semibold text-muted-foreground uppercase">
                      Decision
                    </th>
                    <th className="text-left py-2 text-xs font-semibold text-muted-foreground uppercase">
                      Rationale
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {milestone.keyDecisions.map((d, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-2.5 pr-4 font-medium">{d.decision}</td>
                      <td className="py-2.5 text-muted-foreground">
                        {d.rationale}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      {milestone.stats && (
        <Card>
          <CardContent className="p-4">
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">
              {milestone.stats}
            </pre>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Phases */}
      <div>
        <h2 className="text-lg font-semibold mb-4">
          Phases ({milestone.phases?.length ?? 0})
        </h2>
        {milestone.phases && milestone.phases.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {milestone.phases.map((phase) => (
              <PhaseCard
                key={String(phase.number)}
                phase={phase}
                canNavigate={realPhaseKeys.has(String(phase.number))}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No phases associated with this milestone.
          </p>
        )}
      </div>
    </div>
  )
}
