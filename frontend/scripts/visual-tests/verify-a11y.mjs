/**
 * Проверка §7: фокус — outline 2px с отступом 3px, плюс prefers-reduced-motion.
 *
 * Проверяем настоящим Tab (а не el.focus()), потому что :focus-visible
 * применяется по модальности последнего ввода.
 *
 * ВАЖНО: shadcn/Radix перезаписывают data-slot внутри FormControl/DialogTrigger —
 * у Input он становится 'form-control', у Button внутри DialogTrigger —
 * 'dialog-trigger'. Для тестов надёжнее искать по [data-size],
 * чем по [data-slot='button'].
 *
 * Запуск: node frontend/scripts/visual-tests/verify-a11y.mjs
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

const CDP = "http://127.0.0.1:9345";
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

/** Замер фокуса у текущего activeElement. */
const FOCUSED = `(()=>{
  const el = document.activeElement;
  if (!el || el === document.body) return JSON.stringify(null);
  const cs = getComputedStyle(el);
  return JSON.stringify({
    tag: el.tagName.toLowerCase(),
    slot: el.dataset?.slot ?? null,
    role: el.getAttribute('role'),
    type: el.getAttribute('type'),
    outlineWidth: cs.outlineWidth,
    outlineOffset: cs.outlineOffset,
    outlineStyle: cs.outlineStyle,
    outlineColor: cs.outlineColor,
    transitionDuration: cs.transitionDuration
  });
})()`;

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

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "ub-a11y-"));
  const chrome = spawn(
    CHROME,
    [
      "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--hide-scrollbars",
      "--remote-debugging-port=9345", `--user-data-dir=${profile}`,
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
    const tab = async (n = 1) => {
      for (let i = 0; i < n; i++) {
        for (const type of ["keyDown", "keyUp"])
          await cdp.send("Input.dispatchKeyEvent", {
            type, key: "Tab", code: "Tab", windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9,
          });
        await sleep(250);
      }
    };
    /** Пройти Tab'ами и собрать замеры фокуса. */
    const walk = async (steps) => {
      const seen = [];
      for (let i = 0; i < steps; i++) {
        await tab(1);
        const f = JSON.parse(await js(FOCUSED));
        if (!f) continue;
        const key = `${f.tag}.${f.slot ?? f.role ?? f.type ?? ""}`;
        if (!seen.some((s) => s.key === key)) seen.push({ key, ...f });
      }
      return seen;
    };
    const assertOutline = (label, arr) => {
      const solid = arr.filter((f) => f.outlineStyle === "solid");
      console.log(
        `   ${label}: ${solid.length} элементов с outline — ` +
          solid.map((f) => `${f.key}[${f.outlineWidth}/${f.outlineOffset}]`).join(", "),
      );
      check(`${label}: есть элементы с фокус-outline`, solid.length > 0, `${solid.length}`);
      check(
        `${label}: у всех outline 2px / offset 3px (§7)`,
        solid.every((f) => f.outlineWidth === "2px" && f.outlineOffset === "3px"),
        JSON.stringify(solid.filter((f) => f.outlineWidth !== "2px" || f.outlineOffset !== "3px").map((f) => `${f.key} ${f.outlineWidth}/${f.outlineOffset}`)),
      );
    };

    // ── A. /login: input и кнопка
    console.log("A. /login — Tab по форме");
    await go(APP + "/");
    await js(`localStorage.clear(); 'ok'`);
    await go(APP + "/login");
    const loginWalk = await walk(6);
    assertOutline("/login", loginWalk);
    check(
      "/login: input и button в фокус-обходе",
      loginWalk.some((f) => f.tag === "input") && loginWalk.some((f) => f.tag === "button"),
      JSON.stringify(loginWalk.map((f) => f.key)),
    );

    // ── B. select-триггер в диалоге
    console.log("B. /charges → диалог: select-триггер");
    await go(APP + "/");
    await js(`localStorage.setItem('utility-bills-auth', ${JSON.stringify(JSON.stringify({
      state: { accessToken: login.access_token, refreshToken: login.refresh_token, user: me },
      version: 0 }))}); 'ok'`);
    await go(APP + "/charges");
    await js(`(()=>{const b=[...document.querySelectorAll('[data-size]')]
      .find(e=>/Новое начисление/.test(e.textContent||'')); if(b) b.click(); return 'ok';})()`);
    await sleep(1400);
    const dlgWalk = await walk(6);
    assertOutline("диалог", dlgWalk);
    check(
      "диалог: select-триггер получил фокус-outline",
      dlgWalk.some((f) => f.slot === "select-trigger" && f.outlineStyle === "solid"),
      JSON.stringify(dlgWalk.map((f) => f.key)),
    );

    // ── C. switch в настройках
    console.log("C. /settings → Уведомления: switch");
    await go(APP + "/settings");
    const tabRect = JSON.parse(
      await js(`(()=>{const el=[...document.querySelectorAll('[role="tab"]')]
        .find(e => e.textContent.trim() === 'Уведомления');
        if(!el) return JSON.stringify(null);
        const r = el.getBoundingClientRect();
        return JSON.stringify({x:r.x+r.width/2, y:r.y+r.height/2});})()`),
    );
    if (tabRect) {
      for (const type of ["mousePressed", "mouseReleased"])
        await cdp.send("Input.dispatchMouseEvent", {
          type, x: tabRect.x, y: tabRect.y, button: "left", buttons: 1, clickCount: 1,
        });
      await sleep(1400);
    }
    const setWalk = await walk(8);
    assertOutline("настройки", setWalk);
    check(
      "настройки: switch получил фокус-outline",
      setWalk.some((f) => f.slot === "switch" && f.outlineStyle === "solid"),
      JSON.stringify(setWalk.map((f) => f.key)),
    );

    // ── D. prefers-reduced-motion
    console.log("D. prefers-reduced-motion");
    await cdp.send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-motion", value: "reduce" }],
    });
    await sleep(500);
    const rm = await js(`(()=>{
      const b = document.querySelector('[data-size="default"], button');
      if (!b) return JSON.stringify(null);
      const cs = getComputedStyle(b);
      return JSON.stringify({
        transitionDuration: cs.transitionDuration,
        animationDuration: cs.animationDuration,
        mediaMatches: window.matchMedia('(prefers-reduced-motion: reduce)').matches
      });
    })()`);
    const rmp = JSON.parse(rm);
    console.log(`   ${JSON.stringify(rmp)}`);
    check("эмуляция reduce активна", rmp.mediaMatches === true, rm);
    const ms = parseFloat(rmp.transitionDuration) * (rmp.transitionDuration.includes("ms") ? 1 : 1000);
    check(
      "transition-duration обнулён (<= 0.01ms)",
      ms <= 0.011,
      rmp.transitionDuration,
    );
    await cdp.send("Emulation.setEmulatedMedia", { features: [] });
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
