/**
 * Функциональная проверка пункта «Комфортная» в переключателе тем:
 * открывает меню с клавиатуры, выбирает «Комфортная», проверяет,
 * что тема применилась, сохранилась и пережила перезагрузку.
 *
 * Запуск: node frontend/scripts/visual-tests/verify-toggle.mjs
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const API = "http://localhost:18090/api/v1";
const APP = "http://localhost:5173";
const DIR = path.dirname(fileURLToPath(import.meta.url));
/** Куда складывать PNG (каталог в .gitignore). Переопределяется UB_SHOTS_DIR. */
const OUT = process.env.UB_SHOTS_DIR
  ? path.resolve(process.env.UB_SHOTS_DIR)
  : path.resolve(DIR, "../../../docs/netvision-shots");
fs.mkdirSync(OUT, { recursive: true });
const CDP = "http://127.0.0.1:9336";
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
  throw new Error("CDP недоступен");
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

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "ub-hs2-"));
  const chrome = spawn(
    CHROME,
    [
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--hide-scrollbars",
      `--remote-debugging-port=9336`,
      `--user-data-dir=${profile}`,
      "--window-size=1400,1000",
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  try {
    await waitChrome();
    const target = await (
      await fetch(CDP + "/json/new?about:blank", { method: "PUT" })
    ).json();
    const cdp = await Conn.open(target.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1400,
      height: 1000,
      deviceScaleFactor: 2,
      mobile: false,
    });
    const js = async (expression) => {
      const x = await cdp.send("Runtime.evaluate", {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      if (x.exceptionDetails) throw new Error(JSON.stringify(x.exceptionDetails));
      return x.result.value;
    };
    const key = async (k, code, vk) => {
      for (const type of ["keyDown", "keyUp"])
        await cdp.send("Input.dispatchKeyEvent", {
          type,
          key: k,
          code,
          windowsVirtualKeyCode: vk,
          nativeVirtualKeyCode: vk,
        });
      await sleep(350);
    };
    const theme = () =>
      js(`JSON.stringify({
        attr: document.documentElement.getAttribute('data-theme'),
        stored: JSON.parse(localStorage.getItem('utility-bills-theme')||'{}').state?.theme ?? null,
        colorScheme: getComputedStyle(document.documentElement).colorScheme,
        bg: getComputedStyle(document.body).backgroundColor
      })`).then(JSON.parse);

    await cdp.send("Page.navigate", { url: APP + "/" });
    await sleep(2200);
    const auth = JSON.stringify({
      state: { accessToken: login.access_token, refreshToken: login.refresh_token, user: me },
      version: 0,
    });
    await js(
      `localStorage.setItem('utility-bills-auth', ${JSON.stringify(auth)});
       localStorage.setItem('utility-bills-theme', JSON.stringify({state:{theme:'light'},version:0})); 'ok'`,
    );
    await cdp.send("Page.navigate", { url: APP + "/charges" });
    await sleep(3500);

    console.log("Проверка переключателя тем:");
    let t = await theme();
    check("стартовая тема light", t.attr === "light", JSON.stringify(t));

    await js(
      `(()=>{const b=document.querySelector('[aria-label="Сменить тему"]');b.focus();return true;})()`,
    );
    await key("Enter", "Enter", 13);
    const items = JSON.parse(
      await js(
        `JSON.stringify([...document.querySelectorAll('[role="menuitem"]')].map(e=>e.textContent.trim()))`,
      ),
    );
    check(
      "в меню 4 пункта в нужном порядке",
      items.length === 4 &&
        items[0].startsWith("Светлая") &&
        items[1].startsWith("Комфортная") &&
        items[2].startsWith("Тёмная") &&
        items[3].startsWith("Системная"),
      JSON.stringify(items),
    );

    // Enter открыл меню и сфокусировал первый пункт -> ArrowDown на «Комфортная»
    await key("ArrowDown", "ArrowDown", 40);
    const active = await js(
      `document.activeElement.textContent.trim()`,
    );
    check("фокус на «Комфортная»", active.startsWith("Комфортная"), active);

    const menuShot = await cdp.send("Page.captureScreenshot", {
      format: "png",
      clip: { x: 1180, y: 40, width: 220, height: 240, scale: 3 },
    });
    fs.writeFileSync(
      path.join(OUT, "theme-menu-comfort-active.png"),
      Buffer.from(menuShot.data, "base64"),
    );

    await key("Enter", "Enter", 13);
    await sleep(600);
    t = await theme();
    check("data-theme переключился на comfort", t.attr === "comfort", JSON.stringify(t));
    check("тема сохранена в localStorage", t.stored === "comfort", JSON.stringify(t));
    check("color-scheme=light для comfort", t.colorScheme === "light", t.colorScheme);
    check("фон тёплый (#e9e5da)", t.bg === "rgb(233, 229, 218)", t.bg);

    await cdp.send("Page.reload");
    await sleep(3500);
    t = await theme();
    check("comfort пережил перезагрузку", t.attr === "comfort", JSON.stringify(t));

    await js(
      `(()=>{const b=document.querySelector('[aria-label="Сменить тему"]');b.focus();return true;})()`,
    );
    await key("Enter", "Enter", 13);
    const after = JSON.parse(
      await js(
        `JSON.stringify([...document.querySelectorAll('[role="menuitem"]')]
          .map(e=>({t:e.textContent.trim(), checked:e.textContent.includes('✓')})))`,
      ),
    );
    check(
      "галочка стоит на «Комфортная»",
      after[1]?.checked === true && after[0]?.checked === false,
      JSON.stringify(after),
    );
    const menu2 = await cdp.send("Page.captureScreenshot", {
      format: "png",
      clip: { x: 1180, y: 40, width: 220, height: 240, scale: 3 },
    });
    fs.writeFileSync(
      path.join(OUT, "theme-menu-checked.png"),
      Buffer.from(menu2.data, "base64"),
    );

    // возвращаем light, чтобы не оставлять за собой сохранённую comfort
    await js(
      `localStorage.setItem('utility-bills-theme', JSON.stringify({state:{theme:'light'},version:0})); 'ok'`,
    );
    cdp.ws.close();
  } finally {
    chrome.kill("SIGKILL");
  }

  console.log(fails.length ? `\nПРОВАЛЕНО: ${fails.join(", ")}` : "\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ");
  if (fails.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error("ОШИБКА:", e.message);
  process.exitCode = 1;
});
