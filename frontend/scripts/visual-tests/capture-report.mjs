/**
 * Снимает дашборд в трёх темах как JPEG — эти картинки встраиваются
 * в HTML-отчёт о миграции (base64, чтобы отчёт остался одним файлом).
 *
 * Запуск:  node frontend/scripts/visual-tests/capture-report.mjs
 * Требует: dev-сервер на http://localhost:5173 и бэкенд на http://localhost:18090.
 * Кладёт report-light.jpg / report-comfort.jpg / report-dark.jpg
 * в docs/netvision-shots/ (каталог в .gitignore).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const API = "http://localhost:18090/api/v1";
const APP = "http://localhost:5173";
const DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.UB_SHOTS_DIR
  ? path.resolve(process.env.UB_SHOTS_DIR)
  : path.resolve(DIR, "../../../docs/netvision-shots");
fs.mkdirSync(OUT, { recursive: true });
const CDP = "http://127.0.0.1:9347";
const CHROME = process.env.HOME + "/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Conn {
  constructor(ws) { this.ws = ws; this.id = 0; this.p = new Map();
    ws.addEventListener("message", (e) => { const m = JSON.parse(e.data);
      if (m.id === undefined) return; const q = this.p.get(m.id); if (!q) return;
      this.p.delete(m.id); m.error ? q.reject(new Error(JSON.stringify(m.error))) : q.resolve(m.result); }); }
  static async open(u) { const ws = new WebSocket(u);
    await new Promise((res, rej) => { ws.addEventListener("open", res, { once: true }); ws.addEventListener("error", rej, { once: true }); });
    return new Conn(ws); }
  send(method, params = {}) { const id = ++this.id;
    return new Promise((resolve, reject) => { this.p.set(id, { resolve, reject }); this.ws.send(JSON.stringify({ id, method, params })); }); }
}

const login = await fetch(API + "/auth/login", { method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "netvision-shots@example.com", password: "screenshot-pass-12345" }) }).then((r) => r.json());
const me = await fetch(API + "/auth/me", { headers: { Authorization: `Bearer ${login.access_token}` } }).then((r) => r.json());
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "ub-rep-"));
const chrome = spawn(CHROME, ["--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--hide-scrollbars",
  "--remote-debugging-port=9347", `--user-data-dir=${profile}`, "--window-size=1280,800", "about:blank"], { stdio: "ignore" });
const t0 = Date.now(); let ok = false;
while (Date.now() - t0 < 25000) { try { if ((await fetch(CDP + "/json/version")).ok) { ok = true; break; } } catch {} await sleep(300); }
if (!ok) throw new Error("CDP недоступен");
try {
  const t = await (await fetch(CDP + "/json/new?about:blank", { method: "PUT" })).json();
  const cdp = await Conn.open(t.webSocketDebuggerUrl);
  await cdp.send("Page.enable"); await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  const js = async (e) => (await cdp.send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true })).result.value;
  await cdp.send("Page.navigate", { url: APP + "/" }); await sleep(2600);
  await js(`localStorage.setItem('utility-bills-auth', ${JSON.stringify(JSON.stringify({
    state: { accessToken: login.access_token, refreshToken: login.refresh_token, user: me }, version: 0 }))}); 'ok'`);
  await cdp.send("Page.navigate", { url: APP + "/" }); await sleep(3600);
  for (const th of ["light", "comfort", "dark"]) {
    await js(`document.documentElement.setAttribute('data-theme','${th}'); 'ok'`);
    await sleep(700);
    const s = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 82 });
    const f = path.join(OUT, `report-${th}.jpg`);
    fs.writeFileSync(f, Buffer.from(s.data, "base64"));
    console.log(`  saved ${path.basename(f)}`, Math.round(fs.statSync(f).size / 1024) + "KB");
  }
  cdp.ws.close();
} finally { chrome.kill("SIGKILL"); }
