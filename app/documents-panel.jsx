'use client'

import { useCallback, useEffect, useState } from 'react'

export default function DocumentsPanel() {
  const [docs, setDocs] = useState([])
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState(null)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/documents')
      const data = await res.json()
      setDocs(data.documents || [])
    } catch {
      setMessage({ type: 'error', text: 'Failed to load documents' })
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  async function onFile(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file
    if (!file) return
    setUploading(true)
    setMessage({ type: 'info', text: `Ingesting "${file.name}"… (embedding takes a few seconds)` })
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setMessage({ type: 'info', text: `✅ "${data.title}" — ${data.pages} pages, ${data.chunks} chunks indexed` })
      await refresh()
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setUploading(false)
    }
  }

  async function onDelete(id) {
    await fetch('/api/documents', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    await refresh()
  }

  return (
    <section className="border-b border-zinc-800 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-zinc-500">Documents</span>
        {docs.map((d) => (
          <span
            key={d.id}
            className="flex items-center gap-1 rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-zinc-300"
          >
            {d.title}
            <span className="text-zinc-500">({d.chunk_count})</span>
            <button
              onClick={() => onDelete(d.id)}
              className="text-zinc-500 hover:text-red-400"
              title="Delete document"
            >
              ✕
            </button>
          </span>
        ))}
        <label
          className={`cursor-pointer rounded-full border border-dashed border-zinc-600 px-2 py-0.5 text-xs text-zinc-400 hover:border-zinc-400 ${
            uploading ? 'pointer-events-none opacity-50' : ''
          }`}
        >
          {uploading ? 'Processing…' : '+ Upload PDF'}
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={onFile}
            disabled={uploading}
          />
        </label>
      </div>
      {message && (
        <p className={`mt-2 text-xs ${message.type === 'error' ? 'text-red-400' : 'text-zinc-500'}`}>
          {message.text}
        </p>
      )}
    </section>
  )
}