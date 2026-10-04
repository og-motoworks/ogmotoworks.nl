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
  var T = OGMotor.T, I18N = OGMotor.i18n; // taal: zie motor.js (EN-pagina's laden assets/js/i18n-en.js; data-teksten staan ook in dat woordenboek)
  var src = document.currentScript && document.currentScript.src || location.href;
  var URL_ = new URL('../data/banden.json', src).href, data = null;
  var AURL = box.getAttribute('data-assortiment'), assort = null;
  var ZICHTBAAR = 4; // regels per positie zonder 'Meer tonen' (voor + achter = 8)
  var NL = T('niet leverbaar in jouw maat');
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  // Keuzelijsten: gangbare motorbandmaten (breedte mm, hoogte = % van de breedte, velg inch) + opbouw (R/ZR radiaal, - diagonaal, B diagonaal met gordel)
  var B = range(60, 210, 10).concat(['240', '250', '260', '280', '300', '330', '360']), H = range(30, 100, 5), V = range(10, 21, 1).concat(['23']);
  var O = [['ZR', 'ZR'], ['R', 'R'], ['-', T('- / geen')], ['B', 'B']];
  var FOUT = T('Deze bandenmaat bestaat niet, check de maat op de zijkant van je band.');
  // Bestaat deze combinatie bij motorbanden? Hoogte per breedteklasse (bv. 60/60-17 bestaat niet, 60/100-17 wel); radiaal pas vanaf 90 breed.
  function maatGeldig(t) {
    var b = Number(t.b), h = Number(t.h), v = Number(t.v), o = t.o || '';
    if (B.indexOf(String(t.b)) === -1 || H.indexOf(String(t.h)) === -1 || V.indexOf(String(t.v)) === -1) return false;
    var hk = b <= 80 ? [80, 100] : b <= 100 ? [60, 100] : b <= 130 ? [60, 90] : b <= 160 ? [55, 90] : b <= 200 ? [50, 80] : [30, 55];
    if (h < hk[0] || h > hk[1]) return false;
    if (v <= 13 && (b > 160 || h < 60)) return false;   // scootervelgen: smal en hoog
    if (v >= 21 && (b > 130 || h < 60)) return false;   // 21 en 23 inch: smalle voorbanden
    if ((o === 'R' || o === 'ZR') && (b < 90 || h > 90)) return false;
    if (o === 'ZR' && (b < 100 || h > 80)) return false;
    return true;
  }
  function range(a, z, st) { var r = []; for (var i = a; i <= z; i += st) r.push(String(i)); return r; }
  function parse(m) {
    var x = /(\d{2,3})\s*\/\s*(\d{2,3})\s*(-)?\s*(ZR|R|B)?\s*-?\s*(\d{2})/i.exec(String(m || ''));
    return x ? { b: x[1], h: x[2], v: String(Number(x[5])), o: x[4] ? x[4].toUpperCase() : x[3] ? '-' : '' } : { b: '', h: '', v: '', o: '' };
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
  // Meerdere fabrieksmaten voor één generatie (banden.json 'opties'): de klant kiest, niets vooraf gekozen.
  // Optie met voor én achter = maatpaar (zoals de bron het geeft); optie met één positie = los te kiezen.
  function opties(o) { return o && Array.isArray(o.opties) && o.opties.length ? o.opties : null; }
  function optAan(x) { return POS.every(function (p) { if (!x[p]) return true; var t = parse(x[p]); return tkey(t) === tkey(state[p]) && t.o === (state[p].o || ''); }); }
  function optTxt(x) { var m = POS.filter(function (p) { return x[p]; }); return (x.naam ? x.naam + ': ' : '') + (m.length === 2 ? T('voor {v} + achter {a}', { v: x.voor, a: x.achter }) : x[m[0]]); }
  function optiesHTML() {
    var op = opties(state.oem); if (!op) return '';
    var paren = [], los = { voor: [], achter: [] };
    op.forEach(function (x, i) { if (x.voor && x.achter) paren.push(i); else POS.forEach(function (p) { if (x[p]) los[p].push(i); }); });
    function rij(kop, idx) {
      if (!idx.length) return '';
      return '<div class="bm__optrij"><span class="bm__optlab" id="bm-opt-' + kop[0] + '">' + kop[1] + '</span><div class="bm__optk" role="group" aria-labelledby="bm-opt-' + kop[0] + '">' +
        idx.map(function (i) { return '<button type="button" class="bm__chip bm__opt" id="bm-opt-' + i + '" data-opt="' + i + '" aria-pressed="' + optAan(op[i]) + '">' + esc(optTxt(op[i])) + '</button>'; }).join('') + '</div></div>';
    }
    return '<div class="bm__opties" id="bm-opties"><p class="bm__optkop">' + T('<strong>Voor deze motor bestaan meerdere bandenmaten.</strong> Kies hieronder je maat.') + '</p>' +
      rij(['paar', T('Voor + achter')], paren) + rij(['voor', T('Voorband')], los.voor) + rij(['achter', T('Achterband')], los.achter) +
      '<p class="bm__opttip">' + T('Check de maat op de zijkant van je huidige band; afwijken mag, vraag ons gerust.') + '</p></div>';
  }
  function optUpd() { box.querySelectorAll('[data-opt]').forEach(function (b) { var x = (opties(state.oem) || [])[Number(b.getAttribute('data-opt'))]; if (x) b.setAttribute('aria-pressed', String(optAan(x))); }); }
  function adviesKey(t) {
    var k = tkey(t), hit = null; if (!k) return null;
    Object.keys(data.advies || {}).forEach(function (m) { if (!hit && tkey(parse(m)) === k) hit = m; });
    return hit;
  }
  function label(p) {
    var t = state[p], k = tkey(t); if (!k) return '';
    var c = state.oem ? [state.oem[p]].concat((opties(state.oem) || []).map(function (x) { return x[p]; })) : [];
    for (var i = 0; i < c.length; i++) if (c[i] && tkey(parse(c[i])) === k && parse(c[i]).o === (t.o || '')) return c[i];
    if (t.o) return t.b + '/' + t.h + (t.o === '-' ? '-' : ' ' + t.o) + t.v;
    return adviesKey(t) || (t.b + '/' + t.h + '-' + t.v);
  }
  function sel(p, f, name, vals, v) {
    var id = 'bm-' + p + '-' + f;
    return '<div class="field"><label for="' + id + '">' + name + '</label><select id="' + id + '" data-pos="' + p + '" data-f="' + f + '"><option value="">' + T('kies') + '</option>' +
      vals.map(function (x) { var w = Array.isArray(x) ? x : [x, x]; return '<option value="' + w[0] + '"' + (w[0] === v ? ' selected' : '') + '>' + w[1] + '</option>'; }).join('') + '</select></div>';
  }
  var state = { voor: parse(''), achter: parse(''), keuze: {}, oem: null, f: { merk: '', type: '', q: '' }, meer: {}, ventielen: false, afvoeren: false };
  var VENTIELEN = 20, AFVOEREN = 5;
  var HELP = {
    ventielen: T('Met haakse ventielen kom je veel makkelijker bij je ventiel om je bandenspanning te checken of bij te pompen, ook langs remschijf en remklauw. We checken eerst of ze op jouw velg passen; past het niet, dan betaal je niets.'),
    afvoeren: T('Neem je oude band mee. Bij veel milieustraten lever je banden gratis in, check even wat jouw gemeente doet. Liever geen gedoe? Vink dit aan, dan voeren wij hem af voor €5 per band.')
  };
  function montage() { return data.montage_per_band || 50; }
  var POS = ['voor', 'achter'];
  function posNaam(p) { return p === 'voor' ? T('Voorband') : T('Achterband'); }

  // ---------- assortiment ----------
  // Lijst voor een positie: banden uit het assortiment; zonder assortiment de 3 adviesbanden uit banden.json (zonder filters)
  function lijst(p) {
    var k = tkey(state[p]); if (!k) return [];
    if (assort) return assort.maten[k] || [];
    var a = adviesKey(state[p]); return a ? data.advies[a] : [];
  }
  function gekozen(p) { var k = state.keuze[p]; return k == null ? null : lijst(p)[k] || null; }
  function typeInfo(id) { return (assort && assort.types || []).filter(function (x) { return x[0] === id; })[0] || [id, id, '']; }
  function typeNaam(id) { return id ? T(typeInfo(id)[1]) : ''; }
  function typeKort(id) { return id === 'hypersport' ? 'hypersport' : typeNaam(id).toLowerCase(); } // 'Advies hypersport'
  function radiaalPos(p) { return /\bZ?R\s*\d{2}\b/i.test(label(p)); }
  // fabrieksmaat met B = diagonaal met gordel. '-' telt NIET: in typegoedkeuringen betekent '-' vaak 'opbouw niet vastgelegd'
  // (Michelin keurt daar ook radiale banden voor goed, bv. 120/70-19 Zero DSR/X, 90/90-21 KTM 990 Adventure)
  function diagonaalPos(p) { return (state[p] && state[p].o) === 'B'; }
  // opbouw past niet: diagonaal onder een radiale maat of radiaal onder een diagonale maat (gemarkeerd, onderaan, nooit advies)
  function diag(p, t) { return (t.bouw === 'diagonaal' && radiaalPos(p)) || (t.bouw === 'radiaal' && diagonaalPos(p)); }
  function letTekst(t) { return t.bouw === 'radiaal' ? T('Radiaal, check of dit past') : T('Diagonaal, check of dit past'); }
  function naamKey(t) { return (t.merk + '|' + t.band).toLowerCase(); }
  function zoekNorm(s) { return String(s || '').toLowerCase().replace(/[\s\-_.]+/g, ''); }
  function past(t, f) {
    return (!f.merk || t.merk === f.merk) && (!f.type || t.type === f.type) && (!f.q || zoekNorm(t.merk + ' ' + t.band).indexOf(zoekNorm(f.q)) !== -1);
  }
  function actievePos() { return POS.filter(function (p) { return tkey(state[p]) && maatGeldig(state[p]); }); } // ongeldige maat telt nergens mee (lijst, advies, overzicht, WhatsApp)
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
    return A.categorie[c] ? { id: c, wie: A.categorie[c].wie, waarom: A.categorie[c].waarom || '', types: A.categorie[c].types, voorkeur: A.categorie[c].voorkeur || {} } : null;
  }
  function vkLijst(c, type) { // eigen voorkeur van de categorie gaat voor; 'niet_aanraden' (slecht in een onafhankelijke test) is nooit het advies
    var A = assort && assort.advies, na = ((A && A.niet_aanraden) || []).map(function (x) { return x.toLowerCase(); });
    return ((c && c.voorkeur && c.voorkeur[type]) || ((A && A.voorkeur) || {})[type] || []).filter(function (x) { return na.indexOf(x.toLowerCase()) === -1; });
  }
  function adviesBerekenen() {
    var c = categorie(), ps = actievePos().filter(function (p) { return lijst(p).length; }), A = assort && assort.advies; // posities zonder banden in de lijst tellen niet mee
    if (!c || !ps.length) return null;
    function vind(p, key) {
      var l = lijst(p);
      for (var i = 0; i < l.length; i++) if (naamKey(l[i]) === key && !diag(p, l[i])) return i;
      return -1;
    }
    for (var ti = 0; ti < c.types.length; ti++) {
      var type = c.types[ti], vk = vkLijst(c, type).map(function (x) { return x.toLowerCase(); });
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
  function wie(arr) { return arr.length === 2 ? T('voor- en achterband') : arr[0].naam.toLowerCase(); }
  function bandNaam(p, t) { return t.merk + ' ' + t.band + (t.notatie ? ' (' + t.notatie + (diag(p, t) ? ', ' + T(t.bouw) : '') + ')' : ''); }
  function som() {
    var ps = pos(), n = ps.length, m = montage(), regels = [], tot = 0;
    ps.forEach(function (x) {
      regels.push([x.naam + ' ' + x.maat + (x.band ? ' · ' + bandNaam(x.p, x.band) : T(' (kies een band)')), x.st === 'ok' ? '€' + x.pr : (x.st === 'kiezen' ? T('nog kiezen') : T('prijs op aanvraag'))]);
      if (x.st === 'ok') tot += x.pr;
    });
    if (n) { regels.push([T('Montage {n} × €{m}', { n: n, m: m }), '€' + m * n]); tot += m * n; }
    if (n && state.ventielen) { regels.push([T('Haakse ventielen (als het past), per set'), '€' + VENTIELEN]); tot += VENTIELEN; }
    if (n && state.afvoeren) { regels.push([T('Oude band afvoeren {n} × €{m}', { n: n, m: AFVOEREN }), '€' + AFVOEREN * n]); tot += AFVOEREN * n; }
    var aan = ps.filter(function (x) { return x.st === 'aanvraag'; }), kies = ps.filter(function (x) { return x.st === 'kiezen'; });
    var tekst = n ? RP + ': €' + tot + (aan.length ? ' + ' + wie(aan) + ' ' + T('prijs op aanvraag') : '') + (kies.length ? ' + ' + wie(kies) + ' ' + T('nog kiezen') : '') : '';
    return { n: n, regels: regels, totaal: n ? tot : null, compleet: n > 0 && !aan.length && !kies.length, tekst: tekst };
  }
  var DEF = T('Definitieve prijs na check in de offerte.'), RP = T('Richtprijs'); // RP: begin van de overzichtstekst (motor.js accepteert NL en EN)
  function extrasHTML() {
    function cb(id, lab) {
      return '<div class="field field--check bm__check"><input type="checkbox" id="bm-' + id + '"' + (state[id] ? ' checked' : '') + ' aria-describedby="bm-' + id + '-help">' +
        '<label for="bm-' + id + '">' + lab + '</label><p class="bm__help" id="bm-' + id + '-help">' + esc(HELP[id]) + '</p></div>';
    }
    return '<fieldset class="bm__extras"><legend>' + T('Extra\'s') + '</legend>' + cb('ventielen', T('Haakse ventielen (+€{p} per set, als het past)', { p: VENTIELEN })) +
      cb('afvoeren', T('Wij voeren je oude band af (+€{p} per band)', { p: AFVOEREN })) + '</fieldset>';
  }
  function somHTML() {
    var x = som();
    var body = !x.n ? '<p class="muted">' + T('Kies je bandenmaat, dan zie je hier je overzicht.') + '</p>' :
      '<ul>' + x.regels.map(function (r) { return '<li><span>' + esc(r[0]) + '</span><b>' + esc(r[1]) + '</b></li>'; }).join('') + '</ul>' +
      '<p class="bm__totaal">' + RP + ': <b>€' + x.totaal + '</b>' + esc(x.tekst.replace(/^[^:]+: €\d+/, '')) + '</p>' +
      '<p class="bm__def">' + T('Alle bedragen incl. btw.') + ' ' + DEF + '</p>';
    return '<div class="bm__som" aria-live="polite"><h3>' + T('Overzicht') + '</h3><p class="bm__sub">' + T('Dit gaat mee in je bericht aan ons. Je betaalt nu niets.') + '</p>' + body + '</div>';
  }
  function save() {
    if (!OGMotor.get()) return;
    var parts = [], min = null;
    actievePos().forEach(function (p) {
      var t = gekozen(p), pr = t ? vanaf(t) : null;
      if (pr != null) min = min == null ? pr : Math.min(min, pr);
      parts.push(T(p) + ' ' + label(p) + (t ? ' ' + bandNaam(p, t) + ' (' + (pr ? T('vanaf €{p}', { p: pr }) : T('prijs op aanvraag')) + ')' : ''));
    });
    var x = som(), k = OGMotor.klus.get();
    k.banden = (parts.join('; ') + (parts.length ? T(' + €{m} montage per band', { m: montage() }) : '')).replace(/^; /, '');
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
      esc(txt) + (isAdv ? '<span class="bm__badge">' + T('Advies') + '</span>' : '') + (ok ? '' : '<span class="sr-only"> – ' + NL + '</span>') + '</button>';
  }
  function filtersHTML() {
    if (!assort) return '';
    var m = assort.groepen.map(function (g) { return '<span class="bm__glab">' + esc(T(g[0])) + '</span>' + g[1].map(function (mk) { return chip('merk', mk, mk); }).join(''); }).join('');
    var t = assort.types.map(function (x) { return chip('type', x[0], T(x[1])); }).join('');
    var actief = state.f.merk || state.f.type || state.f.q;
    return '<div class="bm__frow"><div class="bm__fkop" id="bm-f-merk-kop">' + T('Merk') + ' ' + info('merk', T('Uitleg over A-merken en budgetmerken')) + '</div><div class="bm__chips" role="group" aria-labelledby="bm-f-merk-kop">' + m + '</div></div>' +
      '<div class="bm__frow"><div class="bm__fkop" id="bm-f-type-kop">' + T('Type') + ' ' + info('type', T('Uitleg over de soorten banden')) + '</div><div class="bm__chips" role="group" aria-labelledby="bm-f-type-kop">' + t + '</div></div>' +
      '<p class="bm__fnote"><span>' + T('Grijs') + ' = ' + NL + '.</span>' + (actief ? ' <button type="button" class="bm__reset" data-reset>' + T('Alles tonen') + '</button>' : '') + '</p>';
  }
  function rij(p, t, i, isAdv) {
    var pr = vanaf(t), id = 'bm-' + p + '-z' + i, d = diag(p, t);
    var meta = [typeNaam(t.type), t.notatie || ''].filter(Boolean).join(' · ');
    return '<li class="bm__row' + (isAdv ? ' is-adv' : '') + (d ? ' is-diag' : '') + '">' +
      '<input type="radio" name="bm-' + p + '" data-pos="' + p + '" id="' + id + '" value="' + i + '"' + (state.keuze[p] === i ? ' checked' : '') + '>' +
      '<label for="' + id + '"><span class="bm__rn">' + (isAdv ? '<span class="bm__adv">' + esc(T('Advies {type}', { type: typeKort(t.type) })) + '</span>' : '') + '<b>' + esc(t.merk + ' ' + t.band) + '</b></span>' +
      (meta ? '<span class="bm__rm">' + esc(meta) + '</span>' : '') + (d ? '<span class="bm__let">' + letTekst(t) + '</span>' : '') + '</label>' +
      '<span class="bm__rp">' + (pr ? '€' + pr : T('op aanvraag')) + '</span>' +
      (isAdv ? info('adv-' + p, T('Waarom adviseren we de {band}?', { band: t.merk + ' ' + t.band })) : (t.uitleg && t.bron ? info('band-' + p + '-' + i, T('Over de {band}', { band: t.merk + ' ' + t.band })) : '<span class="bm__i0"></span>')) + '</li>';
  }
  function lijstHTML(p) {
    var naam = posNaam(p);
    if (!tkey(state[p])) return '<section class="bm__pos" aria-label="' + naam + '"><h3 class="bm__ph">' + naam + '</h3><p class="muted">' + T('Kies breedte, hoogte en velgmaat, dan tonen we de banden.') + '</p></section>';
    if (!maatGeldig(state[p])) return '<section class="bm__pos" aria-label="' + naam + '"><h3 class="bm__ph">' + naam + ' <span>' + esc(label(p)) + '</span></h3><p class="muted">' + FOUT + '</p></section>';
    var l = lijst(p), maat = label(p), kop = '<h3 class="bm__ph" id="bm-' + p + '-kop">' + naam + ' <span>' + esc(maat) + '</span></h3>';
    if (!l.length) return '<section class="bm__pos" aria-labelledby="bm-' + p + '-kop">' + kop + '<p class="muted bm__nietstd">' + T('Deze maat zit niet in ons standaardassortiment, we zoeken hem voor je op. App ons gerust.') + '</p></section>';
    var ai = adv && adv.idx[p] != null ? adv.idx[p] : -1;
    var items = l.map(function (t, i) { return { t: t, i: i }; }).filter(function (x) { return !assort || past(x.t, state.f); });
    var to = assort ? assort.types.map(function (x) { return x[0]; }) : [], mo = assort ? [].concat.apply([], assort.groepen.map(function (g) { return g[1]; })) : [];
    // volgorde: advies, dan (niet-diagonaal) de voorkeursmodellen uit de adviesregels voor deze motor, dan hetzelfde type, dan de rest; diagonaal onder radiaal onderaan
    var rank = {};
    if (adv && assort.advies) adv.cat.types.forEach(function (ty, ti) { vkLijst(adv.cat, ty).forEach(function (x, j) { var k = x.toLowerCase(); if (rank[k] == null) rank[k] = ti * 100 + j; }); });
    var rk = function (t) { var r = rank[naamKey(t)]; return r == null ? 1e4 : r; };
    if (assort) items.sort(function (a, b) { // zonder assortiment: volgorde van banden.json (zuinig, allround, sportief)
      return (a.i === ai ? 0 : 1) - (b.i === ai ? 0 : 1) || (diag(p, a.t) ? 1 : 0) - (diag(p, b.t) ? 1 : 0) || rk(a.t) - rk(b.t) ||
        (adv && a.t.type === adv.type ? 0 : 1) - (adv && b.t.type === adv.type ? 0 : 1) || to.indexOf(a.t.type) - to.indexOf(b.t.type) ||
        mo.indexOf(a.t.merk) - mo.indexOf(b.t.merk) || (a.t.band < b.t.band ? -1 : a.t.band > b.t.band ? 1 : 0);
    });
    if (!items.length) {
      var w = [state.f.merk, state.f.type ? typeKort(state.f.type) : ''].filter(Boolean).join(' ');
      var zonderZoek = l.some(function (t) { return past(t, { merk: state.f.merk, type: state.f.type, q: '' }); });
      var msg = !zonderZoek ? esc(w) + ': ' + NL + '.' : T('Geen band gevonden met “{q}”', { q: esc(state.f.q) }) + (w ? T(' bij {w}', { w: esc(w) }) : '') + T(' in deze maat.');
      return '<section class="bm__pos" aria-labelledby="bm-' + p + '-kop">' + kop + '<p class="muted bm__leeg">' + msg + '</p></section>';
    }
    var meer = !!state.meer[p], n = items.length, zicht = meer ? items : items.slice(0, ZICHTBAAR);
    if (!meer && state.keuze[p] != null && zicht.every(function (x) { return x.i !== state.keuze[p]; })) {
      var gk = items.filter(function (x) { return x.i === state.keuze[p]; })[0]; if (gk) zicht = zicht.slice(0, ZICHTBAAR - 1).concat([gk]);
    }
    return '<section class="bm__pos" aria-labelledby="bm-' + p + '-kop">' + kop + '<ul class="bm__rows">' + zicht.map(function (x) { return rij(p, x.t, x.i, x.i === ai); }).join('') + '</ul>' +
      (n > ZICHTBAAR ? '<button type="button" class="bm__meer" data-meer="' + p + '" aria-expanded="' + meer + '">' + (meer ? T('Minder tonen') : T('Meer tonen (nog {n})', { n: n - zicht.length })) + '</button>' : '') + '</section>';
  }
  function keuzeHTML() { return '<div class="bm__filters" aria-label="' + T('Filter op merk en type') + '">' + filtersHTML() + '</div>'; }
  function lijstenHTML() { return POS.map(lijstHTML).join(''); }
  function status() {
    var el = document.getElementById('bm-status'); if (!el || !assort) return;
    el.textContent = actievePos().map(function (p) { var n = lijst(p).filter(function (t) { return past(t, state.f); }).length; return posNaam(p) + ': ' + n + (n === 1 ? T(' band') : T(' banden')); }).join(', ');
  }
  function foutHTML(p) { var t = state[p]; return tkey(t) && !maatGeldig(t) ? '<p class="bm__fout" role="alert">' + posNaam(p) + ': ' + FOUT + '</p>' : ''; }
  function render(focus) {
    var s = OGMotor.get(), o = oem(s), head;
    var mo = s ? { motor: esc(OGMotor.label(s)) } : null, bmLink = ' <a class="link" href="' + I18N.p('/banden/bandenmaat/') + '">' + T('Zo lees je je bandenmaat →') + '</a>';
    if (!s) head = '<p class="bm__intro">' + T('Kies hierboven eerst je motor. Dan vullen we de originele bandenmaten voor je in.') + '</p>';
    else if (o && opties(o)) head = '<p class="bm__intro">' + T('Originele bandenmaten voor de <strong>{motor}</strong>.', mo) + '</p>';
    else if (o) head = '<p class="bm__intro">' + T('Originele bandenmaten voor de <strong>{motor}</strong>. Staat er iets anders op je band of in je instructieboekje, pas het dan aan.', mo) + '</p>';
    else if (perUitvoering(s)) head = '<p class="bm__intro">' + T('Bij de <strong>{motor}</strong> verschillen de bandenmaten per uitvoering. Kies hierboven je uitvoering, of kies hieronder zelf de maat van je band.', mo) + bmLink + '</p>';
    else head = '<p class="bm__intro">' + T('Van de <strong>{motor}</strong> hebben we de bandenmaten nog niet in onze lijst. Kies hieronder de maat van je band, of app ons, dan zoeken we het op.', mo) + bmLink + '</p>';
    var id = s ? OGMotor.label(s) + '|' + (s.bouwjaar || '') : '';
    if (s && state.motor !== id) {
      state = { motor: id, oem: o, voor: parse(o && o.voor), achter: parse(o && o.achter), keuze: {}, f: { merk: '', type: '', q: '' }, meer: {}, ventielen: state.ventielen, afvoeren: state.afvoeren };
    }
    adv = assort ? adviesBerekenen() : null;
    box.innerHTML = head + (s ? optiesHTML() + '<div class="bm__maten">' + POS.map(function (p) {
      var t = state[p];
      return '<fieldset class="bm__maat"><legend>' + T('Bandenmaat ' + p) + '</legend><div class="bm__sel">' + sel(p, 'b', T('Breedte'), B, t.b) + sel(p, 'h', T('Hoogte'), H, t.h) + sel(p, 'v', T('Velg (inch)'), V, t.v) + sel(p, 'o', T('Opbouw'), O, t.o || '') + '</div>' +
        '<div id="bm-' + p + '-foutvak">' + foutHTML(p) + '</div></fieldset>';
    }).join('') + '</div>' +
      (assort ? keuzeHTML() + '<div class="field bm__zoek"><label for="bm-zoek">' + T('Zoek op bandnaam') + '</label><input type="search" id="bm-zoek" placeholder="' + T('bv. Road 6 of MK4') + '" autocomplete="off" value="' + esc(state.f.q) + '"></div>' : '') +
      '<p class="bm__pnote">' + T('Richtprijs per band, incl. btw. Montage komt erbij: <strong>+ €{m} montage per band</strong>.', { m: montage() }) +
      (data.prijzen_bijgewerkt ? T(' Prijzen bijgewerkt op {d}.', { d: esc(new Date(data.prijzen_bijgewerkt).toLocaleDateString(I18N.loc, { day: 'numeric', month: 'long', year: 'numeric' })) }) : '') + '</p>' +
      '<p class="sr-only" id="bm-status" role="status" aria-live="polite"></p><div class="bm__lijst">' + lijstenHTML() + '</div>' + extrasHTML() + somHTML() +
      '<div class="bm__cta"><a class="btn btn--wa" data-dienst="Banden" data-wa-intent="banden" href="https://wa.me/31642939555" target="_blank" rel="noopener"><svg class="ico" aria-hidden="true"><use href="#i-wa"/></svg>' + T('App ons over deze banden') + '</a></div>' : '');
    box.querySelectorAll('.bm__sel select').forEach(function (el) {
      el.addEventListener('change', function () {
        // Alleen de rest bijwerken, de keuzelijsten zelf NIET opnieuw opbouwen of focussen:
        // iOS Safari opent de lijst anders opnieuw (focus() op een nieuwe <select> na het kiezen).
        var p = el.getAttribute('data-pos'); state[p][el.getAttribute('data-f')] = el.value; delete state.keuze[p]; state.meer = {};
        var fv = document.getElementById('bm-' + p + '-foutvak'); if (fv) fv.innerHTML = foutHTML(p);
        optUpd(); upd(); updSom(); save();
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
    if (b.hasAttribute('data-opt')) {
      // maatoptie: keuzelijsten op hun plek bijwerken (niet opnieuw opbouwen, iOS), focus blijft op de knop
      var x = (opties(state.oem) || [])[Number(b.getAttribute('data-opt'))]; if (!x) return;
      POS.forEach(function (q) {
        if (!x[q]) return;
        state[q] = parse(x[q]); delete state.keuze[q];
        ['b', 'h', 'v', 'o'].forEach(function (f) { var el = document.getElementById('bm-' + q + '-' + f); if (el) el.value = state[q][f] || ''; });
        var fv = document.getElementById('bm-' + q + '-foutvak'); if (fv) fv.innerHTML = foutHTML(q);
      });
      state.meer = {}; optUpd(); upd(); updSom(); save();
    } else if (b.hasAttribute('data-f')) {
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
  // ⓘ-tekst van een band = onafhankelijke test + uitslag, met de bron(nen) erachter
  function bronnen(t) {
    var l = t.bronnen && t.bronnen.length ? t.bronnen : [['Bron', t.bron]];
    return (t.bronnen && t.bronnen.length ? ' ' + T('Bron:') + ' ' : ' ') + l.map(function (b) { return '<a class="link" href="' + esc(b[1]) + '" target="_blank" rel="noopener">' + esc(T(b[0])) + '</a>'; }).join('; ') + '.';
  }
  function testnoot() { var n = assort && assort.advies && assort.advies.testnoot; return n ? '<p class="muted">' + esc(T(n)) + '</p>' : ''; }
  function pop(id, btn) {
    var h = '', titel = '';
    if (id === 'type') {
      titel = T('Soorten banden');
      h = '<dl>' + assort.types.map(function (t) { return '<dt>' + esc(T(t[1])) + '</dt><dd>' + esc(T(t[2])) + '</dd>'; }).join('') + '</dl><p>' + T('Radiaal of diagonaal staat in je bandenmaat (R/ZR = radiaal, B of - = meestal diagonaal). Combineer voor en achter geen radiale met een diagonale band, tenzij de bandenfabrikant die combinatie voor jouw motor heeft goedgekeurd.') + '</p>' + testnoot();
    } else if (id === 'merk') {
      titel = T('A-merken en budget');
      h = assort.groepen.map(function (g) { return '<p><b>' + esc(T(g[0])) + '</b> (' + esc(g[1].join(', ')) + '): ' + esc(T(g[2])) + (g[3] ? ' <a class="link" href="' + esc(g[3]) + '" target="_blank" rel="noopener">' + T('Bron') + '</a>' : '') + '</p>'; }).join('');
    } else if (/^adv-/.test(id)) {
      var p = id.slice(4), t = lijst(p)[adv.idx[p]];
      titel = T('Waarom de {band}?', { band: t.merk + ' ' + t.band });
      // volgorde: eerst de onafhankelijke test + uitslag (met bron), dan waarom dit bandtype bij deze motor past
      var s = OGMotor.get();
      h = (t.uitleg && t.bron ? '<p>' + esc(T(t.uitleg)) + bronnen(t) + '</p>' : '') +
        '<p>' + (adv.cat.waarom ? esc(T(adv.cat.waarom)) : adv.cat.wie ? T('Je {motor} is {wie}. Daar past een <b>{type}</b>band bij.', { motor: esc(OGMotor.label(s)), wie: esc(T(adv.cat.wie)), type: esc(typeKort(adv.type)) }) : T('Voor deze maat is een <b>{type}</b>band een goede middenweg.', { type: esc(typeKort(adv.type)) })) + '</p>' +
        (t.uitleg && t.bron ? testnoot() : '') +
        '<p class="muted">' + T('Liever iets anders? Kies een ander merk of type, of app ons.') + '</p>';
    } else if (/^band-/.test(id)) {
      var m = /^band-(voor|achter)-(\d+)$/.exec(id), tt = lijst(m[1])[Number(m[2])];
      titel = tt.merk + ' ' + tt.band;
      h = '<p>' + esc(T(tt.uitleg)) + bronnen(tt) + '</p>' + testnoot();
    }
    if (!dlg) {
      dlg = document.createElement('dialog'); dlg.className = 'bm__pop'; dlg.setAttribute('aria-labelledby', 'bm-pop-t');
      document.body.appendChild(dlg);
      dlg.addEventListener('click', function (e) { if (e.target === dlg || e.target.closest('[data-sluit]')) dlg.close(); }); // tik buiten de popup = sluiten
      dlg.addEventListener('close', function () { if (opener && document.contains(opener)) opener.focus(); });
    }
    opener = btn;
    dlg.innerHTML = '<div class="bm__popin"><h3 id="bm-pop-t">' + esc(titel) + '</h3>' + h + '<button type="button" class="bm__popx" data-sluit aria-label="' + T('Sluiten') + '">×</button></div>';
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    var x = dlg.querySelector('[data-sluit]'); if (x) x.focus();
  }
  var pa = AURL ? fetch(new URL(AURL, location.href).href, { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }) : Promise.resolve(null);
  function assortOk(a) { return a && a.maten && typeof a.maten === 'object' && Array.isArray(a.types) && Array.isArray(a.groepen) ? a : null; }
  fetch(URL_, { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (d) { data = d; return pa; }).then(function (a) { assort = assortOk(a); return OGMotor.load(); })
    .then(function () { render(); OGMotor.on(function () { render(); }); })
    .catch(function () { box.innerHTML = '<p class="bm__intro">' + T('Het bandenmenu kon niet laden. App ons je motor en bandenmaat, dan helpen we je verder.') + '</p>'; });
  window.OGBanden = { versie: 2, opties: function () { return opties(state.oem); }, vanaf: function (inkoop) { return data ? vanaf({ inkoop_excl_btw: inkoop }) : null; }, state: function () { return state; }, maatGeldig: function (m) { return maatGeldig(typeof m === 'string' ? parse(m) : m); }, assortiment: function () { return !!assort; }, advies: function () { return adv; } };
})();
