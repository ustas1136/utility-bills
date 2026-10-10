/**
 * Снимает StatusBadge на /charges в трёх темах Netvision 2.1.
 *
 * Самодостаточный: сам создаёт тестового пользователя и данные через API,
 * затем управляет chrome-headless-shell по CDP (без playwright-пакета).
 *
 * Запуск:  node frontend/scripts/visual-tests/capture.mjs
 * Требует: dev-сервер на http://localhost:5173 и бэкенд на http://localhost:18090.
 * Повторный запуск идемпотентен: логинится существующим пользователем и
 * не создаёт данные, если начисления уже есть.
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
const CDP_PORT = 9335;
const CDP = `http://127.0.0.1:${CDP_PORT}`;
const EMAIL = "netvision-shots@example.com";
const PASS = "screenshot-pass-12345";
const CHROME =
  process.env.HOME +
  "/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";

/** README-режим: `--readme` снимает 6 экранов 1440×900 в docs/screenshots. */
const README = process.argv.includes("--readme");
const README_OUT = path.resolve(DIR, "../../../docs/screenshots");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const day = (offset) =>
  new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

async function api(method, url, body, token) {
  const res = await fetch(API + url, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* не-JSON ответ */
  }
  return { status: res.status, json, text };
}

async function seed() {
  let login = await api("POST", "/auth/login", { email: EMAIL, password: PASS });
  if (login.status !== 200) {
    const reg = await api("POST", "/auth/register", {
      email: EMAIL,
      password: PASS,
      full_name: "Netvision Shots",
    });
    console.log("  register:", reg.status);
    login = await api("POST", "/auth/login", { email: EMAIL, password: PASS });
  }
  if (login.status !== 200)
    throw new Error("login failed: " + login.status + " " + login.text);
  const token = login.json.access_token;

  const me = await api("GET", "/auth/me", null, token);
  const existing = await api("GET", "/charges", null, token);
  if ((existing.json ?? []).length >= 2) {
    console.log("  начисления уже есть:", existing.json.length);
    return { token, me: me.json, created: false };
  }

  const households = await api("GET", "/households", null, token);
  const hid = households.json[0].id;
  const prop = await api(
    "POST",
    "/properties",
    {
      household_id: hid,
      type: "apartment",
      name: "Тестовая квартира",
      address: "ул. Проверочная, 1",
    },
    token,
  );
  const svc = await api(
    "POST",
    `/properties/${prop.json.id}/services`,
    { service_type_id: 1, provider: "Тест-Энерго", account_number: "1234567890" },
    token,
  );
  const mk = (over) =>
    api(
      "POST",
      "/charges",
      {
        property_service_id: svc.json.id,
        period_start: day(-40),
        period_end: day(-11),
        amount: 3175,
        due_date: day(-10),
        ...over,
      },
      token,
    );
  const pending = await mk({
    period_start: day(0),
    period_end: day(25),
    amount: 4800.5,
    due_date: day(25),
    notes: "Электроэнергия за месяц",
  });
  const overdue = await mk({ notes: "Электроэнергия за прошлый период" });
  // PATCH пересчитывает статус: прошедший due_date => overdue
  await api(
    "PATCH",
    `/charges/${overdue.json.id}`,
    { due_date: day(-10) },
    token,
  );
  const all = await api("GET", "/charges", null, token);
  console.log(
    "  создано:",
    all.json.map((c) => `${c.status}/${c.amount}`).join(", "),
  );
  console.log("  pending id:", pending.json.id, "overdue id:", overdue.json.id);
  return { token, me: me.json, created: true };
}

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
      const r = await fetch(CDP + "/json/version");
      if (r.ok) return;
    } catch {
      /* ещё не поднялся */
    }
    await sleep(300);
  }
  throw new Error("CDP недоступен на " + CDP);
}


