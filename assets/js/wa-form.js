/* OG MotoWorks – aanvraagformulier → WhatsApp. Plain JS, geen externe diensten.
   Elke link naar wa.me/31642939555 opent eerst dit formulier; daarna opent WhatsApp met een kant-en-klaar bericht.
   Motorgegevens komen uit de gedeelde motorkeuze (assets/js/motor.js) en worden na versturen onthouden (alleen op dit apparaat).
   Zonder JS (of zonder <dialog>-ondersteuning) werken de WhatsApp-links gewoon direct. */
(function () {
  'use strict';
  var NUMBER = '31642939555';
  var dlg = document.getElementById('wa-dialog');
  if (!dlg || typeof dlg.showModal !== 'function' || !window.OGMotor) return;
  var form = document.getElementById('wa-form');
  var intentEl = form.elements.intent;
  var lastTrigger = null;
  var OTHER = OGMotor.OTHER;
  var motor = OGMotor.bind('wa');

  var INTENTS = {
    afspraak: 'Ik wil graag een afspraak maken.',
    prijs: 'Ik wil graag een prijs weten.',
    banden: 'Ik wil graag banden laten monteren.',
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

  // Alle gegevens uit het formulier als regels (ook bruikbaar voor een andere afleverroute)
  function collect() {
    var by = motor.bouwjaar();
    var km = Number(clean(field('km').value).replace(/[.\s]/g, ''));
    return {
      intent: intentEl.value || 'afspraak',
      klus: OGMotor.klus.lines(),
      naam: clean(field('naam').value),
      kenteken: clean(field('kenteken').value).toUpperCase(),
      merk: motor.merk(), model: motor.model(), uitvoering: motor.uitvoering(),
      bouwjaar: by ? OGMotor.yearText(by) : '',
      km: isFinite(km) ? km : null,
      banden: field('banden') ? clean(field('banden').value) : '',
      vraag: String(field('vraag').value || '').trim()
    };
  }
  function buildMessage() {
    var d = collect();
    var lines = ['Hoi OG MotoWorks! ' + (INTENTS[d.intent] || INTENTS.afspraak)];
    if (d.klus.length) lines.push('Laten doen:\n' + d.klus.map(function (x) { return '- ' + x; }).join('\n'));
    if (d.naam) lines.push('Naam: ' + d.naam);
    lines.push('Kenteken: ' + d.kenteken);
    lines.push('Merk/model: ' + clean(d.merk + ' ' + d.model));
    if (d.uitvoering) lines.push('Uitvoering: ' + d.uitvoering);
    lines.push('Bouwjaar: ' + d.bouwjaar);
    lines.push('Kilometerstand: ' + (d.km == null ? '' : d.km.toLocaleString('nl-NL') + ' km'));
    if (d.banden) lines.push('Banden: ' + d.banden);
    if (d.vraag) lines.push('Vraag: ' + d.vraag);
    return lines.join('\n');
  }
  function waUrl() { return 'https://wa.me/' + NUMBER + '?text=' + encodeURIComponent(buildMessage()); }

  // knop met data-dienst → bijbehorend vinkje in 'Wat wil je laten doen?' aan
  function setDienst(v) { var id = OGMotor.klus.fromDienst(v); if (id) OGMotor.klus.add(id); }

  function open(trigger) {
    lastTrigger = trigger;
    intentEl.value = (trigger && trigger.getAttribute('data-wa-intent')) || 'afspraak';
    if (trigger && trigger.hasAttribute('data-dienst')) setDienst(trigger.getAttribute('data-dienst'));
    if (field('banden')) field('banden').value = (trigger && trigger.getAttribute('data-banden')) || field('banden').value || '';
    var saved = OGMotor.get();
    var filled = saved ? motor.fill(saved) : OGMotor.load();
    dlg.showModal();
    field('kenteken').focus();
    return filled;
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
    OGMotor.set(motor.read());
    var url = waUrl();
    var w = window.open(url, '_blank', 'noopener');
    if (!w) window.location.href = url;
    close();
  });

  dlg.querySelectorAll('[data-wa-close]').forEach(function (b) { b.addEventListener('click', close); });
  // Esc in een open zoeklijst sluit alleen die lijst, niet het formulier
  dlg.addEventListener('cancel', function (e) { if (window.OGCombo && OGCombo.anyOpen(dlg)) e.preventDefault(); });
  // Klik op de achtergrond (buiten het paneel) sluit ook
  dlg.addEventListener('click', function (e) { if (e.target === dlg) close(); });
  dlg.addEventListener('close', function () {
    if (lastTrigger && typeof lastTrigger.focus === 'function') lastTrigger.focus();
  });

  // Voor testen/screenshots
  window.ogWaForm = { open: open, buildMessage: buildMessage, collect: collect, validate: validate, loadModels: OGMotor.load, waUrl: waUrl };
})();
