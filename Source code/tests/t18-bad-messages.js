// Malformed messages and cookies from anyone on the network don't crash the main computer.
const fs = require("fs"), os = require("os"), path = require("path"), assert = require("assert"), http = require("http"), { fork } = require("child_process");
const ROOT = path.join(__dirname, "..");
const NODE_PATH = [path.join(ROOT, "agent", "node_modules"), path.join(ROOT, "server", "node_modules"), process.env.NODE_PATH || ""].join(path.delimiter);
const WebSocket = require(path.join(ROOT, "server", "node_modules", "ws"));
const PORT = 3718;
let n = 0; const ok = (c, m) => { assert(c, m); n++; console.log("  ok -", m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function request(method, p, headers, body) {
  return new Promise((resolve) => {
    const req = http.request({ host: "127.0.0.1", port: PORT, method, path: p, headers: Object.assign({ "content-type": "application/json" }, headers) }, (r) => {
      let d = ""; r.on("data", (c) => d += c); r.on("end", () => resolve({ status: r.statusCode, body: d }));
    });
    req.on("error", () => resolve(null));
    req.end(body || undefined);
  });
}
function send(messages) {
  return new Promise((resolve) => {
    const ws = new WebSocket("ws://127.0.0.1:" + PORT + "/agent");
    ws.on("open", () => { for (const m of messages) ws.send(m); setTimeout(() => { ws.terminate(); resolve(); }, 300); });
    ws.on("error", () => resolve());
  });
}

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pbt-"));
  const web = fork(path.join(ROOT, "server", "server.js"), [], {
    silent: true,
    env: Object.assign({}, process.env, { NODE_PATH, PORT: String(PORT), PRINT_DATA_DIR: dir, PRINT_UPLOAD_DIR: path.join(dir, "up"), NO_DISCOVERY: "1" }),
  });
  let exited = false; web.on("exit", () => { exited = true; });
  try {
    for (let i = 0; i < 50 && !(await request("GET", "/api/office-printing")); i++) await sleep(200);
    const alive = async () => !exited && (await request("GET", "/api/office-printing")) !== null;

    await send(["null", "42", '"text"']);
    ok(await alive(), "non-object messages are ignored");
    await send([JSON.stringify({ type: "hello", token: 123 })]);
    ok(await alive(), "a hello with a non-text token is refused, not a crash");

    const added = JSON.parse((await request("POST", "/api/manage/computers", {}, JSON.stringify({ name: "Test" }))).body);
    await send([JSON.stringify({ type: "hello", token: added.token, printers: "x" })]);
    ok(await alive(), "a printer list that isn't a list is ignored");
    await send([JSON.stringify({ type: "hello", token: added.token, printers: [null, 5, { name: "Real" }] }), JSON.stringify({ type: "printers", printers: [null] })]);
    ok(await alive(), "empty or odd printer entries are skipped");

    const page = await request("GET", "/", { cookie: "device=%zz" });
    ok(page && page.status === 200, "a malformed cookie still gets the page");
  } finally {
    web.kill();
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log(n + " checks passed");
})().catch((err) => { console.error(err); process.exit(1); });
