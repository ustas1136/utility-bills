/**
 * Проверяет HTML-отчёт о миграции: структуру, загрузку встроенных картинок,
 * scroll-spy, печатный режим и мобильную раскладку; падает при ошибках в консоли.
 *
 * Запуск:  node frontend/scripts/visual-tests/check-report.mjs
 * Отчёт открывается по file:// из docs/NETVISION-MIGRATION-REPORT.html.
 * Скриншоты проверки кладутся в docs/netvision-shots/.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.UB_SHOTS_DIR
  ? path.resolve(process.env.UB_SHOTS_DIR)
  : path.resolve(DIR, "../../../docs/netvision-shots");
fs.mkdirSync(OUT, { recursive: true });
const FILE = "file://" + path.resolve(DIR, "../../../docs/NETVISION-MIGRATION-REPORT.html");
const CDP = "http://127.0.0.1:9348";
const CHROME = process.env.HOME + "/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
class Conn {
  constructor(ws){this.ws=ws;this.id=0;this.p=new Map();
    ws.addEventListener("message",(e)=>{const m=JSON.parse(e.data);if(m.id===undefined)return;const q=this.p.get(m.id);if(!q)return;this.p.delete(m.id);
      m.error?q.reject(new Error(JSON.stringify(m.error))):q.resolve(m.result);});}
  static async open(u){const ws=new WebSocket(u);await new Promise((res,rej)=>{ws.addEventListener("open",res,{once:true});ws.addEventListener("error",rej,{once:true});});return new Conn(ws);}
  send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.p.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}));});}
}
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "ub-repchk-"));
const chrome = spawn(CHROME,["--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--hide-scrollbars",
  "--remote-debugging-port=9348",`--user-data-dir=${profile}`,"--window-size=1440,1000","about:blank"],{stdio:"ignore"});
const t0=Date.now(); let ok=false;
while(Date.now()-t0<25000){try{if((await fetch(CDP+"/json/version")).ok){ok=true;break;}}catch{} await sleep(300);}
if(!ok) throw new Error("CDP недоступен");
const fails=[]; const check=(n,c,g)=>{console.log(`  ${c?"OK  ":"FAIL"} ${n}${c?"":"  -> "+g}`); if(!c) fails.push(n);};
try{
  const t=await (await fetch(CDP+"/json/new?about:blank",{method:"PUT"})).json();
  const cdp=await Conn.open(t.webSocketDebuggerUrl);
  await cdp.send("Page.enable"); await cdp.send("Runtime.enable");
  const errors=[];
  cdp.ws.addEventListener("message",(e)=>{const m=JSON.parse(e.data);
    if(m.method==="Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.text||"exception");
    if(m.method==="Runtime.consoleAPICalled"&&m.params.type==="error") errors.push(JSON.stringify(m.params.args?.[0]?.value||""));});
  await cdp.send("Emulation.setDeviceMetricsOverride",{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await cdp.send("Page.navigate",{url:FILE}); await sleep(2000);
  const js=async(e)=>(await cdp.send("Runtime.evaluate",{expression:e,returnByValue:true,awaitPromise:true})).result.value;
  const info=JSON.parse(await js(`JSON.stringify({
    title: document.title,
    h1: document.querySelector('h1')?.textContent,
    sections: document.querySelectorAll('section').length,
    navLinks: document.querySelectorAll('#nav a').length,
    tables: document.querySelectorAll('table').length,
    pre: document.querySelectorAll('pre').length,
    imgs: [...document.images].map(i=>({src:i.src.slice(0,30), w:i.naturalWidth, h:i.naturalHeight})),
    printBtn: !!document.querySelector('.print'),
    theme: getComputedStyle(document.body).backgroundColor,
    font: getComputedStyle(document.body).fontFamily.slice(0,40),
    overflowX: document.documentElement.scrollWidth > window.innerWidth + 1
  })`));
  console.log("  " + JSON.stringify({...info, imgs: info.imgs.map(i=>`${i.w}x${i.h}`)}));
  check("заголовок отчёта", /Netvision Design Standard 2.1/.test(info.h1||""), info.h1);
  check("9 разделов в навигации", info.navLinks === 9, info.navLinks);
  check("таблицы отрисованы (3)", info.tables === 3, info.tables);
  check("блоки кода отрисованы (3)", info.pre === 3, info.pre);
  check("три скриншота загрузились", info.imgs.length === 3 && info.imgs.every(i=>i.w>0), JSON.stringify(info.imgs.map(i=>i.w)));
  check("кнопка печати есть", info.printBtn, String(info.printBtn));
  check("тёмный фон по умолчанию", info.theme === "rgb(21, 28, 37)", info.theme);
  check("системный шрифт", /system-ui|BlinkMacSystemFont/.test(info.font), info.font);
  check("нет горизонтального переполнения", !info.overflowX, String(info.overflowX));
  check("нет ошибок в консоли", errors.length === 0, JSON.stringify(errors).slice(0,200));

  // scroll-spy
  await js(`document.getElementById('mapping').scrollIntoView(); 'ok'`); await sleep(900);
  const active = await js(`(document.querySelector('#nav a.active')||{}).textContent || ''`);
  check("scroll-spy подсветил «Маппинг токенов»", active === "Маппинг токенов", active);

  let s = await cdp.send("Page.captureScreenshot",{format:"png"});
  fs.writeFileSync(path.join(OUT,"report-check-top.png"), Buffer.from(s.data,"base64"));
  // печать
  await cdp.send("Emulation.setEmulatedMedia",{media:"print"}); await sleep(600);
  const printBg = await js(`getComputedStyle(document.body).backgroundColor`);
  const sideHidden = await js(`getComputedStyle(document.querySelector('.side')).display`);
  check("в печати белый фон", printBg === "rgb(255, 255, 255)", printBg);
  check("в печати сайдбар скрыт", sideHidden === "none", sideHidden);
  s = await cdp.send("Page.captureScreenshot",{format:"png"});
  fs.writeFileSync(path.join(OUT,"report-check-print.png"), Buffer.from(s.data,"base64"));
  await cdp.send("Emulation.setEmulatedMedia",{media:""});
  // мобильный
  await cdp.send("Emulation.setDeviceMetricsOverride",{width:390,height:844,deviceScaleFactor:2,mobile:true}); await sleep(800);
  const mob = JSON.parse(await js(`JSON.stringify({overflowX: document.documentElement.scrollWidth > window.innerWidth+1,
    cols: getComputedStyle(document.querySelector('.layout')).gridTemplateColumns})`));
  console.log("  мобильный:", JSON.stringify(mob));
  check("мобильный: без переполнения", !mob.overflowX, JSON.stringify(mob));
  s = await cdp.send("Page.captureScreenshot",{format:"png"});
  fs.writeFileSync(path.join(OUT,"report-check-mobile.png"), Buffer.from(s.data,"base64"));
  cdp.ws.close();
} finally { chrome.kill("SIGKILL"); }
console.log(fails.length?`\nПРОВАЛЕНО (${fails.length}): ${fails.join("; ")}`:"\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ");
if(fails.length) process.exitCode=1;
