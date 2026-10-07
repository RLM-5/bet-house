(function () {
  var BH = window.BetHouse;
  var marketId = "orange";
  var view = "weights";
  var markets = { orange: null, red: null };
  var players = [];
  var sortDir = "desc";
  var saveTimer = null;
  var scoreTimer = null;

  document.getElementById("mode").textContent = BH.mode === "firebase" ? "Firebase" : "Preview";
  if (BH.mode === "firebase") document.getElementById("mode").classList.add("live");

  function current() { return markets[marketId] || { targetProfit: 5, weights: BH.emptyBets(), coefs: {}, masterScore: "" }; }

  function renderIdentity() {
    var el = document.getElementById("identity");
    var icon = marketId === "orange" ? "icons/orange.png" : "icons/red.png";
    el.className = "identity " + marketId;
    var label = marketId === "orange" ? "Orange" : "Red";
    if (marketId === "orange") el.innerHTML = '<img alt="" src="' + icon + '"><div class="who">' + label + "</div>";
    else el.innerHTML = '<div class="who">' + label + '</div><img alt="" src="' + icon + '">';
    document.getElementById("tab-orange").className = marketId === "orange" ? "active-orange" : "";
    document.getElementById("tab-red").className = marketId === "red" ? "active-red" : "";
  }

  var builtFor = "";
  function renderWeights() {
    var m = current();
    var profit = document.getElementById("profit");
    if (document.activeElement !== profit) profit.value = m.targetProfit;
    var board = document.getElementById("board");
    if (builtFor !== marketId) {
      board.innerHTML = "";
      builtFor = marketId;
      BH.OUTCOMES.forEach(function (o) {
        var row = document.createElement("div");
        row.className = "rowline";
        var left = document.createElement("div");
        left.className = "side green";
        left.innerHTML = '<div class="main">' + o.left + '</div>' + (o.leftSub ? '<div class="sub">' + o.leftSub + "</div>" : "");
        var mid = document.createElement("div");
        mid.className = "mid";
        var input = document.createElement("input");
        input.className = "weight";
        input.inputMode = "decimal";
        input.addEventListener("input", function () { onWeight(o.key, input.value); });
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
    }
    var inputs = board.querySelectorAll(".weight");
    BH.OUTCOMES.forEach(function (o, i) {
      var coef = m.coefs ? m.coefs[o.key] : 0;
      if (document.activeElement !== inputs[i]) inputs[i].value = m.weights[o.key];
      var coefEl = inputs[i].nextElementSibling;
      coefEl.className = "coef" + (BH.isLocked(coef) ? " hot" : "");
      coefEl.textContent = BH.formatCoef(coef);
    });
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      var m = current();
      BH.saveMarket(marketId, {
        targetProfit: Number(m.targetProfit),
        weights: m.weights,
        masterScore: m.masterScore || ""
      });
    }, 500);
  }

  function onWeight(key, value) {
    var n = value === "" ? 0 : Number(value);
    if (!isFinite(n) || n < 0) n = 0;
    var m = current();
    m.weights[key] = n;
    m.coefs = BH.computeCoefs(m.weights, m.targetProfit);
    markets[marketId] = m;
    var inputs = document.querySelectorAll("#board .weight");
    BH.OUTCOMES.forEach(function (o, i) {
      var coefEl = inputs[i].nextElementSibling;
      coefEl.className = "coef" + (BH.isLocked(m.coefs[o.key]) ? " hot" : "");
      coefEl.textContent = BH.formatCoef(m.coefs[o.key]);
    });
    scheduleSave();
  }

  document.getElementById("profit").addEventListener("input", function (e) {
    var warn = document.getElementById("profit-warn");
    var n = Number(e.target.value);
    if (!(n > 0)) {
      warn.textContent = "Enter a number above 0";
      return;
    }
    warn.textContent = "";
    var m = current();
    m.targetProfit = n;
    m.coefs = BH.computeCoefs(m.weights, n);
    markets[marketId] = m;
    var inputs = document.querySelectorAll("#board .weight");
    BH.OUTCOMES.forEach(function (o, i) {
      if (!inputs[i]) return;
      var coefEl = inputs[i].nextElementSibling;
      coefEl.className = "coef" + (BH.isLocked(m.coefs[o.key]) ? " hot" : "");
      coefEl.textContent = BH.formatCoef(m.coefs[o.key]);
    });
    scheduleSave();
  });

  function renderBook() {
    var m = current();
    var score = BH.parseScore(m.masterScore);
    var labels = document.getElementById("head-labels");
    var coefs = document.getElementById("head-coefs");
    var existing = document.getElementById("score");
    var typing = existing && document.activeElement === existing;
    if (!existing) {
      labels.innerHTML = '<th><input id="score" class="score-input" placeholder="4-1" value="' + escapeHtml(m.masterScore || "") + '"></th>';
    } else if (!typing && existing.value !== (m.masterScore || "")) {
      existing.value = m.masterScore || "";
    }
    while (labels.children.length > 1) labels.removeChild(labels.lastChild);
    coefs.innerHTML = "<th>Coefficient</th>";
    BH.OUTCOMES.forEach(function (o) {
      var th = document.createElement("th");
      th.textContent = BH.label(o.key);
      labels.appendChild(th);
      coefs.innerHTML += '<th class="' + (BH.isLocked(m.coefs[o.key]) ? "hot" : "") + '">' + BH.formatCoef(m.coefs[o.key]) + "</th>";
    });
    var netTh = document.createElement("th");
    netTh.className = "sortable";
    netTh.id = "sort-net";
    netTh.textContent = "Net " + (sortDir === "desc" ? "↓" : "↑");
    labels.appendChild(netTh);
    coefs.innerHTML += "<th></th>";

    var rows = players.map(function (p) {
      var book = p[marketId] || BH.emptyBets();
      return { player: p, book: book, net: BH.netOutcome(book, m.coefs, score) };
    });
    rows.sort(function (a, b) { return sortDir === "desc" ? b.net - a.net : a.net - b.net; });
    var body = document.getElementById("book-body");
    body.innerHTML = rows.map(function (r) {
      var cells = BH.OUTCOMES.map(function (o) { return "<td>" + (parseInt(r.book[o.key], 10) || 0) + "</td>"; }).join("");
      return "<tr><td>" + escapeHtml(r.player.name) + "</td>" + cells + "<td>" + BH.money(r.net) + "</td></tr>";
    }).join("");
    var totals = BH.emptyBets();
    var netSum = 0;
    rows.forEach(function (r) {
      netSum += r.net;
      BH.ALL_KEYS.forEach(function (k) { totals[k] += parseInt(r.book[k], 10) || 0; });
    });
    document.getElementById("book-foot").innerHTML = "<td>House</td>" +
      BH.OUTCOMES.map(function (o) { return "<td>" + totals[o.key] + "</td>"; }).join("") +
      "<td>" + BH.money(-netSum) + "</td>";
    var scoreInput = document.getElementById("score");
    if (!scoreInput.dataset.bound) {
      scoreInput.dataset.bound = "1";
      scoreInput.addEventListener("input", function () {
        var mkt = current();
        mkt.masterScore = scoreInput.value;
        markets[marketId] = mkt;
        clearTimeout(scoreTimer);
        scoreTimer = setTimeout(function () {
          BH.saveMarket(marketId, { masterScore: scoreInput.value });
          renderBook();
        }, 400);
      });
    }
    document.getElementById("sort-net").addEventListener("click", function () {
      sortDir = sortDir === "desc" ? "asc" : "desc";
      renderBook();
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return "&#" + c.charCodeAt(0) + ";";
    });
  }

  function paint() {
    renderIdentity();
    document.getElementById("weights").classList.toggle("hidden", view !== "weights");
    document.getElementById("book").classList.toggle("hidden", view !== "book");
    document.getElementById("view-weights").classList.toggle("active", view === "weights");
    document.getElementById("view-book").classList.toggle("active", view === "book");
    if (view === "weights") renderWeights();
    else renderBook();
  }

  document.getElementById("tab-orange").addEventListener("click", function () { marketId = "orange"; paint(); });
  document.getElementById("tab-red").addEventListener("click", function () { marketId = "red"; paint(); });
  document.getElementById("view-weights").addEventListener("click", function () { view = "weights"; paint(); });
  document.getElementById("view-book").addEventListener("click", function () { view = "book"; paint(); });

  BH.watchMarket("orange", function (m) { markets.orange = m; paint(); });
  BH.watchMarket("red", function (m) { markets.red = m; paint(); });
  BH.watchPlayers(function (rows) { players = rows; if (view === "book") renderBook(); });
  document.getElementById("reset-players").addEventListener("click", function () {
    var house = marketId === "orange" ? "Orange" : "Red";
    var n = players.filter(function (p) { return BH.sumBets(p[marketId] || {}) > 0; }).length;
    if (!n) { window.alert("No " + house + " bets to erase."); return; }
    if (!window.confirm("Remove " + n + " " + house + " participant" + (n === 1 ? "" : "s") + "? Their name is deleted from both houses, so the same name can register again. Weights and the score stay.")) return;
    BH.resetPlayers(marketId).then(function (count) {
      window.alert("Removed " + count + " name" + (count === 1 ? "" : "s") + " from both houses.");
    }).catch(function () { window.alert("Could not erase those bets."); });
  });
  paint();
})();
