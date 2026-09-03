import 'dotenv/config'
import { streamText } from 'ai'
import { openai } from '@ai-sdk/openai'

const result = streamText({
  model: openai('gpt-4o-mini'),
  messages: [{ role: 'user', content: 'Say hello in exactly three words.' }],
})

for await (const chunk of result.textStream) process.stdout.write(chunk)
console.log('\n--- stream completed ---')