import { Link } from 'react-router'
import { BookOpen, FileText, ChevronRight } from 'lucide-react'
import { useLiveState } from '@/hooks/use-live-state'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { ResearchDocument } from '../../server/types'

function ResearchCard({ doc }: { doc: ResearchDocument }) {
  const isResearchSummary =
    doc.type === 'standalone' && /summary\.md$/i.test(doc.fileName)

  return (
    <Link to={`/document/${doc.filePath}`}>
      <Card
        className={cn(
          'group cursor-pointer transition-colors hover:border-zinc-600',
          isResearchSummary && 'border-amber-500/40 bg-amber-500/10 hover:border-amber-400/70'
        )}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <FileText size={14} className="shrink-0 text-muted-foreground" />
                <h3 className="text-sm font-medium truncate">{doc.title}</h3>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Badge
                  variant={isResearchSummary ? 'warning' : 'secondary'}
                  className="text-xs"
                >
                  {doc.type === 'phase'
                    ? `Phase ${doc.phase}`
                    : isResearchSummary
                      ? 'Research Summary'
                      : 'Standalone'}
                </Badge>
              </div>
              {doc.headings.length > 0 && (
                <div className="mt-2 space-y-0.5">
                  {doc.headings.slice(0, 4).map((heading, i) => (
                    <p key={i} className="text-xs text-muted-foreground truncate">
                      {heading}
                    </p>
                  ))}
                  {doc.headings.length > 4 && (
                    <p className="text-xs text-muted-foreground">
                      +{doc.headings.length - 4} more sections
                    </p>
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

export function ResearchView() {
  const { state, loading } = useLiveState()

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    )
  }

  if (!state) return null

  const research = state.research ?? []
  const phaseResearch = research.filter((r) => r.type === 'phase')
  const standalone = research.filter((r) => r.type === 'standalone')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Research</h1>
        <span className="text-sm text-muted-foreground">
          {research.length} documents
        </span>
      </div>

      {/* Phase Research */}
      {phaseResearch.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Phase Research ({phaseResearch.length})
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {phaseResearch.map((doc) => (
              <ResearchCard key={doc.filePath} doc={doc} />
            ))}
          </div>
        </div>
      )}

      {/* Standalone Research */}
      {standalone.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Standalone Research ({standalone.length})
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {standalone.map((doc) => (
              <ResearchCard key={doc.filePath} doc={doc} />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {research.length === 0 && (
        <div className="text-center py-12">
          <BookOpen size={48} className="mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-lg font-semibold">No research documents</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Research documents will appear here as phases are researched.
          </p>
        </div>
      )}
    </div>
  )
}
