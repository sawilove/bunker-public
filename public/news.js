const TAG_LABELS = { dev: "Разработка", event: "Событие" };

function escapeHtml(s) {
  const el = document.createElement("div");
  el.textContent = s || "";
  return el.innerHTML;
}

async function loadNews() {
  const list = document.getElementById("newsList");
  try {
    const res = await fetch("news.json", { cache: "no-store" });
    const items = await res.json();
    if (!items.length) {
      list.innerHTML = '<p class="news-list__empty">Пока нет записей.</p>';
      return;
    }
    list.innerHTML = items
      .map(
        (n) => `
      <article class="panel news-card news-card--${n.tag || "dev"}">
        <div class="news-card__meta">
          <span class="news-card__tag">${TAG_LABELS[n.tag] || n.tag}</span>
          <time class="news-card__date">${escapeHtml(n.date)}</time>
        </div>
        <h2 class="news-card__title">${escapeHtml(n.title)}</h2>
        <p class="news-card__body">${escapeHtml(n.body)}</p>
      </article>`
      )
      .join("");
  } catch {
    list.innerHTML = '<p class="form-error">Не удалось загрузить новости.</p>';
  }
}

loadNews();
