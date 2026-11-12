// 垃圾分類小百科：所有頁面共用這一支程式。
// 內容一律從 data/*.json 讀進來再畫出頁面；新增內容改 JSON，不要在這裡寫死物品。
// 每一頁的 <body data-page="..."> 決定要跑下面 PAGES 裡的哪個函式。

const NAV = [
  { page: "index", href: "index.html", text: "物品" },
  { page: "scenes", href: "index.html#scenes", text: "情境" },
  { page: "sources", href: "sources.html", text: "依據資料" },
  { page: "about", href: "about.html", text: "關於這個網站" },
];

const $ = (sel, root = document) => root.querySelector(sel);

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function param(name) {
  return new URLSearchParams(location.search).get(name);
}

async function loadData() {
  const names = ["meta", "items", "scenes", "sources"];
  const res = await Promise.all(
    names.map((n) =>
      fetch(`data/${n}.json`).then((r) => {
        if (!r.ok) throw new Error(`讀不到 data/${n}.json`);
        return r.json();
      })
    )
  );
  const [meta, items, scenes, sources] = res;
  const d = { meta, items, scenes, sources };
  d.bin = Object.fromEntries(meta.bins.map((b) => [b.id, b]));
  d.cat = Object.fromEntries(meta.categories.map((c) => [c.id, c]));
  d.item = Object.fromEntries(items.map((i) => [i.id, i]));
  d.source = Object.fromEntries(sources.map((s) => [s.id, s]));
  return d;
}

// ---------- 小元件 ----------
function binTag(d, id, withWhere = false) {
  const b = d.bin[id];
  if (!b) return esc(id);
  const where = withWhere ? `<span class="bin-where">${esc(b.where)}</span>` : "";
  return `<span><span class="bin" style="--c:${b.color}">${esc(b.name)}</span>${where}</span>`;
}
function itemBins(it) {
  return [...new Set(it.parts.map((p) => p.bin))];
}
function docLink(d, id) {
  const s = d.source[id];
  return `<a href="sources.html#${esc(id)}" title="${esc(s ? s.title : id)}">${esc(id)}</a>`;
}
function scenesOf(d, itemId) {
  return d.scenes.filter((s) => s.items.includes(itemId));
}
function setTitle(text) {
  document.title = text ? `${text}｜垃圾分類小百科` : "垃圾分類小百科";
}

function frame(d, page) {
  const nav = NAV.map((n) => `<a href="${n.href}"${n.page === page ? ' class="on"' : ""}>${n.text}</a>`).join("");
  $("#site-header").innerHTML = `
    <div class="inner">
      <a class="brand" href="index.html"><b>${esc(d.meta.site.name)}</b><span>${esc(d.meta.site.tagline)}</span></a>
      <nav class="site-nav">${nav}</nav>
    </div>`;
  $("#site-footer").innerHTML = `
    <div class="inner">
      資料整理自環境部、全國法規資料庫與各縣市清潔隊的公開資料，詳見<a href="sources.html">依據資料</a>；
      各縣市細節可能不同，實際以所在地清潔隊公告為準。<br>
      本站內容依 <a href="${esc(d.meta.site.repo)}/blob/main/AGENTS.md">AGENTS.md</a> 的規則維護。
      原始碼：<a href="${esc(d.meta.site.repo)}">GitHub</a>
    </div>`;
}

