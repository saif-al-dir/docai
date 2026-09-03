import { pool } from '@/lib/db'
import { extractPagesFromBuffer } from '@/lib/pdf-text'
import { ingestDocument } from '@/lib/ingest'

export const runtime = 'nodejs'
const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

export async function POST(req) {
  try {
    const form = await req.formData()
    const file = form.get('file')

    if (!file || typeof file === 'string') {
      return Response.json({ error: 'No file provided' }, { status: 400 })
    }
    if (file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf')) {
      return Response.json({ error: 'Only PDF files are supported' }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return Response.json({ error: 'File too large (max 10 MB)' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const title = file.name.replace(/\.pdf$/i, '')
    const pages = await extractPagesFromBuffer(buffer)

    const { documentId, chunkCount } = await ingestDocument(pool, {
      title,
      filename: file.name,
      pages,
    })

    return Response.json({ ok: true, documentId, title, pages: pages.length, chunks: chunkCount })
  } catch (err) {
    console.error('[upload]', err)
    return Response.json({ error: err.message || 'Upload failed' }, { status: 500 })
  }
}