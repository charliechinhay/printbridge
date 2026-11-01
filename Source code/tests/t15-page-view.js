// Closing the large page view releases its image, and the same page can reopen.
const fs = require("fs"), path = require("path"), vm = require("vm"), assert = require("assert");
let n = 0; const ok = (c, m) => { assert(c, m); n++; console.log("  ok -", m); };
const src = fs.readFileSync(path.join(__dirname, "../server/public/app.js"), "utf8");
const code = src.slice(src.indexOf("function openPageView("), src.indexOf("function setupPageView("));
function element() {
  return {
    children: [], style: {}, hidden: true, clientWidth: 600,
    appendChild(child) { this.children.push(child); },
    set innerHTML(value) { this.children = []; },
  };
}
const ids = Object.fromEntries(["pageView", "pvStage", "pvTitle", "pvChoose", "pvPrev", "pvNext"].map(id => [id, element()]));
const draws = [];
const box = {
  viewPage: 0, MAX_THUMBS: 100, $: id => ids[id],
  document: { createElement: element }, window: { innerHeight: 800 },
  activeEntry: () => ({ pdf: {}, pageCount: 2, pageSizes: {}, chosen: new Set([1]) }),
  placeOnPaper: () => ({ ratio: 595 / 842, left: 0, top: 0, width: 1, height: 1 }),
  drawPageInto(entry, page, holder) { draws.push(page); holder.appendChild(element()); },
};
vm.runInNewContext(code, box);
for (const page of [1, 1, 2]) {
  box.openPageView(page);
  ok(!ids.pageView.hidden && box.viewPage === page, "opens page " + page);
  ok(ids.pvStage.children.length === 1 && draws.at(-1) === page, "renders the requested page");
  box.closePageView();
  ok(ids.pageView.hidden && box.viewPage === 0, "hides and resets the view");
  ok(ids.pvStage.children.length === 0, "releases the large preview subtree");
}
box.closePageView();
ok(ids.pvStage.children.length === 0, "closing an already closed view is harmless");
console.log(n + " checks passed");