/** Идемпотентно приводит тестовое хозяйство к виду, пригодному для README. */
async function seedDemo(token) {
  const h = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  const props = await (await fetch(API + "/properties", { headers: h })).json();
  const hid = props[0].household_id;
  const plan = {
    apartment: { name: "Квартира на Ленина, 15", address: "ул. Ленина, 15, кв. 42" },
    house: { name: "Дом в Сосновке", address: "Сосновка, ул. Лесная, 7" },
    land: { name: "Участок ИЖС", address: "СНТ Берёзка, уч. 12" },
    vehicle: { name: "Toyota Camry", address: null },
  };
  const byType = Object.fromEntries(props.map((p) => [p.type, p]));
  for (const [type, meta] of Object.entries(plan)) {
    let p = byType[type];
    if (!p) {
      p = await (
        await fetch(API + "/properties", {
          method: "POST",
          headers: h,
          body: JSON.stringify({ household_id: hid, type, ...meta }),
        })
      ).json();
      console.log(`   + объект ${type}: ${p.name}`);
    } else if (p.name !== meta.name) {
      await fetch(`${API}/properties/${p.id}`, {
        method: "PATCH",
        headers: h,
        body: JSON.stringify(meta),
      });
      console.log(`   ~ объект ${type} → ${meta.name}`);
    }
    byType[type] = p;
  }
  const svcPlan = {
    apartment: [1, 2, 3, 4, 8],
    house: [1, 5, 6, 8],
    land: [7],
    vehicle: [10],
  };
  for (const [type, types] of Object.entries(svcPlan)) {
    const p = byType[type];
    const cur = await (
      await fetch(`${API}/properties/${p.id}/services`, { headers: h })
    ).json();
    const have = new Set((cur ?? []).map((x) => x.service_type_id));
    for (const t of types) {
      if (have.has(t)) continue;
      const r = await fetch(`${API}/properties/${p.id}/services`, {
        method: "POST",
        headers: h,
        body: JSON.stringify({ service_type_id: t }),
      });
      if (!r.ok) console.log(`   ! услуга ${t} для ${type}: HTTP ${r.status}`);
    }
  }
  // правдоподобный серийный номер у активного счётчика
  const svcs = await (
    await fetch(`${API}/properties/${byType.apartment.id}/services`, { headers: h })
  ).json();
  for (const sv of svcs ?? []) {
    const ms = await (
      await fetch(`${API}/property-services/${sv.id}/meters`, { headers: h })
    ).json();
    const active = (ms ?? []).find((m) => !m.replaced_at);
    if (active && active.serial_number?.startsWith("NV-")) {
      await fetch(`${API}/meters/${active.id}`, {
        method: "PATCH",
        headers: h,
        body: JSON.stringify({ serial_number: "50670598" }),
      });
      console.log("   ~ серийный номер счётчика → 50670598");
    }
    // показания, чтобы в README был не пустой график потребления
    if (active) {
      const rs = await (
        await fetch(`${API}/meters/${active.id}/readings`, { headers: h })
      ).json();
      if (!(rs ?? []).length) {
        const monthStart = (back) => {
          const d = new Date();
          d.setDate(1);
          d.setMonth(d.getMonth() - back);
          return d.toISOString().slice(0, 10);
        };
        for (const [back, value] of [[3, 1204.5], [2, 1338.2], [1, 1470.9], [0, 1622.4]]) {
          const r = await fetch(`${API}/meters/${active.id}/readings`, {
            method: "POST",
            headers: h,
            body: JSON.stringify({ value, taken_at: monthStart(back) }),
          });
          if (!r.ok) console.log(`   ! показание ${value}: HTTP ${r.status}`);
        }
        console.log("   + 4 показания счётчика");
      }
    }
  }
}

