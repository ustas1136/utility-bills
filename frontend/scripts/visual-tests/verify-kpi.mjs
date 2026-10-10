/**
 * Проверка шага 8 — KPI-числа 32/28px и tabular-nums (Netvision §3).
 *
 * Проверяет /charges/:id, /meters/:id и дашборд: числа 32px на десктопе,
 * 28px на 390px, с tabular-nums. Скриншоты детальной страницы в light и dark.
 *
 * ВАЖНО: shadcn/Radix перезаписывают data-slot внутри FormControl/DialogTrigger —
 * у Input он становится 'form-control', у Button внутри DialogTrigger —
 * 'dialog-trigger'. Для тестов надёжнее искать по [data-size],
 * чем по [data-slot='button'].
 *
 * Запуск: node frontend/scripts/visual-tests/verify-kpi.mjs
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

const CDP = "http://127.0.0.1:9343";
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

/** Все KPI-числа страницы: ищем по классу с arbitrary-значением размера.
 *  Только div/span — иначе в выборку попадает H1 с тем же классом размера. */
const KPI = `(()=>{
  const els = [...document.querySelectorAll(
    'div[class*="sm:text-[2rem]"], span[class*="sm:text-[2rem]"]')];
  return JSON.stringify(els.map(e => {
    const cs = getComputedStyle(e);
    return {
      tag: e.tagName.toLowerCase(),
      text: (e.textContent||'').trim().slice(0, 20),
      fontSize: cs.fontSize,
      lineHeight: cs.lineHeight,
      fontWeight: cs.fontWeight,
      tabular: getComputedStyle(e).fontVariantNumeric,
      hasTabularClass: e.className.includes('tabular-nums'),
      clientW: Math.round(e.clientWidth),
      scrollW: Math.round(e.scrollWidth),
      truncated: e.scrollWidth > e.clientWidth + 1
    };
  }));
})()`;

