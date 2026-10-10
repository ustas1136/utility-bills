/**
 * Проверка шага 9 — хардкод-цвета переведены на токены.
 *
 * A. --chart-1..4 различаются по темам И реально применяются к SVG (fill=var(...));
 * B. точки статуса счётчиков (ServiceRow) на warning/success;
 * C. роли в «Семье» нейтральные, badge «Ожидает» на warning-токенах;
 * D. сплэш — solid bg-primary (не градиент), текст читается (контраст);
 * E. скриншоты дашборда в 3 темах и логина в light/comfort.
 *
 * Скрипт сам создаёт данные для графиков (услуги разных категорий +
 * оплаченные начисления) и одно непринятое приглашение — идемпотентно.
 *
 * ВАЖНО: shadcn/Radix перезаписывают data-slot внутри FormControl/DialogTrigger —
 * у Input он становится 'form-control', у Button внутри DialogTrigger —
 * 'dialog-trigger'. Для тестов надёжнее искать по [data-size],
 * чем по [data-slot='button'].
 *
 * Запуск: node frontend/scripts/visual-tests/verify-colors.mjs
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

const CDP = "http://127.0.0.1:9344";
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

const CHART_TOKENS = `(()=>{
  const cs = getComputedStyle(document.documentElement);
  return JSON.stringify({
    chart1: cs.getPropertyValue('--chart-1').trim(),
    chart2: cs.getPropertyValue('--chart-2').trim(),
    chart3: cs.getPropertyValue('--chart-3').trim(),
    chart4: cs.getPropertyValue('--chart-4').trim()
  });
})()`;

/** SVG-элементы, у которых fill задан через var(), и как он вычислился. */
const CHART_FILLS = `(()=>{
  const els = [...document.querySelectorAll('[fill^="var("]')];
  return JSON.stringify({
    withVar: els.length,
    fills: [...new Set(els.map(e => getComputedStyle(e).fill))],
    samples: [...new Set(els.map(e => e.getAttribute('fill')))].slice(0, 6)
  });
})()`;

/** Точки статуса счётчиков в списке услуг объекта. */
const DOTS = `(()=>{
  const els = [...document.querySelectorAll('[class*="size-1.5"]')];
  return JSON.stringify(els.map(e => ({
    bg: getComputedStyle(e).backgroundColor,
    next: (e.nextElementSibling?.textContent || '').trim().slice(0, 24)
  })));
})()`;

/** Роли в «Семье» и badge «Ожидает» у приглашения. */
const FAMILY = `(()=>{
  const roles = [...document.querySelectorAll('span,div')]
    .filter(e => /^(Владелец|Администратор|Участник|Наблюдатель)$/.test((e.textContent||'').trim()))
    .map(e => ({ role: e.textContent.trim(), color: getComputedStyle(e).color }));
  const badges = [...document.querySelectorAll('[data-slot="badge"]')]
    .map(e => ({ text: (e.textContent||'').trim(),
                 bg: getComputedStyle(e).backgroundColor,
                 fg: getComputedStyle(e).color }));
  return JSON.stringify({ roles, badges });
})()`;