async function main() {
  console.log("1. Данные через API");
  const { token, me } = await seed();

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "ub-hs-"));
  console.log("2. Запуск chrome-headless-shell");
  const chrome = spawn(
    CHROME,
    [
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--hide-scrollbars",
      `--remote-debugging-port=${CDP_PORT}`,
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

    const js = async (expr) => {
      const x = await cdp.send("Runtime.evaluate", {
        expression: expr,
        returnByValue: true,
        awaitPromise: true,
      });
      if (x.exceptionDetails)
        throw new Error(JSON.stringify(x.exceptionDetails).slice(0, 300));
      return x.result.value;
    };
    const shot = async (name, clip) => {
      const s = await cdp.send(
        "Page.captureScreenshot",
        clip ? { format: "png", clip } : { format: "png" },
      );
      const file = path.join(OUT, name + ".png");
      fs.writeFileSync(file, Buffer.from(s.data, "base64"));
      console.log(
        "   saved",
        name + ".png",
        Math.round(fs.statSync(file).size / 1024) + "KB",
      );
    };

    // Тот же origin, чтобы получить доступ к localStorage
    await cdp.send("Page.navigate", { url: APP + "/" });
    await sleep(2500);
    const auth = JSON.stringify({
      state: { accessToken: token, refreshToken: null, user: me },
      version: 0,
    });
    await js(
      `localStorage.setItem('utility-bills-auth', ${JSON.stringify(auth)});
       localStorage.setItem('utility-bills-theme', JSON.stringify({state:{theme:'light'},version:0})); 'ok'`,
    );

    if (README) {
      console.log("3. README-режим: демо-данные и съёмка 1440×900");
      await seedDemo(token);
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: 1440,
        height: 900,
        deviceScaleFactor: 2,
        mobile: false,
      });
      fs.mkdirSync(README_OUT, { recursive: true });
      const shotReadme = async (name) => {
        const s = await cdp.send("Page.captureScreenshot", { format: "png" });
        const file = path.join(README_OUT, name + ".png");
        fs.writeFileSync(file, Buffer.from(s.data, "base64"));
        console.log(
          `   saved docs/screenshots/${name}.png`,
          Math.round(fs.statSync(file).size / 1024) + "KB",
        );
      };
      const goR = async (url, wait = 3400) => {
        await cdp.send("Page.navigate", { url });
        await sleep(wait);
      };
      const auth2 = { Authorization: `Bearer ${token}` };
      const props = await (await fetch(API + "/properties", { headers: auth2 })).json();
      const apartment = props.find((p) => p.type === "apartment") ?? props[0];
      const svcList = await (
        await fetch(`${API}/properties/${apartment.id}/services`, { headers: auth2 })
      ).json();
      let meterId = null;
      for (const sv of svcList ?? []) {
        const ms = await (
          await fetch(`${API}/property-services/${sv.id}/meters`, { headers: auth2 })
        ).json();
        const active = (ms ?? []).find((m) => !m.replaced_at);
        if (active) {
          meterId = active.id;
          break;
        }
      }
      await js(`document.documentElement.setAttribute('data-theme','light'); 'ok'`);

      await goR(APP + "/");
      await shotReadme("dashboard");
      await goR(APP + "/properties");
      await shotReadme("properties");
      await goR(APP + `/properties/${apartment.id}`);
      await shotReadme("property-detail");
      await goR(APP + "/charges");
      await shotReadme("charges");
      if (meterId) {
        await goR(APP + `/meters/${meterId}`);
        await shotReadme("meter");
      } else {
        console.warn("   !! активный счётчик не найден — meter.png пропущен");
      }
      await goR(APP + "/settings");
      // SettingsPage не читает ?tab=, поэтому переключаем таб настоящим кликом
      const tr = JSON.parse(
        await js(`(()=>{const el=[...document.querySelectorAll('[role="tab"]')]
          .find(e => e.textContent.trim() === 'Уведомления');
          if(!el) return JSON.stringify(null);
          const r = el.getBoundingClientRect();
          return JSON.stringify({x:r.x+r.width/2, y:r.y+r.height/2});})()`),
      );
      if (tr) {
        for (const type of ["mousePressed", "mouseReleased"])
          await cdp.send("Input.dispatchMouseEvent", {
            type, x: tr.x, y: tr.y, button: "left", buttons: 1, clickCount: 1,
          });
        await sleep(1500);
      }
      await shotReadme("settings");
      cdp.ws.close();
      return;
    }

    console.log("3. Открываю /charges и жду бейджи");
    await cdp.send("Page.navigate", { url: APP + "/charges" });
    let n = 0;
    const dl = Date.now() + 30000;
    while (Date.now() < dl) {
      n = await js(
        `document.querySelectorAll('[data-slot="badge"]').length`,
      ).catch(() => 0);
      if (n >= 2) break;
      await sleep(400);
    }
    console.log("   бейджей:", n);
    if (n < 2) console.warn("   !! бейджи не найдены — снимаю что есть");

    const boxes = JSON.parse(
      await js(`JSON.stringify([...document.querySelectorAll('[data-slot="badge"]')]
        .map(e=>{const r=e.getBoundingClientRect();
                 return {t:e.textContent.trim(),x:r.x,y:r.y,w:r.width,h:r.height};}))`),
    );
    console.log("   тексты:", JSON.stringify(boxes.map((b) => b.t)));

    console.log("4. Скриншоты трёх тем");
    for (const th of ["light", "comfort", "dark"]) {
      await js(`document.documentElement.setAttribute('data-theme','${th}'); 'ok'`);
      await sleep(700);
      await shot(`charges-${th}`);
    }

    if (boxes.length) {
      const pad = 16;
      const x = Math.min(...boxes.map((b) => b.x)) - pad;
      const y = Math.min(...boxes.map((b) => b.y)) - pad;
      const w = Math.max(...boxes.map((b) => b.x + b.w)) + pad - x;
      const h = Math.max(...boxes.map((b) => b.y + b.h)) + pad - y;
      for (const th of ["light", "comfort", "dark"]) {
        await js(`document.documentElement.setAttribute('data-theme','${th}'); 'ok'`);
        await sleep(500);
        await shot(`badges-${th}`, { x, y, width: w, height: h, scale: 3 });
      }
    }

    console.log("5. Меню переключателя тем");
    await js(`document.documentElement.setAttribute('data-theme','comfort'); 'ok'`);
    await sleep(400);
    const found = await js(
      `(()=>{const b=document.querySelector('[aria-label="Сменить тему"]');if(!b)return false;b.focus();return true;})()`,
    );
    if (found) {
      for (const type of ["keyDown", "keyUp"])
        await cdp.send("Input.dispatchKeyEvent", {
          type,
          key: "Enter",
          code: "Enter",
          windowsVirtualKeyCode: 13,
          nativeVirtualKeyCode: 13,
        });
      await sleep(900);
      const items = await js(
        `JSON.stringify([...document.querySelectorAll('[role="menuitem"]')].map(e=>e.textContent.trim()))`,
      );
      console.log("   пункты меню:", items);
      await shot("theme-toggle-menu");
    } else console.warn("   !! кнопка темы не найдена");

    // Проверка контраста/значений, посчитанных браузером
    const computed = await js(`(()=>{
      const cs = el => el ? getComputedStyle(el) : null;
      const out = {theme: document.documentElement.getAttribute('data-theme')};
      const spans = [...document.querySelectorAll('[data-slot="badge"]')];
      out.badges = spans.map(e => ({text:e.textContent.trim(),
        bg: cs(e).backgroundColor, fg: cs(e).color, radius: cs(e).borderRadius}));
      const root = cs(document.documentElement);
      out.radiusControl = root.getPropertyValue('--radius-control').trim();
      out.radiusOption  = root.getPropertyValue('--radius-option').trim();
      out.colorScheme   = root.colorScheme;
      return JSON.stringify(out);
    })()`);
    fs.writeFileSync(path.join(OUT, "computed.json"), computed);
    console.log("   computed.json записан");
    cdp.ws.close();
  } finally {
    chrome.kill("SIGKILL");
  }
}

main().catch((e) => {
  console.error("ОШИБКА:", e.message);
  process.exitCode = 1;
});
