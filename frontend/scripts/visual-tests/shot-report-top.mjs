/**
 * Снимает начало отчёта о миграции и полную страницу в печатном режиме —
 * чтобы глазами проверить вид и печать, не открывая файл вручную.
 *
 * Запуск:  node frontend/scripts/visual-tests/shot-report-top.mjs
 * Кладёт report-top.png и report-print-full.png в docs/netvision-shots/.
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
const CDP="http://127.0.0.1:9349";
const CHROME=process.env.HOME+"/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
class Conn{constructor(ws){this.ws=ws;this.id=0;this.p=new Map();ws.addEventListener("message",e=>{const m=JSON.parse(e.data);if(m.id===undefined)return;const q=this.p.get(m.id);if(!q)return;this.p.delete(m.id);m.error?q.reject(new Error(JSON.stringify(m.error))):q.resolve(m.result);});}
 static async open(u){const ws=new WebSocket(u);await new Promise((res,rej)=>{ws.addEventListener("open",res,{once:true});ws.addEventListener("error",rej,{once:true});});return new Conn(ws);}
 send(method,params={}){const id=++this.id;return new Promise((resolve,reject)=>{this.p.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}));});}}
const profile=fs.mkdtempSync(path.join(os.tmpdir(),"ub-top-"));
const chrome=spawn(CHROME,["--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--hide-scrollbars","--remote-debugging-port=9349",`--user-data-dir=${profile}`,"--window-size=1440,1000","about:blank"],{stdio:"ignore"});
const t0=Date.now();let ok=false;while(Date.now()-t0<25000){try{if((await fetch(CDP+"/json/version")).ok){ok=true;break;}}catch{}await sleep(300);}
try{
  const t=await(await fetch(CDP+"/json/new?about:blank",{method:"PUT"})).json();
  const cdp=await Conn.open(t.webSocketDebuggerUrl);await cdp.send("Page.enable");await cdp.send("Runtime.enable");
  const js=async(e)=>(await cdp.send("Runtime.evaluate",{expression:e,returnByValue:true,awaitPromise:true})).result.value;
  const shot=async(n,full)=>{const s=await cdp.send("Page.captureScreenshot",full?{format:"png",captureBeyondViewport:true}:{format:"png"});
    fs.writeFileSync(path.join(OUT,n),Buffer.from(s.data,"base64"));console.log("  saved",n,Math.round(fs.statSync(path.join(OUT,n)).size/1024)+"KB");};
  await cdp.send("Emulation.setDeviceMetricsOverride",{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await cdp.send("Page.navigate",{url:FILE});await sleep(2200);
  await js(`window.scrollTo(0,0); 'ok'`);await sleep(500);
  await shot("report-top.png");
  // полная страница в печатном режиме
  await cdp.send("Emulation.setEmulatedMedia",{media:"print"});
  const h=await js(`document.documentElement.scrollHeight`); console.log("  высота страницы:",h,"px");
  await cdp.send("Emulation.setDeviceMetricsOverride",{width:1100,height:Math.min(h,12000),deviceScaleFactor:1,mobile:false});
  await sleep(900); await shot("report-print-full.png");
  cdp.ws.close();
} finally { chrome.kill("SIGKILL"); }
