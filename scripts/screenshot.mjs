// Screenshot a page of the admin panel, signed in.
//
// Headless Chrome's --screenshot flag cannot click, so it cannot get past the
// login form, and the session cookie is httpOnly so a page script cannot set
// one either. This drives Chrome over the DevTools Protocol instead and sets
// the cookie directly. Node 22 has a global WebSocket, so there is nothing to
// install.
//
//   chrome --headless --remote-debugging-port=9222 --user-data-dir=/tmp/x &
//   TOKEN=$(curl -s -X POST localhost:5173/v1/auth/login \
//     -H 'Content-Type: application/json' -H 'Origin: http://localhost:5173' \
//     -d '{"email":"...","password":"..."}' | jq -r .token)
//   node scripts/screenshot.mjs http://localhost:5173/admin/properties "$TOKEN" out.png
import { writeFileSync } from "node:fs";

const [, , url, cookieValue, out, widthArg, themeArg, maxHeightArg] = process.argv;
if (!url || !out) {
  console.error("usage: shot.mjs <url> <session-cookie-value|-> <out.png> [width] [light|dark]");
  process.exit(1);
}

const list = await (await fetch("http://127.0.0.1:9222/json/list")).json();
const page = list.find((t) => t.type === "page");
if (!page) throw new Error("no page target; is Chrome running with --remote-debugging-port=9222?");

const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const msgId = ++id;
    pending.set(msgId, { resolve, reject });
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });

ws.addEventListener("message", (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(JSON.stringify(msg.error)));
    else resolve(msg.result);
  }
});

await new Promise((r) => ws.addEventListener("open", r, { once: true }));

await send("Network.enable");
await send("Page.enable");
// "-" means signed out, and must actually mean it: this browser keeps its
// profile between runs, so a session cookie from an earlier capture would
// quietly redirect a sign-in page to the panel and the screenshot would show
// the opposite of what was asked for.
if (!cookieValue || cookieValue === "-") {
  await send("Network.clearBrowserCookies");
}
if (cookieValue && cookieValue !== "-") {
  const { origin } = new URL(url);
  await send("Network.setCookie", {
    name: "nilami_session",
    value: cookieValue,
    url: origin,
    path: "/",
    httpOnly: true,
  });
}
// The ground is a cookie the server reads, so a theme can be captured without
// a click — and the admin app reads the same one through the data-theme the
// server writes into its index.html.
if (themeArg === "light" || themeArg === "dark") {
  await send("Network.setCookie", {
    name: "theme",
    value: themeArg,
    url: new URL(url).origin,
    path: "/",
  });
}
// A width can be passed to check a layout at phone size; the viewport is
// overridden here rather than by sizing the browser window, because headless
// Chrome ignores --window-size once a page has its own metrics override.
const width = Number(widthArg) || 1280;
await send("Emulation.setDeviceMetricsOverride", {
  width,
  height: 900,
  deviceScaleFactor: 1,
  mobile: width < 768,
});
await send("Page.navigate", { url });
// Let the SPA mount and its queries resolve.
// Wait for the pictures, not just the markup.
//
// A fixed pause caught these pages before their photographs arrived from the
// CDN, which made a working register look like one with no covers. Poll the
// document's own images instead, and keep the timeout as the floor rather
// than the measure.
await send("Runtime.evaluate", {
  awaitPromise: true,
  expression: `new Promise((done) => {
    const ready = () => [...document.images].every((i) => i.complete);
    const deadline = Date.now() + 8000;
    (function poll() {
      if (ready() || Date.now() > deadline) return done(true);
      setTimeout(poll, 150);
    })();
  })`,
});
await new Promise((r) => setTimeout(r, 600));
// Capture the whole document, not just the first screen.
//
// A fixed 900px viewport meant anything below the fold — which is most of a
// long page — could not be reviewed without scrolling by hand, and a section
// that renders only further down looked absent.
// Back to the top before measuring and shooting.
//
// Waiting on the images runs script in the page and the browser keeps its
// scroll position across a navigation, so a full-page clip taken from where
// the viewport happened to be starts partway down and silently omits
// everything above it — a header and a hero can simply be missing from a
// screenshot that otherwise looks like the whole page.
await send("Runtime.evaluate", { expression: "window.scrollTo(0, 0)" });
const { cssContentSize } = await send("Page.getLayoutMetrics");
const full = cssContentSize
  ? {
      x: 0,
      y: 0,
      width: cssContentSize.width,
      // A cap, for looking at the top of a long page: cropping the PNG
      // afterwards is what sips does from the centre, which has twice now
      // shown the middle of a page while being asked for its head.
      height: Math.min(cssContentSize.height, Number(maxHeightArg) || 20000),
      scale: 1,
    }
  : undefined;
const { data } = await send("Page.captureScreenshot", {
  format: "png",
  captureBeyondViewport: true,
  ...(full ? { clip: full } : {}),
});
writeFileSync(out, Buffer.from(data, "base64"));
console.log("captured", out);
ws.close();
process.exit(0);
