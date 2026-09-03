// MyDevil entry point: loads .env, then starts the Next.js standalone server.
// ESM format — the standalone bundle's package.json has "type": "module",
// so CommonJS require() is unavailable here.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

process.env.NODE_ENV = 'production'

// Next standalone binds to the HOSTNAME env var; shared hosts often set it to
// a value the process can't bind to — force the safe wildcard address.
process.env.HOSTNAME = '0.0.0.0'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Minimal .env loader — the standalone output doesn't load .env files itself.
// Runtime secrets (DATABASE_URL, OPENAI_API_KEY) live only here, on the server.
const envPath = path.join(__dirname, '.env')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!match) continue
    const key = match[1]
    let value = match[2].trim()
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

// Works whether server.js is ESM or CommonJS
await import('./server.js')