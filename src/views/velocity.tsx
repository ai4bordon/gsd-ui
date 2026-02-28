import { useMemo } from 'react'
import { Activity, Clock, TrendingUp, BarChart3 } from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { useLiveState } from '@/hooks/use-live-state'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { GsdState } from '../../server/types'

interface PhaseMetric {
  phase: string
  plans: number
  totalMinutes: number
  avgPerPlan: number
}

function parseDurationMinutes(value: string | undefined): number | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  if (!normalized || normalized === 'pending') return null

  const hmsMatch = normalized.match(/^(\d+):(\d{2}):(\d{2})$/)
  if (hmsMatch) {
    const hours = parseInt(hmsMatch[1] ?? '0', 10)
    const minutes = parseInt(hmsMatch[2] ?? '0', 10)
    const seconds = parseInt(hmsMatch[3] ?? '0', 10)
    return hours * 60 + minutes + seconds / 60
  }

  const mmssMatch = normalized.match(/^(\d+):(\d{2})$/)
  if (mmssMatch) {
    const minutes = parseInt(mmssMatch[1] ?? '0', 10)
    const seconds = parseInt(mmssMatch[2] ?? '0', 10)
    return minutes + seconds / 60
  }

  let minutes = 0
  let matched = false

  const hourMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:h|hr|hrs|hour|hours|ч)/)
  if (hourMatch?.[1]) {
    minutes += parseFloat(hourMatch[1].replace(',', '.')) * 60
    matched = true
  }

  const minuteMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:m|min|mins|minute|minutes|м|мин)/)
  if (minuteMatch?.[1]) {
    minutes += parseFloat(minuteMatch[1].replace(',', '.'))
    matched = true
  }

  const secondMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:s|sec|secs|second|seconds|с|сек)/)
  if (secondMatch?.[1]) {
    minutes += parseFloat(secondMatch[1].replace(',', '.')) / 60
    matched = true
  }

  if (matched) return minutes

  const numericOnly = normalized.match(/^(\d+(?:[.,]\d+)?)$/)
  if (numericOnly?.[1]) {
    return parseFloat(numericOnly[1].replace(',', '.'))
  }

  return null
}

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

const chartTheme = {
  grid: '#27272a',
  text: '#a1a1aa',
  bar1: '#3b82f6',
  bar2: '#10b981',
  line: '#8b5cf6',
}

