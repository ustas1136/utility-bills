/**
 * Проверка шага 5 — радиусы и popup-токены Netvision §11.
 *
 *  1) dropdown меню темы: радиус 12px, тень --popup-shadow, max-height 320px,
 *     паддинг 6px, пункты 6px и минимум 44px; скриншоты light/dark;
 *  2) dialog «Новое начисление»: радиус 12px, тень --popup-shadow;
 *  3) select «Услуга» внутри диалога: контент/пункты, а также высота
 *     вьюпорта (в shadcn там h-[var(--radix-select-trigger-height)] —
 *     проверяем, не ломает ли это попап после шага 4).
 *
 * ВАЖНО: shadcn/Radix перезаписывают data-slot внутри FormControl/DialogTrigger —
 * у Input он становится 'form-control', у Button внутри DialogTrigger —
 * 'dialog-trigger'. Для тестов надёжнее искать по [data-size],
 * чем по [data-slot='button'].
 *
 * Запуск: node frontend/scripts/visual-tests/verify-popups.mjs
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

const CDP = "http://127.0.0.1:9340";
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

/** Замер попапа: собственные стили контейнера + размеры пунктов. */
const POPUP = (sel, itemSel) => `(()=>{
  const h = el => Math.round(el.getBoundingClientRect().height*100)/100;
  const c = document.querySelector('${sel}');
  if (!c) return JSON.stringify(null);
  const cs = getComputedStyle(c);
  const items = [...c.querySelectorAll('${itemSel}')];
  return JSON.stringify({
    radius: cs.borderRadius,
    shadow: cs.boxShadow,
    maxHeight: cs.maxHeight,
    padding: cs.padding,
    height: h(c),
    scrollHeight: Math.round(c.scrollHeight),
    itemRadius: [...new Set(items.map(e => getComputedStyle(e).borderRadius))],
    itemHeights: [...new Set(items.map(h))],
    itemCount: items.length
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

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "ub-hs5-"));
  const chrome = spawn(
    CHROME,
    [
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--hide-scrollbars",
      "--remote-debugging-port=9340",
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
    const key = async (k, code, vk) => {
      for (const type of ["keyDown", "keyUp"])
        await cdp.send("Input.dispatchKeyEvent", {
          type,
          key: k,
          code,
          windowsVirtualKeyCode: vk,
          nativeVirtualKeyCode: vk,
        });
      await sleep(400);
    };
    const clickAt = async (x, y) => {
      for (const type of ["mousePressed", "mouseReleased"])
        await cdp.send("Input.dispatchMouseEvent", {
          type,
          x,
          y,
          button: "left",
          buttons: 1,
          clickCount: 1,
        });
      await sleep(600);
    };
    const shot = async (name, clip) => {
      const s = await cdp.send(
        "Page.captureScreenshot",
        clip ? { format: "png", clip } : { format: "png" },
      );
      fs.writeFileSync(path.join(OUT, name + ".png"), Buffer.from(s.data, "base64"));
      console.log(`   saved ${name}.png`);
    };
    const setTheme = async (t) => {
      await js(`document.documentElement.setAttribute('data-theme','${t}'); 'ok'`);
      await sleep(500);
    };
    const rectOf = async (sel) =>
      JSON.parse(
        await js(`(()=>{const e=document.querySelector('${sel}');
          if(!e) return JSON.stringify(null);
          const r=e.getBoundingClientRect();
          return JSON.stringify({x:r.x,y:r.y,w:r.width,h:r.height});})()`),
      );

    await cdp.send("Page.navigate", { url: APP + "/" });
    await sleep(2400);
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

    // ── 1. dropdown меню темы
    console.log("1. Dropdown меню темы (light и dark)");
    // Чтобы проверка вьюпорта селекта была осмысленной, нужно >1 пункта.
    // Делаем это ДО первой навигации, иначе react-query отдаст старый кэш.
    const props = await fetch(API + "/properties", {
      headers: { Authorization: `Bearer ${login.access_token}` },
    }).then((r) => r.json());
    const pid = props?.[0]?.id;
    if (pid) {
      const svcs = await fetch(`${API}/properties/${pid}/services`, {
        headers: { Authorization: `Bearer ${login.access_token}` },
      }).then((r) => r.json());
      const have = new Set((svcs ?? []).map((s) => s.service_type_id));
      for (const t of [2, 3, 4]) {
        if (have.has(t)) continue;
        const res = await fetch(`${API}/properties/${pid}/services`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${login.access_token}`,
          },
          body: JSON.stringify({ service_type_id: t }),
        });
        console.log(`   + услуга type=${t}: HTTP ${res.status}`);
      }
    }
    await cdp.send("Page.navigate", { url: APP + "/charges" });
    await sleep(3200);
    for (const th of ["light", "dark"]) {
      await setTheme(th);
      await js(
        `(()=>{const b=document.querySelector('[aria-label="Сменить тему"]');b.focus();return 'ok';})()`,
      );
      await key("Enter", "Enter", 13);
      const drop = JSON.parse(
        await js(POPUP('[data-slot="dropdown-menu-content"]', '[role="menuitem"]')),
      );
      if (!drop) {
        check(`${th}: dropdown открылся`, false, "нет [data-slot=dropdown-menu-content]");
        continue;
      }
      console.log(`   ${th}: ${JSON.stringify(drop)}`);
      check(`${th}: радиус контейнера 12px`, drop.radius === "12px", drop.radius);
      check(
        `${th}: тень = --popup-shadow (0 8px 24px rgba(0,0,0,0.12))`,
        /rgba\(0,\s*0,\s*0,\s*0\.12\)\s*0px\s*8px\s*24px/.test(drop.shadow),
        drop.shadow,
      );
      check(`${th}: max-height 320px`, drop.maxHeight === "320px", drop.maxHeight);
      check(`${th}: паддинг 6px`, drop.padding === "6px", drop.padding);
      check(
        `${th}: пункты радиус 6px`,
        drop.itemRadius.length === 1 && drop.itemRadius[0] === "6px",
        JSON.stringify(drop.itemRadius),
      );
      check(
        `${th}: пункты минимум 44px (${drop.itemCount} шт.)`,
        drop.itemHeights.every((v) => v >= 44),
        JSON.stringify(drop.itemHeights),
      );
      const r = await rectOf('[data-slot="dropdown-menu-content"]');
      if (r) {
        await shot(`dropdown-theme-${th}`, {
          x: Math.max(0, r.x - 16),
          y: Math.max(0, r.y - 16),
          width: r.w + 32,
          height: r.h + 32,
          scale: 3,
        });
      }
      await key("Escape", "Escape", 27);
    }

    // ── 2. dialog
    console.log("2. Dialog «Новое начисление»");
    await setTheme("light");
    await js(`(()=>{const b=[...document.querySelectorAll('[data-size]')]
      .find(e=>/Новое начисление/.test(e.textContent||'')); if(b) b.click(); return 'ok';})()`);
    await sleep(1300);
    const dlg = JSON.parse(
      await js(`(()=>{
        const c=document.querySelector('[data-slot="dialog-content"]');
        if(!c) return JSON.stringify(null);
        const cs=getComputedStyle(c);
        return JSON.stringify({radius:cs.borderRadius, shadow:cs.boxShadow,
          padding:cs.padding, gap:cs.rowGap, maxHeight:cs.maxHeight});
      })()`),
    );
    console.log(`   ${JSON.stringify(dlg)}`);
    check("dialog: радиус 12px", dlg?.radius === "12px", dlg?.radius);
    check(
      "dialog: тень = --popup-shadow",
      /rgba\(0,\s*0,\s*0,\s*0\.12\)\s*0px\s*8px\s*24px/.test(dlg?.shadow ?? ""),
      dlg?.shadow,
    );
    check("dialog: паддинг 24px не сломан", dlg?.padding === "24px", dlg?.padding);
    check("dialog: gap 16px не сломан", dlg?.gap === "16px", dlg?.gap);
    check(
      "dialog: max-height не ограничен 320px",
      dlg?.maxHeight === "none",
      dlg?.maxHeight,
    );

    // ── 3. select внутри диалога
    console.log("3. Select «Услуга» внутри диалога");
    const trig = await rectOf('[data-slot="select-trigger"]');
    if (!trig) {
      check("select: триггер найден", false, "нет [data-slot=select-trigger]");
    } else {
      await clickAt(trig.x + trig.w / 2, trig.y + trig.h / 2);
      const sel = JSON.parse(
        await js(`(()=>{
          const h = el => Math.round(el.getBoundingClientRect().height*100)/100;
          const c = document.querySelector('[data-slot="select-content"]');
          if (!c) return JSON.stringify(null);
          const cs = getComputedStyle(c);
          const items = [...c.querySelectorAll('[data-slot="select-item"]')];
          const v = items.length ? items[0].parentElement : null;
          return JSON.stringify({
            radius: cs.borderRadius,
            shadow: cs.boxShadow,
            maxHeight: cs.maxHeight,
            contentPadding: cs.padding,
            height: h(c),
            inlineStyle: c.getAttribute('style'),
            varAvailable: cs.getPropertyValue('--radix-select-content-available-height').trim(),
            varPopupMax: cs.getPropertyValue('--popup-max-height').trim(),
            varOptionMin: cs.getPropertyValue('--option-min-height').trim(),
            viewportH: v ? h(v) : null,
            viewportPadding: v ? getComputedStyle(v).padding : null,
            viewportMaxHeight: v ? getComputedStyle(v).maxHeight : null,
            triggerH: h(document.querySelector('[data-slot="select-trigger"]')),
            itemRadius: [...new Set(items.map(e => getComputedStyle(e).borderRadius))],
            itemHeights: [...new Set(items.map(h))],
            itemCount: items.length
          });
        })()`),
      );
      console.log(`   ${JSON.stringify(sel, null, 1)}`);
      check("select: контент открылся", !!sel, "нет [data-slot=select-content]");
      if (sel) {
        check("select: радиус контейнера 12px", sel.radius === "12px", sel.radius);
        check(
          "select: тень = --popup-shadow",
          /rgba\(0,\s*0,\s*0,\s*0\.12\)\s*0px\s*8px\s*24px/.test(sel.shadow),
          sel.shadow,
        );
        check(
          "select: max-height вьюпорта 320px (§11)",
          sel.viewportMaxHeight === "320px",
          sel.viewportMaxHeight,
        );
        check(
          "select: паддинг вьюпорта 6px",
          sel.viewportPadding === "6px",
          sel.viewportPadding,
        );
        check(
          "select: пункты радиус 6px",
          sel.itemRadius.length === 1 && sel.itemRadius[0] === "6px",
          JSON.stringify(sel.itemRadius),
        );
        check(
          `select: пункты минимум 44px (${sel.itemCount} шт.)`,
          sel.itemHeights.length > 0 && sel.itemHeights.every((v) => v >= 44),
          JSON.stringify(sel.itemHeights),
        );
        check(
          "select: вьюпорт НЕ прижат к высоте триггера",
          sel.viewportH !== null && sel.viewportH > sel.triggerH,
          `viewport=${sel.viewportH} trigger=${sel.triggerH}`,
        );
        check(
          `select: видно несколько пунктов (${sel.itemCount} шт.)`,
          sel.itemCount < 2 || sel.viewportH >= 44 * 2,
          `viewport=${sel.viewportH}, пунктов=${sel.itemCount}`,
        );
        const r = await rectOf('[data-slot="select-content"]');
        if (r) {
          await shot("select-popup", {
            x: Math.max(0, r.x - 16),
            y: Math.max(0, r.y - 16),
            width: r.w + 32,
            height: r.h + 32,
            scale: 3,
          });
        }
      }
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
