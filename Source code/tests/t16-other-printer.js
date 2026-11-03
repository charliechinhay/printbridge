// A job must never come out of a printer nobody chose: "print on another
// one" only picks the same kind of printer, a computer dropping off never
// moves a job, and pages from before 4.2.6 can't turn it on.
const fs = require("fs"), os = require("os"), path = require("path"), assert = require("assert");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pbo-"));
process.env.PRINT_DATA_DIR = dir;
process.env.PRINT_UPLOAD_DIR = path.join(dir, "u");
fs.mkdirSync(process.env.PRINT_UPLOAD_DIR);
let n = 0; const ok = (c, m) => { assert(c, m); n++; console.log("  ok -", m); };

const S = path.join(__dirname, "..", "server");
const { db } = require(S + "/lib/store");
const agents = require(S + "/lib/agents");
const jobs = require(S + "/lib/jobs");

const kind = (name, printerType) => agents.kindOf({ name, printerType });
ok(kind("EPSON LQ-310 ESC/P2") === "dotmatrix" && kind("Epson LX-350") === "dotmatrix" && kind("OKI ML320") === "dotmatrix", "dot matrix printers recognised by name");
ok(kind("EPSON L3250 Series") === "inkjet" && kind("Canon G3010 series") === "inkjet" && kind("HP DeskJet 2700") === "inkjet", "inkjets recognised");
ok(kind("HP LaserJet Pro M404") === "laser" && kind("Canon LBP2900") === "laser" && kind("Brother HL-L2320D series") === "laser", "lasers recognised");
ok(kind("EPSON TM-T82 Receipt") === "thermal", "receipt printers recognised");
ok(kind("Front office") === "unknown" && kind("Front office", "dotmatrix") === "dotmatrix" && kind("EPSON LQ-310", "laser") === "laser", "Manage page's choice wins; unknown names stay unknown");

const online = new Set(["a1", "a2", "a3"]);
agents.isOnline = (id) => online.has(id);
const sent = [];
agents.sendToAgent = (agentId, m) => { sent.push({ agentId, printer: m.printer }); return online.has(agentId); };
db.agents.push({ id: "a1", name: "Desk" }, { id: "a2", name: "Accounts" }, { id: "a3", name: "Store" });
const P = (id, agentId, name) => ({ id, agentId, name, hidden: false, capabilities: null });
db.printers.push(P("laser1", "a1", "HP LaserJet M404"), P("dot1", "a2", "EPSON LQ-310"), P("laser2", "a3", "Canon LBP2900"), P("odd", "a3", "Front office"));

ok(jobs.otherPrinterLike(db.printers[0], {}, []).id === "laser2", "a laser's stand-in is the other laser, never the dot matrix");
ok(jobs.otherPrinterLike(db.printers[1], {}, []) === null, "the only dot matrix has no stand-in");
ok(jobs.otherPrinterLike(db.printers[3], {}, []) === null, "a printer of unknown kind has no stand-in");

const newJob = (printer) => jobs.createJob({ deviceId: "d", label: "x", file: { originalName: "a.pdf", storedPath: path.join(dir, "u", "a.pdf") }, printer, options: {}, allowFailover: true });

// The computer drops off after the job was sent: it waits, on its own printer.
const j1 = newJob(db.printers[1]);
jobs.dispatch(j1);
online.delete("a2");
agents.events.emit("agent-offline", "a2");
ok(j1.printerId === "dot1" && j1.status === "queued", "computer goes off after sending -> job waits for its own printer");
online.add("a2");

// The printer reports a failure: it moves, but only to the same kind.
const j2 = newJob(db.printers[0]);
jobs.dispatch(j2);
agents.events.emit("status", { agentId: "a1", jobId: j2.id, status: "failed", message: "jam" });
ok(j2.printerId === "laser2", "laser fails -> tried on the other laser");
agents.events.emit("status", { agentId: "a3", jobId: j2.id, status: "failed", message: "jam" });
ok(j2.status === "failed" && sent.every((s) => s.printer !== "EPSON LQ-310" || s.agentId === "a2") && j2.printerId === "laser2", "both lasers fail -> it stops, never the dot matrix");

const server = fs.readFileSync(S + "/server.js", "utf8");
ok(!/req\.body\.allowFailover/.test(server) && /req\.body\.tryOtherPrinter/.test(server), "old pages' allowFailover (ticked by default) is ignored");
const page = fs.readFileSync(S + "/public/index.html", "utf8");
ok(/<input id="failover" type="checkbox">/.test(page) && !/options-fold/.test(page), "the option is off by default and the More options fold is gone");

console.log(n + " checks passed");
process.exit(0);
