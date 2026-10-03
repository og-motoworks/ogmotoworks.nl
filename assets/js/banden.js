/* OG MotoWorks – bandenmenu ([data-bandenmenu]). Na merk/model/bouwjaar (OGMotor): OEM-maten voor/achter als
   aanpasbaar advies, per maat 3 adviesbanden met 'vanaf'-prijs (inkoop excl. btw x 1,10 x 1,21, afgerond) en
   montage apart (+ €50 per band). Geen prijs bekend = 'prijs op aanvraag'. Keuze gaat mee in het WhatsApp-bericht. */
(function () {
  'use strict';
  var box = document.querySelector('[data-bandenmenu]');
  if (!box || !window.OGMotor) return;
  var src = document.currentScript && document.currentScript.src || location.href;
  var URL_ = new URL('../data/banden.json', src).href, data = null;
  var SOORT = { zuinig: 'Zuinig / veel km', allround: 'Allround / sporttoer', sportief: 'Sportief / grip' };
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function key(m) { // vergelijk maten los van spaties/hoofdletters, 'R17' en 'ZR17' gelijk
    return String(m || '').toUpperCase().replace(/\s+/g, '').replace(/ZR/, 'R');
  }
  function vanaf(t) {
    if (t.inkoop_excl_btw == null || !(t.inkoop_excl_btw > 0)) return null;
    var f = data.formule || { marge: 1.10, btw: 1.21 };
    return Math.round(t.inkoop_excl_btw * f.marge * f.btw);
  }
  function oem(s) {
    if (!s || !data) return null;
    var y = parseInt(s.bouwjaar, 10);
    var hits = data.maten.filter(function (m) {
      return m.merk === s.merk && m.model === s.model && (!m.uitvoering || m.uitvoering.indexOf(s.uitvoering) !== -1) &&
             y && (!m.van || y >= m.van) && (!m.tot || y <= m.tot);
    });
    return hits.length === 1 ? hits[0] : null;
  }
  function advies(maat) {
    var k = key(maat), list = null;
    Object.keys(data.advies).forEach(function (m) { if (key(m) === k) list = data.advies[m]; });
    return list;
  }
  var state = { voor: '', achter: '', keuze: {} };
  function render() {
    var s = OGMotor.get(), o = oem(s);
    var head;
    if (!s) head = '<p class="bm__intro">Kies hierboven eerst je motor. Dan vullen we de originele bandenmaten voor je in.</p>';
    else if (o) head = '<p class="bm__intro">Originele bandenmaten voor de <strong>' + esc(OGMotor.label(s)) + '</strong>. Dit is een advies: staat er iets anders op je band of in je instructieboekje, pas het dan aan.</p>';
    else head = '<p class="bm__intro">Van de <strong>' + esc(OGMotor.label(s)) + '</strong> hebben we de bandenmaten nog niet in onze lijst. Vul de maat van je band in, of app ons, dan zoeken we het op. <a class="link" href="/banden/bandenmaat/">Zo lees je je bandenmaat →</a></p>';
    if (s && !state.motor || (s && state.motor !== OGMotor.label(s))) {
      state = { motor: OGMotor.label(s), voor: o ? o.voor : '', achter: o ? o.achter : '', keuze: {} };
    }
    box.innerHTML = head + (s ? '<div class="bm__maten">' + ['voor', 'achter'].map(function (p) {
      return '<div class="field"><label for="bm-' + p + '">Bandenmaat ' + p + '</label><input id="bm-' + p + '" type="text" maxlength="24" autocomplete="off" placeholder="bijv. ' + (p === 'voor' ? '120/70 ZR17' : '180/55 ZR17') + '" value="' + esc(state[p]) + '"></div>';
    }).join('') + '</div><div class="bm__lijst">' + ['voor', 'achter'].map(list).join('') + '</div>' +
      '<p class="note">Vanaf-prijs is per band, inclusief btw. Montage komt erbij: <strong>+ €' + (data.montage_per_band || 50) + ' montage per band</strong>.' +
      (data.prijzen_bijgewerkt ? ' Prijzen bijgewerkt op ' + esc(new Date(data.prijzen_bijgewerkt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })) + '.' : '') + '</p>' +
      '<div class="bm__cta"><a class="btn btn--wa" data-dienst="Banden" data-wa-intent="banden" href="https://wa.me/31642939555" target="_blank" rel="noopener"><svg class="ico" aria-hidden="true"><use href="#i-wa"/></svg>App ons over deze banden</a></div>' : '');
    box.querySelectorAll('.bm__maten input').forEach(function (inp) {
      inp.addEventListener('change', function () { var p = inp.id.slice(3); state[p] = inp.value.trim(); delete state.keuze[p]; render(); save(); document.getElementById(inp.id).focus(); });
    });
    box.querySelectorAll('.bm__opt input').forEach(function (r) {
      r.addEventListener('change', function () { state.keuze[r.name.slice(3)] = Number(r.value); save(); });
    });
    save();
  }
  function list(p) {
    var maat = state[p]; if (!maat) return '';
    var l = advies(maat);
    if (!l) return '<fieldset class="bm__pos"><legend>' + (p === 'voor' ? 'Voorband' : 'Achterband') + ' ' + esc(maat) + '</legend><p class="muted">Voor deze maat hebben we nog geen standaardadvies. App ons, dan adviseren we je persoonlijk.</p></fieldset>';
    return '<fieldset class="bm__pos"><legend>' + (p === 'voor' ? 'Voorband' : 'Achterband') + ' ' + esc(maat) + '</legend><ul class="bm__opts">' + l.map(function (t, i) {
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
      if (!state[p]) return;
      var l = advies(state[p]), t = l && state.keuze[p] != null ? l[state.keuze[p]] : null, pr = t ? vanaf(t) : null;
      if (pr != null) min = min == null ? pr : Math.min(min, pr);
      parts.push(p + ' ' + state[p] + (t ? ' ' + t.merk + ' ' + t.band + ' (' + (pr ? 'vanaf €' + pr : 'prijs op aanvraag') + ')' : ''));
    });
    var k = OGMotor.klus.get(); k.banden = parts.join('; ') + (parts.length ? ' + €' + (data.montage_per_band || 50) + ' montage per band' : ''); k.bandPrijs = min;
    OGMotor.klus.set(k);
  }
  fetch(URL_, { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (d) { data = d; return OGMotor.load(); })
    .then(function () { render(); OGMotor.on(function () { render(); }); })
    .catch(function () { box.innerHTML = '<p class="bm__intro">Het bandenmenu kon niet laden. App ons je motor en bandenmaat, dan helpen we je verder.</p>'; });
  window.OGBanden = { vanaf: function (inkoop) { return data ? vanaf({ inkoop_excl_btw: inkoop }) : null; }, state: function () { return state; } };
})();
