// scripts/ingest.cjs  (rename from ingest-pdf2json.cjs — it's THE ingest now)
require('dotenv').config()
const path = require('node:path')
const OpenAI = require('openai')
const { Pool } = require('pg')
const PDFParser = require('pdf2json')

const CHUNK_SIZE = 1000
const CHUNK_OVERLAP = 150
const EMBED_BATCH = 100

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

function chunkText(text) {
  const chunks = []
  let start = 0
  while (start < text.length) {
    chunks.push(text.slice(start, start + CHUNK_SIZE))
    start += CHUNK_SIZE - CHUNK_OVERLAP
  }
  return chunks.filter(c => c.trim().length > 30)
}

async function main() {
  const file = process.argv[2]
  const title = process.argv[3] ?? path.basename(file, '.pdf')
  if (!file) {
    console.error('Usage: npm run ingest -- <file.pdf> [title]')
    process.exit(1)
  }
  console.log(`📄 Processing: ${file}`)

  const pdfParser = new PDFParser()
  const data = await new Promise((resolve, reject) => {
    pdfParser.on('pdfParser_dataError', reject)
    pdfParser.on('pdfParser_dataReady', resolve)
    pdfParser.loadPDF(file)
  })

  // One string per REAL page — index + 1 = the true page number
  const textPages = data.Pages.map(page =>
    page.Texts.map(t => t.R.map(r => decodeURIComponent(r.T)).join('')).join(' ')
  )

  const pending = []
  textPages.forEach((pageText, i) => {
    if (pageText.trim().length < 30) return   // skip blank pages WITHOUT shifting numbering
    for (const content of chunkText(pageText)) {
      pending.push({ content, page: i + 1 })
    }
  })

  if (pending.length === 0) {
    console.error('❌ No text extracted. PDF might be scanned or image-based.')
    process.exit(1)
  }
  console.log(`📄 ${title} — ${textPages.length} pages, ${pending.length} chunks`)

  const { rows: [doc] } = await pool.query(
    'INSERT INTO documents (title, filename) VALUES ($1, $2) RETURNING id',
    [title, path.basename(file)]
  )

  for (let i = 0; i < pending.length; i += EMBED_BATCH) {
    const batch = pending.slice(i, i + EMBED_BATCH)
    const res = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: batch.map(c => c.content),
    })
    for (let j = 0; j < batch.length; j++) {
      await pool.query(
        `INSERT INTO chunks (document_id, content, page, embedding)
         VALUES ($1, $2, $3, $4::vector)`,
        [doc.id, batch[j].content, batch[j].page, JSON.stringify(res.data[j].embedding)]
      )
    }
    console.log(`✅ Embedded ${Math.min(i + EMBED_BATCH, pending.length)}/${pending.length}`)
  }

  await pool.end()
  console.log('✅ Done!')
}

main().catch(err => { console.error('❌ Error:', err.message); process.exit(1) })