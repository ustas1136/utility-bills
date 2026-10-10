/**
 * Диагностический зонд: что за элементы на /charges и /login и какой у них размер.
 *
 * ВАЖНО: shadcn/Radix перезаписывают data-slot внутри FormControl/DialogTrigger —
 * у Input он становится 'form-control', у Button внутри DialogTrigger —
 * 'dialog-trigger'. Для тестов надёжнее искать по [data-size],
 * чем по [data-slot='button'].
 *
 * Запуск: node frontend/scripts/visual-tests/probe.mjs (ничего не пишет на диск)
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const API = "http://localhost:18090/api/v1";
const APP = "http://localhost:5173";
const CDP = "http://127.0.0.1:9339";
const CHROME =
  process.env.HOME +
  "/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Conn {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map();
    ws.addEventListener("message", (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id === undefined) return;
      const q = this.pending.get(m.id); if (!q) return;
      this.pending.delete(m.id);
      m.error ? q.reject(new Error(JSON.stringify(m.error))) : q.resolve(m.result);
    });
  }
  static async open(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => {
      ws.addEventListener("open", res, { once: true });
      ws.addEventListener("error", rej, { once: true });
    });
    return new Conn(ws);
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
}

const login = await fetch(API + "/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "netvision-shots@example.com", password: "screenshot-pass-12345" }),
}).then((r) => r.json());
const me = await fetch(API + "/auth/me", {
  headers: { Authorization: `Bearer ${login.access_token}` },
}).then((r) => r.json());

const profile = fs.mkdtempSync(path.join(os.tmpdir(), "ub-probe-"));
const chrome = spawn(CHROME, ["--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--hide-scrollbars",
  `--remote-debugging-port=9339`,`--user-data-dir=${profile}`,"--window-size=1400,1100","about:blank"], { stdio: "ignore" });

const t0 = Date.now();
let ready = false;
while (Date.now() - t0 < 25000) {
  try { if ((await fetch(CDP + "/json/version")).ok) { ready = true; break; } } catch {}
  await sleep(300);
}
if (!ready) throw new Error("CDP недоступен");

try {
  const target = await (await fetch(CDP + "/json/new?about:blank", { method: "PUT" })).json();
  const cdp = await Conn.open(target.webSocketDebuggerUrl);
  await cdp.send("Page.enable"); await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1400, height: 1100, deviceScaleFactor: 1, mobile: false });
  const js = async (e) => {
    const x = await cdp.send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true });
    if (x.exceptionDetails) throw new Error(JSON.stringify(x.exceptionDetails).slice(0, 300));
    return x.result.value;
  };
  const go = async (u, w = 4000) => { await cdp.send("Page.navigate", { url: u }); await sleep(w); };

  await go(APP + "/");
  await js(`localStorage.setItem('utility-bills-auth', ${JSON.stringify(JSON.stringify({
    state: { accessToken: login.access_token, refreshToken: login.refresh_token, user: me }, version: 0 }))});
    localStorage.setItem('utility-bills-theme', JSON.stringify({state:{theme:'light'},version:0})); 'ok'`);

  // ── /login без авторизации
  await go(APP + "/");
  await js(`localStorage.removeItem('utility-bills-auth'); 'ok'`);
  await go(APP + "/login", 5000);
  console.log("=== /login ===");
  console.log(await js(`(()=>{
    const h = e => Math.round(e.getBoundingClientRect().height*100)/100;
    return JSON.stringify({
      url: location.pathname,
      text: document.body.innerText.slice(0,120).replace(/\\n/g,' | '),
      allInputs: [...document.querySelectorAll('input')].map(e => ({
        slot: e.dataset.slot ?? null, type: e.type, h: h(e), cls: (e.className||'').slice(0,60)})),
      slotInputs: document.querySelectorAll('input[data-slot="input"]').length,
      buttons: [...document.querySelectorAll('button')].map(e => ({
        text: (e.textContent||'').trim().slice(0,24), slot: e.dataset.slot ?? null,
        size: e.dataset.size ?? null, h: h(e)}))
    }, null, 1);
  })()`));

  // ── /charges с авторизацией
  await go(APP + "/");
  await js(`localStorage.setItem('utility-bills-auth', ${JSON.stringify(JSON.stringify({
    state: { accessToken: login.access_token, refreshToken: login.refresh_token, user: me }, version: 0 }))}); 'ok'`);
  await go(APP + "/charges", 5000);
  console.log("=== /charges ===");
  console.log(await js(`(()=>{
    const h = e => Math.round(e.getBoundingClientRect().height*100)/100;
    return JSON.stringify({
      url: location.pathname,
      buttons: [...document.querySelectorAll('button, a[role="button"], [data-slot="button"]')].map(e => ({
        tag: e.tagName.toLowerCase(), text: (e.textContent||'').trim().slice(0,26),
        slot: e.dataset.slot ?? null, size: e.dataset.size ?? null, h: h(e),
        cls: (typeof e.className === 'string' ? e.className : '').slice(0,70)}))
    }, null, 1);
  })()`));
} finally {
  chrome.kill("SIGKILL");
}
