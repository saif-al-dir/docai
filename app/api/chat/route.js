import { streamText } from 'ai'
import { openai } from '@ai-sdk/openai'

export async function POST(req) {
  const { messages } = await req.json()

  // Convert UI messages ({role, parts}) → model messages ({role, content})
  const modelMessages = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      role: m.role,
      content: Array.isArray(m.parts)
        ? m.parts.filter((p) => p.type === 'text').map((p) => p.text).join('')
        : m.content ?? '',
    }))
    .filter((m) => m.content.length > 0)

  const result = streamText({
    model: openai('gpt-4o-mini'),
    system: 'You are DocAI, a helpful assistant. Answer concisely.',
    messages: modelMessages,
  })

  return result.toUIMessageStreamResponse({   // v5 method — this is the one that exists
    onError: (error) => {
      console.error('[chat] stream error:', error)
      return 'Something went wrong — see server logs.'
    },
  })
}