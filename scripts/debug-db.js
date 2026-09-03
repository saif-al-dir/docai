// scripts/debug-db.js
import 'dotenv/config'
import pg from 'pg'

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

async function debugDB() {
  try {
    // Check documents
    const docResult = await pool.query('SELECT * FROM documents ORDER BY uploaded_at DESC LIMIT 5')
    console.log(`📄 Documents in DB: ${docResult.rowCount}`)
    if (docResult.rowCount > 0) {
      console.log('Latest document:', docResult.rows[0])
    }

    // Check chunks count
    const chunkResult = await pool.query('SELECT COUNT(*) as count FROM chunks')
    console.log(`📊 Chunks in DB: ${chunkResult.rows[0].count}`)

    if (chunkResult.rows[0].count > 0) {
      // Show sample chunk
      const sample = await pool.query('SELECT * FROM chunks LIMIT 1')
      console.log('Sample chunk:', {
        id: sample.rows[0].id,
        content: sample.rows[0].content.slice(0, 100) + '...',
        page: sample.rows[0].page,
        has_embedding: !!sample.rows[0].embedding
      })

      // Check embedding dimension using pgvector's built-in function
      try {
        const dims = await pool.query(`
          SELECT vector_dims(embedding) as dimension 
          FROM chunks 
          WHERE embedding IS NOT NULL 
          LIMIT 1
        `)
        console.log('📐 Embedding dimension:', dims.rows[0]?.dimension || 'N/A')
      } catch (err) {
        console.log('📐 Could not determine embedding dimension')
      }
    }

    await pool.end()
  } catch (err) {
    console.error('❌ Debug error:', err.message)
  }
}

debugDB()