(function () {
  var BH = window.BetHouse;
  var markets = { orange: null, red: null };
  var players = [];
  var designer = { score: "" };
  var sortDir = "desc";
  var scoreTimer = null;
  var view = "table";

  document.getElementById("mode").textContent = BH.mode === "firebase" ? "Firebase" : "Preview";
  if (BH.mode === "firebase") document.getElementById("mode").classList.add("live");

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return "&#" + c.charCodeAt(0) + ";";
    });
  }

  function renderTable() {
    var score = BH.parseScore(designer.score);
    var labels = document.getElementById("head-labels");
    var coefs = document.getElementById("head-coefs");
    var existing = document.getElementById("score");
    var typing = existing && document.activeElement === existing;
    if (!existing) {
      labels.innerHTML = '<th><input id="score" class="score-input" placeholder="4-1" value="' + escapeHtml(designer.score || "") + '"></th>';
    } else if (!typing && existing.value !== (designer.score || "")) {
      existing.value = designer.score || "";
    }
    while (labels.children.length > 1) labels.removeChild(labels.lastChild);
    coefs.innerHTML = "<th>Coefficient</th>";
    ["orange", "red"].forEach(function (id) {
      var m = markets[id] || { coefs: {} };
      BH.OUTCOMES.forEach(function (o) {
        var th = document.createElement("th");
        th.textContent = (id === "orange" ? "Orange " : "Red ") + BH.label(o.key);
        labels.appendChild(th);
        coefs.innerHTML += "<th>" + BH.formatCoef(m.coefs[o.key]) + "</th>";
      });
    });
    var sortTh = document.createElement("th");
    sortTh.className = "sortable";
    sortTh.id = "sort-win";
    sortTh.textContent = "Cumulative " + (sortDir === "desc" ? "↓" : "↑");
    labels.appendChild(sortTh);
    coefs.innerHTML += "<th></th>";

    var rows = players.map(function (p) {
      var orange = p.orange || BH.emptyBets();
      var red = p.red || BH.emptyBets();
      var oNet = BH.netOutcome(orange, (markets.orange || {}).coefs, score);
      var rNet = BH.netOutcome(red, (markets.red || {}).coefs, score);
      var remaining = p.placed ? (Number(p.balanceLeft) || 0) : 100 - BH.sumBets(orange) - BH.sumBets(red);
      return { player: p, orange: orange, red: red, oNet: oNet, rNet: rNet, remaining: remaining, total: remaining + oNet + rNet };
    });
    rows.sort(function (a, b) { return sortDir === "desc" ? b.total - a.total : a.total - b.total; });
    document.getElementById("body").innerHTML = rows.map(function (r) {
      var cells = ["orange", "red"].map(function (id) {
        var book = r[id];
        return BH.OUTCOMES.map(function (o) { return "<td>" + (parseInt(book[o.key], 10) || 0) + "</td>"; }).join("");
      }).join("");
      return "<tr><td>" + escapeHtml(r.player.name) + "</td>" + cells + "<td>" + BH.money(r.total) + "</td></tr>";
    }).join("");

    var totals = { orange: BH.emptyBets(), red: BH.emptyBets() };
    var house = 0;
    rows.forEach(function (r) {
      house += r.oNet + r.rNet;
      ["orange", "red"].forEach(function (id) {
        BH.ALL_KEYS.forEach(function (k) { totals[id][k] += parseInt(r[id][k], 10) || 0; });
      });
    });
    document.getElementById("foot").innerHTML = "<td>Both houses</td>" +
      ["orange", "red"].map(function (id) {
        return BH.OUTCOMES.map(function (o) { return "<td>" + totals[id][o.key] + "</td>"; }).join("");
      }).join("") +
      "<td>" + BH.money(-house) + "</td>";

    var scoreInput = document.getElementById("score");
    if (scoreInput && !scoreInput.dataset.bound) {
      scoreInput.dataset.bound = "1";
      scoreInput.addEventListener("input", function (e) {
        designer.score = e.target.value;
        clearTimeout(scoreTimer);
        scoreTimer = setTimeout(function () {
          BH.saveDesigner({ score: designer.score });
          renderTable();
        }, 400);
      });
    }
    var sortWin = document.getElementById("sort-win");
    if (sortWin) sortWin.addEventListener("click", function () {
      sortDir = sortDir === "desc" ? "asc" : "desc";
      renderTable();
    });
  }

  function drawQr() {
    var url = BH.playerUrl();
    document.getElementById("qr-url").textContent = url;
    var holder = document.getElementById("qr-holder");
    if (typeof qrcode !== "function") {
      holder.innerHTML = '<img alt="Player QR" src="https://api.qrserver.com/v1/create-qr-code/?size=420x420&data=' + encodeURIComponent(url) + '">';
      return;
    }
    var qr = qrcode(0, "M");
    qr.addData(url);
    qr.make();
    holder.innerHTML = qr.createImgTag(8, 12, "Player QR");
  }

  function paint() {
    document.getElementById("table-view").classList.toggle("hidden", view !== "table");
    document.getElementById("qr-view").classList.toggle("hidden", view !== "qr");
    document.getElementById("view-table").classList.toggle("active", view === "table");
    document.getElementById("view-qr").classList.toggle("active", view === "qr");
    if (view === "table") renderTable();
    else drawQr();
  }

  document.getElementById("view-table").addEventListener("click", function () { view = "table"; paint(); });
  document.getElementById("view-qr").addEventListener("click", function () { view = "qr"; paint(); });
  document.getElementById("reset-players").addEventListener("click", function () {
    if (!players.length) { window.alert("No participants to reset."); return; }
    if (!window.confirm("Remove all " + players.length + " participants? Each name is deleted from both houses, so the same name can register again. Scores and weights stay.")) return;
    BH.resetPlayers("all").then(function (count) {
      window.alert("Removed " + count + " name" + (count === 1 ? "" : "s") + " from both houses.");
    }).catch(function () { window.alert("Could not erase those bets."); });
  });

  BH.watchMarket("orange", function (m) { markets.orange = m; if (view === "table") renderTable(); });
  BH.watchMarket("red", function (m) { markets.red = m; if (view === "table") renderTable(); });
  BH.watchPlayers(function (rows) { players = rows; if (view === "table") renderTable(); });
  BH.watchDesigner(function (state) {
    if (document.activeElement && document.activeElement.id === "score") return;
    designer = state || { score: "" };
    if (view === "table") renderTable();
  });
  paint();
})();
