import { useParams, Link } from 'react-router'
import { FileText } from 'lucide-react'
import { useLiveState } from '@/hooks/use-live-state'
import { Breadcrumb } from '@/components/breadcrumb'
import { Card, CardContent } from '@/components/ui/card'
import { Markdown } from '@/components/markdown'
import { Skeleton } from '@/components/ui/skeleton'

export function DocumentView() {
  const params = useParams()
  const path = params['*'] ?? ''
  const { state, loading } = useLiveState()

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!state) return null

  // Find document in research documents
  const doc = state.research?.find(
    (d) => d.filePath === path || d.fileName === path
  )

  const normalizedPath = path.replace(/\\/g, '/')
  const guessResearchOrigin =
    normalizedPath.includes('/research/') ||
    /\/phases\/.+-RESEARCH\.md$/i.test(normalizedPath)

  if (!doc) {
    return (
      <div className="py-20 text-center">
        <FileText size={48} className="mx-auto mb-4 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Document not found</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Could not find document at "{path}"
        </p>
        <Link
          to={guessResearchOrigin ? '/research' : '/roadmap'}
          className="mt-4 inline-block text-sm text-blue-400 hover:text-blue-300"
        >
          {guessResearchOrigin ? 'Back to Research' : 'Back to Roadmap'}
        </Link>
      </div>
    )
  }

  const fromResearch =
    doc.type === 'phase' ||
    doc.type === 'standalone' ||
    doc.filePath.replace(/\\/g, '/').includes('/research/')

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          {
            label: fromResearch ? 'Research' : 'Roadmap',
            href: fromResearch ? '/research' : '/roadmap',
          },
          ...(doc.type === 'phase' && doc.phase
            ? [{ label: `Phase ${doc.phase}`, href: `/phase/${doc.phase}` }]
            : []),
          { label: doc.title || doc.fileName },
        ]}
      />

      <div>
        <h1 className="text-2xl font-bold mb-1">{doc.title || doc.fileName}</h1>
        <p className="text-sm text-muted-foreground font-mono">{doc.filePath}</p>
      </div>

      <Card>
        <CardContent className="p-6">
          <Markdown content={doc.body} />
        </CardContent>
      </Card>
    </div>
  )
}
