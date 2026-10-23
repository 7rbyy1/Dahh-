/* =========================================================
   دهاء — منطق اللعبة
   ========================================================= */
(function () {
  "use strict";

  const CATEGORIES = window.DAHAA_CATEGORIES || [];
  const BANK = window.DAHAA_QUESTIONS || {};
  const TIERS = [200, 400, 600];        // مستويات النقاط
  const PER_TIER = 2;                    // سؤالان لكل مستوى = 6 أسئلة لكل فئة
  const MAX_PICK = 6;
  const STATE_KEY = "dahaa_state_v1";
  const USED_KEY = "dahaa_used_v1";

  // ألوان ورموز البوستر الاحتياطي (تظهر إذا لم تُرفع صورة البوستر)
  const FALLBACK = {
    "resident-evil":  { g: "☣",  c: ["#8E5A44", "#4A2E24"] },
    "minecraft":      { g: "⛏",  c: ["#7E8A55", "#4F5A33"] },
    "roblox":         { g: "◼",  c: ["#A7826A", "#5E4835"] },
    "overwatch":      { g: "◎",  c: ["#C08A5B", "#7A5236"] },
    "fortnite":       { g: "✦",  c: ["#9B7FA0", "#5C4766"] },
    "red-dead":       { g: "✶",  c: ["#A0553B", "#5C2C1E"] },
    "silent-hill":    { g: "☁",  c: ["#9C9488", "#56504A"] },
    "dexter":         { g: "◆",  c: ["#9A4A42", "#552824"] },
    "breaking-bad":   { g: "⚗",  c: ["#7F8C5F", "#3F4A2F"] },
    "interstellar":   { g: "◐",  c: ["#6F7A86", "#33393F"] },
    "beautiful-mind": { g: "∑",  c: ["#B59670", "#6E5638"] },
    "history":        { g: "⌛", c: ["#B3936A", "#6B5233"] },
    "football":       { g: "⚽", c: ["#6E8460", "#3A4D33"] },
    "series":         { g: "▶",  c: ["#A27560", "#5C3E31"] },
    "movies":         { g: "🎬", c: ["#8C6E52", "#4A3828"] }
  };

  /* ---------------- Helpers ---------------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const catById = (id) => CATEGORIES.find((c) => c.id === id);
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const toAr = (n) => String(n); // أرقام إنجليزية للوضوح؛ غيّرها لـ toLocaleString("ar-SA") إن رغبت

  const storage = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
      catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* تجاهل */ }
    },
    remove(key) {
      try { localStorage.removeItem(key); } catch (e) { /* تجاهل */ }
    }
  };

  function posterBg(id) {
    const f = FALLBACK[id] || { c: ["#C9B497", "#8C6E52"] };
    return `linear-gradient(160deg, ${f.c[0]}, ${f.c[1]})`;
  }

  /* ---------------- State ---------------- */
  const defaultState = () => ({
    screen: "setup",
    selected: [],
    teams: [{ name: "الفريق الأول", score: 0 }, { name: "الفريق الثاني", score: 0 }],
    timer: 60,
    turn: 0,
    board: null // { [catId]: [ { id, tier, q, a, status } ] }
  });

  let state = Object.assign(defaultState(), storage.get(STATE_KEY, {}));
  let used = new Set(storage.get(USED_KEY, []));
  const save = () => storage.set(STATE_KEY, state);
  const saveUsed = () => storage.set(USED_KEY, Array.from(used));

  /* ---------------- Question picking (no repeats) ---------------- */
  function pickQuestions(catId, tier, count) {
    const pool = (BANK[catId] && BANK[catId][tier]) || [];
    const all = pool.map((item, i) => ({ id: `${catId}:${tier}:${i}`, tier, q: item.q, a: item.a, status: null }));
    let fresh = all.filter((x) => !used.has(x.id));
    if (fresh.length < count) {
      // انتهى بنك هذا المستوى — نعيد تدويره
      all.forEach((x) => used.delete(x.id));
      saveUsed();
      fresh = all;
    }
    return shuffle(fresh).slice(0, count);
  }

  function buildBoard() {
    const board = {};
    state.selected.forEach((catId) => {
      board[catId] = TIERS.flatMap((t) => pickQuestions(catId, t, PER_TIER));
    });
    return board;
  }

  /* =========================================================
     SCREEN 1 — SETUP
     ========================================================= */
  const grid = $("#categoryGrid");

  const missingPosters = new Set(); // لا نعيد طلب صورة غير موجودة

  function posterMarkup(cat, withName, container) {
    if (missingPosters.has(cat.id)) container.classList.add("no-img");
    const f = FALLBACK[cat.id] || { g: "✦" };
    const img = document.createElement("img");
    img.addEventListener("error", () => { missingPosters.add(cat.id); container.classList.add("no-img"); });
    if (!missingPosters.has(cat.id)) img.src = cat.poster;
    img.alt = cat.name;
    img.loading = "lazy";
    img.decoding = "async";
    const fb = document.createElement("div");
    fb.className = "poster-fallback";
    const glyph = document.createElement("span");
    glyph.className = "pf-glyph";
    glyph.textContent = f.g;
    fb.appendChild(glyph);
    if (withName) {
      const nm = document.createElement("span");
      nm.className = "pf-name";
      nm.textContent = cat.name;
      fb.appendChild(nm);
    }
    return { img, fb };
  }

  function renderCategories() {
    grid.innerHTML = "";
    CATEGORIES.forEach((cat) => {
      const card = document.createElement("div");
      card.className = "cat-card";
      card.setAttribute("role", "listitem");
      card.tabIndex = 0;
      card.dataset.id = cat.id;

      const poster = document.createElement("div");
      poster.className = "cat-poster";
      poster.style.setProperty("--poster-bg", posterBg(cat.id));
      const { img, fb } = posterMarkup(cat, false, poster);
      poster.append(img, fb);

      const check = document.createElement("span");
      check.className = "cat-check";
      check.setAttribute("aria-hidden", "true");

      const name = document.createElement("div");
      name.className = "cat-name";
      name.textContent = cat.name;

      card.append(check, poster, name);
      card.addEventListener("click", () => toggleCategory(cat.id));
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleCategory(cat.id); }
      });
      grid.appendChild(card);
    });
    updateSelectionUI();
  }

  function toggleCategory(id) {
    const i = state.selected.indexOf(id);
    if (i > -1) state.selected.splice(i, 1);
    else if (state.selected.length < MAX_PICK) state.selected.push(id);
    else return shake($("#pickCount").parentElement);
    save();
    updateSelectionUI();
  }

  function updateSelectionUI() {
    const full = state.selected.length >= MAX_PICK;
    $$(".cat-card", grid).forEach((card) => {
      const idx = state.selected.indexOf(card.dataset.id);
      const on = idx > -1;
      card.classList.toggle("is-selected", on);
      card.classList.toggle("is-disabled", full && !on);
      card.setAttribute("aria-pressed", String(on));
      $(".cat-check", card).textContent = on ? toAr(idx + 1) : "";
    });
    $("#pickCount").textContent = toAr(state.selected.length);
    $("#btnStart").disabled = state.selected.length !== MAX_PICK;
  }

  function shake(el) {
    if (!el || !el.animate) return;
    el.animate(
      [{ transform: "translateX(0)" }, { transform: "translateX(-6px)" }, { transform: "translateX(6px)" }, { transform: "translateX(0)" }],
      { duration: 260 }
    );
  }

  $("#btnRandom").addEventListener("click", () => {
    state.selected = shuffle(CATEGORIES.map((c) => c.id)).slice(0, MAX_PICK);
    save();
    updateSelectionUI();
  });

  function readSetupInputs() {
    const n1 = $("#team1Name").value.trim() || "الفريق الأول";
    const n2 = $("#team2Name").value.trim() || "الفريق الثاني";
    state.teams[0].name = n1;
    state.teams[1].name = n2;
    state.timer = parseInt($("#timerSeconds").value, 10) || 60;
  }

  ["#team1Name", "#team2Name", "#timerSeconds"].forEach((sel) =>
    $(sel).addEventListener("change", () => { readSetupInputs(); save(); })
  );

  $("#btnStart").addEventListener("click", () => {
    if (state.selected.length !== MAX_PICK) return;
    readSetupInputs();
    const sameCats = state.board && Object.keys(state.board).length === MAX_PICK &&
      state.selected.every((id) => state.board[id]);
    if (!sameCats) {
      state.board = buildBoard();
      state.teams.forEach((t) => (t.score = 0));
      state.turn = 0;
    }
    state.screen = "board";
    save();
    showScreen();
  });

  /* =========================================================
     SCREEN 2 — BOARD
     ========================================================= */
  const boardEl = $("#board");

  function renderBoard() {
    boardEl.innerHTML = "";
    state.selected.forEach((catId) => {
      const cat = catById(catId);
      const col = document.createElement("div");
      col.className = "board-col";

      const head = document.createElement("div");
      head.className = "col-head";
      head.style.setProperty("--poster-bg", posterBg(catId));
      const { img, fb } = posterMarkup(cat, false, head);
      const title = document.createElement("div");
      title.className = "col-title";
      title.textContent = cat.name;
      head.append(img, fb, title);
      col.appendChild(head);

      state.board[catId].forEach((item, idx) => {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "cell";
        cell.dataset.tier = item.tier;
        if (item.status === null) {
          cell.textContent = toAr(item.tier);
          cell.setAttribute("aria-label", `${cat.name} — ${item.tier} نقطة`);
          cell.addEventListener("click", () => openQuestion(catId, idx));
        } else {
          cell.disabled = true;
          if (item.status === 0 || item.status === 1) {
            cell.classList.add(`won-${item.status}`);
            cell.textContent = state.teams[item.status].name;
          } else {
            cell.textContent = "—";
          }
        }
        col.appendChild(cell);
      });
      boardEl.appendChild(col);
    });
    renderScores();
  }

  function remainingCount() {
    if (!state.board) return 0;
    return Object.values(state.board).flat().filter((x) => x.status === null).length;
  }

  function renderScores(bumpTeam) {
    state.teams.forEach((t, i) => {
      $(`#team${i}Label`).textContent = t.name;
      const s = $(`#team${i}Score`);
      s.textContent = toAr(t.score);
      if (bumpTeam === i) {
        s.classList.remove("bump");
        void s.offsetWidth;
        s.classList.add("bump");
      }
      $(`.team-card[data-team="${i}"]`).classList.toggle("is-turn", state.turn === i);
    });
    $("#remainingCount").textContent = toAr(remainingCount());
    $("#award0").textContent = state.teams[0].name;
    $("#award1").textContent = state.teams[1].name;
  }

  $$(".score-btn").forEach((btn) =>
    btn.addEventListener("click", () => {
      const t = +btn.dataset.team;
      state.teams[t].score += +btn.dataset.delta;
      save();
      renderScores(t);
    })
  );

  $("#btnSwitchTurn").addEventListener("click", () => {
    state.turn = state.turn === 0 ? 1 : 0;
    save();
    renderScores();
  });

  /* =========================================================
     QUESTION MODAL + TIMER
     ========================================================= */
  const qModal = $("#questionModal");
  let current = null; // { catId, idx }

  const RADIUS = 52;
  const CIRC = 2 * Math.PI * RADIUS;
  const ring = $("#timerProgress");
  ring.style.strokeDasharray = String(CIRC);

  const timer = {
    total: 60000, remaining: 60000, endAt: 0, running: false, handle: null, done: false,
    start(seconds) {
      this.total = this.remaining = seconds * 1000;
      this.done = false;
      this.resume();
    },
    resume() {
      if (this.done) return;
      this.running = true;
      this.endAt = performance.now() + this.remaining;
      clearInterval(this.handle);
      this.handle = setInterval(() => this.tick(), 100);
      this.render();
    },
    pause() {
      if (!this.running) return;
      this.remaining = Math.max(0, this.endAt - performance.now());
      this.running = false;
      clearInterval(this.handle);
      this.render();
    },
    stop() {
      this.running = false;
      clearInterval(this.handle);
    },
    tick() {
      this.remaining = Math.max(0, this.endAt - performance.now());
      if (this.remaining <= 0) {
        this.stop();
        this.done = true;
        beep();
      }
      this.render();
    },
    render() {
      const el = $("#timer");
      const secs = Math.ceil(this.remaining / 1000);
      $("#timerValue").textContent = this.done ? "انتهى!" : toAr(secs);
      ring.style.strokeDashoffset = String(CIRC * (1 - this.remaining / this.total));
      el.classList.toggle("is-warn", !this.done && secs <= 10);
      el.classList.toggle("is-done", this.done);
      el.classList.toggle("is-paused", !this.running && !this.done);
      const pauseBtn = $("#btnPause");
      pauseBtn.textContent = this.running ? "إيقاف مؤقت" : "استئناف";
      pauseBtn.disabled = this.done;
    }
  };

  let audioCtx = null;
  function beep() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.22, 0.44].forEach((offset) => {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = "sine";
        o.frequency.value = 660;
        g.gain.setValueAtTime(0.0001, audioCtx.currentTime + offset);
        g.gain.exponentialRampToValueAtTime(0.25, audioCtx.currentTime + offset + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + offset + 0.18);
        o.connect(g).connect(audioCtx.destination);
        o.start(audioCtx.currentTime + offset);
        o.stop(audioCtx.currentTime + offset + 0.2);
      });
    } catch (e) { /* الصوت غير مدعوم */ }
  }

  function openQuestion(catId, idx) {
    const item = state.board[catId][idx];
    current = { catId, idx };
    used.add(item.id);
    saveUsed();

    $("#qCategory").textContent = catById(catId).name;
    $("#qPoints").textContent = `${toAr(item.tier)} نقطة`;
    $("#qText").textContent = item.q;
    $("#aText").textContent = item.a;
    $("#answerBox").classList.add("hidden");
    $("#revealActions").classList.remove("hidden");
    $("#awardActions").classList.add("hidden");

    openModal(qModal);
    // تهيئة الصوت بعد تفاعل المستخدم (متطلب المتصفحات)
    try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    timer.start(state.timer);
    $("#btnReveal").focus();
  }

  function closeQuestion() {
    timer.stop();
    current = null;
    closeModal(qModal);
  }

  $("#btnPause").addEventListener("click", () => (timer.running ? timer.pause() : timer.resume()));
  $("#btnRestart").addEventListener("click", () => timer.start(state.timer));
  $("#btnCloseModal").addEventListener("click", closeQuestion);

  $("#btnReveal").addEventListener("click", () => {
    timer.pause();
    $("#answerBox").classList.remove("hidden");
    $("#revealActions").classList.add("hidden");
    $("#awardActions").classList.remove("hidden");
  });

  $$("[data-award]").forEach((btn) =>
    btn.addEventListener("click", () => {
      if (!current) return;
      const item = state.board[current.catId][current.idx];
      const who = btn.dataset.award;
      let bumped;
      if (who === "none") {
        item.status = "none";
      } else {
        const t = +who;
        item.status = t;
        state.teams[t].score += item.tier;
        bumped = t;
      }
      state.turn = state.turn === 0 ? 1 : 0;
      save();
      closeQuestion();
      renderBoard();
      renderScores(bumped);
      if (remainingCount() === 0) setTimeout(showWinner, 450);
    })
  );

  /* ---------------- Winner ---------------- */
  function showWinner() {
    const [a, b] = state.teams;
    const title = $("#winnerTitle");
    if (a.score === b.score) title.textContent = "تعادل!";
    else title.textContent = `فاز ${a.score > b.score ? a.name : b.name}`;
    $("#winnerScore").textContent = `${a.name}: ${toAr(a.score)} · ${b.name}: ${toAr(b.score)}`;
    openModal($("#winnerModal"));
  }

  /* ---------------- Generic modals ---------------- */
  function openModal(m) {
    m.classList.remove("hidden");
    document.body.classList.add("modal-open");
  }
  function closeModal(m) {
    m.classList.add("hidden");
    if (!$$(".modal").some((x) => !x.classList.contains("hidden"))) {
      document.body.classList.remove("modal-open");
    }
  }
  $$(".modal").forEach((m) =>
    $$("[data-close]", m).forEach((el) => el.addEventListener("click", () => closeModal(m)))
  );

  let confirmCb = null;
  function confirmBox(title, text, cb) {
    $("#confirmTitle").textContent = title;
    $("#confirmText").textContent = text;
    confirmCb = cb;
    openModal($("#confirmModal"));
  }
  $("#confirmYes").addEventListener("click", () => {
    closeModal($("#confirmModal"));
    if (confirmCb) confirmCb();
    confirmCb = null;
  });

  $("#btnRules").addEventListener("click", () => openModal($("#rulesModal")));

  /* ---------------- New game / navigation ---------------- */
  function newGame(keepCategories) {
    state.board = null;
    state.teams.forEach((t) => (t.score = 0));
    state.turn = 0;
    if (!keepCategories) state.selected = [];
    state.screen = "setup";
    save();
    closeModal($("#winnerModal"));
    showScreen();
  }

  $("#btnNewGame").addEventListener("click", () =>
    confirmBox("قيم جديد؟", "سيتم تصفير النقاط وسحب أسئلة جديدة.", () => newGame(true))
  );
  $("#btnPlayAgain").addEventListener("click", () => newGame(true));

  $("#btnBackToSetup").addEventListener("click", () =>
    confirmBox("تغيير الفئات؟", "تغيير الفئات يبدأ قيماً جديداً وتُصفَّر النقاط.", () => newGame(true))
  );

  $("#brandHome").addEventListener("click", (e) => e.preventDefault());

  /* ---------------- Keyboard ---------------- */
  document.addEventListener("keydown", (e) => {
    if (!qModal.classList.contains("hidden")) {
      if (e.code === "Space" && document.activeElement.tagName !== "BUTTON") {
        e.preventDefault();
        timer.running ? timer.pause() : timer.resume();
      }
      if (e.key === "Escape") closeQuestion();
      return;
    }
    if (e.key === "Escape") {
      $$(".modal").forEach((m) => { if (!m.classList.contains("hidden")) closeModal(m); });
    }
  });

  /* ---------------- Screen switching ---------------- */
  function showScreen() {
    const onBoard = state.screen === "board" && state.board;
    $("#screenSetup").classList.toggle("hidden", !!onBoard);
    $("#screenBoard").classList.toggle("hidden", !onBoard);
    $("#btnNewGame").classList.toggle("hidden", !onBoard);
    $("#btnBackToSetup").classList.toggle("hidden", !onBoard);

    if (onBoard) {
      renderBoard();
    } else {
      $("#team1Name").value = state.teams[0].name;
      $("#team2Name").value = state.teams[1].name;
      $("#timerSeconds").value = String(state.timer);
      updateSelectionUI();
    }
    window.scrollTo({ top: 0 });
  }

  /* ---------------- Init ---------------- */
  // تنظيف أي فئة محفوظة لم تعد موجودة
  state.selected = state.selected.filter((id) => catById(id)).slice(0, MAX_PICK);
  if (state.board && !state.selected.every((id) => state.board[id])) state.board = null;

  renderCategories();
  showScreen();
})();
