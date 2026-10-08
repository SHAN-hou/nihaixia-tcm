/* AI 问答：本地检索增强 + 自带 API Key + 流式输出 */
(function () {
  "use strict";
  const root = document.body.dataset.root || "";
  const chat = document.getElementById("chat");
  const input = document.getElementById("input");
  const send = document.getElementById("send");
  const stop = document.getElementById("stop");
  const retrInfo = document.getElementById("retrInfo");
  const cfgMsg = document.getElementById("cfgMsg");
  const cfgState = document.getElementById("cfgState");

  const LS = "nb-ask-cfg";
  const SYSTEM = [
    "你是「倪海厦中医课程知识库」的检索助手，只依据下面提供的课程资料片段回答。",
    "要求：",
    "1. 只使用资料片段中的内容作答，不臆造条文、方名、穴名、剂量与页码；资料不足时明确说明「资料中未覆盖」。",
    "2. 回答面向课程学习与中医理论整理，不做诊断、不给个人处方、剂量、煎服法或针灸放血操作步骤。",
    "3. 涉及附子/乌头/细辛/生半夏/硫磺等高风险药、四逆汤辈、大承气汤类峻剂，或肿瘤、妊娠、儿童、急症内容时，提示咨询合格医疗专业人员。",
    "4. 用简体中文，善用表格对比方证；结尾用「依据」列出引用的资料编号。",
  ].join("\n");

  /* ------------------------------------------------------------ 配置 */
  // 站点预置的服务商列表（assets/data/ai-config.json），Key 一律由使用者自己填
  let AI = { providers: [], default: "", systemExtra: "" };

  const C = {
    provider: "", baseUrl: "", model: "", apiKey: "",
    docs: true, shots: true, ev: true,
  };

  function paintState() {
    cfgState.textContent = C.apiKey
      ? "已配置：" + (C.model || "(未填模型)") + " @ " + (C.baseUrl || "(未填地址)")
      : "未配置 Key：只做本地检索并列出依据原文";
  }

  function providerById(id) {
    return AI.providers.filter(function (p) { return p.id === id; })[0] || AI.providers[0] || {};
  }

  function fillProviderSelect() {
    const sel = document.getElementById("provider");
    sel.innerHTML = AI.providers.map(function (p) {
      return '<option value="' + p.id + '">' + NB.esc(p.name) + "</option>";
    }).join("");
  }

  function showProvider(id) {
    const p = providerById(id);
    document.getElementById("provider").value = p.id || "";
    document.getElementById("providerNote").textContent = p.note || "";
    document.getElementById("baseUrl").value = p.baseUrl || "";
    document.getElementById("model").value = p.model || "";
    C.provider = p.id || "";
  }

  function loadCfg() {
    try {
      const raw = localStorage.getItem(LS);
      if (raw) Object.assign(C, JSON.parse(raw));
    } catch (e) { /* ignore */ }
    const pid = C.provider || AI.default || (AI.providers[0] || {}).id || "";
    const p = providerById(pid);
    document.getElementById("provider").value = pid;
    document.getElementById("providerNote").textContent = p.note || "";
    // 已保存过的地址/模型优先，否则用服务商预设
    document.getElementById("baseUrl").value = C.baseUrl || p.baseUrl || "";
    document.getElementById("model").value = C.model || p.model || "";
    document.getElementById("apiKey").value = C.apiKey || "";
    document.getElementById("scDocs").checked = C.docs !== false;
    document.getElementById("scShots").checked = C.shots !== false;
    document.getElementById("scEv").checked = C.ev !== false;
    paintState();
  }

  function readForm() {
    C.provider = document.getElementById("provider").value;
    C.baseUrl = document.getElementById("baseUrl").value.trim().replace(/\/+$/, "");
    C.model = document.getElementById("model").value.trim();
    C.apiKey = document.getElementById("apiKey").value.trim();
    C.docs = document.getElementById("scDocs").checked;
    C.shots = document.getElementById("scShots").checked;
    C.ev = document.getElementById("scEv").checked;
    return C;
  }

  document.getElementById("provider").addEventListener("change", function () {
    showProvider(this.value);
    document.getElementById("cfgMsg").textContent = "";
  });

  document.getElementById("saveCfg").addEventListener("click", function () {
    readForm();
    localStorage.setItem(LS, JSON.stringify(C));
    paintState();
    cfgMsg.textContent = "已保存到本机浏览器";
    setTimeout(function () { cfgMsg.textContent = ""; }, 1800);
  });

  document.getElementById("testCfg").addEventListener("click", async function () {
    const btn = this;
    const cfg = readForm();
    if (!cfg.baseUrl || !cfg.model || !cfg.apiKey) {
      cfgMsg.textContent = "请先填接口地址、模型名和 API Key";
      return;
    }
    btn.disabled = true;
    cfgMsg.textContent = "测试中…";
    const t0 = Date.now();
    try {
      const r = await fetch(cfg.baseUrl + "/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + cfg.apiKey },
        body: JSON.stringify({ model: cfg.model, messages: [{ role: "user", content: "你好" }], max_tokens: 4, stream: false }),
      });
      const txt = await r.text();
      const ms = Date.now() - t0;
      cfgMsg.textContent = r.ok
        ? "✅ 连接成功（" + ms + "ms）"
        : "❌ " + r.status + "：" + txt.slice(0, 160);
    } catch (e) {
      cfgMsg.textContent = "❌ 请求失败：" + e.message + "　（多为接口不允许浏览器直连/CORS，或地址填错）";
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById("clearCfg").addEventListener("click", function () {
    localStorage.removeItem(LS);
    C.apiKey = ""; C.baseUrl = ""; C.model = ""; C.provider = "";
    showProvider(AI.default || (AI.providers[0] || {}).id || "");
    loadCfg();
    cfgMsg.textContent = "已清除本机保存的 Key 与设置";
  });

  (async function initCfg() {
    try {
      AI = await NB.getJSON(NB.DATA + "ai-config.json");
    } catch (e) { /* 离线或文件缺失时用兜底 */ }
    if (!AI.providers || !AI.providers.length) {
      AI.providers = [{ id: "custom", name: "自定义（OpenAI 兼容）", baseUrl: "", model: "", note: "" }];
      AI.default = "custom";
    }
    fillProviderSelect();
    loadCfg();
  })();

  /* ------------------------------------------------------------ 对话渲染 */
  function bubble(role, html) {
    const d = document.createElement("div");
    d.className = "msg " + role;
    d.innerHTML = '<div class="bubble">' + html + "</div>";
    chat.appendChild(d);
    chat.parentNode.scrollTop = 0;
    d.scrollIntoView({ block: "end", behavior: "smooth" });
    return d.querySelector(".bubble");
  }

  /** 极简 Markdown 渲染（标题/列表/粗体/表格/代码/引用） */
  function miniMd(src) {
    let t = NB.esc(src);
    t = t.replace(/```([\s\S]*?)```/g, function (m, c) { return "<pre>" + c.replace(/^\n/, "") + "</pre>"; });
    t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
    t = t.replace(/^\s{0,3}###\s*(.+)$/gm, "<h4>$1</h4>");
    t = t.replace(/^\s{0,3}##\s*(.+)$/gm, "<h3>$1</h3>");
    t = t.replace(/^\s{0,3}#\s*(.+)$/gm, "<h3>$1</h3>");
    t = t.replace(/^\s{0,3}>\s?(.*)$/gm, "<blockquote>$1</blockquote>");
    t = t.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
    // 表格
    const lines = t.split("\n");
    const out = [];
    let tbl = null;
    function flush() {
      if (!tbl) return;
      let head = tbl[0], rows = tbl.slice(1).filter(function (r) { return !/^\s*\|?[\s:|-]+\|?\s*$/.test(r); });
      const cells = function (r) { return r.replace(/^\||\|$/g, "").split("|").map(function (c) { return c.trim(); }); };
      out.push("<table><thead><tr>" + cells(head).map(function (c) { return "<th>" + c + "</th>"; }).join("") + "</tr></thead><tbody>" +
        rows.map(function (r) { return "<tr>" + cells(r).map(function (c) { return "<td>" + c + "</td>"; }).join("") + "</tr>"; }).join("") +
        "</tbody></table>");
      tbl = null;
    }
    lines.forEach(function (ln) {
      if (/^\s*\|.*\|\s*$/.test(ln)) { (tbl = tbl || []).push(ln); return; }
      flush();
      if (/^\s*[-*+]\s+/.test(ln)) out.push("<li>" + ln.replace(/^\s*[-*+]\s+/, "") + "</li>");
      else if (ln.trim() === "") out.push("");
      else out.push("<p>" + ln + "</p>");
    });
    flush();
    let html = out.join("\n");
    html = html.replace(/(<li>[\s\S]*?<\/li>)(?!\s*<li>)/g, "<ul>$1</ul>");
    html = html.replace(/\n{2,}/g, "\n");
    return html;
  }

  /* ------------------------------------------------------------ 检索 */
  async function retrieve(question) {
    const parts = [];
    const cites = [];
    const tasks = [];

    if (C.docs) {
      tasks.push((async function () {
        const docs = await NB.docs();
        const hits = NB.searchDocs(docs, question, 5);
        hits.forEach(function (h, i) {
          const text = NB.snippet(h.text, NB.terms(question), 900);
          parts.push("【文档" + (i + 1) + "】《" + h.title + "》（模块：" + h.module + "）\n" + text);
          cites.push({ label: "《" + h.title + "》", url: root + "docs/" + h.slug + ".html" });
        });
      })());
    }
    if (C.shots) {
      tasks.push((async function () {
        const gs = await NB.galleries();
        const hits = NB.searchShots(gs, question, 6);
        hits.forEach(function (h, i) {
          parts.push("【截图" + (i + 1) + "】" + h.gallery + " · " + h.lesson + " " + h.time +
            "（" + h.tags.join("、") + "）" + h.desc);
          cites.push({ label: "截图：" + h.gallery + " " + h.lesson + " " + h.time, url: h.img });
        });
      })());
    }
    if (C.ev) {
      tasks.push((async function () {
        const cards = await NB.evidence();
        const hits = NB.searchEvidence(cards, question, "", 6);
        hits.forEach(function (h, i) {
          const c = h.card;
          parts.push("【PDF证据" + (i + 1) + "】" + c.cite + " 《" + c.src + "》第" + c.page + "页\n" + c.text.slice(0, 700));
          cites.push({ label: c.cite + " 《" + c.src + "》P" + c.page, url: root + "evidence.html?q=" + encodeURIComponent(question) });
        });
      })());
    }

    retrInfo.textContent = "本地检索中…";
    const settled = await Promise.allSettled(tasks);
    const failed = settled.filter(function (s) { return s.status === "rejected"; }).length;
    retrInfo.textContent = "已取 " + parts.length + " 条依据" + (failed ? "（" + failed + " 类加载失败）" : "");
    return { context: parts.join("\n\n"), cites: cites };
  }

  /* ------------------------------------------------------------ 发送 */
  let ac = null;
  function setBusy(b) {
    send.hidden = b;
    stop.hidden = !b;
    input.disabled = b;
  }

  async function ask(question) {
    const userB = bubble("user", NB.esc(question).replace(/\n/g, "<br>"));
    const botB = bubble("bot", '<span class="muted small">检索资料中…</span>');

    const { context, cites } = await retrieve(question);

    if (!C.apiKey || !C.baseUrl || !C.model) {
      botB.innerHTML = "<p>未配置模型接口，下面是本地检索到的相关依据：</p>" +
        miniMd(context ? context.slice(0, 4000) : "（本地资料中没有找到相关片段）") +
        citesHtml(cites);
      return;
    }

    const messages = [
      { role: "system", content: SYSTEM + (AI.systemExtra ? "\n" + AI.systemExtra : "") },
      { role: "user", content: "资料片段：\n" + (context || "（无）") + "\n\n我的问题：" + question },
    ];

    botB.innerHTML = '<span class="typing"></span>';
    let acc = "";
    ac = new AbortController();
    setBusy(true);
    try {
      const resp = await fetch(C.baseUrl + "/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + C.apiKey },
        body: JSON.stringify({ model: C.model, messages: messages, stream: true, temperature: 0.3 }),
        signal: ac.signal,
      });
      if (!resp.ok) {
        const t = await resp.text();
        botB.innerHTML = "<p>接口返回 " + resp.status + "：</p><pre>" + NB.esc(t.slice(0, 600)) + "</pre>";
        return;
      }
      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const r = await reader.read();
        if (r.done) break;
        buf += dec.decode(r.value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop();
        for (const line of lines) {
          const s = line.trim();
          if (!s.startsWith("data:")) continue;
          const payload = s.slice(5).trim();
          if (payload === "[DONE]") continue;
          try {
            const j = JSON.parse(payload);
            const delta = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content;
            if (delta) { acc += delta; botB.innerHTML = miniMd(acc) + '<span class="typing"></span>'; }
          } catch (e) { /* 忽略不完整分片 */ }
        }
        botB.scrollIntoView({ block: "end" });
      }
      botB.innerHTML = miniMd(acc) + citesHtml(cites);
    } catch (e) {
      if (e.name === "AbortError") botB.innerHTML = miniMd(acc) + '<p class="muted">（已停止）</p>' + citesHtml(cites);
      else botB.innerHTML = "<p>请求失败：" + NB.esc(e.message) + "</p><p class='muted small'>常见原因：接口不支持浏览器直连（CORS）、地址需以 /v1 结尾、Key 无效。</p>";
    } finally {
      ac = null;
      setBusy(false);
      input.focus();
    }
  }

  function citesHtml(cites) {
    if (!cites || !cites.length) return "";
    const seen = {};
    const uniq = cites.filter(function (c) { if (seen[c.label]) return false; seen[c.label] = 1; return true; });
    return '<div class="cites"><b class="small">依据</b>' + uniq.map(function (c) {
      return '<a href="' + c.url + '" ' + (c.url.indexOf("screenshots") !== -1 ? 'target="_blank" rel="noreferrer"' : "") + ">· " + NB.esc(c.label) + "</a>";
    }).join("") + "</div>";
  }

  /* ------------------------------------------------------------ 事件 */
  function submit() {
    const v = input.value.trim();
    if (!v) return;
    input.value = "";
    input.style.height = "auto";
    ask(v);
  }
  send.addEventListener("click", submit);
  stop.addEventListener("click", function () { if (ac) ac.abort(); });
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
  });
  input.addEventListener("input", function () {
    input.style.height = "auto";
    input.style.height = Math.min(130, input.scrollHeight) + "px";
  });
  document.getElementById("clearChat").addEventListener("click", function () {
    chat.innerHTML = "";
    retrInfo.textContent = "";
  });

  const initQ = new URLSearchParams(location.search).get("q");
  if (initQ) { input.value = initQ; input.focus(); }
})();
