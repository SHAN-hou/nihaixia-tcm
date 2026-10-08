/* 倪海厦课程知识库 —— 共用数据层与检索内核（无依赖，可离线运行） */
(function () {
  "use strict";

  const root = document.body.dataset.root || "";
  const DATA = root + "assets/data/";

  const NB = {
    root: root,
    DATA: DATA,
    _docs: null,        // [{s,t,m,mn,n,text}]
    _galleries: null,   // [{id,name,count,entries:[...]}]
    _evidence: null,    // [...cards]
    _sources: null,
  };

  /* ------------------------------------------------------------ 基础工具 */
  NB.esc = function (s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  };

  NB.getJSON = async function (url) {
    const r = await fetch(url, { cache: "force-cache" });
    if (!r.ok) throw new Error(url + " -> " + r.status);
    return r.json();
  };

  NB.getText = async function (url) {
    const r = await fetch(url, { cache: "force-cache" });
    if (!r.ok) throw new Error(url + " -> " + r.status);
    return r.text();
  };

  /** 查询词切分：中文按整词，英文按单词，兼容空格/标点分隔 */
  NB.terms = function (q) {
    q = (q || "").trim();
    if (!q) return [];
    const parts = q.split(/[\s,，、;；/|]+/).map(function (s) { return s.trim(); }).filter(Boolean);
    const out = [];
    parts.forEach(function (p) {
      if (/^[\x00-\x7f]+$/.test(p)) {
        if (p.length >= 2) out.push(p.toLowerCase());
      } else {
        out.push(p);
        // 长中文串补 2 字切分，提升召回
        if (p.length >= 3) {
          for (let i = 0; i + 2 <= p.length; i++) out.push(p.substr(i, 2));
        }
      }
    });
    return Array.from(new Set(out)).sort(function (a, b) { return b.length - a.length; });
  };

  NB.count = function (hay, needle) {
    if (!needle) return 0;
    let n = 0, i = 0;
    while ((i = hay.indexOf(needle, i)) !== -1) { n++; i += needle.length; }
    return n;
  };

  NB.highlight = function (text, terms) {
    let out = NB.esc(text);
    const used = [];
    terms.forEach(function (t) {
      if (!t || t.length < 2) return;
      const esc = NB.esc(t);
      if (used.some(function (u) { return u.indexOf(esc) !== -1 || esc.indexOf(u) !== -1; })) return;
      const re = new RegExp(esc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
      if (re.test(out)) { out = out.replace(re, function (m) { return "<mark>" + m + "</mark>"; }); used.push(esc); }
    });
    return out;
  };

  NB.snippet = function (text, terms, width) {
    width = width || 110;
    let pos = -1, hit = "";
    for (const t of terms) {
      const p = text.indexOf(t);
      if (p !== -1) { pos = p; hit = t; break; }
    }
    if (pos === -1) return text.slice(0, width) + (text.length > width ? "…" : "");
    const start = Math.max(0, pos - Math.floor(width / 3));
    const end = Math.min(text.length, start + width);
    return (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
  };

  /* ------------------------------------------------------------ 文档数据 */
  NB.docs = async function (onProgress) {
    if (NB._docs) return NB._docs;
    const index = await NB.getJSON(DATA + "docs-index.json");
    const docs = index.map(function (d) { return Object.assign({ text: "" }, d); });
    let done = 0;
    await Promise.all(docs.map(async function (d) {
      try { d.text = await NB.getText(DATA + "text/" + d.s + ".txt"); } catch (e) { d.text = ""; }
      done++;
      if (onProgress) onProgress(done, docs.length);
    }));
    NB._docs = docs;
    return docs;
  };

  NB.searchDocs = function (docs, query, limit) {
    const terms = NB.terms(query);
    if (!terms.length) return [];
    const hits = [];
    docs.forEach(function (d) {
      let score = 0, matched = 0;
      const tl = (d.t || "").toLowerCase();
      terms.forEach(function (t) {
        const inTitle = NB.count(tl, t);
        const inBody = NB.count(d.text, t);
        if (inTitle || inBody) matched++;
        score += inTitle * 40 + Math.min(inBody, 30);
      });
      if (!score || matched === 0) return;
      score += matched * 6;
      hits.push({ kind: "doc", score: score, slug: d.s, title: d.t, module: d.mn,
                  text: d.text, terms: terms,
                  url: root + "docs/" + d.s + ".html" });
    });
    hits.sort(function (a, b) { return b.score - a.score; });
    return hits.slice(0, limit || 30);
  };

  /* ------------------------------------------------------------ 截图数据 */
  NB.galleries = async function (onProgress) {
    if (NB._galleries) return NB._galleries;
    const meta = await NB.getJSON(DATA + "galleries.json");
    let done = 0;
    await Promise.all(meta.map(async function (g) {
      try { g.entries = await NB.getJSON(DATA + "gallery/" + g.id + ".json"); }
      catch (e) { g.entries = []; }
      done++;
      if (onProgress) onProgress(done, meta.length);
    }));
    NB._galleries = meta;
    return meta;
  };

  NB.searchShots = function (galleries, query, limit) {
    const terms = NB.terms(query);
    if (!terms.length) return [];
    const hits = [];
    galleries.forEach(function (g) {
      (g.entries || []).forEach(function (e) {
        const hay = (e.l || "") + " " + (e.g || []).join(" ") + " " + (e.d || "");
        let score = 0, matched = 0;
        terms.forEach(function (t) {
          const c = NB.count(hay, t);
          if (c) { matched++; score += Math.min(c, 6) * 3; }
        });
        if (!score) return;
        score += matched * 5;
        hits.push({ kind: "shot", score: score, gallery: g.name, galleryId: g.id,
                    lesson: e.l, time: e.t, tags: e.g || [], desc: e.d,
                    url: root + "gallery/" + g.id + ".html",
                    img: root + e.i.replace("assets/", ""),
                    thumb: root + e.i.replace("assets/screenshots/", "screenshots/thumb/"),
                    terms: terms });
      });
    });
    hits.sort(function (a, b) { return b.score - a.score; });
    return hits.slice(0, limit || 40);
  };

  /* ------------------------------------------------------------ PDF 证据 */
  NB.evidence = async function (onProgress) {
    if (NB._evidence) return NB._evidence;
    const idx = await NB.getJSON(DATA + "evidence-index.json");
    NB._sources = idx.sources || [];
    const mods = idx.modules || [];
    const all = [];
    let done = 0;
    await Promise.all(mods.map(async function (m) {
      try {
        const list = await NB.getJSON(DATA + "evidence/" + m[0] + ".json");
        list.forEach(function (c) { all.push(c); });
      } catch (e) { /* ignore */ }
      done++;
      if (onProgress) onProgress(done, mods.length);
    }));
    NB._evidence = all;
    return all;
  };

  NB.searchEvidence = function (cards, query, moduleFilter, limit) {
    const terms = NB.terms(query);
    if (!terms.length) return [];
    const hits = [];
    cards.forEach(function (c) {
      if (moduleFilter && c.mod !== moduleFilter) return;
      const hay = (c.text || "") + " " + (c.terms || []).join(" ") + " " + (c.src || "");
      let score = 0, matched = 0;
      terms.forEach(function (t) {
        const inTerms = (c.terms || []).some(function (x) { return x.indexOf(t) !== -1; });
        const cBody = NB.count(c.text, t);
        if (inTerms || cBody) matched++;
        score += (inTerms ? 12 : 0) + Math.min(cBody, 12);
      });
      if (!score) return;
      score += matched * 5;
      hits.push({ kind: "ev", score: score, card: c, terms: terms });
    });
    hits.sort(function (a, b) { return b.score - a.score; });
    return hits.slice(0, limit || 40);
  };

  NB.sources = function () { return NB._sources || []; };

  /* ------------------------------------------------------------ Service Worker */
  NB.registerSW = function () {
    if (!("serviceWorker" in navigator)) return;
    if (location.protocol === "file:") return;
    window.addEventListener("load", function () {
      navigator.serviceWorker.register(root + "sw.js").catch(function () { });
    });
  };

  window.NB = NB;
})();