export function VelocityView() {
  const { state, loading } = useLiveState()

  const velocity = state?.state?.velocity
  const phaseMetrics = state?.state?.phaseMetrics ?? []

  // Build chart data from phaseMetrics
  const phaseChartData = useMemo(() => {
    const seen = new Map<string, number>()
    return phaseMetrics.map((pm: PhaseMetric) => {
      const count = (seen.get(pm.phase) ?? 0) + 1
      seen.set(pm.phase, count)
      return {
        name: count > 1 ? `${pm.phase}.${count}` : pm.phase,
        totalMinutes: pm.totalMinutes,
        avgPerPlan: pm.avgPerPlan,
        plans: pm.plans,
      }
    })
  }, [phaseMetrics])

  // Build plan-level chart from phases > plans > summaries
  const planChartData = useMemo(() => {
    if (!state?.phases) return []

    const raw: Array<{
      baseName: string
      scopedName: string
      duration: number
    }> = []
    for (const phase of state.phases) {
      const scope = (phase.slug || phase.dirName || '').replace(/^\d+(?:\.\d+)?-?/, '')
      for (const plan of phase.plans ?? []) {
        if (plan.summary?.duration) {
          const minutes = parseDurationMinutes(plan.summary.duration)
          if (minutes != null && Number.isFinite(minutes) && minutes > 0) {
            const baseName = `P${phase.number}.${plan.planNumber}`
            raw.push({
              baseName,
              scopedName: scope ? `${baseName} (${scope})` : baseName,
              duration: Math.round(minutes),
            })
          }
        }
      }
    }

    const counts = new Map<string, number>()
    for (const item of raw) {
      counts.set(item.baseName, (counts.get(item.baseName) ?? 0) + 1)
    }

    return raw.map((item) => ({
      name: (counts.get(item.baseName) ?? 0) > 1 ? item.scopedName : item.baseName,
      duration: item.duration,
    }))
  }, [state?.phases])

  // Cumulative progress
  const cumulativeData = useMemo(() => {
    if (!state?.phases) return []

    let total = 0
    const points: Array<{ phase: string; completed: number }> = []
    const seen = new Map<string, number>()

    for (const phase of state.phases) {
      const completedPlans = phase.plans?.filter(
        (p) => p.status === 'complete' || (p.status as string) === 'summarized'
      ).length ?? 0
      total += completedPlans
      const base = `P${phase.number}`
      const count = (seen.get(base) ?? 0) + 1
      seen.set(base, count)
      points.push({
        phase: count > 1 ? `${base}.${count}` : base,
        completed: total,
      })
    }
    return points
  }, [state?.phases])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    )
  }

  if (!state) return null

  const totalPlans = velocity?.totalPlans ?? 0
  const avgDuration = velocity?.avgDuration
    ? `${Math.round(velocity.avgDuration)}m`
    : '--'
  const totalDuration = velocity?.totalDuration
    ? `${Math.round(velocity.totalDuration)}m`
    : '--'

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Velocity</h1>

      {/* Stats Row */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Total Plans" value={totalPlans} icon={BarChart3} />
        <StatCard label="Avg Duration" value={avgDuration} icon={Clock} />
        <StatCard label="Total Duration" value={totalDuration} icon={TrendingUp} />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Plan Duration Chart */}
        {planChartData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Plan Duration (minutes)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={planChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: chartTheme.text, fontSize: 11 }}
                    tickLine={{ stroke: chartTheme.grid }}
                    axisLine={{ stroke: chartTheme.grid }}
                  />
                  <YAxis
                    tick={{ fill: chartTheme.text, fontSize: 11 }}
                    tickLine={{ stroke: chartTheme.grid }}
                    axisLine={{ stroke: chartTheme.grid }}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: '#18181b',
                      border: '1px solid #27272a',
                      borderRadius: '6px',
                      fontSize: 12,
                    }}
                    labelStyle={{ color: '#fafafa' }}
                  />
                  <Bar
                    dataKey="duration"
                    fill={chartTheme.bar1}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Phase Duration Chart */}
        {phaseChartData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Phase Duration (minutes)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={phaseChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: chartTheme.text, fontSize: 11 }}
                    tickLine={{ stroke: chartTheme.grid }}
                    axisLine={{ stroke: chartTheme.grid }}
                  />
                  <YAxis
                    tick={{ fill: chartTheme.text, fontSize: 11 }}
                    tickLine={{ stroke: chartTheme.grid }}
                    axisLine={{ stroke: chartTheme.grid }}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: '#18181b',
                      border: '1px solid #27272a',
                      borderRadius: '6px',
                      fontSize: 12,
                    }}
                    labelStyle={{ color: '#fafafa' }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11, color: chartTheme.text }}
                  />
                  <Bar
                    dataKey="totalMinutes"
                    fill={chartTheme.bar1}
                    name="Total"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="avgPerPlan"
                    fill={chartTheme.bar2}
                    name="Avg/Plan"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Cumulative Progress */}
        {cumulativeData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cumulative Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={cumulativeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                  <XAxis
                    dataKey="phase"
                    tick={{ fill: chartTheme.text, fontSize: 11 }}
                    tickLine={{ stroke: chartTheme.grid }}
                    axisLine={{ stroke: chartTheme.grid }}
                  />
                  <YAxis
                    tick={{ fill: chartTheme.text, fontSize: 11 }}
                    tickLine={{ stroke: chartTheme.grid }}
                    axisLine={{ stroke: chartTheme.grid }}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: '#18181b',
                      border: '1px solid #27272a',
                      borderRadius: '6px',
                      fontSize: 12,
                    }}
                    labelStyle={{ color: '#fafafa' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="completed"
                    stroke={chartTheme.line}
                    strokeWidth={2}
                    dot={{ fill: chartTheme.line, r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Plans per Phase */}
        {phaseChartData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Plans per Phase</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={phaseChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: chartTheme.text, fontSize: 11 }}
                    tickLine={{ stroke: chartTheme.grid }}
                    axisLine={{ stroke: chartTheme.grid }}
                  />
                  <YAxis
                    tick={{ fill: chartTheme.text, fontSize: 11 }}
                    tickLine={{ stroke: chartTheme.grid }}
                    axisLine={{ stroke: chartTheme.grid }}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: '#18181b',
                      border: '1px solid #27272a',
                      borderRadius: '6px',
                      fontSize: 12,
                    }}
                    labelStyle={{ color: '#fafafa' }}
                  />
                  <Bar
                    dataKey="plans"
                    fill={chartTheme.bar2}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* No data state */}
      {phaseChartData.length === 0 && planChartData.length === 0 && (
        <div className="text-center py-12">
          <Activity size={48} className="mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-lg font-semibold">No velocity data yet</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Velocity metrics will appear as plans are completed.
          </p>
        </div>
      )}
    </div>
  )
}
