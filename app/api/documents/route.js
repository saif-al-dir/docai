import { pool } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { rows } = await pool.query(
    `select d.id, d.title, d.filename, d.uploaded_at, count(c.id) as chunk_count
     from documents d
     left join chunks c on c.document_id = d.id
     where d.user_id = $1
     group by d.id
     order by d.uploaded_at desc`,
    [user.id]
  )
  return Response.json({ documents: rows })
}

export async function DELETE(req) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })

  // user_id in WHERE = ownership check: users can only delete their own docs
  await pool.query('delete from documents where id = $1 and user_id = $2', [id, user.id])
  return Response.json({ ok: true })
}