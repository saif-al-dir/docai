import { streamText, embed, createUIMessageStream, createUIMessageStreamResponse } from 'ai'
import { openai } from '@ai-sdk/openai'
import { pool } from '@/lib/db'

const SYSTEM_BASE = `You are DocAI, an assistant that answers questions about the user's documents.

Rules:
- Ground your answer in the CONTEXT below.
- Cite sources inline with [1], [2] ... matching the context block numbers.
- If the CONTEXT doesn't contain the answer, say you couldn't find it in the documents — do not guess.
- Be concise.`

export async function POST(req) {
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

  // 1. Take the LATEST user question for retrieval
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')
  const question = lastUser
    ? lastUser.parts.filter((p) => p.type === 'text').map((p) => p.text).join('')
    : ''

  // 2. Embed the question and retrieve the top 4 chunks
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
       order by c.embedding <=> $1::vector
       limit 4`,
      [JSON.stringify(embedding)]
    )
    sources = rows.map((r) => ({ ...r, similarity: Number(r.similarity) }))
  }

  // 3. Inject the chunks into the system prompt
  const context = sources
    .map((s, i) => `[${i + 1}] ${s.title} (page ${s.page}):\n${s.content}`)
    .join('\n\n')

  const system = sources.length
    ? `${SYSTEM_BASE}\n\nCONTEXT:\n${context}`
    : `${SYSTEM_BASE}\n\nNo documents are currently ingested. Say so.`

  // 4. Stream: data-sources part first, then the grounded answer
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