(function () {
  var BH = window.BetHouse;
  var markets = { orange: null, red: null };
  var saved = { orange: BH.emptyBets(), red: BH.emptyBets() };
  var bets = { orange: BH.emptyBets(), red: BH.emptyBets() };
  var active = Math.random() < 0.5 ? "orange" : "red";
  var pin = "";
  var name = "";
  var phase = "gate";
  var params = new URLSearchParams(location.search);

  document.getElementById("mode").textContent = BH.mode === "firebase" ? "Firebase" : "Preview";
  if (BH.mode === "firebase") document.getElementById("mode").classList.add("live");
  if (params.get("pin")) document.getElementById("pin").value = params.get("pin");
  if (params.get("name")) document.getElementById("name").value = params.get("name");

  function showToast(text) {
    var toast = document.getElementById("toast");
    toast.textContent = text;
    toast.classList.remove("hidden");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () { toast.classList.add("hidden"); }, 2400);
  }
  function total() { return BH.sumBets(bets.orange) + BH.sumBets(bets.red); }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; });
  }
  function bothPublished() {
    return !!(markets.orange && markets.red && markets.orange.published && markets.red.published);
  }
  function leaveBetIfPublished() {
    if (phase === "bet" && bothPublished()) showResult();
  }
  function showPhase(next) {
    phase = next;
    document.getElementById("gate").classList.toggle("hidden", phase !== "gate");
    document.getElementById("bet").classList.toggle("hidden", phase !== "bet");
    document.getElementById("result").classList.toggle("hidden", phase !== "result");
  }
  function renderIdentity() {
    var icon = active === "orange" ? "icons/orange.png" : "icons/red.png";
    var identity = document.getElementById("identity");
    identity.className = "identity " + active;
    identity.innerHTML = active === "orange"
      ? '<img alt="Orange" src="' + icon + '"><div class="who">' + escapeHtml(name) + "</div>"
      : '<div class="who">' + escapeHtml(name) + '</div><img alt="Red" src="' + icon + '">';
    document.getElementById("tab-orange").className = active === "orange" ? "active-orange" : "";
    document.getElementById("tab-red").className = active === "red" ? "active-red" : "";
  }
  function accepting(id) {
    var m = markets[id];
    return !!(m && m.status === "bets" && !m.published);
  }
  function renderBoard() {
    if (bothPublished()) { showResult(); return; }
    var market = markets[active] || { coefs: {}, status: "weights" };
    var open = accepting(active);
    document.getElementById("regime").textContent = open ? "Bets are open on this house." : "This house is not taking bets.";
    var board = document.getElementById("board");
    var inputs = board.querySelectorAll(".amount");
    if (board.getAttribute("data-market") !== active || inputs.length !== BH.OUTCOMES.length) {
      board.innerHTML = "";
      board.setAttribute("data-market", active);
      BH.OUTCOMES.forEach(function (o) {
        var row = document.createElement("div");
        row.className = "rowline";
        var left = document.createElement("div");
        left.className = "side green";
        left.innerHTML = '<div class="main">' + o.left + "</div>" + (o.leftSub ? '<div class="sub">' + o.leftSub + "</div>" : "");
        var mid = document.createElement("div");
        mid.className = "mid";
        var input = document.createElement("input");
        input.className = "amount";
        input.inputMode = "numeric";
        input.addEventListener("input", function () { onAmount(o.key, input); });
        var coefEl = document.createElement("div");
        coefEl.className = "coef";
        mid.appendChild(input);
        mid.appendChild(coefEl);
        var right = document.createElement("div");
        right.className = "side blue";
        right.innerHTML = '<div class="main">' + o.right + "</div>" + (o.rightSub ? '<div class="sub">' + o.rightSub + "</div>" : "");
        row.appendChild(left); row.appendChild(mid); row.appendChild(right);
        board.appendChild(row);
      });
      inputs = board.querySelectorAll(".amount");
    }
    BH.OUTCOMES.forEach(function (o, i) {
      var coef = market.coefs ? market.coefs[o.key] : null;
      var locked = BH.isLocked(coef) || !open;
      var input = inputs[i];
      input.closest(".rowline").classList.toggle("locked", locked);
      input.disabled = locked;
      if (document.activeElement !== input) input.value = bets[active][o.key] || 0;
      input.nextElementSibling.textContent = BH.formatCoef(coef);
    });
    document.getElementById("available").textContent = String(100 - total());
    renderIdentity();
  }
  function onAmount(key, input) {
    var raw = String(input.value).trim();
    var floor = parseInt(saved[active][key], 10) || 0;
    var previous = bets[active][key] || 0;
    if (raw !== "" && !/^\d+$/.test(raw)) { input.value = previous; showToast("Whole MP only"); return; }
    var next = raw === "" ? 0 : Number(raw);
    if (next < floor) { input.value = floor; bets[active][key] = floor; showToast("A placed bet cannot be cancelled"); document.getElementById("available").textContent = String(100 - total()); return; }
    bets[active][key] = next;
    if (total() > 100) { bets[active][key] = previous; input.value = previous; input.classList.add("bad"); showToast("That exceeds 100 MP"); }
    else input.classList.remove("bad");
    document.getElementById("available").textContent = String(100 - total());
  }
  function lines(book, coefs, score) {
    return BH.ALL_KEYS.map(function (k) {
      var stake = parseInt(book[k], 10) || 0;
      if (!stake) return "";
      var paid = score && BH.winningKeys(score).indexOf(k) !== -1;
      var got = paid ? stake * (Number(coefs && coefs[k]) || 0) : 0;
      return "<li><span>" + BH.label(k) + "</span><b>" + stake + (paid ? " → " + BH.money(got) : "") + "</b></li>";
    }).join("") || "<li><span>No stake</span><b>0</b></li>";
  }
  function showResult() {
    var oScore = BH.parseScore(markets.orange && markets.orange.masterScore);
    var rScore = BH.parseScore(markets.red && markets.red.masterScore);
    var oNet = BH.netOutcome(saved.orange, markets.orange.coefs, oScore);
    var rNet = BH.netOutcome(saved.red, markets.red.coefs, rScore);
    var unused = 100 - BH.sumBets(saved.orange) - BH.sumBets(saved.red);
    document.getElementById("result-lead").textContent = name;
    document.getElementById("result-body").innerHTML =
      "<p>Unused " + unused + " MP</p>" +
      '<p><span class="tag orange">Orange</span> net ' + BH.money(oNet) + "</p><ul>" + lines(saved.orange, markets.orange.coefs, oScore) + "</ul>" +
      '<p><span class="tag red">Red</span> net ' + BH.money(rNet) + "</p><ul>" + lines(saved.red, markets.red.coefs, rScore) + "</ul>" +
      "<p>Final net " + BH.money(unused + oNet + rNet) + " MP</p>";
    showPhase("result");
  }
  function applyRecord(record) {
    saved.orange = Object.assign(BH.emptyBets(), record && record.orange);
    saved.red = Object.assign(BH.emptyBets(), record && record.red);
    bets.orange = Object.assign(BH.emptyBets(), saved.orange);
    bets.red = Object.assign(BH.emptyBets(), saved.red);
    if (record && record.name) name = record.name;
  }
  function commit() {
    BH.savePlayer(pin, {
      name: name,
      placed: true,
      balanceLeft: 100 - total(),
      orange: bets.orange,
      red: bets.red
    }).then(function () {
      saved.orange = Object.assign(BH.emptyBets(), bets.orange);
      saved.red = Object.assign(BH.emptyBets(), bets.red);
      showToast("Bet stored");
      if (bothPublished()) showResult();
    }).catch(function () { showToast("Could not store the bet"); });
  }
  document.getElementById("proceed").addEventListener("click", function () {
    var note = document.getElementById("gate-note");
    note.textContent = "";
    BH.enterWithPin(document.getElementById("pin").value, document.getElementById("name").value).then(function (entered) {
      pin = entered.pin;
      name = entered.name;
      document.getElementById("name").value = name;
      BH.watchPlayer(pin, function (record) {
        if (!record) return;
        if (document.activeElement && document.activeElement.classList.contains("amount")) return;
        applyRecord(record);
        if (phase === "bet") renderBoard();
        if (phase === "result") showResult();
      });
      showPhase("bet");
      renderBoard();
    }).catch(function (err) {
      note.textContent = err && err.code === "bad-pin" ? "That pin is not valid." : "Could not enter. Try again.";
    });
  });
  document.getElementById("tab-orange").addEventListener("click", function () { active = "orange"; renderBoard(); });
  document.getElementById("tab-red").addEventListener("click", function () { active = "red"; renderBoard(); });
  document.getElementById("place").addEventListener("click", function () {
    if (!accepting("orange") && BH.sumBets(bets.orange) !== BH.sumBets(saved.orange)) return;
    if (total() > 100) { showToast("That exceeds 100 MP"); return; }
    var left = 100 - total();
    if (left > 0) {
      document.getElementById("modal-text").textContent = "Are you sure? You still have " + left + " MP on your account.";
      document.getElementById("modal").classList.remove("hidden");
      return;
    }
    commit();
  });
  document.getElementById("bet-more").addEventListener("click", function () { document.getElementById("modal").classList.add("hidden"); });
  document.getElementById("confirm-yes").addEventListener("click", function () { document.getElementById("modal").classList.add("hidden"); commit(); });
  document.getElementById("bet-again").addEventListener("click", function () {
    document.getElementById("pin").value = String(pin).indexOf("12345-") === 0 ? "12345" : pin;
    document.getElementById("name").value = name.replace(/\(test \d+\)$/, "");
    showPhase("gate");
  });
  BH.watchMarket("orange", function (m) { markets.orange = m; leaveBetIfPublished(); if (phase === "bet") renderBoard(); if (phase === "result") showResult(); });
  BH.watchMarket("red", function (m) { markets.red = m; leaveBetIfPublished(); if (phase === "bet") renderBoard(); if (phase === "result") showResult(); });
  if (params.get("pin") && params.get("name")) document.getElementById("proceed").click();
})();
