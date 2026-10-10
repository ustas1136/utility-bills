/**
 * Проверка deep-link'ов: /charges?new=1, /properties?new=1, /settings?tab=…
 *
 * Идём двумя путями — как пользователь (Ctrl+K → пункт палитры) и напрямую по URL,
 * и проверяем, что диалог открывается, а параметр уходит из адреса при закрытии.
 *
 * ВАЖНО: shadcn/Radix перезаписывают data-slot внутри FormControl/DialogTrigger —
 * у Input он становится 'form-control', у Button внутри DialogTrigger —
 * 'dialog-trigger'. Для тестов надёжнее искать по [data-size],
 * чем по [data-slot='button'].
 *
 * Запуск: node frontend/scripts/visual-tests/verify-deeplinks.mjs
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

const CDP = "http://127.0.0.1:9346";
const EMAIL = "netvision-shots@example.com";
const PASS = "screenshot-pass-12345";
const CHROME =
  process.env.HOME +
  "/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [];
const check = (name, ok, got) => {
  console.log(`  ${ok ? "OK  " : "FAIL"} ${name}${ok ? "" : "  -> " + got}`);
  if (!ok) fails.push(name);
};

class Conn {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener("message", (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id === undefined) return;
      const q = this.pending.get(m.id);
      if (!q) return;
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

const STATE = `JSON.stringify({
  path: location.pathname + location.search,
  dialog: !!document.querySelector('[data-slot="dialog-content"]'),
  dialogTitle: (document.querySelector('[data-slot="dialog-title"]')?.textContent || '').trim(),
  activeTab: (document.querySelector('[role="tab"][aria-selected="true"]')?.textContent || '').trim()
})`;

async function waitChrome(timeout = 25000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try {
      if ((await fetch(CDP + "/json/version")).ok) return;
    } catch {
      /* ждём */
    }
    await sleep(300);
  }
  throw new Error("CDP недоступен на " + CDP);
}

async function main() {
  const login = await fetch(API + "/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  }).then((r) => r.json());
  const me = await fetch(API + "/auth/me", {
    headers: { Authorization: `Bearer ${login.access_token}` },
  }).then((r) => r.json());

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "ub-links-"));
  const chrome = spawn(
    CHROME,
    [
      "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--hide-scrollbars",
      "--remote-debugging-port=9346", `--user-data-dir=${profile}`,
      "--window-size=1440,900", "about:blank",
    ],
    { stdio: "ignore" },
  );

  try {
    await waitChrome();
    const target = await (await fetch(CDP + "/json/new?about:blank", { method: "PUT" })).json();
    const cdp = await Conn.open(target.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    const js = async (expression) => {
      const x = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (x.exceptionDetails) throw new Error(JSON.stringify(x.exceptionDetails).slice(0, 300));
      return x.result.value;
    };
    const go = async (url, wait = 3200) => { await cdp.send("Page.navigate", { url }); await sleep(wait); };
    const key = async (k, code, vk, modifiers = 0) => {
      for (const type of ["keyDown", "keyUp"])
        await cdp.send("Input.dispatchKeyEvent", {
          type, key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers,
        });
      await sleep(350);
    };
    const state = () => js(STATE).then(JSON.parse);

    await go(APP + "/");
    await js(`localStorage.setItem('utility-bills-auth', ${JSON.stringify(JSON.stringify({
      state: { accessToken: login.access_token, refreshToken: login.refresh_token, user: me },
      version: 0 }))});
      localStorage.setItem('utility-bills-theme', JSON.stringify({state:{theme:'light'},version:0})); 'ok'`);

    // ── A. Палитра: /charges → «Новое начисление» (навигация внутри той же страницы)
    console.log("A. Ctrl+K → «Новое начисление» (уже на /charges)");
    await go(APP + "/charges");
    await key("k", "KeyK", 75, 2);
    await cdp.send("Input.insertText", { text: "Новое начисление" });
    await sleep(600);
    await key("Enter", "Enter", 13);
    await sleep(1600);
    let s = await state();
    console.log(`   ${JSON.stringify(s)}`);
    check("диалог «Начисление» открылся из палитры", s.dialog && /Начисление/.test(s.dialogTitle), JSON.stringify(s));
    await key("Escape", "Escape", 27);
    await sleep(700);
    s = await state();
    console.log(`   после Escape: ${JSON.stringify(s)}`);
    check("после закрытия диалог закрыт", !s.dialog, JSON.stringify(s));
    check("после закрытия URL очищен", s.path === "/charges", s.path);

    // ── B. Прямой deep-link: /properties?new=1
    console.log("B. Прямой /properties?new=1");
    await go(APP + "/properties?new=1");
    s = await state();
    console.log(`   ${JSON.stringify(s)}`);
    check("форма объекта открылась по URL", s.dialog, JSON.stringify(s));
    await key("Escape", "Escape", 27);
    await sleep(700);
    s = await state();
    console.log(`   после Escape: ${JSON.stringify(s)}`);
    check("после закрытия URL очищен", s.path === "/properties", s.path);

    // ── C. /settings?tab=notifications
    console.log("C. /settings?tab=notifications");
    await go(APP + "/settings?tab=notifications");
    s = await state();
    console.log(`   ${JSON.stringify(s)}`);
    check("таб «Уведомления» активен по URL", s.activeTab === "Уведомления", JSON.stringify(s));

    // переключение таба
    const tr = JSON.parse(
      await js(`(()=>{const el=[...document.querySelectorAll('[role="tab"]')]
        .find(e => e.textContent.trim() === 'Напоминания');
        if(!el) return JSON.stringify(null);
        const r = el.getBoundingClientRect();
        return JSON.stringify({x:r.x+r.width/2, y:r.y+r.height/2});})()`),
    );
    if (tr) {
      for (const type of ["mousePressed", "mouseReleased"])
        await cdp.send("Input.dispatchMouseEvent", {
          type, x: tr.x, y: tr.y, button: "left", buttons: 1, clickCount: 1,
        });
      await sleep(1200);
    }
    s = await state();
    console.log(`   после переключения: ${JSON.stringify(s)}`);
    check("таб переключился", s.activeTab === "Напоминания", JSON.stringify(s));
    check("таб отражён в URL", s.path === "/settings?tab=reminders", s.path);
    cdp.ws.close();
  } finally {
    chrome.kill("SIGKILL");
  }

  console.log(
    fails.length ? `\nПРОВАЛЕНО (${fails.length}): ${fails.join("; ")}` : "\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ",
  );
  if (fails.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error("ОШИБКА:", e.message);
  process.exitCode = 1;
});