// ---------- 首頁 ----------
function pageIndex(d) {
  setTitle("");
  const main = $("#app");
  const filters = [`<button data-bin="" class="on">全部</button>`]
    .concat(d.meta.bins.map((b) => `<button data-bin="${b.id}"><span class="bin" style="--c:${b.color}">${esc(b.name)}</span></button>`))
    .join("");
  const scenes = [...d.scenes]
    .sort((a, b) => a.level - b.level)
    .map(
      (s) => `<a class="scene-card" href="scene.html?id=${esc(s.id)}">
        <span class="lv">第 ${s.level} 關・車停 ${s.seconds} 秒</span>
        <b>${esc(s.name)}</b><span class="small muted">${s.items.length} 樣物品</span></a>`
    )
    .join("");

  main.innerHTML = `
    <h1>這個要丟哪裡？</h1>
    <p class="lead">一樣東西常常要拆成好幾部分，各自丟到不同地方。輸入名稱或常見叫法，看每個部分丟哪裡、怎麼處理，以及根據哪份資料。</p>
    <div class="search">
      <input id="q" type="search" placeholder="例如：珍奶、電池、發票、床墊" autocomplete="off" aria-label="搜尋物品">
      <div class="filters" id="filters">${filters}</div>
      <div class="count" id="count"></div>
    </div>
    <div id="list"></div>
    <section class="section" id="scenes">
      <h2>依情境練習</h2>
      <p class="muted small" style="margin-top:-6px">四個情境也是期末遊戲的四個關卡。<a href="${esc(d.meta.site.game)}">試玩 3D 雛形</a></p>
      <div class="scenes">${scenes}</div>
    </section>`;

  const q = $("#q");
  let bin = param("bin") || "";
  q.value = param("q") || "";

  const norm = (s) => s.toLowerCase().replace(/\s+/g, "");
  function draw() {
    const key = norm(q.value);
    const hits = d.items.filter((it) => {
      const text = norm([it.name, ...it.aliases, ...it.parts.map((p) => p.part)].join("|"));
      return (!key || text.includes(key)) && (!bin || itemBins(it).includes(bin));
    });
    $("#count").textContent = `共 ${hits.length} 樣`;
    document.querySelectorAll("#filters button").forEach((b) => b.classList.toggle("on", b.dataset.bin === bin));
    if (!hits.length) {
      $("#list").innerHTML = `<div class="panel empty">找不到「${esc(q.value)}」。可以換個叫法試試，或看看<a href="sources.html">依據資料</a>裡有沒有寫到。</div>`;
      return;
    }
    $("#list").innerHTML = d.meta.categories
      .map((c) => {
        const group = hits.filter((it) => it.category === c.id);
        if (!group.length) return "";
        const cards = group
          .map(
            (it) => `<a class="card" href="item.html?id=${esc(it.id)}">
              <b>${esc(it.name)}</b>
              <div class="alias">${esc(it.aliases.join("、")) || "&nbsp;"}</div>
              <div class="tag-row">${itemBins(it).map((x) => binTag(d, x)).join("")}</div></a>`
          )
          .join("");
        return `<section class="cat"><h2>${esc(c.name)}</h2><div class="grid">${cards}</div></section>`;
      })
      .join("");
  }
  q.addEventListener("input", draw);
  $("#filters").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    bin = btn.dataset.bin;
    draw();
  });
  draw();
}

// ---------- 物品頁 ----------
function pageItem(d) {
  const it = d.item[param("id")];
  const main = $("#app");
  if (!it) {
    setTitle("找不到這樣物品");
    main.innerHTML = `<h1>找不到這樣物品</h1><p class="lead">網址裡的 id 不對，或這樣物品還沒收錄。<a href="index.html">回首頁搜尋</a></p>`;
    return;
  }
  setTitle(it.name);
  const rows = it.parts
    .map(
      (p) => `<tr>
        <td class="part">${esc(p.part)}</td>
        <td class="bin-cell">${binTag(d, p.bin, true)}</td>
        <td>${esc(p.how)}</td>
        <td class="docs">${p.docs.map((x) => docLink(d, x)).join("、")}</td></tr>`
    )
    .join("");
  const docIds = [...new Set(it.parts.flatMap((p) => p.docs))];
  const docs = docIds
    .map((id) => {
      const s = d.source[id];
      const link = s.links[0];
      return `<li><a href="sources.html#${esc(id)}">${esc(id)}　${esc(s.title)}</a>
        <div class="small muted">${esc(s.org)}・原始資料：<a href="${esc(link.url)}">${esc(link.name)}</a></div></li>`;
    })
    .join("");
  const inScenes = scenesOf(d, it.id)
    .map((s) => `<li><a href="scene.html?id=${esc(s.id)}">第 ${s.level} 關　${esc(s.name)}</a></li>`)
    .join("");
  const same = d.items
    .filter((x) => x.category === it.category && x.id !== it.id)
    .map((x) => `<a href="item.html?id=${esc(x.id)}">${esc(x.name)}</a>`)
    .join("、");
  const local = it.local_note
    ? `<div class="note local"><h3>各地可能不同</h3><p>${esc(it.local_note)}</p></div>`
    : "";

  main.innerHTML = `
    <div class="crumb"><a href="index.html">物品</a> ／ ${esc(d.cat[it.category].name)}</div>
    <h1>${esc(it.name)}</h1>
    ${it.aliases.length ? `<p class="lead">也叫：${esc(it.aliases.join("、"))}</p>` : ""}
    <section class="section">
      <h2>怎麼丟${it.parts.length > 1 ? `（拆成 ${it.parts.length} 個部分）` : ""}</h2>
      <table class="how">
        <thead><tr><th>部分</th><th>丟哪裡</th><th>怎麼處理</th><th>依據</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
    <section class="section notes">
      <div class="note say"><h3>清潔隊大哥說</h3><p>${esc(it.brother)}</p></div>
      <div class="note miss"><h3>最常丟錯的地方</h3><p>${esc(it.mistake)}</p></div>
      ${local}
    </section>
    <section class="section two">
      <div class="panel"><h2>依據資料</h2><ul class="plain">${docs}</ul></div>
      <div class="panel"><h2>出現在這些情境</h2>
        ${inScenes ? `<ul class="plain">${inScenes}</ul>` : `<p class="muted">還沒放進任何情境。</p>`}
        ${same ? `<h3 style="margin-top:16px">同類的其他物品</h3><p style="margin:4px 0 0">${same}</p>` : ""}
      </div>
    </section>
    <p class="small muted section">最後更新：${esc(it.updated)}・物品代碼 <code>${esc(it.id)}</code></p>`;
}

