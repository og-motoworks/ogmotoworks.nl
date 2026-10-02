/* OG MotoWorks – doorzoekbare keuzelijst (ARIA-combobox) bovenop een gewone <select>.
   De <select> blijft de bron van de waarde (formulierlogica, change-events); de combobox is alleen de weergave:
   typ om te filteren, pijltjes + Enter om te kiezen, Esc om te sluiten. Geen afhankelijkheden. */
(function () {
  'use strict';
  var OTHER = '__anders';
  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9+]+/g, '');
  }
  function otherLabel(opt) { return opt.text.replace(/…$/, '').replace(/\.\.\.$/, ''); }

  function Combo(sel) {
    if (sel._combo) return sel._combo;
    var self = this;
    this.sel = sel; sel._combo = this;
    var wrap = this.wrap = document.createElement('div');
    wrap.className = 'combo';
    var input = this.input = document.createElement('input');
    input.type = 'text'; input.id = sel.id + '-zoek'; input.className = 'combo__input';
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('autocapitalize', 'off');
    input.setAttribute('enterkeyhint', 'done');
    input.spellcheck = false;
    if (sel.required) input.setAttribute('aria-required', 'true');
    var list = this.list = document.createElement('ul');
    list.className = 'combo__list'; list.id = sel.id + '-lijst';
    list.setAttribute('role', 'listbox'); list.hidden = true;
    input.setAttribute('aria-controls', list.id);
    var lbl = document.querySelector('label[for="' + sel.id + '"]');
    if (lbl) { if (!lbl.id) lbl.id = sel.id + '-label'; lbl.htmlFor = input.id; list.setAttribute('aria-labelledby', lbl.id); }
    var desc = sel.getAttribute('aria-describedby');
    if (desc) input.setAttribute('aria-describedby', desc);
    wrap.appendChild(input); wrap.appendChild(list);
    sel.parentNode.insertBefore(wrap, sel.nextSibling);
    sel.classList.add('combo__native');
    sel.tabIndex = -1;
    sel.setAttribute('aria-hidden', 'true');
    sel.focus = function (o) { input.focus(o); };   // focus() op de select (bv. bij validatie) gaat naar het zoekveld
    this.items = []; this.active = -1;

    input.addEventListener('input', function () { self.open(input.value); });
    input.addEventListener('click', function () { if (list.hidden) self.open(''); });
    input.addEventListener('keydown', function (e) { self.key(e); });
    input.addEventListener('blur', function () { self.commit(); });
    list.addEventListener('mousedown', function (e) { e.preventDefault(); }); // focus in het zoekveld houden
    list.addEventListener('click', function (e) {
      var li = e.target.closest('li[role=option]');
      if (li) self.choose(Number(li.getAttribute('data-i')));
    });
    sel.addEventListener('change', function () { self.syncValue(); });
    new MutationObserver(function (muts) {
      var opts = muts.some(function (m) { return m.type === 'childList'; });
      self.syncState();
      if (opts) self.syncValue();
    }).observe(sel, { attributes: true, attributeFilter: ['disabled', 'hidden', 'aria-invalid'], childList: true });
    this.syncState(); this.syncValue();
  }

  Combo.prototype.label = function () {
    var o = this.sel.options[this.sel.selectedIndex];
    if (!o || o.value === '') return '';
    return o.value === OTHER ? otherLabel(o) : o.text;
  };
  Combo.prototype.syncValue = function () { this.input.value = this.label(); this.close(); };
  Combo.prototype.syncState = function () {
    var s = this.sel, i = this.input;
    i.disabled = s.disabled;
    this.wrap.hidden = s.hidden;
    if (s.getAttribute('aria-invalid') === 'true') i.setAttribute('aria-invalid', 'true'); else i.removeAttribute('aria-invalid');
    var first = s.options[0];
    i.placeholder = s.disabled ? (first ? first.text : '') : (s.getAttribute('data-placeholder') || (first ? first.text : ''));
  };

  Combo.prototype.open = function (q) {
    var self = this, s = this.sel, list = this.list;
    q = String(q || '');
    var nq = norm(q), items = [], other = null, exact = false;
    if (q === this.label()) nq = '';   // tekst = huidige keuze: hele lijst tonen
    for (var k = 0; k < s.options.length; k++) {
      var o = s.options[k];
      if (o.value === '' || o.disabled) continue;
      if (o.value === OTHER) { other = o; continue; }
      var t = norm(o.text);
      if (!nq || t.indexOf(nq) !== -1) { items.push({ value: o.value, text: o.text }); if (t === nq) exact = true; }
    }
    if (!nq) { items.sort(function () { return 0; }); }
    else { // begint-met eerst
      items.sort(function (a, b) { return (norm(b.text).indexOf(nq) === 0) - (norm(a.text).indexOf(nq) === 0); });
    }
    if (other) items.push({ value: OTHER, text: nq && !exact ? otherLabel(other) + ': “' + q.trim() + '”' : other.text, typed: nq && !exact ? q.trim() : '' });
    this.items = items;
    list.textContent = '';
    if (!items.length) { this.close(); return; }
    items.forEach(function (it, n) {
      var li = document.createElement('li');
      li.id = list.id + '-' + n; li.setAttribute('role', 'option'); li.setAttribute('data-i', n);
      li.textContent = it.text;
      if (it.value === OTHER) li.className = 'combo__other';
      if (it.value === s.value) li.setAttribute('aria-selected', 'true');
      list.appendChild(li);
    });
    list.hidden = false;
    this.input.setAttribute('aria-expanded', 'true');
    var cur = -1;
    if (nq) cur = 0; else items.forEach(function (it, n) { if (it.value === s.value && s.value !== OTHER) cur = n; });
    this.setActive(cur);
  };
  Combo.prototype.close = function () {
    this.list.hidden = true; this.active = -1;
    this.input.setAttribute('aria-expanded', 'false');
    this.input.removeAttribute('aria-activedescendant');
  };
  Combo.prototype.isOpen = function () { return !this.list.hidden; };
  Combo.prototype.setActive = function (n) {
    var lis = this.list.children;
    if (this.active >= 0 && lis[this.active]) lis[this.active].classList.remove('is-active');
    this.active = n;
    if (n >= 0 && lis[n]) {
      lis[n].classList.add('is-active');
      this.input.setAttribute('aria-activedescendant', lis[n].id);
      if (lis[n].scrollIntoView) lis[n].scrollIntoView({ block: 'nearest' });
    } else this.input.removeAttribute('aria-activedescendant');
  };
  Combo.prototype.key = function (e) {
    var open = this.isOpen(), n = this.items.length;
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!open) this.open(''); else this.setActive(Math.min(n - 1, this.active + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (open) this.setActive(Math.max(0, this.active - 1)); }
    else if (e.key === 'Enter') {
      if (open && (this.active >= 0 || n === 1)) { e.preventDefault(); this.choose(this.active >= 0 ? this.active : 0); }
    } else if (e.key === 'Escape') {
      if (open) { e.preventDefault(); e.stopPropagation(); this.input.value = this.label(); this.close(); }
    }
  };
  Combo.prototype.choose = function (n) {
    var it = this.items[n]; if (!it) return;
    var s = this.sel, typed = it.typed || '';
    this.close();
    if (s.value !== it.value) { s.value = it.value; s.dispatchEvent(new Event('change', { bubbles: true })); }
    this.input.value = this.label();
    if (it.value === OTHER) {
      var oth = document.getElementById(s.getAttribute('data-other') || '');
      if (oth) { if (typed) oth.value = typed; oth.focus(); }
    }
  };
  // Bij verlaten: exacte of enige treffer kiezen; onbekende tekst = "Anders" met die tekst; leeg = keuze wissen.
  Combo.prototype.commit = function () {
    var q = this.input.value.trim(), s = this.sel;
    if (q === this.label()) { this.close(); return; }
    if (!q) {
      this.close();
      if (s.value !== '') { s.value = ''; s.dispatchEvent(new Event('change', { bubbles: true })); }
      return;
    }
    this.open(q);
    var nq = norm(q), hit = -1, real = this.items.filter(function (it) { return it.value !== OTHER; });
    this.items.forEach(function (it, i) { if (it.value !== OTHER && norm(it.text) === nq) hit = i; });
    if (hit < 0 && real.length === 1) hit = 0;
    if (hit < 0) this.items.forEach(function (it, i) { if (it.value === OTHER) hit = i; });
    if (hit >= 0) {
      var it = this.items[hit], typed = it.typed;
      this.close();
      if (s.value !== it.value) { s.value = it.value; s.dispatchEvent(new Event('change', { bubbles: true })); }
      this.input.value = this.label();
      if (it.value === OTHER && typed) { var oth = document.getElementById(s.getAttribute('data-other') || ''); if (oth && !oth.value) oth.value = typed; }
    } else { this.input.value = this.label(); this.close(); }
  };

  window.OGCombo = {
    enhance: function (sel) { return sel && (sel._combo || new Combo(sel)); },
    anyOpen: function (root) {
      return [].some.call((root || document).querySelectorAll('.combo__list'), function (l) { return !l.hidden; });
    }
  };
})();
