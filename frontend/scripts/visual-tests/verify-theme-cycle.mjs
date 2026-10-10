/**
 * Проверка шага 3:
 *   1) ⌘⇧L (Ctrl+Shift+L) циклически меняет тему light → comfort → dark → system;
 *   2) пункт «Сменить тему» в палитре команд (Ctrl+K) показывает иконку текущей
 *      темы и название следующей, и тоже идёт по кругу;
 *   3) бейджи на /charges имеют радиус 6px (--radius-option) в light и comfort.
 *
 * Скриншоты складываются в docs/netvision-shots (каталог в .gitignore).
 * Запуск: node frontend/scripts/visual-tests/verify-theme-cycle.mjs
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

const CDP = "http://127.0.0.1:9337";
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
  throw new Error("CDP недоступен на " + CDP);
}

async function main() {
  const login = await fetch(API + "/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  }).then((r) => r.json());
  if (!login.access_token) throw new Error("логин не удался");
  const me = await fetch(API + "/auth/me", {
    headers: { Authorization: `Bearer ${login.access_token}` },
  }).then((r) => r.json());

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "ub-hs3-"));
  const chrome = spawn(
    CHROME,
    [
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--hide-scrollbars",
      "--remote-debugging-port=9337",
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
      if (x.exceptionDetails)
        throw new Error(JSON.stringify(x.exceptionDetails).slice(0, 400));
      return x.result.value;
    };
    const press = async (key, code, vk, modifiers) => {
      for (const type of ["keyDown", "keyUp"])
        await cdp.send("Input.dispatchKeyEvent", {
          type,
          key,
          code,
          windowsVirtualKeyCode: vk,
          nativeVirtualKeyCode: vk,
          modifiers,
        });
      await sleep(350);
    };
    const state = () =>
      js(`JSON.stringify({
        attr: document.documentElement.getAttribute('data-theme'),
        stored: JSON.parse(localStorage.getItem('utility-bills-theme')||'{}').state?.theme ?? null
      })`).then(JSON.parse);
    const setStored = (t) =>
      js(`localStorage.setItem('utility-bills-theme', JSON.stringify({state:{theme:'${t}'},version:0})); 'ok'`);
    const shot = async (name, clip) => {
      const s = await cdp.send(
        "Page.captureScreenshot",
        clip ? { format: "png", clip } : { format: "png" },
      );
      fs.writeFileSync(path.join(OUT, name + ".png"), Buffer.from(s.data, "base64"));
      console.log(`   saved ${name}.png`);
    };
    const paletteItem = () =>
      js(`(()=>{
        const el = [...document.querySelectorAll('[cmdk-item],[role="option"],[role="menuitem"]')]
          .find(e => e.textContent.includes('Переключить'));
        if (!el) return JSON.stringify(null);
        const r = el.getBoundingClientRect();
        return JSON.stringify({text: el.textContent.trim(),
          icon: el.querySelector('svg')?.getAttribute('class') ?? '',
          x: r.x + r.width/2, y: r.y + r.height/2});
      })()`).then(JSON.parse);
    // ── вход в приложение
    await cdp.send("Page.navigate", { url: APP + "/" });
    await sleep(2200);
    await js(
      `localStorage.setItem('utility-bills-auth', ${JSON.stringify(
        JSON.stringify({
          state: {
            accessToken: login.access_token,
            refreshToken: login.refresh_token,
            user: me,
          },
          version: 0,
        }),
      )}); 'ok'`,
    );
    await setStored("light");
    await cdp.send("Page.navigate", { url: APP + "/charges" });
    await sleep(3500);

    // ── 1. цикл по Ctrl+Shift+L
    console.log("1. ⌘⇧L (Ctrl+Shift+L) — цикл тем");
    let s = await state();
    check("старт: store=light", s.stored === "light", JSON.stringify(s));
    const expected = [
      ["comfort", "comfort"],
      ["dark", "dark"],
      ["system", "light"], // system в headless резолвится в light
      ["light", "light"],
    ];
    for (const [wantStored, wantAttr] of expected) {
      await press("L", "KeyL", 76, 10); // Ctrl(2)+Shift(8)
      s = await state();
      check(
        `после нажатия: store=${wantStored}, data-theme=${wantAttr}`,
        s.stored === wantStored && s.attr === wantAttr,
        JSON.stringify(s),
      );
    }

    // ── 2. цикл через палитру команд
    console.log("2. Ctrl+K → «Сменить тему»");
    const steps = [
      ["comfort", "sun", "Переключить на комфортную"],
      ["dark", "palette", "Переключить на тёмную"],
      ["system", "moon", "Переключить на системную"],
    ];
    for (const [wantStore, wantIcon, wantText] of steps) {
      const before = await state();
      await press("k", "KeyK", 75, 2); // Ctrl+K
      await sleep(500);
      // Фильтруем список, как это сделал бы пользователь, и подтверждаем Enter.
      await cdp.send("Input.insertText", { text: "Переключить" });
      await sleep(500);
      const item = await paletteItem();
      check(
        `store=${before.stored}: подпись «${wantText}»`,
        (item?.text ?? "").startsWith(wantText),
        JSON.stringify(item),
      );
      check(
        `store=${before.stored}: иконка текущей темы «${wantIcon}»`,
        (item?.icon ?? "").includes(wantIcon),
        item?.icon,
      );
      if (!item) break;
      await press("Enter", "Enter", 13, 0);
      await sleep(400);
      s = await state();
      check(
        `переход в store=${wantStore}`,
        s.stored === wantStore,
        JSON.stringify(s),
      );
      if (s.stored !== wantStore) break;
    }
    // Escape — тема не меняется
    await press("k", "KeyK", 75, 2);
    await sleep(400);
    await press("Escape", "Escape", 27, 0);
    await sleep(300);
    s = await state();
    check("Escape не меняет тему", s.stored === "system", JSON.stringify(s));

    // ── 3. радиус бейджей + скриншоты
    console.log("3. Бейджи /charges: радиус 6px, скриншоты");
    for (const th of ["light", "comfort"]) {
      await setStored(th);
      await cdp.send("Page.reload");
      await sleep(3200);
      const info = JSON.parse(
        await js(`JSON.stringify([...document.querySelectorAll('[data-slot="badge"]')]
          .map(e=>{const r=e.getBoundingClientRect();const c=getComputedStyle(e);
            return {t:e.textContent.trim(), radius:c.borderRadius, bg:c.backgroundColor, fg:c.color,
                    x:r.x,y:r.y,w:r.width,h:r.height};}))`),
      );
      const radii = [...new Set(info.map((b) => b.radius))];
      check(
        `${th}: радиус бейджей 6px (${info.length} шт.)`,
        radii.length === 1 && radii[0] === "6px",
        JSON.stringify(radii),
      );
      console.log(
        "   " + info.map((b) => `${b.t}[${b.bg}/${b.fg}]`).join("  "),
      );
      await shot(`charges-${th}`);
      if (info.length) {
        const pad = 18;
        const x = Math.min(...info.map((b) => b.x)) - pad;
        const y = Math.min(...info.map((b) => b.y)) - pad;
        const w = Math.max(...info.map((b) => b.x + b.w)) + pad - x;
        const h = Math.max(...info.map((b) => b.y + b.h)) + pad - y;
        await shot(`badges-${th}`, { x, y, width: w, height: h, scale: 3 });
      }
    }
    await setStored("light");
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