// ---------- 情境頁 ----------
function pageScene(d) {
  const sc = d.scenes.find((s) => s.id === param("id"));
  const main = $("#app");
  if (!sc) {
    setTitle("找不到這個情境");
    main.innerHTML = `<h1>找不到這個情境</h1><p class="lead"><a href="index.html#scenes">回情境列表</a></p>`;
    return;
  }
  setTitle(sc.name);
  const rows = sc.items
    .map((id) => d.item[id])
    .map(
      (it) => `<tr>
        <td class="part"><a href="item.html?id=${esc(it.id)}">${esc(it.name)}</a></td>
        <td colspan="3">${it.parts
          .map((p) => `<div class="scene-part">${binTag(d, p.bin)}<span>${esc(p.part)}：${esc(p.how)}</span></div>`)
          .join("")}</td></tr>`
    )
    .join("");
  const others = [...d.scenes]
    .sort((a, b) => a.level - b.level)
    .filter((s) => s.id !== sc.id)
    .map((s) => `<a href="scene.html?id=${esc(s.id)}">第 ${s.level} 關 ${esc(s.name)}</a>`)
    .join("　");
  main.innerHTML = `
    <div class="crumb"><a href="index.html#scenes">情境</a> ／ 第 ${sc.level} 關</div>
    <h1>${esc(sc.name)}</h1>
    <p class="lead">${esc(sc.desc)}</p>
    <p class="small muted">遊戲裡垃圾車停 ${sc.seconds} 秒・共 ${sc.items.length} 樣物品</p>
    <section class="section">
      <table class="how"><thead><tr><th>物品</th><th colspan="3">每個部分丟哪裡</th></tr></thead><tbody>${rows}</tbody></table>
    </section>
    <p class="section small">其他情境：${others}</p>`;
}

// ---------- 依據資料頁 ----------
function pageSources(d) {
  setTitle("依據資料");
  const citedBy = {};
  d.items.forEach((it) =>
    it.parts.forEach((p) =>
      p.docs.forEach((id) => {
        (citedBy[id] = citedBy[id] || new Set()).add(it.id);
      })
    )
  );
  const list = d.sources
    .map((s) => {
      const users = [...(citedBy[s.id] || [])].map((id) => `<a href="item.html?id=${id}">${esc(d.item[id].name)}</a>`).join("、");
      const links = s.links.map((l) => `<li><a href="${esc(l.url)}">${esc(l.name)}</a></li>`).join("");
      return `<article class="panel source" id="${esc(s.id)}">
        <span class="id">${esc(s.id)}</span>
        <h2 style="margin:2px 0 0">${esc(s.title)}</h2>
        <div class="small muted">${esc(s.org)}・整理日期 ${esc(s.collected)}</div>
        <p>${esc(s.summary)}</p>
        <div class="small"><b>原始資料</b><ul style="margin:4px 0 8px">${links}</ul></div>
        <div class="small"><b>引用這份的物品：</b>${users || '<span class="muted">目前沒有</span>'}</div>
      </article>`;
    })
    .join("");
  $("#app").innerHTML = `
    <h1>依據資料</h1>
    <p class="lead">每一個部件的丟法都要對應到下面其中一份資料。這 ${d.sources.length} 份是第七週為 RAG 作業整理的公開資料摘要，原始網址都列在各篇下面。</p>
    <section class="section">${list}</section>`;
}

