(function () {
  var BH = window.BetHouse;
  var KEY = "bethouse-designer";
  var markets = { orange: null, red: null };
  var players = [];
  var designer = { score: "" };
  var sortKey = "total";
  var sortDir = "desc";
  var view = "table";
  var authed = false;

  function saveSession() { try { sessionStorage.setItem(KEY, "1"); } catch (e) {} }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }
  function enter() {
    authed = true;
    saveSession();
    document.getElementById("lobby").classList.add("hidden");
    document.getElementById("desk").classList.remove("hidden");
    document.getElementById("to-lobby").classList.remove("hidden");
    paint();
  }
  document.getElementById("pin").addEventListener("input", function (e) {
    if (e.target.value === window.DESIGNER_PIN) enter();
    else if (e.target.value.length >= 4) document.getElementById("lobby-note").textContent = "Wrong pin.";
  });
  document.getElementById("to-lobby").addEventListener("click", function () { sessionStorage.removeItem(KEY); location.replace("designer.html"); });

  function renderTable() {
    var score = BH.parseScore(designer.score);
    var houses = document.getElementById("head-house");
    var labels = document.getElementById("head-labels");
    var coefs = document.getElementById("head-coefs");
    var old = document.getElementById("score");
    var scoreValue = old && document.activeElement === old ? old.value : (designer.score || "");
    houses.innerHTML = "<th></th>";
    labels.innerHTML = '<th><input id="score" class="score-input" placeholder="4-1" value="' + escapeHtml(scoreValue) + '"></th>';
    coefs.innerHTML = "<th>Coefficient</th>";
    ["orange", "red"].forEach(function (id) {
      var cls = id === "orange" ? "house-orange" : "house-red";
      var top = document.createElement("th");
      top.colSpan = 9;
      top.className = cls;
      top.textContent = id === "orange" ? "Orange" : "Red";
      houses.appendChild(top);
      var m = markets[id] || { coefs: {} };
      BH.OUTCOMES.forEach(function (o) {
        var th = document.createElement("th");
        th.className = cls;
        th.textContent = BH.label(o.key);
        labels.appendChild(th);
        coefs.innerHTML += '<th class="' + cls + '">' + BH.formatCoef(m.coefs[o.key]) + "</th>";
      });
      var net = document.createElement("th");
      net.className = cls + " sortable";
      net.id = "sort-" + id;
      net.textContent = "Net " + (sortKey === id && sortDir === "desc" ? "↓" : sortKey === id ? "↑" : "");
      labels.appendChild(net);
      coefs.innerHTML += '<th class="' + cls + '"></th>';
    });
    labels.innerHTML += "<th>Unused funds</th><th id='sort-total'>Net total " + (sortKey === "total" ? (sortDir === "desc" ? "↓" : "↑") : "") + "</th>";
    coefs.innerHTML += "<th></th><th></th>";
    houses.innerHTML += "<th></th><th></th>";
    var rows = players.map(function (p) {
      var orange = p.orange || BH.emptyBets();
      var red = p.red || BH.emptyBets();
      var oNet = BH.netOutcome(orange, (markets.orange || {}).coefs, score);
      var rNet = BH.netOutcome(red, (markets.red || {}).coefs, score);
      var unused = p.placed ? (Number(p.balanceLeft) || 0) : 100 - BH.sumBets(orange) - BH.sumBets(red);
      return { player: p, orange: orange, red: red, oNet: oNet, rNet: rNet, unused: unused, total: unused + oNet + rNet };
    });
    rows.sort(function (a, b) {
      var av = sortKey === "orange" ? a.oNet : sortKey === "red" ? a.rNet : a.total;
      var bv = sortKey === "orange" ? b.oNet : sortKey === "red" ? b.rNet : b.total;
      return sortDir === "desc" ? bv - av : av - bv;
    });
    document.getElementById("body").innerHTML = rows.map(function (r) {
      function cells(id, book) {
        var cls = id === "orange" ? "house-orange" : "house-red";
        return BH.OUTCOMES.map(function (o) { return '<td class="' + cls + '">' + (parseInt(book[o.key], 10) || 0) + "</td>"; }).join("") + '<td class="' + cls + '">' + BH.money(id === "orange" ? r.oNet : r.rNet) + "</td>";
      }
      return "<tr><td>" + escapeHtml(r.player.name || r.player.pin) + "</td>" + cells("orange", r.orange) + cells("red", r.red) + "<td>" + r.unused + "</td><td>" + BH.money(r.total) + "</td></tr>";
    }).join("");
    var houseNets = 0;
    var totals = { orange: BH.emptyBets(), red: BH.emptyBets() };
    rows.forEach(function (r) {
      houseNets += r.oNet + r.rNet;
      ["orange", "red"].forEach(function (id) { BH.ALL_KEYS.forEach(function (k) { totals[id][k] += parseInt(r[id][k], 10) || 0; }); });
    });
    document.getElementById("foot").innerHTML = "<td>Both houses</td>" + ["orange", "red"].map(function (id) {
      var cls = id === "orange" ? "house-orange" : "house-red";
      return BH.OUTCOMES.map(function (o) { return '<td class="' + cls + '">' + totals[id][o.key] + "</td>"; }).join("") + '<td class="' + cls + '">' + BH.money(id === "orange" ? -rows.reduce(function (s, r) { return s + r.oNet; }, 0) : -rows.reduce(function (s, r) { return s + r.rNet; }, 0)) + "</td>";
    }).join("") + "<td></td><td>" + BH.money(-houseNets) + "</td>";
    var scoreInput = document.getElementById("score");
    scoreInput.addEventListener("input", function (e) {
      designer.score = e.target.value;
      BH.saveDesigner({ score: designer.score });
    });
    ["orange", "red", "total"].forEach(function (key) {
      var el = document.getElementById(key === "total" ? "sort-total" : "sort-" + key);
      if (el) el.onclick = function () {
        if (sortKey === key) sortDir = sortDir === "desc" ? "asc" : "desc";
        else { sortKey = key; sortDir = "desc"; }
        renderTable();
      };
    });
  }
  function drawQr() {
    var url = BH.playerUrl();
    document.getElementById("qr-url").textContent = url;
    var holder = document.getElementById("qr-holder");
    if (typeof qrcode !== "function") return;
    var qr = qrcode(0, "M");
    qr.addData(url);
    qr.make();
    holder.innerHTML = qr.createImgTag(8, 12, "Player QR");
  }
  function paint() {
    if (!authed) return;
    document.getElementById("table-view").classList.toggle("hidden", view !== "table");
    document.getElementById("qr-view").classList.toggle("hidden", view !== "qr");
    document.getElementById("view-table").classList.toggle("active", view === "table");
    document.getElementById("view-qr").classList.toggle("active", view === "qr");
    if (view === "table") renderTable(); else drawQr();
  }
  document.getElementById("view-table").addEventListener("click", function () { view = "table"; paint(); });
  document.getElementById("view-qr").addEventListener("click", function () { view = "qr"; paint(); });
  document.getElementById("bet-regime").addEventListener("click", function () {
    if (!window.confirm("Lock both houses into Bets? Masters will not be able to return to Weights.")) return;
    BH.saveMarket("orange", { status: "bets", betLocked: true });
    BH.saveMarket("red", { status: "bets", betLocked: true });
  });
  document.getElementById("publish").addEventListener("click", function () {
    if (!BH.parseScore(designer.score)) { window.alert("Enter a valid score before publishing."); return; }
    if (!window.confirm("Publish both houses with score " + designer.score + "? This replaces the master scores.")) return;
    BH.saveMarket("orange", { published: true, masterScore: designer.score });
    BH.saveMarket("red", { published: true, masterScore: designer.score });
  });
  document.getElementById("unpublish").addEventListener("click", function () {
    BH.saveMarket("orange", { published: false });
    BH.saveMarket("red", { published: false });
  });
  document.getElementById("reset-players").addEventListener("click", function () {
    if (!window.confirm("Reset both houses? All names and bets are erased, and both houses return to Weights, unpublished.")) return;
    BH.resetPlayers("all").then(function () {
      return BH.saveMarket("orange", { published: false, status: "weights", betLocked: false });
    }).then(function () {
      return BH.saveMarket("red", { published: false, status: "weights", betLocked: false });
    });
  });
  BH.watchMarket("orange", function (m) { markets.orange = m; if (view === "table") renderTable(); });
  BH.watchMarket("red", function (m) { markets.red = m; if (view === "table") renderTable(); });
  BH.watchPlayers(function (rows) { players = rows; if (view === "table") renderTable(); });
  BH.watchDesigner(function (state) {
    if (document.activeElement && document.activeElement.id === "score") return;
    designer = state || { score: "" };
    if (authed && view === "table") renderTable();
  });
  document.addEventListener("visibilitychange", function () { if (authed) saveSession(); });
  if (new URLSearchParams(location.search).get("pin") === window.DESIGNER_PIN || sessionStorage.getItem(KEY) === "1") enter();
})();
