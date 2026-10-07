(function () {
  var BH = window.BetHouse;
  var KEY = "bethouse-player";
  var markets = { orange: null, red: null };
  var bets = { orange: BH.emptyBets(), red: BH.emptyBets() };
  var active = Math.random() < 0.5 ? "orange" : "red";
  var name = "";
  var phase = "gate";

  var gate = document.getElementById("gate");
  var betView = document.getElementById("bet");
  var outro = document.getElementById("outro");
  var nameInput = document.getElementById("name");
  var gateNote = document.getElementById("gate-note");
  var available = document.getElementById("available");
  var identity = document.getElementById("identity");
  var board = document.getElementById("board");
  var toast = document.getElementById("toast");
  var modal = document.getElementById("modal");

  document.getElementById("mode").textContent = BH.mode === "firebase" ? "Firebase" : "Preview";
  if (BH.mode === "firebase") document.getElementById("mode").classList.add("live");

  function loadSession() {
    try { return JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch (e) { return null; }
  }
  function saveSession() {
    var payload = { phase: phase, name: name, active: active, bets: bets };
    try { sessionStorage.setItem(KEY, JSON.stringify(payload)); } catch (e) {}
  }

  function showToast(text) {
    toast.textContent = text;
    toast.classList.remove("hidden");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () { toast.classList.add("hidden"); }, 2400);
  }

  function total() { return BH.sumBets(bets.orange) + BH.sumBets(bets.red); }

  function renderIdentity() {
    var icon = active === "orange" ? "icons/orange.png" : "icons/red.png";
    identity.className = "identity " + active;
    if (active === "orange") {
      identity.innerHTML = '<img alt="Orange" src="' + icon + '"><div class="who">' + escapeHtml(name) + "</div>";
    } else {
      identity.innerHTML = '<div class="who">' + escapeHtml(name) + '</div><img alt="Red" src="' + icon + '">';
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return "&#" + c.charCodeAt(0) + ";";
    });
  }

  function renderBoard() {
    var market = markets[active] || { coefs: {} };
    var inputs = board.querySelectorAll(".amount");
    var sameMarket = board.getAttribute("data-market") === active && inputs.length === BH.OUTCOMES.length;
    if (!sameMarket) {
      board.innerHTML = "";
      board.setAttribute("data-market", active);
      BH.OUTCOMES.forEach(function (o) {
        var row = document.createElement("div");
        row.className = "rowline";
        var left = document.createElement("div");
        left.className = "side green";
        left.innerHTML = '<div class="main">' + o.left + '</div>' + (o.leftSub ? '<div class="sub">' + o.leftSub + "</div>" : "");
        var mid = document.createElement("div");
        mid.className = "mid";
        var input = document.createElement("input");
        input.className = "amount";
        input.inputMode = "numeric";
        input.setAttribute("aria-label", BH.label(o.key));
        input.addEventListener("change", function () { onAmount(o.key, input); });
        input.addEventListener("input", function () { onAmount(o.key, input); });
        var coefEl = document.createElement("div");
        coefEl.className = "coef";
        mid.appendChild(input);
        mid.appendChild(coefEl);
        var right = document.createElement("div");
        right.className = "side blue";
        right.innerHTML = '<div class="main">' + o.right + '</div>' + (o.rightSub ? '<div class="sub">' + o.rightSub + "</div>" : "");
        row.appendChild(left);
        row.appendChild(mid);
        row.appendChild(right);
        board.appendChild(row);
      });
      inputs = board.querySelectorAll(".amount");
    }
    BH.OUTCOMES.forEach(function (o, i) {
      var coef = market.coefs ? market.coefs[o.key] : null;
      var locked = BH.isLocked(coef);
      var input = inputs[i];
      var row = input.closest(".rowline");
      row.classList.toggle("locked", locked);
      input.disabled = locked;
      if (locked && bets[active][o.key]) bets[active][o.key] = 0;
      if (document.activeElement !== input) input.value = bets[active][o.key] || 0;
      var coefEl = input.nextElementSibling;
      coefEl.textContent = BH.formatCoef(coef);
    });
    available.textContent = String(100 - total());
    document.getElementById("tab-orange").className = active === "orange" ? "active-orange" : "";
    document.getElementById("tab-red").className = active === "red" ? "active-red" : "";
  }

  function onAmount(key, input) {
    var raw = String(input.value).trim();
    var next = raw === "" ? 0 : Number(raw);
    var previous = bets[active][key] || 0;
    if (!/^\d+$/.test(raw) && raw !== "") {
      input.value = previous;
      input.classList.add("bad");
      showToast("Whole kSEK only");
      return;
    }
    if (next < 0 || next > 100) {
      input.value = previous;
      input.classList.add("bad");
      showToast("Enter a number from 0 to 100");
      return;
    }
    bets[active][key] = next;
    if (total() > 100) {
      bets[active][key] = previous;
      input.value = previous;
      input.classList.add("bad");
      showToast("That exceeds 100 kSEK");
      available.textContent = String(100 - total());
      return;
    }
    input.classList.remove("bad");
    available.textContent = String(100 - total());
    saveSession();
  }

  function showPhase(next) {
    phase = next;
    gate.classList.toggle("hidden", phase !== "gate");
    betView.classList.toggle("hidden", phase !== "bet");
    outro.classList.toggle("hidden", phase !== "outro");
    saveSession();
  }

  function summaryHtml() {
    function lines(book) {
      var items = BH.ALL_KEYS.filter(function (k) { return (bets[book][k] || 0) > 0; })
        .map(function (k) { return "<li><span>" + BH.label(k) + "</span><b>" + bets[book][k] + "</b></li>"; })
        .join("");
      return items || "<li><span>No stake</span><b>0</b></li>";
    }
    return '<p>Available <b>' + (100 - total()) + '</b> kSEK</p>' +
      '<p><span class="tag orange">Orange</span></p><ul>' + lines("orange") + "</ul>" +
      '<p><span class="tag red">Red</span></p><ul>' + lines("red") + "</ul>";
  }

  function showOutro() {
    document.getElementById("outro-lead").textContent = name + ", your bet is stored.";
    document.getElementById("outro-body").innerHTML = summaryHtml();
    showPhase("outro");
  }

  function commit() {
    BH.placeBet(name, bets.orange, bets.red).then(showOutro).catch(function () {
      showToast("Could not store the bet");
    });
  }

  document.getElementById("proceed").addEventListener("click", function () {
    var wanted = nameInput.value.trim();
    gateNote.textContent = "";
    if (!wanted) {
      gateNote.textContent = "Enter a name.";
      return;
    }
    BH.claimName(wanted).then(function (clean) {
      name = clean;
      showPhase("bet");
      renderIdentity();
      renderBoard();
    }).catch(function (err) {
      if (err && err.code === "exists") gateNote.textContent = "That name exists. Enter another one.";
      else gateNote.textContent = "Could not store the name. Try again.";
    });
  });
  nameInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") document.getElementById("proceed").click();
  });

  document.getElementById("tab-orange").addEventListener("click", function () {
    active = "orange"; renderIdentity(); renderBoard(); saveSession();
  });
  document.getElementById("tab-red").addEventListener("click", function () {
    active = "red"; renderIdentity(); renderBoard(); saveSession();
  });

  document.getElementById("place").addEventListener("click", function () {
    if (total() > 100) {
      showToast("That exceeds 100 kSEK");
      return;
    }
    var left = 100 - total();
    if (left > 0) {
      document.getElementById("modal-text").textContent = "Are you sure? You still have " + left + " kSEK on your account.";
      modal.classList.remove("hidden");
      return;
    }
    commit();
  });
  document.getElementById("bet-more").addEventListener("click", function () { modal.classList.add("hidden"); });
  document.getElementById("confirm-yes").addEventListener("click", function () {
    modal.classList.add("hidden");
    commit();
  });

  BH.watchMarket("orange", function (m) { markets.orange = m; if (phase === "bet") renderBoard(); });
  BH.watchMarket("red", function (m) { markets.red = m; if (phase === "bet") renderBoard(); });

  var saved = loadSession();
  if (saved && saved.name && (saved.phase === "bet" || saved.phase === "outro")) {
    name = saved.name;
    active = saved.active || active;
    bets.orange = Object.assign(BH.emptyBets(), saved.bets && saved.bets.orange);
    bets.red = Object.assign(BH.emptyBets(), saved.bets && saved.bets.red);
    if (saved.phase === "outro") showOutro();
    else {
      showPhase("bet");
      renderIdentity();
      renderBoard();
    }
  }

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") saveSession();
  });
})();
