(function () {

  const content = document.getElementById("profilePageContent");

  const title = document.getElementById("profilePageTitle");

  const tagline = document.getElementById("profilePageTagline");



  let currentUserId = null;

  let friendship = "none";

  let cachedFriends = [];

  let cachedMeta = {};
  let profileScenarioSort = "relevance";

  let editUser = null;



  function getUserIdFromUrl() {

    const params = new URLSearchParams(location.search);

    if (params.get("id")) return params.get("id");

    const m = location.pathname.match(/\/user\/([^/?#]+)\/?$/i);

    return m ? decodeURIComponent(m[1]) : null;

  }



  function isEditFromUrl() {

    return new URLSearchParams(location.search).get("edit") === "1";

  }



  function setEditUrl(enabled) {

    const url = new URL(location.href);

    if (enabled) url.searchParams.set("edit", "1");

    else url.searchParams.delete("edit");

    history.replaceState(null, "", url.pathname + url.search);

  }



  function canUseBanner(user) {

    return !!(user?.dev || user?.premium);

  }



  function profileCatalogCoverSrc(b) {
    if (!b?.coverUrl) return null;
    const base = (BunkerAuth.apiBase?.() || "").replace(/\/$/, "");
    return base ? `${base}${b.coverUrl}` : b.coverUrl;
  }

  function profileScenarioCardHtml(b) {
    const coverSrc = profileCatalogCoverSrc(b);
    const img = coverSrc
      ? `<img class="profile-scenario-card__img" src="${BunkerUserBadges.escapeHtml(coverSrc)}" alt="" loading="lazy">`
      : b.scene
        ? `<img class="profile-scenario-card__img" src="${BunkerUserBadges.escapeHtml(BunkerRuntime.assetUrl(`scenarios/${b.scene}.png`))}" alt="" loading="lazy">`
        : `<span class="profile-scenario-card__placeholder">?</span>`;
    const rating = BunkerScenarioCatalogUi?.formatRatingBadge?.(b) || "";
    const plays = b.playCount != null ? `${b.playCount} игр` : "";
    const hostHref = BunkerAuth.pageUrl("host.html");
    return `<article class="profile-scenario-card">
      <div class="profile-scenario-card__media">${img}</div>
      <div class="profile-scenario-card__body">
        <h4 class="profile-scenario-card__title">${BunkerUserBadges.escapeHtml(b.title)}</h4>
        <p class="profile-scenario-card__meta">${rating}${plays ? `<span>${BunkerUserBadges.escapeHtml(plays)}</span>` : ""}</p>
        <a href="${BunkerUserBadges.escapeHtml(hostHref)}" class="btn btn--small">Играть на ведущем</a>
      </div>
    </article>`;
  }

  async function loadProfileScenarios(userId, publishedCount) {
    const body = content.querySelector("[data-profile-scenarios-body]");
    if (!body || !publishedCount) return;
    try {
      const data = await BunkerAuth.getUserScenarios(userId, profileScenarioSort);
      const list = data.scenarios || [];
      if (!list.length) {
        body.innerHTML = `<p class="profile-scenarios__empty">Нет опубликованных катастроф.</p>`;
        return;
      }
      const sortHtml = BunkerScenarioCatalogUi?.sortSelectHtml?.(profileScenarioSort, "scenario-catalog-sort--profile") || "";
      body.innerHTML = `${sortHtml}<div class="profile-scenarios__grid">${list.map(profileScenarioCardHtml).join("")}</div>`;
      BunkerScenarioCatalogUi?.bindSortSelect?.(body, (sort) => {
        profileScenarioSort = sort;
        loadProfileScenarios(userId, publishedCount);
      });
    } catch (err) {
      body.innerHTML = `<p class="form-error">${BunkerUserBadges.escapeHtml(err.message)}</p>`;
    }
  }

  function renderProfileHero(user, publishedScenarioCount = 0) {

    const av = BunkerAuth.assetUrl(user.avatarUrl || "/icons/default-avatar.svg");

    const frame = BunkerUserBadges.frameClass(user);

    const bannerUrl = user.bannerUrl ? BunkerAuth.assetUrl(user.bannerUrl) : "";

    const bannerBg = bannerUrl

      ? `style="background-image:url('${bannerUrl.replace(/'/g, "%27")}')"`

      : "";



    return `

      <div class="profile-hero ${bannerUrl ? "profile-hero--has-banner" : "profile-hero--default"}" ${bannerBg}>

        <div class="profile-hero__overlay"></div>

        <div class="profile-hero__body">

          <div class="profile-avatar-wrap ${frame}">

            <img class="profile-avatar" src="${av}" alt="">

          </div>

          <div class="profile-header__info">

            <h2 class="profile-nickname">${BunkerUserBadges.escapeHtml(user.nickname)}</h2>

            <div class="profile-badges">${BunkerUserBadges.roleBadgesHtml(user)}</div>

            ${BunkerUserBadges.statusHtml(user)}

            <div class="profile-stats">

              <span class="profile-stat">Игр: <strong>${user.gamesPlayed ?? 0}</strong></span>

              <span class="profile-stat">Выживаний: <strong>${user.bunkerSurvivals ?? 0}</strong></span>

              ${publishedScenarioCount > 0 ? `<span class="profile-stat">Катастроф в каталоге: <strong>${publishedScenarioCount}</strong></span>` : ""}

            </div>

            ${user.bio?.trim() ? `<p class="profile-hero__bio">${BunkerUserBadges.escapeHtml(user.bio)}</p>` : ""}

          </div>

        </div>

      </div>`;

  }



  function renderFriendRow(user) {

    const av = BunkerAuth.assetUrl(user.avatarUrl || "/icons/default-avatar.svg");

    const profileHref = BunkerAuth.profileUrl(user);

    return `

      <li class="profile-friends__item ${BunkerUserBadges.frameClass(user)}">

        <a href="${profileHref}" class="profile-friends__link">

          <img class="profile-friends__avatar" src="${av}" alt="">

          <span class="profile-friends__name">${BunkerUserBadges.escapeHtml(user.nickname)}</span>

        </a>

      </li>`;

  }



  function renderFriendsSidebar(friends, friendsCount, friendsHidden) {

    const count = friendsCount ?? friends?.length ?? 0;

    let listHtml;

    if (friendsHidden && friendship !== "self") {

      listHtml = '<p class="profile-friends__empty">Список друзей скрыт.</p>';

    } else if (!friends?.length) {

      listHtml = '<p class="profile-friends__empty">Пока нет друзей.</p>';

    } else {

      listHtml = `<ul class="profile-friends">${friends.map(renderFriendRow).join("")}</ul>`;

    }



    return `

      <aside class="profile-page-sidebar">

        <h3 class="profile-page-sidebar__title">Друзья <span class="profile-page-sidebar__count">${count}</span></h3>

        ${listHtml}

      </aside>`;

  }



  function renderProfileEdit(user) {

    const av = BunkerAuth.avatarUrlForUser

      ? BunkerAuth.avatarUrlForUser(user)

      : BunkerAuth.assetUrl(user.avatarUrl || "/icons/default-avatar.svg");

    const frame = BunkerUserBadges.frameClass(user);

    const canChangeProfileId = !!(user?.premium || user?.dev);

    const profileIdField = canChangeProfileId

      ? `<label class="field">

            <span class="field__label">ID профиля (в ссылке)</span>

            <input type="text" id="editProfileId" maxlength="32" autocomplete="off" value="${BunkerUserBadges.escapeHtml(user.profileId || user.id || "")}">

            <span class="field__hint">3–32 символа: a-z, 0-9, _ и -</span>

          </label>`

      : `<p class="profile-edit__hint">Смена ID профиля доступна только с подпиской Premium или для разработчиков.</p>`;

    const bannerBtn = canUseBanner(user)

      ? `<button type="button" class="btn btn--small" id="changeBannerBtn">Изменить баннер</button>`

      : `<p class="profile-edit__hint">Баннер доступен с подпиской <button type="button" class="btn btn--small btn--premium-cta" data-premium-modal>♛ Премиум</button></p>`;



    return `

      <div class="profile-edit">

        <div class="profile-edit__preview">

          <div class="profile-avatar-wrap ${frame}">

            <img id="profileEditAvatar" class="profile-avatar" src="${av}" alt="">

          </div>

          <button type="button" class="btn btn--small" id="changeAvatarBtn">Изменить фото</button>

          ${bannerBtn}

        </div>

        <form id="profileEditForm" class="profile-form">

          <label class="field">

            <span class="field__label">Никнейм</span>

            <input type="text" id="editNickname" maxlength="20" required autocomplete="username" value="${BunkerUserBadges.escapeHtml(user.nickname)}">

            <span class="field__hint">3–20 символов: буквы, цифры, _ и -</span>

          </label>

          <label class="field">

            <span class="field__label">О себе</span>

            <textarea id="profileBio" rows="4" maxlength="500" placeholder="Коротко о вашем опыте выживания…">${BunkerUserBadges.escapeHtml(user.bio || "")}</textarea>

          </label>

          ${profileIdField}

          <label class="field field--checkbox">

            <input type="checkbox" id="hideFriendsCheck"${user.friendsHidden ? " checked" : ""}>

            <span>Скрыть список друзей в профиле</span>

          </label>

          <p id="profileEditError" class="form-error hidden"></p>

          <p id="profileEditSuccess" class="form-success hidden"></p>

          <div class="profile-form__actions">

            <button type="submit" class="btn btn--amber">Сохранить</button>

            <button type="button" class="btn" id="cancelEditBtn">Отмена</button>

          </div>

        </form>

      </div>`;

  }



  function friendActionHtml(user, userId) {

    if (friendship === "self") {

      const premiumBtn = user.premium

        ? ""

        : `<button type="button" class="btn btn--premium-cta" data-premium-modal>♛ Премиум</button>`;

      return `

        ${premiumBtn}

        <button type="button" class="btn btn--amber" data-edit-profile>Редактировать профиль</button>

        <button type="button" class="btn" data-logout>Выйти</button>`;

    }

    if (friendship === "friends") {

      return `

        <button type="button" class="btn btn--danger" data-remove-friend="${userId}">Удалить из друзей</button>`;

    }

    if (friendship === "outgoing") {

      return `<span class="profile-friend-status">Заявка отправлена</span>`;

    }

    if (friendship === "incoming") {

      return `

        <button type="button" class="btn btn--amber" data-accept-friend="${userId}">Принять заявку</button>

        <button type="button" class="btn" data-decline-friend="${userId}">Отклонить</button>`;

    }

    return `<button type="button" class="btn btn--amber" data-add-friend="${userId}">Добавить в друзья</button>`;

  }



  function showEditError(msg) {

    const el = content.querySelector("#profileEditError");

    if (!el) return;

    el.textContent = msg || "";

    el.classList.toggle("hidden", !msg);

  }



  function showEditSuccess(msg) {

    const el = content.querySelector("#profileEditSuccess");

    if (!el) return;

    el.textContent = msg || "";

    el.classList.toggle("hidden", !msg);

  }



  function bindProfileEditHandlers(user) {

    editUser = user;

    const form = content.querySelector("#profileEditForm");

    const cancelBtn = content.querySelector("#cancelEditBtn");

    const changeAvatarBtn = content.querySelector("#changeAvatarBtn");

    const changeBannerBtn = content.querySelector("#changeBannerBtn");



    cancelBtn?.addEventListener("click", () => {

      setEditUrl(false);

      renderProfile(user, cachedFriends, cachedMeta, "view");

    });



    form?.addEventListener("submit", async (e) => {

      e.preventDefault();

      showEditError("");

      showEditSuccess("");

      try {

        const updated = await BunkerAuth.updateProfile({

          bio: content.querySelector("#profileBio").value,

          nickname: content.querySelector("#editNickname").value.trim(),

          friendsHidden: content.querySelector("#hideFriendsCheck").checked,

          profileId: content.querySelector("#editProfileId")?.value.trim(),

        });

        setEditUrl(false);

        if (window.BunkerSiteAuth) BunkerSiteAuth.refresh();

        renderProfile(updated, cachedFriends, cachedMeta, "view");

        if (updated?.profileId && updated.profileId !== currentUserId) {

          location.href = BunkerAuth.profileUrl(updated);

          return;

        }

        showFriendError("");

      } catch (err) {

        showEditError(err.message);

      }

    });



    changeAvatarBtn?.addEventListener("click", async () => {

      if (!window.BunkerAvatarCrop) {

        showEditError("Модуль обрезки не загружен.");

        return;

      }

      showEditError("");

      try {

        const { dataUrl, crop } = await BunkerAvatarCrop.pickAndCrop();

        changeAvatarBtn.disabled = true;

        const updated = await BunkerAuth.uploadAvatar(dataUrl, crop);

        editUser = updated;

        const img = content.querySelector("#profileEditAvatar");

        if (img) {

          img.src = BunkerAuth.avatarUrlForUser

            ? BunkerAuth.avatarUrlForUser(updated, Date.now())

            : BunkerAuth.assetUrl(updated.avatarUrl);

        }

        if (window.BunkerSiteAuth) BunkerSiteAuth.refresh();

        showEditSuccess("Аватар обновлён.");

      } catch (err) {

        if (err.message !== "cancel") {

          showEditError(err.message || "Не удалось загрузить фото.");

        }

      } finally {

        changeAvatarBtn.disabled = false;

      }

    });



    changeBannerBtn?.addEventListener("click", async () => {

      if (!canUseBanner(editUser)) return;

      if (!window.BunkerAvatarCrop) {

        showEditError("Модуль обрезки не загружен.");

        return;

      }

      showEditError("");

      try {

        const { dataUrl, crop } = await BunkerAvatarCrop.pickAndCropBanner();

        changeBannerBtn.disabled = true;

        const updated = await BunkerAuth.uploadBanner(dataUrl, crop);

        editUser = updated;

        if (window.BunkerSiteAuth) BunkerSiteAuth.refresh();

        showEditSuccess("Баннер обновлён.");

      } catch (err) {

        if (err.message !== "cancel") {

          showEditError(err.message || "Не удалось загрузить баннер.");

        }

      } finally {

        changeBannerBtn.disabled = false;

      }

    });



    content.querySelector("[data-premium-modal]")?.addEventListener("click", () => {

      BunkerPremiumModal?.open(editUser);

    });

  }



  function bindViewHandlers(user) {

    content.querySelector("[data-open-chat]")?.addEventListener("click", () => {

      BunkerChatWidget.open(user.id, user.nickname);

    });

    content.querySelector("[data-add-friend]")?.addEventListener("click", onAddFriend);

    content.querySelector("[data-accept-friend]")?.addEventListener("click", onAcceptFriend);

    content.querySelector("[data-decline-friend]")?.addEventListener("click", onDeclineFriend);

    content.querySelector("[data-remove-friend]")?.addEventListener("click", onRemoveFriend);

    content.querySelector("[data-logout]")?.addEventListener("click", () => {

      BunkerAuth.clearAuth();

      if (window.BunkerSiteAuth) BunkerSiteAuth.refresh();

      location.href = BunkerAuth.pageUrl("auth.html?tab=login");

    });

    content.querySelector("[data-premium-modal]")?.addEventListener("click", () => {

      BunkerPremiumModal?.open(user);

    });

    content.querySelector("[data-edit-profile]")?.addEventListener("click", () => {

      setEditUrl(true);

      renderProfile(user, cachedFriends, cachedMeta, "edit");

    });

  }



  function renderProfile(user, friends, meta = {}, mode = "view") {

    cachedFriends = friends || [];

    cachedMeta = meta;

    const friendsCount = meta.friendsCount ?? friends?.length ?? 0;

    const friendsHidden = meta.friendsHidden ?? user.friendsHidden;

    const publishedScenarioCount = meta.publishedScenarioCount ?? 0;



    document.title = `Бункер — ${user.nickname}`;

    title.textContent = mode === "edit" ? `Редактирование — ${user.nickname}` : user.nickname;

    tagline.textContent =

      mode === "edit" ? "Измените данные и сохраните профиль." : user.bio?.trim() || "Профиль игрока";



    const chatBtn =

      friendship === "friends" && window.BunkerChatWidget && BunkerAuth.getToken()

        ? `<button type="button" class="btn btn--amber" data-open-chat="${user.id}">Написать</button>`

        : "";



    const mainHtml =

      mode === "edit" && friendship === "self"

        ? renderProfileEdit(user)

        : `

          ${renderProfileHero(user, publishedScenarioCount)}

          <div class="profile-view__actions">

            ${friendActionHtml(user, user.id)}

            ${chatBtn}

            <a href="${BunkerAuth.pageUrl("friends.html")}" class="btn">К друзьям</a>

          </div>

          ${publishedScenarioCount > 0 ? `<section class="profile-scenarios panel" data-profile-scenarios>
            <h3 class="profile-scenarios__title">Катастрофы в каталоге</h3>
            <div data-profile-scenarios-body><p class="profile-scenarios__loading">Загрузка…</p></div>
          </section>` : ""}

          <p id="profileFriendError" class="form-error hidden"></p>`;



    content.innerHTML = `

      <div class="profile-page-layout">

        <div class="profile-page-main">

          ${mainHtml}

        </div>

        ${renderFriendsSidebar(friends, friendsCount, friendsHidden)}

      </div>`;



    if (mode === "edit" && friendship === "self") {

      bindProfileEditHandlers(user);

    } else {

      bindViewHandlers(user);

      if (publishedScenarioCount > 0) {
        loadProfileScenarios(user.profileId || user.id, publishedScenarioCount);
      }

    }

  }



  function showFriendError(msg) {

    const el = content.querySelector("#profileFriendError");

    if (!el) return;

    el.textContent = msg || "";

    el.classList.toggle("hidden", !msg);

  }



  async function reloadProfile() {

    const data = await BunkerAuth.fetchUser(currentUserId);

    friendship = data.friendship || "none";

    const mode = isEditFromUrl() && friendship === "self" ? "edit" : "view";

    renderProfile(data.user, data.friends || [], {

      friendsCount: data.friendsCount,

      friendsHidden: data.friendsHidden,

      publishedScenarioCount: data.publishedScenarioCount ?? 0,

    }, mode);

  }



  async function onAddFriend() {

    showFriendError("");

    try {

      await BunkerAuth.requestFriendById(currentUserId);

      await reloadProfile();

    } catch (err) {

      showFriendError(err.message);

    }

  }



  async function onAcceptFriend() {

    showFriendError("");

    try {

      await BunkerAuth.respondFriend(currentUserId, true);

      await reloadProfile();

    } catch (err) {

      showFriendError(err.message);

    }

  }



  async function onDeclineFriend() {

    showFriendError("");

    try {

      await BunkerAuth.respondFriend(currentUserId, false);

      await reloadProfile();

    } catch (err) {

      showFriendError(err.message);

    }

  }



  async function onRemoveFriend() {

    if (!confirm("Удалить из друзей?")) return;

    showFriendError("");

    try {

      await BunkerAuth.removeFriend(currentUserId);

      await reloadProfile();

    } catch (err) {

      showFriendError(err.message);

    }

  }



  async function init() {
    let userId = getUserIdFromUrl();

    if (!content) return;

    if (!BunkerAuth.apiBase()) {
      content.innerHTML =
        '<p class="form-error">API не настроен. Укажите apiUrl в config.js.</p>';
      return;
    }

    const me = await BunkerAuth.fetchMe();

    if (!userId) {
      if (!me) {
        location.href = BunkerAuth.pageUrl(
          `auth.html?tab=login&next=${encodeURIComponent(BunkerAuth.pageUrl("profile.html"))}`
        );
        return;
      }
      const dest = BunkerAuth.profileUrl(me);
      if (isEditFromUrl()) {
        location.href = `${dest}${dest.includes("?") ? "&" : "?"}edit=1`;
        return;
      }
      location.href = dest;
      return;
    }

    currentUserId = userId;

    try {
      const data = await BunkerAuth.fetchUser(userId);
      friendship = data.friendship || "none";
      const mode = isEditFromUrl() && friendship === "self" ? "edit" : "view";
      renderProfile(data.user, data.friends || [], {
        friendsCount: data.friendsCount,
        friendsHidden: data.friendsHidden,
        publishedScenarioCount: data.publishedScenarioCount ?? 0,
      }, mode);
    } catch (err) {
      if (err?.status === 401 && !me) {
        location.href = BunkerAuth.pageUrl(
          `auth.html?tab=login&next=${encodeURIComponent(BunkerAuth.profileUrl(userId))}`
        );
        return;
      }
      content.innerHTML = `<p class="form-error">${BunkerUserBadges.escapeHtml(err.message)}</p>`;
      if (tagline) tagline.textContent = "Не удалось загрузить профиль.";
    }
  }

  init().catch((err) => {
    if (content) {
      content.innerHTML = `<p class="form-error">${BunkerUserBadges.escapeHtml(err.message || "Ошибка загрузки.")}</p>`;
    }
  });

})();

