#!/usr/bin/env node
// Checks the release that is live on GitHub, the way the office computers do:
// latest.json must be signed with the update key built into the program, and
// each installer must match its SHA-256 fingerprint in latest.json.
//   node check-live.js
const crypto = require("crypto");
const { PUBLIC_KEYS } = require("../desktop/lib/update-key.js");
const { MANIFEST_URL } = require("../desktop/lib/update-config.js");
const base = MANIFEST_URL.replace(/latest\.json$/, "");
(async () => {
  const get = async (url) => { const r = await fetch(url); if (!r.ok) throw new Error(url + ": " + r.status); return Buffer.from(await r.arrayBuffer()); };
  const manifest = await get(base + "latest.json");
  const sigText = (await get(base + "latest.json.sig")).toString().trim();
  let signed = false;
  for (const k of PUBLIC_KEYS) for (const sig of [Buffer.from(sigText, "base64"), Buffer.from(sigText, "hex")]) {
    try { signed = signed || crypto.verify(null, manifest, crypto.createPublicKey({ key: Buffer.from(k, "base64"), format: "der", type: "spki" }), sig); } catch (e) { /* other format */ }
  }
  const m = JSON.parse(manifest);
  console.log("Version " + m.version + ": signature " + (signed ? "OK" : "WRONG"));
  let ok = signed;
  for (const [name, file] of Object.entries(m.files || {})) {
    if (!file || !file.url || !file.sha256) continue;
    const match = crypto.createHash("sha256").update(await get(file.url)).digest("hex") === file.sha256;
    console.log("  " + name + ": " + (match ? "OK" : "DOESN'T MATCH"));
    ok = ok && match;
  }
  console.log(ok ? "All good." : "Something is wrong: don't let it stand. Publish again.");
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error("Couldn't check: " + e.message); process.exit(1); });
