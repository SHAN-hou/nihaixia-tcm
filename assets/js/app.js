/* 顶栏抽屉 + PWA 注册 */
(function () {
  "use strict";
  const root = document.body.dataset.root || "";

  const btn = document.getElementById("menuBtn");
  const drawer = document.getElementById("drawer");
  const scrim = document.getElementById("scrim");
  const close = document.getElementById("closeBtn");

  function open() {
    drawer.hidden = false; scrim.hidden = false;
    btn.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
  }
  function shut() {
    drawer.hidden = true; scrim.hidden = true;
    btn.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  }
  if (btn && drawer) {
    btn.addEventListener("click", function () { drawer.hidden ? open() : shut(); });
    if (scrim) scrim.addEventListener("click", shut);
    if (close) close.addEventListener("click", shut);
    drawer.addEventListener("click", function (e) {
      if (e.target.tagName === "A") shut();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !drawer.hidden) shut();
    });
  }

  /* -------------------------------------------------- 资料目录：拖拽调宽 */
  const LS_W = "nb-drawer-w";
  const MIN_W = 200;
  const DEF_W = 340;
  const handle = document.getElementById("drawerResize");

  function maxW() { return Math.max(MIN_W, Math.min(window.innerWidth - 56, 760)); }
  function applyW(w) {
    document.documentElement.style.setProperty("--drawer-w", Math.round(w) + "px");
  }
  function curW() {
    return parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--drawer-w")) || DEF_W;
  }

  // 启动时恢复上次的宽度
  try {
    const saved = parseFloat(localStorage.getItem(LS_W));
    if (saved && saved >= MIN_W) applyW(Math.min(saved, maxW()));
  } catch (e) { /* ignore */ }

  if (handle && drawer) {
    let startX = 0, startW = 0, dragging = false;

    handle.addEventListener("pointerdown", function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      dragging = true;
      startX = e.clientX;
      startW = drawer.getBoundingClientRect().width;
      handle.classList.add("dragging");
      document.body.classList.add("drawer-resizing");
      try { handle.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      e.preventDefault();
    });

    handle.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      const w = Math.min(Math.max(startW + (e.clientX - startX), MIN_W), maxW());
      applyW(w);
      e.preventDefault();
    });

    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      handle.classList.remove("dragging");
      document.body.classList.remove("drawer-resizing");
      try { handle.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      try { localStorage.setItem(LS_W, String(Math.round(curW()))); } catch (err) { /* ignore */ }
    }
    handle.addEventListener("pointerup", endDrag);
    handle.addEventListener("pointercancel", endDrag);

    // 双击复位
    handle.addEventListener("dblclick", function (e) {
      e.preventDefault();
      applyW(DEF_W);
      try { localStorage.removeItem(LS_W); } catch (err) { /* ignore */ }
    });

    // 键盘微调（无障碍）
    handle.addEventListener("keydown", function (e) {
      const step = e.shiftKey ? 48 : 16;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        applyW(Math.min(Math.max(curW() + (e.key === "ArrowRight" ? step : -step), MIN_W), maxW()));
        try { localStorage.setItem(LS_W, String(Math.round(curW()))); } catch (err) { /* ignore */ }
        e.preventDefault();
      } else if (e.key === "Home" || e.key === "0") {
        applyW(DEF_W);
        localStorage.removeItem(LS_W);
        e.preventDefault();
      }
    });

    // 窗口变窄时把超出的宽度收回来
    window.addEventListener("resize", function () {
      const w = curW();
      if (w > maxW()) applyW(maxW());
    });
  }

  /* 截图/文档内的锚点滚动补偿（顶栏高度） */
  document.addEventListener("click", function (e) {
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = decodeURIComponent(a.getAttribute("href").slice(1));
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    const top = el.getBoundingClientRect().top + window.scrollY - 70;
    window.scrollTo({ top: top, behavior: "smooth" });
    history.replaceState(null, "", "#" + encodeURIComponent(id));
  });

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register(root + "sw.js").catch(function () { });
    });
  }
})();
