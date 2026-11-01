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

const [, , url, cookieValue, out] = process.argv;
if (!url || !out) {
  console.error("usage: shot.mjs <url> <session-cookie-value|-> <out.png>");
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
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
  }
});

await new Promise((r) => ws.addEventListener("open", r, { once: true }));

await send("Network.enable");
await send("Page.enable");
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
await send("Emulation.setDeviceMetricsOverride", {
  width: 1280, height: 900, deviceScaleFactor: 1, mobile: false,
});
await send("Page.navigate", { url });
// Let the SPA mount and its queries resolve.
await new Promise((r) => setTimeout(r, 2500));
const { data } = await send("Page.captureScreenshot", { format: "png" });
writeFileSync(out, Buffer.from(data, "base64"));
console.log("captured", out);
ws.close();
process.exit(0);
