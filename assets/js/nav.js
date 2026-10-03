/* OG MotoWorks – hoofdmenu: submenu's (disclosure-patroon) + hamburger op mobiel. Toetsenbord: Tab, Enter/Spatie, Esc. */
(function () {
  'use strict';
  document.documentElement.classList.add('js');
  var nav = document.getElementById('hoofdmenu');
  var burger = document.querySelector('.nav-burger');
  if (!nav) return;
  var toggles = [].slice.call(nav.querySelectorAll('.nav__toggle'));
  var desktop = window.matchMedia('(min-width:1000px)');

  function setSub(btn, open) { btn.setAttribute('aria-expanded', open ? 'true' : 'false'); }
  function closeAll(except) { toggles.forEach(function (b) { if (b !== except) setSub(b, false); }); }
  function setMenu(open) {
    if (!burger) return;
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    burger.setAttribute('aria-label', open ? 'Menu sluiten' : 'Menu openen');
    nav.classList.toggle('is-open', open);
    if (!open) closeAll();
  }
  toggles.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') !== 'true';
      if (desktop.matches) closeAll(btn);
      setSub(btn, open);
    });
  });
  if (burger) burger.addEventListener('click', function () {
    var open = burger.getAttribute('aria-expanded') !== 'true';
    setMenu(open);
    if (open) { var f = nav.querySelector('a'); if (f) f.focus(); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var openBtn = toggles.filter(function (b) { return b.getAttribute('aria-expanded') === 'true'; })[0];
    if (openBtn && nav.contains(document.activeElement)) { setSub(openBtn, false); openBtn.focus(); return; }
    if (burger && burger.getAttribute('aria-expanded') === 'true') { setMenu(false); burger.focus(); }
  });
  // Klik buiten het menu of focus die het menu verlaat: submenu's (en mobiel menu) sluiten
  document.addEventListener('click', function (e) {
    if (nav.contains(e.target) || (burger && burger.contains(e.target))) return;
    closeAll(); if (!desktop.matches) setMenu(false);
  });
  nav.addEventListener('focusout', function (e) {
    if (desktop.matches && e.relatedTarget && !nav.contains(e.relatedTarget)) closeAll();
  });
  // Klik op een link (ook #anker op dezelfde pagina) sluit het mobiele menu
  nav.addEventListener('click', function (e) { if (e.target.closest('a') && !desktop.matches) setMenu(false); });
  desktop.addEventListener && desktop.addEventListener('change', function () { setMenu(false); });
})();
