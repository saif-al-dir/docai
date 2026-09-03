'use client'

import { useEffect, useState } from 'react'

export default function UsageStats({ refreshKey }) {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    fetch('/api/usage')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setStats(d.usage))
      .catch(() => {})
  }, [refreshKey])

  if (!stats || Number(stats.total_messages) === 0) return null

  const inTok = Number(stats.input_tokens)
  const outTok = Number(stats.output_tokens)
  // gpt-4o-mini pricing: $0.15 / 1M input, $0.60 / 1M output (approximation — embeddings not counted)
  const cost = (inTok * 0.15 + outTok * 0.6) / 1_000_000
  const avgSec = (Number(stats.avg_latency_ms) / 1000).toFixed(1)

  return (
    <div className="flex gap-3 text-xs text-zinc-500">
      <span>{stats.total_messages} msgs</span>
      <span>{Number(stats.total_tokens).toLocaleString()} tokens</span>
      <span>≈ ${cost.toFixed(3)}</span>
      <span>avg {avgSec}s</span>
    </div>
  )
}