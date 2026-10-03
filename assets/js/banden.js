/* OG MotoWorks – bandenmenu ([data-bandenmenu]). Na merk/model/bouwjaar (OGMotor): OEM-maten voor/achter (per generatie, uit banden.json)
   als vooringevulde keuzelijsten breedte/hoogte/velgmaat, per maat 3 adviesbanden met 'vanaf'-prijs (inkoop excl. btw x (1 + marge) x (1 + buffer) x btw, afgerond; zie formule in banden.json) en
   montage apart (+ €50 per band). Geen prijs bekend = 'prijs op aanvraag'. Extra's: haakse ventielen (€20 per set), afvoeren (€5 per band).
   Overzicht onderaan (geen betaling/winkelwagen) met richtprijs; gaat mee in WhatsApp-bericht en Formspree. */
(function () {
  'use strict';
  var box = document.querySelector('[data-bandenmenu]');
  if (!box || !window.OGMotor) return;
  var src = document.currentScript && document.currentScript.src || location.href;
  var URL_ = new URL('../data/banden.json', src).href, data = null;
  // 'Zelf kiezen' (assortiment per maat): alleen als de pagina data-assortiment heeft (ASSORTIMENT_LIVE in build_pages.py)
  var AURL = box.getAttribute('data-assortiment'), assort = null;
  var SOORT = { zuinig: 'Zuinig / veel km', allround: 'Allround / sporttoer', sportief: 'Sportief / grip' };
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var B = range(60, 240, 10), H = range(45, 110, 5), V = range(10, 21, 1);
  function range(a, z, st) { var r = []; for (var i = a; i <= z; i += st) r.push(String(i)); return r; }
  // Maat ontleden naar breedte/hoogte/velg; ZR/R/-/B en spaties maken niet uit (120/70 ZR17 = 120/70-17)
  function parse(m) {
    var x = /(\d{2,3})\s*\/\s*(\d{2,3})\s*-?\s*(?:Z?R|B)?\s*-?\s*(\d{2})/i.exec(String(m || ''));
    return x ? { b: x[1], h: x[2], v: String(Number(x[3])) } : { b: '', h: '', v: '' };
  }
  function tkey(t) { return t && t.b && t.h && t.v ? t.b + '/' + t.h + '/' + t.v : ''; }
  function vanaf(t) {
    if (t.inkoop_excl_btw == null || !(t.inkoop_excl_btw > 0)) return null;
    var f = formule(); if (!f) return null;
    return Math.round(t.inkoop_excl_btw * (1 + f.marge) * (1 + f.buffer) * f.btw);
  }
  // Formule staat alleen in banden.json: marge en buffer als fractie (0 = geen opslag), btw als factor. Ontbreekt of klopt die niet: geen prijs (= op aanvraag).
  function formule() {
    var f = data && data.formule, ok = function (v, a, z) { return typeof v === 'number' && isFinite(v) && v >= a && v <= z; };
    return f && ok(f.marge, 0, 1) && ok(f.btw, 1, 2) && ok(f.buffer, 0, 0.5) ? f : null;
  }
  function inYear(m, y) { return y && (!m.van || y >= m.van) && (!m.tot || y <= m.tot); }
  // Precies één regel moet passen (merk, model, uitvoering, bouwjaar); anders geen OEM-maat
  function oem(s) {
    if (!s || !data) return null;
    var y = parseInt(s.bouwjaar, 10);
    var hits = data.maten.filter(function (m) {
      return m.merk === s.merk && m.model === s.model && (!m.uitvoering || m.uitvoering.indexOf(s.uitvoering || '') !== -1) && inYear(m, y);
    });
    return hits.length === 1 ? hits[0] : null;
  }
  function perUitvoering(s) { // wel maten voor dit model/jaar, maar niet voor deze (onbekende) uitvoering
    var y = parseInt(s.bouwjaar, 10);
    return data.maten.some(function (m) { return m.merk === s.merk && m.model === s.model && m.uitvoering && inYear(m, y); });
  }
  // Meerdere fabrieksmaten (banden.json 'opties'): knoppen, niets vooraf gekozen (zelfde gedrag als bandenkeuze.js)
  function opties(o) { return o && Array.isArray(o.opties) && o.opties.length ? o.opties : null; }
  function optiesHTML() {
    var op = opties(state.oem); if (!op) return '';
    return '<div class="bm__opties" id="bm-opties"><p class="bm__optkop"><strong>Voor deze motor bestaan meerdere bandenmaten.</strong> Kies hieronder je maat.</p><div class="bm__optk">' +
      op.map(function (x, i) {
        var on = ['voor', 'achter'].every(function (p) { return !x[p] || tkey(parse(x[p])) === tkey(state[p]); });
        var t = (x.naam ? x.naam + ': ' : '') + (x.voor && x.achter ? 'voor ' + x.voor + ' + achter ' + x.achter : x.voor ? 'voor ' + x.voor : 'achter ' + x.achter);
        return '<button type="button" class="bm__chip bm__opt" id="bm-opt-' + i + '" data-opt="' + i + '" aria-pressed="' + on + '">' + esc(t) + '</button>';
      }).join('') + '</div><p class="bm__opttip">Check de maat op de zijkant van je huidige band; afwijken mag, vraag ons gerust.</p></div>';
  }
  function adviesKey(t) {
    var k = tkey(t), hit = null; if (!k) return null;
    Object.keys(data.advies).forEach(function (m) { if (!hit && tkey(parse(m)) === k) hit = m; });
    return hit;
  }
  function advies(t) { var k = adviesKey(t); return k ? data.advies[k] : null; }
  // Weergave: OEM-notatie als die gekozen is, anders de notatie uit het advies, anders 120/70-17
  function label(p) {
    var t = state[p], k = tkey(t); if (!k) return '';
    var c = state.oem ? [state.oem[p]].concat((opties(state.oem) || []).map(function (x) { return x[p]; })) : [];
    for (var i = 0; i < c.length; i++) if (c[i] && tkey(parse(c[i])) === k) return c[i];
    return adviesKey(t) || (t.b + '/' + t.h + '-' + t.v);
  }
  function sel(p, f, name, vals, v) {
    var id = 'bm-' + p + '-' + f;
    return '<div class="field"><label for="' + id + '">' + name + '</label><select id="' + id + '" data-pos="' + p + '" data-f="' + f + '"><option value="">kies</option>' +
      vals.map(function (x) { return '<option value="' + x + '"' + (x === v ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></div>';
  }
  var state = { voor: parse(''), achter: parse(''), keuze: {}, zelf: {}, oem: null, ventielen: false, afvoeren: false };
  var VENTIELEN = 20, AFVOEREN = 5; // incl. btw: haakse ventielen per set (één keer per bestelling), afvoeren per band
  var HELP = {
    ventielen: 'Met haakse ventielen kom je veel makkelijker bij je ventiel om je bandenspanning te checken of bij te pompen, ook langs remschijf en remklauw. We checken eerst of ze op jouw velg passen; past het niet, dan betaal je niets.',
    afvoeren: 'Neem je oude band mee. Bij veel milieustraten lever je banden gratis in, check even wat jouw gemeente doet. Liever geen gedoe? Vink dit aan, dan voeren wij hem af voor €5 per band.'
  };
  function montage() { return data.montage_per_band || 50; }
  // Per gekozen band: richtprijs (vanaf(): formule uit banden.json), 'aanvraag' (geen inkoopprijs / geen advies) of 'kiezen' (nog geen band aangeklikt)
  // Assortiment voor deze maat (lijst banden) of null; keuze[p] = getal (advies) of 'z<n>' (zelf gekozen uit het assortiment)
  function zelfLijst(p) { var k = tkey(state[p]); return assort && k && assort.maten[k] && assort.maten[k].length ? assort.maten[k] : null; }
  function gekozen(p) {
    var k = state.keuze[p]; if (k == null) return null;
    if (typeof k === 'string') { var z = zelfLijst(p); return z && z[Number(k.slice(1))] || null; }
    var l = advies(state[p]); return l ? l[k] || null : null;
  }
  function pos() {
    return ['voor', 'achter'].filter(function (p) { return tkey(state[p]); }).map(function (p) {
      var l = advies(state[p]) || zelfLijst(p), t = gekozen(p), pr = t ? vanaf(t) : null;
      return { p: p, naam: p === 'voor' ? 'Voorband' : 'Achterband', maat: label(p), band: t, pr: pr, st: pr != null ? 'ok' : (l && !t ? 'kiezen' : 'aanvraag') };
    });
  }
  function wie(arr) { return arr.length === 2 ? 'voor- en achterband' : arr[0].naam.toLowerCase(); }
  // Overzicht (geen betaling, geen winkelwagen): regels + richtprijs. Ontbreekt een bandenprijs, dan tellen we de rest op
  // en zeggen we er duidelijk bij welke band(en) nog niet in het bedrag zitten.
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
    function cb(id, label) {
      return '<div class="field field--check bm__check"><input type="checkbox" id="bm-' + id + '"' + (state[id] ? ' checked' : '') + ' aria-describedby="bm-' + id + '-help">' +
        '<label for="bm-' + id + '">' + label + '</label><p class="bm__help" id="bm-' + id + '-help">' + esc(HELP[id]) + '</p></div>';
    }
    return '<fieldset class="bm__extras"><legend>Extra\'s</legend>' +
      cb('ventielen', 'Haakse ventielen (+€' + VENTIELEN + ' per set, als het past)') +
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
  function render(focus) {
    var s = OGMotor.get(), o = oem(s);
    var head;
    if (!s) head = '<p class="bm__intro">Kies hierboven eerst je motor. Dan vullen we de originele bandenmaten voor je in.</p>';
    else if (o && opties(o)) head = '<p class="bm__intro">Originele bandenmaten voor de <strong>' + esc(OGMotor.label(s)) + '</strong>.</p>';
    else if (o) head = '<p class="bm__intro">Originele bandenmaten voor de <strong>' + esc(OGMotor.label(s)) + '</strong>. Dit is een advies: staat er iets anders op je band of in je instructieboekje, pas het dan aan.</p>';
    else if (perUitvoering(s)) head = '<p class="bm__intro">Bij de <strong>' + esc(OGMotor.label(s)) + '</strong> verschillen de bandenmaten per uitvoering. Kies hierboven je uitvoering, of kies hieronder zelf de maat van je band. <a class="link" href="/banden/bandenmaat/">Zo lees je je bandenmaat →</a></p>';
    else head = '<p class="bm__intro">Van de <strong>' + esc(OGMotor.label(s)) + '</strong> hebben we de bandenmaten nog niet in onze lijst. Kies hieronder de maat van je band, of app ons, dan zoeken we het op. <a class="link" href="/banden/bandenmaat/">Zo lees je je bandenmaat →</a></p>';
    var id = s ? OGMotor.label(s) + '|' + (s.bouwjaar || '') : '';
    if (s && state.motor !== id) {
      state = { motor: id, oem: o, voor: parse(o && o.voor), achter: parse(o && o.achter), keuze: {}, zelf: {}, ventielen: state.ventielen, afvoeren: state.afvoeren };
    }
    box.innerHTML = head + (s ? optiesHTML() + '<div class="bm__maten">' + ['voor', 'achter'].map(function (p) {
      var t = state[p];
      return '<fieldset class="bm__maat"><legend>Bandenmaat ' + p + '</legend><div class="bm__sel">' +
        sel(p, 'b', 'Breedte', B, t.b) + sel(p, 'h', 'Hoogte', H, t.h) + sel(p, 'v', 'Velg (inch)', V, t.v) + '</div></fieldset>';
    }).join('') + '</div><div class="bm__lijst">' + ['voor', 'achter'].map(list).join('') + '</div>' + extrasHTML() + somHTML() +
      '<p class="note">Vanaf-prijs is per band, inclusief btw. Montage komt erbij: <strong>+ €' + (data.montage_per_band || 50) + ' montage per band</strong>.' +
      (data.prijzen_bijgewerkt ? ' Prijzen bijgewerkt op ' + esc(new Date(data.prijzen_bijgewerkt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })) + '.' : '') + '</p>' +
      '<div class="bm__cta"><a class="btn btn--wa" data-dienst="Banden" data-wa-intent="banden" href="https://wa.me/31642939555" target="_blank" rel="noopener"><svg class="ico" aria-hidden="true"><use href="#i-wa"/></svg>App ons over deze banden</a></div>' : '');
    box.querySelectorAll('[data-opt]').forEach(function (b) {
      b.addEventListener('click', function () {
        var x = opties(state.oem)[Number(b.getAttribute('data-opt'))];
        ['voor', 'achter'].forEach(function (p) { if (x[p]) { state[p] = parse(x[p]); delete state.keuze[p]; delete state.zelf[p]; } });
        render(b.id); save();
      });
    });
    box.querySelectorAll('.bm__sel select').forEach(function (el) {
      el.addEventListener('change', function () {
        var p = el.getAttribute('data-pos'); state[p][el.getAttribute('data-f')] = el.value; delete state.keuze[p]; delete state.zelf[p];
        render(el.id); save();
      });
    });
    box.querySelectorAll('.bm__opt input').forEach(function (r) {
      // advies (name bm-voor) en zelf kiezen (name bm-voor-z) zijn aparte radiogroepen, zodat je met Tab in beide lijsten komt; samen één keuze per positie
      r.addEventListener('change', function () {
        var p = r.getAttribute('data-pos');
        state.keuze[p] = /^z\d+$/.test(r.value) ? r.value : Number(r.value);
        box.querySelectorAll('.bm__opt input[data-pos="' + p + '"]').forEach(function (o) { if (o !== r) o.checked = false; });
        save(); updSom();
      });
    });
    box.querySelectorAll('.bm__zsel select').forEach(function (el) {
      el.addEventListener('change', function () {
        var p = el.getAttribute('data-pos'), z = state.zelf[p] = state.zelf[p] || { type: '', merk: '' };
        z[el.getAttribute('data-z')] = el.value;
        if (el.getAttribute('data-z') === 'type' && z.merk && !zelfFilter(p, z.type, z.merk).length) z.merk = '';
        render(el.id);
      });
    });
    ['ventielen', 'afvoeren'].forEach(function (id) {
      var c = document.getElementById('bm-' + id);
      if (c) c.addEventListener('change', function () { state[id] = c.checked; save(); updSom(); });
    });
    if (focus && document.getElementById(focus)) document.getElementById(focus).focus();
    save();
  }
  function updSom() { var b = box.querySelector('.bm__som'); if (b) b.outerHTML = somHTML(); }
  function list(p) {
    var t = state[p], naam = p === 'voor' ? 'Voorband' : 'Achterband';
    if (!tkey(t)) return '<fieldset class="bm__pos"><legend>' + naam + '</legend><p class="muted">Kies breedte, hoogte en velgmaat, dan tonen we ons advies.</p></fieldset>';
    var l = advies(t), maat = label(p);
    var kop = assort ? '<h4 class="bm__kop">Ons advies</h4>' : '', zelf = assort ? zelfHTML(p) : '';
    if (!l) return '<fieldset class="bm__pos"><legend>' + naam + ' ' + esc(maat) + '</legend>' + kop + '<p class="muted">Voor deze maat hebben we nog geen standaardadvies. App ons, dan adviseren we je persoonlijk.</p>' + zelf + '</fieldset>';
    return '<fieldset class="bm__pos"><legend>' + naam + ' ' + esc(maat) + '</legend>' + kop + '<ul class="bm__opts">' + l.map(function (t, i) {
      var pr = vanaf(t), id = 'bm-' + p + '-' + i;
      return '<li class="bm__opt"><input type="radio" name="bm-' + p + '" data-pos="' + p + '" id="' + id + '" value="' + i + '"' + (state.keuze[p] === i ? ' checked' : '') + '>' +
        '<label for="' + id + '"><span class="bm__soort">' + esc(SOORT[t.soort] || t.soort) + '</span><b>' + esc(t.merk + ' ' + t.band) + '</b><span class="bm__uitleg">' + esc(t.uitleg) + '</span>' +
        '<span class="bm__prijs">' + (pr ? 'vanaf €' + pr : 'prijs op aanvraag') + '</span></label></li>';
    }).join('') + '</ul>' + zelf + '</fieldset>';
  }
  // Zelf kiezen: type -> merk (A-merken / Budget) -> banden van dat merk/type in deze maat. Typen/merken die in deze maat
  // niet leverbaar zijn staan er uitgeschakeld bij (nooit een lege lijst). Diagonaal onder een radiale maat: gemarkeerd en onderaan.
  function typeInfo(id) { return (assort.types || []).filter(function (x) { return x[0] === id; })[0] || [id, id, '']; }
  function groepVan(merk) { return (assort.groepen || []).filter(function (g) { return g[1].indexOf(merk) !== -1; })[0] || null; }
  function radiaalPos(p) { return /\bZ?R\s*\d{2}\b/i.test(label(p)); }
  function zelfFilter(p, type, merk) {
    return (zelfLijst(p) || []).map(function (t, i) { return { t: t, i: i }; }).filter(function (x) { return (!type || x.t.type === type) && (!merk || x.t.merk === merk); });
  }
  function diagonaalPos(p) { // fabrieksmaat bekend en diagonaal (- of B)
    var k = tkey(state[p]), c = state.oem ? [state.oem[p]].concat((opties(state.oem) || []).map(function (x) { return x[p]; })) : [];
    for (var i = 0; i < c.length; i++) if (c[i] && tkey(parse(c[i])) === k) return !/\bZ?R\s*\d{2}\b/i.test(c[i]) && /\d\s*-\s*\d{2}\b|\bB\s*\d{2}\b/i.test(c[i]);
    return false;
  }
  function diag(p, t) { return (t.bouw === 'diagonaal' && radiaalPos(p)) || (t.bouw === 'radiaal' && diagonaalPos(p)); } // opbouw past niet
  function zelfHTML(p) {
    var z = state.zelf[p] || { type: '', merk: '' }, alle = zelfFilter(p, '', ''), id = 'bm-' + p;
    var h = '<div class="bm__zelf" role="group" aria-labelledby="' + id + '-zelf-kop"><h4 class="bm__kop" id="' + id + '-zelf-kop">Zelf kiezen</h4>';
    if (!alle.length) return h + '<p class="muted bm__leeg">Voor deze maat hebben we (nog) geen andere banden in onze lijst. App ons, dan zoeken we het voor je uit.</p></div>';
    var opt = function (v, txt, cur, off) { return '<option value="' + esc(v) + '"' + (v === cur && !off ? ' selected' : '') + (off ? ' disabled' : '') + '>' + esc(txt) + '</option>'; };
    var tOpts = assort.types.map(function (t) {
      var n = zelfFilter(p, t[0], '').length;
      return opt(t[0], t[1] + (n ? '' : ' – dit type is niet leverbaar in jouw maat'), z.type, !n);
    }).join('');
    var mOpts = z.type ? assort.groepen.map(function (g) {
      return '<optgroup label="' + esc(g[0]) + '">' + g[1].map(function (mk) {
        var n = zelfFilter(p, z.type, mk).length;
        return opt(mk, mk + (n ? '' : ' – niet leverbaar in jouw maat'), z.merk, !n);
      }).join('') + '</optgroup>';
    }).join('') : '';
    var ti = z.type ? typeInfo(z.type) : null, gi = z.merk ? groepVan(z.merk) : null;
    h += '<div class="bm__zsel"><div class="field"><label for="' + id + '-type">Type band</label><select id="' + id + '-type" data-pos="' + p + '" data-z="type"' + (ti && ti[2] ? ' aria-describedby="' + id + '-type-help"' : '') + '>' + opt('', 'kies type', z.type) + tOpts + '</select>' +
      (ti && ti[2] ? '<p class="bm__help" id="' + id + '-type-help">' + esc(ti[2]) + '</p>' : '') + '</div>' +
      '<div class="field"><label for="' + id + '-merk">Merk</label><select id="' + id + '-merk" data-pos="' + p + '" data-z="merk"' + (z.type ? '' : ' disabled') + (gi && gi[2] ? ' aria-describedby="' + id + '-merk-help"' : '') + '>' + opt('', z.type ? 'kies merk' : 'kies eerst een type', z.merk) + mOpts + '</select>' +
      (gi && gi[2] ? '<p class="bm__help" id="' + id + '-merk-help"><b>' + esc(gi[0]) + ':</b> ' + esc(gi[2]) + '</p>' : '') + '</div></div>';
    var l = z.type && z.merk ? zelfFilter(p, z.type, z.merk) : [];
    if (!l.length) return h + '<p class="muted bm__hint">Kies een type en een merk, dan zie je de banden met hun richtprijs.</p></div>';
    l.sort(function (a, b) { return (diag(p, a.t) ? 1 : 0) - (diag(p, b.t) ? 1 : 0); });
    return h + '<ul class="bm__opts bm__zopts">' + l.map(function (x) {
      var pr = vanaf(x.t), rid = id + '-z' + x.i;
      return '<li class="bm__opt bm__zopt"><input type="radio" name="bm-' + p + '-z" data-pos="' + p + '" id="' + rid + '" value="z' + x.i + '"' + (state.keuze[p] === 'z' + x.i ? ' checked' : '') + '>' +
        '<label for="' + rid + '"><span class="bm__soort">' + esc(typeInfo(x.t.type)[1]) + '</span><b>' + esc(x.t.merk + ' ' + x.t.band) + '</b>' +
        (x.t.notatie ? '<span class="bm__notatie">' + esc(x.t.notatie) + (x.t.bouw ? ' · ' + x.t.bouw : '') + '</span>' : '') +
        (diag(p, x.t) ? '<span class="bm__let">' + (x.t.bouw === 'radiaal' ? 'Radiaal' : 'Diagonaal') + ', check of dit past</span>' : '') +
        (x.t.uitleg ? '<span class="bm__uitleg">' + esc(x.t.uitleg) + '</span>' : '') +
        '<span class="bm__prijs">' + (pr ? 'vanaf €' + pr : 'prijs op aanvraag') + '</span></label></li>';
    }).join('') + '</ul></div>';
  }
  // Naam van de gekozen band zoals in overzicht/WhatsApp: bij zelf gekozen met echte maat en evt. 'diagonaal'
  function bandNaam(p, t) {
    var zelf = typeof state.keuze[p] === 'string';
    return t.merk + ' ' + t.band + (zelf && t.notatie ? ' (' + t.notatie + (diag(p, t) ? ', ' + t.bouw : '') + ')' : '');
  }
  // Bandeninfo naar de gedeelde staat (OGMotor.klus) → komt in het WhatsApp-bericht
  function save() {
    if (!OGMotor.get()) return;
    var parts = [], min = null;
    ['voor', 'achter'].forEach(function (p) {
      if (!tkey(state[p])) return;
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
  // Assortiment is optioneel: lukt het laden niet, dan werkt het menu gewoon met alleen het advies
  var pa = AURL ? fetch(new URL(AURL, location.href).href, { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }) : Promise.resolve(null);
  function assortOk(a) { return a && a.maten && typeof a.maten === 'object' && Array.isArray(a.types) && Array.isArray(a.groepen) ? a : null; }
  fetch(URL_, { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (d) { data = d; return pa; }).then(function (a) { assort = assortOk(a); return OGMotor.load(); })
    .then(function () { render(); OGMotor.on(function () { render(); }); })
    .catch(function () { box.innerHTML = '<p class="bm__intro">Het bandenmenu kon niet laden. App ons je motor en bandenmaat, dan helpen we je verder.</p>'; });
  window.OGBanden = { vanaf: function (inkoop) { return data ? vanaf({ inkoop_excl_btw: inkoop }) : null; }, state: function () { return state; }, assortiment: function () { return !!assort; } };
})();
