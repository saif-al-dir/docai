import 'dotenv/config'
import OpenAI from 'openai'
import pg from 'pg'

// Mini retrieval eval: does the top-4 search surface the right evidence?
// ADJUST the cases to match YOUR ingested document before running.
const CASES = [
  { q: 'What is the termination notice period?', expect: /30 days/i },
  { q: 'Who owns the work product?', expect: /client/i },
  { q: 'What is the monthly fee?', expect: /5,000/i },
]

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

let passed = 0
for (const { q, expect } of CASES) {
  const { data } = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: q,
  })
  const { rows } = await pool.query(
    `select c.content, 1 - (c.embedding <=> $1::vector) as similarity
     from chunks c
     order by c.embedding <=> $1::vector
     limit 4`,
    [JSON.stringify(data[0].embedding)]
  )
  const hit = rows.find((r) => expect.test(r.content))
  if (hit) passed++
  console.log(
    `[${hit ? 'PASS' : 'FAIL'}] "${q}" → ` +
      (hit
        ? `evidence found (similarity ${Number(hit.similarity).toFixed(3)})`
        : `no matching evidence in top 4`)
  )
}
console.log(`\n${passed}/${CASES.length} passed`)
await pool.end()