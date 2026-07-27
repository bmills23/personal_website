/**
 * Drives Chrome over CDP at a TRUE mobile viewport. Do not replace this with
 * a narrow window: headless Chrome enforces a ~500px minimum layout viewport
 * and reports overflow that does not exist on a real phone.
 */
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const URL_TO_CHECK = process.env.CHECK_URL ?? 'http://localhost:3000'
const PORT = 9222
const CHROME =
  process.env.CHROME_PATH ??
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`,
  '--headless=new',
  '--no-first-run',
  '--user-data-dir=/tmp/cdp-mobile-check',
])

try {
  await sleep(1500)
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
  const page = targets.find((t) => t.type === 'page')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((r) => (ws.onopen = r))

  let id = 0
  const pending = new Map()
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data)
    if (pending.has(msg.id)) {
      pending.get(msg.id)(msg.result)
      pending.delete(msg.id)
    }
  }
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const msgId = ++id
      pending.set(msgId, resolve)
      ws.send(JSON.stringify({ id: msgId, method, params }))
    })

  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  })
  await send('Page.enable')
  await send('Page.navigate', { url: URL_TO_CHECK })
  await sleep(3000)

  const { result } = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const w = document.documentElement.clientWidth;
      const bad = [...document.querySelectorAll('*')].filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && (r.right > w + 0.5 || r.left < -0.5);
      }).map(el => el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ').slice(0,2).join('.') : ''));
      return { width: w, scrollWidth: document.documentElement.scrollWidth, count: bad.length, offenders: bad.slice(0, 10) };
    })()`,
  })

  const r = result.value
  console.log(JSON.stringify(r, null, 2))
  ws.close()

  if (r.count > 0 || r.scrollWidth > r.width + 0.5) {
    console.error(`FAIL: ${r.count} overflowing elements at 390px`)
    process.exit(1)
  }
  console.log('PASS: no horizontal overflow at 390x844')
} finally {
  chrome.kill()
}
