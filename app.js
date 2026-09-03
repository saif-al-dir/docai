// MyDevil/Passenger entry point — MUST be CommonJS.
// Passenger starts Node apps by require()-ing the startup file. The Next.js
// standalone bundle ships a package.json with "type": "module", which makes
// every .js file there un-requireable (ERR_REQUIRE_ESM) — the process dies
// before any app code runs. Hence: this entry is CJS (no "type" in the root
// package.json), the bundle lives in ./bundle/ with its own package.json,
// and we start it via dynamic import(), which handles ESM fine.
const fs = require('node:fs')
const path = require('node:path')

// Crash evidence: Passenger's stderr is hard to reach — log to our own file
function logBoot(msg) {
  try {
    fs.appendFileSync(path.join(__dirname, 'boot-error.log'), new Date().toISOString() + ' ' + msg + '\n')
  } catch {}
}
const origErr = console.error
console.error = function () {
  logBoot('stderr: ' + [...arguments].map((a) => (a && a.stack) || String(a)).join(' '))
  origErr.apply(console, arguments)
}
process.on('uncaughtException', (e) => { logBoot('uncaught: ' + ((e && e.stack) || e)); process.exit(1) })
process.on('unhandledRejection', (e) => { logBoot('rejection: ' + ((e && e.stack) || e)); process.exit(1) })

process.env.NODE_ENV = 'production'
process.env.HOSTNAME = '0.0.0.0' // Next standalone otherwise binds to the HOSTNAME env var

logBoot('boot — PORT=' + (process.env.PORT ?? 'undefined') + ' NODE=' + process.version)

// .env loader — secrets live only on the server, next to this file
const envPath = path.join(__dirname, '.env')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!m) continue
    let value = m[2].trim()
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = value
  }
}

// Start Next's standalone server from the bundle directory
import('./bundle/server.js').catch((err) => {
  logBoot('server import failed: ' + ((err && err.stack) || err))
  process.exit(1)
})