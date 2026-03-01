import { CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type Status =
  | 'planned'
  | 'researched'
  | 'executing'
  | 'summarized'
  | 'verified'
  | 'complete'
  | 'failed'
  | 'shipped'
  | 'in_progress'
  | 'in-progress'
  | 'blocked'
  | 'pending'
  | 'done'

interface StatusBadgeProps {
  status: string
  className?: string
}

const statusConfig: Record<string, { className: string; label?: string }> = {
  planned: { className: 'bg-zinc-700 text-zinc-300' },
  researched: { className: 'bg-blue-900/50 text-blue-400 border-blue-800' },
  executing: { className: 'bg-amber-900/50 text-amber-400 border-amber-800' },
  summarized: { className: 'bg-green-900/50 text-green-400 border-green-800' },
  verified: { className: 'bg-emerald-900/50 text-emerald-400 border-emerald-800' },
  complete: { className: 'bg-green-900/50 text-green-400 border-green-800' },
  shipped: { className: 'bg-green-900/50 text-green-400 border-green-800' },
  'in_progress': { className: 'bg-amber-900/50 text-amber-400 border-amber-800', label: 'In Progress' },
  'in-progress': { className: 'bg-amber-900/50 text-amber-400 border-amber-800', label: 'In Progress' },
  blocked: { className: 'bg-red-900/50 text-red-400 border-red-800' },
  failed: { className: 'bg-red-900/50 text-red-400 border-red-800' },
  pending: { className: 'bg-zinc-700 text-zinc-300' },
  done: { className: 'bg-green-900/50 text-green-400 border-green-800' },
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] ?? { className: 'bg-zinc-700 text-zinc-300' }
  const label = config.label ?? status.charAt(0).toUpperCase() + status.slice(1)

  return (
    <Badge
      variant="outline"
      className={cn('whitespace-nowrap', config.className, className)}
    >
      {status === 'verified' && <CheckCircle2 size={12} className="mr-1" />}
      {label}
    </Badge>
  )
}
