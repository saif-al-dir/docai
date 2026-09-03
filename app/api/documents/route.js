import { pool } from '@/lib/db'

export async function GET() {
  const { rows } = await pool.query(
    `select d.id, d.title, d.filename, d.uploaded_at, count(c.id) as chunk_count
     from documents d
     left join chunks c on c.document_id = d.id
     group by d.id
     order by d.uploaded_at desc`
  )
  return Response.json({ documents: rows })
}

export async function DELETE(req) {
  const { id } = await req.json()
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })
  await pool.query('delete from documents where id = $1', [id]) // chunks cascade-delete
  return Response.json({ ok: true })
}