/** Иконки StatCard: контейнер с rounded-lg/p-2.5 + подпись карточки. */
const TONES_PROBE = `(()=>{
  const icons = [...document.querySelectorAll('div')].filter(e =>
    typeof e.className === 'string' &&
    e.className.includes('rounded-lg') && e.className.includes('p-2.5'));
  return JSON.stringify(icons.map(e => {
    const card = e.closest('div.rounded-xl');
    const cs = getComputedStyle(e);
    return {
      label: card ? (card.textContent || '').trim().slice(0, 24) : '',
      bg: cs.backgroundColor,
      fg: cs.color
    };
  }));
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
  const auth = { Authorization: "" };
  const login = await fetch(API + "/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  }).then((r) => r.json());
  if (!login.access_token) throw new Error("логин не удался");
  auth.Authorization = `Bearer ${login.access_token}`;
  const me = await fetch(API + "/auth/me", { headers: auth }).then((r) => r.json());

  // ── готовим данные: начисление и счётчик
  const charges = await fetch(API + "/charges", { headers: auth }).then((r) => r.json());
  const chargeId = charges?.[0]?.id;
  if (!chargeId) throw new Error("нет начислений для /charges/:id");
  const props = await fetch(API + "/properties", { headers: auth }).then((r) => r.json());
  const pid = props?.[0]?.id;
  const svcs = await fetch(`${API}/properties/${pid}/services`, { headers: auth }).then((r) =>
    r.json(),
  );
  const psId = svcs?.[0]?.id;
  let meters = await fetch(`${API}/property-services/${psId}/meters`, { headers: auth }).then((r) =>
    r.json(),
  );
  if (!meters?.length) {
    const res = await fetch(API + "/meters", {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        property_service_id: psId,
        serial_number: "NV-TEST-001",
        unit: "кВт·ч",
      }),
    });
    console.log(`   + счётчик: HTTP ${res.status}`);
    meters = await fetch(`${API}/property-services/${psId}/meters`, { headers: auth }).then((r) =>
      r.json(),
    );
  }
  const meterId = meters?.[0]?.id;
  console.log(
    `   данные: начисление #${chargeId}, счётчик #${meterId} (услуга #${psId})`,
  );

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "ub-hs8-"));
  const chrome = spawn(
    CHROME,
    [
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--hide-scrollbars",
      "--remote-debugging-port=9343",
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
    const go = async (url, wait = 3200) => {
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

    // ── 1. десктоп
    console.log("1. KPI на десктопе (1400px) — ожидание 32px / 40px");
    const pages = [
      [`/charges/${chargeId}`, 3, "детальная начисления"],
      [`/meters/${meterId}`, 3, "детальная счётчика"],
      ["/", 4, "дашборд"],
    ];
    for (const [url, expected, label] of pages) {
      await go(APP + url);
      const kpis = JSON.parse(await js(KPI));
      console.log(
        `   ${url} (${label}): ${kpis.length} чисел — ${kpis.map((k) => `${k.text}:${k.fontSize}/${k.lineHeight}`).join(", ")}`,
      );
      check(
        `${url}: найдено ${expected} KPI-числа`,
        kpis.length === expected,
        `найдено ${kpis.length}`,
      );
      check(
        `${url}: все KPI = 32px`,
        kpis.length > 0 && kpis.every((k) => k.fontSize === "32px"),
        JSON.stringify([...new Set(kpis.map((k) => k.fontSize))]),
      );
      check(
        `${url}: line-height 40px`,
        kpis.every((k) => k.lineHeight === "40px"),
        JSON.stringify([...new Set(kpis.map((k) => k.lineHeight))]),
      );
      check(
        `${url}: вес 600`,
        kpis.every((k) => k.fontWeight === "600"),
        JSON.stringify([...new Set(kpis.map((k) => k.fontWeight))]),
      );
      check(
        `${url}: tabular-nums (§3)`,
        kpis.every((k) => k.hasTabularClass),
        JSON.stringify(kpis.map((k) => k.hasTabularClass)),
      );
      check(
        `${url}: числа не обрезаны`,
        kpis.every((k) => !k.truncated),
        JSON.stringify(
          kpis.filter((k) => k.truncated).map((k) => `${k.text} ${k.scrollW}>${k.clientW}`),
        ),
      );
    }

    // ── 2. скриншоты детальной страницы
    console.log("2. Скриншоты /charges/:id");
    for (const th of ["light", "dark"]) {
      await go(APP + `/charges/${chargeId}`);
      await theme(th);
      await shot(`charge-detail-${th}`);
    }

    // ── 3. мобильный вид
    console.log("3. Мобильный вид (390x844) — ожидание 28px / 36px");
    await viewport(390, 844, 3, true);
    for (const url of [`/charges/${chargeId}`, "/"]) {
      await go(APP + url, 3500);
      const kpis = JSON.parse(await js(KPI));
      console.log(
        `   ${url}: ${kpis.map((k) => `${k.text}:${k.fontSize}/${k.lineHeight}`).join(", ")}`,
      );
      check(
        `${url}: KPI = 28px на узком окне`,
        kpis.length > 0 && kpis.every((k) => k.fontSize === "28px"),
        JSON.stringify([...new Set(kpis.map((k) => k.fontSize))]),
      );
      check(
        `${url}: line-height 36px`,
        kpis.every((k) => k.lineHeight === "36px"),
        JSON.stringify([...new Set(kpis.map((k) => k.lineHeight))]),
      );
    }
    // ── 4. Иконки StatCard на токенах (§2, вариант A)
    console.log("4. Иконки StatCard: нейтральные + тёплая роза в comfort (§2)");
    await viewport(1400, 1100, 2, false);
    const EXPECT = {
      light: {
        neutral: { bg: "rgb(237, 241, 245)", fg: "rgb(83, 98, 116)" },
        critical: { bg: "rgb(252, 233, 235)", fg: "rgb(164, 50, 61)" },
      },
      comfort: {
        neutral: { bg: "rgb(230, 225, 213)", fg: "rgb(93, 101, 93)" },
        critical: { bg: "rgb(238, 219, 214)", fg: "rgb(148, 60, 56)" },
      },
    };
    for (const th of ["light", "comfort"]) {
      await go(APP + "/");
      await theme(th);
      const icons = JSON.parse(await js(TONES_PROBE));
      console.log(
        `   ${th}: ${icons.map((i) => `${i.label}[${i.bg} / ${i.fg}]`).join(" | ")}`,
      );
      const exp = EXPECT[th];
      const neutral = icons.filter(
        (i) => i.bg === exp.neutral.bg && i.fg === exp.neutral.fg,
      );
      const critical = icons.filter(
        (i) => i.bg === exp.critical.bg && i.fg === exp.critical.fg,
      );
      check(`${th}: на дашборде 4 иконки`, icons.length === 4, `${icons.length}`);
      check(
        `${th}: 3 нейтральные иконки (muted)`,
        neutral.length === 3,
        JSON.stringify(icons.map((i) => i.bg)),
      );
      check(
        `${th}: «Просрочено» — critical-токен`,
        critical.length === 1 && critical[0].label.includes("Просрочено"),
        JSON.stringify(critical),
      );
      check(
        `${th}: все 4 иконки на токенах (emerald-декорации нет)`,
        neutral.length + critical.length === 4,
        `neutral=${neutral.length} critical=${critical.length}`,
      );
      await shot(`dashboard-${th}`);
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
