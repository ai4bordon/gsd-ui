import { useState } from 'react'
import { useParams, Link, useLocation } from 'react-router'
import {
  ChevronRight,
  ChevronDown,
  Clock,
  FileText,
  Layers,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import { useLiveState } from '@/hooks/use-live-state'
import { Breadcrumb } from '@/components/breadcrumb'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/status-badge'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Markdown } from '@/components/markdown'
import { Skeleton } from '@/components/ui/skeleton'
import type { Plan, Phase, PhaseVerification } from '../../server/types'

function VerificationCard({ verification }: { verification: PhaseVerification }) {
  const [expanded, setExpanded] = useState(false)
  const passed = verification.scoreNum >= verification.scoreTotal
  const borderClass = passed ? 'border-emerald-800' : 'border-amber-800'

  return (
    <Card className={borderClass}>
      <CardHeader>
        <button
          className="flex w-full items-center justify-between text-left"
          onClick={() => setExpanded(!expanded)}
        >
          <CardTitle className="text-base flex items-center gap-2">
            {passed ? (
              <CheckCircle2 size={18} className="text-emerald-500" />
            ) : (
              <AlertTriangle size={18} className="text-amber-500" />
            )}
            Verification: {verification.score}
          </CardTitle>
          {expanded ? (
            <ChevronDown size={16} className="text-muted-foreground" />
          ) : (
            <ChevronRight size={16} className="text-muted-foreground" />
          )}
        </button>
      </CardHeader>
      {expanded && (
        <CardContent>
          {verification.goalAchievement && (
            <div className="mb-4">
              <Markdown content={verification.goalAchievement} />
            </div>
          )}
          {verification.humanVerification && verification.humanVerification.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold mb-2">Human Verification Required</h4>
              <div className="space-y-2">
                {verification.humanVerification.map((hv, i) => (
                  <div key={i} className="rounded bg-amber-900/20 border border-amber-800/40 p-3 text-sm">
                    <p className="font-medium">{hv.test}</p>
                    <p className="text-xs text-muted-foreground mt-1">Expected: {hv.expected}</p>
                    <p className="text-xs text-muted-foreground">Why: {hv.whyHuman}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {verification.body && (
            <div className="max-h-[600px] overflow-y-auto">
              <Markdown content={verification.body} />
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}

function PlanCard({ plan, phase }: { plan: Plan; phase: Phase }) {
  const phaseHint = phase.dirName || phase.slug
  const planLink = `/plan/${phase.number}/${plan.planNumber}${
    phaseHint ? `?phase=${encodeURIComponent(phaseHint)}` : ''
  }`

  return (
    <Link to={planLink}>
      <Card className="group cursor-pointer transition-colors hover:border-zinc-600">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-muted-foreground bg-zinc-800 px-1.5 py-0.5 rounded">
                #{plan.planNumber}
              </span>
              <StatusBadge status={plan.status} />
              {plan.wave > 0 && (
                <Badge variant="outline" className="text-xs">
                  Wave {plan.wave}
                </Badge>
              )}
            </div>
            <ChevronRight
              size={16}
              className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
            />
          </div>

          {plan.type && (
            <Badge variant="secondary" className="mb-2 text-xs capitalize">
              {plan.type}
            </Badge>
          )}

          {plan.objective && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
              {plan.objective.substring(0, 150)}
              {plan.objective.length > 150 ? '...' : ''}
            </p>
          )}

          <div className="flex flex-wrap gap-2 mt-2">
            {plan.requirements.slice(0, 3).map((req, i) => (
              <span
                key={i}
                className="inline-block rounded bg-blue-900/30 px-1.5 py-0.5 text-xs text-blue-400"
              >
                {req}
              </span>
            ))}
            {plan.requirements.length > 3 && (
              <span className="text-xs text-muted-foreground">
                +{plan.requirements.length - 3}
              </span>
            )}
          </div>

          {plan.filesModified.length > 0 && (
            <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
              <FileText size={12} />
              {plan.filesModified.length} files
            </div>
          )}

          {plan.summary && (
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <Clock size={12} />
              {plan.summary.duration}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}

export function PhaseView() {
  const { number } = useParams<{ number: string }>()
  const location = useLocation()
  const { state, loading } = useLiveState()

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!state) return null

  const phaseHint = new URLSearchParams(location.search).get('phase')?.toLowerCase().trim()
  const phaseCandidates = state.phases?.filter((p) => String(p.number) === number) ?? []
  const phase =
    (phaseHint
      ? phaseCandidates.find((p) =>
          [p.dirName, p.slug]
            .map((v) => (v ?? '').toLowerCase())
            .includes(phaseHint)
        )
      : undefined) ??
    phaseCandidates[0]

  if (!phase) {
    return (
      <div className="py-20 text-center">
        <h2 className="text-lg font-semibold">Phase not found</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Phase {number} does not exist.
        </p>
        <Link to="/roadmap" className="mt-4 inline-block text-sm text-blue-400 hover:text-blue-300">
          Back to Roadmap
        </Link>
      </div>
    )
  }

  const planCount = phase.plans?.length ?? 0
  const completedPlans = phase.plans?.filter(
    (p) => p.status === 'complete' || (p.status as string) === 'summarized'
  ).length ?? 0
  const progress = planCount > 0 ? Math.round((completedPlans / planCount) * 100) : 0

  // Group plans by wave
  const waves = new Map<number, Plan[]>()
  phase.plans?.forEach((plan) => {
    const wave = plan.wave ?? 0
    const existing = waves.get(wave) ?? []
    existing.push(plan)
    waves.set(wave, existing)
  })
  const sortedWaves = [...waves.entries()].sort(([a], [b]) => a - b)

  const milestoneVersion = phase.milestone
  const milestone = state.milestones?.find((m) => m.version === milestoneVersion)

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: 'Roadmap', href: '/roadmap' },
          ...(milestone
            ? [{ label: milestone.version, href: `/milestone/${encodeURIComponent(milestone.version)}` }]
            : []),
          { label: `Phase ${phase.number}` },
        ]}
      />

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold">Phase {phase.number}</h1>
          <StatusBadge status={phase.status} />
        </div>
        <p className="text-base text-muted-foreground">{phase.goal}</p>
        <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Layers size={14} />
            {planCount} plans
          </span>
          {phase.metrics && (
            <span className="flex items-center gap-1">
              <Clock size={14} />
              {phase.metrics.totalMinutes}m total ({phase.metrics.avgPerPlan}m avg)
            </span>
          )}
        </div>
        {planCount > 0 && (
          <div className="flex items-center gap-3 mt-3">
            <Progress value={progress} className="w-48" />
            <span className="text-sm font-mono text-muted-foreground">
              {completedPlans}/{planCount} complete
            </span>
          </div>
        )}
      </div>

      {/* Verification */}
      {phase.verification && (
        <VerificationCard verification={phase.verification} />
      )}

      {/* Plans by Wave */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Plans</h2>
        {sortedWaves.length > 0 ? (
          <div className="space-y-6">
            {sortedWaves.map(([wave, plans]) => (
              <div key={wave}>
                {sortedWaves.length > 1 && (
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                    {wave === 0 ? 'No Wave' : `Wave ${wave}`}
                  </h3>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  {plans.map((plan) => (
                    <PlanCard key={plan.planNumber} plan={plan} phase={phase} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No plans in this phase.</p>
        )}
      </div>

      {/* Supporting Documents */}
      {(phase.research || phase.context || phase.uat) && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Supporting Documents</h2>
          <Tabs defaultValue={phase.research ? 'research' : phase.context ? 'context' : 'uat'}>
            <TabsList>
              {phase.research && <TabsTrigger value="research">Research</TabsTrigger>}
              {phase.context && <TabsTrigger value="context">Context</TabsTrigger>}
              {phase.uat && <TabsTrigger value="uat">UAT</TabsTrigger>}
            </TabsList>
            {phase.research && (
              <TabsContent value="research">
                <Card>
                  <CardContent className="p-6">
                    <Markdown content={phase.research.body} />
                  </CardContent>
                </Card>
              </TabsContent>
            )}
            {phase.context && (
              <TabsContent value="context">
                <Card>
                  <CardContent className="p-6">
                    <Markdown content={phase.context.body} />
                  </CardContent>
                </Card>
              </TabsContent>
            )}
            {phase.uat && (
              <TabsContent value="uat">
                <Card>
                  <CardContent className="p-6">
                    <Markdown content={phase.uat.body} />
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        </div>
      )}
    </div>
  )
}
