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
  function adviesKey(t) {
    var k = tkey(t), hit = null; if (!k) return null;
    Object.keys(data.advies).forEach(function (m) { if (!hit && tkey(parse(m)) === k) hit = m; });
    return hit;
  }
  function advies(t) { var k = adviesKey(t); return k ? data.advies[k] : null; }
  // Weergave: OEM-notatie als die gekozen is, anders de notatie uit het advies, anders 120/70-17
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
  var state = { voor: parse(''), achter: parse(''), keuze: {}, oem: null, ventielen: false, afvoeren: false };
  var VENTIELEN = 20, AFVOEREN = 5; // incl. btw: haakse ventielen per set (één keer per bestelling), afvoeren per band
  var HELP = {
    ventielen: 'Met haakse ventielen kom je veel makkelijker bij je ventiel om je bandenspanning te checken of bij te pompen, ook langs remschijf en remklauw. We checken eerst of ze op jouw velg passen; past het niet, dan betaal je niets.',
    afvoeren: 'Neem je oude band mee. Bij veel milieustraten lever je banden gratis in, check even wat jouw gemeente doet. Liever geen gedoe? Vink dit aan, dan voeren wij hem af voor €5 per band.'
  };
  function montage() { return data.montage_per_band || 50; }
  // Per gekozen band: richtprijs (vanaf(): formule uit banden.json), 'aanvraag' (geen inkoopprijs / geen advies) of 'kiezen' (nog geen band aangeklikt)
  function pos() {
    return ['voor', 'achter'].filter(function (p) { return tkey(state[p]); }).map(function (p) {
      var l = advies(state[p]), t = l && state.keuze[p] != null ? l[state.keuze[p]] : null, pr = t ? vanaf(t) : null;
      return { p: p, naam: p === 'voor' ? 'Voorband' : 'Achterband', maat: label(p), band: t, pr: pr, st: pr != null ? 'ok' : (l && !t ? 'kiezen' : 'aanvraag') };
    });
  }
  function wie(arr) { return arr.length === 2 ? 'voor- en achterband' : arr[0].naam.toLowerCase(); }
  // Overzicht (geen betaling, geen winkelwagen): regels + richtprijs. Ontbreekt een bandenprijs, dan tellen we de rest op
  // en zeggen we er duidelijk bij welke band(en) nog niet in het bedrag zitten.
  function som() {
    var ps = pos(), n = ps.length, m = montage(), regels = [], tot = 0;
    ps.forEach(function (x) {
      regels.push([x.naam + ' ' + x.maat + (x.band ? ' · ' + x.band.merk + ' ' + x.band.band : ' (kies een band)'), x.st === 'ok' ? '€' + x.pr : (x.st === 'kiezen' ? 'nog kiezen' : 'prijs op aanvraag')]);
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
    else if (o) head = '<p class="bm__intro">Originele bandenmaten voor de <strong>' + esc(OGMotor.label(s)) + '</strong>. Dit is een advies: staat er iets anders op je band of in je instructieboekje, pas het dan aan.</p>';
    else if (perUitvoering(s)) head = '<p class="bm__intro">Bij de <strong>' + esc(OGMotor.label(s)) + '</strong> verschillen de bandenmaten per uitvoering. Kies hierboven je uitvoering, of kies hieronder zelf de maat van je band. <a class="link" href="/banden/bandenmaat/">Zo lees je je bandenmaat →</a></p>';
    else head = '<p class="bm__intro">Van de <strong>' + esc(OGMotor.label(s)) + '</strong> hebben we de bandenmaten nog niet in onze lijst. Kies hieronder de maat van je band, of app ons, dan zoeken we het op. <a class="link" href="/banden/bandenmaat/">Zo lees je je bandenmaat →</a></p>';
    var id = s ? OGMotor.label(s) + '|' + (s.bouwjaar || '') : '';
    if (s && state.motor !== id) {
      state = { motor: id, oem: o, voor: parse(o && o.voor), achter: parse(o && o.achter), keuze: {}, ventielen: state.ventielen, afvoeren: state.afvoeren };
    }
    box.innerHTML = head + (s ? '<div class="bm__maten">' + ['voor', 'achter'].map(function (p) {
      var t = state[p];
      return '<fieldset class="bm__maat"><legend>Bandenmaat ' + p + '</legend><div class="bm__sel">' +
        sel(p, 'b', 'Breedte', B, t.b) + sel(p, 'h', 'Hoogte', H, t.h) + sel(p, 'v', 'Velg (inch)', V, t.v) + '</div></fieldset>';
    }).join('') + '</div><div class="bm__lijst">' + ['voor', 'achter'].map(list).join('') + '</div>' + extrasHTML() + somHTML() +
      '<p class="note">Vanaf-prijs is per band, inclusief btw. Montage komt erbij: <strong>+ €' + (data.montage_per_band || 50) + ' montage per band</strong>.' +
      (data.prijzen_bijgewerkt ? ' Prijzen bijgewerkt op ' + esc(new Date(data.prijzen_bijgewerkt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })) + '.' : '') + '</p>' +
      '<div class="bm__cta"><a class="btn btn--wa" data-dienst="Banden" data-wa-intent="banden" href="https://wa.me/31642939555" target="_blank" rel="noopener"><svg class="ico" aria-hidden="true"><use href="#i-wa"/></svg>App ons over deze banden</a></div>' : '');
    box.querySelectorAll('.bm__sel select').forEach(function (el) {
      el.addEventListener('change', function () {
        var p = el.getAttribute('data-pos'); state[p][el.getAttribute('data-f')] = el.value; delete state.keuze[p];
        render(el.id); save();
      });
    });
    box.querySelectorAll('.bm__opt input').forEach(function (r) {
      r.addEventListener('change', function () { state.keuze[r.name.slice(3)] = Number(r.value); save(); updSom(); });
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
    if (!l) return '<fieldset class="bm__pos"><legend>' + naam + ' ' + esc(maat) + '</legend><p class="muted">Voor deze maat hebben we nog geen standaardadvies. App ons, dan adviseren we je persoonlijk.</p></fieldset>';
    return '<fieldset class="bm__pos"><legend>' + naam + ' ' + esc(maat) + '</legend><ul class="bm__opts">' + l.map(function (t, i) {
      var pr = vanaf(t), id = 'bm-' + p + '-' + i;
      return '<li class="bm__opt"><input type="radio" name="bm-' + p + '" id="' + id + '" value="' + i + '"' + (state.keuze[p] === i ? ' checked' : '') + '>' +
        '<label for="' + id + '"><span class="bm__soort">' + esc(SOORT[t.soort] || t.soort) + '</span><b>' + esc(t.merk + ' ' + t.band) + '</b><span class="bm__uitleg">' + esc(t.uitleg) + '</span>' +
        '<span class="bm__prijs">' + (pr ? 'vanaf €' + pr : 'prijs op aanvraag') + '</span></label></li>';
    }).join('') + '</ul></fieldset>';
  }
  // Bandeninfo naar de gedeelde staat (OGMotor.klus) → komt in het WhatsApp-bericht
  function save() {
    if (!OGMotor.get()) return;
    var parts = [], min = null;
    ['voor', 'achter'].forEach(function (p) {
      if (!tkey(state[p])) return;
      var l = advies(state[p]), t = l && state.keuze[p] != null ? l[state.keuze[p]] : null, pr = t ? vanaf(t) : null;
      if (pr != null) min = min == null ? pr : Math.min(min, pr);
      parts.push(p + ' ' + label(p) + (t ? ' ' + t.merk + ' ' + t.band + ' (' + (pr ? 'vanaf €' + pr : 'prijs op aanvraag') + ')' : ''));
    });
    var x = som(), k = OGMotor.klus.get();
    k.banden = (parts.join('; ') + (parts.length ? ' + €' + montage() + ' montage per band' : '')).replace(/^; /, '');
    k.bandPrijs = min;
    k.bandExtra = { ventielen: !!state.ventielen, afvoeren: !!state.afvoeren, aantal: x.n, totaal: x.totaal, compleet: x.compleet, regels: x.regels, tekst: x.tekst };
    OGMotor.klus.set(k);
  }
  fetch(URL_, { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (d) { data = d; return OGMotor.load(); })
    .then(function () { render(); OGMotor.on(function () { render(); }); })
    .catch(function () { box.innerHTML = '<p class="bm__intro">Het bandenmenu kon niet laden. App ons je motor en bandenmaat, dan helpen we je verder.</p>'; });
  window.OGBanden = { vanaf: function (inkoop) { return data ? vanaf({ inkoop_excl_btw: inkoop }) : null; }, state: function () { return state; } };
})();