/** Панель сплэша: фон, текст и контраст (цвет конвертируем через canvas). */
const SPLASH = `(()=>{
  const panel = [...document.querySelectorAll('div')]
    .find(e => (e.className||'').includes('lg:flex') && (e.className||'').includes('p-12'));
  if (!panel) return JSON.stringify(null);
  const p = panel.querySelector('p');
  const parse = c => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 1;
    const cx = cv.getContext('2d');
    cx.fillStyle = c;
    cx.fillRect(0, 0, 1, 1);
    const d = cx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], Math.round((d[3]/255)*1000)/1000];
  };
  const lum = c => {
    const f = v => { v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); };
    return 0.2126*f(c[0]) + 0.7152*f(c[1]) + 0.0722*f(c[2]);
  };
  const bg = parse(getComputedStyle(panel).backgroundColor);
  const t = p ? parse(getComputedStyle(p).color) : null;
  const eff = t ? [0,1,2].map(i => t[i]*t[3] + bg[i]*(1-t[3])) : null;
  const ratio = eff ? (Math.max(lum(bg), lum(eff)) + 0.05) / (Math.min(lum(bg), lum(eff)) + 0.05) : null;
  return JSON.stringify({
    bgColor: getComputedStyle(panel).backgroundColor,
    bgImage: getComputedStyle(panel).backgroundImage,
    textColor: p ? getComputedStyle(p).color : null,
    contrast: ratio ? Math.round(ratio*100)/100 : null
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
  const auth = { Authorization: "" };
  const login = await fetch(API + "/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  }).then((r) => r.json());
  if (!login.access_token) throw new Error("логин не удался");
  auth.Authorization = `Bearer ${login.access_token}`;
  const me = await fetch(API + "/auth/me", { headers: auth }).then((r) => r.json());

  const json = (u, o) => fetch(u, o).then((r) => r.json());
  const props = await json(API + "/properties", { headers: auth });
  const pid = props?.[0]?.id;
  const hid = props?.[0]?.household_id;

  // ── данные: услуги трёх категорий + оплаченные начисления
  let svcs = await json(`${API}/properties/${pid}/services`, { headers: auth });
  const have = new Set(svcs.map((s) => s.service_type_id));
  for (const t of [1, 8]) {
    if (have.has(t)) continue;
    const r = await fetch(`${API}/properties/${pid}/services`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ service_type_id: t }),
    });
    console.log(`   + услуга type=${t}: HTTP ${r.status}`);
  }
  svcs = await json(`${API}/properties/${pid}/services`, { headers: auth });
  const want = svcs.filter((s) => [1, 8].includes(s.service_type_id));
  const charges = await json(API + "/charges", { headers: auth });
  const paidFor = new Set(
    charges.filter((c) => c.status === "paid").map((c) => c.property_service_id),
  );
  const month = (offset) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + offset);
    return d.toISOString().slice(0, 10);
  };
  for (const s of want) {
    if (paidFor.has(s.id)) continue;
    const amount = 1000 + s.service_type_id * 137;
    const c = await json(API + "/charges", {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        property_service_id: s.id,
        period_start: month(-1),
        period_end: month(0),
        amount,
        due_date: month(0),
      }),
    });
    const pay = await fetch(`${API}/charges/${c.id}/payments`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ amount, paid_at: month(0), method: "card" }),
    });
    console.log(`   + оплачено начисление #${c.id} (услуга ${s.id}): HTTP ${pay.status}`);
  }

  // ── непринятое приглашение для badge «Ожидает»
  const invs = await json(`${API}/households/${hid}/invitations`, { headers: auth });
  if (!invs.some((i) => !i.accepted_at)) {
    const r = await fetch(`${API}/households/${hid}/invitations`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ email: `pending-${Date.now()}@example.com`, role: "member" }),
    });
    console.log(`   + приглашение: HTTP ${r.status}`);
  }

  // ── объект «автомобиль» с ОСАГО — третья категория (insurance)
  let vap = props.find((x) => x.type === "vehicle");
  if (!vap) {
    vap = await json(API + "/properties", {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ household_id: hid, type: "vehicle", name: "Тестовый автомобиль" }),
    });
    console.log(`   + объект vehicle: id=${vap.id}`);
  }
  let vsvcs = await json(`${API}/properties/${vap.id}/services`, { headers: auth });
  if (!vsvcs.some((x) => x.service_type_id === 10)) {
    const r = await fetch(`${API}/properties/${vap.id}/services`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ service_type_id: 10 }),
    });
    console.log(`   + услуга osago на vehicle: HTTP ${r.status}`);
    vsvcs = await json(`${API}/properties/${vap.id}/services`, { headers: auth });
  }
  const osago = vsvcs.find((x) => x.service_type_id === 10);
  const allCharges = await json(API + "/charges", { headers: auth });
  if (osago && !allCharges.some((c) => c.property_service_id === osago.id && c.status === "paid")) {
    const c = await json(API + "/charges", {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        property_service_id: osago.id,
        period_start: month(-1), period_end: month(0),
        amount: 5400, due_date: month(0),
      }),
    });
    const pay = await fetch(`${API}/charges/${c.id}/payments`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ amount: 5400, paid_at: month(0), method: "card" }),
    });
    console.log(`   + оплачено ОСАГО #${c.id}: HTTP ${pay.status}`);
  }

  // ── замена активного счётчика (для warning-точки в ServiceRow)
  let toReplace = null;
  for (const sv of svcs) {
    const ms = await json(`${API}/property-services/${sv.id}/meters`, { headers: auth });
    const act = (ms ?? []).find((m) => !m.replaced_at);
    if (act && !(ms ?? []).some((m) => m.replaced_at)) { toReplace = act; break; }
  }
  if (toReplace) {
    const rep = await fetch(`${API}/meters/${toReplace.id}/replace`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        replaced_at: new Date().toISOString().slice(0, 10),
        initial_value: 0,
        serial_number: `NV-NEW-${Date.now() % 10000}`,
        unit: "кВт·ч",
      }),
    });
    console.log(`   + счётчик #${toReplace.id} заменён: HTTP ${rep.status}`);
  } else {
    console.log("   счётчиков для замены не нашлось");
  }

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "ub-hs9-"));
  const chrome = spawn(
    CHROME,
    [
      "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--hide-scrollbars",
      "--remote-debugging-port=9344", `--user-data-dir=${profile}`,
      "--window-size=1400,1100", "about:blank",
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
    const viewport = async (w, h, s, m) => {
      await cdp.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: s, mobile: m });
      await sleep(500);
    };
    const go = async (url, wait = 3200) => { await cdp.send("Page.navigate", { url }); await sleep(wait); };
    const shot = async (name) => {
      const s = await cdp.send("Page.captureScreenshot", { format: "png" });
      fs.writeFileSync(path.join(OUT, name + ".png"), Buffer.from(s.data, "base64"));
      console.log(`   saved ${name}.png`);
    };
    const theme = async (t) => { await js(`document.documentElement.setAttribute('data-theme','${t}'); 'ok'`); await sleep(500); };

    await viewport(1400, 1100, 2, false);

    // ── A. сплэш (без авторизации)
    console.log("A. Сплэш /login: solid primary и контраст текста");
    await go(APP + "/");
    await js(`localStorage.clear(); 'ok'`);
    for (const th of ["light", "comfort"]) {
      await go(APP + "/login", 3500);
      await theme(th);
      const sp = JSON.parse(await js(SPLASH));
      if (!sp) { check(`${th}: панель найдена`, false, "нет панели"); continue; }
      console.log(`   ${th}: bg=${sp.bgColor}, image=${sp.bgImage}, text=${sp.textColor}, contrast=${sp.contrast}`);
      check(`${th}: панель без градиента`, sp.bgImage === "none", sp.bgImage);
      check(`${th}: фон = primary, не градиент`, sp.bgColor !== "rgba(0, 0, 0, 0)", sp.bgColor);
      check(`${th}: контраст текста >= 4.5 (§7)`, sp.contrast >= 4.5, `${sp.contrast}`);
      await shot(`login-${th}`);
    }

    // дальше — с авторизацией
    await go(APP + "/");
    await js(`localStorage.setItem('utility-bills-auth', ${JSON.stringify(JSON.stringify({
      state: { accessToken: login.access_token, refreshToken: login.refresh_token, user: me },
      version: 0 }))}); 'ok'`);

    // ── B. графики
    console.log("B. Графики: токены и фактические заливки SVG");
    const tokenSets = {};
    const fillSets = {};
    for (const th of ["light", "comfort", "dark"]) {
      await go(APP + "/");
      await theme(th);
      const tok = JSON.parse(await js(CHART_TOKENS));
      const fill = JSON.parse(await js(CHART_FILLS));
      tokenSets[th] = tok;
      fillSets[th] = fill;
      console.log(`   ${th}: chart-1..4 = ${tok.chart1} | ${tok.chart2} | ${tok.chart3} | ${tok.chart4}`);
      console.log(`      SVG с fill=var(): ${fill.withVar}, вычислено: ${JSON.stringify(fill.fills)}`);
      check(`${th}: --chart-1..4 заданы`, !!(tok.chart1 && tok.chart2 && tok.chart3 && tok.chart4), JSON.stringify(tok));
      check(`${th}: графики используют var(--chart-*)`, fill.withVar > 0, `${fill.withVar} элементов`);
      check(
        `${th}: var() в fill вычисляется в цвет`,
        fill.fills.length > 0 &&
          fill.fills.every((f) => f !== "none" && f !== "" && !/^rgba\(0, 0, 0, 0\)$/.test(f)),
        JSON.stringify(fill.fills),
      );
      await shot(`dashboard-${th}`);
    }
    check(
      "chart-1 различается по темам (light != dark)",
      tokenSets.light.chart1 !== tokenSets.dark.chart1,
      `light=${tokenSets.light.chart1} dark=${tokenSets.dark.chart1}`,
    );
    check(
      "заливки графиков различаются по темам",
      JSON.stringify(fillSets.light.fills) !== JSON.stringify(fillSets.dark.fills),
      `light=${JSON.stringify(fillSets.light.fills)} dark=${JSON.stringify(fillSets.dark.fills)}`,
    );

    // ── C. точки статуса счётчиков
    console.log("C. /properties: точки статуса счётчиков");
    await go(APP + `/properties/${pid}`);
    await theme("light");
    const dots = JSON.parse(await js(DOTS));
    console.log(`   точки: ${JSON.stringify(dots)}`);
    const expWarning = "rgb(121, 80, 12)"; // --warning, light
    const expSuccess = "rgb(36, 100, 66)"; // --success, light
    check(
      "есть точки статуса",
      dots.length > 0,
      `${dots.length}`,
    );
    check(
      "точки на warning/success токенах",
      dots.every((d) => d.bg === expWarning || d.bg === expSuccess),
      JSON.stringify(dots.map((d) => d.bg)),
    );
    check(
      "есть и warning (заменён), и success (активен)",
      dots.some((d) => d.bg === expWarning) && dots.some((d) => d.bg === expSuccess),
      JSON.stringify(dots.map((d) => d.bg)),
    );

    // ── D. «Семья»: роли и badge
    console.log("D. /settings → Семья: роли нейтральные, badge «Ожидает»");
    await go(APP + "/settings", 3500);
    await theme("light");
    // SettingsPage не читает ?tab=, переключаем таб настоящим кликом.
    const tabRect = JSON.parse(
      await js(`(()=>{const el=[...document.querySelectorAll('[role="tab"]')]
        .find(e => e.textContent.trim() === 'Семья');
        if(!el) return JSON.stringify(null);
        const r = el.getBoundingClientRect();
        return JSON.stringify({x:r.x+r.width/2, y:r.y+r.height/2});})()`),
    );
    if (tabRect) {
      for (const type of ["mousePressed", "mouseReleased"])
        await cdp.send("Input.dispatchMouseEvent", {
          type, x: tabRect.x, y: tabRect.y, button: "left", buttons: 1, clickCount: 1,
        });
      await sleep(1500);
    }
    const fam = JSON.parse(await js(FAMILY));
    console.log(`   роли: ${JSON.stringify(fam.roles)}`);
    console.log(`   бейджи: ${JSON.stringify(fam.badges)}`);
    check(
      "все роли одного нейтрального цвета (muted-foreground)",
      fam.roles.length > 0 &&
        fam.roles.every((r) => r.color === "rgb(83, 98, 116)"),
      JSON.stringify(fam.roles),
    );
    const pending = fam.badges.find((b) => b.text === "Ожидает");
    check("badge «Ожидает» найден", !!pending, JSON.stringify(fam.badges.map((b) => b.text)));
    if (pending) {
      check(
        "badge «Ожидает» на warning-токенах",
        pending.bg === "rgb(255, 240, 213)" && pending.fg === "rgb(121, 80, 12)",
        `${pending.bg} / ${pending.fg}`,
      );
    }
    await shot("settings-family-light");
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
