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

  var INTENTS = {
    afspraak: 'Ik wil graag een afspraak maken.',
    prijs: 'Ik wil graag een prijs weten.',
    vraag: 'Ik heb een vraag.'
  };

  function field(name) { return form.elements[name]; }
  function clean(v) { return String(v || '').replace(/\s+/g, ' ').trim(); }

  function setError(input, msg) {
    var err = document.getElementById(input.id + '-err');
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
    [[merk, 'Vul het merk in.'], [model, 'Vul het model in.']].forEach(function (x) {
      var ok = clean(x[0].value) !== '';
      setError(x[0], ok ? '' : x[1]);
      if (!ok) first = first || x[0];
    });
    var by = field('bouwjaar');
    var byVal = clean(by.value);
    var maxYear = new Date().getFullYear() + 1;
    var byOk = /^\d{4}$/.test(byVal) && +byVal >= 1950 && +byVal <= maxYear;
    setError(by, byVal ? (byOk ? '' : 'Vul een geldig bouwjaar in (1950–' + maxYear + ').') : 'Vul het bouwjaar in.');
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
    lines.push('Merk/model: ' + clean(field('merk').value) + ' ' + clean(field('model').value));
    lines.push('Bouwjaar: ' + clean(field('bouwjaar').value));
    lines.push('Kilometerstand: ' + km.toLocaleString('nl-NL') + ' km');
    var vraag = String(field('vraag').value || '').trim();
    if (vraag) lines.push('Vraag: ' + vraag);
    return lines.join('\n');
  }

  function open(trigger) {
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

  form.addEventListener('input', function (e) {
    if (e.target.getAttribute('aria-invalid') === 'true') setError(e.target, '');
  });

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
  window.ogWaForm = { open: open, buildMessage: buildMessage, validate: validate };
})();
