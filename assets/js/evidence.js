/* PDF 页级证据检索 */
(function () {
  "use strict";
  const root = document.body.dataset.root || "";
  const q = document.getElementById("q");
  const go = document.getElementById("go");
  const results = document.getElementById("results");
  const status = document.getElementById("status");
  const bar = document.getElementById("modBar");

  let curMod = "";
  let cards = null;
  let busy = false;
  let page = 0;
  const PAGE = 30;

  async function ensure() {
    if (cards) return;
    status.textContent = "正在加载证据卡…";
    cards = await NB.evidence(function (d, n) { status.textContent = "加载中 " + d + " / " + n + "…"; });
    status.textContent = "";
  }

  async function initBar() {
    const idx = await NB.getJSON(NB.DATA + "evidence-index.json");
    (idx.modules || []).forEach(function (m) {
      const b = document.createElement("button");
      b.className = "fbtn";
      b.dataset.mod = m[0];
      b.innerHTML = NB.esc(m[0]) + " <i>" + m[1] + "</i>";
      bar.appendChild(b);
    });
  }

  function render(list, terms) {
    if (!list.length) { results.innerHTML = '<p class="muted">没有命中。</p>'; return; }
    results.innerHTML = list.map(function (c) {
      const hi = NB.esc(c.cite);
      return '<article class="res">' +
        '<div class="meta"><span>📄 ' + NB.esc(c.mod) + "</span><span>" + NB.esc(c.src) + " · 第 " + c.page + " 页</span>" +
        "<span><code>" + hi + "</code></span></div>" +
        '<div class="snip">' + NB.highlight(NB.snippet(c.text, terms || [], 220), terms || []) + "</div>" +
        '<div class="res-actions"><button class="btn small" data-copy="' + NB.esc(c.cite + " 《" + c.src + "》 第" + c.page + "页：" + c.text.slice(0, 160) + "…") + '">复制引用</button>' +
        (c.terms && c.terms.length ? '<span class="muted small">术语：' + NB.esc(c.terms.slice(0, 6).join("、")) + "</span>" : "") +
        "</div></article>";
    }).join("");
  }

  async function run(reset) {
    if (busy) return;
    busy = true;
    try {
      await ensure();
      const query = (q.value || "").trim();
      if (query) {
        const hits = NB.searchEvidence(cards, query, curMod, 120);
        render(hits.map(function (h) { return h.card; }), NB.terms(query).slice(0, 4));
        status.textContent = "命中 " + hits.length + " 条";
        page = 0;
      } else {
        if (reset !== false) page = 0;
        const pool = cards.filter(function (c) { return !curMod || c.mod === curMod; });
        const slice = pool.slice(page * PAGE, page * PAGE + PAGE);
        render(slice, []);
        status.textContent = "共 " + pool.length + " 条，已显示 " + Math.min(pool.length, (page + 1) * PAGE);
        const more = document.getElementById("moreBtn");
        if (more) more.remove();
        if ((page + 1) * PAGE < pool.length) {
          const b = document.createElement("button");
          b.id = "moreBtn";
          b.className = "btn";
          b.textContent = "加载更多";
          b.addEventListener("click", function () { page++; run(false); });
          results.after(b);
        }
      }
    } catch (e) {
      status.textContent = "加载失败：" + e.message;
    } finally {
      busy = false;
    }
  }

  bar.addEventListener("click", function (e) {
    const b = e.target.closest(".fbtn");
    if (!b) return;
    Array.prototype.forEach.call(bar.querySelectorAll(".fbtn"), function (x) { x.classList.remove("active"); });
    b.classList.add("active");
    curMod = b.dataset.mod || "";
    run(true);
    window.scrollTo({ top: results.offsetTop - 90, behavior: "smooth" });
  });

  results.addEventListener("click", async function (e) {
    const b = e.target.closest("[data-copy]");
    if (!b) return;
    try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = "已复制 ✓"; }
    catch (err) { prompt("复制以下内容：", b.dataset.copy); }
    setTimeout(function () { b.textContent = "复制引用"; }, 1600);
  });

  go.addEventListener("click", function () { run(true); });
  q.addEventListener("keydown", function (e) { if (e.key === "Enter") run(true); });

  initBar().then(function () { run(true); });
})();
