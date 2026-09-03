'use client'

import { useChat } from '@ai-sdk/react'
import { useEffect, useRef, useState } from 'react'
import DocumentsPanel from './documents-panel'

// Renders text, turning [1] [2] markers into clickable citation buttons
function TextWithCitations({ text, onCite }) {
  if (!text) return null
  return (
    <>
      {text
        .split('\n')
        .filter((line) => line.trim().length > 0)
        .map((line, li) => {
          const segments = line.split(/(\[\d{1,2}\])/)
          return (
            <p key={li} className="mb-1 last:mb-0">
              {segments.map((seg, i) => {
                const m = seg.match(/^\[(\d{1,2})\]$/)
                return m ? (
                  <button
                    key={i}
                    onClick={() => onCite(Number(m[1]))}
                    className="mx-0.5 rounded bg-zinc-800 px-1.5 py-0.5 text-xs font-medium text-sky-300 hover:bg-zinc-700"
                  >
                    {seg}
                  </button>
                ) : (
                  <span key={i}>{seg}</span>
                )
              })}
            </p>
          )
        })}
    </>
  )
}

export default function ChatPage() {
  const { messages, sendMessage, status, stop, error, setMessages } = useChat()
  const [input, setInput] = useState('')
  const [activeSource, setActiveSource] = useState(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const canSend = status === 'ready' || status === 'error'

  function sourcesOf(message) {
    const part = message.parts.find((p) => p.type === 'data-sources')
    return part ? part.data : []
  }

  function openCitation(sources, n) {
    const s = sources[n - 1]
    if (s) setActiveSource({ ...s, index: n })
  }

  function retry() {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
    if (!lastUserMsg) return
    const text = lastUserMsg.parts
      .map((p) => (p.type === 'text' ? p.text : ''))
      .join('')
      .trim()
    if (!text) return
    setMessages(messages.filter((m) => m.id !== lastUserMsg.id))
    sendMessage({ text })
  }

  function onSubmit(e) {
    e.preventDefault()
    const text = input.trim()
    if (!text || !canSend) return
    sendMessage({ text })
    setInput('')
  }

  return (
    <main className="mx-auto flex h-screen max-w-2xl flex-col px-4">
      <header className="border-b border-zinc-800 py-4">
        <h1 className="text-lg font-semibold">DocAI</h1>
        <p className="text-sm text-zinc-500">Chat with your documents</p>
      </header>

      <DocumentsPanel />

      <div className="flex-1 space-y-4 overflow-y-auto py-6">
        {messages.length === 0 && (
          <p className="mt-8 text-center text-sm text-zinc-500">
            Ask anything about your ingested documents to get started.
          </p>
        )}

        {messages.map((message) => {
          const sources = sourcesOf(message)

          if (message.role === 'user') {
            return (
              <div key={message.id} className="ml-auto max-w-[80%] rounded-2xl bg-zinc-800 px-4 py-2">
                {message.parts.map((part, i) =>
                  part.type === 'text' ? <p key={i}>{part.text}</p> : null
                )}
              </div>
            )
          }

          return (
            <div
              key={message.id}
              className="mr-auto max-w-[80%] rounded-2xl bg-zinc-900 px-4 py-2 text-zinc-200"
            >
              {message.parts.map((part, i) =>
                part.type === 'text' ? (
                  <TextWithCitations
                    key={i}
                    text={part.text}
                    onCite={(n) => openCitation(sources, n)}
                  />
                ) : null
              )}

              {sources.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5 border-t border-zinc-800 pt-2">
                  {sources.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveSource({ ...s, index: i + 1 })}
                      className="rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                    >
                      [{i + 1}] {s.title} · p.{s.page}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {status === 'submitted' && (
          <div className="mr-auto max-w-[80%] rounded-2xl bg-zinc-900 px-4 py-2 text-zinc-500">
            thinking…
          </div>
        )}

        {error && (
          <div className="mr-auto max-w-[80%] rounded-lg bg-red-950 p-3 text-sm text-red-300">
            <div className="mb-1">{error.message || 'Something went wrong'}</div>
            <button onClick={retry} className="rounded border border-red-700 px-2 py-0.5 text-xs">
              Retry
            </button>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {activeSource && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setActiveSource(null)}
        >
          <div
            className="max-h-[70vh] w-full max-w-lg overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-900 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-200">
                [{activeSource.index}] {activeSource.title} · page {activeSource.page}
              </h3>
              <button
                onClick={() => setActiveSource(null)}
                className="text-zinc-500 hover:text-zinc-200"
              >
                ✕
              </button>
            </div>
            <p className="mb-3 text-xs text-zinc-500">
              match confidence {(activeSource.similarity * 100).toFixed(0)}%
            </p>
            <p className="whitespace-pre-wrap text-sm text-zinc-300">{activeSource.content}</p>
          </div>
        </div>
      )}

      <form onSubmit={onSubmit} className="flex gap-2 border-t border-zinc-800 py-4">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={canSend ? 'Ask anything…' : 'Assistant is answering…'}
          className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 outline-none focus:border-zinc-500"
          autoFocus
        />
        {canSend ? (
          <button
            type="submit"
            disabled={!input.trim()}
            className="rounded-xl bg-zinc-100 px-4 py-2 font-medium text-zinc-900 disabled:opacity-40"
          >
            Send
          </button>
        ) : (
          <button
            type="button"
            onClick={stop}
            className="rounded-xl border border-zinc-700 px-4 py-2 text-zinc-300"
          >
            Stop
          </button>
        )}
      </form>
    </main>
  )
}