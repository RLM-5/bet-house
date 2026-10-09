(function () {
  var OUTCOMES = [
    { key: "greenWin", kind: "win", left: "Green", leftSub: "wins", right: "x", rightSub: "" },
    { key: "blueWin", kind: "win", left: "x", leftSub: "", right: "Blue", rightSub: "wins" },
    { key: "s50", kind: "score", left: "5", leftSub: "", right: "0", rightSub: "", pair: [5, 0] },
    { key: "s41", kind: "score", left: "4", leftSub: "", right: "1", rightSub: "", pair: [4, 1] },
    { key: "s32", kind: "score", left: "3", leftSub: "", right: "2", rightSub: "", pair: [3, 2] },
    { key: "s23", kind: "score", left: "2", leftSub: "", right: "3", rightSub: "", pair: [2, 3] },
    { key: "s14", kind: "score", left: "1", leftSub: "", right: "4", rightSub: "", pair: [1, 4] },
    { key: "s05", kind: "score", left: "0", leftSub: "", right: "5", rightSub: "", pair: [0, 5] }
  ];
  var WIN_KEYS = ["greenWin", "blueWin"];
  var SCORE_KEYS = ["s50", "s41", "s32", "s23", "s14", "s05"];
  var ALL_KEYS = WIN_KEYS.concat(SCORE_KEYS);

  function emptyBets() {
    var o = {};
    ALL_KEYS.forEach(function (k) { o[k] = 0; });
    return o;
  }

  function emptyWeights() {
    var o = {};
    ALL_KEYS.forEach(function (k) { o[k] = 1; });
    return o;
  }

  function defaultMarket() {
    return {
      targetProfit: 5,
      weights: emptyWeights(),
      masterScore: "",
      status: "weights",
      published: false,
      betsLocked: false,
      weightsLocked: false,
      coefs: {}
    };
  }

  function formatCoef(n) {
    if (n == null || !isFinite(n) || n <= 0) return "—";
    var rounded = Number(Number(n).toPrecision(4));
    if (!isFinite(rounded)) return "—";
    if (rounded >= 1000) return rounded.toFixed(0);
    if (rounded >= 100) return rounded.toFixed(1);
    if (rounded >= 10) return rounded.toFixed(2);
    return rounded.toFixed(3);
  }

  function displayedCoef(n) {
    var text = formatCoef(n);
    if (text === "—") return null;
    return Number(text);
  }

  function isLocked(n) {
    var shown = displayedCoef(n);
    return shown == null || shown <= 1;
  }

  function computeCoefs(weights, targetProfit) {
    var margin = Number(targetProfit) / 100;
    var coefs = {};
    function fill(keys) {
      var sum = 0;
      keys.forEach(function (k) { sum += Number(weights[k]) || 0; });
      keys.forEach(function (k) {
        if (!(margin > 0) || sum <= 0) {
          coefs[k] = 0;
          return;
        }
        var prob = (Number(weights[k]) || 0) / sum;
        coefs[k] = 1 / (prob + margin);
      });
    }
    fill(WIN_KEYS);
    fill(SCORE_KEYS);
    return coefs;
  }

  function parseScore(text) {
    if (!text) return null;
    var m = String(text).trim().match(/^([0-5])\s*[-:]\s*([0-5])$/);
    if (!m) return null;
    var g = Number(m[1]);
    var b = Number(m[2]);
    var key = "s" + g + b;
    if (SCORE_KEYS.indexOf(key) === -1) return null;
    return { green: g, blue: b, key: key, text: g + "-" + b };
  }

  function winningKeys(score) {
    if (!score) return [];
    var keys = [score.key];
    if (score.green > score.blue) keys.push("greenWin");
    if (score.blue > score.green) keys.push("blueWin");
    return keys;
  }

  function sumBets(bets) {
    return ALL_KEYS.reduce(function (s, k) {
      return s + (parseInt(bets && bets[k], 10) || 0);
    }, 0);
  }

  function netOutcome(bets, coefs, score) {
    var stake = sumBets(bets);
    var received = 0;
    if (score) {
      winningKeys(score).forEach(function (k) {
        var bet = parseInt(bets && bets[k], 10) || 0;
        var coef = Number(coefs && coefs[k]) || 0;
        received += bet * coef;
      });
    }
    return -stake + received;
  }

  function money(n) {
    if (!isFinite(n)) return "—";
    var rounded = Math.round(n * 100) / 100;
    return (rounded >= 0 ? "" : "−") + Math.abs(rounded).toLocaleString("en-US", {
      minimumFractionDigits: rounded % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2
    });
  }

  function label(key) {
    if (key === "greenWin") return "Green wins";
    if (key === "blueWin") return "Blue wins";
    var found = OUTCOMES.filter(function (o) { return o.key === key; })[0];
    return found ? found.left + "–" + found.right : key;
  }

  var configured = false;
  try {
    configured = !!(window.FIREBASE_CONFIG &&
      window.FIREBASE_CONFIG.apiKey &&
      window.FIREBASE_CONFIG.projectId &&
      String(window.FIREBASE_CONFIG.apiKey).indexOf("YOUR_") !== 0 &&
      String(window.FIREBASE_CONFIG.projectId).indexOf("YOUR_") !== 0);
  } catch (e) {
    configured = false;
  }

  var db = null;
  var mode = "preview";
  if (configured && window.firebase) {
    try {
      if (!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
      db = firebase.firestore();
      mode = "firebase";
    } catch (err) {
      console.warn("Firebase init failed", err);
      db = null;
      mode = "preview";
    }
  }

  var preview = loadPreview();
  var listeners = { markets: {}, players: [], designer: [] };

  function loadPreview() {
    try {
      var raw = localStorage.getItem("bethouse-preview");
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { players: {}, markets: { orange: defaultMarket(), red: defaultMarket() }, designer: { score: "" } };
  }

  function savePreview() {
    try { localStorage.setItem("bethouse-preview", JSON.stringify(preview)); } catch (e) {}
    emitPreview();
  }

  function emitPreview() {
    Object.keys(listeners.markets).forEach(function (id) {
      listeners.markets[id].forEach(function (fn) { fn(marketView(id, preview.markets[id])); });
    });
    listeners.players.forEach(function (fn) { fn(playerList()); });
    listeners.designer.forEach(function (fn) { fn(preview.designer || { score: "" }); });
  }

  function marketView(id, data) {
    var base = defaultMarket();
    var src = data || {};
    var weights = Object.assign(emptyWeights(), src.weights || {});
    var targetProfit = src.targetProfit == null ? 5 : Number(src.targetProfit);
    var coefs = computeCoefs(weights, targetProfit);
    return {
      id: id,
      targetProfit: targetProfit,
      weights: weights,
      coefs: coefs,
      masterScore: src.masterScore || "",
      status: src.status === "bets" ? "bets" : "weights",
      published: !!src.published,
      betsLocked: !!src.betsLocked,
      weightsLocked: !!src.weightsLocked
    };
  }

  function playerList() {
    return Object.keys(preview.players).map(function (name) {
      return Object.assign({ name: name }, preview.players[name]);
    });
  }

  function watchMarket(id, cb) {
    if (mode === "firebase") {
      return db.collection("markets").doc(id).onSnapshot(function (snap) {
        cb(marketView(id, snap.exists ? snap.data() : null));
      }, function () { cb(marketView(id, null)); });
    }
    listeners.markets[id] = listeners.markets[id] || [];
    listeners.markets[id].push(cb);
    cb(marketView(id, preview.markets[id]));
    return function () {};
  }

  function saveMarket(id, patch) {
    if (mode === "firebase") {
      var payload = Object.assign({}, patch, { updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
      return db.collection("markets").doc(id).set(payload, { merge: true });
    }
    preview.markets[id] = Object.assign(defaultMarket(), preview.markets[id] || {}, patch);
    savePreview();
    return Promise.resolve();
  }

  function watchPlayers(cb) {
    if (mode === "firebase") {
      return db.collection("players").onSnapshot(function (snap) {
        var rows = [];
        snap.forEach(function (doc) { rows.push(Object.assign({ name: doc.id }, doc.data())); });
        cb(rows);
      }, function () { cb([]); });
    }
    listeners.players.push(cb);
    cb(playerList());
    return function () {};
  }

  function nameKey(name) {
    return String(name || "").trim().toLowerCase();
  }

  function claimName(name) {
    var clean = String(name || "").trim();
    if (!clean) return Promise.reject(new Error("empty"));
    var key = nameKey(clean);
    if (mode === "firebase") {
      var ref = db.collection("players").doc(clean);
      var keyRef = db.collection("nameKeys").doc(key);
      return db.runTransaction(function (tx) {
        return Promise.all([tx.get(ref), tx.get(keyRef)]).then(function (snaps) {
          if (snaps[0].exists || snaps[1].exists) {
            var err = new Error("exists");
            err.code = "exists";
            throw err;
          }
          tx.set(ref, {
            name: clean,
            nameKey: key,
            placed: false,
            balanceLeft: 100,
            orange: emptyBets(),
            red: emptyBets(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          tx.set(keyRef, { name: clean });
        });
      }).then(function () { return clean; });
    }
    var taken = Object.keys(preview.players).some(function (n) { return nameKey(n) === nameKey(clean); });
    if (taken) {
      var err = new Error("exists");
      err.code = "exists";
      return Promise.reject(err);
    }
    preview.players[clean] = {
      name: clean,
      nameKey: nameKey(clean),
      placed: false,
      balanceLeft: 100,
      orange: emptyBets(),
      red: emptyBets()
    };
    savePreview();
    return Promise.resolve(clean);
  }

  function placeBet(name, orange, red) {
    var total = sumBets(orange) + sumBets(red);
    var payload = {
      placed: true,
      balanceLeft: 100 - total,
      orange: orange,
      red: red
    };
    if (mode === "firebase") {
      payload.placedAt = firebase.firestore.FieldValue.serverTimestamp();
      return db.collection("players").doc(name).set(payload, { merge: true });
    }
    preview.players[name] = Object.assign({}, preview.players[name], payload);
    savePreview();
    return Promise.resolve();
  }

  function resetPlayers(scope) {
    var load = mode === "firebase"
      ? db.collection("players").get().then(function (snap) {
          var rows = [];
          snap.forEach(function (doc) { rows.push(Object.assign({ name: doc.id }, doc.data())); });
          return rows;
        })
      : Promise.resolve(playerList());
    return load.then(function (rows) {
      var targets = rows.filter(function (p) {
        if (scope === "all") return true;
        return sumBets(p[scope] || {}) > 0;
      });
      if (!targets.length) return 0;
      if (mode === "firebase") {
        var pending = Promise.resolve();
        for (var i = 0; i < targets.length; i += 200) {
          (function (slice) {
            pending = pending.then(function () {
              var batch = db.batch();
              slice.forEach(function (p) {
                var key = p.nameKey || nameKey(p.name);
                batch.delete(db.collection("players").doc(p.name));
                batch.delete(db.collection("nameKeys").doc(key));
                if (key !== nameKey(p.name)) batch.delete(db.collection("nameKeys").doc(nameKey(p.name)));
              });
              return batch.commit();
            });
          })(targets.slice(i, i + 200));
        }
        return pending.then(function () { return targets.length; });
      }
      targets.forEach(function (p) { delete preview.players[p.name]; });
      savePreview();
      return targets.length;
    });
  }

  function deletePlayer(pin) {
    var id = String(pin || "");
    if (!id) return Promise.resolve();
    if (mode === "firebase") {
      var ref = db.collection("players").doc(id);
      return ref.get().then(function (snap) {
        var batch = db.batch();
        batch.delete(ref);
        if (snap.exists) {
          var data = snap.data();
          var key = data.nameKey || nameKey(data.name || "");
          if (key) batch.delete(db.collection("nameKeys").doc(key));
        }
        return batch.commit();
      });
    }
    delete preview.players[id];
    savePreview();
    return Promise.resolve();
  }

  function watchDesigner(cb) {
    if (mode === "firebase") {
      return db.collection("designer").doc("state").onSnapshot(function (snap) {
        cb(snap.exists ? snap.data() : { score: "" });
      }, function () { cb({ score: "" }); });
    }
    listeners.designer.push(cb);
    cb(preview.designer || { score: "" });
    return function () {};
  }

  function saveDesigner(patch) {
    if (mode === "firebase") {
      var payload = Object.assign({}, patch, { updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
      return db.collection("designer").doc("state").set(payload, { merge: true });
    }
    preview.designer = Object.assign({ score: "" }, preview.designer, patch);
    savePreview();
    return Promise.resolve();
  }

  function playerUrl() {
    var path = location.pathname.replace(/[^/]*$/, "player.html");
    return location.origin + path;
  }

  function mp(value) {
    return '<span class="mp"><span>' + value + '</span></span>';
  }

  function validPlayerPin(pin) {
    return window.PLAYER_PINS.indexOf(String(pin)) !== -1 || String(pin) === window.TEST_PIN;
  }

  function watchPlayer(pin, cb) {
    if (!pin) return function () {};
    if (mode === "firebase") {
      return db.collection("players").doc(pin).onSnapshot(function (snap) {
        cb(snap.exists ? Object.assign({ pin: pin }, snap.data()) : null);
      }, function () { cb(null); });
    }
    cb(preview.players[pin] ? Object.assign({ pin: pin }, preview.players[pin]) : null);
    listeners.players.push(function () {
      cb(preview.players[pin] ? Object.assign({ pin: pin }, preview.players[pin]) : null);
    });
    return function () {};
  }

  function savePlayer(pin, patch) {
    if (mode === "firebase") {
      patch.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
      return db.collection("players").doc(pin).set(patch, { merge: true });
    }
    preview.players[pin] = Object.assign({}, preview.players[pin], patch, { pin: pin });
    savePreview();
    return Promise.resolve();
  }

  function enterWithPin(pin, name) {
    var cleanPin = String(pin || "").trim();
    var cleanName = String(name || "").trim() || "Player";
    if (!validPlayerPin(cleanPin)) {
      var err = new Error("bad-pin");
      err.code = "bad-pin";
      return Promise.reject(err);
    }
    if (cleanPin === window.TEST_PIN) {
      return nextTest(cleanName).then(function (made) {
        return savePlayer(made.pin, {
          pin: made.pin,
          name: made.name,
          test: true,
          placed: false,
          balanceLeft: 100,
          orange: emptyBets(),
          red: emptyBets()
        }).then(function () { return { pin: made.pin, name: made.name, fresh: true }; });
      });
    }
    var load = mode === "firebase"
      ? db.collection("players").doc(cleanPin).get().then(function (snap) { return snap.exists ? snap.data() : null; })
      : Promise.resolve(preview.players[cleanPin] || null);
    return load.then(function (existing) {
      var patch = { pin: cleanPin, name: cleanName };
      if (!existing) {
        patch.placed = false;
        patch.balanceLeft = 100;
        patch.orange = emptyBets();
        patch.red = emptyBets();
      }
      return savePlayer(cleanPin, patch).then(function () {
        return { pin: cleanPin, name: cleanName, fresh: !existing, existing: existing };
      });
    });
  }

  function nextTest(name) {
    if (mode === "firebase") {
      var ref = db.collection("meta").doc("testCounter");
      return db.runTransaction(function (tx) {
        return tx.get(ref).then(function (snap) {
          var n = (snap.exists ? Number(snap.data().n) : 0) + 1;
          tx.set(ref, { n: n });
          return { pin: "12345-" + n, name: name + "(test " + n + ")" };
        });
      });
    }
    preview.testN = (preview.testN || 0) + 1;
    savePreview();
    return Promise.resolve({ pin: "12345-" + preview.testN, name: name + "(test " + preview.testN + ")" });
  }

  window.BetHouse = {
    OUTCOMES: OUTCOMES,
    ALL_KEYS: ALL_KEYS,
    emptyBets: emptyBets,
    formatCoef: formatCoef,
    displayedCoef: displayedCoef,
    isLocked: isLocked,
    computeCoefs: computeCoefs,
    parseScore: parseScore,
    winningKeys: winningKeys,
    sumBets: sumBets,
    netOutcome: netOutcome,
    money: money,
    label: label,
    mode: mode,
    watchMarket: watchMarket,
    saveMarket: saveMarket,
    watchPlayers: watchPlayers,
    claimName: claimName,
    placeBet: placeBet,
    resetPlayers: resetPlayers,
    deletePlayer: deletePlayer,
    watchDesigner: watchDesigner,
    saveDesigner: saveDesigner,
    playerUrl: playerUrl,
    mp: mp,
    validPlayerPin: validPlayerPin,
    watchPlayer: watchPlayer,
    savePlayer: savePlayer,
    enterWithPin: enterWithPin
  };
})();
