/* oxlint-disable no-console */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Otb } from "@paradox/otb";

const SOURCES_DIR = resolve(import.meta.dirname, "../vendor");
const OTB_PATH = resolve(import.meta.dirname, "../vendor/772.otb");
const OUT_PATH = resolve(import.meta.dirname, "../src/resources/name-map.json");

// --- Nostalrius items.srv parser ---
// Format: TypeID = N / Name = "..."
// TypeID in 7.72 = cid directly (no sid/cid split in client-only format)
function parseNostalrius(src: string): Map<number, string> {
  const map = new Map<number, string>();
  let currentId: number | null = null;
  for (const raw of src.split("\n")) {
    const line = raw.trim();
    const idMatch = line.match(/^TypeID\s*=\s*(\d+)/);
    if (idMatch) {
      currentId = parseInt(idMatch[1], 10);
      continue;
    }
    const nameMatch = line.match(/^Name\s*=\s*"([^"]*)"/);
    if (nameMatch && currentId !== null) {
      map.set(currentId, nameMatch[1]);
      currentId = null;
    }
  }
  return map;
}

// --- TFS / Canary items.xml parser ---
// Supports <item id="N" name="X" /> and <item fromid="N" toid="M" name="X" />
// IDs here are server IDs (sid); resolved to cid via OTB bridge.
function parseXml(src: string): Map<number, string> {
  const map = new Map<number, string>();
  const single = /<item\s[^>]*\bid="(\d+)"[^>]*\bname="([^"]+)"/g;
  const range = /<item\s[^>]*\bfromid="(\d+)"\s[^>]*\btoid="(\d+)"[^>]*\bname="([^"]+)"/g;

  let m: RegExpExecArray | null;
  while ((m = single.exec(src)) !== null) {
    map.set(parseInt(m[1], 10), m[2]);
  }
  while ((m = range.exec(src)) !== null) {
    const from = parseInt(m[1], 10);
    const to = parseInt(m[2], 10);
    const name = m[3];
    for (let id = from; id <= to; id++) {
      map.set(id, name);
    }
  }
  return map;
}

// --- Build sid->cid map from OTB ---
function buildSidToCid(): Map<number, number> {
  const buf = readFileSync(OTB_PATH);
  const otb = Otb(buf.buffer as ArrayBuffer).load();
  const map = new Map<number, number>();
  for (const [, item] of otb.entries()) {
    map.set(item.sid, item.cid);
  }
  return map;
}

// --- Main ---
const nostalrius = parseNostalrius(
  readFileSync(resolve(SOURCES_DIR, "nostalrius-items.srv"), "utf8"),
);
const tfsRaw = parseXml(readFileSync(resolve(SOURCES_DIR, "tfs-items.xml"), "utf8"));
const canaryRaw = parseXml(readFileSync(resolve(SOURCES_DIR, "canary-items.xml"), "utf8"));

const sidToCid = buildSidToCid();

// Resolve sid->cid for TFS and Canary; fallback sid=cid (safe for 7.72 where sid=cid for most items)
function resolveCid(sid: number): number {
  return sidToCid.get(sid) ?? sid;
}

const tfs = new Map<number, string>();
for (const [sid, name] of tfsRaw) {
  tfs.set(resolveCid(sid), name);
}

const canary = new Map<number, string>();
for (const [sid, name] of canaryRaw) {
  canary.set(resolveCid(sid), name);
}

// Merge: Nostalrius > TFS > Canary
const merged: Record<string, string> = {};

for (const [cid, name] of canary) {
  merged[String(cid)] = name;
}
for (const [cid, name] of tfs) {
  merged[String(cid)] = name;
}
for (const [cid, name] of nostalrius) {
  merged[String(cid)] = name;
}

writeFileSync(OUT_PATH, JSON.stringify(merged, null, 2));

const total = Object.keys(merged).length;
console.log(`name-map.json written: ${total} entries`);
console.log(`  cid 102 = ${merged["102"] ?? "(missing)"}`);
console.log(`  cid 106 = ${merged["106"] ?? "(missing)"}`);
