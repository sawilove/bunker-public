const TAG_LABELS = {
  dev: "Разработка",
  event: "Событие",
  update: "Обновление",
  community: "Сообщество",
};

let categories = [];
let activeCategory = "";
let isDev = false;
let editingMedia = [];
let allPosts = [];

function escapeHtml(s) {
  const el = document.createElement("div");
  el.textContent = s || "";
  return el.innerHTML;
}

function renderMarkdown(body) {
  const text = body || "";
  if (window.marked) {
    try {
      marked.setOptions({ breaks: true, gfm: true });
      return marked.parse(text);
    } catch {
      /* fallback */
    }
  }
  return `<p>${escapeHtml(text).replace(/\n/g, "<br>")}</p>`;
}

function mediaUrl(item) {
  if (!item?.id) return "";
  return BunkerAuth.newsMediaUrl(item.id);
}

function renderMediaBlock(media) {
  if (!media?.length) return "";
  return `<div class="news-card__media">${media
    .map((m) => {
      const url = mediaUrl(m);
      if (m.type === "video") {
        return `<video class="news-card__video" src="${url}" controls playsinline></video>`;
      }
      return `<img class="news-card__image" src="${url}" alt="">`;
    })
    .join("")}</div>`;
}

function renderPostCard(post, devMode) {
  const tag = post.category || post.tag || "dev";
  const devActions = devMode
    ? `<div class="news-card__admin">
        <button type="button" class="btn btn--small" data-edit-news="${escapeHtml(post.id)}">Изменить</button>
        <button type="button" class="btn btn--small btn--danger" data-delete-news="${escapeHtml(post.id)}">Удалить</button>
       </div>`
    : "";
  return `
    <article class="panel news-card news-card--${tag}" data-news-id="${escapeHtml(post.id)}">
      <div class="news-card__meta">
        <span class="news-card__tag">${escapeHtml(TAG_LABELS[tag] || tag)}</span>
        <time class="news-card__date">${escapeHtml(post.date)}</time>
      </div>
      <h2 class="news-card__title">${escapeHtml(post.title)}</h2>
      ${renderMediaBlock(post.media)}
      <div class="news-card__body news-card__body--md">${renderMarkdown(post.body)}</div>
      ${devActions}
    </article>`;
}

function renderFilters() {
  const el = document.getElementById("newsFilters");
  if (!el) return;
  const chips = [
    { id: "", label: "Все" },
    ...categories.map((c) => ({ id: c.id, label: c.label })),
  ];
  el.innerHTML = chips
    .map(
      (c) =>
        `<button type="button" class="news-filters__btn ${activeCategory === c.id ? "news-filters__btn--active" : ""}" data-category="${escapeHtml(c.id)}">${escapeHtml(c.label)}</button>`
    )
    .join("");

  if (isDev) {
    el.innerHTML += `<button type="button" class="btn btn--amber btn--small news-filters__add" id="newsAddBtn">+ Запись</button>`;
    document.getElementById("newsAddBtn")?.addEventListener("click", () => openDevForm());
  }
}

function filterPosts() {
  if (!activeCategory) return allPosts;
  return allPosts.filter((p) => (p.category || p.tag) === activeCategory);
}

async function loadNews() {
  const list = document.getElementById("newsList");
  try {
    if (!BunkerAuth.apiBase()) {
      const res = await fetch("news.json", { cache: "no-store" });
      allPosts = await res.json();
      categories = Object.entries(TAG_LABELS).map(([id, label]) => ({ id, label }));
      renderFilters();
      renderList();
      return;
    }

    const [catData, newsData] = await Promise.all([
      BunkerAuth.getNewsCategories(),
      BunkerAuth.getNews(),
    ]);
    categories = catData.categories || [];
    allPosts = newsData.posts || [];
    renderFilters();
    renderList();
  } catch {
    list.innerHTML = '<p class="form-error">Не удалось загрузить новости.</p>';
  }
}

function renderList() {
  const list = document.getElementById("newsList");
  const posts = filterPosts();
  if (!posts.length) {
    list.innerHTML = '<p class="news-list__empty">Пока нет записей в этой категории.</p>';
    return;
  }
  list.innerHTML = posts.map((p) => renderPostCard(p, isDev)).join("");
}

function showDevError(msg) {
  const el = document.getElementById("newsDevError");
  el.textContent = msg || "";
  el.classList.toggle("hidden", !msg);
}

function resetDevForm() {
  document.getElementById("newsEditId").value = "";
  document.getElementById("newsTitle").value = "";
  document.getElementById("newsBody").value = "";
  document.getElementById("newsDate").value = new Date().toISOString().slice(0, 10);
  document.getElementById("newsCategory").value = "dev";
  document.getElementById("newsMediaFile").value = "";
  editingMedia = [];
  renderMediaPreview();
  document.getElementById("newsDevPanelTitle").textContent = "Новая запись";
  document.getElementById("newsDevCancel").classList.add("hidden");
  showDevError("");
}

