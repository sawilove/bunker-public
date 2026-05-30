(function () {
  const STICKER_PREFIX = "[[sticker:";
  const STICKER_SUFFIX = "]]";
  const EMOJI_LIST = [
    "😀", "😁", "😂", "🤣", "😊", "😍", "😎", "🤔", "😴", "😢", "😡",
    "👍", "👎", "❤️", "🔥", "☢️",
  ];
  const STICKER_PACKS = [
    {
      id: "rustie_pack",
      title: "Ржавик",
      stickers: [
        { file: "rustie1.png", title: "Ржавик 1" },
        { file: "rustie2.png", title: "Ржавик 2" },
        { file: "rustie3.png", title: "Ржавик 3" },
        { file: "rustie4.png", title: "Ржавик 4" },
        { file: "rustie5.png", title: "Ржавик 5" },
      ],
    },
  ];

  function escapeHtml(str) {
    if (window.BunkerUserBadges?.escapeHtml) return BunkerUserBadges.escapeHtml(str);
    const el = document.createElement("div");
    el.textContent = str;
    return el.innerHTML;
  }

  function parseSticker(body) {
    const text = String(body || "");
    if (!text.startsWith(STICKER_PREFIX) || !text.endsWith(STICKER_SUFFIX)) return null;
    const raw = text.slice(STICKER_PREFIX.length, -STICKER_SUFFIX.length);
    const [key] = raw.split("|");
    if (!key) return null;
    const [packId, file] = key.split("/");
    if (!packId || !file) return null;
    const pack = STICKER_PACKS.find((item) => item.id === packId);
    if (!pack || !pack.stickers.some((s) => s.file === file)) return null;
    const sticker = pack.stickers.find((s) => s.file === file);
    return {
      src: `/stickers/${packId}/${file}`,
      title: sticker?.title || "Стикер",
    };
  }

  function formatStickerBody(packId, file) {
    return `${STICKER_PREFIX}${packId}/${file}${STICKER_SUFFIX}`;
  }

  function renderEmojiButtonsHtml() {
    return EMOJI_LIST.map(
      (emoji) =>
        `<button type="button" class="chat-picker__emoji" data-chat-emoji="${emoji}" aria-label="${emoji}">${emoji}</button>`
    ).join("");
  }

  function renderStickerButtonsHtml() {
    return STICKER_PACKS.map((pack) => {
      const stickers = pack.stickers
        .map((sticker) => {
          const src = `/stickers/${pack.id}/${sticker.file}`;
          const safeTitle = escapeHtml(sticker.title);
          return `<button type="button" class="chat-picker__sticker-btn" data-chat-sticker-pack="${pack.id}" data-chat-sticker-file="${sticker.file}" aria-label="${safeTitle}">
          <img src="${src}" alt="${safeTitle}" loading="lazy" decoding="async">
        </button>`;
        })
        .join("");
      return `<section class="chat-picker__sticker-pack">
        <h4>${escapeHtml(pack.title)}</h4>
        <div class="chat-picker__sticker-grid">${stickers}</div>
      </section>`;
    }).join("");
  }

  window.BunkerChatAttachments = {
    STICKER_PREFIX,
    STICKER_SUFFIX,
    EMOJI_LIST,
    STICKER_PACKS,
    parseSticker,
    formatStickerBody,
    renderEmojiButtonsHtml,
    renderStickerButtonsHtml,
  };
})();
