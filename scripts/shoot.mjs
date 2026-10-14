// Visual smoke test: drives the running dev server in Chrome, captures console
// errors and screenshots of a few scenes. Usage:
//   node scripts/shoot.mjs [outDir] [url]
// Needs a Chrome/Chromium; set CHROME=/path/to/chrome if auto-detect fails.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";

const out = process.argv[2] ?? "shots";
const url = process.argv[3] ?? "http://localhost:3418/";
fs.mkdirSync(out, { recursive: true });

function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const base = path.join(os.homedir(), "Library/Caches/ms-playwright");
  if (fs.existsSync(base)) {
    for (const d of fs.readdirSync(base).filter((d) => d.startsWith("chromium-")).sort().reverse()) {
      const app = fs.readdirSync(path.join(base, d)).find((x) => x.startsWith("chrome-mac"));
      if (app) {
        const p = path.join(base, d, app, "Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing");
        if (fs.existsSync(p)) return p;
      }
    }
  }
  return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
}

const browser = await chromium.launch({ executablePath: findChrome(), headless: true, args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: Number(process.env.W ?? 1440), height: Number(process.env.H ?? 900) }, deviceScaleFactor: 1 });
const errors = [];
const external = new Set();
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));
page.on("request", (r) => {
  const u = new URL(r.url());
  if (!["localhost", "127.0.0.1"].includes(u.hostname) && u.protocol.startsWith("http")) external.add(u.hostname);
});
await page.goto(url);
await page.waitForFunction(() => window.bmhSim?.sim, null, { timeout: 60000 });
await page.waitForTimeout(1500); // dev StrictMode mounts twice — let the second instance settle
if (process.env.SIM_KEY) {
  // live mode for this run only — configured in memory, never saved to storage
  await page.evaluate((key) => {
    const { sim } = window.bmhSim;
    sim.mind.configure({ provider: "gateway", apiKey: key, baseUrl: "", models: { mind: "google/gemini-3.8-flash", director: "google/gemini-3.8-flash" }, budgetUsd: 1 });
  }, process.env.SIM_KEY);
}
if (process.env.NOBLOOM) await page.evaluate(() => { window.bmhSim.view.bloom.enabled = false; });
const wait = (ms) => page.waitForTimeout(ms);
const sim = (fn, arg) => page.evaluate(fn, arg);
const shot = async (name) => {
  await page.screenshot({ path: path.join(out, `${name}.png`) });
  console.log("shot", name);
};

const scenes = (process.env.SCENES ?? "overview,day,events,night").split(",");
for (const sc of scenes.filter((x) => x.startsWith("at"))) {
  // at13 → jump to 13:00 same day, shoot the overview
  const h = Number(sc.slice(2));
  await sim((hh) => { const { sim } = window.bmhSim; sim.clock.minutes = Math.floor(sim.clock.minutes / 1440) * 1440 + hh * 60; sim.speed = 1; }, h);
  await wait(3500);
  await shot(`at-${h}`);
}
if (scenes.includes("overview")) {
  await wait(3000);
  await shot("01-dawn-overview");
}
if (scenes.includes("day")) {
  await sim(() => { const { sim } = window.bmhSim; sim.speed = 64; });
  await wait(4500); // ~2.4 sim hours
  await sim(() => { const { sim } = window.bmhSim; sim.speed = 1; });
  await wait(1500);
  await shot("02-morning");
  await sim(() => {
    const { sim, view } = window.bmhSim;
    const r = sim.residents.find((x) => x.a.state !== "inside") ?? sim.residents[0];
    sim.selected = r.a.id;
    view.focus(r.a.x, r.a.z, 70);
  });
  await wait(2500);
  await shot("03-follow-resident");
  await sim(() => { window.bmhSim.sim.selected = null; });
}
if (scenes.includes("events")) {
  await sim(async () => {
    const { sim, view } = window.bmhSim;
    await sim.injectEvent("Cháy lớn ở Hàng Bạc");
    const ev = sim.events.at(-1);
    view.focus(ev.place.x, ev.place.z, 160);
  });
  await sim(() => { window.bmhSim.sim.speed = 4; });
  await wait(9000);
  await shot("04-fire");
  await sim(async () => {
    const { sim, view } = window.bmhSim;
    await sim.injectEvent("Đoàn múa lân về Hồ Gươm");
    await sim.injectEvent("Mưa rào bất chợt");
    const ev = sim.events.find((e) => e.kind === "lion_dance");
    view.focus(ev.place.x, ev.place.z, 120);
  });
  await wait(7000);
  await shot("05-lion-rain");
  await sim(async () => {
    const { sim, view } = window.bmhSim;
    await sim.injectEvent("Tàu hỏa chạy qua phố đường tàu");
    const ev = sim.events.at(-1);
    view.focus(ev.place.x, ev.place.z, 140);
  });
  await wait(6000);
  await shot("06-train");
}
if (scenes.includes("night")) {
  await sim(() => {
    const { sim, view } = window.bmhSim;
    for (const e of sim.events) sim.stopEvent(e.id);
    sim.clock.minutes = Math.floor(sim.clock.minutes / 1440) * 1440 + 19 * 60 + 40;
    const lake = sim.world.landmarks[0];
    view.focus(lake.x - 40, lake.z - 120, 520);
    sim.speed = 4;
  });
  await wait(6000);
  await shot("07-night-overview");
  await sim(async () => {
    const { sim, view } = window.bmhSim;
    await sim.injectEvent("Việt Nam vô địch, cả phố đi bão!");
    const ev = sim.events.at(-1);
    view.focus(ev.place.x, ev.place.z + 40, 230);
    sim.speed = 1;
  });
  await wait(12000);
  await shot("08-celebration-night");
  await sim(async () => {
    const { sim, view } = window.bmhSim;
    await sim.injectEvent("Lễ hội đèn lồng Trung thu ở Hàng Mã");
    const ev = sim.events.at(-1);
    view.focus(ev.place.x, ev.place.z, 110);
  });
  await wait(6000);
  await shot("09-lanterns");
}
const stats = await sim(() => {
  const { sim } = window.bmhSim;
  return { time: sim.clock.label("vi"), out: sim.walkers.filter((a) => a.state !== "inside").length, bikes: sim.bikes.filter((b) => b.state === "move").length, actors: sim.actors.length, feed: sim.feed.length, meter: sim.mind.meter, lastError: sim.mind.lastError };
});
console.log(JSON.stringify({ stats, errors: errors.slice(0, 20), external: [...external] }, null, 1));
await browser.close();
