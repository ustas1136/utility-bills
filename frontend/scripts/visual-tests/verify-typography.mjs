/**
 * Проверка шага 7 — шрифт system-ui и заголовки 32/28px (Netvision §3).
 *
 *  1) h1 на /, /properties, /charges, /settings: 32px на десктопе, 28px на 390px;
 *  2) шрифт body — системный стек, Inter не используется;
 *  3) поле поиска в палитре Ctrl+K после смены шрифта: 44px, без обрезки,
 *     иконка по центру (Netvision §4);
 *  4) скриншоты: дашборд light, дашборд dark, мобильный вид.
 *
 * ВАЖНО: shadcn/Radix перезаписывают data-slot внутри FormControl/DialogTrigger —
 * у Input он становится 'form-control', у Button внутри DialogTrigger —
 * 'dialog-trigger'. Для тестов надёжнее искать по [data-size],
 * чем по [data-slot='button'].
 *
 * Запуск: node frontend/scripts/visual-tests/verify-typography.mjs
 * Скриншоты пишутся в docs/netvision-shots (каталог в .gitignore).
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

const CDP = "http://127.0.0.1:9342";
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

const HEADING = `(()=>{
  const h = document.querySelector('h1');
  const b = getComputedStyle(document.body);
  if (!h) return JSON.stringify({body: b.fontFamily, h1: null});
  const cs = getComputedStyle(h);
  const r = h.getBoundingClientRect();
  return JSON.stringify({
    body: b.fontFamily,
    text: (h.textContent||'').trim().slice(0, 30),
    fontSize: cs.fontSize,
    lineHeight: cs.lineHeight,
    fontWeight: cs.fontWeight,
    height: Math.round(r.height*100)/100,
    overflowsViewport: r.right > window.innerWidth + 1
  });
})()`;

const PALETTE = `(()=>{
  const i = document.querySelector('[cmdk-input]');
  const w = document.querySelector('[cmdk-input-wrapper]');
  const svg = w ? w.querySelector('svg') : null;
  if (!i) return JSON.stringify(null);
  const ir = i.getBoundingClientRect();
  const sr = svg ? svg.getBoundingClientRect() : null;
  return JSON.stringify({
    inputH: Math.round(ir.height*100)/100,
    clientH: i.clientHeight,
    scrollH: i.scrollHeight,
    iconDelta: sr ? Math.round(((sr.top + sr.height/2) - (ir.top + ir.height/2))*100)/100 : null,
    fontFamily: getComputedStyle(i).fontFamily
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
  if (!login.access_token) throw new Error("логин не удался");
  const me = await fetch(API + "/auth/me", {
    headers: { Authorization: `Bearer ${login.access_token}` },
  }).then((r) => r.json());

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "ub-hs7-"));
  const chrome = spawn(
    CHROME,
    [
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--hide-scrollbars",
      "--remote-debugging-port=9342",
      `--user-data-dir=${profile}`,
      "--window-size=1400,1100",
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
    const viewport = async (width, height, scale, mobile) => {
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width,
        height,
        deviceScaleFactor: scale,
        mobile,
      });
      await sleep(600);
    };
    const go = async (url, wait = 3000) => {
      await cdp.send("Page.navigate", { url });
      await sleep(wait);
    };
    const shot = async (name) => {
      const s = await cdp.send("Page.captureScreenshot", { format: "png" });
      fs.writeFileSync(path.join(OUT, name + ".png"), Buffer.from(s.data, "base64"));
      console.log(`   saved ${name}.png`);
    };
    const theme = async (t) => {
      await js(`document.documentElement.setAttribute('data-theme','${t}'); 'ok'`);
      await sleep(400);
    };

    await viewport(1400, 1100, 2, false);
    await go(APP + "/");
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
      )});
       localStorage.setItem('utility-bills-theme', JSON.stringify({state:{theme:'light'},version:0})); 'ok'`,
    );

    // ── 1. заголовки на десктопе
    console.log("1. H1 на десктопе (1400px) — ожидание 32px / line-height 40px");
    let bodyFont = null;
    for (const p of ["/", "/properties", "/charges", "/settings"]) {
      await go(APP + p);
      const h = JSON.parse(await js(HEADING));
      bodyFont = h.body;
      console.log(
        `   ${p}: «${h.text}» ${h.fontSize}/${h.lineHeight}, вес ${h.fontWeight}, высота ${h.height}px`,
      );
      check(
        `${p}: H1 = 32px (§3)`,
        h.fontSize === "32px",
        h.fontSize,
      );
      check(
        `${p}: line-height 40px`,
        h.lineHeight === "40px",
        h.lineHeight,
      );
      check(`${p}: вес 600`, h.fontWeight === "600", h.fontWeight);
    }
    console.log(`   font-family body: ${bodyFont}`);
    check(
      "шрифт body — системный стек (без Inter)",
      !/inter/i.test(bodyFont ?? ""),
      bodyFont,
    );

    // ── 2. скриншоты дашборда
    console.log("2. Скриншоты дашборда");
    await go(APP + "/");
    await theme("light");
    await shot("dashboard-light");
    await theme("dark");
    await shot("dashboard-dark");
    await theme("light");

    // ── 3. палитра после смены шрифта
    console.log("3. Поле поиска в палитре Ctrl+K (§4)");
    for (const th of ["light", "dark"]) {
      await theme(th);
      for (const type of ["keyDown", "keyUp"])
        await cdp.send("Input.dispatchKeyEvent", {
          type,
          key: "k",
          code: "KeyK",
          windowsVirtualKeyCode: 75,
          nativeVirtualKeyCode: 75,
          modifiers: 2,
        });
      await sleep(900);
      const p = JSON.parse(await js(PALETTE));
      if (!p) {
        check(`${th}: палитра открылась`, false, "нет [cmdk-input]");
        continue;
      }
      console.log(`   ${th}: ${JSON.stringify(p)}`);
      check(`${th}: поле поиска 44px`, p.inputH === 44, p.inputH);
      check(
        `${th}: текст не обрезан после смены шрифта`,
        p.scrollH <= p.clientH,
        `client=${p.clientH} scroll=${p.scrollH}`,
      );
      check(
        `${th}: иконка по центру (Δ<=1px)`,
        p.iconDelta !== null && Math.abs(p.iconDelta) <= 1,
        `Δ=${p.iconDelta}`,
      );
      for (const type of ["keyDown", "keyUp"])
        await cdp.send("Input.dispatchKeyEvent", {
          type,
          key: "Escape",
          code: "Escape",
          windowsVirtualKeyCode: 27,
          nativeVirtualKeyCode: 27,
        });
      await sleep(500);
    }

    // ── 4. мобильный вид 390x844
    console.log("4. Мобильный вид (390x844, как iPhone 12 Pro)");
    await viewport(390, 844, 3, true);
    for (const [p, name] of [
      ["/", "mobile-dashboard"],
      ["/charges", "mobile-charges"],
    ]) {
      await go(APP + p, 3500);
      const h = JSON.parse(await js(HEADING));
      console.log(
        `   ${p}: «${h.text}» ${h.fontSize}/${h.lineHeight}, высота ${h.height}px, переполнение: ${h.overflowsViewport}`,
      );
      check(`${p}: H1 = 28px на узком окне (§3)`, h.fontSize === "28px", h.fontSize);
      check(`${p}: line-height 36px`, h.lineHeight === "36px", h.lineHeight);
      check(
        `${p}: заголовок не выходит за экран`,
        h.overflowsViewport === false,
        JSON.stringify(h),
      );
      await shot(name);
    }
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
