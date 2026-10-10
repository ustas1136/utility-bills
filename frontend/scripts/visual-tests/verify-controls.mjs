/**
 * Проверка шага 4 — геометрия форм-контролов Netvision §4.
 *
 * Инвентаризация по факту: на списочных страницах контролов нет, они живут
 * в диалогах, поэтому скрипт открывает диалог и меряет уже внутри него.
 * Плюс /login — единственная страница с inline-формой.
 *
 * Запуск: node frontend/scripts/visual-tests/verify-controls.mjs
 * Скриншоты пишутся в docs/netvision-shots (каталог в .gitignore).
 * ВАЖНО: shadcn/Radix перезаписывают data-slot внутри FormControl/DialogTrigger —
 * у Input он становится 'form-control', у Button внутри DialogTrigger —
 * 'dialog-trigger'. Для тестов надёжнее искать по [data-size],
 * чем по [data-slot='button'].
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
const CDP = "http://127.0.0.1:9338";
const EMAIL = "netvision-shots@example.com";
const PASS = "screenshot-pass-12345";
const CHROME =
  process.env.HOME +
  "/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const CONTROL = 44;

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

/** Снимок контролов внутри заданного корня (или всей страницы). */
const SNAPSHOT = (root) => `(()=>{
  const R = ${root ? `document.querySelector('${root}')` : "document"};
  if (!R) return JSON.stringify(null);
  const h = el => Math.round(el.getBoundingClientRect().height * 100) / 100;
  const uniq = a => [...new Set(a)];
  const q = s => [...R.querySelectorAll(s)];
  const buttons = {};
  for (const s of ['default','sm','xs','icon','icon-sm','icon-xs','icon-lg']) {
    const els = q('[data-size="' + s + '"]');
    if (els.length) buttons[s] = uniq(els.map(h));
  }
  return JSON.stringify({
    inputs: uniq(q('input[data-slot="input"], input[data-slot="form-control"]').map(h)),
    selects: uniq(q('[data-slot="select-trigger"]').map(h)),
    buttons,
    // Только настоящие Button — у Avatar и Switch тоже есть data-size="default"
    buttonsReal: uniq(q('button[data-slot="button"][data-size="default"]').map(h)),
    buttonTexts: q('[data-size]').map(e => (e.textContent||'').trim().slice(0,28) + '[' + e.dataset.size + '=' + h(e) + ']'),
    badges: uniq(q('[data-slot="badge"]').map(h)),
    badgeRadius: uniq(q('[data-slot="badge"]').map(e => getComputedStyle(e).borderRadius))
  });
})()`;

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

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "ub-hs4-"));
  const chrome = spawn(
    CHROME,
    [
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--hide-scrollbars",
      "--remote-debugging-port=9338",
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
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1400,
      height: 1100,
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
    const setStored = (k, t) =>
      js(`localStorage.setItem('${k}', ${JSON.stringify(JSON.stringify(t))}); 'ok'`);
    const go = async (url, wait = 3200) => {
      await cdp.send("Page.navigate", { url });
      await sleep(wait);
    };
    const shot = async (name, clip) => {
      const s = await cdp.send(
        "Page.captureScreenshot",
        clip ? { format: "png", clip } : { format: "png" },
      );
      fs.writeFileSync(path.join(OUT, name + ".png"), Buffer.from(s.data, "base64"));
      console.log(`   saved ${name}.png`);
    };
    const authPayload = {
      state: {
        accessToken: login.access_token,
        refreshToken: login.refresh_token,
        user: me,
      },
      version: 0,
    };

    // ── A. /login — единственная страница с inline-формой
    console.log("A. /login (inline-форма)");
    await go(APP + "/");
    await js(`localStorage.clear(); 'ok'`);
    await go(APP + "/login");
    const loginSnap = JSON.parse(await js(SNAPSHOT(null)));
    console.log(
      `   input=${JSON.stringify(loginSnap.inputs)} select=${JSON.stringify(loginSnap.selects)} ` +
        `button=${JSON.stringify(loginSnap.buttons)}`,
    );
    check(
      "/login: input = 44px",
      loginSnap.inputs.length > 0 && loginSnap.inputs.every((v) => v === CONTROL),
      JSON.stringify(loginSnap.inputs),
    );
    check(
      "/login: кнопка default = 44px",
      !!loginSnap.buttons.default &&
        loginSnap.buttons.default.every((v) => v === CONTROL),
      JSON.stringify(loginSnap.buttons.default),
    );
    await shot("login-light");

    // возвращаем авторизацию
    await js(
      `localStorage.setItem('utility-bills-auth', ${JSON.stringify(JSON.stringify(authPayload))}); 'ok'`,
    );
    await setStored("utility-bills-theme", { state: { theme: "light" }, version: 0 });

    // ── B. инвентаризация списочных страниц и их диалогов
    const pages = [
      { path: "/charges", dialog: /Новое начисление/i, theme: true },
      { path: "/properties", dialog: /Новый объект|Добавить/i, theme: false },
      { path: "/settings", dialog: /Пригласить|Создать|Добавить/i, theme: false },
    ];
    console.log("B. Инвентаризация: что реально есть на странице и в её диалоге");
    for (const p of pages) {
      await go(APP + p.path);
      const page = JSON.parse(await js(SNAPSHOT(null)));
      console.log(
        `   ${p.path}: inline input=${JSON.stringify(page.inputs)} select=${JSON.stringify(page.selects)} ` +
          `button=${JSON.stringify(page.buttons)} badge=${JSON.stringify(page.badges)} radius=${JSON.stringify(page.badgeRadius)}`,
      );
      console.log(`      кнопки: ${JSON.stringify(page.buttonTexts.slice(0, 12))}`);

      if (p.path === "/settings") {
        // В шапке настроек триггеров нет — диалоги и поля живут внутри табов.
        const tabNames = JSON.parse(
          await js(`JSON.stringify([...document.querySelectorAll('[role="tab"]')].map(e=>e.textContent.trim()))`),
        );
        console.log(`      табы: ${JSON.stringify(tabNames)}`);
        for (const t of tabNames) {
          const rect = JSON.parse(
            await js(`(()=>{const el=[...document.querySelectorAll('[role="tab"]')]
              .find(e=>e.textContent.trim()===${JSON.stringify(t)});
              if(!el) return JSON.stringify(null);
              const r=el.getBoundingClientRect();
              return JSON.stringify({x:r.x+r.width/2,y:r.y+r.height/2});})()`),
          );
          if (rect) {
            for (const type of ["mousePressed", "mouseReleased"])
              await cdp.send("Input.dispatchMouseEvent", {
                type,
                x: rect.x,
                y: rect.y,
                button: "left",
                buttons: 1,
                clickCount: 1,
              });
          }
          await sleep(1500);
          const panel = JSON.parse(await js(SNAPSHOT(null)));
          if (!panel) continue;
          console.log(
            `      «${t}»: input=${JSON.stringify(panel.inputs)} select=${JSON.stringify(panel.selects)} button=${JSON.stringify(panel.buttons)}`,
          );
          if (panel.inputs.length) {
            check(
              `/settings «${t}»: input = ${CONTROL}px`,
              panel.inputs.every((v) => v === CONTROL),
              JSON.stringify(panel.inputs),
            );
          }
          if (panel.selects.length) {
            check(
              `/settings «${t}»: select = ${CONTROL}px`,
              panel.selects.every((v) => v === CONTROL),
              JSON.stringify(panel.selects),
            );
          }
          if (panel.buttons.default) {
            // Аватар в шапке имеет намеренный h-8, поэтому только логируем.
            console.log(
              `         default-кнопки: ${JSON.stringify(panel.buttons.default)}`,
            );
          }
          if (panel.buttonsReal.length) {
            check(
              `/settings «${t}»: Button default = ${CONTROL}px`,
              panel.buttonsReal.every((v) => v === CONTROL),
              JSON.stringify(panel.buttonsReal),
            );
          }
          console.log(`         кнопки: ${JSON.stringify(panel.buttonTexts.slice(0, 10))}`);
          if (panel.inputs.length || panel.selects.length) {
            const slug =
              ["profile", "notifications", "reminders", "family"][
                tabNames.indexOf(t)
              ] ?? `tab${tabNames.indexOf(t)}`;
            await shot(`settings-${slug}`);
          }
        }
        continue;
      }

      const opened = await js(`(()=>{
        const re = ${p.dialog};
        const cands = [...document.querySelectorAll('[data-size]')]
          .filter(e => !e.closest('[data-slot="dialog-content"]'));
        const b = cands.find(e => re.test(e.textContent || ''));
        if (!b) return 'нет подходящей кнопки среди: ' +
          JSON.stringify(cands.map(e => (e.textContent||'').trim().slice(0,20)));
        b.click();
        return 'clicked: ' + (b.textContent || '').trim().slice(0, 30);
      })()`);
      await sleep(1300);
      const dlg = JSON.parse(await js(SNAPSHOT('[data-slot="dialog-content"]')));
      console.log(`      диалог: ${opened} -> ${dlg ? JSON.stringify({inputs: dlg.inputs, selects: dlg.selects, buttons: dlg.buttons}) : "НЕ ОТКРЫЛСЯ"}`);

      if (dlg) {
        check(
          `${p.path}: input в диалоге = ${CONTROL}px`,
          dlg.inputs.length > 0 && dlg.inputs.every((v) => v === CONTROL),
          JSON.stringify(dlg.inputs),
        );
        check(
          `${p.path}: select в диалоге = ${CONTROL}px`,
          dlg.selects.every((v) => v === CONTROL),
          JSON.stringify(dlg.selects),
        );
        check(
          `${p.path}: кнопки в диалоге = ${CONTROL}px`,
          !!dlg.buttons.default &&
            dlg.buttons.default.every((v) => v === CONTROL),
          JSON.stringify(dlg.buttons.default),
        );
        if (p.theme) {
          const r = JSON.parse(
            await js(`(()=>{const d=document.querySelector('[data-slot="dialog-content"]');
              const b=d.getBoundingClientRect();
              return JSON.stringify({x:b.x,y:b.y,width:b.width,height:b.height});})()`),
          );
          for (const th of ["light", "dark"]) {
            await js(`document.documentElement.setAttribute('data-theme','${th}'); 'ok'`);
            await sleep(600);
            await shot(`dialog-charge-${th}`, {
              x: Math.max(0, r.x - 20),
              y: Math.max(0, r.y - 20),
              width: r.width + 40,
              height: r.height + 40,
              scale: 2,
            });
          }
        }
      } else {
        check(`${p.path}: диалог открылся`, false, opened);
      }
    }

    // ── C. неизменность мелких размеров и бейджей
    console.log("C. Мелкие размеры не тронуты");
    await go(APP + "/charges");
    const ch = JSON.parse(await js(SNAPSHOT(null)));
    check(
      "/charges: icon-кнопки остались 36px",
      !ch.buttons.icon || ch.buttons.icon.every((v) => v === 36),
      JSON.stringify(ch.buttons.icon),
    );
    check(
      "/charges: sm-кнопки остались 32px",
      !ch.buttons.sm || ch.buttons.sm.every((v) => v === 32),
      JSON.stringify(ch.buttons.sm),
    );
    check(
      "/charges: StatusBadge радиус 6px",
      ch.badgeRadius.length > 0 && ch.badgeRadius.every((v) => v === "6px"),
      JSON.stringify(ch.badgeRadius),
    );

    // ── D. строка фильтров /reports: §4 требует выравнивания краёв
    console.log("D. Фильтры /reports (выравнивание в одной строке)");
    await go(APP + "/reports");
    const rep = JSON.parse(await js(SNAPSHOT(null)));
    console.log(
      `   input=${JSON.stringify(rep.inputs)} select=${JSON.stringify(rep.selects)} ` +
        `button=${JSON.stringify(rep.buttons)}`,
    );
    console.log(`   кнопки: ${JSON.stringify(rep.buttonTexts.slice(0, 10))}`);
    check(
      "/reports: input = 44px",
      rep.inputs.length > 0 && rep.inputs.every((v) => v === CONTROL),
      JSON.stringify(rep.inputs),
    );
    if (rep.selects.length) {
      check(
        "/reports: select = 44px",
        rep.selects.every((v) => v === CONTROL),
        JSON.stringify(rep.selects),
      );
    } else {
      console.log("   (Select на /reports нет — период выбирается группой sm-кнопок 32px)");
    }
    await shot("reports-filters");
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
