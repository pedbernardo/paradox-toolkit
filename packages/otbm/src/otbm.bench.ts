/**
 * OTBM parse throughput benchmark
 *
 * pnpm bench                              -- all available fixtures, sequential
 * pnpm bench -- local.xlarge-v1          -- single fixture (with or without .otbm)
 * pnpm bench -- --profile                -- all fixtures + CPU profile
 * pnpm bench -- local.xlarge-v1 --profile
 */
/* oxlint-disable no-console */
import { readFileSync, existsSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Session } from "node:inspector/promises";
import { Otbm } from "./otbm.js";

// Baseline: 2026-05-25, Node 22, Windows 11 (stream parser + typed arrays)
// fixture                          size      parse    MB/s       tiles       items  towns
// small-v1.fixture.otbm            3.1MB     262ms    11.8     271,484     368,625      2
// oldmap-v0.fixture.otbm           0.5MB      39ms    12.8      62,382      75,352      1
// local.large-v0.otbm              3.8MB     395ms     9.6     461,023     513,522      3
// local.medium-v1.otbm            11.6MB   1,111ms    10.4   1,073,788   1,348,935      5
// local.medium-v2.otbm            33.0MB   4,283ms     7.7   3,342,051   4,354,448      5
// local.xlarge-v1.otbm            78.7MB   9,264ms     8.5   7,835,011   8,602,187     10  (smoke run)
//
// Bottleneck: object allocation per tile/item — byte scanning is constant across sizes.

const FIXTURES_DIR = join(import.meta.dirname, "../fixtures");
const PASSTHROUGH_LOOKUP = { getBySid: (sid: number) => ({ cid: sid }) };
const isTTY = process.stdout.isTTY;

const args = process.argv.slice(2);
const enableProfile = args.includes("--profile");
const targetName = args.find((a) => !a.startsWith("--"));

function resolveFixtureName(name: string): string {
  return name.endsWith(".otbm") ? name : `${name}.otbm`;
}

function discoverFixtures(): string[] {
  return readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith(".otbm"))
    .sort((a, b) => statSync(join(FIXTURES_DIR, a)).size - statSync(join(FIXTURES_DIR, b)).size);
}

function isV0(name: string): boolean {
  return name.includes("-v0");
}

function pad(s: string | number, n: number): string {
  return String(s).padStart(n);
}

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

const CW = { fixture: 33, size: 7, parse: 9, mbs: 5, tiles: 9, items: 10, towns: 5 };

function runOne(name: string): void {
  const path = join(FIXTURES_DIR, name);
  if (!existsSync(path)) {
    console.error(`fixture not found: ${name}`);
    process.exit(1);
  }

  const sizeMb = statSync(path).size / 1024 / 1024;
  const prefix = `  ${name.padEnd(CW.fixture)} ${pad(sizeMb.toFixed(1) + "MB", CW.size)}`;

  let lastPct = -1;
  const onProgress =
    isTTY && sizeMb > 10
      ? (pct: number) => {
          const pct100 = Math.min(100, Math.round(pct * 100));
          if (pct100 !== lastPct) {
            process.stdout.write(`\r${prefix}  parsing ${pad(pct100, 3)}%`);
            lastPct = pct100;
          }
        }
      : undefined;

  const buf = readFileSync(path);
  const arr = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);

  const factoryOpts = isV0(name) ? { lookup: PASSTHROUGH_LOOKUP } : undefined;
  const loadOpts = onProgress !== undefined ? { onProgress } : undefined;
  const t0 = Date.now();
  const file = Otbm(factoryOpts).load(arr, loadOpts);
  const ms = Date.now() - t0;
  const s = file.getStats();

  const mbsStr = (sizeMb / (ms / 1000)).toFixed(1);
  const row =
    `${isTTY && onProgress ? "\r\x1b[K" : ""}${prefix}` +
    `  ${pad(fmt(ms) + "ms", CW.parse)}` +
    `  ${pad(mbsStr, CW.mbs)}` +
    `  ${pad(fmt(s.tiles), CW.tiles)}` +
    `  ${pad(fmt(s.items), CW.items)}` +
    `  ${pad(s.towns, CW.towns)}\n`;
  process.stdout.write(row);
}

async function main() {
  const fixtures = targetName ? [resolveFixtureName(targetName)] : discoverFixtures();

  console.log(
    `\notbm.bench — ${fixtures.length} fixture(s)${enableProfile ? " [profiling]" : ""}\n`,
  );

  const hr = (w: number) => "-".repeat(w);
  console.log(
    `  ${"fixture".padEnd(CW.fixture)} ${"size".padStart(CW.size)}` +
      `  ${"parse".padStart(CW.parse)}  ${"MB/s".padStart(CW.mbs)}` +
      `  ${"tiles".padStart(CW.tiles)}  ${"items".padStart(CW.items)}  ${"towns".padStart(CW.towns)}`,
  );
  console.log(
    `  ${hr(CW.fixture)} ${hr(CW.size)}  ${hr(CW.parse)}  ${hr(CW.mbs)}  ${hr(CW.tiles)}  ${hr(CW.items)}  ${hr(CW.towns)}`,
  );

  let session: InstanceType<typeof Session> | null = null;
  if (enableProfile) {
    session = new Session();
    session.connect();
    await session.post("Profiler.enable");
    await session.post("Profiler.setSamplingInterval", { interval: 100 });
    await session.post("Profiler.start");
  }

  for (const name of fixtures) {
    runOne(name);
  }

  if (session !== null) {
    const result = (await session.post("Profiler.stop")) as { profile: object };
    const filename = `CPU.${Date.now()}.cpuprofile`;
    writeFileSync(filename, JSON.stringify(result.profile));
    session.disconnect();
    console.log(`\nProfile: ${filename}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
