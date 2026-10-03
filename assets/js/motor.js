/* OG MotoWorks – gedeelde motorkeuze (merk → model → uitvoering → bouwjaar).
   Eén module voor alle pagina's en formulieren:
   - laadt assets/data/motoren.json één keer;
   - koppelt een set velden met prefix (bv. "wa" in het aanvraagformulier, "mp" in het blok "Kies je motor");
   - onthoudt de gekozen motor in localStorage (alleen op dit apparaat, alleen motorgegevens), zodat alles vooraf is ingevuld;
   - toont de gekozen motor met "Wijzig".
   Zonder JS of zonder localStorage werkt de site gewoon, alleen zonder onthouden. */
(function () {
  'use strict';
  var KEY = 'ogmw.motor.v1';
  var OTHER = '__anders', WEET = '__weet';
  var OLDEST = 1970;
  var scriptSrc = (document.currentScript && document.currentScript.src) || '/assets/js/motor.js';
  var DATA_URL = new URL('../data/motoren.json', scriptSrc).href;
  var ONDERHOUD_URL = new URL('../data/onderhoud.json', scriptSrc).href;
  var data = null, loading = null, listeners = [], onderhoud = null, oLoading = null;

  function clean(v) { return String(v || '').replace(/\s+/g, ' ').trim(); }
  function $(id) { return document.getElementById(id); }
  function opt(value, text) { var o = document.createElement('option'); o.value = value; o.textContent = text == null ? value : text; return o; }

  function load() {
    if (data !== null) return Promise.resolve(data);
    if (loading) return loading;
    if (!window.fetch) { data = false; return Promise.resolve(false); }
    loading = fetch(DATA_URL, { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) { data = d; return d; })
      .catch(function () { data = false; return false; });
    return loading;
  }
  function models(merk) { return data && data.merken && data.merken[merk]; }
  function variants(merk, model) { return data && data.uitvoeringen && data.uitvoeringen[merk] && data.uitvoeringen[merk][model]; }

  /* ---------- opslag ---------- */
  function get() {
    try { var s = JSON.parse(localStorage.getItem(KEY) || 'null'); return s && s.merk && s.model ? s : null; } catch (e) { return null; }
  }
  function emit(s) { listeners.forEach(function (fn) { try { fn(s); } catch (e) {} }); }
  function set(s) {
    s = s && { merk: clean(s.merk), model: clean(s.model), uitvoering: clean(s.uitvoering), bouwjaar: clean(s.bouwjaar), handmatig: !!s.handmatig };
    if (!s || !s.merk || !s.model) return null;
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
    emit(s); return s;
  }
  function clear() { try { localStorage.removeItem(KEY); } catch (e) {} emit(null); }
  window.addEventListener('storage', function (e) { if (e.key === KEY) emit(get()); });
  function yearText(by) { return by === 'ouder' ? 'ouder dan ' + OLDEST : by; }
  function name(s) { return s ? clean([s.merk, s.model, s.uitvoering].join(' ')) : ''; }
  function label(s) { return s ? name(s) + (s.bouwjaar ? ' (' + yearText(s.bouwjaar) + ')' : '') : ''; }
  /* ---------- onderhoudsinterval (+ later: tip) per motor uit onderhoud.json ---------- */
  function loadOnderhoud() {
    if (onderhoud !== null) return Promise.resolve(onderhoud);
    if (oLoading) return oLoading;
    if (!window.fetch) { onderhoud = false; return Promise.resolve(false); }
    oLoading = fetch(ONDERHOUD_URL, { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) { onderhoud = d; return d; }).catch(function () { onderhoud = false; return false; });
    return oLoading;
  }
  // Alleen een treffer als merk, model, (uitvoering) en bouwjaar binnen de bron vallen
  function interval(s) {
    if (!s || !onderhoud || !onderhoud.modellen) return null;
    var y = parseInt(s.bouwjaar, 10);
    var hits = onderhoud.modellen.filter(function (m) {
      if (m.merk !== s.merk || m.model !== s.model) return false;
      if (m.uitvoering && m.uitvoering.indexOf(s.uitvoering) === -1) return false;
      if (!y || (m.van && y < m.van) || (m.tot && y > m.tot)) return false;
      return true;
    });
    return hits.length === 1 ? hits[0] : null;
  }
  function tip(s) { var m = interval(s); return m && m.tip || null; }
  function nl(n) { return Number(n).toLocaleString('nl-NL'); }
  function paintInterval(s) {
    var boxes = document.querySelectorAll('[data-motor-interval]');
    if (!boxes.length) return;
    loadOnderhoud().then(function () {
      var m = interval(s), html;
      if (!s) html = '<b>Onderhoudsinterval</b> Kies je motor, dan zie je hier het onderhoudsinterval als we dat zeker weten.';
      else if (!m) html = '<b>Onderhoudsinterval ' + escapeHtml(name(s)) + '</b> Interval volgens jouw instructieboekje, wij checken het voor je.';
      else {
        var parts = [];
        if (m.interval.km) parts.push('elke ' + nl(m.interval.km) + ' km');
        if (m.interval.maanden) parts.push(m.interval.maanden % 12 === 0 ? (m.interval.maanden === 12 ? 'elk jaar' : 'elke ' + m.interval.maanden / 12 + ' jaar') : 'elke ' + m.interval.maanden + ' maanden');
        html = '<b>Onderhoudsinterval ' + escapeHtml(name(s)) + '</b> Een beurt ' + parts.join(' of ') + (parts.length > 1 ? ', wat het eerst komt' : '') +
               ' (volgens het instructieboekje van ' + escapeHtml(s.merk) + ').' +
               (m.extra && m.extra.length ? ' ' + m.extra.map(escapeHtml).join('. ') + '.' : '') + ' Wij checken het voor je.';
      }
      boxes.forEach(function (b) { b.innerHTML = '<p>' + html + '</p>'; });
    });
  }
  function escapeHtml(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ---------- velden koppelen (prefix-merk, prefix-model, …) ---------- */
  function bind(prefix) {
    var el = {
      merk: $(prefix + '-merk'), merkO: $(prefix + '-merk-anders'),
      model: $(prefix + '-model'), modelO: $(prefix + '-model-anders'),
      uitv: $(prefix + '-uitvoering'), uitvO: $(prefix + '-uitvoering-anders'),
      by: $(prefix + '-bouwjaar'), manual: $(prefix + '-handmatig')
    };
    if (!el.merk || !el.model) return null;
    function setErr(input) {
      var err = $((input.getAttribute('aria-describedby') || input.id + '-err').split(' ')[0]);
      input.removeAttribute('aria-invalid'); if (err && err.classList.contains('field__err')) err.textContent = '';
    }
    function showOther(input, show, required) {
      if (!input) return;
      input.hidden = !show; input.required = !!(show && required);
      if (!show) { input.value = ''; setErr(input); }
    }
    function empty(sel) { while (sel.options.length) sel.remove(0); setErr(sel); }

    if (el.by && el.by.options.length <= 1) {
      for (var y = new Date().getFullYear(); y >= OLDEST; y--) el.by.appendChild(opt(String(y)));
      el.by.appendChild(opt('ouder', 'Ouder dan ' + OLDEST));
    }
    function fillUitv() {
      if (!el.uitv) return;
      var merk = el.merk.value, model = el.model.value, sel = el.uitv;
      empty(sel);
      var free = merk === OTHER || model === OTHER || el.model.hidden;
      var list = !free && model && variants(merk, model);
      if (!merk || (!free && !model)) {
        sel.appendChild(opt('', 'Kies eerst een model'));
        sel.disabled = true; sel.hidden = false; showOther(el.uitvO, false); return;
      }
      if (!list) { // geen bekende uitvoeringen: vrij tekstveld (optioneel)
        sel.appendChild(opt('', '—')); sel.disabled = true; sel.hidden = true; showOther(el.uitvO, true, false); return;
      }
      sel.hidden = false; sel.disabled = false; showOther(el.uitvO, false);
      sel.appendChild(opt('', 'Kies uitvoering…'));
      list.forEach(function (v) { sel.appendChild(opt(v)); });
      sel.appendChild(opt(WEET, 'Weet ik niet'));
      sel.appendChild(opt(OTHER, 'Andere uitvoering…'));
    }
    function fillModels() {
      var merk = el.merk.value, sel = el.model;
      empty(sel); if (el.modelO) el.modelO.value = '';
      if (!merk) {
        sel.appendChild(opt('', 'Kies eerst een merk'));
        sel.disabled = true; sel.hidden = false; showOther(el.modelO, false, true);
      } else if (merk === OTHER || !models(merk)) { // onbekend merk of lijst niet geladen: model als tekstveld
        sel.appendChild(opt('', '—'));
        sel.disabled = true; sel.hidden = true; showOther(el.modelO, true, true);
      } else {
        sel.hidden = false; sel.disabled = false; showOther(el.modelO, false, true);
        sel.appendChild(opt('', 'Kies model…'));
        models(merk).forEach(function (m) { sel.appendChild(opt(m)); });
        sel.appendChild(opt(OTHER, 'Ander model…'));
      }
      fillUitv();
    }
    function onMerk() { showOther(el.merkO, el.merk.value === OTHER, true); fillModels(); }
    el.merk.addEventListener('change', function () { onMerk(); if (this.value === OTHER) el.merkO.focus(); });
    el.model.addEventListener('change', function () {
      showOther(el.modelO, this.value === OTHER, true); fillUitv();
      if (this.value === OTHER) el.modelO.focus();
    });
    if (el.uitv) el.uitv.addEventListener('change', function () {
      showOther(el.uitvO, this.value === OTHER, false);
      if (this.value === OTHER) el.uitvO.focus();
    });
    el.hint = $(prefix + '-handmatig-hint');
    function syncHint() { if (el.hint) el.hint.hidden = el.merk.value !== OTHER; }
    el.merk.addEventListener('change', syncHint);
    if (el.manual) el.manual.addEventListener('click', function () {
      el.merk.value = OTHER; onMerk(); syncHint(); el.merkO.focus();
    });
    if (window.OGCombo) [el.merk, el.model, el.uitv].forEach(function (s) { if (s) OGCombo.enhance(s); });
    // modellen bijwerken zodra de lijst geladen is (of mislukt)
    load().then(function () { if (el.merk.value && el.merk.value !== OTHER && !el.model.value) fillModels(); });

    function has(sel, v) { return [].some.call(sel.options, function (o) { return o.value === v && v !== ''; }); }
    var api = {
      el: el,
      merk: function () { return el.merk.value === OTHER ? clean(el.merkO.value) : (el.merk.value === '' ? '' : clean(el.merk.value)); },
      model: function () { return (el.modelO && !el.modelO.hidden) ? clean(el.modelO.value) : clean(el.model.value === OTHER ? '' : el.model.value); },
      uitvoering: function () {
        if (!el.uitv) return '';
        if (el.uitvO && !el.uitvO.hidden) return clean(el.uitvO.value);
        var v = el.uitv.value; return v === WEET || v === OTHER ? '' : clean(v);
      },
      bouwjaar: function () { return el.by ? el.by.value : ''; },
      read: function () {
        return { merk: api.merk(), model: api.model(), uitvoering: api.uitvoering(), bouwjaar: api.bouwjaar(),
                 handmatig: el.merk.value === OTHER || el.model.value === OTHER || el.model.hidden };
      },
      // Vul de velden met een opgeslagen motor (wacht zo nodig op de modellenlijst)
      fill: function (s) {
        if (!s) return Promise.resolve();
        return load().then(function () {
          if (has(el.merk, s.merk)) el.merk.value = s.merk; else { el.merk.value = OTHER; }
          onMerk();
          if (el.merk.value === OTHER) el.merkO.value = s.merk;
          if (!el.model.hidden && has(el.model, s.model)) el.model.value = s.model;
          else if (!el.model.hidden) { el.model.value = OTHER; showOther(el.modelO, true, true); }
          if (el.modelO && !el.modelO.hidden) el.modelO.value = s.model;
          fillUitv();
          if (el.uitv && s.uitvoering) {
            if (!el.uitv.hidden && has(el.uitv, s.uitvoering)) el.uitv.value = s.uitvoering;
            else { if (!el.uitv.hidden) { el.uitv.value = OTHER; showOther(el.uitvO, true, false); } el.uitvO.value = s.uitvoering; }
          }
          if (el.by && s.bouwjaar && has(el.by, s.bouwjaar)) el.by.value = s.bouwjaar;
          [el.merk, el.model, el.uitv, el.by].forEach(function (x) { if (x && x._combo) x._combo.syncValue(); });
          syncHint();
        });
      },
      reset: function () { el.merk.value = ''; onMerk(); if (el.by) el.by.value = ''; [el.merk, el.by].forEach(function (x) { if (x && x._combo) x._combo.syncValue(); }); }
    };
    return api;
  }

  /* ---------- silhouet per soort motor (eigen SVG's, geen foto's) ---------- */
  // Soort komt uit motoren.json → "types" (naked, sport, toer, adventure, scooter, klassiek); anders generiek.
  var SIL = {
    naked: '<path d="M44 66l52-6 8-9h34l18 8-6 13-15 12-4 19H101l-9-21-34-6z"/><path class="s" d="M187 106l-24-55M150 44l20-4M55 106l50-10"/><circle cx="166" cy="61" r="7"/>',
    sport: '<path d="M30 58l40 4 34-4 16-12 30-2 26 8 16 20-16 12-26 6-12 14h-38l-10-18-32-4z"/><path class="s" d="M150 44l20-7 10 16M55 106l50-10M187 106l-18-40"/>',
    toer: '<path d="M38 70l58-6 14-14 38-4 24-6 14-6 8 22-4 20-20 12-30 4-6 14h-34l-8-16-44 2z"/><rect x="20" y="44" width="34" height="26" rx="5"/><rect x="34" y="76" width="44" height="26" rx="5"/><path class="s" d="M187 106l-16-34M55 106l46-8"/>',
    adventure: '<path d="M44 62l52-4 10-12 40-4 20 6-6 16-18 14-6 22h-34l-8-18-32-6z"/><path d="M166 48l18 10-8 4z"/><path class="s" d="M160 44l10-18 8 4M187 106l-21-62M55 106l50-12M110 102h28"/>',
    scooter: '<path d="M38 94l6-26 54-4 6 26h44l12-50 16-6 6 10-10 52-12 12H78z"/><path class="s" d="M164 42l-4-14h14"/>',
    klassiek: '<path d="M44 70l56-4 6-10q18-10 40-2l4 12-16 14-4 24h-28l-8-22-34-2z"/><path class="s" d="M187 106l-21-46M152 46l18-4M55 106l48-8M28 96a30 30 0 0 1 50-14M166 84a30 30 0 0 1 44 14"/><circle cx="168" cy="60" r="9"/>',
    generiek: '<path d="M46 68l54-6 10-10h30l16 10-10 16-14 8-4 18h-30l-8-20-36-6z"/><path class="s" d="M187 106l-22-50M55 106l48-10"/>'
  };
  function motorType(s) { return (s && !s.handmatig && data && data.types && data.types[s.merk] && data.types[s.merk][s.model]) || 'generiek'; }
  function silhouette(type) {
    var small = type === 'scooter', r = small ? 20 : 27, y = small ? 113 : 106, x1 = small ? 60 : 55, x2 = small ? 182 : 187;
    return '<svg class="mp__sil" viewBox="0 0 240 140" role="img" aria-label="Silhouet ' + (type === 'generiek' ? 'motor' : type) + '" data-type="' + type + '">' +
      '<g class="w"><circle cx="' + x1 + '" cy="' + y + '" r="' + r + '"/><circle cx="' + x2 + '" cy="' + y + '" r="' + r + '"/></g>' +
      '<g class="b">' + (SIL[type] || SIL.generiek) + '</g><path class="a" d="M8 136h224"/></svg>';
  }
  function richLabel(s) {
    return '<span class="mp__brand">' + escapeHtml(s.merk) + '</span> <span class="mp__model">' + escapeHtml(clean(s.model + ' ' + (s.uitvoering || ''))) + '</span>' +
           (s.bouwjaar ? ' <span class="mp__year">(' + escapeHtml(yearText(s.bouwjaar)) + ')</span>' : '');
  }

  /* ---------- "Wat wil je laten doen?" (meerkeuze, onthouden op dit apparaat) ---------- */
  // Indicatieprijs alleen waar we een vaste prijs hebben. Banden: band 'vanaf' (bandenmenu, later) + €50 montage per band.
  var KLUS_KEY = 'ogmw.klus.v1';
  var KLUS = [
    { id: 'kleine-beurt', label: 'Kleine beurt' }, { id: 'grote-beurt', label: 'Grote beurt' },
    { id: 'banden', label: 'Banden', prijs: '+ €50 montage per band', link: '/banden/#advies', linkText: 'Naar bandenadvies' },
    { id: 'ketting', label: 'Ketting / kettingset', prijs: 'vanaf €150' }, { id: 'remmen', label: 'Remmen' },
    { id: 'voorvork', label: 'Voorvorkkeerringen', prijs: 'vanaf €350' }, { id: 'storing', label: 'Storing / lampje / diagnose' },
    { id: 'tuning', label: 'Tuning / afstellen' }, { id: 'anders', label: 'Iets anders' }
  ];
  // data-dienst op knoppen → welk vinkje vooraf aan gaat
  var DIENST_KLUS = { 'Onderhoud / grote beurt': 'grote-beurt', 'Kleine beurt': 'kleine-beurt', 'Diagnose / storing': 'storing', 'Banden': 'banden',
                      'Kettingset': 'ketting', 'Remmen': 'remmen', 'Voorvorkkeerringen': 'voorvork', 'Tuning / afstellen': 'tuning' };
  var klusListeners = [];
  function klusGet() {
    try { var k = JSON.parse(localStorage.getItem(KLUS_KEY) || 'null'); if (k && k.items) return { items: k.items.filter(byId), anders: clean(k.anders), bandPrijs: k.bandPrijs || null }; } catch (e) {}
    return { items: [], anders: '', bandPrijs: null };
  }
  function byId(id) { return KLUS.some(function (k) { return k.id === id; }); }
  function klusSet(k) {
    k = { items: (k.items || []).filter(byId), anders: clean(k.anders).slice(0, 200), bandPrijs: k.bandPrijs || null };
    try { localStorage.setItem(KLUS_KEY, JSON.stringify(k)); } catch (e) {}
    klusListeners.forEach(function (fn) { try { fn(k); } catch (e) {} }); return k;
  }
  function klusAdd(id) { var k = klusGet(); if (byId(id) && k.items.indexOf(id) === -1) { k.items.push(id); klusSet(k); } }
  function klusPrijs(item, k) {
    if (item.id === 'banden' && k.bandPrijs) return 'band vanaf €' + k.bandPrijs + ' + €50 montage per band';
    return item.prijs || '';
  }
  // Regels voor het WhatsApp-bericht, in vaste volgorde
  function klusLines() {
    var k = klusGet();
    return KLUS.filter(function (i) { return k.items.indexOf(i.id) !== -1; }).map(function (i) {
      if (i.id === 'anders') return 'Iets anders' + (k.anders ? ': ' + k.anders : '');
      var pr = klusPrijs(i, k); return i.label + (pr ? ' (' + pr + ')' : '');
    });
  }
  window.addEventListener('storage', function (e) { if (e.key === KLUS_KEY) { var k = klusGet(); klusListeners.forEach(function (fn) { fn(k); }); } });
  function renderKlus(box) {
    var p = box.getAttribute('data-klus') || 'klus', here = location.pathname.replace(/\/+$/, '/') ;
    box.innerHTML = '<legend class="klus__title">Wat wil je laten doen?</legend>' +
      '<p class="klus__hint">Vink aan wat je wilt, dan staat het in je WhatsApp-bericht.</p><ul class="klus__list">' +
      KLUS.map(function (i) {
        var id = p + '-klus-' + i.id;
        return '<li><input type="checkbox" id="' + id + '" value="' + i.id + '"><label for="' + id + '">' + i.label +
          (i.prijs ? ' <span class="klus__prijs" data-prijs="' + i.id + '">' + i.prijs + '</span>' : '') + '</label>' +
          (i.link && here !== i.link.split('#')[0] ? ' <a class="link klus__link" href="' + i.link + '" hidden>' + i.linkText + ' →</a>' : '') + '</li>';
      }).join('') + '</ul>' +
      '<input type="text" class="field__other klus__anders" id="' + p + '-klus-anders-tekst" maxlength="200" placeholder="Wat wil je nog meer laten doen?" aria-label="Iets anders: wat wil je laten doen?" hidden>';
    var boxes = box.querySelectorAll('input[type=checkbox]'), txt = box.querySelector('.klus__anders');
    function sync(k) {
      boxes.forEach(function (c) { c.checked = k.items.indexOf(c.value) !== -1; var l = c.parentNode.querySelector('.klus__link'); if (l) l.hidden = !c.checked; });
      txt.hidden = k.items.indexOf('anders') === -1; if (document.activeElement !== txt) txt.value = k.anders || '';
      var bp = box.querySelector('[data-prijs=banden]'); if (bp) bp.textContent = klusPrijs(KLUS[2], k);
    }
    function save() {
      var k = klusGet();
      k.items = [].filter.call(boxes, function (c) { return c.checked; }).map(function (c) { return c.value; });
      k.anders = txt.value; klusSet(k);
    }
    box.addEventListener('change', function (e) {
      save();
      if (e.target.value === 'anders' && e.target.checked) txt.focus();
    });
    txt.addEventListener('input', save);
    klusListeners.push(sync); sync(klusGet());
  }

  /* ---------- blok "Kies je motor" ([data-motorpick]) ---------- */
  function fieldsHTML(p) {
    return '' +
      '<div class="field"><label for="' + p + '-merk">Merk <span class="req" aria-hidden="true">*</span></label>' +
        '<select id="' + p + '-merk" required data-other="' + p + '-merk-anders" data-placeholder="Typ of kies merk" aria-describedby="' + p + '-merk-err"><option value="">Kies merk…</option></select>' +
        '<input id="' + p + '-merk-anders" type="text" class="field__other" hidden autocomplete="off" maxlength="40" placeholder="Welk merk?" aria-label="Welk merk?" aria-describedby="' + p + '-merk-err">' +
        '<p class="field__err" id="' + p + '-merk-err" aria-live="polite"></p></div>' +
      '<div class="field"><label for="' + p + '-model">Model <span class="req" aria-hidden="true">*</span></label>' +
        '<select id="' + p + '-model" required disabled data-other="' + p + '-model-anders" data-placeholder="Typ of kies model" aria-describedby="' + p + '-model-err"><option value="">Kies eerst een merk</option></select>' +
        '<input id="' + p + '-model-anders" type="text" class="field__other" hidden autocomplete="off" maxlength="40" placeholder="Welk model?" aria-label="Welk model?" aria-describedby="' + p + '-model-err">' +
        '<p class="field__err" id="' + p + '-model-err" aria-live="polite"></p></div>' +
      '<div class="field"><label for="' + p + '-uitvoering">Uitvoering <span class="opt">(optioneel)</span></label>' +
        '<select id="' + p + '-uitvoering" disabled data-other="' + p + '-uitvoering-anders" data-placeholder="Typ of kies uitvoering"><option value="">Kies eerst een model</option></select>' +
        '<input id="' + p + '-uitvoering-anders" type="text" class="field__other" hidden autocomplete="off" maxlength="40" placeholder="bijv. R, GT, Adventure S" aria-label="Welke uitvoering? (optioneel)">' +
        '<p class="field__err" aria-hidden="true"></p></div>' +
      '<div class="field"><label for="' + p + '-bouwjaar">Bouwjaar <span class="req" aria-hidden="true">*</span></label>' +
        '<select id="' + p + '-bouwjaar" required aria-describedby="' + p + '-bouwjaar-err"><option value="">Kies bouwjaar…</option></select>' +
        '<p class="field__err" id="' + p + '-bouwjaar-err" aria-live="polite"></p></div>';
  }
  function merkOptions(sel) {
    // merken uit de JSON; zonder JSON alleen "Anders…" (dan tekstvelden)
    return load().then(function (d) {
      var names = d && d.merken ? Object.keys(d.merken) : [];
      names.forEach(function (n) { sel.insertBefore(opt(n), null); });
      sel.appendChild(opt(OTHER, 'Anders…'));
      if (sel._combo) sel._combo.syncState();
    });
  }
  function renderPicker(box) {
    var p = box.getAttribute('data-motorpick') || 'mp';
    var cta = box.querySelector('[data-mp-cta]');
    var title = box.getAttribute('data-title') || 'Kies je motor';
    box.innerHTML =
      '<div class="mp__view" hidden>' +
        '<div class="mp__sil-wrap" aria-hidden="false"></div>' +
        '<div class="mp__id"><p class="mp__label">Jouw motor</p>' +
        '<p class="mp__name" data-motor-label data-rich></p></div>' +
        '<button type="button" class="mp__edit" aria-label="Wijzig je motor">Wijzig</button>' +
        '<fieldset class="klus" data-klus="' + p + '"></fieldset>' +
        '<div class="mp__cta"></div>' +
      '</div>' +
      '<form class="mp__form" novalidate>' +
        '<h2 class="mp__title" id="' + p + '-titel">' + title + '</h2>' +
        '<p class="mp__hint">Dan zie je meteen wat bij jouw motor hoort. We onthouden je keuze alleen op dit apparaat.</p>' +
        '<div class="sheet__grid">' + fieldsHTML(p) + '</div>' +
        '<button type="button" class="mp__manual" id="' + p + '-handmatig">Mijn motor staat er niet tussen</button>' +
        '<p class="mp__manualhint" id="' + p + '-handmatig-hint" hidden>Vul merk en model dan zelf in. Voor banden helpt je bandenmaat ook: <a class="link" href="/banden/bandenmaat/">zo lees je je bandenmaat</a>.</p>' +
        '<div class="mp__actions"><button type="submit" class="btn btn--wa">Dit is mijn motor</button>' +
        '<button type="button" class="btn btn--ghost mp__cancel" hidden>Annuleren</button></div>' +
      '</form>';
    box.classList.add('mp--ready');
    box.setAttribute('aria-labelledby', p + '-titel');
    if (cta) box.querySelector('.mp__cta').appendChild(cta);
    var form = box.querySelector('form'), view = box.querySelector('.mp__view');
    var b = bind(p);
    merkOptions(b.el.merk);
    renderKlus(box.querySelector('[data-klus]'));
    function show(s, focus) {
      var editing = !s;
      view.hidden = editing; form.hidden = !editing;
      box.querySelector('.mp__cancel').hidden = !get();
      if (s) paintView(s);
      if (focus) (editing ? b.el.merk : view.querySelector('.mp__edit')).focus();
    }
    view.querySelector('.mp__edit').addEventListener('click', function () {
      var s = get(); show(null);
      load().then(function () { return b.fill(s); }).then(function () { b.el.merk.focus(); });
    });
    box.querySelector('.mp__cancel').addEventListener('click', function () { show(get(), true); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var s = b.read(), first = null;
      function need(ok, input, msg) {
        var err = $((input.getAttribute('aria-describedby') || '').split(' ')[0]);
        if (ok) { input.removeAttribute('aria-invalid'); if (err) err.textContent = ''; }
        else { input.setAttribute('aria-invalid', 'true'); if (err) err.textContent = msg; first = first || input; }
      }
      var mOther = b.el.merk.value === OTHER;
      need(!!s.merk, mOther ? b.el.merkO : b.el.merk, mOther ? 'Vul het merk in.' : 'Kies het merk.');
      var modelText = !b.el.modelO.hidden;
      need(!!s.model, modelText ? b.el.modelO : b.el.model, modelText ? 'Vul het model in.' : 'Kies het model.');
      need(!!s.bouwjaar, b.el.by, 'Kies het bouwjaar.');
      if (first) { first.focus(); return; }
      set(s); show(get() || s, true);
    });
    function paintView(s) {
      view.querySelector('[data-motor-label]').innerHTML = richLabel(s);
      var w = view.querySelector('.mp__sil-wrap');
      w.innerHTML = silhouette(motorType(s));
      if (!data) load().then(function () { if (get()) w.innerHTML = silhouette(motorType(get())); });
    }
    form.addEventListener('input', function (e) { if (e.target.getAttribute('aria-invalid') === 'true') { e.target.removeAttribute('aria-invalid'); } });
    on(function (s) { if (form.hidden || !s) show(s); });
    show(get());
  }

  /* ---------- labels elders op de pagina ---------- */
  function paint(s) {
    document.querySelectorAll('[data-motor-label]').forEach(function (n) { if (s) { if (n.hasAttribute('data-rich')) n.innerHTML = richLabel(s); else n.textContent = label(s); } });
    document.querySelectorAll('[data-motor-if]').forEach(function (n) { n.hidden = !s; });
    document.querySelectorAll('[data-motor-unless]').forEach(function (n) { n.hidden = !!s; });
    paintInterval(s);
  }
  function on(fn) { listeners.push(fn); }
  on(paint);

  window.OGMotor = { load: load, get: get, set: set, clear: clear, label: label, name: name, yearText: yearText,
                     bind: bind, tip: tip, type: motorType, silhouette: silhouette,
                     klus: { list: KLUS, get: klusGet, set: klusSet, add: klusAdd, lines: klusLines, fromDienst: function (d) { return DIENST_KLUS[clean(d)] || null; }, on: function (fn) { klusListeners.push(fn); } }, interval: interval, loadOnderhoud: loadOnderhoud, on: on, OTHER: OTHER, data: function () { return data; } };

  function init() {
    document.querySelectorAll('[data-motorpick]').forEach(renderPicker);
    document.querySelectorAll('[data-klus]').forEach(function (b) { if (!b.children.length) renderKlus(b); });
    paint(get());
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
