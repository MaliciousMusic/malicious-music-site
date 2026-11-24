// Petit pilote Chrome sans dépendance (Node 22+, google-chrome installé). Aucun accès réseau hors localhost.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function chrome() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mm-chrome-"));
  const p = spawn(process.env.CHROME || "google-chrome", ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${dir}`,
    "--no-first-run", "--disable-background-networking", "--mute-audio", "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1", "about:blank"],
    { stdio: ["ignore", "ignore", "pipe"] });
  const ws = await new Promise((ok, ko) => { let b = ""; p.on("error", ko); p.stderr.on("data", (d) => { b += d; const m = b.match(/ws:\/\/\S+/); if (m) ok(m[0]); }); });
  const s = new WebSocket(ws);
  await new Promise((r) => (s.onopen = r));
  let id = 0;
  const wait = new Map(), subs = [];
  s.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (!m.id) return subs.forEach((f) => f(m));
    const w = wait.get(m.id); wait.delete(m.id);
    m.error ? w[1](new Error(JSON.stringify(m.error))) : w[0](m.result);
  };
  const send = (method, params = {}, sessionId) => new Promise((a, b) => { const i = ++id; wait.set(i, [a, b]); s.send(JSON.stringify({ id: i, method, params, sessionId })); });
  return {
    async page({ js = true, w = 1280, h = 800, mobile = false, reduce = false, lang = "fr-FR" } = {}) {
      const { browserContextId } = await send("Target.createBrowserContext");
      const { targetId } = await send("Target.createTarget", { url: "about:blank", browserContextId });
      const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
      const c = (m, q) => send(m, q, sessionId);
      const log = [], req = [];
      subs.push((m) => {
        if (m.sessionId !== sessionId) return;
        if (m.method === "Runtime.exceptionThrown") log.push("EXC " + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
        if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") log.push("ERR " + m.params.args.map((a) => a.value || a.description).join(" "));
        if (m.method === "Log.entryAdded" && m.params.entry.level === "error") log.push("LOG " + m.params.entry.text + " " + (m.params.entry.url || ""));
        if (m.method === "Network.requestWillBeSent") req.push(m.params.request.method + " " + m.params.request.url);
      });
      for (const d of ["Page", "Runtime", "Network", "Log"]) await c(d + ".enable");
      await c("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile });
      if (mobile) await c("Emulation.setTouchEmulationEnabled", { enabled: true });
      if (reduce) await c("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
      if (!js) await c("Emulation.setScriptExecutionDisabled", { value: true });
      await c("Emulation.setUserAgentOverride", { userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36", acceptLanguage: lang });
      return {
        c, log, req,
        async goto(u, ms = 4000) { await c("Page.navigate", { url: u }); await sleep(ms); },
        async ev(x) {
          const r = await c("Runtime.evaluate", { expression: x, awaitPromise: true, returnByValue: true });
          if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description);
          return r.result.value;
        },
        async key(key, code = key, vk = 9) { for (const type of ["keyDown", "keyUp"]) await c("Input.dispatchKeyEvent", { type, key, code, windowsVirtualKeyCode: vk }); },
        async shot(f) { fs.writeFileSync(f, Buffer.from((await c("Page.captureScreenshot", { format: "png" })).data, "base64")); },
      };
    },
    close() { s.close(); p.kill(); p.on("exit", () => fs.rmSync(dir, { recursive: true, force: true })); },
  };
}
