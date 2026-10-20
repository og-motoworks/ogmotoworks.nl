"use strict";
let DATA = null; // geladen uit /assets/data/*.json (zelfde bron en formule als de vorige site)
const BODY = document.body.dataset;
const R = window.OG_ROUTES; // route -> echte URL (per taal), uit de build
const FORMSPREE = "https://formspree.io/f/myezrojv";
// Mailknop naast elke WhatsApp-aanvraagknop (19 okt 2026). Teksten in MAIL_T (EN via app_en.py); regeleinden %0D%0A.
const MAIL = "info@ogmotoworks.nl";
const MAIL_T = { btn: "Mail ons", std: "Aanvraag via website", winter: "Aanvraag winterpakket via website", lines: ["Naam:", "Motor (merk, model, bouwjaar):", "Kenteken:", "Wat moet er gebeuren:"], winterLine: "Winterpakket (Basis, Plus of Compleet):" };
const mailTpl = (winter) => (winter ? [...MAIL_T.lines.slice(0, 3), MAIL_T.winterLine, MAIL_T.lines[3]] : MAIL_T.lines).map((l) => l + " \n").join("");
const mailHref = (subject, body) => "mailto:" + MAIL + "?subject=" + encodeURIComponent(subject) + "&amp;body=" + encodeURIComponent(String(body).replace(/\r?\n/g, "\r\n"));
// /motor-schade/ (9 okt 2026): vraag in "Goed om te weten" op de probleempagina's en link op de homepage. EN via app_en.py.
const SCHADE = { faq: ["Gevallen of aangereden?", `We bekijken de schade, overleggen met de expert van je verzekeraar en zoeken mee naar de beste reparatie. <a href="${R.schade}">Lees wat je doet bij motorschade</a>.`], home: "Schade na een val? ↗" };
// Extra's bij banden (incl. btw, standaard uit): haakse ventielen per set (één keer per aanvraag), oude band afvoeren per band.
const VENTIELEN = 20,
  AFVOEREN = 5;
const EN = document.documentElement.lang === "en";
const $ = (q) => document.querySelector(q),
  $$ = (q) => Array.from(document.querySelectorAll(q));
const escapeHTML = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
// Bedrag als €20 / €1.234 (zelfde notatie als de vaste teksten: €75, €350), zonder spatie na het euroteken.
const euro = (n) => "€" + new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 0 }).format(n);
// Datum voluit: 3 oktober 2026 / 3 October 2026
const datumLang = (iso) => {
  const d = new Date(iso);
  return isNaN(d) ? String(iso ?? "") : d.toLocaleDateString(EN ? "en-GB" : "nl-NL", { day: "numeric", month: "long", year: "numeric" });
};
const motorLabel = (m) =>
  m
    ? [m.merk, m.model, m.uitvoering, m.jaar && `(${m.jaar})`]
        .filter(Boolean)
        .join(" ")
    : "";
const sizeKey = (s) => {
  const n = String(s).match(/\d+/g);
  return n && n.length === 3 ? n.join("/") : "";
};
function matchOEM(m) {
  if (!m) return null;
  const matches = DATA.banden.maten.filter(
    (x) =>
      x.merk === m.merk &&
      x.model === m.model &&
      Number(m.jaar) >= x.van &&
      (!x.tot || Number(m.jaar) <= x.tot) &&
      (!x.uitvoering || x.uitvoering.includes(m.uitvoering || "")),
  );
  return matches.length === 1 && !matches[0].opties ? matches[0] : null;
}
const MOTOR_KEY = "ogmw.motor.v1"; // zelfde sleutel als de vorige site: gekozen motor blijft bewaard
const clean = (v) => (typeof v === "string" && !v.startsWith("__") ? v.trim() : "");
function loadMotor() {
  try {
    const s = JSON.parse(localStorage.getItem(MOTOR_KEY));
    if (!s) return null;
    const m = { merk: clean(s.merk), model: clean(s.model), uitvoering: clean(s.uitvoering), jaar: String(s.bouwjaar ?? s.jaar ?? "").trim() };
    return m.merk && m.model && Number(m.jaar) >= 1900 && Number(m.jaar) <= 2027 ? m : null;
  } catch {
    return null;
  }
}
const STORE = "ogmw.aanvraag.v1"; // klantgegevens + concepten: alleen sessiegeheugen van dit tabblad
let saved = {};
try {
  saved = JSON.parse(sessionStorage.getItem(STORE)) || {};
} catch {}
let motor = loadMotor(),
  pending = "",
  intent = saved.intent || "onderhoud",
  summaryText = "",
  sentText = "";
let limits = { voor: 8, achter: 8 };
const customer = Object.assign({ naam: "", telefoon: "", email: "", kenteken: "", review: "" }, saved.customer); // review: "ja" of "" (optioneel reviewvinkje)
const drafts = Object.assign({ onderhoud: {}, probleem: {}, banden: {}, ombouw: {} }, saved.drafts);
function persist() {
  try {
    sessionStorage.setItem(STORE, JSON.stringify({ intent, customer, drafts }));
  } catch {}
}
// Winterpakketten 2026 v2.2 (prijzen incl. btw, 'vanaf'). Boeken t/m 30 november 2026. Geen vroegboekkorting.
const WINTER = [
  { naam: "Winterklaar Basis", prijs: 89 },
  { naam: "Winterklaar Plus", prijs: 209 },
  { naam: "Winterklaar Compleet", prijs: 329 },
];
const winterOn = () => BODY.winterpage === "1" || BODY.winter === "live";
const winterLabel = (w) => w.naam + " (vanaf " + euro(w.prijs) + ")";
const winterOf = (beurt) => WINTER.find((w) => beurt && beurt.startsWith(w.naam + " ("));
const SERVICES = {
  onderhoud: {
    title: "Onderhoud",
    description: "Beurt volgens schema",
    text: "Vertel ons welke beurt je wilt. Je krijgt vooraf een offerte die past bij jouw motor.",
    price: "€75 / uur",
    priceNote: "Onderdelen worden apart berekend.",
  },
  probleem: {
    title: "Probleem of storing",
    description: "Waarschuwingslampje, lekkage of schade na een val",
    text: "Vertel wat je merkt. We kijken met je mee en bespreken de volgende stap.",
    price: "€75 / uur",
    priceNote:
      "Onderzoek en reparatie in overleg. Eerst weten waar je aan toe bent.",
  },
  banden: {
    title: "Banden",
    description: "Advies en prijs voor jouw maat",
    text: "Kies passende maten en bekijk het assortiment. In de offerte controleren we je keuze en de prijs.",
    price: "€50 / band",
    priceNote: "Montage incl. btw. De band zelf komt erbij.",
  },
  ombouw: {
    title: "Ombouw & verlichting",
    description: "Knipperlichten en accessoires",
    text: "Maak je motor zoals jij hem wilt. Vertel welke verlichting of accessoires je wilt laten monteren.",
    price: "Op aanvraag",
    priceNote: "Vooraf een offerte. Meerwerk altijd na overleg.",
  },
};
// Nieuwe foto's (19 okt 2026, FOTOS24): eigen foto per keuzeknop als <img> met alt; knop 01 en 04 houden hun CSS-achtergrond.
const SERVICE_FOTO = {
  probleem: { src: "/assets/og/69055eadb5a7f728.webp", w: 480, h: 640, alt: "Open carburateurs op onze werkbank bij OG MotoWorks" },
  banden: { src: "/assets/og/67a61a5ce7d923b3.webp", w: 480, h: 640, alt: "Achterwiel met een Bridgestone Battlax-band op de paddockstand bij OG MotoWorks" },
};
function selected() {
  return `<div class="selected"><div><small>JOUW MOTOR</small><strong>${motor ? escapeHTML(motorLabel(motor)) : "Nog geen motor gekozen"}</strong></div><button class="btn secondary" data-motor>${motor ? "Wijzig" : "Kies je motor"}</button></div>`;
}
function cards() {
  return `<div class="cards">${Object.entries(SERVICES)
    .map(
      ([k, v], i) =>
        `<a class="service${SERVICE_FOTO[k] ? " has-photo" : ""}" href="${R[k]}">${SERVICE_FOTO[k] ? `<img class="service-photo" src="${SERVICE_FOTO[k].src}" width="${SERVICE_FOTO[k].w}" height="${SERVICE_FOTO[k].h}" loading="lazy" decoding="async" alt="${SERVICE_FOTO[k].alt}">` : ""}<span class="num">0${i + 1} ↗</span><h3>${v.title}</h3><p>${v.description}</p></a>`,
    )
    .join("")}</div>`;
}
function crumbs(title, own) {
  let c = [];
  try {
    c = own ? JSON.parse(BODY.crumbs || "[]") : [];
  } catch {}
  if (c.length < 2) return `<a href="${R.home}">Home</a> / ${escapeHTML(title)}`;
  return c.map(([n, u], i) => (i < c.length - 1 ? `<a href="${escapeHTML(u)}">${escapeHTML(n)}</a>` : escapeHTML(n))).join(" / ");
}
function pagehead(title, text, bg, own = false) {
  return `<section class="pagehead" data-bg="${BODY.bg || bg}"><div class="wrap"><div class="breadcrumbs">${crumbs(title, own)}</div><span class="eyebrow">OG MotoWorks · Waalwijk</span><h1>${title}</h1><p>${text}</p></div></section>`;
}
// Eigen kop van deze pagina (uit de build); anders Freddy's standaardkop.
const own = (t) => (BODY.h1 ? escapeHTML(BODY.h1) : t),
  ownText = (t) => (BODY.lead ? escapeHTML(BODY.lead) : t);
function processSteps() {
  return `<div class="steps"><div class="step"><h3><b>01</b> Jouw motor</h3><p>Kies je motor en vertel wat je nodig hebt.</p></div><div class="step"><h3><b>02</b> Offerte & datum</h3><p>We bespreken de prijs en een beschikbare datum.</p></div><div class="step"><h3><b>03</b> Aan de slag</h3><p>Werk op afspraak. Meerwerk alleen na overleg.</p></div></div>`;
}
function faqBlock(k = "algemeen") {
  const rows =
    k === "banden"
      ? [
          [
            "Ik weet mijn bandenmaat niet. Wat nu?",
            "Je kunt zonder bandenkeuze advies aanvragen. Vul je motor in en vertel dat je hulp wilt; we controleren de maat met je.",
          ],
          [
            "Is montage inbegrepen in de bandprijs?",
            "Nee. De bandprijs en €50 montage per band staan apart. Bij een complete keuze zie je het gezamenlijke bedrag. Extra werkzaamheden worden vooraf besproken.",
          ],
          [
            "Zijn de banden direct beschikbaar?",
            "De lijst is een assortiment, geen live voorraad. We bevestigen beschikbaarheid en definitieve prijs in de offerte.",
          ],
        ]
      : [
          [
            "Moet ik precies weten wat er nodig is?",
            "Nee. Kies wat het beste past en beschrijf kort je vraag. We denken met je mee.",
          ],
          [
            "Wanneer staat mijn afspraak vast?",
            "Na onze bevestiging. Een WhatsApp-aanvraag is nog geen boeking.",
          ],
          [
            "Wat gebeurt er bij extra werk?",
            "Meerwerk wordt eerst met je besproken. Je krijgt vooraf duidelijkheid over de kosten.",
          ],
        ];
  if (k === "probleem" && location.pathname !== R.schade) rows.unshift(SCHADE.faq);
  return `<div class="faq"><h2>Goed om te weten</h2>${rows.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join("")}</div>`;
}

