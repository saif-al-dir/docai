// MyDevil/Passenger entry — CommonJS. Passenger requires() this file; the Next
// standalone bundle (ESM, "type":"module") lives in ./bundle/ and is started
// via dynamic import(). Fully instrumented: boot trace, listen probe, stderr
// capture, exit/kill visibility, heartbeat.
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')

const __log = (msg) => {
  try {
    fs.appendFileSync(path.join(__dirname, 'boot-error.log'), new Date().toISOString() + ' ' + msg + '\n')
  } catch {}
}

// Capture ALL error output — Next's logger writes via process.stderr.write,
// which bypasses console.error hooks
const origStderr = process.stderr.write.bind(process.stderr)
process.stderr.write = function (chunk, ...rest) {
  try { __log('stderr: ' + String(chunk).trim().slice(0, 500)) } catch {}
  return origStderr(chunk, ...rest)
}
const origExit = process.exit
process.exit = function (code) { __log('process.exit(' + code + ')'); origExit(code) }
process.on('uncaughtException', (e) => { __log('uncaught: ' + ((e && e.stack) || e)); origExit(1) })
process.on('unhandledRejection', (e) => { __log('rejection: ' + ((e && e.stack) || e)); origExit(1) })
process.on('SIGTERM', () => { __log('SIGTERM'); origExit(0) })

process.env.NODE_ENV = 'production'
process.env.HOSTNAME = '0.0.0.0'

__log('boot — PORT=' + (process.env.PORT ?? 'undefined') + ' NODE=' + process.version)

// .env loader (secrets live only on the server)
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

// THE probe: what really happens at listen(), under Passenger
const origListen = http.Server.prototype.listen
http.Server.prototype.listen = function (...args) {
  __log('listen(' + args.map((a) => (a && typeof a === 'object') ? JSON.stringify(a) : String(a)).join(', ') + ')')
  this.once('listening', () => __log('LISTENING ✔'))
  this.once('error', (e) => __log('listen ERROR: ' + ((e && e.code) || '') + ' ' + ((e && e.message) || e)))
  return origListen.apply(this, args)
}

// Heartbeat — a SIGKILL (e.g. memory limit) can't be caught, but the log
// just STOPS, and the timestamps show exactly when the process died
const hb = setInterval(() => __log('alive'), 15000)
hb.unref && hb.unref()

import('./bundle/server.js')
  .then(() => __log('server.js import resolved'))
  .catch((err) => { __log('server import failed: ' + ((err && err.stack) || err)); process.exit(1) })