// scripts/ingest-text.js
import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import OpenAI from 'openai'
import pg from 'pg'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

async function main() {
  const file = process.argv[2]
  const title = process.argv[3] ?? path.basename(file)
  if (!file) {
    console.error('Usage: node scripts/ingest-text.js <file.txt> [title]')
    process.exit(1)
  }

  // Read text file
  const content = await readFile(file, 'utf-8')
  
  // Create document
  const { rows: [doc] } = await pool.query(
    'INSERT INTO documents (title, filename) VALUES ($1, $2) RETURNING id',
    [title, path.basename(file)]
  )
  console.log(`📄 Created document: ${doc.id}`)

  // Generate embedding for the entire text
  const embedding = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: content,
  })

  // Insert chunk
  await pool.query(
    `INSERT INTO chunks (document_id, content, page, embedding)
     VALUES ($1, $2, $3, $4::vector)`,
    [doc.id, content, 1, JSON.stringify(embedding.data[0].embedding)]
  )
  
  console.log('✅ Done! Inserted 1 chunk')
  await pool.end()
}

main().catch(console.error)