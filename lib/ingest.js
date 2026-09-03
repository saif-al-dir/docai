import OpenAI from 'openai'

const CHUNK_SIZE = 1000
const CHUNK_OVERLAP = 150
const EMBED_BATCH = 100

// Lazy OpenAI client: the constructor throws without an API key, and module-level
// code runs during `next build` (page-data collection), where no runtime secrets
// exist. Creating the client on first *use* keeps the build clean; if the key is
// missing at actual embedding time, this fails loudly with a clear message.
let _openai = null
function getOpenAI() {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set')
    }
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return _openai
}

export function chunkText(text) {
  const chunks = []
  let start = 0
  while (start < text.length) {
    chunks.push(text.slice(start, start + CHUNK_SIZE))
    start += CHUNK_SIZE - CHUNK_OVERLAP
  }
  return chunks.filter((c) => c.trim().length > 30)
}

export async function ingestDocument(pool, { title, filename, pages, userId }) {
  const pending = []
  pages.forEach((pageText, i) => {
    if (pageText.trim().length < 30) return
    for (const content of chunkText(pageText)) {
      pending.push({ content, page: i + 1 })
    }
  })
  if (pending.length === 0) {
    throw new Error('No extractable text found — the PDF may be scanned/image-based.')
  }

  const { rows: [doc] } = await pool.query(
    'INSERT INTO documents (title, filename, user_id) VALUES ($1, $2, $3) RETURNING id',
    [title, filename, userId]
  )

  for (let i = 0; i < pending.length; i += EMBED_BATCH) {
    const batch = pending.slice(i, i + EMBED_BATCH)
    const res = await getOpenAI().embeddings.create({          // ← lazy
      model: 'text-embedding-3-small',
      input: batch.map((c) => c.content),
    })
    for (let j = 0; j < batch.length; j++) {
      await pool.query(
        `INSERT INTO chunks (document_id, content, page, embedding)
         VALUES ($1, $2, $3, $4::vector)`,
        [doc.id, batch[j].content, batch[j].page, JSON.stringify(res.data[j].embedding)]
      )
    }
  }

  return { documentId: doc.id, chunkCount: pending.length }
}