const REVIEWS = [
  {
    name: "Ismael B.",
    text: "Ik had een lekke band en gelukkig kon ik dezelfde dag nog terecht bij OG Motoworks. De communicatie verloopt erg fijn en …",
  },
  {
    name: "Dyrich V.",
    text: "Goede service, werkt best snel! Denkt graag met je mee en is eerlijk in adviezen!",
  },
  {
    name: "Emin U.",
    text: "Met al mijn motoren ben ik hier altijd welkom. Er wordt altijd duidelijk gecommuniceerd en kan er zeker altijd met spoed terecht …",
  },
  {
    name: "Linda G.",
    text: "Fijne motorzaak en is bereid om mee te denken! Persoonlijk contact en service. Een aanrader als je een betrouwbaar adres zoekt voor …",
  },
  {
    name: "Darko A.",
    text: "Na meerdere teleurstellende ervaringen met grotere shops en dealers, eindelijk iemand gevonden die met passie én oog voor detail werkt. … Kleine …",
  },
  {
    name: "Pleun van D.",
    text: "Mega tevreden! Freddy is kundig, was heel duidelijk in zijn uitleg en heeft echt het beste voor met de klant. Hij neemt …",
  },
  {
    name: "Ili H.",
    text: "Ik kom regelmatig bij OG Motoworks voor onderhoud aan mijn motor. Er wordt echt de tijd genomen om goed naar eventuele problemen …",
  },
  {
    name: "Robin Van D.",
    text: "Al meerdere malen hier geweest, onderhoud, olie lekkage, nieuwe bandjes. Elke keer alles netjes geregeld. Goede prijs, wordt netjes op de hoogte …",
  },
];
let reviewTimer = null;
// Google-reviews (8 okt 2026): de nachtelijke GitHub Action zet ze in /assets/data/reviews.json (archief, nieuwste eerst).
// Lukt het laden niet of is het bestand ongeldig, dan tonen we REVIEWS hierboven (stand 1 oktober 2026).
// Teksten nooit aanpassen of vertalen; alleen inkorten met een link naar Google.
let reviewData = null;
const REVIEW_MAX = 220;
// Regel Freddy (13 okt 2026): maximaal de 6 nieuwste reviews met 4 of 5 sterren (Google en handmatig gelijk), nieuwste eerst.
const REVIEW_TOON = 6;
const REVIEWS_ALLE = "https://www.google.com/maps/search/?api=1&query=OG%20MotoWorks&query_place_id=ChIJwTtwaLGVxkcRzA1mWT-fP6Q";
function reviewList() {
  const ok = (r) => r && typeof r.tekst === "string" && r.tekst.trim() && r.naam && Number(r.sterren) >= 4 && Number(r.sterren) <= 5;
  const t = (r) => { const d = Date.parse(r.datum || ""); return isNaN(d) ? -Infinity : d; }; // zonder datum (seed) achteraan
  const list = Array.isArray(reviewData?.reviews) ? reviewData.reviews.filter(ok).map((r, i) => [r, i]).sort((a, b) => t(b[0]) - t(a[0]) || a[1] - b[1]).map((x) => x[0]) : [];
  if (!list.length) return { items: REVIEWS.slice(0, REVIEW_TOON).map((r) => ({ naam: r.name, tekst: r.text, sterren: 5, taal: "nl" })), datum: "2026-10-01", alle: REVIEWS_ALLE };
  const n = Math.min(Math.max(Number(reviewData.toon) || REVIEW_TOON, 1), REVIEW_TOON);
  return { items: list.slice(0, n), datum: reviewData.bijgewerkt || "2026-10-01", alle: /^https:\/\//.test(reviewData.alle_reviews_url || "") ? reviewData.alle_reviews_url : REVIEWS_ALLE };
}
function reviewDate(iso) {
  const d = new Date(iso);
  if (!iso || isNaN(d)) return "";
  const days = Math.floor((Date.now() - d) / 864e5),
    rtf = new Intl.RelativeTimeFormat(EN ? "en" : "nl", { numeric: days < 2 ? "auto" : "always" }); // vandaag, gisteren, 2 dagen geleden
  if (days < 0) return "";
  if (days < 7) return rtf.format(-days, "day");
  if (days < 35) return rtf.format(-Math.floor(days / 7), "week");
  return d.toLocaleDateString(EN ? "en-GB" : "nl-NL", { month: "short", year: "numeric" }).replace(".", "");
}
const safeUrl = (u) => (/^https:\/\/[^\s"'<>]+$/.test(u || "") ? u : "");
function reviewCard(r, alle) {
  const stars = Math.round(Number(r.sterren)),
    full = r.tekst.trim(),
    cut = full.length > REVIEW_MAX ? full.slice(0, full.lastIndexOf(" ", REVIEW_MAX - 1) > 120 ? full.lastIndexOf(" ", REVIEW_MAX - 1) : REVIEW_MAX - 1).trim() + " …" : full,
    more = cut !== full || /…$/.test(full),
    when = reviewDate(r.datum),
    name = escapeHTML(r.naam),
    who = safeUrl(r.auteur_url) ? `<a href="${escapeHTML(r.auteur_url)}" target="_blank" rel="noopener">${name}</a>` : name,
    lang = /^[a-z]{2}(-[A-Z]{2})?$/.test(r.taal || "") ? ` lang="${r.taal}"` : "";
  return `<figure class="quote-card"><div class="review-stars" aria-label="${stars} van 5 sterren">${"★".repeat(stars)}${"☆".repeat(5 - stars)} <span>Google</span></div><blockquote${lang}>${escapeHTML(cut)}</blockquote>${more ? `<a class="rv-more" href="${escapeHTML(safeUrl(r.google_url) || alle)}" target="_blank" rel="noopener">Lees meer op Google ↗</a>` : ""}<figcaption>${who}${when ? `<span class="rv-date">${escapeHTML(when)}</span>` : ""}</figcaption></figure>`;
}
/* HEROCARROUSEL 20 okt 2026 */
let heroTimer = null;
function initHeroCarousel() {
  clearInterval(heroTimer); heroTimer = null;
  const box = $("[data-carousel]");
  if (!box) return;
  const s = [...box.querySelectorAll(".wh-slide")];
  if (s.length < 2) return; /* HERODRAAIT: ook bij reduced-motion, dan met korte fade (CSS) */
  const fill = () => box.querySelectorAll("[data-src],[data-srcset]").forEach((e) => {
    if (e.dataset.srcset) { e.srcset = e.dataset.srcset; e.removeAttribute("data-srcset"); }
    if (e.dataset.src) { e.src = e.dataset.src; e.removeAttribute("data-src"); }
  });
  if (document.readyState === "complete") setTimeout(fill, 300); else window.addEventListener("load", fill, { once: true });
  let i = 0, paused = false, t = null, ht = null;
  const set = (v) => (paused = v);
  box.addEventListener("mouseenter", () => { set(true); clearTimeout(ht); ht = setTimeout(() => set(false), 12000); });
  box.addEventListener("mouseleave", () => { clearTimeout(ht); set(false); });
  box.addEventListener("focusin", () => set(true));
  box.addEventListener("focusout", () => set(false));
  box.addEventListener("touchstart", () => { clearTimeout(t); set(true); }, { passive: true });
  box.addEventListener("touchend", () => { clearTimeout(t); t = setTimeout(() => set(false), 5000); }, { passive: true });
  heroTimer = setInterval(() => {
    if (paused || document.hidden) return;
    const n = (i + 1) % s.length, img = s[n].querySelector("img");
    if (img && (img.dataset.src || !img.complete || !img.naturalWidth || img.naturalWidth < 2)) return;
    s[i].classList.remove("is-active"); s[i].setAttribute("aria-hidden", "true");
    s[n].classList.add("is-active"); s[n].removeAttribute("aria-hidden"); i = n;
  }, 6000);
}
const MIX_POOL = [["/assets/og/fbab2b26cb8a1c67.jpg", "Freddy van OG MotoWorks stelt de koppelingskabel van een BMW M 1000 R af bij blok en hendel, zodat de koppeling weer vrije speling heeft en 100% grijpt", "Freddy from OG MotoWorks adjusts the clutch cable of a BMW M 1000 R at the engine and lever, so the clutch has free play again and grips fully", "Slippende koppeling M 1000 R verholpen", "Slipping M 1000 R clutch fixed", "40% 50%"], ["/assets/og/96faa0aebae8cc16.webp", "Nieuwe ketting en achtertandwiel op een blauwe velg, net gemonteerd bij OG MotoWorks", "New chain and rear sprocket on a blue wheel, just fitted at OG MotoWorks", "Nieuwe kettingset gemonteerd", "New chain kit fitted", ""], ["/assets/og/ac0a9ec9df792149.webp", "Motor op de hefbrug bij OG MotoWorks: bij het demonteren voor een nieuwe uitlaat brak een spruitstukbout af in het blok, die we eruit hebben gehaald", "Bike on the lift at OG MotoWorks: a manifold bolt snapped in the engine while removing the exhaust for a new one, and we extracted it", "Afgebroken uitlaatbout uit het blok", "Snapped exhaust bolt removed", ""], ["/assets/og/c23dc24f7b97c31f.webp", "Rood-wit voorwiel met sportband, door OG MotoWorks schoongemaakt", "Red-white front wheel with sports tyre, cleaned by OG MotoWorks", "Voorwiel schoongemaakt", "Front wheel cleaned", ""], ["/assets/og/1ce3e2ad8f70fe0c.webp", "Drie motorrijders op hun motoren, weer op weg", "Three riders on their bikes, back on the road", "Drie tevreden klanten, weer op weg", "Three happy riders, back on the road", ""], ["/assets/og/d4c440bce03ab51e.webp", "Freddy leest met een diagnosetablet een BMW GS uit op de motorbrug", "Freddy reading out a BMW GS with a diagnostic tablet on the motorcycle lift", "BMW GS uitlezen met tablet", "Reading out a BMW GS", ""], ["/assets/og/4257e6c5efa08485.webp", "BMW M 1000 R zonder kuip en tank bij OG MotoWorks: voor de nieuwe tuning hebben we het luchtfilterhuis aangepast en de temperatuursensor verplaatst", "BMW M 1000 R without fairing and tank at OG MotoWorks: for the new tuning we modified the airbox and relocated the temperature sensor", "M 1000 R uitgebouwd voor nieuwe tuning", "M 1000 R stripped for new tuning", "55% 50%"], ["/assets/og/f30af2a867cafd0e.webp", "Freddy van OG MotoWorks bij een gele Yamaha: de achterband liep leeg en met een sopje vonden we het gaatje", "Freddy from OG MotoWorks with a yellow Yamaha: the rear tyre kept losing air and we found the hole with soapy water", "Lek achterband gevonden met sopje", "Rear tyre leak found with soapy water", "50% 50%"], ["/assets/og/93478da69d6ff39a.webp", "Yamaha FZ1N met het klepdeksel eraf bij OG MotoWorks: nokkenassen en distributieketting vrij om de klepspeling af te stellen", "Yamaha FZ1N with the valve cover off at OG MotoWorks: camshafts and timing chain exposed to adjust the valve clearance", "Klepspeling Yamaha FZ1N afstellen", "Adjusting Yamaha FZ1N valve clearance", "50% 50%"], ["/assets/og/63bcc500edf3b2bf.webp", "We meten na bij het afstellen van ketting en achterwiel van een wit-rode custom motor", "We measure while adjusting the chain and rear wheel of a white and red custom bike", "Ketting afstellen met meetlat", "Chain adjusted with a rule", "62% 50%"], ["/assets/og/27ac5d0f76fb0f50.webp", "Motor van bovenaf met de tank eraf en de carburateurs uitgebouwd", "Motorcycle seen from above with the tank off and the carburettors removed", "Tank eraf, carburateurs uitgebouwd", "Tank off, carburettors removed", "55% 50%"], ["/assets/og/3ca9d7243c2bdbbe.webp", "BMW F900XR bij OG MotoWorks: verlicht logo inbouwen", "BMW F900XR at OG MotoWorks: fitting an illuminated logo", "BMW F900XR: verlicht logo inbouwen", "BMW F900XR: fitting an illuminated logo", "45% 50%"], ["/assets/og/b7b53cb96d2ef66c.webp", "Goudkleurige voorvork, remklauw en remschijf van een sportmotor op de paddockstand", "Gold front fork, brake caliper and disc of a sports bike on a paddock stand", "Gouden voorvork en remklauw", "Gold fork and brake caliper", "40% 50%"], ["/assets/og/959d17ccfa01aa7d.webp", "Suzuki GSX-R750 bij aflevering, door OG MotoWorks volledig opnieuw opgebouwd met een nieuwe full carbon kuipset", "Suzuki GSX-R750 at delivery, fully rebuilt by OG MotoWorks with a new full carbon fairing set", "Suzuki GSX-R750 met full carbon kuip", "Suzuki GSX-R750 in full carbon", ""], ["/assets/og/96a6c3b59b88e419.webp", "Vooraanzicht van de Suzuki GSX-R750 met nieuwe full carbon kuipset, volledig opgebouwd door OG MotoWorks", "Front view of the Suzuki GSX-R750 with a new full carbon fairing set, fully rebuilt by OG MotoWorks", "GSX-R750 opgebouwd, klaar voor aflevering", "GSX-R750 rebuilt, ready for delivery", ""], ["/assets/og/7b0625950d6c822c.webp", "Yamaha R7 bij OG MotoWorks die het verschil laat zien tussen stealth-spiegels en een normale spiegel", "Yamaha R7 at OG MotoWorks showing the difference between stealth mirrors and a standard mirror", "Yamaha R7: stealth- vs normale spiegel", "Yamaha R7: stealth vs stock mirror", ""], ["/assets/og/9617a9366f91f823.webp", "Rood K&N-luchtfilter bij OG MotoWorks, klaar om te monteren", "Red K&N air filter at OG MotoWorks, ready to fit", "K&N-luchtfilter", "K&N air filter", ""], ["/assets/og/9a5ab86f8afdfad0.webp", "Voorvorkpoot die olie lekt, van dichtbij bij OG MotoWorks", "A fork leg leaking oil, up close at OG MotoWorks", "Lekkende voorvorkpoot", "Leaking fork leg", ""], ["/assets/og/a111ea600310e170.webp", "Uitlaatbochten onder het blok, weer gemonteerd nadat OG MotoWorks de afgebroken spruitstukbout had verwijderd", "Exhaust headers under the engine, refitted after OG MotoWorks removed the snapped manifold bolt", "Uitlaatbout hersteld, alles weer gemonteerd", "Exhaust bolt fixed, all refitted", ""], ["/assets/og/1f1c2e4e88a50993.webp", "Gecustomizede Yamaha FZ1N uit 2015 in onze werkplaats, met andere kuipdelen, stickers, een koplampmasker en veel andere details", "Customised 2015 Yamaha FZ1N in our workshop, with different fairing panels, decals, a headlight mask and many other details", "Custom Yamaha FZ1N (2015)", "Custom Yamaha FZ1N (2015)", ""], ["/assets/og/e7575824179c5348.webp", "Close-up van de gecustomizede Yamaha FZ1N uit 2015 met stuur en koplampmasker", "Close-up of the customised 2015 Yamaha FZ1N with bars and headlight mask", "Custom FZ1N van dichtbij", "Custom FZ1N up close", ""], ["/assets/og/b38577642d6bf19b.webp", "Carburateurs op de werkbank, klaar voor revisie", "Carburettors on the workbench, ready for overhaul", "Carburateurs klaar voor revisie", "Carburettors ready for overhaul", ""], ["/assets/og/2f3d9bdb0551a856.webp", "KTM 1290 Super Duke met custom remschijven op het voorwiel, en de tank", "KTM 1290 Super Duke with custom brake discs on the front wheel, and the tank", "Super Duke met custom remschijven", "Super Duke with custom brake discs", ""], ["/assets/og/5a39b56ced11f084.webp", "Voorkant van een KTM Super Duke voor een garagedeur", "Front end of a KTM Super Duke by a garage door", "KTM Super Duke, voorkant", "KTM Super Duke front end", ""], ["/assets/og/5963e3625e05d781.webp", "Motoren veilig binnen in een van de werkplaatsunits van OG MotoWorks", "Motorcycles safe inside one of the OG MotoWorks workshop units", "Motoren veilig binnen in onze werkplaats", "Bikes safe inside our workshop", ""], ["/assets/og/c760bb91d663ed9b.webp", "Tank en blok van de gecustomizede Yamaha FZ1N uit 2015 van dichtbij", "Tank and engine of the customised 2015 Yamaha FZ1N up close", "FZ1N custom: tank en blok", "FZ1N custom: tank and engine", ""], ["/assets/og/58ac9bf59ccdbfb6.webp", "Blauwe Suzuki GSR750 in onze werkplaats: na valschade hebben we de tank, zijkappen en het dynamodeksel vervangen", "Blue Suzuki GSR750 in our workshop: after crash damage we replaced the tank, side covers and alternator cover", "GSR750 na valschade hersteld", "GSR750 repaired after a crash", ""], ["/assets/og/6c5343f09d2af466.webp", "Blok en frame van de Suzuki GSR750 met de tank eraf, tijdens het herstel van de valschade", "Engine and frame of the Suzuki GSR750 with the tank off, during the crash repair", "GSR750 met de tank eraf", "GSR750 with the tank off", ""], ["/assets/og/f7844fe12fb1112a.webp", "Blok en SC-uitlaat van een zwarte Yamaha MT-07", "Engine and SC exhaust of a black Yamaha MT-07", "MT-07 met SC-uitlaat", "MT-07 with SC exhaust", ""], ["/assets/og/2bf65c6978ca9396.webp", "SC-Project-uitlaat en blok van een zwarte Yamaha MT-07, van dichtbij bij OG MotoWorks", "SC-Project exhaust and engine of a black Yamaha MT-07, up close at OG MotoWorks", "SC-Project-uitlaat op Yamaha MT-07", "SC-Project exhaust on a Yamaha MT-07", ""], ["/assets/og/ca599a8b98cdb10f.webp", "Honda CB-F zonder kuip bij OG MotoWorks: we bouwden carburateurs en luchtfilter uit, vonden losse sproeiers in de carburateur, reinigden alles en stelden de carburateurs opnieuw af", "Honda CB-F without fairing at OG MotoWorks: we removed the carburettors and air filter, found loose jets inside, cleaned everything and re-tuned the carbs", "Honda CB-F: carburateurs gereinigd en afgesteld", "Honda CB-F: carbs cleaned and tuned", ""], ["/assets/og/1e72a7a2e2c1f8d5.webp", "Gouden voorvork, carbon spatbord en golvende remschijven van een Suzuki GSX-R750 in de werkplaats van OG MotoWorks", "Gold fork, carbon mudguard and wavy brake discs of a Suzuki GSX-R750 in the OG MotoWorks workshop", "Suzuki GSX-R750: voorvork en remschijven", "Suzuki GSX-R750: fork and brake discs", ""], ["/assets/og/5dab6c5a3f8e1e7b.webp", "Een stuureinde wordt vervangen bij OG MotoWorks, van dichtbij", "A handlebar end being replaced at OG MotoWorks, up close", "Stuureinden vervangen", "Bar ends replaced", ""], ["/assets/og/b45b5bd254126b8c.webp", "Groene Kawasaki Z750 op de heftafel bij OG MotoWorks voor een aankoopkeuring", "Green Kawasaki Z750 on the lift at OG MotoWorks for a pre-purchase inspection", "Aankoopkeuring Kawasaki Z750", "Pre-purchase inspection Kawasaki Z750", ""], ["/assets/og/27173329e7b6cba5.webp", "Oliepeilglas en blok van dichtbij", "Oil sight glass and engine up close", "Oliepeil in het kijkglas", "Oil sight glass", ""], ["/assets/og/9ed75d19e1f0c485.webp", "Oranje KTM 890 Duke in de werkplaats van OG MotoWorks met custom dynamische knipperlichten en LED-dagrijverlichting", "Orange KTM 890 Duke in the OG MotoWorks workshop with custom dynamic turn signals and LED daytime running lights", "Dynamische knipperlichten op KTM 890 Duke", "Dynamic indicators on a KTM 890 Duke", ""], ["/assets/og/60f4798ea826fa31.webp", "Groene aanslag van een lekkende voorvork die helemaal doorloopt tot aan de remklauw, gezien bij OG MotoWorks", "Green deposit from a leaking front fork running all the way down to the brake caliper, spotted at OG MotoWorks", "Lekkende voorvork: groene aanslag tot remklauw", "Leaking fork: green residue down to caliper", ""], ["/assets/og/cff6f718eec0de8a.webp", "De custom Yamaha FZ1N uit 2015 bijna volledig gestript op de heftafel bij OG MotoWorks", "The custom 2015 Yamaha FZ1N almost completely stripped on the lift at OG MotoWorks", "Custom Yamaha FZ1N (2015) bijna volledig gestript", "Custom Yamaha FZ1N (2015) almost fully stripped", ""], ["/assets/og/ccf3ae0dacf49c0e.webp", "Yamaha FJR1300 die niet goed liep, tank eraf bij OG MotoWorks terwijl we de gasklephuizen uitbouwen", "Yamaha FJR1300 that wasn't running well, tank off at OG MotoWorks while we remove the throttle bodies", "Yamaha FJR1300: gasklephuizen eruit", "Yamaha FJR1300: throttle bodies removed", ""], ["/assets/og/55dbf5bc53b53d0b.webp", "Custom Yamaha FZ1N met custom koelvloeistofslangen bij OG MotoWorks", "Custom Yamaha FZ1N with custom coolant hoses at OG MotoWorks", "Custom FZ1N met custom koelvloeistofslangen", "Custom FZ1N with custom coolant hoses", ""], ["/assets/og/49fce3a48cd8a0d5.webp", "Custom Yamaha FZ1N met een carbon stuur en een Hyperpro-stuurdemper bij OG MotoWorks", "Custom Yamaha FZ1N with a carbon handlebar and a Hyperpro steering damper at OG MotoWorks", "Custom FZ1N: carbon stuur en Hyperpro-stuurdemper", "Custom FZ1N: carbon bars, Hyperpro steering damper", ""], ["/assets/og/90abf9bf2fb1ec39.webp", "Remvloeistof testen met een tester in de hand", "Testing brake fluid with a tester in hand", "Remvloeistof testen", "Testing the brake fluid", ""], ["/assets/og/83574737a431500a.webp", "De custom Yamaha FZ1N in de werkplaats van OG MotoWorks na een testrit", "The custom Yamaha FZ1N in the OG MotoWorks workshop after a test ride", "Custom FZ1N na een testrit", "Custom FZ1N after a test ride", ""], ["/assets/og/08ff400ef4395459.webp", "Oranje KTM 1290 Super Duke R Evo bij OG MotoWorks met een gas dat niet werkte", "Orange KTM 1290 Super Duke R Evo at OG MotoWorks with a throttle that didn't work", "Super Duke R Evo: gas werkte niet", "Super Duke R Evo: throttle not working", ""], ["/assets/og/aa92134975cc1add.webp", "Oude blauwe brandstoftank van een Suzuki GSR750 uit 2015 bij OG MotoWorks, waarvan we de brandstofpomp en kleine onderdelen naar een nieuwe tank overzetten", "Old blue fuel tank of a 2015 Suzuki GSR750 at OG MotoWorks, with the fuel pump and small parts being moved over to a new tank", "Suzuki GSR750: brandstofpomp naar nieuwe tank", "Suzuki GSR750: fuel pump moved to new tank", ""], ["/assets/og/6c39413eaee0c1e5.webp", "Koplamp van een blauwe Suzuki van dichtbij", "Headlight of a blue Suzuki up close", "Beschadigde koplamp opgepolijst", "Damaged headlight polished", ""], ["/assets/og/8667b8ce7862ef0b.webp", "Close-up van een lekkende voorvorkpoot van een zwarte Kawasaki Z750 in de werkplaats van OG MotoWorks", "Close-up of a leaking front fork leg on a black Kawasaki Z750 in the OG MotoWorks workshop", "Lekkende voorvorkpoot Kawasaki Z750", "Leaking fork leg on a Kawasaki Z750", ""], ["/assets/og/cef0203de0dc1d3d.webp", "Motorblok van een BMW F650GS bij OG MotoWorks dat olie lekt bij de stekker naar de dynamo", "Engine of a BMW F650GS at OG MotoWorks leaking oil at the alternator connector", "BMW F650GS: olielek bij dynamostekker", "BMW F650GS: oil leak at alternator plug", ""], ["/assets/og/1075374a73e35aac.webp", "Voorkant van een zwarte Yamaha MT-07 in het groen", "Front end of a black Yamaha MT-07 in the greenery", "Yamaha MT-07, voorkant", "Yamaha MT-07 front end", ""], ["/assets/og/55197db798bd277f.webp", "Nieuwe bougiekabels gemonteerd op het blok van een Suzuki Intruder bij OG MotoWorks", "New spark plug leads fitted to the engine of a Suzuki Intruder at OG MotoWorks", "Nieuwe bougiekabels Suzuki Intruder", "New spark plug leads on a Suzuki Intruder", ""], ["/assets/og/d39e3a1b9251f4c7.webp", "Linkerkant van een blauw-zwarte Suzuki GSR750 met schade in de werkplaats van OG MotoWorks", "Left side of a damaged blue and black Suzuki GSR750 in the OG MotoWorks workshop", "Schade linkerkant Suzuki GSR750", "Left-side damage on a Suzuki GSR750", ""], ["/assets/og/bd21b39ee9d28fe3.webp", "Oliewissel bij OG MotoWorks: de oude olie loopt af in een opvangbak onder de motor", "Oil change at OG MotoWorks: old oil draining into a drain pan under the bike", "Oliewissel in onze werkplaats", "Oil change in our workshop", ""], ["/assets/og/9e00bd4920d21367.webp", "Custom Yamaha FZ1N schoon en droog op de paddockstand bij OG MotoWorks, klaar voor de klant", "Custom Yamaha FZ1N clean and dry on the paddock stand at OG MotoWorks, ready for the customer", "Yamaha FZ1N klaar voor de klant", "Yamaha FZ1N ready for the customer", ""], ["/assets/og/3a0c519ed9ab4c31.webp", "Ketting van een Honda CB1000R nameten met een meetlint", "Measuring the chain of a Honda CB1000R with a tape measure", "Kettingspeling CB1000R meten", "Measuring CB1000R chain slack", ""], ["/assets/og/078c9ed7d34dfa0b.webp", "Witte Honda CB1000R buiten bij OG MotoWorks", "White Honda CB1000R outside at OG MotoWorks", "Honda CB1000R", "Honda CB1000R", ""], ["/assets/og/73479e9f1702463a.webp", "Honda op de heftafel in onze werkplaats", "Honda on the lift table in our workshop", "Honda CBR600F op de heftafel", "Honda CBR600F on the lift", ""], ["/assets/og/01cd525a28d0d3cf.webp", "Uitgebouwde carburateurs van een Honda van dichtbij", "Removed carburettors of a Honda up close", "CBR600F-carburateurs uitgebouwd", "CBR600F carburettors removed", ""], ["/assets/og/e6c74bdf144aa07a.webp", "Carburateur van een Honda CBR600F bij OG MotoWorks: de kamer met de gasnaald zit vol zwarte aanslag, waardoor de motor stotterde als hij warm werd", "Honda CBR600F carburettor at OG MotoWorks: the needle chamber is full of black deposits that made the engine stutter once warm", "Honda CBR600F: vervuilde carburateur, stottert warm", "Honda CBR600F: fouled carburettor, stutters when warm", ""], ["/assets/og/e7f755e0d42b6de6.webp", "Zwarte Honda CBR600F op de heftafel in de werkplaats van OG MotoWorks tijdens het carburateurwerk", "Black Honda CBR600F on the lift in the OG MotoWorks workshop during carburettor work", "Honda CBR600F in de werkplaats", "Honda CBR600F in the workshop", ""], ["/assets/og/cc8ab4f41a621adc.webp", "Achterband bij OG MotoWorks waarin we het gat hebben gevonden en gemarkeerd", "Rear tyre at OG MotoWorks where we found and marked the puncture", "Lekke band: gat gevonden en gemarkeerd", "Flat tyre: hole found and marked", ""], ["/assets/og/ee6d9616ba0a547b.webp", "Kettingspray op de ketting van een Yamaha FZ1", "Chain spray on the chain of a Yamaha FZ1", "Band controleren met sopje", "Leak test with soapy water", ""], ["/assets/og/45cdb9a0b5c1894e.webp", "Remklauw en remschijf van een Yamaha FZ1 van dichtbij", "Brake caliper and disc of a Yamaha FZ1 up close", "Versleten remblok FZ1N", "FZ1N: worn brake pad", ""], ["/assets/og/ce8aba0217e8dcd0.webp", "Gele Yamaha FZ1 op de heftafel in onze werkplaats", "Yellow Yamaha FZ1 on the lift table in our workshop", "Yamaha FZ1N op de heftafel", "Yamaha FZ1N on the lift", ""], ["/assets/og/fb128274ac34d922.webp", "BMW R1200GS Adventure uit 2008 bij OG MotoWorks, waar we met de diagnosetablet de versnellingssensor opnieuw inleren omdat hij niet in neutraal bleef", "2008 BMW R1200GS Adventure at OG MotoWorks, re-learning the gear position sensor with the diagnostic tablet because it would not stay in neutral", "BMW R1200GS Adventure: neutraalstand opnieuw ingeleerd", "BMW R1200GS Adventure: neutral position re-learned", ""]];
let mixTimer = null;
function initMix() {
  clearInterval(mixTimer); mixTimer = null;
  const box = $("[data-mix]");
  if (!box || MIX_POOL.length < 6) return;
  const reduced = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const figs = [...box.querySelectorAll("figure")];
  const shown = figs.map((f) => { const i = f.querySelector("img"); const k = MIX_POOL.findIndex((x) => i && (i.getAttribute("src") || "").endsWith(x[0]) || (i && i.alt === (EN ? x[2] : x[1]))); return k; });
  let paused = false, last = -1, t = null;
  const set = (v) => (paused = v);
  box.addEventListener("mouseenter", () => set(true)); box.addEventListener("mouseleave", () => set(false));
  box.addEventListener("focusin", () => set(true)); box.addEventListener("focusout", () => set(false));
  box.addEventListener("touchstart", () => { clearTimeout(t); set(true); }, { passive: true });
  box.addEventListener("touchend", () => { clearTimeout(t); t = setTimeout(() => set(false), 5000); }, { passive: true });
  mixTimer = setInterval(() => {
    if (paused || document.hidden) return;
    let f; do f = Math.floor(Math.random() * figs.length); while (f === last && figs.length > 1);
    const free = MIX_POOL.map((x, k) => k).filter((k) => !shown.includes(k));
    if (!free.length) return;
    const k = free[Math.floor(Math.random() * free.length)], [src, nl, en, cnl, cen, pos] = MIX_POOL[k];
    const fig = figs[f], img = fig.querySelector("img"), cap = fig.querySelector("figcaption"), pre = new Image();
    last = f; shown[f] = k;
    const swap = () => { img.removeAttribute("data-gallery-photo"); img.src = src; img.alt = EN ? en : nl; img.style.objectPosition = pos || ""; if (cap) cap.textContent = EN ? cen : cnl; };
    pre.onload = () => {
      if (reduced()) return swap();
      const dir = [["100%", "0"], ["-100%", "0"], ["0", "100%"], ["0", "-100%"]][Math.floor(Math.random() * 4)];
      const ov = document.createElement("img");
      ov.src = src; ov.alt = ""; ov.className = "mix-over"; ov.style.height = img.offsetHeight + "px"; if (pos) ov.style.objectPosition = pos; if (cap) cap.textContent = EN ? cen : cnl;
      ov.style.transform = "translate(" + dir[0] + "," + dir[1] + ")";
      fig.insertBefore(ov, img.nextSibling);
      ov.getBoundingClientRect();
      ov.style.transform = "translate(0,0)";
      setTimeout(() => {
        swap();
        setTimeout(() => ov.remove(), 60);
      }, 480);
    };
    pre.src = src;
  }, 5000);
}
function initGallery() {
  const styles = getComputedStyle(document.documentElement);
  const names = {
    MAINTENANCE_URI: "--service-maintenance",
    CHAIN_URI: "--service-problem",
    TYRE_URI: "--service-tyres",
    GROUP_URI: "--service-lights",
    HONDA_URI: "--gallery-honda",
  };
  $$("[data-gallery-photo]").forEach((img) => {
    const value = styles
      .getPropertyValue(names[img.dataset.galleryPhoto])
      .trim();
    const match = value.match(/^url\(["']?(.*?)["']?\)$/);
    if (match) img.src = match[1];
  });
}
function socialReviews() {
  const rv = reviewList();
  return `<section class="section social-section"><div class="wrap"><div class="social-head"><div><span class="eyebrow">Een kijkje in de werkplaats</span><h2>Motoren, werk & verhalen.</h2></div><a class="btn secondary instagram-btn" href="https://www.instagram.com/og_motoworks" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="18" cy="6" r="1" fill="currentColor" stroke="none"/></svg>Volg OG MotoWorks op Instagram ↗</a></div><div class="photo-mix" data-mix><figure><img data-gallery-photo="MAINTENANCE_URI" alt="Freddy sleutelt aan een BMW-motor" loading="lazy"><figcaption>Freddy aan het werk</figcaption></figure><figure><img src="/assets/og/96faa0aebae8cc16.webp" width="560" height="700" alt="Goudkleurige ketting en achtertandwiel op een blauwe velg, in onze werkplaats" loading="lazy" decoding="async"><figcaption>Ketting en achtertandwiel</figcaption></figure><figure><img src="/assets/og/ac0a9ec9df792149.webp" width="560" height="700" alt="Motor op onze hefbrug bij OG MotoWorks, met het gereedschap klaar op de werkbank" loading="lazy" decoding="async"><figcaption>Demontage op de heftafel</figcaption></figure><figure><img src="/assets/og/c23dc24f7b97c31f.webp" width="560" height="700" alt="Rood-wit voorwiel met sportband bij OG MotoWorks" loading="lazy" decoding="async"><figcaption>Rood-wit voorwiel, sportband</figcaption></figure><figure><img data-gallery-photo="GROUP_URI" alt="Drie motorrijders op verschillende motoren" loading="lazy"><figcaption>Weer op weg</figcaption></figure><figure><img src="/assets/og/b38577642d6bf19b.webp" width="560" height="700" alt="Carburateurs op de werkbank, klaar voor revisie" loading="lazy" decoding="async"><figcaption>Carburateurs klaar voor revisie</figcaption></figure></div></div></section><section class="section customer-reviews" id="reviews" aria-labelledby="reviews-title"><div class="wrap"><div class="social-head"><div><span class="eyebrow">Klanten aan het woord</span><h2 id="reviews-title">Ervaringen op Google</h2></div><button class="btn secondary" id="reviews-pause" type="button" aria-pressed="false">Pauzeer reviews</button></div><div class="review-viewport" id="review-viewport" role="region" aria-label="Klantreviews, automatisch wisselend" tabindex="0"><div class="review-track">${rv.items.map((r) => reviewCard(r, rv.alle)).join("")}</div></div><p class="note" id="reviews-updated" style="margin-top:18px">Reviews via Google Maps · Laatst bijgewerkt: ${escapeHTML(new Date(rv.datum).toLocaleDateString(EN ? "en-GB" : "nl-NL", { day: "numeric", month: "long", year: "numeric" }))}</p><div class="actions"><a class="btn secondary" id="reviews-alle" href="${escapeHTML(rv.alle)}" target="_blank" rel="noopener">Bekijk alle reviews op Google ↗</a><a class="btn text" href="https://g.page/r/CcwNZlk_nz-kEBM/review" target="_blank" rel="noopener">Schrijf een review ↗</a></div></div></section>`;
}
function initReviews() {
  if (reviewTimer) {
    clearInterval(reviewTimer);
    reviewTimer = null;
  }
  const viewport = $("#review-viewport"),
    button = $("#reviews-pause");
  if (!viewport) return;
  let paused = window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    hovered = false,
    focused = false;
  const label = () => {
    button.textContent = paused ? "Start reviews" : "Pauzeer reviews";
    button.setAttribute("aria-pressed", String(paused));
  };
  label();
  button.onclick = () => {
    paused = !paused;
    label();
  };
  viewport.onmouseenter = () => (hovered = true);
  viewport.onmouseleave = () => (hovered = false);
  // focusin/focusout bestaan niet als on…-eigenschap in Chromium/WebKit: daarom addEventListener (pauze bij toetsenbordfocus).
  viewport.addEventListener("focusin", () => (focused = true));
  viewport.addEventListener("focusout", () => (focused = false));
  reviewTimer = setInterval(() => {
    if (paused || hovered || focused || document.hidden) return;
    const cards = Array.from(viewport.querySelectorAll(".quote-card")),
      step = cards[1] ? cards[1].offsetLeft - cards[0].offsetLeft : 0;
    if (!step) return;
    const max = viewport.scrollWidth - viewport.clientWidth;
    if (viewport.scrollLeft >= max - 5)
      viewport.scrollTo({ left: 0, behavior: "instant" });
    else
      viewport.scrollTo({
        left: Math.min(max, viewport.scrollLeft + step),
        behavior: "smooth",
      });
  }, 6000);
}

function winterHome() {
  if (BODY.winter !== "live") return "";
  return `<section class="wrap winterhome" aria-labelledby="winterhome-h"><div class="winterhome-text"><span class="eyebrow">Winteractie 2026</span><h2 id="winterhome-h">Maak je motor winterklaar</h2><p>Drie vaste winterpakketten met een vaste prijs. Dit zijn winterpakketten, geen grote beurt. Boeken kan t/m 30 november, we voeren ze uit t/m 20 december.</p></div><ul class="winterhome-list">${WINTER.map((w) => `<li><strong>${w.naam}</strong><span>vanaf ${euro(w.prijs)}</span></li>`).join("")}</ul><div class="winterhome-actions"><a href="${R.winter}" class="btn">Bekijk de winterpakketten →</a><a href="https://wa.me/31642939555?text=Hoi%20OG%20MotoWorks%2C%20ik%20wil%20graag%20een%20winterpakket%20boeken." class="btn secondary btn-wa" target="_blank" rel="noopener">Boek via WhatsApp ↗</a><a href="${mailHref(MAIL_T.winter, mailTpl(true))}" class="btn secondary btn-mail">${MAIL_T.btn}</a></div></section>`;
}
const PAKKETFOTO = [`<picture class="wh-cardpic"><source media="(max-width:900px)" srcset="/assets/og/17826df2c6c609a5.webp" width="120" height="120"><img src="/assets/og/11c54ee808cb0d59.webp" width="400" height="225" alt="Voorwiel met remschijf en Michelin-band bij OG MotoWorks" decoding="async" loading="lazy"></picture>`, `<picture class="wh-cardpic"><source media="(max-width:900px)" srcset="/assets/og/7af7ee53a2346d2f.webp" width="120" height="120"><img src="/assets/og/0661db28612e74d1.webp" width="400" height="225" alt="Olie verversen op de brug in onze werkplaats" decoding="async" loading="lazy"></picture>`, `<picture class="wh-cardpic"><source media="(max-width:900px)" srcset="/assets/og/95e23693e91587eb.webp" width="120" height="120"><img src="/assets/og/287dcd85fb55674f.webp" width="400" height="225" alt="Remvloeistof testen in onze werkplaats" decoding="async" loading="lazy"></picture>`]; // PAKKETFOTOS (19 okt 2026)
function winterHero() {
  if (BODY.winter !== "live") return "";
  const k = (w, i) => `<li><a href="${R.winter}">${PAKKETFOTO[i] || ""}<strong>${w.naam.replace("Winterklaar ", "")}</strong><span>vanaf</span><b>${euro(w.prijs)}</b></a></li>`;
  return `<section class="wrap hero winterhero" aria-labelledby="wh-h1"><div class="wh-main"><h1 class="home-h1" id="wh-h1">Motorwerkplaats in Waalwijk voor onderhoud, reparatie en banden</h1><p class="wh-lead">In onze werkplaats in Waalwijk kun je terecht voor onderhoud, reparatie en banden. Wij werken op afspraak.</p><div class="wh-actions"><a href="https://wa.me/31642939555?text=Hoi%20OG%20MotoWorks%2C%20ik%20wil%20graag%20een%20winterpakket%20boeken." class="btn btn-wa wh-big" target="_blank" rel="noopener">Boek via WhatsApp ↗</a><a href="${mailHref(MAIL_T.winter, mailTpl(true))}" class="btn secondary wh-big btn-mail">${MAIL_T.btn}</a></div><a href="${R.afspraak}" class="wh-other" data-start>Ander werk aan je motor? ${motor ? "Verder met jouw motor" : "Kies je motor"} →</a></div><figure class="wh-photo wh-carousel" data-carousel><picture class="wh-slide is-active"><source media="(max-width:900px)" srcset="/assets/og/cfa6457b5e49e167.webp" width="800" height="350"><img src="/assets/og/03f636bf6c7387d2.webp" width="627" height="941" alt="Freddy, eigenaar van OG MotoWorks, met een diagnosetablet bij een BMW in onze werkplaats in Waalwijk" fetchpriority="high"></picture><picture class="wh-slide" aria-hidden="true"><source media="(max-width:900px)" srcset="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" data-srcset="/assets/og/d8d40614cc6e5c7e.webp" width="800" height="350"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" data-src="/assets/og/f30af2a867cafd0e.webp" width="627" height="941" alt="${EN ? "Freddy checking a part next to a yellow Yamaha in our workshop" : "Freddy met een onderdeel bij een gele Yamaha in onze werkplaats"}" decoding="async" fetchpriority="low"></picture><picture class="wh-slide" aria-hidden="true"><source media="(max-width:900px)" srcset="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" data-srcset="/assets/og/157450d395733487.webp" width="800" height="350"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" data-src="/assets/og/d4c440bce03ab51e.webp" width="627" height="941" alt="${EN ? "Freddy reading out a BMW GS with a diagnostic tablet on the motorcycle lift" : "Freddy leest met een diagnosetablet een BMW GS uit op de motorbrug"}" decoding="async" fetchpriority="low"></picture><picture class="wh-slide" aria-hidden="true"><source media="(max-width:900px)" srcset="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" data-srcset="/assets/og/62c16cbb375aea08.webp" width="800" height="350"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" data-src="/assets/og/e28c45985cb66235.webp" width="627" height="941" alt="${EN ? "Freddy adjusting the clutch of a BMW M 1000 R" : "Freddy stelt de koppeling van een BMW M 1000 R bij"}" decoding="async" fetchpriority="low"></picture><picture class="wh-slide" aria-hidden="true"><source media="(max-width:900px)" srcset="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" data-srcset="/assets/og/16cc27f2851ef762.webp" width="800" height="350"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" data-src="/assets/og/19b93c24c14f6da3.webp" width="627" height="941" alt="${EN ? "Freddy with the diagnostic tablet next to a BMW R 1200 GS Adventure on the lift" : "Freddy met de diagnosetablet bij een BMW R 1200 GS Adventure op de motorbrug"}" decoding="async" fetchpriority="low"></picture><!-- HEROFREDDY --><figcaption class="reception-caption">Freddy · OG MotoWorks</figcaption></figure><!-- WINTERFOTO --></section>`;
}
function home() {
  if (winterHero()) return winterHero() + homeRest();
  return homeOrig();
}
function homeOrig() {
  return `<section class="wrap hero reception"><div class="welcome"><span class="eyebrow">Motorwerkplaats · Waalwijk</span><h1>Welkom bij<br>OG MotoWorks.</h1><p class="welcome-story">In onze werkplaats in Waalwijk kun je terecht voor onderhoud, reparatie, banden en ombouw van je motor. Eigenaar Freddy bespreekt vooraf met je wat er nodig is, zodat je weet waar je aan toe bent.</p><p class="welcome-note">Persoonlijk contact, eerlijk advies en werk op afspraak.</p><a href="${R.afspraak}" class="btn" data-start>${motor ? "Verder met jouw motor" : "Kies je motor"} →</a><p class="welcome-help">Daarna kies je in een paar stappen wat je nodig hebt.</p></div><figure><img src="/assets/og/c927c25d6be18e37.jpg" width="941" height="1672" alt="Freddy bij een BMW in de werkplaats van OG MotoWorks"><figcaption class="reception-caption">Freddy · OG MotoWorks</figcaption></figure></section><section class="reception-bottom"><div class="wrap reception-info"><span>Onderhoud · Reparatie · Banden · Ombouw</span><a href="${R.contact}">Waalwijk, op afspraak ↗</a><a href="https://share.google/mfVz03Qhs4EkLpyDO" target="_blank" rel="noopener">Ervaringen op Google ↗</a><a href="${R.schade}">${SCHADE.home}</a></div></section>${winterHome()}${socialReviews()}`;
}
function homeRest() {
  return `<section class="reception-bottom"><div class="wrap reception-info"><span>Onderhoud · Reparatie · Banden · Ombouw</span><a href="${R.contact}">Waalwijk, op afspraak ↗</a><a href="https://share.google/mfVz03Qhs4EkLpyDO" target="_blank" rel="noopener">Ervaringen op Google ↗</a><a href="${R.schade}">${SCHADE.home}</a></div></section><section class="wrap home-regio"><p>Wij zitten in Waalwijk, vlak bij Kaatsheuvel, Drunen, Tilburg en 's-Hertogenbosch. Veel motorrijders uit de regio komen bij ons voor motoronderhoud, reparatie en motorbanden.</p></section><section class="wrap home-diensten" aria-labelledby="home-diensten-h"><h2 id="home-diensten-h">Onze diensten</h2><ul class="home-diensten-list"><li><a href="/banden/"><strong>Motorbanden</strong><span>Advies dat past bij je rijstijl, en we monteren ze ook.</span></a></li><li><a href="/diensten/onderhoud/"><strong>Motoronderhoud in Waalwijk</strong><span>Kleine en grote beurt volgens het schema van je merk.</span></a></li><li><a href="/diensten/reparatie/"><strong>Motorreparatie</strong><span>Lekkage, remmen of storing: eerst de oorzaak, dan de reparatie.</span></a></li><li><a href="/diensten/aankoopkeuring/"><strong>Aankoopkeuring</strong><span>Een motor kopen? We lopen hem eerst na. €75 per keuring.</span></a></li><li class="hd-winter"><a href="/winter/"><strong>Winterpakketten</strong><span>Je motor goed de winter door, vanaf €89. Boeken t/m 30 november.</span></a></li></ul><p><a class="link" href="/diensten/">Alle diensten →</a></p><h2>Waarom OG MotoWorks</h2><p>We werken aan motoren van alle merken. Bij een klacht zoeken we eerst de echte oorzaak, voordat we onderdelen vervangen. En we doen geen extra werk zonder overleg: je hoort vooraf wat er nodig is en wat het kost.</p></section>${socialReviews()}`;
}
function services() {
  return (
    pagehead(
      own("Wat heb je nodig?"),
      ownText("Kies wat het beste bij je vraag past."),
      "onderhoud",
      true,
    ) + `<div class="wrap section">${selected()}${cards()}</div>`
  );
}
function commonFields() {
  return `<fieldset class="customer-fields" style="border:0;border-top:1px solid #3a3d44;padding:24px 0 0;margin:26px 0 0"><legend class="heading" style="padding:0 10px 0 0;font-size:23px">Jouw gegevens</legend><p class="note">Zo kunnen we je aanvraag bespreken en een afspraak met je maken.</p><div class="fields"><div class="full"><label for="naam">Naam</label><input id="naam" name="naam" autocomplete="name" required maxlength="120" placeholder="Voor- en achternaam"></div><div><label for="telefoon">Mobiel nummer</label><input id="telefoon" name="telefoon" type="tel" autocomplete="tel" required maxlength="30" minlength="6" placeholder="06… of +31…"></div><div><label for="email">E-mailadres (optioneel)</label><input id="email" name="email" type="email" autocomplete="email" maxlength="180" placeholder="Voor een offerte per mail"></div><div><label for="kenteken">Kenteken (optioneel)</label><input id="kenteken" name="kenteken" maxlength="14" autocomplete="off" autocapitalize="characters" placeholder="AB-12-CD"></div><div><label for="voorkeur">Voorkeursdag (optioneel)</label><input id="voorkeur" name="voorkeur" placeholder="Bijvoorbeeld vrijdagmiddag" maxlength="100"></div></div><p class="note" style="margin-top:15px">We gebruiken deze gegevens om jouw aanvraag af te handelen. <a href="${R.privacy}">Meer over privacy</a>.</p><div class="optlist review-opt"><label class="tyre"><input type="checkbox" id="review" name="review" value="ja" aria-describedby="review-note"><strong>Ik ga ermee akkoord dat OG MotoWorks mij na afloop per mail of WhatsApp mag vragen om een review</strong></label></div><p class="note review-note" id="review-note" aria-live="polite"></p></fieldset>`;
}
function requestFields(k) {
  if (k === "onderhoud")
    return `<div class="fields"><div><label for="km">Kilometerstand (optioneel)</label><input id="km" name="km" type="number" min="0" max="999999"></div><div><label for="beurt">Welke beurt?</label><select name="beurt" id="beurt">${BODY.winterpage === "1" ? winterOptions() : ""}<option>Onderhoud volgens schema</option><option>Oliewissel</option><option>Grote beurt</option><option>Voorvorkkeerringen vervangen (vanaf €350)</option><option>Kettingset vervangen (offerte)</option><option>Ik weet het nog niet</option>${winterOn() && BODY.winterpage !== "1" ? winterOptions() : ""}</select></div><div class="full"><label for="toelichting">Toelichting (optioneel)</label><textarea name="toelichting" id="toelichting" maxlength="2000" placeholder="Wat wil je laten doen?"></textarea></div></div>`;
  if (k === "probleem")
    return `<label for="toelichting">Wat merk je?</label><textarea name="toelichting" id="toelichting" required maxlength="2000" placeholder="${BODY.placeholder ? escapeHTML(BODY.placeholder) : "Bijvoorbeeld: de motor start moeilijk als hij warm is."}"></textarea><label for="wanneer" style="margin-top:20px">Wanneer gebeurt het? (optioneel)</label><input name="wanneer" id="wanneer" maxlength="200" placeholder="Sinds wanneer, koud of warm, tijdens het rijden…">`;
  return `<label for="toelichting">Wat wil je veranderen?</label><textarea name="toelichting" id="toelichting" required maxlength="2000" placeholder="Bijvoorbeeld andere knipperlichten of handvatverwarming."></textarea>`;
}
function winterOptions() {
  return WINTER.map((w) => `<option>${escapeHTML(winterLabel(w))}</option>`).join("");
}
function routePage(k) {
  const s = SERVICES[k];
  return (
    pagehead(own(s.title), ownText(s.text), k, true) +
    `<div class="wrap workgrid"><div>${selected()}<form id="request-form" data-intent="${k}" class="panel"><h2>${k === "banden" ? "Kies je banden" : "Jouw aanvraag"}</h2>${k === "banden" ? tyreFields() : requestFields(k)}${commonFields()}<div class="actions"><button class="btn" type="submit">Bekijk mijn aanvraag →</button></div><p class="note" style="margin-top:15px">Je verstuurt zelf via WhatsApp of mail. Een aanvraag is nog geen bevestigde afspraak.</p><input class="hp" type="text" name="_gotcha" tabindex="-1" autocomplete="off" aria-hidden="true"></form></div><aside class="panel"><span class="eyebrow">Helder vooraf</span><p class="price">${BODY.price ? escapeHTML(BODY.price) : s.price}</p><p class="muted">${BODY.pricenote ? escapeHTML(BODY.pricenote) : s.priceNote}</p><div class="line"><span>Onderdelen</span><strong>Adviesprijs</strong></div><div class="line"><span>Vooraf</span><strong>Offerte</strong></div><div class="line"><span>Meerwerk</span><strong>Na overleg</strong></div><p class="note" style="margin-top:18px">Prijzen incl. btw. We stemmen het werk eerst met je af.</p><a class="btn secondary" href="${R.tarieven}">Alle tarieven</a></aside></div><section class="section"><div class="wrap">${faqBlock(k)}</div></section>`
  );
}
function tyreFields() {
  return `<details class="hintbox"><summary>Waar vind ik mijn bandenmaat?</summary><p>Op de zijkant van je motorband, bijvoorbeeld 120/70 ZR17. 120 is de breedte in millimeters, 70 de hoogteverhouding en 17 de velgmaat in inches. Neem de volledige notatie over; we controleren ook de uitvoering en de overige aanduidingen.</p><p>Weet je het niet? Laat de maat leeg en vraag advies.</p></details><p class="note" id="oem-note"></p><div class="fields"><div><label for="voor">Voorbandmaat</label><input id="voor" name="voor" list="sizes" maxlength="40" placeholder="120/70 ZR17"></div><div><label for="achter">Achterbandmaat</label><input id="achter" name="achter" list="sizes" maxlength="40" placeholder="180/55 ZR17"></div><datalist id="sizes">${Object.keys(
    DATA.banden.assortiment,
  )
    .map((s) => `<option value="${s}"></option>`)
    .join(
      "",
    )}</datalist><div><label for="rijtype">Type band</label><select id="rijtype" name="rijtype"><option value="">Alle types</option>${DATA.banden.types.map(([v, t]) => `<option value="${v}">${escapeHTML(t)}</option>`).join("")}</select></div><div><label for="zoek">Zoek op bandnaam</label><input id="zoek" name="zoek" maxlength="100" placeholder="Road 6 of SportSmart"></div><div><label for="bandmerk">Bandenmerk</label><select id="bandmerk" name="bandmerk"><option value="">Alle merken</option>${[
    ...new Set(
      Object.values(DATA.banden.assortiment)
        .flat()
        .map((t) => t.merk),
    ),
  ]
    .sort()
    .map((m) => `<option value="${escapeHTML(m)}">${escapeHTML(m)}</option>`)
    .join(
      "",
    )}</select></div><div><label for="sortering">Sorteren</label><select id="sortering" name="sortering"><option value="naam">Naam A–Z</option><option value="laag">Prijs laag–hoog</option><option value="hoog">Prijs hoog–laag</option></select></div><div class="full"><label for="positie">Welke band wil je vervangen?</label><select id="positie" name="positie"><option value="beide">Voor en achter</option><option value="voor">Alleen voor</option><option value="achter">Alleen achter</option></select></div></div><p class="note" style="margin-top:15px">Controleer de maten op je motor. De prijzen zijn richtprijzen van ${escapeHTML(datumLang(DATA.banden.datum))}; voorraad en definitieve prijs worden bevestigd in de offerte.</p><div id="tyre-results"></div><fieldset class="tyre-extras"><legend class="heading smallhead">Extra's (optioneel)</legend><div class="optlist"><label class="tyre"><input type="checkbox" name="ventielen" value="ja"><strong>Haakse ventielen</strong><span class="money">+${euro(VENTIELEN)} per set</span><small>Alleen als ze passen. Zo controleer en pomp je je banden makkelijker op.</small></label><label class="tyre"><input type="checkbox" name="afvoer" value="ja"><strong>Oude band afvoeren</strong><span class="money">+${euro(AFVOEREN)} per band</span><small>Je mag je oude band ook zelf meenemen.</small></label></div></fieldset><div id="tyre-total" class="panel" style="margin-top:20px"></div><label for="toelichting" style="margin-top:20px">Toelichting (optioneel)</label><textarea name="toelichting" id="toelichting" maxlength="2000" placeholder="Bijvoorbeeld: ik wil advies over mijn keuze."></textarea>`;
}
function tariffs() {
  return (
    pagehead(
      own("Tarieven"),
      ownText("Een beurt rekenen we af op arbeid: €75 per uur incl. btw, plus onderdelen tegen de adviesprijs. Je krijgt vooraf een indicatie. Geen meerwerk zonder overleg."),
      "onderhoud",
      true,
    ) +
    `<div class="wrap workgrid"><div class="panel"><h2>Onze tarieven</h2><div class="line"><span>Arbeid</span><strong>€75 / uur</strong></div><div class="line"><span>Bandenmontage (exclusief band)</span><strong>€50 / band</strong></div><div class="line"><span>Haakse ventielen (optioneel, alleen als ze passen)</span><strong>€20 / set</strong></div><div class="line"><span>Oude band afvoeren (optioneel)</span><strong>€5 / band</strong></div><div class="line"><span>Voorvorkkeerringen vervangen</span><strong>vanaf €350</strong></div><div class="line"><span>Aankoopkeuring (ca. 1 tot 1,5 uur)</span><strong>€75 / keuring</strong></div><div class="line"><span>Onderdelen</span><strong>Adviesprijs</strong></div><div class="line"><span>Kettingset vervangen</span><strong>Offerte</strong></div><p class="note" style="margin-top:20px">Prijzen incl. btw. In de offerte staat welk werk en welk materiaal zijn inbegrepen.</p></div><div class="panel"><h2>Zo werken wij</h2><p>Vertel welke motor je rijdt en wat je nodig hebt. Je krijgt vooraf een offerte.</p><p class="muted">Komen we tijdens het werk iets extra's tegen? Dan overleggen we eerst met je.</p><a href="${R.afspraak}" class="btn">Vraag een offerte →</a></div></div>`
  );
}
function about() {
  return (
    pagehead(
      "Over OG MotoWorks",
      "Persoonlijk contact en aandacht voor je motor.",
      "probleem",
      true,
    ) +
    `<div class="wrap about"><img src="/assets/og/c927c25d6be18e37.jpg" width="941" height="1672" alt="Freddy aan het werk met een motor"><div><span class="eyebrow">De eigenaar achter OG MotoWorks</span><h2>Je spreekt direct met degene<br>die aan je motor werkt.</h2><p>Freddy is eigenaar en monteur van OG MotoWorks. Bij ons kun je terecht voor onderhoud, reparatie, banden en ombouw van je motor.</p><p class="muted">De werkplaats zit in Waalwijk. We werken op afspraak, zodat we jouw vraag en het werk vooraf kunnen bespreken.</p><p>Eerlijk advies, een offerte vooraf en overleg bij meerwerk.</p><a href="${R.contact}" class="btn">Neem contact op →</a></div></div>`
  );
}
function contact() {
  return (
    pagehead(
      "Contact",
      "App of mail ons en vertel wat je motor nodig heeft.",
      "probleem",
      true,
    ) +
    `<div class="wrap workgrid"><div class="panel"><h2>Hier vind je ons</h2><p>Professor Zeemanweg 6-10<br>5144 NN Waalwijk</p><p class="hours">Wij werken op afspraak. App ons voor een afspraak.</p><div class="actions"><a class="btn" href="${R.afspraak}">Afspraak aanvragen</a><a class="btn secondary" href="https://www.google.com/maps/search/?api=1&query=Professor+Zeemanweg+6-10%2C+5144+NN+Waalwijk" target="_blank" rel="noopener">Route plannen</a></div></div><div class="panel"><h2>Direct contact</h2><p>06 42 93 95 55<br><a href="mailto:info@ogmotoworks.nl">info@ogmotoworks.nl</a></p><div class="actions"><a href="https://wa.me/31642939555?text=Hoi%20Freddy%2C%20ik%20heb%20een%20vraag%20over%20mijn%20motor." class="btn" target="_blank" rel="noopener">Open WhatsApp ↗</a><a href="${mailHref(MAIL_T.std, mailTpl())}" class="btn secondary btn-mail">${MAIL_T.btn}</a></div><p class="note privacy-link" style="margin:14px 0 0;font-size:14px"><a href="${R.privacy}">Privacyverklaring</a></p></div></div><div class="wrap og-kaart"><iframe src="https://www.google.com/maps?q=OG+MotoWorks,+Professor+Zeemanweg+6-10,+5144+NN+Waalwijk&amp;output=embed" title="Kaart: OG MotoWorks, Professor Zeemanweg 6-10, Waalwijk" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe></div>`
  );
}
function privacy() {
  return (
    pagehead(own("Privacy"), ownText("Jouw gegevens bij OG MotoWorks."), "onderhoud", true) +
    `<div class="wrap section"><div class="panel"><h2>Op jouw apparaat</h2><p>Je gekozen motor bewaren we alleen in je browser. Wat je in het aanvraagformulier invult, blijft alleen in dit tabblad en is weg als je het sluit.</p><button class="btn secondary" id="clear-motor">Wis mijn motorkeuze</button></div></div>`
  );
}
function saveDraft() {
  const f = $("#request-form");
  if (!f) return;
  const k = f.dataset.intent;
  const values = Object.fromEntries(new FormData(f));
  drafts[k] = { ...drafts[k], ...values };
  f.querySelectorAll('input[type="checkbox"]').forEach((el) => {
    if (el.checked) drafts[k][el.name] = el.value;
    else delete drafts[k][el.name];
  });
  for (const key of Object.keys(customer))
    if (key in values) customer[key] = String(values[key]).trim();
  // reviewvinkje geldt voor alle routes; ook uitvinken onthouden
  const rv = f.elements.namedItem("review");
  if (rv) customer.review = rv.checked ? "ja" : "";
  persist();
}
function restoreDraft(k) {
  const f = $("#request-form");
  if (!f) return;
  for (const [key, val] of Object.entries({ ...drafts[k], ...customer })) {
    const el = f.elements.namedItem(key);
    if (el && el.type === "checkbox") el.checked = val === el.value;
    else if (el && el.type !== "radio") {
      el.value = val;
      if (el.tagName === "SELECT" && el.selectedIndex < 0) el.selectedIndex = 0;
    }
  }
  reviewNote();
}
// REVIEWVINKJE_WA (20 okt 2026): reviewverzoek kan per mail of WhatsApp; telefoon is altijd verplicht,
// dus geen melding meer bij een leeg e-mailadres. Functie blijft (leegt #review-note) zodat aanroepen werken.
function reviewNote() {
  const note = $("#review-note");
  if (note) note.textContent = "";
}
function updateChip() {
  const b = $("#chip");
  b.hidden = !motor;
  document.body.classList.toggle("has-motor", !!motor);
  b.textContent = motorLabel(motor);
  b.title = motorLabel(motor) + " — wijzigen";
}
function openMotor(next = "") {
  pending = next;
  const d = $("#motor-dialog");
  for (const k of ["merk", "model", "uitvoering", "jaar"])
    $("#" + k).value = motor?.[k] || "";
  fillModelLists();
  d.showModal();
  $("#merk").focus();
}
// Keuzerij (8 okt 2026): veegbare rij met merken / modellen / uitvoeringen zolang dat veld focus heeft.
// Vervangt de <datalist>-suggesties van de browser: Chrome op Android toont die als chips boven het toetsenbord,
// maar alleen bij de eerste focus (daarna niet meer tot je typt), en dat is vanuit de site niet te sturen.
// Mobiel staat de rij vast boven het toetsenbord (visualViewport), op desktop direct onder het veld.
const PICK = { merk: "Kies een merk", model: "Kies een model", uitvoering: "Kies een uitvoering" };
const pickRow = document.createElement("div");
pickRow.className = "pickrow";
pickRow.id = "pickrow";
pickRow.hidden = true;
pickRow.setAttribute("role", "group");
pickRow.tabIndex = -1; // scrollbare rij niet in de Tab-volgorde (typen kan altijd)
let pickField = null,
  pickTimer = 0;
// Merk/model/uitvoering herkennen zoals een klant ze typt (8 okt 2026, 'Harley heeft geen motoren?'):
// hoofdletters, spaties, (zachte/vaste) koppeltekens en accenten tellen niet mee ("harley davidson", "HARLEY-DAVIDSON",
// "bmw", "cf moto", "Harley\u2011Davidson"). Merk mag ook een eenduidig begin zijn ("harley", "royal"). Zonder treffer blijft de
// eigen tekst staan (handmatige motor).
const norm = (s) =>
  String(s ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
const MERK_ALIAS = { hd: "Harley-Davidson" };
function canonMerk(v) {
  const raw = String(v ?? "").trim(),
    n = norm(raw);
  if (!n || !DATA) return raw;
  const keys = Object.keys(DATA.motoren.merken);
  const exact = keys.find((k) => norm(k) === n);
  if (exact) return exact;
  if (MERK_ALIAS[n] && DATA.motoren.merken[MERK_ALIAS[n]]) return MERK_ALIAS[n];
  const pre = n.length >= 3 ? keys.filter((k) => norm(k).startsWith(n)) : [];
  return pre.length === 1 ? pre[0] : raw;
}
function canonIn(list, v) {
  const raw = String(v ?? "").trim(),
    n = norm(raw);
  return (n && list.find((x) => norm(x) === n)) || raw;
}
const modelsOf = (merk) => DATA.motoren.merken[canonMerk(merk)] || [];
function variantsOf(merk, model) {
  const m = canonMerk(merk);
  return DATA.motoren.uitvoeringen[m]?.[canonIn(DATA.motoren.merken[m] || [], model)] || [];
}
function canonMotor(m) {
  const merk = canonMerk(m.merk),
    model = canonIn(modelsOf(merk), m.model);
  return { ...m, merk, model, uitvoering: canonIn(variantsOf(merk, model), m.uitvoering) };
}
function pickOptions(k) {
  if (k === "merk") return Object.keys(DATA.motoren.merken);
  if (k === "model") return modelsOf($("#merk").value);
  return variantsOf($("#merk").value, $("#model").value);
}
function hidePick() {
  pickRow.hidden = true;
  pickField = null;
}
function placePick() {
  const vv = window.visualViewport;
  const kb = vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0;
  pickRow.style.setProperty("--kb", kb + "px");
}
function showPick(el) {
  clearTimeout(pickTimer);
  if (!DATA || !PICK[el.id]) return hidePick();
  const all = pickOptions(el.id),
    v = norm(el.value),
    exact = all.some((o) => norm(o) === v),
    list = !v || exact ? all : all.filter((o) => norm(o).includes(v));
  if (!list.length) return hidePick();
  pickField = el;
  pickRow.setAttribute("aria-label", PICK[el.id]);
  pickRow.innerHTML = list.map((o) => `<button type="button" class="pill" tabindex="-1" data-v="${escapeHTML(o)}" aria-pressed="${norm(o) === v}">${escapeHTML(o)}</button>`).join("");
  el.parentElement.after(pickRow);
  pickRow.hidden = false;
  placePick();
}
function initPick() {
  const fields = ["merk", "model", "uitvoering"].map((k) => $("#" + k));
  fields.forEach((el) => {
    el.removeAttribute("list"); // geen tweede (browser)rij ernaast
    el.setAttribute("autocomplete", "off");
    for (const ev of ["focus", "click", "input"]) el.addEventListener(ev, () => showPick(el));
  });
  $("#jaar").addEventListener("focus", hidePick);
  // na typen (veld verlaten): officiële schrijfwijze invullen, zodat modellen en bandenmaten gevonden worden
  $("#merk").addEventListener("change", () => {
    const c = canonMerk($("#merk").value);
    if (c !== $("#merk").value) $("#merk").value = c;
    fillModelLists();
  });
  $("#model").addEventListener("change", () => {
    const c = canonIn(modelsOf($("#merk").value), $("#model").value);
    if (c !== $("#model").value) $("#model").value = c;
    fillModelLists();
  });
  $("#uitvoering").addEventListener("change", () => {
    const c = canonIn(variantsOf($("#merk").value, $("#model").value), $("#uitvoering").value);
    if (c !== $("#uitvoering").value) $("#uitvoering").value = c;
  });
  // focus weg uit de velden (en niet naar de rij): rij weg
  $("#motor-dialog").addEventListener("focusout", (e) => {
    const to = e.relatedTarget;
    if (fields.includes(to) || pickRow.contains(to)) return;
    // focus naar een ander element: direct weg. Focus 'nergens' (tik op lege plek, of een telefoon die bij het tikken
    // op een knop in de rij toch even de focus weghaalt): heel even wachten, zodat de tik op de knop nog doorkomt.
    clearTimeout(pickTimer);
    if (to) hidePick();
    else pickTimer = setTimeout(hidePick, 200);
  });
  $("#motor-dialog").addEventListener("close", hidePick);
  // tikken/klikken op de rij mag de focus niet uit het veld halen: alleen mousedown tegenhouden
  // (niet pointerdown/touchstart, dan blijven vegen en de klik op iOS/Android werken)
  pickRow.addEventListener("mousedown", (e) => e.preventDefault());
  pickRow.addEventListener("click", (e) => {
    const b = e.target.closest(".pill"),
      el = pickField;
    if (!b || !el) return;
    clearTimeout(pickTimer);
    const k = el.id,
      old = { merk: $("#merk").value, model: $("#model").value };
    el.value = b.dataset.v;
    // ander merk gekozen: een bekend model van het vorige merk past niet meer
    if (k === "merk" && modelsOf(old.merk).some((x) => norm(x) === norm(old.model)) && !modelsOf(el.value).some((x) => norm(x) === norm(old.model))) {
      $("#model").value = "";
      $("#uitvoering").value = "";
    }
    if (k === "model" && !variantsOf($("#merk").value, el.value).some((x) => norm(x) === norm($("#uitvoering").value))) $("#uitvoering").value = "";
    fillModelLists();
    const next = k === "merk" ? $("#model") : k === "model" && pickOptions("uitvoering").length ? $("#uitvoering") : $("#jaar");
    next.focus();
    if (next !== $("#jaar")) showPick(next);
  });
  if (window.visualViewport) {
    visualViewport.addEventListener("resize", placePick);
    visualViewport.addEventListener("scroll", placePick);
  }
  window.addEventListener("resize", placePick);
}
function fillModelLists() {
  const merk = $("#merk").value,
    model = $("#model").value;
  $("#modellen").innerHTML = modelsOf(merk)
    .map((x) => `<option value="${escapeHTML(x)}"></option>`)
    .join("");
  $("#uitvoeringen").innerHTML = variantsOf(merk, model)
    .map((x) => `<option value="${escapeHTML(x)}"></option>`)
    .join("");
}
function applyMotor(m) {
  const old = motorLabel(motor);
  motor = m;
  try {
    localStorage.setItem(MOTOR_KEY, JSON.stringify({ merk: m.merk, model: m.model, uitvoering: m.uitvoering || "", bouwjaar: String(m.jaar || ""), handmatig: !(DATA.motoren.merken[m.merk] || []).includes(m.model) }));
  } catch {}
  if (old !== motorLabel(m)) {
    drafts.banden = {};
  }
  persist();
  updateChip();
}
function filteredTyres(
  items,
  { type = "", merk = "", search = "", sort = "naam" } = {},
) {
  const q = search.toLowerCase().trim();
  return items
    .filter(
      (t) =>
        (!type || t.type === type) &&
        (!merk || t.merk === merk) &&
        (!q || `${t.merk} ${t.band}`.toLowerCase().includes(q)),
    )
    .sort((a, b) => {
      if (sort !== "naam") {
        if (a.prijs == null) return b.prijs == null ? 0 : 1;
        if (b.prijs == null) return -1;
        return sort === "laag" ? a.prijs - b.prijs : b.prijs - a.prijs;
      }
      return `${a.merk} ${a.band}`.localeCompare(`${b.merk} ${b.band}`, "nl");
    });
}
function tyreItems(pos) {
  const f = $("#request-form"),
    key = sizeKey(f.elements[pos].value);
  return filteredTyres(DATA.banden.assortiment[key] || [], {
    type: f.elements.rijtype.value,
    merk: f.elements.bandmerk.value,
    search: f.elements.zoek.value,
    sort: f.elements.sortering.value,
  });
}
function renderTyres() {
  saveDraft();
  const d = drafts.banden;
  const positions =
    d.positie === "voor"
      ? ["voor"]
      : d.positie === "achter"
        ? ["achter"]
        : ["voor", "achter"];
  const auto = positions.length === 2 && d["achter-auto"] && d["band-achter"] && !d["achter-open"] ? rearAuto(d) : null;
  $("#tyre-results").innerHTML = positions
    .map((pos) => {
      if (pos === "achter" && auto)
        return `<h3 class="smallhead" style="margin-top:24px">${pos === "voor" ? "Voorband" : "Achterband"}</h3><div class="tyre-auto" id="rear-auto"><p class="note" role="status">Automatisch gekozen: zelfde merk en type als je voorband. Je kunt hem altijd wijzigen.</p><div class="tyrelist">${tyreCard(auto, "achter", true)}</div><button class="btn text rear-change" type="button" id="rear-change">Andere achterband kiezen</button></div>`;
      const items = tyreItems(pos);
      let visible = items.slice(0, limits[pos]);
      const gekozen = items.find((t) => tyreId(t) === d["band-" + pos]);
      if (gekozen && !visible.includes(gekozen)) visible = [gekozen, ...visible.slice(0, -1)];
      const mis = pos === "achter" && positions.length === 2 && d["band-voor"] && !d["band-achter"] ? rearMissNote(d) : "";
      return `<h3 class="smallhead" style="margin-top:24px">${pos === "voor" ? "Voorband" : "Achterband"}</h3>${mis}<p class="note" role="status">${items.length ? `${items.length} resultaten · ${Math.min(items.length, limits[pos])} getoond. Toepasbaarheid wordt nog gecontroleerd.` : "Geen banden gevonden voor deze maat. App ons, dan zoeken we het voor je uit."}</p><div class="tyrelist">${
        visible
          .map((t) => tyreCard(t, pos, d["band-" + pos] === tyreId(t)))
          .join("") ||
        '<p class="note">Geen resultaat? Pas de filters aan of vraag hieronder advies zonder bandenkeuze.</p>'
      }</div>${items.length > limits[pos] ? `<button class="btn secondary showmore" type="button" data-more="${pos}">Toon meer ${pos === "voor" ? "voorbanden" : "achterbanden"}</button>` : ""}`;
    })
    .join("");
  const rc = $("#rear-change");
  if (rc)
    rc.onclick = () => {
      drafts.banden["achter-open"] = "1";
      renderTyres();
      const first = $('input[name="band-achter"]');
      if (first) first.focus();
    };
  $$("[data-more]").forEach(
    (b) =>
      (b.onclick = () => {
        limits[b.dataset.more] += 8;
        renderTyres();
      }),
  );
  $$('input[name^="band-"]').forEach((el) =>
    el.addEventListener("change", () => {
      drafts.banden[el.name] = el.value;
      if (el.name === "band-achter") {
        delete drafts.banden["achter-auto"];
        delete drafts.banden["achter-mis"];
        return renderTotal();
      }
      autoRear();
      renderTyres();
      const back = $('input[name="band-voor"]:checked');
      if (back) back.focus({ preventScroll: true });
    }),
  );
  renderTotal();
}
function tyreCard(t, pos, checked) {
            const id = tyreId(t);
            return `<label class="tyre"><input type="radio" name="band-${pos}" value="${escapeHTML(id)}" ${checked ? "checked" : ""}><strong>${escapeHTML(t.merk + " " + t.band)}</strong><small>${escapeHTML(t.notatie)} · ${escapeHTML(DATA.banden.types.find((x) => x[0] === t.type)?.[1] || t.type)}</small><span class="money">${t.prijs ? euro(t.prijs) + " voor de band" : "Prijs op aanvraag"}</span><small>Montage: ${euro(DATA.banden.montage)}</small><span class="included">${t.prijs ? euro(t.prijs + DATA.banden.montage) + " samen incl. btw" : "Definitieve prijs via offerte"}</span></label>`;
}
// BANDENSET (20 okt 2026): kiest de klant voor en achter, dan krijgt de achterband automatisch hetzelfde merk en type
// (zelfde merk|band in de achtermaat). Een zelf gekozen achterband blijft staan. Prijzen lopen via chosenTyres (ongewijzigd).
const tyreId = (t) => t.merk + "|" + t.band;
function rearAuto(d) {
  return (DATA.banden.assortiment[sizeKey(d.achter)] || []).find((t) => tyreId(t) === d["band-achter"]) || null;
}
function autoRear() {
  const d = drafts.banden;
  delete d["achter-mis"];
  if ((d.positie || "beide") !== "beide" || !d["band-voor"]) return;
  if (d["band-achter"] && !d["achter-auto"]) return;
  const m = (DATA.banden.assortiment[sizeKey(d.achter)] || []).find((t) => tyreId(t) === d["band-voor"]);
  if (m) {
    d["band-achter"] = tyreId(m);
    d["achter-auto"] = "1";
    delete d["achter-open"];
  } else {
    delete d["band-achter"];
    delete d["achter-auto"];
    d["achter-mis"] = d["band-voor"];
  }
}
function rearMissNote(d) {
  if (d["achter-mis"] !== d["band-voor"]) return "";
  const naam = escapeHTML(d["band-voor"].replace("|", " "));
  return sizeKey(d.achter)
    ? `<p class="note rear-miss" role="status">De ${naam} hebben we niet in jouw achtermaat. Kies hieronder een achterband.</p>`
    : `<p class="note rear-miss" role="status">Vul je achterbandmaat in, dan kiezen we dezelfde band voor achter.</p>`;
}
function chosenTyres(d) {
  const pos =
    d.positie === "voor"
      ? ["voor"]
      : d.positie === "achter"
        ? ["achter"]
        : ["voor", "achter"];
  return pos.map((p) => ({
    pos: p,
    size: d[p] || "",
    band:
      (DATA.banden.assortiment[sizeKey(d[p])] || []).find(
        (t) => t.merk + "|" + t.band === d["band-" + p],
      ) || null,
  }));
}
// Aangevinkte extra's: [omschrijving, bedrag]. Afvoeren telt per band die vervangen wordt (voor/achter/beide).
function tyreExtras(d, rows) {
  const out = [];
  if (d.ventielen === "ja") out.push(["Haakse ventielen (alleen als ze passen), per set", VENTIELEN]);
  if (d.afvoer === "ja") out.push(["Oude band afvoeren " + rows.length + " × " + euro(AFVOEREN), AFVOEREN * rows.length]);
  return out;
}
function renderTotal() {
  saveDraft();
  const rows = chosenTyres(drafts.banden);
  const extras = tyreExtras(drafts.banden, rows);
  let total = extras.reduce((n, e) => n + e[1], 0),
    complete = true;
  $("#tyre-total").innerHTML =
    "<h3>Jouw richtprijs</h3>" +
    `<div class="selectedtyres">${rows
      .filter((r) => r.band)
      .map(
        (r) =>
          `<span>${r.pos === "voor" ? "Voor" : "Achter"}: ${escapeHTML(r.band.merk + " " + r.band.band)}</span>`,
      )
      .join("")}</div>` +
    rows
      .map((r) => {
        if (!r.band) {
          complete = false;
          return `<div class="line"><span>${r.pos === "voor" ? "Voor" : "Achter"}</span><strong>Nog te kiezen of advies</strong></div>`;
        }
        if (r.band.prijs == null) complete = false;
        else total += r.band.prijs + DATA.banden.montage;
        return `<div class="line"><span>${r.pos === "voor" ? "Voor" : "Achter"} · band</span><strong>${r.band.prijs ? euro(r.band.prijs) : "Op aanvraag"}</strong></div><div class="line"><span>Montage</span><strong>${euro(DATA.banden.montage)}</strong></div>`;
      })
      .join("") +
    extras.map((e) => `<div class="line"><span>${escapeHTML(e[0])}</span><strong>${euro(e[1])}</strong></div>`).join("") +
    `<p style="margin-top:18px"><strong>${complete ? (extras.length ? "Totaal incl. montage en extra's: " : "Totaal incl. montage: ") + euro(total) : "De totaalprijs volgt na je keuze, in de offerte."}</strong></p><p class="note">Incl. btw. Beschikbaarheid en eventuele extra werkzaamheden in overleg.</p>`;
}
function initTyres() {
  const d = drafts.banden,
    o = matchOEM(motor);
  if (!d.voor && !d.achter && o) {
    d.voor = o.voor;
    d.achter = o.achter;
    d.positie = "beide";
    restoreDraft("banden");
  }
  $("#oem-note").textContent = o
    ? "Maten uit het bestaande motoroverzicht. Controleer ze op je motor; pas ze aan als jouw uitvoering afwijkt."
    : "Voor deze motor hebben we geen vaste bandenmaten. Vul de maten van je banden in, of vraag ons om advies.";
  ["voor", "achter"].forEach((p) =>
    $("#" + p).addEventListener("input", () => {
      $$('input[name="band-' + p + '"]').forEach((el) => (el.checked = false));
      delete drafts.banden["band-" + p];
      if (p === "voor" && drafts.banden["achter-auto"]) delete drafts.banden["band-achter"];
      delete drafts.banden["achter-auto"];
      delete drafts.banden["achter-open"];
      saveDraft();
      autoRear();
      renderTyres();
    }),
  );
  $$('.tyre-extras input[type="checkbox"]').forEach((el) => el.addEventListener("change", renderTotal));
  ["rijtype", "zoek", "positie", "bandmerk", "sortering"].forEach((p) =>
    $("#" + p).addEventListener(p === "zoek" ? "input" : "change", () => {
      limits = { voor: 8, achter: 8 };
      if (p === "positie") {
        saveDraft();
        autoRear();
      }
      renderTyres();
    }),
  );
  renderTyres();
}
function buildMessage(k, m, d) {
  const lines = [
    "Hoi Freddy, ik wil graag een afspraak aanvragen.",
    "Motor: " + motorLabel(m),
    "Aanvraag: " + SERVICES[k].title,
  ];
  if (d.naam?.trim()) lines.splice(1, 0, "Naam: " + d.naam.trim());
  if (d.telefoon?.trim()) lines.push("Mobiel: " + d.telefoon.trim());
  if (d.email?.trim()) lines.push("E-mail: " + d.email.trim());
  if (d.kenteken?.trim())
    lines.push("Kenteken: " + d.kenteken.trim().toUpperCase());
  if (k === "onderhoud") {
    if (d.beurt) lines.push("Beurt: " + d.beurt);
    if (d.km) lines.push("Kilometerstand: " + d.km);
  }
  if (k === "probleem" && d.wanneer) lines.push("Wanneer: " + d.wanneer);
  if (k === "banden")
    chosenTyres(d).forEach((r) =>
      lines.push(
        (r.pos === "voor" ? "Voorband: " : "Achterband: ") +
          (r.size || "Maat nog controleren") +
          (r.band
            ? " · " + r.band.merk + " " + r.band.band
            : " · graag advies"),
      ),
    );
  if (k === "banden") {
    const rows = chosenTyres(d);
    rows
      .filter((r) => r.band)
      .forEach((r) =>
        lines.push(
          (r.pos === "voor" ? "Voor" : "Achter") +
            " richtprijs: " +
            (r.band.prijs != null
              ? euro(r.band.prijs) +
                " band + " +
                euro(DATA.banden.montage) +
                " montage"
              : "bandprijs op aanvraag + " +
                euro(DATA.banden.montage) +
                " montage"),
        ),
      );
    const extras = tyreExtras(d, rows);
    extras.forEach((e) => lines.push(e[0] + ": " + euro(e[1])));
    if (rows.every((r) => r.band && r.band.prijs != null))
      lines.push(
        (extras.length ? "Richtprijs incl. montage, extra's en btw: " : "Richtprijs incl. montage en btw: ") +
          euro(
            rows.reduce((n, r) => n + r.band.prijs + DATA.banden.montage, 0) + extras.reduce((n, e) => n + e[1], 0),
          ),
      );
    lines.push("Definitieve prijs en beschikbaarheid graag bevestigen.");
  }
  if (d.toelichting?.trim()) lines.push("Toelichting: " + d.toelichting.trim());
  if (d.voorkeur?.trim()) lines.push("Voorkeur: " + d.voorkeur.trim());
  if (d.review === "ja") lines.push("Reviewverzoek (mail/WhatsApp): ja");
  lines.push("Kun je mij een prijsindicatie en beschikbare datum sturen?");
  return lines.join("\n");
}
function customerRecord(k, m, d) {
  return {
    customer: {
      name: String(d.naam || "").trim(),
      phone: String(d.telefoon || "").replace(/[\s()-]/g, ""),
      email: String(d.email || "")
        .trim()
        .toLowerCase(),
    },
    motorcycle: {
      brand: m?.merk || "",
      model: m?.model || "",
      variant: m?.uitvoering || "",
      year: Number(m?.jaar) || null,
      registration: String(d.kenteken || "")
        .trim()
        .toUpperCase(),
    },
    request: {
      service: k,
      description: String(d.toelichting || "").trim(),
      preferredDay: String(d.voorkeur || "").trim(),
      mileage: k === "onderhoud" && d.km ? Number(d.km) : null,
    },
    source: "ogmotoworks-website",
  };
}
function winterFields(k, d) {
  const w = k === "onderhoud" ? winterOf(d.beurt) : null;
  if (!w) return {};
  return { Winterpakket: w.naam + " (vanaf " + euro(w.prijs) + ")" };
}
function formspreeData(k, m, d) {
  const naam = String(d.naam || "").trim(),
    motorTxt = [m?.merk, m?.model].filter(Boolean).join(" "),
    email = String(d.email || "").trim(),
    tyres = k === "banden" ? chosenTyres(d) : [],
    full = tyres.length && tyres.every((r) => r.band && r.band.prijs != null),
    extras = k === "banden" ? tyreExtras(d, tyres) : [],
    extraSum = extras.reduce((n, e) => n + e[1], 0);
  const fields = {
    _subject: "Nieuwe aanvraag via ogmotoworks.nl – " + (naam || "onbekend") + " – " + (motorTxt || "motor") + (EN ? " [EN]" : ""),
    Taal: EN ? "EN" : "NL",
    "Soort aanvraag": SERVICES[k].title,
    Naam: naam,
    Telefoon: String(d.telefoon || "").trim(),
    email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : "",
    Kenteken: String(d.kenteken || "").trim().toUpperCase(),
    "Merk/model": motorTxt,
    Uitvoering: m?.uitvoering || "",
    Bouwjaar: m?.jaar || "",
    Kilometerstand: k === "onderhoud" && d.km ? d.km + " km" : "",
    "Laten doen": k === "onderhoud" ? d.beurt || "" : "",
    Wanneer: k === "probleem" ? String(d.wanneer || "").trim() : "",
    "Banden overzicht": tyres.map((r) => (r.pos === "voor" ? "Voorband: " : "Achterband: ") + (r.size || "Maat nog controleren") + (r.band ? " · " + r.band.merk + " " + r.band.band + (r.band.prijs != null ? " (" + euro(r.band.prijs) + ")" : "") : " · graag advies")).join("\n"),
    "Haakse ventielen": k === "banden" && d.ventielen === "ja" ? "ja, alleen als ze passen (" + euro(VENTIELEN) + " per set)" : "",
    "Oude band afvoeren": k === "banden" && d.afvoer === "ja" ? "ja, " + tyres.length + " × " + euro(AFVOEREN) + " = " + euro(AFVOEREN * tyres.length) : "",
    "Richtprijs banden": full ? euro(tyres.reduce((n, r) => n + r.band.prijs + DATA.banden.montage, 0) + extraSum) + (extras.length ? " incl. montage, extra's en btw" : " incl. montage en btw") : "",
    Vraag: String(d.toelichting || "").trim(),
    Voorkeursdag: String(d.voorkeur || "").trim(),
    ...winterFields(k, d),
    "Toestemming reviewverzoek (mail/WhatsApp)": d.review === "ja" ? "ja" : "nee",
    Pagina: location.pathname,
  };
  const fd = new FormData();
  for (const [key, val] of Object.entries(fields)) if (String(val).trim()) fd.append(key, val);
  fd.append("_gotcha", "");
  return fd;
}
// Kopie per e-mail via Formspree, eenmalig per bericht, bij klikken op 'Open WhatsApp'.
// Geen claim van opslag: WhatsApp blijft de echte aanvraag.
function sendCopy(k, m, d) {
  if (!summaryText || sentText === summaryText || String(d._gotcha || "").trim()) return;
  sentText = summaryText;
  try {
    fetch(FORMSPREE, { method: "POST", body: formspreeData(k, m, d), headers: { Accept: "application/json" }, keepalive: true, mode: "cors" }).catch(() => {});
  } catch {}
}
function summary() {
  if (!motor) return services();
  summaryText = buildMessage(intent, motor, drafts[intent]);
  return (
    pagehead(
      "Controleer je aanvraag",
      "Alles klopt? Verstuur het bericht zelf via WhatsApp of mail.",
      "probleem",
    ) +
    `<div class="wrap workgrid"><div class="panel"><h2>Jouw bericht aan OG MotoWorks</h2><div class="summary">${escapeHTML(summaryText)}</div><div class="actions"><a class="btn" id="wa-open" href="https://wa.me/31642939555?text=${encodeURIComponent(summaryText)}" target="_blank" rel="noopener">Open WhatsApp ↗</a><a class="btn secondary btn-mail" id="mail-open" href="${mailHref(intent === "onderhoud" && winterOf(drafts.onderhoud?.beurt) ? MAIL_T.winter : MAIL_T.std, summaryText)}">${MAIL_T.btn}</a><a class="btn secondary" href="#formulier">Aanpassen</a></div></div><div class="panel">${selected()}<p>Je aanvraag wordt pas verstuurd wanneer je in WhatsApp of in je mailprogramma op verzenden drukt.</p><p class="muted">We bevestigen de prijs en een beschikbare datum. Je hebt daarmee nog geen automatische boeking.</p></div></div>`
  );
}
const ROUTES = ["home", "diensten", "onderhoud", "probleem", "banden", "ombouw", "tarieven", "over-ons", "contact", "privacy", "info"];
const ROUTE = ROUTES.includes(BODY.route) ? BODY.route : "home";
const BASE_TITLE = document.title;
function info() {
  return pagehead(own("OG MotoWorks"), ownText(""), BODY.bg || "onderhoud", true) + `<div class="wrap section"><div class="actions"><a class="btn" href="${R.afspraak}">Afspraak aanvragen →</a><a class="btn secondary" href="${R.tarieven}">Alle tarieven</a></div></div>`;
}
// Oude hash-links (#banden, #prijzen, #contact ...) van de vorige site en de testversie: door naar de echte pagina.
const OLD = { reviews: R.home + "#reviews", home: R.home, diensten: R.diensten, onderhoud: R.onderhoud, probleem: R.probleem, banden: R.banden, ombouw: R.ombouw, tarieven: R.tarieven, prijzen: R.tarieven, "zo-werken-wij": R.tarieven, "over-ons": R["over-ons"], waarom: R["over-ons"], werkgebied: R["over-ons"], contact: R.contact, privacy: R.privacy, afspraak: R.afspraak, "kies-je-motor": R.afspraak, werk: R.werk };
function oldHash() {
  const h = decodeURIComponent(location.hash.slice(1));
  const to = Object.prototype.hasOwnProperty.call(OLD, h) ? OLD[h] : "";
  if (!to) return false;
  if (to.split("#")[0] !== location.pathname) {
    location.replace(to);
    return true;
  }
  if (!to.includes("#")) history.replaceState(null, "", location.pathname + location.search);
  return false;
}
function render() {
  saveDraft();
  const page = location.hash === "#overzicht" && motor ? "overzicht" : ROUTE;
  const pages = {
    home: home,
    diensten: services,
    tarieven: tariffs,
    "over-ons": about,
    contact: contact,
    privacy: privacy,
    info: info,
    overzicht: summary,
  };
  if (BODY.beurt && !render.preset) {
    render.preset = true;
    drafts.onderhoud.beurt = BODY.beurt;
  }
  if (BODY.winterpage === "1" && !winterOf(drafts.onderhoud.beurt)) drafts.onderhoud.beurt = winterLabel(WINTER[0]);
  $("#app").innerHTML = SERVICES[page] ? routePage(page) : pages[page]();
  const extra = $("#info");
  if (extra) extra.hidden = page === "overzicht";
  initReviews();
  initGallery();
  initMix();
  initHeroCarousel();
  const start = $("[data-start]");
  if (start && !motor)
    start.onclick = (e) => {
      e.preventDefault();
      openMotor("afspraak");
    };
  $$("[data-motor]").forEach((b) => (b.onclick = () => openMotor()));
  $$(".nav a").forEach((a) => {
    if (a.pathname === location.pathname && !a.hasAttribute("hreflang")) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  const f = $("#request-form");
  if (f) {
    restoreDraft(page);
    $("#review")?.addEventListener("change", () => {
      reviewNote();
      saveDraft();
    });
    $("#email")?.addEventListener("input", reviewNote);
    f.addEventListener("submit", (e) => {
      e.preventDefault();
      saveDraft();
      intent = page;
      persist();
      if (!motor) {
        openMotor("overzicht");
        return;
      }
      location.hash = "overzicht";
    });
    if (page === "banden") initTyres();
  }
  const wa = $("#wa-open");
  if (wa) wa.addEventListener("click", () => sendCopy(intent, motor, drafts[intent]));
  const clear = $("#clear-motor");
  if (clear)
    clear.onclick = () => {
      try {
        localStorage.removeItem(MOTOR_KEY);
      } catch {}
      motor = null;
      drafts.banden = {};
      persist();
      updateChip();
      render();
    };
  $(".nav").classList.remove("open");
  $(".burger").setAttribute("aria-expanded", "false");
  updateChip();
  document.title = page === "overzicht" ? "Jouw aanvraag | OG MotoWorks" : BASE_TITLE;
}
$(".skiplink").onclick = (e) => {
  e.preventDefault();
  $("#main").focus();
  $("#main").scrollIntoView();
};
$("#merk").addEventListener("input", fillModelLists);
$("#model").addEventListener("input", fillModelLists);
$("#chip").onclick = () => openMotor();
$(".close").onclick = () => $("#motor-dialog").close();
$("#motor-form").onsubmit = (e) => {
  e.preventDefault();
  hidePick();
  let d = Object.fromEntries(new FormData(e.target));
  for (const k of ["merk", "model", "uitvoering"]) d[k] = d[k].trim();
  if (!d.merk || !d.model) return;
  d = canonMotor(d);
  saveDraft();
  applyMotor(d);
  $("#request-form")?.remove();
  $("#motor-dialog").close();
  const next = pending;
  pending = "";
  if (next === "overzicht" && location.hash !== "#overzicht") location.hash = "overzicht";
  else if (next && next !== "overzicht" && R[next] && R[next] !== location.pathname) location.href = R[next];
  else render();
};
$(".burger").onclick = () => {
  const open = $(".nav").classList.toggle("open");
  $(".burger").setAttribute("aria-expanded", String(open));
};
// Esc sluit het mobiele menu (toetsenbord), focus terug op de menuknop.
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && $(".nav").classList.contains("open")) {
    $(".nav").classList.remove("open");
    $(".burger").setAttribute("aria-expanded", "false");
    $(".burger").focus();
  }
});
window.addEventListener("hashchange", () => {
  if (oldHash()) return;
  render();
  window.scrollTo({ top: 0, behavior: "instant" });
  $("#main").focus({ preventScroll: true });
});
// Data laden (zelfde JSON's en prijsformule als de vorige site), daarna tekenen.
const round = (x) => Math.round(x);
async function boot() {
  if (oldHash()) return;
  const get = (f) => fetch("/assets/data/" + f).then((r) => {
    if (!r.ok) throw new Error(f);
    return r.json();
  });
  const [motoren, banden, assort, reviews] = await Promise.all([get("motoren.json"), get("banden.json"), get("banden-assortiment.json"), get("reviews.json").catch(() => null)]);
  reviewData = reviews && typeof reviews === "object" ? reviews : null;
  const f = banden.formule,
    prijs = (t) => (t.inkoop_excl_btw > 0 ? round(t.inkoop_excl_btw * (1 + f.marge) * (1 + f.buffer) * f.btw) : null),
    assortiment = {};
  for (const [k, list] of Object.entries(assort.maten)) assortiment[k] = list.map((t) => ({ merk: t.merk, band: t.band, type: t.type, notatie: t.notatie, prijs: prijs(t) }));
  DATA = {
    motoren,
    banden: { maten: banden.maten, montage: banden.montage_per_band, datum: banden.prijzen_bijgewerkt, assortiment, types: assort.types.map((t) => [t[0], t[1]]) },
  };
  motor = loadMotor();
  if (motor) motor = canonMotor(motor); // eerder opgeslagen 'harley davidson' e.d. alsnog herkennen
  initPick();
  $("#merken").innerHTML = Object.keys(DATA.motoren.merken)
    .map((m) => `<option value="${escapeHTML(m)}"></option>`)
    .join("");
  render();
  if (location.hash && location.hash !== "#overzicht") {
    const t = document.getElementById(location.hash.slice(1));
    if (t) t.scrollIntoView();
  }
}
// Klikteller (13 okt 2026): cookieloze GoatCounter-events (goatcounter.count met event: true) voor WhatsApp en bellen; sinds 19 okt 2026 ook mail (klik-mail / klik-mail-formulier).
// Geen cookies, geen persoonsgegevens, geen extra diensten. Zonder GoatCounter (preview, blocker) gebeurt er niets.
function gcEvent(path) {
  try {
    if (window.goatcounter && typeof window.goatcounter.count === "function") window.goatcounter.count({ path, title: path, event: true });
  } catch (e) {}
}
document.addEventListener(
  "click",
  (e) => {
    const a = e.target.closest?.('a[href^="https://wa.me/"], a[href^="tel:"], a[href^="mailto:"]');
    if (!a) return;
    const h = a.getAttribute("href");
    gcEvent(a.id === "wa-open" ? "klik-whatsapp-formulier" : a.id === "mail-open" ? "klik-mail-formulier" : /^mailto:/.test(h) ? "klik-mail" : /^tel:/.test(h) ? "klik-bellen" : "klik-whatsapp");
  },
  true,
);
window.OG_READY = boot().catch(() => {
  document.documentElement.classList.add("og-nodata");
});
