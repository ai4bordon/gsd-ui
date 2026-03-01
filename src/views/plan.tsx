import { useParams, Link, useLocation } from 'react-router'
import {
  FileText,
  Clock,
  GitBranch,
  CheckCircle2,
  Circle,
  Tag,
  AlertCircle,
} from 'lucide-react'
import { useLiveState } from '@/hooks/use-live-state'
import { Breadcrumb } from '@/components/breadcrumb'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/status-badge'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Markdown } from '@/components/markdown'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import type { Plan } from '../../server/types'

function TaskList({ tasks }: { tasks: string }) {
  // tasks is raw markdown; render it
  return <Markdown content={tasks} />
}

function MetadataItem({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof FileText
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
          {label}
        </p>
        <div className="text-sm">{children}</div>
      </div>
    </div>
  )
}

export function PlanView() {
  const { phase: phaseParam, plan: planParam } = useParams<{
    phase: string
    plan: string
  }>()
  const location = useLocation()
  const { state, loading } = useLiveState()

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    )
  }

  if (!state) return null

  const phaseHint = new URLSearchParams(location.search).get('phase')?.toLowerCase().trim()
  const phaseCandidates = state.phases?.filter(
    (p) => String(p.number) === phaseParam
  ) ?? []
  const phase =
    (phaseHint
      ? phaseCandidates.find((p) =>
          [p.dirName, p.slug]
            .map((v) => (v ?? '').toLowerCase())
            .includes(phaseHint)
        )
      : undefined) ??
    phaseCandidates[0]

  const plan = phase?.plans?.find(
    (p) => String(p.planNumber) === planParam
  )

  if (!phase || !plan) {
    return (
      <div className="py-20 text-center">
        <h2 className="text-lg font-semibold">Plan not found</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Plan {phaseParam}/{planParam} does not exist.
        </p>
        <Link to="/roadmap" className="mt-4 inline-block text-sm text-blue-400 hover:text-blue-300">
          Back to Roadmap
        </Link>
      </div>
    )
  }

  const milestone = state.milestones?.find((m) => m.version === phase.milestone)
  const phaseRef = phase.dirName || phase.slug
  const phaseHref = `/phase/${phase.number}${
    phaseRef ? `?phase=${encodeURIComponent(phaseRef)}` : ''
  }`

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: 'Roadmap', href: '/roadmap' },
          ...(milestone
            ? [{ label: milestone.version, href: `/milestone/${encodeURIComponent(milestone.version)}` }]
            : []),
          { label: `Phase ${phase.number}`, href: phaseHref },
          { label: `Plan ${plan.planNumber}` },
        ]}
      />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold">
              Plan {plan.planNumber}
            </h1>
            <StatusBadge status={plan.status} />
          </div>
          {plan.summary?.oneLiner && (
            <p className="text-base text-muted-foreground">
              {plan.summary.oneLiner}
            </p>
          )}
        </div>
      </div>

      {/* Split layout */}
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Left: Metadata */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <MetadataItem icon={Tag} label="Type">
                <Badge variant="secondary" className="capitalize">
                  {plan.type || 'general'}
                </Badge>
              </MetadataItem>

              {plan.wave > 0 && (
                <MetadataItem icon={GitBranch} label="Wave">
                  Wave {plan.wave}
                </MetadataItem>
              )}

              {plan.summary?.duration && (
                <MetadataItem icon={Clock} label="Duration">
                  {plan.summary.duration}
                </MetadataItem>
              )}

              {plan.summary?.started && (
                <MetadataItem icon={Clock} label="Started">
                  {plan.summary.started}
                </MetadataItem>
              )}

              {plan.summary?.completed && (
                <MetadataItem icon={CheckCircle2} label="Completed">
                  {plan.summary.completed}
                </MetadataItem>
              )}

              {plan.autonomous && (
                <MetadataItem icon={Circle} label="Autonomous">
                  <Badge variant="outline" className="text-xs">
                    Autonomous
                  </Badge>
                </MetadataItem>
              )}
            </CardContent>
          </Card>

          {/* Requirements */}
          {plan.requirements.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Requirements</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {plan.requirements.map((req, i) => (
                    <Badge key={i} variant="outline" className="text-xs bg-blue-900/20 text-blue-400 border-blue-800/50">
                      {req}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Dependencies */}
          {plan.dependsOn.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Dependencies</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {plan.dependsOn.map((dep, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-2 text-xs text-muted-foreground"
                    >
                      <GitBranch size={12} />
                      {dep}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Files */}
          {plan.filesModified.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Files Modified</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {plan.filesModified.map((file, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-xs font-mono text-muted-foreground"
                    >
                      <FileText size={12} className="mt-0.5 shrink-0" />
                      <span className="break-all">{file}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Must-Haves */}
          {plan.mustHaves && (plan.mustHaves.truths.length > 0 || plan.mustHaves.artifacts.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Must-Haves</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {plan.mustHaves.truths.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1.5">
                      Truths
                    </p>
                    <ul className="space-y-1">
                      {plan.mustHaves.truths.map((truth, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs">
                          <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-emerald-500" />
                          {truth}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {plan.mustHaves.artifacts.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1.5">
                      Artifacts
                    </p>
                    <ul className="space-y-1.5">
                      {plan.mustHaves.artifacts.map((artifact, i) => (
                        <li key={i} className="text-xs">
                          <span className="font-mono text-emerald-400">
                            {artifact.path}
                          </span>
                          <span className="text-muted-foreground ml-1">
                            - {artifact.provides}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Tabbed Content */}
        <div className="min-w-0">
          <Tabs defaultValue={plan.objective ? 'objective' : plan.tasks ? 'tasks' : 'summary'}>
            <TabsList>
              {plan.objective && <TabsTrigger value="objective">Objective</TabsTrigger>}
              {plan.tasks && <TabsTrigger value="tasks">Tasks</TabsTrigger>}
              {plan.context && <TabsTrigger value="context">Context</TabsTrigger>}
              {plan.summary && <TabsTrigger value="summary">Summary</TabsTrigger>}
            </TabsList>

            {plan.objective && (
              <TabsContent value="objective">
                <Card>
                  <CardContent className="p-6">
                    <Markdown content={plan.objective} />
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {plan.tasks && (
              <TabsContent value="tasks">
                <Card>
                  <CardContent className="p-6">
                    <TaskList tasks={plan.tasks} />
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {plan.context && (
              <TabsContent value="context">
                <Card>
                  <CardContent className="p-6">
                    <Markdown content={plan.context} />
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {plan.summary && (
              <TabsContent value="summary">
                <Card>
                  <CardContent className="p-6">
                    {plan.summary.decisions?.length > 0 && (
                      <div className="mb-6">
                        <h3 className="text-sm font-semibold mb-3">Decisions</h3>
                        <div className="space-y-2">
                          {plan.summary.decisions.map((d, i) => (
                            <div
                              key={i}
                              className="rounded-md bg-zinc-800/50 p-3 text-sm"
                            >
                              <p className="font-medium">{d.decision}</p>
                              <p className="text-muted-foreground mt-1 text-xs">
                                {d.rationale}
                              </p>
                            </div>
                          ))}
                        </div>
                        <Separator className="my-4" />
                      </div>
                    )}

                    {plan.summary.tags && plan.summary.tags.length > 0 && (
                      <div className="mb-4 flex flex-wrap gap-1.5">
                        {plan.summary.tags.map((tag, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <Markdown content={plan.summary.body} />

                    {plan.summary.filesCreated.length > 0 && (
                      <div className="mt-6">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                          Files Created
                        </h4>
                        <ul className="space-y-1">
                          {plan.summary.filesCreated.map((file, i) => (
                            <li key={i} className="text-xs font-mono text-emerald-400">
                              + {file}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {plan.summary.filesModified.length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                          Files Modified
                        </h4>
                        <ul className="space-y-1">
                          {plan.summary.filesModified.map((file, i) => (
                            <li key={i} className="text-xs font-mono text-amber-400">
                              ~ {file}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>

          {/* If nothing to show */}
          {!plan.objective && !plan.tasks && !plan.context && !plan.summary && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <AlertCircle size={32} className="mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No content available for this plan yet.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
