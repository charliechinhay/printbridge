// "Update PrintBridge now" must say what happened: a message window that
// reads the background program's answer for THIS ask, never an older one.
const assert = require("assert"), fs = require("fs"), path = require("path");
process.env.OP_UPDATE_TEST = "1";
let n = 0; const ok = (c, m) => { assert(c, m); n++; console.log("  ok -", m); };
const u = require("../desktop/lib/updater");
const V = require("../desktop/lib/version").VERSION;
const t0 = 1000;
const out = (state) => u.updateNowOutcome(state, t0);

ok(!out({}).done && !out({ status: "current", statusAt: t0 - 1, lastCheckAt: t0 - 1, lastCheckOk: true }).done, "an answer from before the ask is not used");
ok(/up to date/.test(out({ status: "current", statusAt: t0 + 5, lastCheckAt: t0 + 1 }).text) && out({ status: "current", statusAt: t0 + 5 }).text.includes(V), "already newest -> says so, with the version");
ok(/couldn't reach/.test(out({ lastCheckAt: t0 + 1, lastCheckOk: false, lastError: "x" }).text), "no internet -> says so");
ok(/downloaded now/.test(out({ status: "downloading", statusAt: t0 + 2, latest: { version: "9.9.9" } }).text) && /9\.9\.9/.test(out({ status: "downloading", statusAt: t0 + 2, latest: { version: "9.9.9" } }).text), "new version found -> says which, and that it installs by itself");
ok(/nothing is printing \(a job\)/.test(out({ status: "waiting-quiet", statusAt: t0 + 2, waitingFor: "a job" }).text), "waiting for printing to stop -> says so");
for (const s of ["installing", "waiting-turn", "paused", "manual", "failed", "gave-up", "retry-later", "something-new"]) ok(out({ status: s, statusAt: t0 + 2 }).done && out({ status: s, statusAt: t0 + 2 }).text.length > 20, "status '" + s + "' has a message");

const main = fs.readFileSync(path.join(__dirname, "..", "desktop", "main.js"), "utf8");
ok(/showMessage\(B\.NAME, text\)/.test(main) && !/console\.log\(B\.NAME \+ " is looking/.test(main), "update-now shows a message window, not only a console line");
const win = fs.readFileSync(path.join(__dirname, "..", "desktop", "lib", "win.js"), "utf8");
ok(/MessageBox/.test(win) && /display dialog/.test(win), "message window exists for Windows and Mac");
console.log(n + " checks passed");
