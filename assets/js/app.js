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
