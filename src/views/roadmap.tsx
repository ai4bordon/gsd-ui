import { Link } from 'react-router'
import {
  Activity,
  Clock,
  Layers,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  ChevronRight,
} from 'lucide-react'
import { useLiveState } from '@/hooks/use-live-state'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { StatusBadge } from '@/components/status-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { Milestone } from '../../server/types'

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string | number
  icon: typeof Activity
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="rounded-lg bg-accent p-2.5">
          <Icon size={18} className="text-muted-foreground" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function MilestoneCard({ milestone }: { milestone: Milestone }) {
  const phaseCount = milestone.phases?.length ?? 0

  return (
    <Link to={`/milestone/${encodeURIComponent(milestone.version)}`}>
      <Card className="group cursor-pointer transition-colors hover:border-zinc-600">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-muted-foreground">
                  {milestone.version}
                </span>
                <StatusBadge status={milestone.status} />
              </div>
              <h3 className="font-semibold text-sm truncate">{milestone.name}</h3>
              <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Layers size={12} />
                  {phaseCount} phases
                </span>
                {milestone.planCount != null && (
                  <span className="flex items-center gap-1">
                    <Activity size={12} />
                    {milestone.planCount} plans
                  </span>
                )}
                {milestone.duration && (
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {milestone.duration}
                  </span>
                )}
              </div>
              {milestone.delivered && milestone.delivered.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {milestone.delivered.slice(0, 3).map((item, i) => (
                    <span
                      key={i}
                      className="inline-block rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-muted-foreground"
                    >
                      {item}
                    </span>
                  ))}
                  {milestone.delivered.length > 3 && (
                    <span className="text-xs text-muted-foreground">
                      +{milestone.delivered.length - 3} more
                    </span>
                  )}
                </div>
              )}
            </div>
            <ChevronRight
              size={16}
              className="mt-1 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
            />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

function CategorySection({
  title,
  milestones,
}: {
  title: string
  milestones: Milestone[]
}) {
  if (milestones.length === 0) return null

  return (
    <div>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        {title}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {milestones.map((m) => (
          <MilestoneCard key={m.version} milestone={m} />
        ))}
      </div>
    </div>
  )
}

export function RoadmapView() {
  const { state, loading, error } = useLiveState()

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle size={48} className="mb-4 text-destructive" />
        <h2 className="text-lg font-semibold mb-2">Failed to load project data</h2>
        <p className="text-sm text-muted-foreground">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 rounded-md bg-accent px-4 py-2 text-sm hover:bg-accent/80"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!state) return null

  const projectState = state.state
  const milestones = state.milestones ?? []

  const shipped = milestones.filter((m) => m.category === 'shipped')
  const goLive = milestones.filter((m) => m.category === 'go_live_gate')
  const postLaunch = milestones.filter((m) => m.category === 'post_launch')

  const totalPlans = state.phases?.reduce((sum, p) => sum + (p.plans?.length ?? 0), 0) ?? 0
  const pendingTodos = state.todos?.filter((t) => t.status === 'pending').length ?? 0
  const pendingRequirements = state.requirements?.filter((r) => r.status === 'pending').length ?? 0
  const avgDuration = projectState?.velocity?.avgDuration
    ? `${Math.round(projectState.velocity.avgDuration)}m`
    : '--'

  const activeMilestone =
    milestones.find((m) => m.status === 'in_progress' && m.category === 'go_live_gate') ??
    milestones.find((m) => m.status === 'in_progress') ??
    milestones.find((m) => m.category === 'go_live_gate') ??
    milestones[0]

  const computedDonePhases =
    activeMilestone?.phases?.filter((p) => p.status === 'summarized' || p.status === 'verified').length ?? 0
  const computedTotalPhases = activeMilestone?.phases?.length ?? 0
  const computedProgressPercent =
    computedTotalPhases > 0
      ? Math.round((computedDonePhases / computedTotalPhases) * 100)
      : undefined

  const bannerDone = computedTotalPhases > 0 ? computedDonePhases : projectState?.currentPhase ?? 0
  const bannerTotal = computedTotalPhases > 0 ? computedTotalPhases : projectState?.totalPhases ?? 0
  const bannerPercent = computedProgressPercent ?? projectState?.progressPercent ?? 0
  const bannerTitle =
    activeMilestone?.name || activeMilestone?.version || projectState?.milestoneName || 'Project Roadmap'

  return (
    <div className="space-y-8">
      {/* Current Status Banner */}
      {projectState && (
        <Card className="border-zinc-700 bg-gradient-to-r from-card to-zinc-800/50">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold mb-1">
                  {bannerTitle}
                </h1>
                <p className="text-sm text-muted-foreground mb-4">
                  Phase {bannerDone} of {bannerTotal}
                  {projectState.phaseName && ` -- ${projectState.phaseName}`}
                </p>
                <div className="flex items-center gap-4">
                  <Progress
                    value={bannerPercent}
                    className="w-48"
                    indicatorClassName={cn(
                      bannerPercent >= 100
                        ? 'bg-emerald-500'
                        : bannerPercent >= 50
                          ? 'bg-blue-500'
                          : 'bg-amber-500'
                    )}
                  />
                  <span className="text-sm font-mono text-muted-foreground">
                    {bannerPercent}%
                  </span>
                </div>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <div className="flex items-center gap-1 justify-end">
                  <Clock size={12} />
                  Last activity
                </div>
                <div className="mt-1">{projectState.lastActivity || 'N/A'}</div>
                {projectState.status && (
                  <div className="mt-2">
                    <StatusBadge status={projectState.status} />
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Plans" value={totalPlans} icon={Layers} />
        <StatCard label="Avg Duration" value={avgDuration} icon={TrendingUp} />
        <StatCard label="Pending Todos" value={pendingTodos} icon={CheckCircle2} />
        <StatCard label="Pending Requirements" value={pendingRequirements} icon={AlertCircle} />
      </div>

      {/* Milestone Timeline */}
      <div className="space-y-6">
        <CategorySection title="Shipped" milestones={shipped} />
        <CategorySection title="Go-Live Gate" milestones={goLive} />
        <CategorySection title="Post-Launch" milestones={postLaunch} />
        {/* If no categories matched, show all */}
        {shipped.length === 0 && goLive.length === 0 && postLaunch.length === 0 && milestones.length > 0 && (
          <CategorySection title="All Milestones" milestones={milestones} />
        )}
      </div>

      {/* Empty state */}
      {milestones.length === 0 && !projectState && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Layers size={48} className="mb-4 text-muted-foreground" />
          <h2 className="text-lg font-semibold mb-2">No milestones yet</h2>
          <p className="text-sm text-muted-foreground">
            Waiting for project data from the server...
          </p>
        </div>
      )}
    </div>
  )
}
