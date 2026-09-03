// app/page.js
'use client'

import { useChat } from '@ai-sdk/react'
import { useEffect, useRef, useState } from 'react'

export default function ChatPage() {
  const { messages, sendMessage, status, stop, error, setMessages } = useChat()
  const [input, setInput] = useState('')
  const bottomRef = useRef(null)

  // ✅ FIX: canSend includes error state
  const canSend = status === 'ready' || status === 'error'

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function retry() {
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
    if (!lastUserMsg) return
    const text = lastUserMsg.parts.map(p => (p.type === 'text' ? p.text : '')).join('').trim()
    if (!text) return
    setMessages(messages.filter(m => m.id !== lastUserMsg.id))
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

      <div className="flex-1 space-y-4 overflow-y-auto py-6">
        {messages.length === 0 && (
          <p className="mt-8 text-center text-sm text-zinc-500">
            Ask anything to get started.
          </p>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={
              message.role === 'user'
                ? 'ml-auto max-w-[80%] rounded-2xl bg-zinc-800 px-4 py-2'
                : 'mr-auto max-w-[80%] rounded-2xl bg-zinc-900 px-4 py-2 text-zinc-200'
            }
          >
            {message.parts.map((part, i) =>
              part.type === 'text' ? <p key={i}>{part.text}</p> : null
            )}
          </div>
        ))}

        {status === 'submitted' && (
          <div className="mr-auto max-w-[80%] rounded-2xl bg-zinc-900 px-4 py-2 text-zinc-500">
            thinking…
          </div>
        )}

        {error && (
          <div className="mr-auto max-w-[80%] rounded-lg bg-red-950 p-3 text-sm text-red-300">
            <div className="mb-1">{error.message || 'Something went wrong'}</div>
            <button
              onClick={retry}
              className="rounded border border-red-700 px-2 py-0.5 text-xs hover:bg-red-900"
            >
              Retry
            </button>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

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
            className="rounded-xl border border-zinc-700 px-4 py-2 text-zinc-300 hover:bg-zinc-800"
          >
            Stop
          </button>
        )}
      </form>
    </main>
  )
}