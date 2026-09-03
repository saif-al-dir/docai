import { streamText, embed, createUIMessageStream, createUIMessageStreamResponse } from 'ai'
import { openai } from '@ai-sdk/openai'
import { pool } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'

const SYSTEM_BASE = `You are DocAI, an assistant that answers questions about the user's documents.

Rules:
- Ground answers about document content in the CONTEXT below; cite sources inline with [1], [2] ...
- Questions about the conversation itself (e.g. "what did we discuss?") may be answered from the conversation history.
- If neither the CONTEXT nor the conversation contains the answer, say you couldn't find it in the documents — do not guess.
- Be concise.`

export async function POST(req) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { messages } = await req.json()

  const modelMessages = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      role: m.role,
      content: Array.isArray(m.parts)
        ? m.parts.filter((p) => p.type === 'text').map((p) => p.text).join('')
        : m.content ?? '',
    }))
    .filter((m) => m.content.length > 0)

  const lastUser = [...messages].reverse().find((m) => m.role === 'user')
  const question = lastUser
    ? lastUser.parts.filter((p) => p.type === 'text').map((p) => p.text).join('')
    : ''

  // Retrieval — scoped to THIS user's documents
  let sources = []
  if (question) {
    const { embedding } = await embed({
      model: openai.embedding('text-embedding-3-small'),
      value: question,
    })
    const { rows } = await pool.query(
      `select c.id, d.title, c.page, c.content,
              1 - (c.embedding <=> $1::vector) as similarity
       from chunks c
       join documents d on d.id = c.document_id
       where d.user_id = $2
       order by c.embedding <=> $1::vector
       limit 4`,
      [JSON.stringify(embedding), user.id]
    )
    sources = rows.map((r) => ({ ...r, similarity: Number(r.similarity) }))
  }

  const context = sources
    .map((s, i) => `[${i + 1}] ${s.title} (page ${s.page}):\n${s.content}`)
    .join('\n\n')

  const system = sources.length
    ? `${SYSTEM_BASE}\n\nCONTEXT:\n${context}`
    : `${SYSTEM_BASE}\n\nThe user has not uploaded any documents yet — say so.`

  const result = streamText({
    model: openai('gpt-4o-mini'),
    system,
    messages: modelMessages,
  })

  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      writer.write({
        type: 'data-sources',
        data: sources.map((s) => ({
          title: s.title,
          page: s.page,
          similarity: s.similarity,
          content: s.content,
        })),
      })
      writer.merge(result.toUIMessageStream())
    },
    onError: (error) => {
      console.error('[chat] stream error:', error)
      return 'Something went wrong — see server logs.'
    },
  })

  return createUIMessageStreamResponse({ stream })
}