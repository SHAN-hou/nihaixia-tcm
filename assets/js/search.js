/* 全站检索：文档 / 截图 / PDF 证据 */
(function () {
  "use strict";
  const root = document.body.dataset.root || "";
  const q = document.getElementById("q");
  const go = document.getElementById("go");
  const results = document.getElementById("results");
  const status = document.getElementById("status");
  const hint = document.getElementById("hint");
  const tabs = Array.prototype.slice.call(document.querySelectorAll(".tab"));

  const HINTS = {
    docs: "文档检索：按标题与正文命中，标题权重更高。数据约 1.6MB，首次检索会下载一次。",
    shots: "截图检索：命中「板书描述 / 分类标签 / 课次」，可直接跳转对应画廊。",
    evidence: "PDF 证据检索：按术语与页面摘录反查同步文稿页码，引用格式 pdf-evidence:<doc_id>#p<页>。",
  };

  let scope = "docs";
  let loaded = { docs: false, shots: false, evidence: false };
  let busy = false;

  tabs.forEach(function (t) {
    t.addEventListener("click", function () {
      tabs.forEach(function (x) { x.classList.remove("active"); });
      t.classList.add("active");
      scope = t.dataset.scope;
      hint.textContent = HINTS[scope];
      results.innerHTML = "";
      status.textContent = "";
      if (q.value.trim()) run();
    });
  });

  function setStatus(t) { status.textContent = t || ""; }

  async function ensure(onProgress) {
    if (scope === "docs") {
      setStatus("正在加载课程文档…");
      await NB.docs(onProgress);
    } else if (scope === "shots") {
      setStatus("正在加载截图索引…");
      await NB.galleries(onProgress);
    } else {
      setStatus("正在加载 PDF 证据卡…");
      await NB.evidence(onProgress);
    }
  }

  async function run() {
    const query = q.value.trim();
    if (!query) { results.innerHTML = ""; setStatus(""); return; }
    if (busy) return;
    busy = true; go.disabled = true;
    try {
      await ensure(function (d, n) { setStatus("加载中 " + d + " / " + n + "…"); });
      setStatus("");
      if (scope === "docs") {
        const hits = NB.searchDocs(NB._docs, query, 40);
        renderDocs(hits, query);
      } else if (scope === "shots") {
        const hits = NB.searchShots(NB._galleries, query, 60);
        renderShots(hits, query);
      } else {
        const hits = NB.searchEvidence(NB._evidence, query, "", 60);
        renderEvidence(hits, query);
      }
    } catch (e) {
      setStatus("加载失败：" + e.message);
    } finally {
      busy = false; go.disabled = false;
    }
  }

  function renderDocs(hits, query) {
    if (!hits.length) { results.innerHTML = '<p class="muted">没有命中。试试更短的关键词，或换用「截图 / PDF证据」页签。</p>'; return; }
    results.innerHTML = hits.map(function (h) {
      return '<article class="res">' +
        '<h3><a href="' + h.url + '">' + NB.highlight(h.title, h.terms) + "</a></h3>" +
        '<div class="meta"><span>' + NB.esc(h.module) + "</span><span>评分 " + h.score + "</span></div>" +
        '<div class="snip">' + NB.highlight(NB.snippet(h.text, h.terms, 160), h.terms) + "</div>" +
        '<div class="res-actions"><a class="btn small" href="' + h.url + '">打开文档</a>' +
        '<a class="btn small" href="' + root + 'ask.html?q=' + encodeURIComponent(query) + '">就这个词提问</a></div>' +
        "</article>";
    }).join("");
  }

  function renderShots(hits, query) {
    if (!hits.length) { results.innerHTML = '<p class="muted">没有命中截图说明。</p>'; return; }
    results.innerHTML = hits.map(function (h) {
      return '<article class="res">' +
        '<div class="meta"><span>🖼️ ' + NB.esc(h.gallery) + "</span><span>" + NB.esc(h.lesson) + "</span><span>" + NB.esc(h.time) + "</span>" +
        (h.tags.length ? "<span>" + NB.esc(h.tags.join("、")) + "</span>" : "") + "</div>" +
        '<div class="snip">' + NB.highlight(NB.snippet(h.desc, h.terms, 150), h.terms) + "</div>" +
        '<div class="res-actions"><a class="btn small" href="' + h.img + '" target="_blank" rel="noreferrer">看大图</a>' +
        '<a class="btn small" href="' + h.url + '">进入画廊</a>' +
        '<button class="btn small" data-copy="' + NB.esc("【" + h.gallery + "】" + h.lesson + " " + h.time + " · " + h.desc + " · 截图：" + h.img.replace(root, "")) + '">复制引用</button></div>' +
        "</article>";
    }).join("");
  }

  function renderEvidence(hits, query) {
    if (!hits.length) { results.innerHTML = '<p class="muted">没有命中证据卡。</p>'; return; }
    results.innerHTML = hits.map(function (h) {
      const c = h.card;
      return '<article class="res">' +
        '<div class="meta"><span>📄 ' + NB.esc(c.mod) + "</span><span>" + NB.esc(c.src) + " 第 " + c.page + " 页</span>" +
        "<span><code>" + NB.esc(c.cite) + "</code></span></div>" +
        '<div class="snip">' + NB.highlight(NB.snippet(c.text, h.terms, 170), h.terms) + "</div>" +
        '<div class="res-actions"><button class="btn small" data-copy="' + NB.esc(c.cite + " 《" + c.src + "》" + c.text.slice(0, 120) + "…") + '">复制引用</button></div>' +
        "</article>";
    }).join("");
  }

  results.addEventListener("click", async function (e) {
    const b = e.target.closest("[data-copy]");
    if (!b) return;
    try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = "已复制 ✓"; }
    catch (err) { prompt("复制以下内容：", b.dataset.copy); }
    setTimeout(function () { b.textContent = "复制引用"; }, 1600);
  });

  go.addEventListener("click", run);
  q.addEventListener("keydown", function (e) { if (e.key === "Enter") run(); });

  const init = new URLSearchParams(location.search).get("q");
  if (init) { q.value = init; hint.textContent = HINTS.docs; run(); } else { hint.textContent = HINTS.docs; }
})();
