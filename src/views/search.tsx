import { useState } from 'react'
import { Link } from 'react-router'
import {
  Search,
  FileText,
  Layers,
  ClipboardList,
  CheckSquare,
  Scale,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useSearch } from '@/hooks/use-search'
import type { SearchEntry } from '../../server/types'

const typeIcons: Record<string, typeof FileText> = {
  milestone: Layers,
  plan: ClipboardList,
  summary: FileText,
  verification: FileText,
  research: FileText,
  todo: CheckSquare,
  requirement: Scale,
  document: FileText,
}

const typeLabels: Record<string, string> = {
  milestone: 'Milestone',
  plan: 'Plan',
  summary: 'Summary',
  verification: 'Verification',
  research: 'Research',
  todo: 'Todo',
  requirement: 'Requirement',
  document: 'Document',
}

function parsePhaseNum(phase: string): string {
  const match = phase.match(/^(\d+(?:\.\d+)?)/)
  return match ? String(Number(match[1])) : phase
}

function getResultUrl(entry: SearchEntry): string {
  if (entry.type === 'milestone' && entry.milestone) return `/milestone/${encodeURIComponent(entry.milestone)}`
  if (entry.type === 'plan' && entry.phase) {
    const planMatch = entry.title.match(/Plan (\d+)/)
    if (planMatch) {
      return `/plan/${parsePhaseNum(entry.phase)}/${planMatch[1]}`
    }
  }
  if ((entry.type === 'summary' || entry.type === 'verification') && entry.phase) {
    return `/phase/${parsePhaseNum(entry.phase)}`
  }
  if (entry.type === 'todo') return '/todos'
  if (entry.type === 'requirement') return '/requirements'
  if (entry.type === 'research') return `/document/${entry.path}`
  return '/'
}

function SearchResultItem({ entry }: { entry: SearchEntry }) {
  const Icon = typeIcons[entry.type] ?? FileText

  return (
    <Link to={getResultUrl(entry)}>
      <Card className="cursor-pointer transition-colors hover:border-zinc-600">
        <CardContent className="flex items-start gap-3 p-4">
          <div className="rounded-md bg-accent p-2">
            <Icon size={16} className="text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm truncate">{entry.title}</span>
              <Badge variant="secondary" className="text-xs shrink-0">
                {typeLabels[entry.type] ?? entry.type}
              </Badge>
            </div>
            {entry.preview && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {entry.preview}
              </p>
            )}
            {entry.phase && (
              <span className="mt-1 inline-block text-xs text-muted-foreground">
                Phase {entry.phase}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

export function SearchView() {
  const { query, search, results, loading } = useSearch()

  // Group results by type
  const grouped = results.reduce<Record<string, SearchEntry[]>>((acc, entry) => {
    const group = acc[entry.type] ?? []
    group.push(entry)
    acc[entry.type] = group
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-4">Search</h1>
        <div className="relative">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder="Search plans, todos, decisions, research..."
            value={query}
            onChange={(e) => search(e.target.value)}
            className="pl-10 h-12 text-base"
            autoFocus
          />
        </div>
      </div>

      {loading && (
        <div className="text-center text-sm text-muted-foreground py-8">
          Searching...
        </div>
      )}

      {!loading && query && results.length === 0 && (
        <div className="text-center py-12">
          <Search size={48} className="mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-lg font-semibold">No results</h2>
          <p className="text-sm text-muted-foreground mt-2">
            No matches found for "{query}"
          </p>
        </div>
      )}

      {!loading && !query && (
        <div className="text-center py-12">
          <Search size={48} className="mx-auto mb-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Type to search across your entire project.
            <br />
            <span className="text-xs">
              Tip: Use{' '}
              <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                Cmd+K
              </kbd>{' '}
              for quick search from anywhere.
            </span>
          </p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            {results.length} result{results.length !== 1 ? 's' : ''}
          </p>
          {Object.entries(grouped).map(([type, entries]) => (
            <div key={type}>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {typeLabels[type] ?? type}s ({entries.length})
              </h2>
              <div className="space-y-2">
                {entries.map((entry, i) => (
                  <SearchResultItem key={`${entry.type}-${entry.path}-${i}`} entry={entry} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
