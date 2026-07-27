/**
 * Drives Chrome over CDP at a TRUE mobile viewport. Do not replace this with
 * a narrow window: headless Chrome enforces a ~500px minimum layout viewport
 * and reports overflow that does not exist on a real phone.
 *
 * This script IS the acceptance evidence for mobile correctness, so it must
 * be able to fail. Two properties make that true:
 *   1. Every wait is bounded (WebSocket handshake, each CDP command, and
 *      navigation itself) so a stalled Chrome or a hung page fails fast
 *      instead of the script hanging indefinitely.
 *   2. It waits for the real load event and then asserts a known element
 *      (<nav>, which the shell always renders) exists before trusting a
 *      zero-overflow result. A page that failed to load, or loaded to a
 *      blank/error page, has zero overflowing elements trivially, and a
 *      checker that reports PASS on that basis is worse than no checker.
 */
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const URL_TO_CHECK = process.env.CHECK_URL ?? 'http://localhost:3000'
const PORT = 9222
const CHROME =
  process.env.CHROME_PATH ??
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const WS_HANDSHAKE_TIMEOUT_MS = 10_000
const CDP_COMMAND_TIMEOUT_MS = 10_000
const NAVIGATION_TIMEOUT_MS = 15_000

function withTimeout(promise, ms, message) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`,
  '--headless=new',
  '--no-first-run',
  '--user-data-dir=/tmp/cdp-mobile-check',
])

let ws
try {
  await sleep(1500)
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
  const page = targets.find((t) => t.type === 'page')
  if (!page) {
    throw new Error('no page target found in Chrome; is the browser still starting up?')
  }

  ws = new WebSocket(page.webSocketDebuggerUrl)
  await withTimeout(
    new Promise((resolve, reject) => {
      ws.onopen = resolve
      ws.onerror = () => reject(new Error('WebSocket connection to Chrome failed'))
    }),
    WS_HANDSHAKE_TIMEOUT_MS,
    `WebSocket handshake with Chrome timed out after ${WS_HANDSHAKE_TIMEOUT_MS}ms`,
  )

  let id = 0
  const pending = new Map()
  const eventWaiters = new Map()
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data)
    if (msg.id !== undefined && pending.has(msg.id)) {
      pending.get(msg.id)(msg.result)
      pending.delete(msg.id)
      return
    }
    if (msg.method && eventWaiters.has(msg.method)) {
      for (const resolve of eventWaiters.get(msg.method).splice(0)) resolve(msg.params)
    }
  }

  const send = (method, params = {}) =>
    withTimeout(
      new Promise((resolve) => {
        const msgId = ++id
        pending.set(msgId, resolve)
        ws.send(JSON.stringify({ id: msgId, method, params }))
      }),
      CDP_COMMAND_TIMEOUT_MS,
      `CDP command "${method}" got no response within ${CDP_COMMAND_TIMEOUT_MS}ms`,
    )

  const waitForEvent = (method, ms) =>
    withTimeout(
      new Promise((resolve) => {
        const waiters = eventWaiters.get(method) ?? []
        waiters.push(resolve)
        eventWaiters.set(method, waiters)
      }),
      ms,
      `Timed out after ${ms}ms waiting for CDP event "${method}" (navigation may have stalled)`,
    )

  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  })
  await send('Page.enable')

  // Register the wait before navigating, so the event cannot fire and be
  // missed in the gap between the navigate command and the wait starting.
  const loaded = waitForEvent('Page.loadEventFired', NAVIGATION_TIMEOUT_MS)
  await send('Page.navigate', { url: URL_TO_CHECK })
  await loaded

  // Brief settle time for post-load client-side rendering (e.g. hydration),
  // bounded and small; the correctness guarantee comes from the load event
  // and the <nav> assertion below, not from this.
  await sleep(500)

  const { result } = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const w = document.documentElement.clientWidth;
      const navFound = !!document.querySelector('nav');
      const bad = [...document.querySelectorAll('*')].filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && (r.right > w + 0.5 || r.left < -0.5);
      }).map(el => el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ').slice(0,2).join('.') : ''));
      return { width: w, scrollWidth: document.documentElement.scrollWidth, navFound, count: bad.length, offenders: bad.slice(0, 10) };
    })()`,
  })

  const r = result.value
  console.log(JSON.stringify(r, null, 2))

  if (!r.navFound) {
    console.error(
      'FAIL: no <nav> element found on the page. The page did not render the shell ' +
        '(navigation may have failed or landed on a blank/error page), so a zero ' +
        'overflow count here would be meaningless.',
    )
    process.exitCode = 1
  } else if (r.count > 0 || r.scrollWidth > r.width + 0.5) {
    console.error(`FAIL: ${r.count} overflowing elements at 390px`)
    process.exitCode = 1
  } else {
    console.log('PASS: no horizontal overflow at 390x844')
  }
} catch (error) {
  console.error(`FAIL: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
} finally {
  ws?.close()
  chrome.kill()
}
