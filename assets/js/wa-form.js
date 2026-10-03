/* OG MotoWorks – aanvraagformulier → WhatsApp (+ optioneel een kopie per e-mail via Formspree). Plain JS.
   Elke link naar wa.me/31642939555 opent eerst dit formulier; daarna opent WhatsApp met een kant-en-klaar bericht.
   Motorgegevens komen uit de gedeelde motorkeuze (assets/js/motor.js) en worden na versturen onthouden (alleen op dit apparaat).
   Zonder JS (of zonder <dialog>-ondersteuning) werken de WhatsApp-links gewoon direct. */
(function () {
  'use strict';
  var NUMBER = '31642939555';
  // Formspree-endpoint, bv. 'https://formspree.io/f/abcdwxyz'. Leeg = uit (alleen WhatsApp).
  // Aan: bij versturen gaat de aanvraag ook als e-mail via Formspree naar ons; WhatsApp opent altijd, ook als dat mislukt.
  // Let op: zet bij aanzetten ook FORMSPREE_AAN = True in site-build/build_pages.py (privacyverklaring) en bouw opnieuw.
  var FORMSPREE_ENDPOINT = '';
  var dlg = document.getElementById('wa-dialog');
  if (!dlg || typeof dlg.showModal !== 'function' || !window.OGMotor) return;
  var form = document.getElementById('wa-form');
  var intentEl = form.elements.intent;
  var lastTrigger = null;
  var OTHER = OGMotor.OTHER;
  var motor = OGMotor.bind('wa');

  // intent (data-wa-intent: afspraak/prijs/banden/vraag) + aangevinkte diensten → openingszin: zie OGMotor.klus.opening (motor.js)

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
    // jouw gegevens
    var naam = field('naam'), tel = field('telefoon'), mail = field('email'), akk = field('akkoord');
    var nOk = clean(naam.value).length >= 2;
    setError(naam, nOk ? '' : 'Vul je naam in.'); if (!nOk) first = first || naam;
    var t = clean(tel.value).replace(/[\s().-]/g, '');
    var tOk = /^(\+|00)?\d{9,14}$/.test(t);
    setError(tel, t ? (tOk ? '' : 'Vul een geldig telefoonnummer in, bijv. 06 12345678.') : 'Vul je telefoonnummer in.'); if (!tOk) first = first || tel;
    var m = clean(mail.value); // optioneel; alleen controleren als het is ingevuld
    var mOk = !m || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(m);
    setError(mail, mOk ? '' : 'Vul een geldig e-mailadres in, of laat het leeg.'); if (!mOk) first = first || mail;
    setError(akk, akk.checked ? '' : 'Vink aan dat we je gegevens mogen gebruiken voor deze aanvraag.'); if (!akk.checked) first = first || akk;
    return first;
  }

  // Alle gegevens uit het formulier als regels (ook bruikbaar voor een andere afleverroute)
  function collect() {
    var by = motor.bouwjaar();
    var km = Number(clean(field('km').value).replace(/[.\s]/g, ''));
    return {
      intent: intentEl.value || 'afspraak',
      klus: OGMotor.klus.lines(),
      winter: OGMotor.klus.winter ? OGMotor.klus.winter.info() : null,
      naam: clean(field('naam').value),
      telefoon: clean(field('telefoon').value), email: clean(field('email').value), plaats: clean(field('plaats').value),
      akkoord: !!field('akkoord').checked,
      review: !!(field('review') && field('review').checked),
      kenteken: clean(field('kenteken').value).toUpperCase(),
      merk: motor.merk(), model: motor.model(), uitvoering: motor.uitvoering(),
      bouwjaar: by ? OGMotor.yearText(by) : '',
      km: isFinite(km) ? km : null,
      banden: (field('banden') && clean(field('banden').value)) || (OGMotor.klus.get().items.indexOf('banden') !== -1 ? OGMotor.klus.get().banden : ''),
      vraag: String(field('vraag').value || '').trim()
    };
  }
  function buildMessage() {
    var d = collect();
    var op = OGMotor.klus.opening(d.intent);
    var lines = ['Hoi OG MotoWorks! ' + op.zin + (op.lijst.length && /:$/.test(op.zin) ? '\n' + op.lijst.map(function (x) { return '- ' + x; }).join('\n') : '')];
    if (op.lijst.length && !/:$/.test(op.zin)) lines.push('Laten doen:\n' + op.lijst.map(function (x) { return '- ' + x; }).join('\n'));
    if (d.winter) lines.push('Vroegboek: ' + (d.winter.vroegboek ? 'ja (geboekt t/m 30 november, afspraak t/m januari)' : 'nee'));
    if (d.naam) lines.push('Naam: ' + d.naam);
    if (d.telefoon) lines.push('Telefoon: ' + d.telefoon);
    if (d.email) lines.push('E-mail: ' + d.email);
    if (d.plaats) lines.push('Plaats/adres: ' + d.plaats);
    lines.push('Kenteken: ' + d.kenteken);
    lines.push('Merk/model: ' + clean(d.merk + ' ' + d.model));
    if (d.uitvoering) lines.push('Uitvoering: ' + d.uitvoering);
    lines.push('Bouwjaar: ' + d.bouwjaar);
    lines.push('Kilometerstand: ' + (d.km == null ? '' : d.km.toLocaleString('nl-NL') + ' km'));
    var bo = bandOverzicht();
    if (bo) lines.push('Banden – overzicht:\n' + bo.regels.map(function (r) { return '- ' + r[0] + ': ' + r[1]; }).join('\n') + '\n' + bo.tekst + '\n' + DEF);
    else if (d.banden) lines.push('Banden: ' + d.banden);
    if (d.vraag) lines.push('Vraag: ' + d.vraag);
    if (d.review) lines.push('Reviewverzoek per mail: ja');
    return lines.join('\n');
  }
  // Bandenoverzicht (regels + richtprijs) alleen als Banden aangevinkt is en het bandenmenu een overzicht heeft gemaakt
  var DEF = 'Definitieve prijs na check in de offerte.';
  function bandOverzicht() {
    var kl = OGMotor.klus.get(), bx = kl.bandExtra;
    return kl.items.indexOf('banden') !== -1 && bx && bx.regels && bx.regels.length && bx.tekst ? bx : null;
  }
  // Zachte melding (blokkeert niet): reviewverzoek aangevinkt maar geen e-mailadres
  function reviewNote() {
    var r = field('review'), note = document.getElementById('wa-review-note');
    if (!r || !note) return;
    note.textContent = r.checked && !clean(field('email').value) ? 'Voor de reviewmail hebben we je e-mailadres nodig. Vul het hierboven in als je die wilt ontvangen.' : '';
  }
  // Velden voor Formspree (worden in de mail getoond); _subject/_replyto/_gotcha zijn speciale Formspree-velden
  function formspreeData() {
    var d = collect(), kl = OGMotor.klus.get(), bx = d.banden && kl.items.indexOf('banden') !== -1 ? (kl.bandExtra || { ventielen: false, afvoeren: false, aantal: 0, totaal: null }) : null;
    var o = {
      _subject: 'Aanvraag ogmotoworks.nl – ' + (clean(d.merk + ' ' + d.model) || 'motor'),
      'Soort aanvraag': (function (op) { return op.zin + (/:$/.test(op.zin) ? ' ' + op.lijst.join('; ') : ''); })(OGMotor.klus.opening(d.intent)),
      'Naam': d.naam, 'Telefoon': d.telefoon, 'E-mail': d.email || '(niet ingevuld)', 'Plaats/adres': d.plaats || '(niet ingevuld)',
      'Kenteken': d.kenteken, 'Merk/model': clean(d.merk + ' ' + d.model), 'Uitvoering': d.uitvoering || '(niet ingevuld)',
      'Bouwjaar': d.bouwjaar, 'Kilometerstand': d.km == null ? '' : d.km.toLocaleString('nl-NL') + ' km',
      'Laten doen': d.klus.length ? d.klus.join('; ') : '(niets aangevinkt)',
      'Banden': d.banden || '(geen)', 'Vraag': d.vraag || '(geen)',
      'Haakse ventielen': bx ? (bx.ventielen ? 'ja (+€20 per set, als het past)' : 'nee') : '(n.v.t.)',
      'Oude band afvoeren': bx ? (bx.afvoeren ? 'ja (' + (bx.aantal ? bx.aantal + ' × €5' : '€5 per band') + ')' : 'nee') : '(n.v.t.)',
      'Banden overzicht': bandOverzicht() ? bandOverzicht().regels.map(function (r) { return r[0] + ': ' + r[1]; }).join('\n') : '(n.v.t.)',
      'Richtprijs banden': bandOverzicht() ? bandOverzicht().tekst + ' (incl. btw). ' + DEF : '(n.v.t.)',
      'Winterpakket': d.winter ? (d.winter.naam || '(nog kiezen)') : '(geen)',
      'Vroegboek': d.winter ? (d.winter.vroegboek ? 'ja' : 'nee') : '(n.v.t.)',
      'Akkoord gegevens voor deze aanvraag': d.akkoord ? 'ja' : 'nee',
      'Toestemming reviewverzoek per mail': d.review ? 'ja' : 'nee',
      'Pagina': location.pathname,
      'WhatsApp-bericht': buildMessage(),
      _gotcha: ''
    };
    if (d.email) o._replyto = d.email;
    return o;
  }
  // Stil versturen: geen foutmelding voor de klant; WhatsApp is altijd de hoofdroute
  function sendFormspree() {
    if (!FORMSPREE_ENDPOINT || !window.fetch) return false;
    if (clean(field('_gotcha') && field('_gotcha').value)) return false; // honeypot ingevuld = bot
    try {
      // FormData + Accept: application/json = 'simple' CORS-verzoek (geen preflight), werkt ook met keepalive
      var o = formspreeData(), fd = new FormData();
      Object.keys(o).forEach(function (k) { fd.append(k, o[k]); });
      fetch(FORMSPREE_ENDPOINT, { method: 'POST', keepalive: true, headers: { 'Accept': 'application/json' }, body: fd }).catch(function () {});
    } catch (err) {}
    return true;
  }
  function waUrl() { return 'https://wa.me/' + NUMBER + '?text=' + encodeURIComponent(buildMessage()); }

  // knop met data-dienst → bijbehorend vinkje in 'Wat wil je laten doen?' aan
  function setDienst(v) { var id = OGMotor.klus.fromDienst(v); if (id) OGMotor.klus.add(id); }

  function open(trigger) {
    lastTrigger = trigger;
    intentEl.value = (trigger && trigger.getAttribute('data-wa-intent')) || 'afspraak';
    if (trigger && trigger.hasAttribute('data-dienst')) setDienst(trigger.getAttribute('data-dienst'));
    if (trigger && trigger.hasAttribute('data-winterpakket') && OGMotor.klus.winter) OGMotor.klus.winter.set(trigger.getAttribute('data-winterpakket'));
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
  if (field('review')) { field('review').addEventListener('change', reviewNote); field('email').addEventListener('input', reviewNote); }
  var fsNote = dlg.querySelector('[data-fs-note]'); if (fsNote && FORMSPREE_ENDPOINT) fsNote.hidden = false;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var bad = validate();
    if (bad) { bad.focus(); return; }
    OGMotor.set(motor.read());
    reviewNote();
    sendFormspree();
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
  window.ogWaForm = { open: open, buildMessage: buildMessage, collect: collect, validate: validate, formspreeData: formspreeData, endpoint: function () { return FORMSPREE_ENDPOINT; }, loadModels: OGMotor.load, waUrl: waUrl };
})();
