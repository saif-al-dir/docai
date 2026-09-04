// MyDevil/Passenger entry — CommonJS. Passenger requires() this file; the Next
// standalone bundle (ESM) lives in ./bundle/ and starts via dynamic import().
// Fully instrumented: import result, listen() outcome, stderr, exit, heartbeat.
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')

const __log = (msg) => {
  try { fs.appendFileSync(path.join(__dirname, 'boot-error.log'), new Date().toISOString() + ' ' + msg + '\n') } catch {}
}

// Next prints startup errors via process.stderr.write — hook it directly
const origWrite = process.stderr.write.bind(process.stderr)
process.stderr.write = function (chunk, ...rest) {
  try { __log('stderr: ' + String(chunk).trim().slice(0, 400)) } catch {}
  return origWrite(chunk, ...rest)
}
const origExit = process.exit
process.exit = function (code) { __log('process.exit(' + code + ')'); origExit(code) }
process.on('uncaughtException', (e) => { __log('uncaught: ' + ((e && e.stack) || e)); origExit(1) })
process.on('unhandledRejection', (e) => { __log('rejection: ' + ((e && e.stack) || e)); origExit(1) })
process.on('SIGTERM', () => { __log('SIGTERM'); origExit(0) })

process.env.NODE_ENV = 'production'
process.env.HOSTNAME = '0.0.0.0'
__log('boot — PORT=' + (process.env.PORT ?? 'undefined') + ' NODE=' + process.version)

// .env loader — secrets live only on the server, next to this file
const envPath = path.join(__dirname, '.env')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!m) continue
    let v = m[2].trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (process.env[m[1]] === undefined) process.env[m[1]] = v
  }
}

// listen() probe — finally observed under Passenger, the one place it matters
const origListen = http.Server.prototype.listen
http.Server.prototype.listen = function (...args) {
  __log('listen(' + args.map((a) => (a && typeof a === 'object') ? JSON.stringify(a) : String(a)).join(', ') + ')')
  this.once('listening', () => __log('LISTENING ✔'))
  this.once('error', (e) => __log('listen ERROR: ' + ((e && e.code) || '') + ' ' + ((e && e.message) || e)))
  return origListen.apply(this, args)
}

// heartbeat — a SIGKILL can't be caught; the log just stops, and timestamps show when
setInterval(() => __log('alive'), 15000).unref()

import('./bundle/server.js')
  .then(() => __log('server.js import resolved'))
  .catch((err) => { __log('server import failed: ' + ((err && err.stack) || err)); origExit(1) })