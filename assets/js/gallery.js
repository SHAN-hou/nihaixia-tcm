/* 截图画廊：筛选、分页渲染、灯箱、引用复制 */
(function () {
  "use strict";
  const root = document.body.dataset.root || "";
  const grid = document.getElementById("grid");
  if (!grid) return;

  const figs = Array.prototype.slice.call(grid.querySelectorAll(".shot"));
  const q = document.getElementById("q");
  const lessonSel = document.getElementById("lessonSel");
  const countEl = document.getElementById("count");
  const emptyEl = document.getElementById("empty");
  const tagBtns = Array.prototype.slice.call(document.querySelectorAll(".fbtn"));
  const galleryName = (document.querySelector(".page-title") || {}).textContent || "";
  const modName = galleryName.split("·")[0].trim();

  let curTag = "";
  const PAGE = 60;          // 首屏与每次增量
  let shown = 0;
  let filtered = figs;

  function match(f) {
    if (curTag && (f.dataset.tags || "").split("|").indexOf(curTag) === -1) return false;
    if (lessonSel && lessonSel.value && f.dataset.lesson !== lessonSel.value) return false;
    const kw = (q && q.value || "").trim();
    if (kw) {
      const hay = (f.dataset.tags || "") + " " + (f.querySelector(".shot-desc") || {}).textContent + " " + f.dataset.lesson;
      const terms = kw.split(/[\s,，、]+/).filter(Boolean);
      if (!terms.every(function (t) { return hay.indexOf(t) !== -1; })) return false;
    }
    return true;
  }

  let sentinel = document.createElement("div");
  sentinel.id = "sentinel";
  grid.parentNode.insertBefore(sentinel, grid.nextSibling);

  function render(reset) {
    if (reset) {
      filtered = figs.filter(match);
      shown = 0;
      grid.innerHTML = "";
    }
    const next = filtered.slice(shown, shown + PAGE);
    const frag = document.createDocumentFragment();
    next.forEach(function (f) { frag.appendChild(f); });
    grid.appendChild(frag);
    shown += next.length;
    emptyEl.hidden = filtered.length !== 0;
    countEl.textContent = "显示 " + shown + " / " + filtered.length + " 张";
    sentinel.textContent = shown < filtered.length ? "" : "";
    if (shown < filtered.length) {
      sentinel.hidden = false;
    } else sentinel.hidden = true;
  }

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      if (sentinel.hidden) return;
      if (sentinel.getBoundingClientRect().top < window.innerHeight + 400) render(false);
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);

  if (q) q.addEventListener("input", debounce(function () { render(true); }, 160));
  if (lessonSel) lessonSel.addEventListener("change", function () { render(true); });
  tagBtns.forEach(function (b) {
    b.addEventListener("click", function () {
      tagBtns.forEach(function (x) { x.classList.remove("active"); });
      b.classList.add("active");
      curTag = b.dataset.tag || "";
      render(true);
      window.scrollTo({ top: 0 });
    });
  });
  function debounce(fn, ms) {
    let t; return function () { clearTimeout(t); t = setTimeout(fn, ms); };
  }

  render(true);

  /* ------------------------------------------------------------- 灯箱 */
  const lb = document.getElementById("lightbox");
  const lbImg = document.getElementById("lbImg");
  const lbMeta = document.getElementById("lbMeta");
  const lbOpen = document.getElementById("lbOpen");
  const lbCopy = document.getElementById("lbCopy");
  let cur = null;

  function cite(f) {
    const desc = (f.querySelector(".shot-desc") || {}).textContent || "";
    const full = (f.dataset.cite || desc);
    return "【" + modName + "】" + f.dataset.lessonName + " " + f.dataset.t +
      " · " + full + " · 截图：" + f.dataset.img.replace(root, "");
  }

  grid.addEventListener("click", function (e) {
    const btn = e.target.closest(".shot-btn");
    if (!btn) return;
    const f = btn.closest(".shot");
    cur = f;
    lbImg.src = f.dataset.img;
    lbImg.alt = f.dataset.lessonName + " " + f.dataset.t;
    lbOpen.href = f.dataset.img;
    lbMeta.innerHTML = "<b>" + NB.esc(f.dataset.lessonName) + "</b> · " + NB.esc(f.dataset.t) +
      (f.dataset.tags ? " · " + NB.esc(f.dataset.tags.replace(/\|/g, "、")) : "") +
      "<br>" + NB.esc((f.querySelector(".shot-desc") || {}).textContent || "");
    lb.hidden = false;
    document.body.style.overflow = "hidden";
  });

  function closeLb() { lb.hidden = true; lbImg.src = ""; document.body.style.overflow = ""; }
  document.getElementById("lbClose").addEventListener("click", closeLb);
  lb.addEventListener("click", function (e) { if (e.target === lb) closeLb(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !lb.hidden) closeLb(); });

  lbCopy.addEventListener("click", async function () {
    if (!cur) return;
    const text = cite(cur);
    try {
      await navigator.clipboard.writeText(text);
      lbCopy.textContent = "已复制 ✓";
    } catch (err) {
      prompt("复制以下引用：", text);
    }
    setTimeout(function () { lbCopy.textContent = "复制引用"; }, 1600);
  });
})();