function openDevForm(post) {
  const panel = document.getElementById("newsDevPanel");
  panel.classList.remove("hidden");
  if (post) {
    document.getElementById("newsEditId").value = post.id;
    document.getElementById("newsTitle").value = post.title;
    document.getElementById("newsBody").value = post.body;
    document.getElementById("newsDate").value = post.date;
    document.getElementById("newsCategory").value = post.category || "dev";
    editingMedia = [...(post.media || [])];
    document.getElementById("newsDevPanelTitle").textContent = "Редактировать запись";
    document.getElementById("newsDevCancel").classList.remove("hidden");
  } else {
    resetDevForm();
  }
  renderMediaPreview();
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderMediaPreview() {
  const el = document.getElementById("newsMediaPreview");
  if (!editingMedia.length) {
    el.innerHTML = "";
    return;
  }
  el.innerHTML = editingMedia
    .map((m, i) => {
      const url = mediaUrl(m);
      const preview =
        m.type === "video"
          ? `<video src="${url}" controls class="news-media-preview__item"></video>`
          : `<img src="${url}" alt="" class="news-media-preview__item">`;
      return `<div class="news-media-preview__wrap">${preview}
        <button type="button" class="news-media-preview__remove" data-remove-media="${i}">×</button></div>`;
    })
    .join("");
}

async function handleMediaFile(file) {
  if (!file) return;
  const reader = new FileReader();
  const dataUrl = await new Promise((resolve, reject) => {
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const result = await BunkerAuth.uploadNewsMedia(dataUrl, file.type);
  editingMedia.push(result.media);
  renderMediaPreview();
}

function fillCategorySelect() {
  const sel = document.getElementById("newsCategory");
  sel.innerHTML = categories
    .map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.label)}</option>`)
    .join("");
}

document.getElementById("newsFilters")?.addEventListener("click", (e) => {
  const cat = e.target.closest("[data-category]")?.dataset.category;
  if (cat === undefined) return;
  activeCategory = cat;
  renderFilters();
  renderList();
});

document.getElementById("newsDevForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  showDevError("");
  const payload = {
    title: document.getElementById("newsTitle").value,
    body: document.getElementById("newsBody").value,
    category: document.getElementById("newsCategory").value,
    date: document.getElementById("newsDate").value,
    media: editingMedia,
  };
  try {
    const editId = document.getElementById("newsEditId").value;
    if (editId) await BunkerAuth.updateNews(editId, payload);
    else await BunkerAuth.createNews(payload);
    resetDevForm();
    document.getElementById("newsDevPanel").classList.add("hidden");
    const data = await BunkerAuth.getNews();
    allPosts = data.posts || [];
    renderList();
  } catch (err) {
    showDevError(err.message);
  }
});

document.getElementById("newsDevCancel")?.addEventListener("click", () => {
  resetDevForm();
  document.getElementById("newsDevPanel").classList.add("hidden");
});

document.getElementById("newsMediaFile")?.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    await handleMediaFile(file);
  } catch (err) {
    showDevError(err.message);
  }
  e.target.value = "";
});

document.getElementById("newsMediaPreview")?.addEventListener("click", (e) => {
  const idx = e.target.closest("[data-remove-media]")?.dataset.removeMedia;
  if (idx === undefined) return;
  editingMedia.splice(Number(idx), 1);
  renderMediaPreview();
});

document.querySelector(".news-dev-form__toolbar")?.addEventListener("click", (e) => {
  const md = e.target.closest("[data-md]")?.dataset.md;
  if (!md) return;
  const ta = document.getElementById("newsBody");
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const sel = ta.value.slice(start, end) || "текст";
  let insert = md;
  if (md === "**" || md === "*") insert = `${md}${sel}${md}`;
  if (md === "[текст](url)") insert = `[${sel}](https://)`;
  ta.setRangeText(insert, start, end, "end");
  ta.focus();
});

document.getElementById("newsList")?.addEventListener("click", async (e) => {
  const editId = e.target.closest("[data-edit-news]")?.dataset.editNews;
  const deleteId = e.target.closest("[data-delete-news]")?.dataset.deleteNews;
  if (editId) {
    const post = allPosts.find((p) => String(p.id) === String(editId));
    if (post) openDevForm(post);
  }
  if (deleteId && confirm("Удалить эту новость?")) {
    await BunkerAuth.deleteNews(deleteId);
    const data = await BunkerAuth.getNews();
    allPosts = data.posts || [];
    renderList();
  }
});

(async function init() {
  if (BunkerAuth.apiBase() && BunkerAuth.getToken()) {
    const me = await BunkerAuth.fetchMe();
    isDev = !!me?.dev;
  }
  try {
    if (BunkerAuth.apiBase()) {
      const catData = await BunkerAuth.getNewsCategories();
      categories = catData.categories || [];
    } else {
      categories = Object.entries(TAG_LABELS).map(([id, label]) => ({ id, label }));
    }
  } catch {
    categories = Object.entries(TAG_LABELS).map(([id, label]) => ({ id, label }));
  }
  fillCategorySelect();
  resetDevForm();
  document.getElementById("newsDevPanel")?.classList.add("hidden");
  await loadNews();
})();
