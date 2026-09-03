import 'dotenv/config'
import OpenAI from 'openai'
import pg from 'pg'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

const question = process.argv.slice(2).join(' ')
if (!question) {
  console.error('Usage: node scripts/query.js "your question here"')
  process.exit(1)
}

console.log(`🔍 Querying: "${question}"`)

try {
  // Generate embedding for the question
  console.log('📤 Generating embedding...')
  const { data } = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: question,
  })
  console.log(`✅ Embedding generated (${data[0].embedding.length} dimensions)`)

  // Search for similar chunks
  console.log('🔎 Searching database...')
  const { rows } = await pool.query(
    `select d.title, c.page, c.content,
            1 - (c.embedding <=> $1::vector) as similarity
     from chunks c
     join documents d on d.id = c.document_id
     order by c.embedding <=> $1::vector
     limit 5`,
    [JSON.stringify(data[0].embedding)]
  )

  console.log(`📊 Found ${rows.length} results`)
  
  if (rows.length === 0) {
    console.log('❌ No results found! Possible causes:')
    console.log('  1. No documents ingested (run scripts/ingest.js first)')
    console.log('  2. Embedding dimension mismatch (check debug-db.js)')
    console.log('  3. Database connection issue')
  }

  for (const r of rows) {
    console.log(`\n[${r.title} · page ${r.page} · similarity ${r.similarity.toFixed(3)}]`)
    console.log(r.content.slice(0, 300) + (r.content.length > 300 ? '...' : ''))
  }

  await pool.end()
} catch (err) {
  console.error('❌ Error:', err.message)
  if (err.code) console.error('Code:', err.code)
  process.exit(1)
}