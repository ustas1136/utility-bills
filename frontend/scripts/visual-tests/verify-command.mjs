/**
 * Проверка шага 6 — палитра Ctrl+K как оверлей по §11 Netvision.
 *
 * Меряет computed-значения: радиус контейнера (диалог и cmdk-root),
 * max-height списка (320px), высоту/радиус/gap пунктов, паддинг группы,
 * и подтверждает, что список реально прокручивается.
 * Скриншоты в light и dark.
 *
 * ВАЖНО: shadcn/Radix перезаписывают data-slot внутри FormControl/DialogTrigger —
 * у Input он становится 'form-control', у Button внутри DialogTrigger —
 * 'dialog-trigger'. Для тестов надёжнее искать по [data-size],
 * чем по [data-slot='button'].
 *
 * Запуск: node frontend/scripts/visual-tests/verify-command.mjs
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
const CDP = "http://127.0.0.1:9341";
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

const PROBE = `(()=>{
  const h = el => Math.round(el.getBoundingClientRect().height*100)/100;
  const px = v => v;
  const root = document.querySelector('[cmdk-root]');
  const list = document.querySelector('[cmdk-list]');
  const dialog = document.querySelector('[data-slot="dialog-content"]');
  const items = [...document.querySelectorAll('[cmdk-item]')];
  const groups = [...document.querySelectorAll('[cmdk-group]')];
  const input = document.querySelector('[cmdk-input]');
  if (!root || !list) return JSON.stringify(null);
  const rcs = getComputedStyle(root);
  const lcs = getComputedStyle(list);
  const dcs = dialog ? getComputedStyle(dialog) : null;
  return JSON.stringify({
    dialogRadius: dcs ? dcs.borderRadius : null,
    rootRadius: rcs.borderRadius,
    listMaxHeight: lcs.maxHeight,
    listClientH: h(list),
    listScrollH: Math.round(list.scrollHeight),
    listOverflowY: lcs.overflowY,
    itemCount: items.length,
    itemHeights: [...new Set(items.map(h))],
    itemMinHeight: items.length ? getComputedStyle(items[0]).minHeight : null,
    itemRadius: [...new Set(items.map(e => getComputedStyle(e).borderRadius))],
    itemGap: items.length ? getComputedStyle(items[0]).gap : null,
    itemPadding: items.length ? getComputedStyle(items[0]).padding : null,
    groupPadding: groups.length ? getComputedStyle(groups[0]).padding : null,
    inputH: input ? h(input) : null,
    inputClientH: input ? input.clientHeight : null,
    inputScrollH: input ? input.scrollHeight : null,
    wrapperH: document.querySelector('[cmdk-input-wrapper]')
      ? h(document.querySelector('[cmdk-input-wrapper]'))
      : null,
    iconCenterDelta: (()=>{
      const w = document.querySelector('[cmdk-input-wrapper]');
      const svg = w ? w.querySelector('svg') : null;
      if (!w || !svg || !input) return null;
      const ir = input.getBoundingClientRect(), sr = svg.getBoundingClientRect();
      return Math.round(((sr.top + sr.height/2) - (ir.top + ir.height/2)) * 100) / 100;
    })()
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

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "ub-hs6-"));
  const chrome = spawn(
    CHROME,
    [
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--hide-scrollbars",
      "--remote-debugging-port=9341",
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
    const ctrlK = async () => {
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
    };
    const shot = async (name, clip) => {
      const s = await cdp.send(
        "Page.captureScreenshot",
        clip ? { format: "png", clip } : { format: "png" },
      );
      fs.writeFileSync(path.join(OUT, name + ".png"), Buffer.from(s.data, "base64"));
      console.log(`   saved ${name}.png`);
    };

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
      )}); 'ok'`,
    );
    await cdp.send("Page.navigate", { url: APP + "/charges" });
    await sleep(3200);

    for (const th of ["light", "dark"]) {
      console.log(`Палитра Ctrl+K — ${th}`);
      await js(`document.documentElement.setAttribute('data-theme','${th}'); 'ok'`);
      await sleep(400);
      await ctrlK();
      const p = JSON.parse(await js(PROBE));
      if (!p) {
        check(`${th}: палитра открылась`, false, "нет [cmdk-root]/[cmdk-list]");
        continue;
      }
      console.log(`   ${JSON.stringify(p, null, 1)}`);
      check(`${th}: диалог палитры радиус 12px`, p.dialogRadius === "12px", p.dialogRadius);
      check(`${th}: cmdk-root радиус 12px`, p.rootRadius === "12px", p.rootRadius);
      check(`${th}: список max-height 320px`, p.listMaxHeight === "320px", p.listMaxHeight);
      check(
        `${th}: пункты минимум 44px (${p.itemCount} шт.)`,
        p.itemHeights.length > 0 && p.itemHeights.every((v) => v >= 44),
        JSON.stringify(p.itemHeights),
      );
      check(
        `${th}: min-height пункта = 44px`,
        p.itemMinHeight === "44px",
        p.itemMinHeight,
      );
      check(
        `${th}: радиус пункта 6px`,
        p.itemRadius.length === 1 && p.itemRadius[0] === "6px",
        JSON.stringify(p.itemRadius),
      );
      check(`${th}: gap пункта 8px`, p.itemGap === "8px", p.itemGap);
      check(
        `${th}: поле поиска 44px (§4)`,
        p.inputH === 44,
        `input=${p.inputH}, wrapper=${p.wrapperH}`,
      );
      check(
        `${th}: текст в поле не обрезан`,
        p.inputScrollH <= p.inputClientH,
        `client=${p.inputClientH} scroll=${p.inputScrollH}`,
      );
      check(
        `${th}: иконка поиска по центру поля (Δ<=1px)`,
        p.iconCenterDelta !== null && Math.abs(p.iconCenterDelta) <= 1,
        `Δ=${p.iconCenterDelta}`,
      );
      check(
        `${th}: паддинг группы 6px по обеим осям`,
        p.groupPadding.split(/\s+/).every((v) => v === "6px"),
        p.groupPadding,
      );
      check(
        `${th}: список реально ограничен (scrollHeight > clientHeight)`,
        p.listScrollH > p.listClientH,
        `client=${p.listClientH} scroll=${p.listScrollH}`,
      );
      await shot(`command-palette-${th}`);
      const wr = JSON.parse(
        await js(`(()=>{const w=document.querySelector('[cmdk-input-wrapper]');
          if(!w) return JSON.stringify(null);
          const r=w.getBoundingClientRect();
          return JSON.stringify({x:r.x,y:r.y,w:r.width,h:r.height});})()`),
      );
      if (wr)
        await shot(`command-input-${th}`, {
          x: Math.max(0, wr.x - 8),
          y: Math.max(0, wr.y - 8),
          width: wr.w + 16,
          height: wr.h + 16,
          scale: 3,
        });
      // закрыть палитру
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
