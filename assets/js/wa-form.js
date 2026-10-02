/* OG MotoWorks – WhatsApp-formulier. Plain JS, geen externe diensten, slaat niets op.
   Zonder JS (of zonder <dialog>-ondersteuning) werken de WhatsApp-links gewoon direct. */
(function () {
  'use strict';
  var NUMBER = '31642939555';
  var dlg = document.getElementById('wa-dialog');
  if (!dlg || typeof dlg.showModal !== 'function') return;
  var form = document.getElementById('wa-form');
  var intentEl = form.elements.intent;
  var lastTrigger = null;
  var OTHER = '__anders';
  var OLDEST = 1970;
  var scriptSrc = (document.currentScript && document.currentScript.src) || 'assets/js/wa-form.js';
  var DATA_URL = new URL('../data/motoren.json', scriptSrc).href;
  var models = null; // { merk: [modellen] } zodra geladen; false = laden mislukt

  var INTENTS = {
    afspraak: 'Ik wil graag een afspraak maken.',
    prijs: 'Ik wil graag een prijs weten.',
    vraag: 'Ik heb een vraag.'
  };

  function field(name) { return form.elements[name]; }
  function clean(v) { return String(v || '').replace(/\s+/g, ' ').trim(); }

  function setError(input, msg) {
    var err = document.getElementById((input.getAttribute('aria-describedby') || input.id + '-err').split(' ')[0]);
    if (msg) { input.setAttribute('aria-invalid', 'true'); if (err) err.textContent = msg; }
    else { input.removeAttribute('aria-invalid'); if (err) err.textContent = ''; }
  }

  function validate() {
    var first = null;
    var plate = field('kenteken'), merk = field('merk'), model = field('model'), km = field('km');
    var p = clean(plate.value).toUpperCase().replace(/\s/g, '-');
    plate.value = p;
    var pOk = /^[A-Z0-9]+(-[A-Z0-9]+)*$/.test(p) && p.replace(/-/g, '').length >= 4 && p.replace(/-/g, '').length <= 10;
    setError(plate, p ? (pOk ? '' : 'Vul een geldig kenteken in, bijv. AB-12-CD.') : 'Vul je kenteken in.');
    if (!pOk) first = first || plate;
    [[merk, field('merk_anders'), 'Kies het merk.', 'Vul het merk in.'],
     [model, field('model_anders'), 'Kies het model.', 'Vul het model in.']].forEach(function (x) {
      var sel = x[0], other = x[1], useOther = !other.hidden;
      var ok = useOther ? clean(other.value) !== '' : clean(sel.value) !== '' && sel.value !== OTHER;
      var target = useOther && (sel.value === OTHER || sel.hidden) ? other : sel;
      setError(sel, ''); setError(other, '');
      setError(target, ok ? '' : (useOther ? x[3] : x[2]));
      if (!ok) first = first || target;
    });
    var by = field('bouwjaar');
    var byOk = by.value !== '';
    setError(by, byOk ? '' : 'Kies het bouwjaar.');
    if (!byOk) first = first || by;
    var digits = clean(km.value).replace(/[.\s]/g, '');
    var kmOk = /^\d{1,7}$/.test(digits);
    setError(km, digits ? (kmOk ? '' : 'Vul alleen cijfers in, bijv. 23450.') : 'Vul de kilometerstand in.');
    if (!kmOk) first = first || km;
    return first;
  }

  function buildMessage() {
    var intent = INTENTS[intentEl.value] || INTENTS.afspraak;
    var km = Number(clean(field('km').value).replace(/[.\s]/g, ''));
    var lines = ['Hoi OG MotoWorks! ' + intent];
    var naam = clean(field('naam').value);
    if (naam) lines.push('Naam: ' + naam);
    lines.push('Kenteken: ' + clean(field('kenteken').value).toUpperCase());
    lines.push('Merk/model: ' + getMerk() + ' ' + getModel());
    var by = field('bouwjaar').value;
    lines.push('Bouwjaar: ' + (by === 'ouder' ? 'ouder dan ' + OLDEST : by));
    lines.push('Kilometerstand: ' + km.toLocaleString('nl-NL') + ' km');
    var vraag = String(field('vraag').value || '').trim();
    if (vraag) lines.push('Vraag: ' + vraag);
    return lines.join('\n');
  }

  function getMerk() {
    var sel = field('merk');
    return sel.value === OTHER ? clean(field('merk_anders').value) : clean(sel.value);
  }
  function getModel() {
    var sel = field('model');
    return (!field('model_anders').hidden) ? clean(field('model_anders').value) : clean(sel.value);
  }

  function opt(value, text) {
    var o = document.createElement('option');
    o.value = value; o.textContent = text == null ? value : text;
    return o;
  }

  function showOther(input, show) {
    input.hidden = !show;
    input.required = show;
    if (!show) { input.value = ''; setError(input, ''); }
  }

  // Bouwjaar: huidig jaar t/m 1970, plus 'Ouder'
  (function fillYears() {
    var sel = field('bouwjaar');
    for (var y = new Date().getFullYear(); y >= OLDEST; y--) sel.appendChild(opt(String(y)));
    sel.appendChild(opt('ouder', 'Ouder dan ' + OLDEST));
  })();

  function fillModels() {
    var merk = field('merk').value, sel = field('model'), other = field('model_anders');
    while (sel.options.length) sel.remove(0);
    setError(sel, ''); other.value = '';
    if (!merk) {
      sel.appendChild(opt('', 'Kies eerst een merk'));
      sel.disabled = true; sel.hidden = false; showOther(other, false);
      return;
    }
    var list = models && models[merk];
    if (merk === OTHER || !list) {
      // Onbekend merk (of modellenlijst niet geladen): model als tekstveld
      sel.appendChild(opt('', '—'));
      sel.disabled = true; sel.hidden = true; showOther(other, true);
      return;
    }
    sel.hidden = false; sel.disabled = false; showOther(other, false);
    sel.appendChild(opt('', 'Kies model…'));
    list.forEach(function (m) { sel.appendChild(opt(m)); });
    sel.appendChild(opt(OTHER, 'Ander model…'));
  }

  function loadModels() {
    if (models !== null || !window.fetch) return Promise.resolve();
    return fetch(DATA_URL, { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) { models = d.merken || {}; })
      .catch(function () { models = false; })
      .then(function () { if (field('merk').value) fillModels(); });
  }

  field('merk').addEventListener('change', function () {
    showOther(field('merk_anders'), this.value === OTHER);
    fillModels();
    if (this.value === OTHER) field('merk_anders').focus();
  });
  field('model').addEventListener('change', function () {
    showOther(field('model_anders'), this.value === OTHER);
    if (this.value === OTHER) field('model_anders').focus();
  });

  function open(trigger) {
    loadModels();
    lastTrigger = trigger;
    intentEl.value = (trigger && trigger.getAttribute('data-wa-intent')) || 'afspraak';
    dlg.showModal();
    var first = field('kenteken');
    first.focus();
  }

  function close() { dlg.close(); }

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href^="https://wa.me/' + NUMBER + '"]');
    if (!a || dlg.contains(a)) return;
    e.preventDefault();
    open(a);
  });

  field('kenteken').addEventListener('input', function () {
    var el = this, pos = el.selectionStart;
    el.value = el.value.toUpperCase();
    try { el.setSelectionRange(pos, pos); } catch (err) {}
  });

  function clearOnEdit(e) {
    if (e.target.getAttribute('aria-invalid') === 'true') setError(e.target, '');
  }
  form.addEventListener('input', clearOnEdit);
  form.addEventListener('change', clearOnEdit);

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var bad = validate();
    if (bad) { bad.focus(); return; }
    var url = 'https://wa.me/' + NUMBER + '?text=' + encodeURIComponent(buildMessage());
    var w = window.open(url, '_blank', 'noopener');
    if (!w) window.location.href = url;
    close();
  });

  dlg.querySelectorAll('[data-wa-close]').forEach(function (b) { b.addEventListener('click', close); });
  // Klik op de achtergrond (buiten het paneel) sluit ook
  dlg.addEventListener('click', function (e) { if (e.target === dlg) close(); });
  dlg.addEventListener('close', function () {
    if (lastTrigger && typeof lastTrigger.focus === 'function') lastTrigger.focus();
  });

  // Voor testen/screenshots
  window.ogWaForm = { open: open, buildMessage: buildMessage, validate: validate, loadModels: loadModels };
  // Modellenlijst alvast op de achtergrond laden
  if ('requestIdleCallback' in window) requestIdleCallback(loadModels); else setTimeout(loadModels, 1500);
})();