// ---------- 關於頁 ----------
async function pageAbout(d) {
  setTitle("關於這個網站");
  const partCount = d.items.reduce((n, it) => n + it.parts.length, 0);
  const bins = d.meta.bins
    .map((b) => `<tr><td><code>${b.id}</code></td><td>${binTag(d, b.id)}</td><td>${esc(b.where)}</td>
      <td><a href="index.html?bin=${b.id}">看這類物品</a></td></tr>`)
    .join("");
  $("#app").innerHTML = `
    <h1>關於這個網站</h1>
    <p class="lead">這是我在 TAICA「生成式 AI」課程的作業，也是期末專案「清潔隊大哥的分類挑戰」的資料來源。網站內容全部放在 <code>data/</code> 的 JSON 裡，頁面只負責把資料畫出來；新增內容的規則寫在 <code>AGENTS.md</code>，讓 AI 照同一套方式繼續加。</p>
    <section class="section stats">
      <div class="panel stat"><b>${d.items.length}</b>樣物品（${partCount} 個部件）</div>
      <div class="panel stat"><b>${d.sources.length}</b>份依據資料</div>
      <div class="panel stat"><b>${d.scenes.length}</b>個情境</div>
    </section>
    <section class="section">
      <h2>去處代碼</h2>
      <p class="muted small" style="margin-top:-6px">和期末遊戲共用同一組代碼，所以不能隨意更改。</p>
      <table class="plain"><thead><tr><th>代碼</th><th>名稱</th><th>交給誰</th><th></th></tr></thead><tbody>${bins}</tbody></table>
    </section>
    <section class="section two">
      <div class="panel">
        <h2>新增一樣物品的流程</h2>
        <ol class="steps">
          <li>先搜尋，確定這樣物品還沒收錄</li>
          <li>在依據資料裡找到寫法；找不到就先不加</li>
          <li>照 <code>templates/item.template.json</code> 的格式加到 <code>data/items.json</code></li>
          <li>需要的話把它放進 <code>data/scenes.json</code> 的情境</li>
          <li>執行 <code>python tools/check.py</code>，全部通過</li>
          <li>在 <code>CHANGELOG.md</code> 記一筆</li>
        </ol>
      </div>
      <div class="panel">
        <h2>專案檔案</h2>
        <ul class="plain small">
          <li><code>AGENTS.md</code>　給 AI 的專案規則</li>
          <li><code>data/</code>　物品、情境、依據資料、代碼表</li>
          <li><code>assets/</code>　共用的樣式與程式</li>
          <li><code>tools/check.py</code>　檢查資料有沒有照規則寫</li>
          <li><code>templates/</code>　新增內容用的範本</li>
        </ul>
        <p class="small" style="margin:10px 0 0"><a href="${esc(d.meta.site.repo)}">到 GitHub 看原始碼</a></p>
      </div>
    </section>
    <section class="section">
      <h2>AGENTS.md 全文</h2>
      <pre class="rules" id="rules">讀取中…</pre>
    </section>`;

  // GitHub Pages 可能把 .md 轉成網頁，所以先讀 GitHub 上的原始檔，失敗再讀本機的
  const raw = d.meta.site.repo.replace("https://github.com/", "https://raw.githubusercontent.com/") + "/main/AGENTS.md";
  for (const url of [raw, "AGENTS.md"]) {
    try {
      const r = await fetch(url);
      if (r.ok) {
        $("#rules").textContent = await r.text();
        return;
      }
    } catch (e) { /* 換下一個網址 */ }
  }
  $("#rules").innerHTML = `讀不到 AGENTS.md，請直接到 <a href="${esc(d.meta.site.repo)}/blob/main/AGENTS.md">GitHub</a> 查看。`;
}

const PAGES = { index: pageIndex, item: pageItem, scene: pageScene, sources: pageSources, about: pageAbout };

(async function start() {
  const page = document.body.dataset.page;
  try {
    const d = await loadData();
    frame(d, page === "scene" ? "scenes" : page === "item" ? "index" : page);
    await PAGES[page](d);
  } catch (e) {
    $("#app").innerHTML = `<h1>頁面載入失敗</h1>
      <p class="lead">${esc(e.message)}。如果是直接雙擊打開 HTML，瀏覽器會擋住讀取 JSON，請在專案資料夾執行 <code>python -m http.server 8000</code>，再打開 <code>http://localhost:8000</code>。</p>`;
    console.error(e);
  }
})();
