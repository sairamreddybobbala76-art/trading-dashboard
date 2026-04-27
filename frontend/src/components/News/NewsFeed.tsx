import { useEffect, useState } from 'react'
import { api } from '../../services/api'
import type { NewsItem } from '../../types'
import { Newspaper, ExternalLink } from 'lucide-react'

interface Props {
  ticker: string
}

function SentimentBadge({ score }: { score: number }) {
  if (score > 0.1) return <span className="text-bull text-xs">▲ Bullish</span>
  if (score < -0.1) return <span className="text-bear text-xs">▼ Bearish</span>
  return <span className="text-muted text-xs">— Neutral</span>
}

export function NewsFeed({ ticker }: Props) {
  const [items, setItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!ticker) return
    setLoading(true)
    api.news(ticker, 15)
      .then((r) => setItems(r.items))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [ticker])

  return (
    <div className="flex flex-col gap-3 h-full overflow-hidden">
      <div className="flex items-center gap-2">
        <Newspaper size={16} className="text-accent" />
        <h2 className="text-sm font-semibold text-text uppercase tracking-widest">Market News</h2>
        {loading && <span className="text-xs text-muted animate-pulse">Loading…</span>}
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {items.length === 0 && !loading && (
          <p className="text-muted text-xs">Select a ticker to load news.</p>
        )}
        {items.map((item, i) => (
          <a
            key={i}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-panel rounded-lg p-3 border border-muted/10 hover:border-muted/30 transition-colors group"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs text-text leading-snug group-hover:text-accent transition-colors line-clamp-2">
                {item.title}
              </p>
              <ExternalLink size={12} className="text-muted flex-shrink-0 mt-0.5" />
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-xs text-muted">{item.source}</span>
              <span className="text-muted/30">·</span>
              <SentimentBadge score={item.sentiment} />
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}
