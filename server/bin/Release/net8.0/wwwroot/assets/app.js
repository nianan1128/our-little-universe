/* =========================================================
   我们的小宇宙 · interactions
   Works offline with localStorage; when served over HTTP it also
   syncs theme, diaries, whispers and photos through /api/state.
   ========================================================= */

(() => {
  "use strict";

  const STORAGE_KEYS = {
    theme: "littleUniverse.theme",
    profile: "littleUniverse.profile",
    diaries: "littleUniverse.diaries",
    whispers: "littleUniverse.whispers",
    photos: "littleUniverse.photos",
    dates: "littleUniverse.dates",
    wishes: "littleUniverse.wishes"
  };

  const memoryStore = new Map();

  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        if (raw === null) return fallback;
        return JSON.parse(raw);
      } catch {
        if (memoryStore.has(key)) {
          try { return JSON.parse(memoryStore.get(key)); } catch { return fallback; }
        }
        return fallback;
      }
    },
    set(key, value) {
      const raw = JSON.stringify(value);
      try {
        localStorage.setItem(key, raw);
      } catch {
        memoryStore.set(key, raw);
      }
    }
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

  const todayISO = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
  };

  const formatDate = (value) => {
    if (!value) return "";
    const normalized = String(value).replaceAll("-", ".");
    return normalized;
  };

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

  const toast = (message) => {
    const el = $("#toast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove("show"), 2600);
  };

  /* ---------- theme ---------- */
  const THEMES = ["pink", "mint", "sky", "butter", "lavender"];
  let savedTheme = "pink";
  let previewTheme = "pink";
  let modalBeforeTheme = null;
  let onLocalChange = () => {};

  const applyTheme = (theme, persist = false) => {
    const next = THEMES.includes(theme) ? theme : "pink";
    document.documentElement.dataset.theme = next;
    previewTheme = next;
    $$("#themeGrid .theme-card").forEach((card) => {
      card.classList.toggle("selected", card.dataset.theme === next);
      card.setAttribute("aria-pressed", String(card.dataset.theme === next));
    });
    if (persist) {
      savedTheme = next;
      store.set(STORAGE_KEYS.theme, next);
      onLocalChange();
    }
  };

  /* ---------- modals ---------- */
  let lastFocused = null;

  const openModal = (id) => {
    const modal = document.getElementById(id);
    if (!modal) return;
    lastFocused = document.activeElement;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");

    if (id === "themeModal") {
      modalBeforeTheme = savedTheme;
      applyTheme(savedTheme, false);
    }

    if (id === "diaryModal" && !$("#diaryDate")?.value) {
      $("#diaryDate").value = todayISO();
    }

    if (id === "dateModal" && !$("#dateValue")?.value) {
      $("#dateValue").value = todayISO();
    }

    const focusTarget = modal.querySelector("input, textarea, select, .primary-button, .modal-close");
    window.setTimeout(() => focusTarget?.focus(), 60);
  };

  const closeModal = (modal) => {
    if (!modal || !modal.classList.contains("is-open")) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");

    if (modal.id === "themeModal" && modalBeforeTheme) {
      applyTheme(modalBeforeTheme, false);
      modalBeforeTheme = null;
    }

    if (!document.querySelector(".modal.is-open")) {
      document.body.classList.remove("modal-open");
    }
    lastFocused?.focus?.();
  };

  const closeAllModals = () => {
    $$(".modal.is-open").forEach(closeModal);
  };

  /* ---------- profile ---------- */
  const defaultProfile = { yourName: "", partnerName: "", anniversary: "" };
  let profile = { ...defaultProfile };

  const daysTogether = () => {
    if (!profile.anniversary) return null;
    const start = new Date(`${profile.anniversary}T00:00:00`);
    if (Number.isNaN(start.getTime())) return null;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diff = Math.floor((today - start) / 86400000);
    return diff >= 0 ? diff + 1 : null;
  };

  const renderProfile = () => {
    const nameA = profile.yourName?.trim();
    const nameB = profile.partnerName?.trim();
    const footer = $("#footerNames");
    const days = daysTogether();
    const title = $("#letterTitle");

    if (nameA && nameB) {
      footer.textContent = days ? `${nameA} & ${nameB} · 在一起第 ${days} 天` : `${nameA} & ${nameB}`;
    } else if (nameA || nameB) {
      footer.textContent = days ? `${nameA || nameB} 的小宇宙 · 第 ${days} 天` : `${nameA || nameB} 的小宇宙`;
    } else {
      footer.textContent = days ? `小宇宙 · 在一起第 ${days} 天` : "小宇宙 · 两个人";
    }

    if (title) {
      title.textContent = nameB ? `致 我亲爱的 ${nameB}` : "致 我亲爱的小朋友";
    }
  };

  /* ---------- diaries ---------- */
  const demoDiary = {
    id: "demo-diary",
    date: "2026-11-01",
    mood: "随心记录",
    title: "演示日记 · 我们的小宇宙准备出发",
    body: "今天把我们的照片、悄悄话和日记都搬进了这个小宇宙。\n以后每一个普通的日子，都可以在这里留下一页。"
  };

  let diaries = [];

  const saveDiaries = () => { store.set(STORAGE_KEYS.diaries, diaries); onLocalChange(); };

  const renderDiaries = () => {
    const list = $("#diaryList");
    const count = $("#diaryCount");
    if (!list) return;

    if (count) count.textContent = `已记录 ${diaries.length} 篇`;

    if (!diaries.length) {
      list.innerHTML = '<div class="empty-state">还没有日记，写下今天的第一页吧。</div>';
      return;
    }

    const sorted = [...diaries].sort((a, b) => String(b.date).localeCompare(String(a.date)));
    list.innerHTML = sorted.map((entry) => `
      <article class="diary-entry" data-id="${escapeHtml(entry.id)}">
        <div class="diary-entry-head">
          <div>
            <time>${escapeHtml(formatDate(entry.date))}</time>
            <h3>${escapeHtml(entry.title)}<span class="mood">${escapeHtml(entry.mood || "随心记录")}</span></h3>
            <button class="toggle-entry" type="button">展开这一页 ↓</button>
          </div>
          <div class="diary-entry-actions">
            <button type="button" data-action="edit">编辑</button>
            <button type="button" data-action="delete">删除</button>
          </div>
        </div>
        <p class="entry-body">${escapeHtml(entry.body)}</p>
      </article>
    `).join("");
  };

  const openDiaryEditor = (id = null) => {
    const form = $("#diaryForm");
    form?.reset();
    const entry = id ? diaries.find((item) => item.id === id) : null;

    $("#diaryId").value = entry?.id || "";
    $("#diaryDate").value = entry?.date || todayISO();
    $("#diaryMood").value = entry?.mood || "随心记录";
    $("#diaryTitle").value = entry?.title || "";
    $("#diaryBody").value = entry?.body || "";
    $("#diaryCharCount").textContent = `${(entry?.body || "").length} / 10000`;
    $("#diaryModalTitle").textContent = entry ? "编辑这页小美好" : "写下今天的小美好";

    openModal("diaryModal");
    window.setTimeout(() => $("#diaryTitle")?.focus(), 80);
  };

  const saveDiary = () => {
    const id = $("#diaryId").value;
    const date = $("#diaryDate").value || todayISO();
    const mood = $("#diaryMood").value;
    const title = $("#diaryTitle").value.trim();
    const body = $("#diaryBody").value.trim();

    if (!title || !body) {
      toast("标题和正文都写一点吧 ♡");
      return false;
    }

    if (id) {
      const index = diaries.findIndex((item) => item.id === id);
      if (index >= 0) {
        diaries[index] = { ...diaries[index], date, mood, title, body };
      }
    } else {
      diaries.push({ id: uid(), date, mood, title, body });
    }

    saveDiaries();
    renderDiaries();
    toast(id ? "这一页已经更新好啦" : "今天的故事已经收进日记本 ♡");
    closeModal($("#diaryModal"));
    return true;
  };

  /* ---------- whispers ---------- */
  let whispers = [];

  const saveWhispers = () => { store.set(STORAGE_KEYS.whispers, whispers); onLocalChange(); };

  const renderWhispers = () => {
    const list = $("#whisperList");
    const total = $("#whisperTotal");
    if (!list) return;

    if (total) total.textContent = `${whispers.length} 句`;

    if (!whispers.length) {
      list.innerHTML = '<div class="empty-state">还没有悄悄话，写下第一句想对 TA 说的话吧。</div>';
      return;
    }

    const sorted = [...whispers].sort((a, b) => Number(b.time) - Number(a.time));
    list.innerHTML = sorted.map((item) => `
      <article class="whisper-item" data-id="${escapeHtml(item.id)}">
        <header>
          <strong>${escapeHtml(item.name || "匿名小朋友")}</strong>
          <time>${escapeHtml(relativeTime(item.time))}</time>
        </header>
        <p>${escapeHtml(item.text)}</p>
        <button class="delete-mini" type="button" data-action="delete">删除</button>
      </article>
    `).join("");
  };

  const relativeTime = (timestamp) => {
    const time = Number(timestamp);
    if (!Number.isFinite(time)) return "";
    const diff = Date.now() - time;
    if (diff < 60000) return "刚刚";
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    const date = new Date(time);
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  };

  const addWhisper = (name, text, silent = false) => {
    const clean = String(text || "").trim();
    if (!clean) return false;
    whispers.push({
      id: uid(),
      name: String(name || "").trim() || "匿名小朋友",
      text: clean,
      time: Date.now()
    });
    saveWhispers();
    renderWhispers();
    if (!silent) toast("悄悄话已经寄出去啦 ♡");
    return true;
  };

  /* ---------- album ---------- */
  let customPhotos = [];

  const savePhotos = () => { store.set(STORAGE_KEYS.photos, customPhotos); onLocalChange(); };

  const renderPhotos = () => {
    const row = $(".polaroid-row");
    const addButton = $("#addPhotoBtn");
    if (!row || !addButton) return;

    $$(".polaroid.custom", row).forEach((node) => node.remove());

    customPhotos.forEach((photo) => {
      const figure = document.createElement("figure");
      figure.className = "polaroid tilt-right custom";
      figure.dataset.id = photo.id;
      figure.innerHTML = `
        <span class="washi tape-top" aria-hidden="true"></span>
        <div class="photo"><img src="${photo.src}" alt="${escapeHtml(photo.caption || "我们的照片")}" loading="lazy" /></div>
        <figcaption>${escapeHtml(photo.caption || "新的小回忆")}</figcaption>
        <button class="photo-edit" type="button" data-action="caption" aria-label="编辑照片说明">✎</button>
        <button class="photo-remove" type="button" aria-label="删除这张照片">×</button>
      `;
      row.insertBefore(figure, addButton);
    });
  };

  const openPhotoEditor = (id) => {
    const photo = customPhotos.find((item) => item.id === id);
    if (!photo) return;

    $("#photoId").value = photo.id;
    $("#photoCaption").value = photo.caption || "";
    openModal("photoModal");
    window.setTimeout(() => $("#photoCaption")?.focus(), 80);
  };

  const savePhotoCaption = () => {
    const id = $("#photoId").value;
    const caption = $("#photoCaption").value.trim();
    if (!caption) {
      toast("写一句照片说明吧 ♡");
      return false;
    }

    const photo = customPhotos.find((item) => item.id === id);
    if (!photo) return false;

    photo.caption = caption;
    savePhotos();
    renderPhotos();
    closeModal($("#photoModal"));
    toast("照片说明已经更新好啦");
    return true;
  };

  const handlePhotoFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("选一张图片吧 ♡");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      toast("这张图有点大，换一张试试");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const max = 900;
        const scale = Math.min(1, max / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        let src;
        try {
          src = canvas.toDataURL("image/jpeg", 0.82);
        } catch {
          toast("这张照片暂时读不出来");
          return;
        }

        customPhotos.push({ id: uid(), src, caption: "新的小回忆" });
        try {
          savePhotos();
        } catch {
          toast("照片太多啦，先存在这次打开里");
        }
        renderPhotos();
        toast("照片已经夹进相册 ♡");
      };
      image.onerror = () => toast("这张照片暂时读不出来");
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  /* ---------- important dates ---------- */
  const DATE_TYPES = ["纪念日", "生日", "见面", "其他"];
  const DATE_EMOJI = { 纪念日: "💗", 生日: "🎂", 见面: "🚉", 其他: "✨" };
  const DATE_CLASS = { 纪念日: "anniversary", 生日: "birthday", 见面: "meet", 其他: "other" };

  let dates = [];

  const defaultDates = () => [{
    id: uid(),
    title: "我们的小宇宙出发",
    date: "2026-11-01",
    type: "纪念日",
    note: "从这天开始，把普通的日子过得很甜。"
  }];

  const saveDates = () => {
    store.set(STORAGE_KEYS.dates, dates);
    onLocalChange();
  };

  const parseLocalDate = (value) => {
    const [year, month, day] = String(value).split("-").map(Number);
    return new Date(year, (month || 1) - 1, day || 1);
  };

  const startOfToday = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  };

  const dateInfo = (item) => {
    const original = parseLocalDate(item.date);
    const today = startOfToday();
    const oneTime = item.type === "见面";
    let target = original;

    if (!oneTime) {
      target = new Date(today.getFullYear(), original.getMonth(), original.getDate());
      if (target < today) target.setFullYear(today.getFullYear() + 1);
    }

    const diff = Math.round((target - today) / 86400000);
    const since = Math.floor((today - original) / 86400000) + 1;
    return { diff, oneTime, past: oneTime && diff < 0, since };
  };

  const dateCountLabel = (info) => {
    if (info.diff === 0) return "就是今天";
    if (info.oneTime && info.diff < 0) return `已经 ${Math.abs(info.diff)} 天`;
    return `D-${info.diff}`;
  };

  const renderDates = () => {
    const grid = $("#dateGrid");
    if (!grid) return;

    if (!dates.length) {
      grid.innerHTML = '<div class="empty-state date-empty">还没有纪念日，添加一个重要的日子吧。</div>';
      return;
    }

    const sorted = [...dates].sort((a, b) => {
      const infoA = dateInfo(a);
      const infoB = dateInfo(b);
      const keyA = infoA.oneTime && infoA.diff < 0 ? 100000 + Math.abs(infoA.diff) : infoA.diff;
      const keyB = infoB.oneTime && infoB.diff < 0 ? 100000 + Math.abs(infoB.diff) : infoB.diff;
      return keyA - keyB;
    });

    grid.innerHTML = sorted.map((item) => {
      const info = dateInfo(item);
      const type = DATE_TYPES.includes(item.type) ? item.type : "其他";
      const showAnniversaryDays = type === "纪念日" && info.since > 0 && info.diff > 0;
      const countLabel = showAnniversaryDays ? `第 ${info.since} 天` : dateCountLabel(info);
      const subLabel = info.diff === 0
        ? "今天要好好纪念一下"
        : showAnniversaryDays
        ? `距离下次纪念日 ${info.diff} 天`
        : type === "生日"
          ? `距离下一次生日 ${info.diff} 天`
          : type === "见面"
            ? (info.past ? "这次见面已经过去" : "距离下一次见面")
            : (info.past ? "已经过去的日子" : "值得期待的日子");
      return `
        <article class="date-card card type-${DATE_CLASS[type]}" data-id="${escapeHtml(item.id)}">
          <div class="date-card-top">
            <span class="date-type">${escapeHtml(type)}</span>
            <span class="date-emoji" aria-hidden="true">${DATE_EMOJI[type]}</span>
          </div>
          <strong class="date-count">${escapeHtml(countLabel)}</strong>
          <p class="date-sub">${escapeHtml(subLabel)}</p>
          <h3>${escapeHtml(item.title)}</h3>
          <p class="date-value">${escapeHtml(formatDate(item.date))}</p>
          ${item.note ? `<p class="date-note">${escapeHtml(item.note)}</p>` : ""}
          <div class="date-actions">
            <button type="button" data-action="edit">编辑</button>
            <button type="button" data-action="delete">删除</button>
          </div>
        </article>
      `;
    }).join("");
  };

  const openDateEditor = (id = null) => {
    const form = $("#dateForm");
    form?.reset();
    const item = id ? dates.find((entry) => entry.id === id) : null;

    $("#dateId").value = item?.id || "";
    $("#dateTitle").value = item?.title || "";
    $("#dateValue").value = item?.date || todayISO();
    $("#dateType").value = DATE_TYPES.includes(item?.type) ? item.type : "纪念日";
    $("#dateNote").value = item?.note || "";
    $("#dateModalTitle").textContent = item ? "编辑这个日子" : "添加一个重要日子";

    openModal("dateModal");
    window.setTimeout(() => $("#dateTitle")?.focus(), 80);
  };

  const saveDate = () => {
    const id = $("#dateId").value;
    const title = $("#dateTitle").value.trim();
    const date = $("#dateValue").value;
    const type = $("#dateType").value;
    const note = $("#dateNote").value.trim();

    if (!title || !date) {
      toast("名称和日期都要填一下 ♡");
      return false;
    }

    if (id) {
      const index = dates.findIndex((item) => item.id === id);
      if (index >= 0) {
        dates[index] = { ...dates[index], title, date, type, note };
      }
    } else {
      dates.push({ id: uid(), title, date, type, note });
    }

    saveDates();
    renderDates();
    closeModal($("#dateModal"));
    toast(id ? "这个日子已经更新好啦" : "重要的日子已经记下啦 ♡");
    return true;
  };

  /* ---------- wishes ---------- */
  let wishes = [];

  const defaultWishes = () => [
    { id: uid(), text: "一起去看一次海", done: false },
    { id: uid(), text: "一起做一顿晚饭", done: false },
    { id: uid(), text: "拍一张好看的合照", done: false }
  ];

  const saveWishes = () => {
    store.set(STORAGE_KEYS.wishes, wishes);
    onLocalChange();
  };

  const renderWishes = () => {
    const list = $("#wishList");
    const progressText = $("#wishProgressText");
    const progressBar = $("#wishProgressBar");
    if (!list) return;

    const total = wishes.length;
    const done = wishes.filter((item) => item.done).length;

    if (progressText) progressText.textContent = `${done} / ${total}`;
    if (progressBar) progressBar.style.width = total ? `${Math.round((done / total) * 100)}%` : "0%";

    if (!total) {
      list.innerHTML = '<li class="empty-state">还没有愿望，写下第一件想一起做的事吧。</li>';
      return;
    }

    list.innerHTML = wishes.map((item) => `
      <li class="wish-item ${item.done ? "done" : ""}" data-id="${escapeHtml(item.id)}">
        <button class="wish-check" type="button" aria-label="${item.done ? "标记为未完成" : "标记为完成"}" aria-pressed="${item.done}">
          ${item.done ? "✓" : ""}
        </button>
        <span class="wish-text">${escapeHtml(item.text)}</span>
        <div class="wish-actions">
          <button type="button" data-action="edit">编辑</button>
          <button type="button" data-action="delete">删除</button>
        </div>
      </li>
    `).join("");
  };

  const startWishEdit = (itemEl) => {
    const wish = wishes.find((entry) => entry.id === itemEl.dataset.id);
    const textEl = itemEl.querySelector(".wish-text");
    if (!wish || !textEl) return;

    const input = document.createElement("input");
    input.type = "text";
    input.className = "wish-inline-input";
    input.maxLength = 60;
    input.value = wish.text;
    textEl.replaceWith(input);
    input.focus();
    input.select();

    let finished = false;
    const finish = (commit) => {
      if (finished) return;
      finished = true;
      const value = input.value.trim();
      if (commit && value) {
        wish.text = value;
        saveWishes();
      }
      renderWishes();
    };

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        finish(true);
      } else if (event.key === "Escape") {
        event.preventDefault();
        finish(false);
      }
    });
    input.addEventListener("blur", () => finish(true));
  };

  /* ---------- memory game ---------- */
  const MEMORY_EMOJIS = ["🐰", "🧸", "🍓", "🌙", "🐶", "🌷"];
  const HEART_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-heart"></use></svg>';

  let deck = [];
  let firstCard = null;
  let secondCard = null;
  let lockBoard = false;
  let moves = 0;
  let matchedPairs = 0;

  const shuffle = (items) => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const updateGameStats = () => {
    const movesEl = $("#moveCount");
    const pairsEl = $("#pairCount");
    if (movesEl) movesEl.textContent = `${moves} 次翻牌`;
    if (pairsEl) pairsEl.textContent = `${matchedPairs} / 6 对`;
  };

  const renderGame = () => {
    const grid = $("#memoryGrid");
    if (!grid) return;

    grid.innerHTML = deck.map((card, index) => `
      <button class="memory-card" type="button" data-index="${index}" aria-label="翻开第 ${index + 1} 张卡片" aria-pressed="false">
        <span class="memory-inner">
          <span class="memory-face memory-front">${HEART_ICON}</span>
          <span class="memory-face memory-back">${card.emoji}</span>
        </span>
      </button>
    `).join("");

    updateGameStats();
    const hint = $("#gameHint");
    if (hint) {
      hint.textContent = "找到 6 对，就解锁一句悄悄话。";
      hint.classList.remove("win");
    }
  };

  const startGame = () => {
    firstCard = null;
    secondCard = null;
    lockBoard = false;
    moves = 0;
    matchedPairs = 0;
    deck = shuffle([...MEMORY_EMOJIS, ...MEMORY_EMOJIS]).map((emoji, index) => ({
      id: index,
      emoji,
      matched: false
    }));
    renderGame();
  };

  const flipCard = (button) => {
    if (!button || lockBoard) return;
    const index = Number(button.dataset.index);
    const card = deck[index];
    if (!card || card.matched || button.classList.contains("flipped")) return;

    button.classList.add("flipped");
    button.setAttribute("aria-pressed", "true");

    if (!firstCard) {
      firstCard = { button, card };
      return;
    }

    if (firstCard.card.id === card.id) return;

    secondCard = { button, card };
    lockBoard = true;
    moves += 1;
    updateGameStats();

    if (firstCard.card.emoji === secondCard.card.emoji) {
      firstCard.card.matched = true;
      secondCard.card.matched = true;
      firstCard.button.classList.add("matched");
      secondCard.button.classList.add("matched");
      matchedPairs += 1;
      updateGameStats();

      firstCard = null;
      secondCard = null;
      lockBoard = false;

      if (matchedPairs === 6) {
        const hint = $("#gameHint");
        if (hint) {
          hint.textContent = "默契满分！想对你说：和你在一起，每天都是小确幸。♡";
          hint.classList.add("win");
        }
        toast("6 对全部找到，默契满分 ♡");
        launchHearts();
      }
      return;
    }

    window.setTimeout(() => {
      firstCard?.button.classList.remove("flipped");
      secondCard?.button.classList.remove("flipped");
      firstCard?.button.setAttribute("aria-pressed", "false");
      secondCard?.button.setAttribute("aria-pressed", "false");
      firstCard = null;
      secondCard = null;
      lockBoard = false;
    }, 760);
  };

  const launchHearts = () => {
    const layer = document.createElement("div");
    layer.className = "win-hearts";
    layer.setAttribute("aria-hidden", "true");
    for (let i = 0; i < 14; i += 1) {
      const heart = document.createElement("span");
      heart.textContent = Math.random() > 0.4 ? "♡" : "✧";
      heart.style.left = `${Math.random() * 100}%`;
      heart.style.animationDelay = `${Math.random() * 0.8}s`;
      heart.style.fontSize = `${12 + Math.random() * 18}px`;
      layer.appendChild(heart);
    }
    document.body.appendChild(layer);
    window.setTimeout(() => layer.remove(), 3400);
  };

  /* ---------- navigation ---------- */
  const initActiveNav = () => {
    const links = $$(".main-nav a");
    const sections = ["album", "games", "whisper", "diary", "dates", "wishes"]
      .map((id) => document.getElementById(id))
      .filter(Boolean);

    if (!links.length || !sections.length) return;

    const setActive = (id) => {
      links.forEach((link) => link.classList.toggle("active", link.dataset.nav === id));
    };

    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActive(visible.target.id);
    }, { rootMargin: "-30% 0px -55% 0px", threshold: [0.1, 0.3, 0.6] });

    sections.forEach((section) => observer.observe(section));

    links.forEach((link) => {
      link.addEventListener("click", () => setActive(link.dataset.nav));
    });
  };

  /* ---------- remote sync ---------- */
  const isRemote = location.protocol === "http:" || location.protocol === "https:";
  const remoteParams = new URLSearchParams(location.search);
  const keyFromUrl = remoteParams.get("key");
  const accessKey = (() => {
    if (keyFromUrl) {
      try { localStorage.setItem("littleUniverse.key", keyFromUrl); } catch { /* ignore */ }
      return keyFromUrl;
    }
    try { return localStorage.getItem("littleUniverse.key") || ""; } catch { return ""; }
  })();
  const remoteHeaders = accessKey ? { "X-Couple-Key": accessKey } : {};
  let syncEnabled = false;
  let remoteUpdatedAt = 0;
  let remoteSaveTimer = null;

  const buildState = () => ({
    theme: savedTheme,
    profile,
    diaries,
    whispers,
    photos: customPhotos,
    dates,
    wishes,
    updatedAt: Date.now()
  });

  const loadRemoteState = async () => {
    if (!isRemote) return null;
    try {
      const response = await fetch("/api/state", { cache: "no-store", headers: remoteHeaders, signal: AbortSignal.timeout(4000) });
      if (!response.ok) return null;
      const state = await response.json();
      return state && typeof state === "object" ? state : null;
    } catch {
      return null;
    }
  };

  const loadRemoteVersion = async () => {
    if (!isRemote) return 0;
    try {
      const response = await fetch("/api/version", {
        cache: "no-store",
        headers: remoteHeaders,
        signal: AbortSignal.timeout(4000)
      });
      if (!response.ok) return 0;
      const data = await response.json();
      return Number.isFinite(Number(data.updatedAt)) ? Number(data.updatedAt) : 0;
    } catch {
      return 0;
    }
  };
  const saveRemoteState = async () => {
    if (!isRemote) return false;
    try {
      const response = await fetch("/api/state", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...remoteHeaders },
        body: JSON.stringify(buildState())
      });
      if (!response.ok) return false;
      const saved = await response.json();
      if (Number.isFinite(Number(saved.updatedAt))) {
        remoteUpdatedAt = Number(saved.updatedAt);
      }
      return true;
    } catch {
      return false;
    }
  };

  const scheduleRemoteSave = () => {
    if (!isRemote || !syncEnabled) return;
    window.clearTimeout(remoteSaveTimer);
    remoteSaveTimer = window.setTimeout(saveRemoteState, 250);
  };

  onLocalChange = scheduleRemoteSave;

  const applyRemoteState = (state) => {
    if (!state) return;

    if (THEMES.includes(state.theme)) {
      savedTheme = state.theme;
      applyTheme(savedTheme, false);
      store.set(STORAGE_KEYS.theme, savedTheme);
    }

    if (state.profile && typeof state.profile === "object") {
      profile = { ...defaultProfile, ...state.profile };
      store.set(STORAGE_KEYS.profile, profile);
    }

    if (Array.isArray(state.diaries)) {
      diaries = state.diaries;
      store.set(STORAGE_KEYS.diaries, diaries);
    }

    if (Array.isArray(state.whispers)) {
      whispers = state.whispers;
      store.set(STORAGE_KEYS.whispers, whispers);
    }

    if (Array.isArray(state.photos)) {
      customPhotos = state.photos;
      store.set(STORAGE_KEYS.photos, customPhotos);
    }

    if (Array.isArray(state.dates)) {
      dates = state.dates;
      store.set(STORAGE_KEYS.dates, dates);
    }

    if (Array.isArray(state.wishes)) {
      wishes = state.wishes;
      store.set(STORAGE_KEYS.wishes, wishes);
    }

    if (Number.isFinite(Number(state.updatedAt))) {
      remoteUpdatedAt = Number(state.updatedAt);
    }

    renderProfile();
    renderDiaries();
    renderWhispers();
    renderPhotos();
    renderDates();
    renderWishes();
  };

  const startPolling = () => {
    if (!isRemote) return;
    window.setInterval(async () => {
      if (document.hidden || document.querySelector(".modal.is-open")) return;
      const active = document.activeElement;
      if (active && (active.matches("input, textarea, select") || active.isContentEditable)) return;
      const version = await loadRemoteVersion();
      if (!version || version <= remoteUpdatedAt) return;
      const state = await loadRemoteState();
      if (!state || !Number.isFinite(Number(state.updatedAt))) return;
      if (Number(state.updatedAt) <= remoteUpdatedAt) return;
      applyRemoteState(state);
    }, 5000);
  };

  /* ---------- backup ---------- */
  const buildBackup = () => ({
    app: "little-universe",
    version: 2,
    exportedAt: new Date().toISOString(),
    theme: savedTheme,
    profile,
    diaries,
    whispers,
    photos: customPhotos,
    dates,
    wishes
  });

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify(buildBackup(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `我们的小宇宙备份-${todayISO()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    toast("备份已经下载好啦 ♡");
  };

  const importBackupFile = (file) => {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast("备份文件太大啦（超过 25MB）");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      let data;
      try {
        data = JSON.parse(String(reader.result));
      } catch {
        toast("备份文件读取失败，请确认是 JSON 文件");
        return;
      }

      if (!data || typeof data !== "object") {
        toast("这不是有效的备份文件");
        return;
      }
      if (!window.confirm("导入备份会覆盖当前所有内容，确定继续吗？")) return;

      if (THEMES.includes(data.theme)) {
        savedTheme = data.theme;
        applyTheme(savedTheme, false);
        store.set(STORAGE_KEYS.theme, savedTheme);
      }
      if (data.profile && typeof data.profile === "object") {
        profile = { ...defaultProfile, ...data.profile };
        store.set(STORAGE_KEYS.profile, profile);
      }
      if (Array.isArray(data.diaries)) {
        diaries = data.diaries;
        store.set(STORAGE_KEYS.diaries, diaries);
      }
      if (Array.isArray(data.whispers)) {
        whispers = data.whispers;
        store.set(STORAGE_KEYS.whispers, whispers);
      }
      if (Array.isArray(data.photos)) {
        customPhotos = data.photos;
        store.set(STORAGE_KEYS.photos, customPhotos);
      }
      if (Array.isArray(data.dates)) {
        dates = data.dates;
        store.set(STORAGE_KEYS.dates, dates);
      }
      if (Array.isArray(data.wishes)) {
        wishes = data.wishes;
        store.set(STORAGE_KEYS.wishes, wishes);
      }

      renderProfile();
      renderDiaries();
      renderWhispers();
      renderPhotos();
      renderDates();
      renderWishes();

      let saved = true;
      if (isRemote) {
        saved = await saveRemoteState();
      } else {
        onLocalChange();
      }
      toast(saved ? "备份已经恢复好啦 ♡" : "已恢复到本地，但同步服务器失败");
    };
    reader.onerror = () => toast("备份文件读取失败");
    reader.readAsText(file);
  };

  /* ---------- init ---------- */
  const init = async () => {
    const params = new URLSearchParams(location.search);
    if (params.get("still") === "1") document.documentElement.classList.add("still");

    savedTheme = store.get(STORAGE_KEYS.theme, "pink");
    if (!THEMES.includes(savedTheme)) savedTheme = "pink";
    if (THEMES.includes(params.get("theme"))) savedTheme = params.get("theme");

    profile = { ...defaultProfile, ...store.get(STORAGE_KEYS.profile, {}) };

    diaries = store.get(STORAGE_KEYS.diaries, null);
    if (!Array.isArray(diaries)) {
      diaries = [demoDiary];
    }

    whispers = store.get(STORAGE_KEYS.whispers, null);
    if (!Array.isArray(whispers)) {
      whispers = [{
        id: uid(),
        name: "你的小宇宙",
        text: "今天的晚霞很好看，想和你一起看。",
        time: Date.now() - 3600000
      }];
    }

    customPhotos = store.get(STORAGE_KEYS.photos, []);
    if (!Array.isArray(customPhotos)) customPhotos = [];

    dates = store.get(STORAGE_KEYS.dates, null);
    if (!Array.isArray(dates)) dates = defaultDates();

    wishes = store.get(STORAGE_KEYS.wishes, null);
    if (!Array.isArray(wishes)) wishes = defaultWishes();

    let hasRemoteState = false;
    let remoteReachable = false;
    let remoteMissingCollections = false;
    if (isRemote) {
      const remoteState = await loadRemoteState();
      if (remoteState) {
        remoteReachable = true;
        if (Array.isArray(remoteState.diaries) || Array.isArray(remoteState.whispers) || Number(remoteState.updatedAt) > 0) {
          remoteMissingCollections = !Array.isArray(remoteState.dates) || !Array.isArray(remoteState.wishes);
          applyRemoteState(remoteState);
          hasRemoteState = true;
        }
      }
    }

    if (!hasRemoteState) {
      applyTheme(savedTheme, false);
      renderProfile();
      renderDiaries();
      renderWhispers();
      renderPhotos();
      renderDates();
      renderWishes();
      store.set(STORAGE_KEYS.diaries, diaries);
      store.set(STORAGE_KEYS.whispers, whispers);
      store.set(STORAGE_KEYS.photos, customPhotos);
      store.set(STORAGE_KEYS.dates, dates);
      store.set(STORAGE_KEYS.wishes, wishes);
      if (isRemote && remoteReachable) {
        await saveRemoteState();
      }
    }

    if (isRemote && hasRemoteState && remoteMissingCollections) {
      await saveRemoteState();
    }

    syncEnabled = true;
    startGame();
    initActiveNav();
    bindEvents();

    const modalParam = params.get("modal");
    if (modalParam) openModal(modalParam);

    if (params.get("selftest") === "1") {
      window.setTimeout(runSelfTest, 120);
    }
  };

  const bindEvents = () => {
    $("#openLetterBtn")?.addEventListener("click", () => openModal("letterModal"));
    $("#openLetterBtn2")?.addEventListener("click", () => openModal("letterModal"));
    $("#miniLetterBtn")?.addEventListener("click", () => openModal("letterModal"));
    $("#themeFab")?.addEventListener("click", () => openModal("themeModal"));
    $("#customizeBtn")?.addEventListener("click", () => {
      $("#yourName").value = profile.yourName || "";
      $("#partnerName").value = profile.partnerName || "";
      $("#anniversary").value = profile.anniversary || "";
      openModal("customizeModal");
    });
    $("#writeDiaryBtn")?.addEventListener("click", () => openDiaryEditor());

    $("#saveThemeBtn")?.addEventListener("click", () => {
      applyTheme(previewTheme, true);
      modalBeforeTheme = savedTheme;
      closeModal($("#themeModal"));
      toast("小宇宙换好颜色啦 ♡");
    });

    $("#themeGrid")?.addEventListener("click", (event) => {
      const card = event.target.closest(".theme-card");
      if (!card) return;
      applyTheme(card.dataset.theme, false);
    });

    $("#restartGame")?.addEventListener("click", () => {
      startGame();
      toast("重新洗牌，再来一次吧 ♡");
    });

    $("#memoryGrid")?.addEventListener("click", (event) => {
      const card = event.target.closest(".memory-card");
      if (card) flipCard(card);
    });

    $("#whisperForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = $("#whisperName").value;
      const text = $("#whisperText").value;
      if (!text.trim()) {
        toast("先写一句想说的话吧 ♡");
        return;
      }
      addWhisper(name, text);
      $("#whisperText").value = "";
      $("#whisperCount").textContent = "0 / 300";
      $("#whisperName").value = name.trim();
    });

    $("#whisperText")?.addEventListener("input", (event) => {
      $("#whisperCount").textContent = `${event.target.value.length} / 300`;
    });

    $("#whisperList")?.addEventListener("click", (event) => {
      const button = event.target.closest('[data-action="delete"]');
      if (!button) return;
      const item = button.closest(".whisper-item");
      const id = item?.dataset.id;
      if (!id) return;
      if (!window.confirm("要删掉这句悄悄话吗？")) return;
      whispers = whispers.filter((entry) => entry.id !== id);
      saveWhispers();
      renderWhispers();
      toast("已经删掉啦");
    });

    $("#diaryForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      saveDiary();
    });

    $("#diaryBody")?.addEventListener("input", (event) => {
      $("#diaryCharCount").textContent = `${event.target.value.length} / 10000`;
    });

    $("#diaryList")?.addEventListener("click", (event) => {
      const entry = event.target.closest(".diary-entry");
      if (!entry) return;
      const id = entry.dataset.id;
      const action = event.target.closest("[data-action]")?.dataset.action;

      if (action === "edit") {
        openDiaryEditor(id);
        return;
      }
      if (action === "delete") {
        if (!window.confirm("要删掉这篇日记吗？")) return;
        diaries = diaries.filter((item) => item.id !== id);
        saveDiaries();
        renderDiaries();
        toast("这一页已经收起来了");
        return;
      }
      if (event.target.closest(".toggle-entry")) {
        entry.classList.toggle("open");
        const toggle = $(".toggle-entry", entry);
        if (toggle) toggle.textContent = entry.classList.contains("open") ? "收起这一页 ↑" : "展开这一页 ↓";
      }
    });

    $("#addDateBtn")?.addEventListener("click", () => openDateEditor());
    $("#dateForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      saveDate();
    });
    $("#dateGrid")?.addEventListener("click", (event) => {
      const card = event.target.closest(".date-card");
      if (!card) return;
      const id = card.dataset.id;
      const action = event.target.closest("[data-action]")?.dataset.action;
      if (action === "edit") {
        openDateEditor(id);
        return;
      }
      if (action === "delete") {
        if (!window.confirm("要删掉这个日子吗？")) return;
        dates = dates.filter((item) => item.id !== id);
        saveDates();
        renderDates();
        toast("这个日子已经收起来了");
      }
    });

    $("#wishForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const text = $("#wishInput").value.trim();
      if (!text) {
        toast("先写一件想一起做的事吧 ♡");
        return;
      }
      wishes.push({ id: uid(), text, done: false });
      saveWishes();
      renderWishes();
      $("#wishInput").value = "";
      toast("愿望已经放进清单啦 ♡");
    });

    $("#wishList")?.addEventListener("click", (event) => {
      const item = event.target.closest(".wish-item");
      if (!item) return;
      const id = item.dataset.id;
      const wish = wishes.find((entry) => entry.id === id);
      if (!wish) return;

      const action = event.target.closest("[data-action]")?.dataset.action;
      if (action === "edit") {
        startWishEdit(item);
        return;
      }
      if (action === "delete") {
        if (!window.confirm("要删掉这个愿望吗？")) return;
        wishes = wishes.filter((entry) => entry.id !== id);
        saveWishes();
        renderWishes();
        toast("这个愿望已经取下");
        return;
      }
      if (event.target.closest(".wish-check")) {
        wish.done = !wish.done;
        saveWishes();
        renderWishes();
      }
    });

    $("#photoForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      savePhotoCaption();
    });

    $("#exportBtn")?.addEventListener("click", exportBackup);
    $("#importBtn")?.addEventListener("click", () => $("#importInput")?.click());
    $("#importInput")?.addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      importBackupFile(file);
      event.target.value = "";
    });

    $("#customizeForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      profile = {
        yourName: $("#yourName").value.trim(),
        partnerName: $("#partnerName").value.trim(),
        anniversary: $("#anniversary").value
      };
      store.set(STORAGE_KEYS.profile, profile);
      onLocalChange();
      renderProfile();
      closeModal($("#customizeModal"));
      toast("我们的故事已经保存好啦 ♡");
    });

    $("#addPhotoBtn")?.addEventListener("click", () => $("#photoInput")?.click());
    $("#photoInput")?.addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      handlePhotoFile(file);
      event.target.value = "";
    });

    $(".polaroid-row")?.addEventListener("click", (event) => {
      const edit = event.target.closest(".photo-edit");
      if (edit) {
        const figure = edit.closest(".polaroid.custom");
        const id = figure?.dataset.id;
        if (id) openPhotoEditor(id);
        return;
      }

      const remove = event.target.closest(".photo-remove");
      if (!remove) return;
      const figure = remove.closest(".polaroid.custom");
      const id = figure?.dataset.id;
      if (!id) return;
      if (!window.confirm("要删掉这张照片吗？")) return;
      customPhotos = customPhotos.filter((photo) => photo.id !== id);
      savePhotos();
      renderPhotos();
      toast("照片已经取下");
    });

    $$("[data-close]").forEach((node) => {
      node.addEventListener("click", () => closeModal(node.closest(".modal")));
    });

    $$(".modal .modal-backdrop").forEach((backdrop) => {
      backdrop.addEventListener("click", () => closeModal(backdrop.closest(".modal")));
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeAllModals();
    });
  };

  /* ---------- self test (used by headless check) ---------- */
  const runSelfTest = () => {
    const results = [];
    const assert = (name, condition) => results.push(`${condition ? "PASS" : "FAIL"} · ${name}`);

    try {
      const originalTheme = savedTheme;
      applyTheme("mint", true);
      assert("theme applies mint", document.documentElement.dataset.theme === "mint");
      assert("theme persists", store.get(STORAGE_KEYS.theme, "") === "mint");
      document.querySelector('#themeGrid .theme-card[data-theme="mint"]')?.click();
      document.querySelector("#saveThemeBtn")?.click();
      assert("theme save button persists", store.get(STORAGE_KEYS.theme, "") === "mint");
      applyTheme(originalTheme, true);

      const beforeDiaries = diaries.length;
      diaries.push({ id: uid(), date: todayISO(), mood: "开心", title: "自测日记", body: "这是一条自测内容。" });
      saveDiaries();
      renderDiaries();
      assert("diary can be added", diaries.length === beforeDiaries + 1);
      assert("diary count renders", ($("#diaryCount")?.textContent || "").includes(String(diaries.length)));

      openDiaryEditor();
      $("#diaryTitle").value = "表单自测日记";
      $("#diaryBody").value = "通过表单提交。";
      $("#diaryForm").requestSubmit();
      assert("diary form submits", diaries.some((entry) => entry.title === "表单自测日记"));

      diaries = diaries.filter((entry) => entry.title !== "自测日记" && entry.title !== "表单自测日记");
      saveDiaries();
      renderDiaries();

      const oldProfile = { ...profile };
      $("#yourName").value = "自测A";
      $("#partnerName").value = "自测B";
      $("#anniversary").value = "2026-01-01";
      $("#customizeForm").requestSubmit();
      assert("customize form updates footer", ($("#footerNames")?.textContent || "").includes("自测A"));
      profile = oldProfile;
      store.set(STORAGE_KEYS.profile, profile);
      renderProfile();

      const beforeWhispers = whispers.length;
      addWhisper("自测", "这是一条自测悄悄话。", true);
      assert("whisper can be added", whispers.length === beforeWhispers + 1);

      $("#whisperName").value = "表单自测";
      $("#whisperText").value = "通过表单寄出的悄悄话。";
      $("#whisperForm").requestSubmit();
      assert("whisper form submits", whispers.some((entry) => entry.name === "表单自测"));

      whispers = whispers.filter((entry) => entry.name !== "自测" && entry.name !== "表单自测");
      saveWhispers();
      renderWhispers();

      openDateEditor();
      $("#dateTitle").value = "自测纪念日";
      $("#dateValue").value = todayISO();
      $("#dateType").value = "纪念日";
      $("#dateForm").requestSubmit();
      assert("date form submits", dates.some((entry) => entry.title === "自测纪念日"));
      assert("date card renders", ($("#dateGrid")?.textContent || "").includes("自测纪念日"));
      const testDate = dates.find((entry) => entry.title === "自测纪念日");
      if (testDate) {
        openDateEditor(testDate.id);
        $("#dateTitle").value = "自测纪念日改";
        $("#dateForm").requestSubmit();
        assert("date edits", dates.some((entry) => entry.title === "自测纪念日改"));
      }
      dates = dates.filter((entry) => !String(entry.title).startsWith("自测纪念日"));
      saveDates();
      renderDates();

      $("#wishInput").value = "自测愿望";
      $("#wishForm").requestSubmit();
      const testWish = wishes.find((entry) => entry.text === "自测愿望");
      assert("wish form submits", Boolean(testWish));
      if (testWish) {
        const wishItem = $(`.wish-item[data-id="${testWish.id}"]`);
        wishItem?.querySelector('[data-action="edit"]')?.click();
        const wishInput = wishItem?.querySelector(".wish-inline-input");
        if (wishInput) {
          wishInput.value = "自测愿望改";
          wishInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
          assert("wish edits", wishes.some((entry) => entry.text === "自测愿望改"));
        }
        $(`.wish-item[data-id="${testWish.id}"] .wish-check`)?.click();
        assert("wish toggles done", wishes.find((entry) => entry.id === testWish.id)?.done === true);
      }
      wishes = wishes.filter((entry) => !String(entry.text).startsWith("自测愿望"));
      saveWishes();
      renderWishes();

      const testPhoto = { id: uid(), src: "data:image/gif;base64,R0lGODlhAQABAAAAACw=", caption: "旧说明" };
      customPhotos.push(testPhoto);
      renderPhotos();
      openPhotoEditor(testPhoto.id);
      $("#photoCaption").value = "新说明";
      $("#photoForm").requestSubmit();
      assert("photo caption edits", customPhotos.find((entry) => entry.id === testPhoto.id)?.caption === "新说明");
      customPhotos = customPhotos.filter((entry) => entry.id !== testPhoto.id);
      savePhotos();
      renderPhotos();

      const backup = buildBackup();
      assert("backup includes collections", Array.isArray(backup.dates) && Array.isArray(backup.wishes) && Array.isArray(backup.photos));

      assert("memory deck has 12 cards", deck.length === 12);
      assert("memory deck has 6 pairs", new Set(deck.map((card) => card.emoji)).size === 6);

      openModal("diaryModal");
      assert("modal opens", $("#diaryModal")?.classList.contains("is-open") === true);
      closeModal($("#diaryModal"));
      assert("modal closes", $("#diaryModal")?.classList.contains("is-open") === false);

      startGame();
      const cards = $$(".memory-card");
      cards[0]?.click();
      assert("memory card flips", cards[0]?.classList.contains("flipped") === true);
      cards[1]?.click();
      assert("memory second card flips", cards[1]?.classList.contains("flipped") === true);
      startGame();

      assert("profile renders footer", Boolean($("#footerNames")?.textContent?.trim()));
    } catch (error) {
      results.push(`FAIL · runtime: ${error?.message || error}`);
    }

    const pre = document.createElement("pre");
    pre.id = "selftest-results";
    pre.style.cssText = "position:fixed;left:8px;bottom:8px;z-index:9999;background:#fff;color:#222;padding:8px;font-size:11px;border:1px solid #ccc;max-width:420px;white-space:pre-wrap;";
    pre.textContent = results.join("\n");
    document.body.appendChild(pre);
  };

  window.__littleUniverse = {
    applyTheme,
    addWhisper,
    openModal,
    closeModal,
    startGame,
    getDeck: () => deck,
    getDiaries: () => diaries,
    getWhispers: () => whispers,
    getDates: () => dates,
    getWishes: () => wishes
  };

  const boot = () => {
    init().catch((error) => {
      console.error("little universe init failed", error);
      toast("页面加载遇到一点问题，刷新试试");
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
