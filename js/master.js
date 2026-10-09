(function () {
  var BH = window.BetHouse;
  var KEY = "bethouse-master";
  var own = "";
  var viewId = "";
  var view = "weights";
  var markets = { orange: null, red: null };
  var players = [];
  var sortDir = "desc";
  var saveTimer = null;
  var builtFor = "";

  function session() {
    try { return JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch (e) { return null; }
  }
  function saveSession() {
    try { sessionStorage.setItem(KEY, JSON.stringify({ own: own })); } catch (e) {}
  }
  function current() { return markets[viewId] || { targetProfit: 5, weights: BH.emptyBets(), coefs: {}, status: "weights", published: false }; }
  function editable() { return viewId === own && !current().published && !current().weightsLocked && current().status === "weights"; }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }

  function enter(house) {
    own = house;
    viewId = house;
    saveSession();
    document.getElementById("lobby").classList.add("hidden");
    document.getElementById("desk").classList.remove("hidden");
    document.getElementById("to-lobby").classList.remove("hidden");
    history.replaceState(null, "", "master.html");
    paint();
  }
  function tryPin(value) {
    var pin = String(value || "").trim();
    var house = pin === window.MASTER_PINS.orange ? "orange" : pin === window.MASTER_PINS.red ? "red" : "";
    if (!house) { document.getElementById("lobby-note").textContent = "Wrong pin for the selected house."; return; }
    var picked = document.getElementById("pick-orange").classList.contains("on") ? "orange" : document.getElementById("pick-red").classList.contains("on") ? "red" : "";
    if (picked && picked !== house) { document.getElementById("lobby-note").textContent = "That pin belongs to the other house."; return; }
    enter(house);
  }
  document.getElementById("pick-orange").addEventListener("click", function () {
    document.getElementById("pick-orange").classList.add("on");
    document.getElementById("pick-red").classList.remove("on");
  });
  document.getElementById("pick-red").addEventListener("click", function () {
    document.getElementById("pick-red").classList.add("on");
    document.getElementById("pick-orange").classList.remove("on");
  });
  document.getElementById("pin").addEventListener("input", function (e) { if (e.target.value.length >= 3) tryPin(e.target.value); });
  document.getElementById("to-lobby").addEventListener("click", showLobby);

  function renderIdentity() {
    var el = document.getElementById("identity");
    var icon = viewId === "orange" ? "icons/orange.png" : "icons/red.png";
    var label = viewId === "orange" ? "Orange" : "Red";
    el.className = "identity " + viewId;
    el.innerHTML = viewId === "orange"
      ? '<img alt="" src="' + icon + '"><div class="who">' + label + "</div>"
      : '<div class="who">' + label + '</div><img alt="" src="' + icon + '">';
    document.getElementById("tab-orange").className = viewId === "orange" ? "active-orange" : "";
    document.getElementById("tab-red").className = viewId === "red" ? "active-red" : "";
    document.getElementById("tab-orange").disabled = own !== "orange" && viewId === "orange" ? false : false;
  }
  function renderRegime() {
    var m = current();
    var button = document.getElementById("regime");
    button.classList.toggle("bets", m.status === "bets");
    button.disabled = viewId !== own || m.published;
    var locks = (m.betsLocked ? " · bets locked" : "") + (m.weightsLocked ? " · weights locked" : "");
    document.getElementById("status-label").textContent = (viewId === own ? "Your house" : "View only") + (m.published ? " · published" : " · open") + locks;
    document.getElementById("desk").classList.toggle("readonly", !editable());
  }
  function showLobby() {
    sessionStorage.removeItem(KEY);
    own = "";
    document.getElementById("desk").classList.add("hidden");
    document.getElementById("lobby").classList.remove("hidden");
    document.getElementById("to-lobby").classList.add("hidden");
    document.getElementById("pin").value = "";
    history.replaceState(null, "", "master.html");
  }
  function renderWeights() {
    var m = current();
    var profit = document.getElementById("profit");
    profit.disabled = !editable();
    if (document.activeElement !== profit) profit.value = m.targetProfit;
    var board = document.getElementById("board");
    if (builtFor !== viewId) {
      board.innerHTML = "";
      builtFor = viewId;
      BH.OUTCOMES.forEach(function (o) {
        var row = document.createElement("div");
        row.className = "rowline";
        var left = document.createElement("div");
        left.className = "side green";
        left.innerHTML = '<div class="main">' + o.left + "</div>" + (o.leftSub ? '<div class="sub">' + o.leftSub + "</div>" : "");
        var mid = document.createElement("div");
        mid.className = "mid";
        var input = document.createElement("input");
        input.className = "weight";
        input.inputMode = "decimal";
        input.addEventListener("input", function () { onWeight(o.key, input.value); });
        var coefEl = document.createElement("div");
        coefEl.className = "coef";
        mid.appendChild(input); mid.appendChild(coefEl);
        var right = document.createElement("div");
        right.className = "side blue";
        right.innerHTML = '<div class="main">' + o.right + "</div>" + (o.rightSub ? '<div class="sub">' + o.rightSub + "</div>" : "");
        row.appendChild(left); row.appendChild(mid); row.appendChild(right);
        board.appendChild(row);
      });
    }
    board.querySelectorAll(".weight").forEach(function (input, i) {
      var o = BH.OUTCOMES[i];
      input.disabled = !editable();
      if (document.activeElement !== input) input.value = m.weights[o.key];
      input.nextElementSibling.className = "coef" + (BH.isLocked(m.coefs[o.key]) ? " hot" : "");
      input.nextElementSibling.textContent = BH.formatCoef(m.coefs[o.key]);
    });
  }
  function schedule(patch) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { BH.saveMarket(own, patch); }, 500);
  }
  function onWeight(key, value) {
    if (!editable()) return;
    var n = value === "" ? 0 : Number(value);
    if (!isFinite(n) || n < 0) n = 0;
    var m = markets[own];
    m.weights[key] = n;
    m.coefs = BH.computeCoefs(m.weights, m.targetProfit);
    renderWeights();
    schedule({ weights: m.weights, targetProfit: m.targetProfit });
  }
  document.getElementById("profit").addEventListener("input", function (e) {
    if (!editable()) return;
    var n = Number(e.target.value);
    document.getElementById("profit-warn").textContent = n > 0 ? "" : "Enter a number above 0";
    if (!(n > 0)) return;
    var m = markets[own];
    m.targetProfit = n;
    m.coefs = BH.computeCoefs(m.weights, n);
    renderWeights();
    schedule({ targetProfit: n, weights: m.weights });
  });
  document.getElementById("regime").addEventListener("click", function () {
    var m = markets[own];
    if (!m || viewId !== own || m.published) return;
    var next = m.status === "bets" ? "weights" : "bets";
    m.status = next;
    BH.saveMarket(own, { status: next });
    renderRegime();
    renderWeights();
  });
  function renderBook() {
    var m = current();
    var score = BH.parseScore(m.masterScore);
    var labels = document.getElementById("head-labels");
    var coefs = document.getElementById("head-coefs");
    var existing = document.getElementById("score");
    var typing = existing && document.activeElement === existing;
    if (!existing) labels.innerHTML = '<th><input id="score" class="score-input" placeholder="4-1" value="' + escapeHtml(m.masterScore || "") + '"></th>';
    else if (!typing && existing.value !== (m.masterScore || "")) existing.value = m.masterScore || "";
    while (labels.children.length > 1) labels.removeChild(labels.lastChild);
    coefs.innerHTML = "<th>Coefficient</th>";
    BH.OUTCOMES.forEach(function (o) {
      var th = document.createElement("th");
      th.textContent = BH.label(o.key);
      labels.appendChild(th);
      coefs.innerHTML += "<th>" + BH.formatCoef(m.coefs[o.key]) + "</th>";
    });
    var netTh = document.createElement("th");
    netTh.id = "sort-net";
    netTh.textContent = "Net " + (sortDir === "desc" ? "↓" : "↑");
    labels.appendChild(netTh);
    coefs.innerHTML += "<th></th>";
    var rows = players.filter(function (p) { return BH.sumBets(p[viewId] || {}) > 0; }).map(function (p) {
      var book = p[viewId] || BH.emptyBets();
      return { player: p, book: book, net: BH.netOutcome(book, m.coefs, score) };
    }).sort(function (a, b) { return sortDir === "desc" ? b.net - a.net : a.net - b.net; });
    document.getElementById("book-body").innerHTML = rows.map(function (r) {
      return "<tr><td>" + escapeHtml(r.player.name || r.player.pin) + "</td>" + BH.OUTCOMES.map(function (o) { return "<td>" + (parseInt(r.book[o.key], 10) || 0) + "</td>"; }).join("") + "<td>" + BH.money(r.net) + "</td></tr>";
    }).join("");
    var totals = BH.emptyBets();
    var netSum = 0;
    rows.forEach(function (r) { netSum += r.net; BH.ALL_KEYS.forEach(function (k) { totals[k] += parseInt(r.book[k], 10) || 0; }); });
    document.getElementById("book-foot").innerHTML = "<td>House</td>" + BH.OUTCOMES.map(function (o) { return "<td>" + totals[o.key] + "</td>"; }).join("") + "<td>" + BH.money(-netSum) + "</td>";
    var scoreInput = document.getElementById("score");
    scoreInput.disabled = viewId !== own || m.published;
    if (!scoreInput.dataset.bound) {
      scoreInput.dataset.bound = "1";
      scoreInput.addEventListener("input", function () {
        if (viewId !== own || markets[own].published) return;
        markets[own].masterScore = scoreInput.value;
        BH.saveMarket(own, { masterScore: scoreInput.value });
      });
    }
    document.getElementById("sort-net").onclick = function () { sortDir = sortDir === "desc" ? "asc" : "desc"; renderBook(); };
    document.getElementById("publish").disabled = viewId !== own || m.published;
    document.getElementById("reset-players").disabled = viewId !== own;
  }
  function paint() {
    renderIdentity();
    renderRegime();
    document.getElementById("weights").classList.toggle("hidden", view !== "weights");
    document.getElementById("book").classList.toggle("hidden", view !== "book");
    document.getElementById("view-weights").classList.toggle("active", view === "weights");
    document.getElementById("view-book").classList.toggle("active", view === "book");
    if (view === "weights") renderWeights(); else renderBook();
  }
  document.getElementById("tab-orange").addEventListener("click", function () { viewId = "orange"; builtFor = ""; paint(); });
  document.getElementById("tab-red").addEventListener("click", function () { viewId = "red"; builtFor = ""; paint(); });
  document.getElementById("view-weights").addEventListener("click", function () { view = "weights"; paint(); });
  document.getElementById("view-book").addEventListener("click", function () { view = "book"; paint(); });
  document.getElementById("publish").addEventListener("click", function () {
    if (viewId !== own || markets[own].published) return;
    if (!window.confirm("Publish " + own + "? The score should already be correct. This cannot be undone without Reset.")) return;
    markets[own].published = true;
    BH.saveMarket(own, { published: true });
    paint();
  });
  document.getElementById("reset-players").addEventListener("click", function () {
    if (viewId !== own) return;
    if (!window.confirm("Reset " + own + "? Players who bet here are removed from both houses, and this house returns to Weights, unpublished.")) return;
    BH.resetPlayers(own).then(function () {
      markets[own].published = false;
      markets[own].status = "weights";
      markets[own].betLocked = false;
      markets[own].betsLocked = false;
      markets[own].weightsLocked = false;
      return BH.saveMarket(own, { published: false, status: "weights", betsLocked: false, weightsLocked: false });
    }).then(function () { paint(); });
  });
  BH.watchMarket("orange", function (m) { markets.orange = m; if (own) paint(); });
  BH.watchMarket("red", function (m) { markets.red = m; if (own) paint(); });
  BH.watchPlayers(function (rows) { players = rows; if (own && view === "book") renderBook(); });
  document.addEventListener("visibilitychange", saveSession);
  var params = new URLSearchParams(location.search);
  var query = location.search.replace(/^\?/, "");
  var direct = query === "172" || query === "pin=172" ? "orange" : query === "413" || query === "pin=413" ? "red" : "";
  if (params.get("lobby") === "1") {
    showLobby();
  } else if (direct) enter(direct);
  else if (session() && session().own) enter(session().own);
})();
