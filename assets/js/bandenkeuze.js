/* OG MotoWorks – bandenmenu v2 ([data-bandenmenu][data-menu="v2"]): één scherm.
   Motor → OEM-maten voor/achter (aanpasbare keuzelijsten) → merk- en typeknoppen (vrij te combineren, niets gekozen = alles)
   + zoekveld → compacte lijst per positie (1 regel per band) met het advies bovenaan ('Advies <type>' + ⓘ waarom).
   Richtprijs per band = inkoop excl. btw x (1 + marge) x (1 + buffer) x btw (formule in banden.json). Montage +€50 per band,
   extra's (haakse ventielen, afvoeren), overzicht, WhatsApp en Formspree via OGMotor.klus (zelfde velden als v1).
   Data: banden.json (maten, formule, montage) + banden-assortiment.json (banden per maat, types, groepen, adviesregels).
   Terug naar v1: BANDENMENU_V2 = False in site-build/build_pages.py (laadt dan weer banden.js). */
(function () {
  'use strict';
  var box = document.querySelector('[data-bandenmenu]');
  if (!box || !window.OGMotor) return;
  var src = document.currentScript && document.currentScript.src || location.href;
  var URL_ = new URL('../data/banden.json', src).href, data = null;
  var AURL = box.getAttribute('data-assortiment'), assort = null;
  var ZICHTBAAR = 4; // regels per positie zonder 'Meer tonen' (voor + achter = 8)
  var NL = 'niet leverbaar in jouw maat';
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var B = range(60, 240, 10), H = range(45, 110, 5), V = range(10, 21, 1);
  function range(a, z, st) { var r = []; for (var i = a; i <= z; i += st) r.push(String(i)); return r; }
  function parse(m) {
    var x = /(\d{2,3})\s*\/\s*(\d{2,3})\s*-?\s*(?:Z?R|B)?\s*-?\s*(\d{2})/i.exec(String(m || ''));
    return x ? { b: x[1], h: x[2], v: String(Number(x[3])) } : { b: '', h: '', v: '' };
  }
  function tkey(t) { return t && t.b && t.h && t.v ? t.b + '/' + t.h + '/' + t.v : ''; }
  function formule() {
    var f = data && data.formule, ok = function (v, a, z) { return typeof v === 'number' && isFinite(v) && v >= a && v <= z; };
    return f && ok(f.marge, 0, 1) && ok(f.btw, 1, 2) && ok(f.buffer, 0, 0.5) ? f : null;
  }
  function vanaf(t) {
    if (!t || t.inkoop_excl_btw == null || !(t.inkoop_excl_btw > 0)) return null;
    var f = formule(); if (!f) return null;
    return Math.round(t.inkoop_excl_btw * (1 + f.marge) * (1 + f.buffer) * f.btw);
  }
  function inYear(m, y) { return y && (!m.van || y >= m.van) && (!m.tot || y <= m.tot); }
  function oem(s) {
    if (!s || !data) return null;
    var y = parseInt(s.bouwjaar, 10);
    var hits = data.maten.filter(function (m) {
      return m.merk === s.merk && m.model === s.model && (!m.uitvoering || m.uitvoering.indexOf(s.uitvoering || '') !== -1) && inYear(m, y);
    });
    return hits.length === 1 ? hits[0] : null;
  }
  function perUitvoering(s) {
    var y = parseInt(s.bouwjaar, 10);
    return data.maten.some(function (m) { return m.merk === s.merk && m.model === s.model && m.uitvoering && inYear(m, y); });
  }
  function adviesKey(t) {
    var k = tkey(t), hit = null; if (!k) return null;
    Object.keys(data.advies || {}).forEach(function (m) { if (!hit && tkey(parse(m)) === k) hit = m; });
    return hit;
  }
  function label(p) {
    var t = state[p], k = tkey(t); if (!k) return '';
    if (state.oem && tkey(parse(state.oem[p])) === k) return state.oem[p];
    return adviesKey(t) || (t.b + '/' + t.h + '-' + t.v);
  }
  function sel(p, f, name, vals, v) {
    var id = 'bm-' + p + '-' + f;
    return '<div class="field"><label for="' + id + '">' + name + '</label><select id="' + id + '" data-pos="' + p + '" data-f="' + f + '"><option value="">kies</option>' +
      vals.map(function (x) { return '<option value="' + x + '"' + (x === v ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></div>';
  }
  var state = { voor: parse(''), achter: parse(''), keuze: {}, oem: null, f: { merk: '', type: '', q: '' }, meer: {}, ventielen: false, afvoeren: false };
  var VENTIELEN = 20, AFVOEREN = 5;
  var HELP = {
    ventielen: 'Met haakse ventielen kom je veel makkelijker bij je ventiel om je bandenspanning te checken of bij te pompen, ook langs remschijf en remklauw. We checken eerst of ze op jouw velg passen; past het niet, dan betaal je niets.',
    afvoeren: 'Neem je oude band mee. Bij veel milieustraten lever je banden gratis in, check even wat jouw gemeente doet. Liever geen gedoe? Vink dit aan, dan voeren wij hem af voor €5 per band.'
  };
  function montage() { return data.montage_per_band || 50; }
  var POS = ['voor', 'achter'];
  function posNaam(p) { return p === 'voor' ? 'Voorband' : 'Achterband'; }

  // ---------- assortiment ----------
  // Lijst voor een positie: banden uit het assortiment; zonder assortiment de 3 adviesbanden uit banden.json (zonder filters)
  function lijst(p) {
    var k = tkey(state[p]); if (!k) return [];
    if (assort) return assort.maten[k] || [];
    var a = adviesKey(state[p]); return a ? data.advies[a] : [];
  }
  function gekozen(p) { var k = state.keuze[p]; return k == null ? null : lijst(p)[k] || null; }
  function typeInfo(id) { return (assort && assort.types || []).filter(function (x) { return x[0] === id; })[0] || [id, id, '']; }
  function typeNaam(id) { return id ? typeInfo(id)[1] : ''; }
  function typeKort(id) { return id === 'hypersport' ? 'hypersport' : typeNaam(id).toLowerCase(); } // 'Advies hypersport'
  function radiaalPos(p) { return /\bZ?R\s*\d{2}\b/i.test(label(p)); }
  function diag(p, t) { return t.bouw === 'diagonaal' && radiaalPos(p); }
  function naamKey(t) { return (t.merk + '|' + t.band).toLowerCase(); }
  function zoekNorm(s) { return String(s || '').toLowerCase().replace(/[\s\-_.]+/g, ''); }
  function past(t, f) {
    return (!f.merk || t.merk === f.merk) && (!f.type || t.type === f.type) && (!f.q || zoekNorm(t.merk + ' ' + t.band).indexOf(zoekNorm(f.q)) !== -1);
  }
  function actievePos() { return POS.filter(function (p) { return tkey(state[p]); }); }
  // Knop beschikbaar als er in minstens één van de gekozen maten een band is (met het andere filter erbij; zoeken telt niet mee)
  function leverbaar(merk, type) {
    return actievePos().some(function (p) { return lijst(p).some(function (t) { return (!merk || t.merk === merk) && (!type || t.type === type); }); });
  }

  // ---------- advies ----------
  // Soort motor (motoren.json 'types', via OGMotor.type) + achterbandbreedte + 'GT' → categorie → volgorde van types → eerste voorkeursmodel
  // dat in de maat leverbaar is (liefst voor én achter hetzelfde model), nooit diagonaal onder een radiale maat.
  function categorie() {
    var A = assort && assort.advies; if (!A) return null;
    var s = OGMotor.get(), mt = s && OGMotor.type ? OGMotor.type(s) : 'generiek';
    var gt = s && /\bGT\b/.test((s.model || '') + ' ' + (s.uitvoering || ''));
    var breed = Number(state.achter.b) >= (A.breed_vanaf || 190);
    var c = gt && (mt === 'toer' || mt === 'naked' || mt === 'sport') ? 'gt' : mt === 'naked' ? (breed ? 'naked_breed' : 'naked') : mt;
    if (!A.categorie[c]) c = (state.voor.v === '21' || state.voor.v === '19') && Number(state.voor.b) <= 120 && Number(state.voor.h) >= 70 ? 'onbekend_adventure' : 'onbekend';
    return A.categorie[c] ? { id: c, wie: A.categorie[c].wie, types: A.categorie[c].types } : null;
  }
  function adviesBerekenen() {
    var c = categorie(), ps = actievePos(), A = assort && assort.advies;
    if (!c || !ps.length) return null;
    function vind(p, key) {
      var l = lijst(p);
      for (var i = 0; i < l.length; i++) if (naamKey(l[i]) === key && !diag(p, l[i])) return i;
      return -1;
    }
    for (var ti = 0; ti < c.types.length; ti++) {
      var type = c.types[ti], vk = ((A.voorkeur || {})[type] || []).map(function (x) { return x.toLowerCase(); });
      // 1. zelfde model voor en achter
      for (var j = 0; j < vk.length; j++) {
        var idx = {}, ok = ps.every(function (p) { var i = vind(p, vk[j]); idx[p] = i; return i !== -1 && lijst(p)[i].type === type; });
        if (ok) return { cat: c, type: type, idx: idx };
      }
      // 2. per positie het eerste voorkeursmodel
      var per = {};
      ps.forEach(function (p) { for (var j = 0; j < vk.length; j++) { var i = vind(p, vk[j]); if (i !== -1 && lijst(p)[i].type === type) { per[p] = i; return; } } });
      if (Object.keys(per).length === ps.length) return { cat: c, type: type, idx: per };
    }
    return null;
  }

  // ---------- overzicht / opslaan (zelfde velden als v1) ----------
  function pos() {
    return actievePos().map(function (p) {
      var t = gekozen(p), pr = t ? vanaf(t) : null, l = lijst(p);
      return { p: p, naam: posNaam(p), maat: label(p), band: t, pr: pr, st: pr != null ? 'ok' : (l.length && !t ? 'kiezen' : 'aanvraag') };
    });
  }
  function wie(arr) { return arr.length === 2 ? 'voor- en achterband' : arr[0].naam.toLowerCase(); }
  function bandNaam(p, t) { return t.merk + ' ' + t.band + (t.notatie ? ' (' + t.notatie + (diag(p, t) ? ', diagonaal' : '') + ')' : ''); }
  function som() {
    var ps = pos(), n = ps.length, m = montage(), regels = [], tot = 0;
    ps.forEach(function (x) {
      regels.push([x.naam + ' ' + x.maat + (x.band ? ' · ' + bandNaam(x.p, x.band) : ' (kies een band)'), x.st === 'ok' ? '€' + x.pr : (x.st === 'kiezen' ? 'nog kiezen' : 'prijs op aanvraag')]);
      if (x.st === 'ok') tot += x.pr;
    });
    if (n) { regels.push(['Montage ' + n + ' × €' + m, '€' + m * n]); tot += m * n; }
    if (n && state.ventielen) { regels.push(['Haakse ventielen (als het past), per set', '€' + VENTIELEN]); tot += VENTIELEN; }
    if (n && state.afvoeren) { regels.push(['Oude band afvoeren ' + n + ' × €' + AFVOEREN, '€' + AFVOEREN * n]); tot += AFVOEREN * n; }
    var aan = ps.filter(function (x) { return x.st === 'aanvraag'; }), kies = ps.filter(function (x) { return x.st === 'kiezen'; });
    var tekst = n ? 'Richtprijs: €' + tot + (aan.length ? ' + ' + wie(aan) + ' prijs op aanvraag' : '') + (kies.length ? ' + ' + wie(kies) + ' nog kiezen' : '') : '';
    return { n: n, regels: regels, totaal: n ? tot : null, compleet: n > 0 && !aan.length && !kies.length, tekst: tekst };
  }
  var DEF = 'Definitieve prijs na check in de offerte.';
  function extrasHTML() {
    function cb(id, lab) {
      return '<div class="field field--check bm__check"><input type="checkbox" id="bm-' + id + '"' + (state[id] ? ' checked' : '') + ' aria-describedby="bm-' + id + '-help">' +
        '<label for="bm-' + id + '">' + lab + '</label><p class="bm__help" id="bm-' + id + '-help">' + esc(HELP[id]) + '</p></div>';
    }
    return '<fieldset class="bm__extras"><legend>Extra\'s</legend>' + cb('ventielen', 'Haakse ventielen (+€' + VENTIELEN + ' per set, als het past)') +
      cb('afvoeren', 'Wij voeren je oude band af (+€' + AFVOEREN + ' per band)') + '</fieldset>';
  }
  function somHTML() {
    var x = som();
    var body = !x.n ? '<p class="muted">Kies je bandenmaat, dan zie je hier je overzicht.</p>' :
      '<ul>' + x.regels.map(function (r) { return '<li><span>' + esc(r[0]) + '</span><b>' + esc(r[1]) + '</b></li>'; }).join('') + '</ul>' +
      '<p class="bm__totaal">Richtprijs: <b>€' + x.totaal + '</b>' + esc(x.tekst.replace(/^Richtprijs: €\d+/, '')) + '</p>' +
      '<p class="bm__def">Alle bedragen incl. btw. ' + DEF + '</p>';
    return '<div class="bm__som" aria-live="polite"><h3>Overzicht</h3><p class="bm__sub">Dit gaat mee in je bericht aan ons. Je betaalt nu niets.</p>' + body + '</div>';
  }
  function save() {
    if (!OGMotor.get()) return;
    var parts = [], min = null;
    actievePos().forEach(function (p) {
      var t = gekozen(p), pr = t ? vanaf(t) : null;
      if (pr != null) min = min == null ? pr : Math.min(min, pr);
      parts.push(p + ' ' + label(p) + (t ? ' ' + bandNaam(p, t) + ' (' + (pr ? 'vanaf €' + pr : 'prijs op aanvraag') + ')' : ''));
    });
    var x = som(), k = OGMotor.klus.get();
    k.banden = (parts.join('; ') + (parts.length ? ' + €' + montage() + ' montage per band' : '')).replace(/^; /, '');
    k.bandPrijs = min;
    k.bandExtra = { ventielen: !!state.ventielen, afvoeren: !!state.afvoeren, aantal: x.n, totaal: x.totaal, compleet: x.compleet, regels: x.regels, tekst: x.tekst };
    OGMotor.klus.set(k);
  }

  // ---------- weergave ----------
  var adv = null; // huidig advies (per render berekend)
  function info(id, lab) { return '<button type="button" class="bm__i" data-pop="' + id + '" aria-label="' + esc(lab) + '" aria-haspopup="dialog">i</button>'; }
  function chip(kind, val, txt, extra) {
    var on = state.f[kind] === val, merk = kind === 'merk' ? val : state.f.merk, type = kind === 'type' ? val : state.f.type;
    var ok = leverbaar(merk, type), isAdv = adv && (kind === 'type' ? adv.type === val : POS.some(function (p) { var i = adv.idx[p]; return i != null && lijst(p)[i] && lijst(p)[i].merk === val; }));
    return '<button type="button" class="bm__chip' + (isAdv ? ' has-adv' : '') + '" id="bm-f-' + kind + '-' + esc(val) + '" data-f="' + kind + '" data-v="' + esc(val) + '" aria-pressed="' + on + '"' + (ok ? '' : ' disabled') + '>' +
      esc(txt) + (isAdv ? '<span class="bm__badge">Advies</span>' : '') + (ok ? '' : '<span class="sr-only"> – ' + NL + '</span>') + '</button>';
  }
  function filtersHTML() {
    if (!assort) return '';
    var m = assort.groepen.map(function (g) { return '<span class="bm__glab">' + esc(g[0]) + '</span>' + g[1].map(function (mk) { return chip('merk', mk, mk); }).join(''); }).join('');
    var t = assort.types.map(function (x) { return chip('type', x[0], x[1]); }).join('');
    var actief = state.f.merk || state.f.type || state.f.q;
    return '<div class="bm__frow"><div class="bm__fkop" id="bm-f-merk-kop">Merk ' + info('merk', 'Uitleg over A-merken en budgetmerken') + '</div><div class="bm__chips" role="group" aria-labelledby="bm-f-merk-kop">' + m + '</div></div>' +
      '<div class="bm__frow"><div class="bm__fkop" id="bm-f-type-kop">Type ' + info('type', 'Uitleg over de soorten banden') + '</div><div class="bm__chips" role="group" aria-labelledby="bm-f-type-kop">' + t + '</div></div>' +
      '<p class="bm__fnote"><span>Grijs = ' + NL + '.</span>' + (actief ? ' <button type="button" class="bm__reset" data-reset>Alles tonen</button>' : '') + '</p>';
  }
  function rij(p, t, i, isAdv) {
    var pr = vanaf(t), id = 'bm-' + p + '-z' + i, d = diag(p, t);
    var meta = [typeNaam(t.type), t.notatie || ''].filter(Boolean).join(' · ');
    return '<li class="bm__row' + (isAdv ? ' is-adv' : '') + (d ? ' is-diag' : '') + '">' +
      '<input type="radio" name="bm-' + p + '" data-pos="' + p + '" id="' + id + '" value="' + i + '"' + (state.keuze[p] === i ? ' checked' : '') + '>' +
      '<label for="' + id + '"><span class="bm__rn">' + (isAdv ? '<span class="bm__adv">Advies ' + esc(typeKort(t.type)) + '</span>' : '') + '<b>' + esc(t.merk + ' ' + t.band) + '</b></span>' +
      (meta ? '<span class="bm__rm">' + esc(meta) + '</span>' : '') + (d ? '<span class="bm__let">Diagonaal, check of dit past</span>' : '') + '</label>' +
      '<span class="bm__rp">' + (pr ? '€' + pr : 'op aanvraag') + '</span>' +
      (isAdv ? info('adv-' + p, 'Waarom adviseren we de ' + t.merk + ' ' + t.band + '?') : (t.uitleg && t.bron ? info('band-' + p + '-' + i, 'Over de ' + t.merk + ' ' + t.band) : '<span class="bm__i0"></span>')) + '</li>';
  }
  function lijstHTML(p) {
    var naam = posNaam(p);
    if (!tkey(state[p])) return '<section class="bm__pos" aria-label="' + naam + '"><h3 class="bm__ph">' + naam + '</h3><p class="muted">Kies breedte, hoogte en velgmaat, dan tonen we de banden.</p></section>';
    var l = lijst(p), maat = label(p), kop = '<h3 class="bm__ph" id="bm-' + p + '-kop">' + naam + ' <span>' + esc(maat) + '</span></h3>';
    if (!l.length) return '<section class="bm__pos" aria-labelledby="bm-' + p + '-kop">' + kop + '<p class="muted">Voor deze maat hebben we nog geen banden in onze lijst. App ons, dan zoeken we het voor je uit.</p></section>';
    var ai = adv && adv.idx[p] != null ? adv.idx[p] : -1;
    var items = l.map(function (t, i) { return { t: t, i: i }; }).filter(function (x) { return !assort || past(x.t, state.f); });
    var to = assort ? assort.types.map(function (x) { return x[0]; }) : [], mo = assort ? [].concat.apply([], assort.groepen.map(function (g) { return g[1]; })) : [];
    // volgorde: advies, dan (niet-diagonaal) de voorkeursmodellen uit de adviesregels voor deze motor, dan hetzelfde type, dan de rest; diagonaal onder radiaal onderaan
    var rank = {};
    if (adv && assort.advies) adv.cat.types.forEach(function (ty, ti) { ((assort.advies.voorkeur || {})[ty] || []).forEach(function (x, j) { var k = x.toLowerCase(); if (rank[k] == null) rank[k] = ti * 100 + j; }); });
    var rk = function (t) { var r = rank[naamKey(t)]; return r == null ? 1e4 : r; };
    if (assort) items.sort(function (a, b) { // zonder assortiment: volgorde van banden.json (zuinig, allround, sportief)
      return (a.i === ai ? 0 : 1) - (b.i === ai ? 0 : 1) || (diag(p, a.t) ? 1 : 0) - (diag(p, b.t) ? 1 : 0) || rk(a.t) - rk(b.t) ||
        (adv && a.t.type === adv.type ? 0 : 1) - (adv && b.t.type === adv.type ? 0 : 1) || to.indexOf(a.t.type) - to.indexOf(b.t.type) ||
        mo.indexOf(a.t.merk) - mo.indexOf(b.t.merk) || (a.t.band < b.t.band ? -1 : a.t.band > b.t.band ? 1 : 0);
    });
    if (!items.length) {
      var w = [state.f.merk, state.f.type ? typeKort(state.f.type) : ''].filter(Boolean).join(' ');
      var zonderZoek = l.some(function (t) { return past(t, { merk: state.f.merk, type: state.f.type, q: '' }); });
      var msg = !zonderZoek ? esc(w) + ': ' + NL + '.' : 'Geen band gevonden met “' + esc(state.f.q) + '”' + (w ? ' bij ' + esc(w) : '') + ' in deze maat.';
      return '<section class="bm__pos" aria-labelledby="bm-' + p + '-kop">' + kop + '<p class="muted bm__leeg">' + msg + '</p></section>';
    }
    var meer = !!state.meer[p], n = items.length, zicht = meer ? items : items.slice(0, ZICHTBAAR);
    if (!meer && state.keuze[p] != null && zicht.every(function (x) { return x.i !== state.keuze[p]; })) {
      var gk = items.filter(function (x) { return x.i === state.keuze[p]; })[0]; if (gk) zicht = zicht.slice(0, ZICHTBAAR - 1).concat([gk]);
    }
    return '<section class="bm__pos" aria-labelledby="bm-' + p + '-kop">' + kop + '<ul class="bm__rows">' + zicht.map(function (x) { return rij(p, x.t, x.i, x.i === ai); }).join('') + '</ul>' +
      (n > ZICHTBAAR ? '<button type="button" class="bm__meer" data-meer="' + p + '" aria-expanded="' + meer + '">' + (meer ? 'Minder tonen' : 'Meer tonen (nog ' + (n - zicht.length) + ')') + '</button>' : '') + '</section>';
  }
  function keuzeHTML() { return '<div class="bm__filters" aria-label="Filter op merk en type">' + filtersHTML() + '</div>'; }
  function lijstenHTML() { return POS.map(lijstHTML).join(''); }
  function status() {
    var el = document.getElementById('bm-status'); if (!el || !assort) return;
    el.textContent = actievePos().map(function (p) { var n = lijst(p).filter(function (t) { return past(t, state.f); }).length; return posNaam(p) + ': ' + n + (n === 1 ? ' band' : ' banden'); }).join(', ');
  }
  function render(focus) {
    var s = OGMotor.get(), o = oem(s), head;
    if (!s) head = '<p class="bm__intro">Kies hierboven eerst je motor. Dan vullen we de originele bandenmaten voor je in.</p>';
    else if (o) head = '<p class="bm__intro">Originele bandenmaten voor de <strong>' + esc(OGMotor.label(s)) + '</strong>. Staat er iets anders op je band of in je instructieboekje, pas het dan aan.</p>';
    else if (perUitvoering(s)) head = '<p class="bm__intro">Bij de <strong>' + esc(OGMotor.label(s)) + '</strong> verschillen de bandenmaten per uitvoering. Kies hierboven je uitvoering, of kies hieronder zelf de maat van je band. <a class="link" href="/banden/bandenmaat/">Zo lees je je bandenmaat →</a></p>';
    else head = '<p class="bm__intro">Van de <strong>' + esc(OGMotor.label(s)) + '</strong> hebben we de bandenmaten nog niet in onze lijst. Kies hieronder de maat van je band, of app ons, dan zoeken we het op. <a class="link" href="/banden/bandenmaat/">Zo lees je je bandenmaat →</a></p>';
    var id = s ? OGMotor.label(s) + '|' + (s.bouwjaar || '') : '';
    if (s && state.motor !== id) {
      state = { motor: id, oem: o, voor: parse(o && o.voor), achter: parse(o && o.achter), keuze: {}, f: { merk: '', type: '', q: '' }, meer: {}, ventielen: state.ventielen, afvoeren: state.afvoeren };
    }
    adv = assort ? adviesBerekenen() : null;
    box.innerHTML = head + (s ? '<div class="bm__maten">' + POS.map(function (p) {
      var t = state[p];
      return '<fieldset class="bm__maat"><legend>Bandenmaat ' + p + '</legend><div class="bm__sel">' + sel(p, 'b', 'Breedte', B, t.b) + sel(p, 'h', 'Hoogte', H, t.h) + sel(p, 'v', 'Velg (inch)', V, t.v) + '</div></fieldset>';
    }).join('') + '</div>' +
      (assort ? keuzeHTML() + '<div class="field bm__zoek"><label for="bm-zoek">Zoek op bandnaam</label><input type="search" id="bm-zoek" placeholder="bv. Road 6 of MK4" autocomplete="off" value="' + esc(state.f.q) + '"></div>' : '') +
      '<p class="bm__pnote">Richtprijs per band, incl. btw. Montage komt erbij: <strong>+ €' + montage() + ' montage per band</strong>.' +
      (data.prijzen_bijgewerkt ? ' Prijzen bijgewerkt op ' + esc(new Date(data.prijzen_bijgewerkt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })) + '.' : '') + '</p>' +
      '<p class="sr-only" id="bm-status" role="status" aria-live="polite"></p><div class="bm__lijst">' + lijstenHTML() + '</div>' + extrasHTML() + somHTML() +
      '<div class="bm__cta"><a class="btn btn--wa" data-dienst="Banden" data-wa-intent="banden" href="https://wa.me/31642939555" target="_blank" rel="noopener"><svg class="ico" aria-hidden="true"><use href="#i-wa"/></svg>App ons over deze banden</a></div>' : '');
    box.querySelectorAll('.bm__sel select').forEach(function (el) {
      el.addEventListener('change', function () {
        var p = el.getAttribute('data-pos'); state[p][el.getAttribute('data-f')] = el.value; delete state.keuze[p]; state.meer = {};
        render(el.id); save();
      });
    });
    var z = document.getElementById('bm-zoek');
    if (z) z.addEventListener('input', function () { state.f.q = z.value.trim(); state.meer = {}; upd(); });
    ['ventielen', 'afvoeren'].forEach(function (k) {
      var c = document.getElementById('bm-' + k);
      if (c) c.addEventListener('change', function () { state[k] = c.checked; save(); updSom(); });
    });
    if (focus && document.getElementById(focus)) document.getElementById(focus).focus();
    status(); toonAdvies();
    save();
  }
  // Alleen filters + lijsten opnieuw (zoekveld en focus blijven staan)
  function upd(focus) {
    adv = assort ? adviesBerekenen() : null;
    var f = box.querySelector('.bm__filters'), l = box.querySelector('.bm__lijst');
    if (f) f.innerHTML = filtersHTML();
    if (l) l.innerHTML = lijstenHTML();
    status();
    toonAdvies();
    if (focus) { var el = document.getElementById(focus); if (el && !el.disabled) el.focus(); else if (focus.indexOf('bm-f-') === 0) { var r = box.querySelector('.bm__chip:not([disabled])'); if (r) r.focus(); } }
  }
  // Mobiel: knoppenrij scrolt horizontaal; zorg dat de knop met het Advies-label (of de gekozen knop) in beeld staat
  function toonAdvies() {
    box.querySelectorAll('.bm__chips').forEach(function (row) {
      if (row.scrollWidth <= row.clientWidth) return;
      var c = row.querySelector('.bm__chip[aria-pressed="true"]') || row.querySelector('.bm__chip.has-adv'); if (!c) return;
      var l = c.offsetLeft, r = l + c.offsetWidth; // .bm__chips is position:relative → offsetLeft t.o.v. de rij
      if (l < row.scrollLeft || r > row.scrollLeft + row.clientWidth) row.scrollLeft = Math.max(0, r - row.clientWidth + 28);
    });
  }
  function updSom() { var b = box.querySelector('.bm__som'); if (b) b.outerHTML = somHTML(); }
  // Eén gedelegeerde klik-/change-handler voor knoppen en radio's
  box.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b || !box.contains(b)) return;
    if (b.hasAttribute('data-f')) {
      var k = b.getAttribute('data-f'), v = b.getAttribute('data-v');
      state.f[k] = state.f[k] === v ? '' : v; state.meer = {};
      // andere filter niet meer leverbaar met deze keuze? dan loslaten (nooit een lege lijst door een combinatie)
      var o = k === 'merk' ? 'type' : 'merk';
      if (state.f.merk && state.f.type && !leverbaar(state.f.merk, state.f.type)) state.f[o] = '';
      upd(b.id);
    } else if (b.hasAttribute('data-reset')) {
      state.f = { merk: '', type: '', q: '' }; state.meer = {}; var z = document.getElementById('bm-zoek'); if (z) z.value = ''; upd(); var c = box.querySelector('.bm__chip:not([disabled])'); if (c) c.focus();
    } else if (b.hasAttribute('data-meer')) {
      var p = b.getAttribute('data-meer'); state.meer[p] = !state.meer[p]; upd('bm-' + p + '-kop');
      var nb = box.querySelector('[data-meer="' + p + '"]'); if (nb) nb.focus();
    } else if (b.hasAttribute('data-pop')) { pop(b.getAttribute('data-pop'), b); }
  });
  box.addEventListener('change', function (e) {
    var r = e.target; if (!r.matches || !r.matches('.bm__row input[type=radio]')) return;
    var p = r.getAttribute('data-pos'), i = Number(r.value); state.keuze[p] = i;
    // zelfde model aan de andere kant als daar nog niets gekozen is (en het daar leverbaar is, niet diagonaal onder radiaal)
    var t = lijst(p)[i], q = p === 'voor' ? 'achter' : 'voor';
    if (t && assort && tkey(state[q]) && state.keuze[q] == null) {
      var l = lijst(q); for (var j = 0; j < l.length; j++) if (naamKey(l[j]) === naamKey(t) && !diag(q, l[j])) { state.keuze[q] = j; break; }
      if (state.keuze[q] != null) { upd(r.id); }
    }
    save(); updSom();
  });
  // ---------- popups (ⓘ) ----------
  var dlg = null, opener = null;
  function pop(id, btn) {
    var h = '', titel = '';
    if (id === 'type') {
      titel = 'Soorten banden';
      h = '<dl>' + assort.types.map(function (t) { return '<dt>' + esc(t[1]) + '</dt><dd>' + esc(t[2]) + '</dd>'; }).join('') + '</dl>';
    } else if (id === 'merk') {
      titel = 'A-merken en budget';
      h = assort.groepen.map(function (g) { return '<p><b>' + esc(g[0]) + '</b> (' + esc(g[1].join(', ')) + '): ' + esc(g[2]) + (g[3] ? ' <a class="link" href="' + esc(g[3]) + '" target="_blank" rel="noopener">Bron</a>' : '') + '</p>'; }).join('');
    } else if (/^adv-/.test(id)) {
      var p = id.slice(4), t = lijst(p)[adv.idx[p]];
      titel = 'Waarom de ' + t.merk + ' ' + t.band + '?';
      var s = OGMotor.get(), ti = typeInfo(adv.type);
      h = '<p>' + (adv.cat.wie ? 'Je ' + esc(OGMotor.label(s)) + ' is ' + esc(adv.cat.wie) + '. Daar past een <b>' + esc(typeKort(adv.type)) + '</b>band bij.' : 'Voor deze maat is een <b>' + esc(typeKort(adv.type)) + '</b>band een goede middenweg.') + '</p>' +
        (ti[2] ? '<p>' + esc(ti[2]) + '</p>' : '') +
        (t.uitleg && t.bron ? '<p>' + esc(t.uitleg) + ' <a class="link" href="' + esc(t.bron) + '" target="_blank" rel="noopener">Bron</a></p>' : '') +
        '<p class="muted">Liever iets anders? Kies een ander merk of type, of app ons.</p>';
    } else if (/^band-/.test(id)) {
      var m = /^band-(voor|achter)-(\d+)$/.exec(id), tt = lijst(m[1])[Number(m[2])];
      titel = tt.merk + ' ' + tt.band;
      h = '<p>' + esc(tt.uitleg) + ' <a class="link" href="' + esc(tt.bron) + '" target="_blank" rel="noopener">Bron</a></p>';
    }
    if (!dlg) {
      dlg = document.createElement('dialog'); dlg.className = 'bm__pop'; dlg.setAttribute('aria-labelledby', 'bm-pop-t');
      document.body.appendChild(dlg);
      dlg.addEventListener('click', function (e) { if (e.target === dlg || e.target.closest('[data-sluit]')) dlg.close(); }); // tik buiten de popup = sluiten
      dlg.addEventListener('close', function () { if (opener && document.contains(opener)) opener.focus(); });
    }
    opener = btn;
    dlg.innerHTML = '<div class="bm__popin"><h3 id="bm-pop-t">' + esc(titel) + '</h3>' + h + '<button type="button" class="bm__popx" data-sluit aria-label="Sluiten">×</button></div>';
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    var x = dlg.querySelector('[data-sluit]'); if (x) x.focus();
  }
  var pa = AURL ? fetch(new URL(AURL, location.href).href, { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }) : Promise.resolve(null);
  function assortOk(a) { return a && a.maten && typeof a.maten === 'object' && Array.isArray(a.types) && Array.isArray(a.groepen) ? a : null; }
  fetch(URL_, { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (d) { data = d; return pa; }).then(function (a) { assort = assortOk(a); return OGMotor.load(); })
    .then(function () { render(); OGMotor.on(function () { render(); }); })
    .catch(function () { box.innerHTML = '<p class="bm__intro">Het bandenmenu kon niet laden. App ons je motor en bandenmaat, dan helpen we je verder.</p>'; });
  window.OGBanden = { versie: 2, vanaf: function (inkoop) { return data ? vanaf({ inkoop_excl_btw: inkoop }) : null; }, state: function () { return state; }, assortiment: function () { return !!assort; }, advies: function () { return adv; } };
})();
