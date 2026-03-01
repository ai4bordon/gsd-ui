import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  Search,
  FileText,
  Milestone as MilestoneIcon,
  Layers,
  ClipboardList,
  CheckSquare,
  Scale,
} from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useSearch } from '@/hooks/use-search'
import { cn } from '@/lib/utils'
import type { SearchEntry } from '../../server/types'

const typeIcons: Record<string, typeof FileText> = {
  milestone: MilestoneIcon,
  plan: ClipboardList,
  summary: FileText,
  verification: FileText,
  research: FileText,
  todo: CheckSquare,
  requirement: Scale,
  document: FileText,
}

const typeLabels: Record<string, string> = {
  milestone: 'Milestones',
  plan: 'Plans',
  summary: 'Summaries',
  verification: 'Verifications',
  research: 'Research',
  todo: 'Todos',
  requirement: 'Requirements',
  document: 'Documents',
}

function parsePhaseNum(phase: string): string {
  const match = phase.match(/^(\d+(?:\.\d+)?)/)
  return match ? String(Number(match[1])) : phase
}

function getResultHref(entry: SearchEntry): string {
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

export function SearchDialog() {
  const [open, setOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const { query, search, results, loading } = useSearch()
  const navigate = useNavigate()

  // Cmd+K / Ctrl+K to open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Group results by type
  const grouped = results.reduce<Record<string, SearchEntry[]>>((acc, entry) => {
    const group = acc[entry.type] ?? []
    group.push(entry)
    acc[entry.type] = group
    return acc
  }, {})

  const flatResults = results

  const handleSelect = useCallback(
    (entry: SearchEntry) => {
      setOpen(false)
      search('')
      navigate(getResultHref(entry))
    },
    [navigate, search]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, flatResults.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const selected = flatResults[selectedIndex]
        if (selected) handleSelect(selected)
      }
    },
    [flatResults, selectedIndex, handleSelect]
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl p-0 overflow-hidden">
        <div className="flex items-center border-b border-border px-4">
          <Search size={16} className="mr-2 text-muted-foreground" />
          <Input
            placeholder="Search everything... (plans, todos, decisions...)"
            value={query}
            onChange={(e) => {
              search(e.target.value)
              setSelectedIndex(0)
            }}
            onKeyDown={handleKeyDown}
            className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
            autoFocus
          />
          <kbd className="ml-2 rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground font-mono">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {loading && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Searching...
            </div>
          )}

          {!loading && query && results.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No results found for "{query}"
            </div>
          )}

          {!loading && !query && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Type to search across your project
            </div>
          )}

          {!loading &&
            Object.entries(grouped).map(([type, entries]) => {
              const Icon = typeIcons[type] ?? FileText
              return (
                <div key={type}>
                  <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {typeLabels[type] ?? type}
                  </div>
                  {entries.map((entry) => {
                    const globalIndex = flatResults.indexOf(entry)
                    return (
                      <button
                        key={`${entry.type}-${entry.path}`}
                        className={cn(
                          'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors',
                          globalIndex === selectedIndex
                            ? 'bg-accent text-accent-foreground'
                            : 'text-foreground hover:bg-accent/50'
                        )}
                        onClick={() => handleSelect(entry)}
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                      >
                        <Icon size={16} className="shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{entry.title}</div>
                          {entry.preview && (
                            <div className="truncate text-xs text-muted-foreground">
                              {entry.preview}
                            </div>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )
            })}
        </div>

        {results.length > 0 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground">
            <span>{results.length} results</span>
            <div className="flex gap-2">
              <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono">Up/Down</kbd>
              <span>to navigate</span>
              <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono">Enter</kbd>
              <span>to select</span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
