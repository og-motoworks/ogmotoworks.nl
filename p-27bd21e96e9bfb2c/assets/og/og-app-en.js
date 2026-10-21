"use strict";
let DATA = null; // geladen uit /p-27bd21e96e9bfb2c/assets/data/*.json (zelfde bron en formule als de vorige site)
const BODY = document.body.dataset;
const R = window.OG_ROUTES; // route -> echte URL (per taal), uit de build
const FORMSPREE = "https://formspree.io/f/myezrojv";
// Mailknop naast elke WhatsApp-aanvraagknop (19 okt 2026). Teksten in MAIL_T (EN via app_en.py); regeleinden %0D%0A.
const MAIL = "info@ogmotoworks.nl";
const MAIL_T = { btn: "Email us", std: "Request via website", winter: "Winter package request via website", lines: ["Name:", "Motorcycle (make, model, year):", "Registration number:", "What needs to be done:"], winterLine: "Winter package (Basic, Plus or Complete):" };
const mailTpl = (winter) => (winter ? [...MAIL_T.lines.slice(0, 3), MAIL_T.winterLine, MAIL_T.lines[3]] : MAIL_T.lines).map((l) => l + " \n").join("");
const mailHref = (subject, body) => "mailto:" + MAIL + "?subject=" + encodeURIComponent(subject) + "&amp;body=" + encodeURIComponent(String(body).replace(/\r?\n/g, "\r\n"));
// /p-27bd21e96e9bfb2c/motor-schade/ (9 okt 2026): vraag in "Goed om te weten" op de probleempagina's en link op de homepage. EN via app_en.py.
const SCHADE = { faq: ["Crashed or dropped your bike?", `We inspect the damage, consult your insurer's assessor and help you find the best repair. <a href="${R.schade}">Read what to do about motorcycle damage</a>.`], home: "Damage after a fall? ↗" };
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
  { naam: "Winterklaar Basic", prijs: 89 },
  { naam: "Winterklaar Plus", prijs: 209 },
  { naam: "Winterklaar Complete", prijs: 329 },
];
const winterOn = () => BODY.winterpage === "1" || BODY.winter === "live";
const winterLabel = (w) => w.naam + " (from " + euro(w.prijs) + ")";
const winterOf = (beurt) => WINTER.find((w) => beurt && beurt.startsWith(w.naam + " ("));
const SERVICES = {
  onderhoud: {
    title: "Maintenance",
    description: "Scheduled servicing",
    text: "Tell us which service you want. You get a quote up front that fits your bike.",
    price: "€75 / hour",
    priceNote: "Parts are charged separately.",
  },
  probleem: {
    title: "Problem or fault",
    description: "Warning light, leak or crash damage",
    text: "Tell us what you notice. We'll look into it with you and discuss the next step.",
    price: "€75 / hour",
    priceNote:
      "We agree on diagnosis and repairs with you, so you always know where you stand.",
  },
  banden: {
    title: "Tyres",
    description: "Advice and price for your size",
    text: "Choose matching sizes and browse the range. We'll check your choice and the price in the quote.",
    price: "€50 / tyre",
    priceNote: "Fitting incl. VAT. The tyre itself is extra.",
  },
  ombouw: {
    title: "Custom work & lights",
    description: "Indicators and accessories",
    text: "Make your bike your own. Tell us which lights or accessories you want fitted.",
    price: "On request",
    priceNote: "A quote up front. Extra work always after consultation.",
  },
};
// Nieuwe foto's (19 okt 2026, FOTOS24): eigen foto per keuzeknop als <img> met alt; knop 01 en 04 houden hun CSS-achtergrond.
const SERVICE_FOTO = {
  probleem: { src: "/p-27bd21e96e9bfb2c/assets/og/69055eadb5a7f728.webp", w: 480, h: 640, alt: "Open carburettors on our workbench at OG MotoWorks" },
  banden: { src: "/p-27bd21e96e9bfb2c/assets/og/67a61a5ce7d923b3.webp", w: 480, h: 640, alt: "Rear wheel with a Bridgestone Battlax tyre on a paddock stand at OG MotoWorks" },
};
function selected() {
  return `<div class="selected"><div><small>YOUR BIKE</small><strong>${motor ? escapeHTML(motorLabel(motor)) : "No bike chosen yet"}</strong></div><button class="btn secondary" data-motor>${motor ? "Change" : "Choose your bike"}</button></div>`;
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
  return `<div class="steps"><div class="step"><h3><b>01</b> Your bike</h3><p>Choose your bike and tell us what you need.</p></div><div class="step"><h3><b>02</b> Quote & date</h3><p>We discuss the price and an available date.</p></div><div class="step"><h3><b>03</b> Getting to work</h3><p>Work by appointment. Extra work only after consultation.</p></div></div>`;
}
function faqBlock(k = "algemeen") {
  const rows =
    k === "banden"
      ? [
          [
            "I don't know my tyre size. What now?",
            "You can ask for advice without choosing tyres. Enter your bike and say you'd like help; we check the size with you.",
          ],
          [
            "Is fitting included in the tyre price?",
            "No. The tyre price and €50 fitting per tyre are shown separately. With a complete choice you see the combined amount. Extra work is discussed up front.",
          ],
          [
            "Are the tyres available right away?",
            "The list is a range, not live stock. We confirm availability and the final price in the quote.",
          ],
        ]
      : [
          [
            "Do I need to know exactly what's needed?",
            "No. Pick what fits best and briefly describe your question. We think along with you.",
          ],
          [
            "When is my appointment confirmed?",
            "Once we confirm it. A WhatsApp request is not a booking yet.",
          ],
          [
            "What happens with extra work?",
            "Extra work is discussed with you first. You know the costs up front.",
          ],
        ];
  if (k === "probleem" && location.pathname !== R.schade) rows.unshift(SCHADE.faq);
  return `<div class="faq"><h2>Good to know</h2>${rows.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join("")}</div>`;
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
// Google-reviews (8 okt 2026): de nachtelijke GitHub Action zet ze in /p-27bd21e96e9bfb2c/assets/data/reviews.json (archief, nieuwste eerst).
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
  return `<figure class="quote-card"><div class="review-stars" aria-label="${stars} out of 5 stars">${"★".repeat(stars)}${"☆".repeat(5 - stars)} <span>Google</span></div><blockquote${lang}>${escapeHTML(cut)}</blockquote>${more ? `<a class="rv-more" href="${escapeHTML(safeUrl(r.google_url) || alle)}" target="_blank" rel="noopener">Read more on Google ↗</a>` : ""}<figcaption>${who}${when ? `<span class="rv-date">${escapeHTML(when)}</span>` : ""}</figcaption></figure>`;
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
const MIX_POOL = [["/p-27bd21e96e9bfb2c/assets/og/fbab2b26cb8a1c67.jpg", "Freddy van OG MotoWorks stelt de koppelingskabel van een BMW M 1000 R af bij blok en hendel, zodat de koppeling weer vrije speling heeft en 100% grijpt", "Freddy from OG MotoWorks adjusts the clutch cable of a BMW M 1000 R at the engine and lever, so the clutch has free play again and grips fully", "Slippende koppeling M 1000 R verholpen", "Slipping M 1000 R clutch fixed", "40% 50%"], ["/p-27bd21e96e9bfb2c/assets/og/96faa0aebae8cc16.webp", "Nieuwe ketting en achtertandwiel op een blauwe velg, net gemonteerd bij OG MotoWorks", "New chain and rear sprocket on a blue wheel, just fitted at OG MotoWorks", "Nieuwe kettingset gemonteerd", "New chain kit fitted", ""], ["/p-27bd21e96e9bfb2c/assets/og/ac0a9ec9df792149.webp", "Motor op de hefbrug bij OG MotoWorks: bij het demonteren voor een nieuwe uitlaat brak een spruitstukbout af in het blok, die we eruit hebben gehaald", "Bike on the lift at OG MotoWorks: a manifold bolt snapped in the engine while removing the exhaust for a new one, and we extracted it", "Afgebroken uitlaatbout uit het blok", "Snapped exhaust bolt removed", ""], ["/p-27bd21e96e9bfb2c/assets/og/c23dc24f7b97c31f.webp", "Rood-wit voorwiel met sportband, door OG MotoWorks schoongemaakt", "Red-white front wheel with sports tyre, cleaned by OG MotoWorks", "Voorwiel schoongemaakt", "Front wheel cleaned", ""], ["/p-27bd21e96e9bfb2c/assets/og/1ce3e2ad8f70fe0c.webp", "Drie motorrijders op hun motoren, weer op weg", "Three riders on their bikes, back on the road", "Drie tevreden klanten, weer op weg", "Three happy riders, back on the road", ""], ["/p-27bd21e96e9bfb2c/assets/og/d4c440bce03ab51e.webp", "Freddy leest met een diagnosetablet een BMW GS uit op de motorbrug", "Freddy reading out a BMW GS with a diagnostic tablet on the motorcycle lift", "BMW GS uitlezen met tablet", "Reading out a BMW GS", ""], ["/p-27bd21e96e9bfb2c/assets/og/4257e6c5efa08485.webp", "BMW M 1000 R zonder kuip en tank bij OG MotoWorks: voor de nieuwe tuning hebben we het luchtfilterhuis aangepast en de temperatuursensor verplaatst", "BMW M 1000 R without fairing and tank at OG MotoWorks: for the new tuning we modified the airbox and relocated the temperature sensor", "M 1000 R uitgebouwd voor nieuwe tuning", "M 1000 R stripped for new tuning", "55% 50%"], ["/p-27bd21e96e9bfb2c/assets/og/f30af2a867cafd0e.webp", "Freddy van OG MotoWorks bij een gele Yamaha: de achterband liep leeg en met een sopje vonden we het gaatje", "Freddy from OG MotoWorks with a yellow Yamaha: the rear tyre kept losing air and we found the hole with soapy water", "Lek achterband gevonden met sopje", "Rear tyre leak found with soapy water", "50% 50%"], ["/p-27bd21e96e9bfb2c/assets/og/93478da69d6ff39a.webp", "Yamaha FZ1N met het klepdeksel eraf bij OG MotoWorks: nokkenassen en distributieketting vrij om de klepspeling af te stellen", "Yamaha FZ1N with the valve cover off at OG MotoWorks: camshafts and timing chain exposed to adjust the valve clearance", "Klepspeling Yamaha FZ1N afstellen", "Adjusting Yamaha FZ1N valve clearance", "50% 50%"], ["/p-27bd21e96e9bfb2c/assets/og/63bcc500edf3b2bf.webp", "We meten na bij het afstellen van ketting en achterwiel van een wit-rode custom motor", "We measure while adjusting the chain and rear wheel of a white and red custom bike", "Ketting afstellen met meetlat", "Chain adjusted with a rule", "62% 50%"], ["/p-27bd21e96e9bfb2c/assets/og/27ac5d0f76fb0f50.webp", "Motor van bovenaf met de tank eraf en de carburateurs uitgebouwd", "Motorcycle seen from above with the tank off and the carburettors removed", "Tank eraf, carburateurs uitgebouwd", "Tank off, carburettors removed", "55% 50%"], ["/p-27bd21e96e9bfb2c/assets/og/3ca9d7243c2bdbbe.webp", "BMW F900XR bij OG MotoWorks: verlicht logo inbouwen", "BMW F900XR at OG MotoWorks: fitting an illuminated logo", "BMW F900XR: verlicht logo inbouwen", "BMW F900XR: fitting an illuminated logo", "45% 50%"], ["/p-27bd21e96e9bfb2c/assets/og/b7b53cb96d2ef66c.webp", "Goudkleurige voorvork, remklauw en remschijf van een sportmotor op de paddockstand", "Gold front fork, brake caliper and disc of a sports bike on a paddock stand", "Gouden voorvork en remklauw", "Gold fork and brake caliper", "40% 50%"], ["/p-27bd21e96e9bfb2c/assets/og/959d17ccfa01aa7d.webp", "Suzuki GSX-R750 bij aflevering, door OG MotoWorks volledig opnieuw opgebouwd met een nieuwe full carbon kuipset", "Suzuki GSX-R750 at delivery, fully rebuilt by OG MotoWorks with a new full carbon fairing set", "Suzuki GSX-R750 met full carbon kuip", "Suzuki GSX-R750 in full carbon", ""], ["/p-27bd21e96e9bfb2c/assets/og/96a6c3b59b88e419.webp", "Vooraanzicht van de Suzuki GSX-R750 met nieuwe full carbon kuipset, volledig opgebouwd door OG MotoWorks", "Front view of the Suzuki GSX-R750 with a new full carbon fairing set, fully rebuilt by OG MotoWorks", "GSX-R750 opgebouwd, klaar voor aflevering", "GSX-R750 rebuilt, ready for delivery", ""], ["/p-27bd21e96e9bfb2c/assets/og/7b0625950d6c822c.webp", "Yamaha R7 bij OG MotoWorks die het verschil laat zien tussen stealth-spiegels en een normale spiegel", "Yamaha R7 at OG MotoWorks showing the difference between stealth mirrors and a standard mirror", "Yamaha R7: stealth- vs normale spiegel", "Yamaha R7: stealth vs stock mirror", ""], ["/p-27bd21e96e9bfb2c/assets/og/9617a9366f91f823.webp", "Rood K&N-luchtfilter bij OG MotoWorks, klaar om te monteren", "Red K&N air filter at OG MotoWorks, ready to fit", "K&N-luchtfilter", "K&N air filter", ""], ["/p-27bd21e96e9bfb2c/assets/og/9a5ab86f8afdfad0.webp", "Voorvorkpoot die olie lekt, van dichtbij bij OG MotoWorks", "A fork leg leaking oil, up close at OG MotoWorks", "Lekkende voorvorkpoot", "Leaking fork leg", ""], ["/p-27bd21e96e9bfb2c/assets/og/a111ea600310e170.webp", "Uitlaatbochten onder het blok, weer gemonteerd nadat OG MotoWorks de afgebroken spruitstukbout had verwijderd", "Exhaust headers under the engine, refitted after OG MotoWorks removed the snapped manifold bolt", "Uitlaatbout hersteld, alles weer gemonteerd", "Exhaust bolt fixed, all refitted", ""], ["/p-27bd21e96e9bfb2c/assets/og/1f1c2e4e88a50993.webp", "Gecustomizede Yamaha FZ1N uit 2015 in onze werkplaats, met andere kuipdelen, stickers, een koplampmasker en veel andere details", "Customised 2015 Yamaha FZ1N in our workshop, with different fairing panels, decals, a headlight mask and many other details", "Custom Yamaha FZ1N (2015)", "Custom Yamaha FZ1N (2015)", ""], ["/p-27bd21e96e9bfb2c/assets/og/e7575824179c5348.webp", "Close-up van de gecustomizede Yamaha FZ1N uit 2015 met stuur en koplampmasker", "Close-up of the customised 2015 Yamaha FZ1N with bars and headlight mask", "Custom FZ1N van dichtbij", "Custom FZ1N up close", ""], ["/p-27bd21e96e9bfb2c/assets/og/b38577642d6bf19b.webp", "Carburateurs op de werkbank, klaar voor revisie", "Carburettors on the workbench, ready for overhaul", "Carburateurs klaar voor revisie", "Carburettors ready for overhaul", ""], ["/p-27bd21e96e9bfb2c/assets/og/2f3d9bdb0551a856.webp", "KTM 1290 Super Duke met custom remschijven op het voorwiel, en de tank", "KTM 1290 Super Duke with custom brake discs on the front wheel, and the tank", "Super Duke met custom remschijven", "Super Duke with custom brake discs", ""], ["/p-27bd21e96e9bfb2c/assets/og/5a39b56ced11f084.webp", "Voorkant van een KTM Super Duke voor een garagedeur", "Front end of a KTM Super Duke by a garage door", "KTM Super Duke, voorkant", "KTM Super Duke front end", ""], ["/p-27bd21e96e9bfb2c/assets/og/5963e3625e05d781.webp", "Motoren veilig binnen in een van de werkplaatsunits van OG MotoWorks", "Motorcycles safe inside one of the OG MotoWorks workshop units", "Motoren veilig binnen in onze werkplaats", "Bikes safe inside our workshop", ""], ["/p-27bd21e96e9bfb2c/assets/og/c760bb91d663ed9b.webp", "Tank en blok van de gecustomizede Yamaha FZ1N uit 2015 van dichtbij", "Tank and engine of the customised 2015 Yamaha FZ1N up close", "FZ1N custom: tank en blok", "FZ1N custom: tank and engine", ""], ["/p-27bd21e96e9bfb2c/assets/og/58ac9bf59ccdbfb6.webp", "Blauwe Suzuki GSR750 in onze werkplaats: na valschade hebben we de tank, zijkappen en het dynamodeksel vervangen", "Blue Suzuki GSR750 in our workshop: after crash damage we replaced the tank, side covers and alternator cover", "GSR750 na valschade hersteld", "GSR750 repaired after a crash", ""], ["/p-27bd21e96e9bfb2c/assets/og/6c5343f09d2af466.webp", "Blok en frame van de Suzuki GSR750 met de tank eraf, tijdens het herstel van de valschade", "Engine and frame of the Suzuki GSR750 with the tank off, during the crash repair", "GSR750 met de tank eraf", "GSR750 with the tank off", ""], ["/p-27bd21e96e9bfb2c/assets/og/f7844fe12fb1112a.webp", "Blok en SC-uitlaat van een zwarte Yamaha MT-07", "Engine and SC exhaust of a black Yamaha MT-07", "MT-07 met SC-uitlaat", "MT-07 with SC exhaust", ""], ["/p-27bd21e96e9bfb2c/assets/og/2bf65c6978ca9396.webp", "SC-Project-uitlaat en blok van een zwarte Yamaha MT-07, van dichtbij bij OG MotoWorks", "SC-Project exhaust and engine of a black Yamaha MT-07, up close at OG MotoWorks", "SC-Project-uitlaat op Yamaha MT-07", "SC-Project exhaust on a Yamaha MT-07", ""], ["/p-27bd21e96e9bfb2c/assets/og/ca599a8b98cdb10f.webp", "Honda CB-F zonder kuip bij OG MotoWorks: we bouwden carburateurs en luchtfilter uit, vonden losse sproeiers in de carburateur, reinigden alles en stelden de carburateurs opnieuw af", "Honda CB-F without fairing at OG MotoWorks: we removed the carburettors and air filter, found loose jets inside, cleaned everything and re-tuned the carbs", "Honda CB-F: carburateurs gereinigd en afgesteld", "Honda CB-F: carbs cleaned and tuned", ""], ["/p-27bd21e96e9bfb2c/assets/og/1e72a7a2e2c1f8d5.webp", "Gouden voorvork, carbon spatbord en golvende remschijven van een Suzuki GSX-R750 in de werkplaats van OG MotoWorks", "Gold fork, carbon mudguard and wavy brake discs of a Suzuki GSX-R750 in the OG MotoWorks workshop", "Suzuki GSX-R750: voorvork en remschijven", "Suzuki GSX-R750: fork and brake discs", ""], ["/p-27bd21e96e9bfb2c/assets/og/5dab6c5a3f8e1e7b.webp", "Een stuureinde wordt vervangen bij OG MotoWorks, van dichtbij", "A handlebar end being replaced at OG MotoWorks, up close", "Stuureinden vervangen", "Bar ends replaced", ""], ["/p-27bd21e96e9bfb2c/assets/og/b45b5bd254126b8c.webp", "Groene Kawasaki Z750 op de heftafel bij OG MotoWorks voor een aankoopkeuring", "Green Kawasaki Z750 on the lift at OG MotoWorks for a pre-purchase inspection", "Aankoopkeuring Kawasaki Z750", "Pre-purchase inspection Kawasaki Z750", ""], ["/p-27bd21e96e9bfb2c/assets/og/27173329e7b6cba5.webp", "Oliepeilglas en blok van dichtbij", "Oil sight glass and engine up close", "Oliepeil in het kijkglas", "Oil sight glass", ""], ["/p-27bd21e96e9bfb2c/assets/og/9ed75d19e1f0c485.webp", "Oranje KTM 890 Duke in de werkplaats van OG MotoWorks met custom dynamische knipperlichten en LED-dagrijverlichting", "Orange KTM 890 Duke in the OG MotoWorks workshop with custom dynamic turn signals and LED daytime running lights", "Dynamische knipperlichten op KTM 890 Duke", "Dynamic indicators on a KTM 890 Duke", ""], ["/p-27bd21e96e9bfb2c/assets/og/60f4798ea826fa31.webp", "Groene aanslag van een lekkende voorvork die helemaal doorloopt tot aan de remklauw, gezien bij OG MotoWorks", "Green deposit from a leaking front fork running all the way down to the brake caliper, spotted at OG MotoWorks", "Lekkende voorvork: groene aanslag tot remklauw", "Leaking fork: green residue down to caliper", ""], ["/p-27bd21e96e9bfb2c/assets/og/cff6f718eec0de8a.webp", "De custom Yamaha FZ1N uit 2015 bijna volledig gestript op de heftafel bij OG MotoWorks", "The custom 2015 Yamaha FZ1N almost completely stripped on the lift at OG MotoWorks", "Custom Yamaha FZ1N (2015) bijna volledig gestript", "Custom Yamaha FZ1N (2015) almost fully stripped", ""], ["/p-27bd21e96e9bfb2c/assets/og/ccf3ae0dacf49c0e.webp", "Yamaha FJR1300 die niet goed liep, tank eraf bij OG MotoWorks terwijl we de gasklephuizen uitbouwen", "Yamaha FJR1300 that wasn't running well, tank off at OG MotoWorks while we remove the throttle bodies", "Yamaha FJR1300: gasklephuizen eruit", "Yamaha FJR1300: throttle bodies removed", ""], ["/p-27bd21e96e9bfb2c/assets/og/55dbf5bc53b53d0b.webp", "Custom Yamaha FZ1N met custom koelvloeistofslangen bij OG MotoWorks", "Custom Yamaha FZ1N with custom coolant hoses at OG MotoWorks", "Custom FZ1N met custom koelvloeistofslangen", "Custom FZ1N with custom coolant hoses", ""], ["/p-27bd21e96e9bfb2c/assets/og/49fce3a48cd8a0d5.webp", "Custom Yamaha FZ1N met een carbon stuur en een Hyperpro-stuurdemper bij OG MotoWorks", "Custom Yamaha FZ1N with a carbon handlebar and a Hyperpro steering damper at OG MotoWorks", "Custom FZ1N: carbon stuur en Hyperpro-stuurdemper", "Custom FZ1N: carbon bars, Hyperpro steering damper", ""], ["/p-27bd21e96e9bfb2c/assets/og/90abf9bf2fb1ec39.webp", "Remvloeistof testen met een tester in de hand", "Testing brake fluid with a tester in hand", "Remvloeistof testen", "Testing the brake fluid", ""], ["/p-27bd21e96e9bfb2c/assets/og/83574737a431500a.webp", "De custom Yamaha FZ1N in de werkplaats van OG MotoWorks na een testrit", "The custom Yamaha FZ1N in the OG MotoWorks workshop after a test ride", "Custom FZ1N na een testrit", "Custom FZ1N after a test ride", ""], ["/p-27bd21e96e9bfb2c/assets/og/08ff400ef4395459.webp", "Oranje KTM 1290 Super Duke R Evo bij OG MotoWorks met een gas dat niet werkte", "Orange KTM 1290 Super Duke R Evo at OG MotoWorks with a throttle that didn't work", "Super Duke R Evo: gas werkte niet", "Super Duke R Evo: throttle not working", ""], ["/p-27bd21e96e9bfb2c/assets/og/aa92134975cc1add.webp", "Oude blauwe brandstoftank van een Suzuki GSR750 uit 2015 bij OG MotoWorks, waarvan we de brandstofpomp en kleine onderdelen naar een nieuwe tank overzetten", "Old blue fuel tank of a 2015 Suzuki GSR750 at OG MotoWorks, with the fuel pump and small parts being moved over to a new tank", "Suzuki GSR750: brandstofpomp naar nieuwe tank", "Suzuki GSR750: fuel pump moved to new tank", ""], ["/p-27bd21e96e9bfb2c/assets/og/6c39413eaee0c1e5.webp", "Koplamp van een blauwe Suzuki van dichtbij", "Headlight of a blue Suzuki up close", "Beschadigde koplamp opgepolijst", "Damaged headlight polished", ""], ["/p-27bd21e96e9bfb2c/assets/og/8667b8ce7862ef0b.webp", "Close-up van een lekkende voorvorkpoot van een zwarte Kawasaki Z750 in de werkplaats van OG MotoWorks", "Close-up of a leaking front fork leg on a black Kawasaki Z750 in the OG MotoWorks workshop", "Lekkende voorvorkpoot Kawasaki Z750", "Leaking fork leg on a Kawasaki Z750", ""], ["/p-27bd21e96e9bfb2c/assets/og/cef0203de0dc1d3d.webp", "Motorblok van een BMW F650GS bij OG MotoWorks dat olie lekt bij de stekker naar de dynamo", "Engine of a BMW F650GS at OG MotoWorks leaking oil at the alternator connector", "BMW F650GS: olielek bij dynamostekker", "BMW F650GS: oil leak at alternator plug", ""], ["/p-27bd21e96e9bfb2c/assets/og/1075374a73e35aac.webp", "Voorkant van een zwarte Yamaha MT-07 in het groen", "Front end of a black Yamaha MT-07 in the greenery", "Yamaha MT-07, voorkant", "Yamaha MT-07 front end", ""], ["/p-27bd21e96e9bfb2c/assets/og/55197db798bd277f.webp", "Nieuwe bougiekabels gemonteerd op het blok van een Suzuki Intruder bij OG MotoWorks", "New spark plug leads fitted to the engine of a Suzuki Intruder at OG MotoWorks", "Nieuwe bougiekabels Suzuki Intruder", "New spark plug leads on a Suzuki Intruder", ""], ["/p-27bd21e96e9bfb2c/assets/og/d39e3a1b9251f4c7.webp", "Linkerkant van een blauw-zwarte Suzuki GSR750 met schade in de werkplaats van OG MotoWorks", "Left side of a damaged blue and black Suzuki GSR750 in the OG MotoWorks workshop", "Schade linkerkant Suzuki GSR750", "Left-side damage on a Suzuki GSR750", ""], ["/p-27bd21e96e9bfb2c/assets/og/bd21b39ee9d28fe3.webp", "Oliewissel bij OG MotoWorks: de oude olie loopt af in een opvangbak onder de motor", "Oil change at OG MotoWorks: old oil draining into a drain pan under the bike", "Oliewissel in onze werkplaats", "Oil change in our workshop", ""], ["/p-27bd21e96e9bfb2c/assets/og/9e00bd4920d21367.webp", "Custom Yamaha FZ1N schoon en droog op de paddockstand bij OG MotoWorks, klaar voor de klant", "Custom Yamaha FZ1N clean and dry on the paddock stand at OG MotoWorks, ready for the customer", "Yamaha FZ1N klaar voor de klant", "Yamaha FZ1N ready for the customer", ""], ["/p-27bd21e96e9bfb2c/assets/og/3a0c519ed9ab4c31.webp", "Ketting van een Honda CB1000R nameten met een meetlint", "Measuring the chain of a Honda CB1000R with a tape measure", "Kettingspeling CB1000R meten", "Measuring CB1000R chain slack", ""], ["/p-27bd21e96e9bfb2c/assets/og/078c9ed7d34dfa0b.webp", "Witte Honda CB1000R buiten bij OG MotoWorks", "White Honda CB1000R outside at OG MotoWorks", "Honda CB1000R", "Honda CB1000R", ""], ["/p-27bd21e96e9bfb2c/assets/og/73479e9f1702463a.webp", "Honda op de heftafel in onze werkplaats", "Honda on the lift table in our workshop", "Honda CBR600F op de heftafel", "Honda CBR600F on the lift", ""], ["/p-27bd21e96e9bfb2c/assets/og/01cd525a28d0d3cf.webp", "Uitgebouwde carburateurs van een Honda van dichtbij", "Removed carburettors of a Honda up close", "CBR600F-carburateurs uitgebouwd", "CBR600F carburettors removed", ""], ["/p-27bd21e96e9bfb2c/assets/og/e6c74bdf144aa07a.webp", "Carburateur van een Honda CBR600F bij OG MotoWorks: de kamer met de gasnaald zit vol zwarte aanslag, waardoor de motor stotterde als hij warm werd", "Honda CBR600F carburettor at OG MotoWorks: the needle chamber is full of black deposits that made the engine stutter once warm", "Honda CBR600F: vervuilde carburateur, stottert warm", "Honda CBR600F: fouled carburettor, stutters when warm", ""], ["/p-27bd21e96e9bfb2c/assets/og/e7f755e0d42b6de6.webp", "Zwarte Honda CBR600F op de heftafel in de werkplaats van OG MotoWorks tijdens het carburateurwerk", "Black Honda CBR600F on the lift in the OG MotoWorks workshop during carburettor work", "Honda CBR600F in de werkplaats", "Honda CBR600F in the workshop", ""], ["/p-27bd21e96e9bfb2c/assets/og/cc8ab4f41a621adc.webp", "Achterband bij OG MotoWorks waarin we het gat hebben gevonden en gemarkeerd", "Rear tyre at OG MotoWorks where we found and marked the puncture", "Lekke band: gat gevonden en gemarkeerd", "Flat tyre: hole found and marked", ""], ["/p-27bd21e96e9bfb2c/assets/og/ee6d9616ba0a547b.webp", "Kettingspray op de ketting van een Yamaha FZ1", "Chain spray on the chain of a Yamaha FZ1", "Band controleren met sopje", "Leak test with soapy water", ""], ["/p-27bd21e96e9bfb2c/assets/og/45cdb9a0b5c1894e.webp", "Remklauw en remschijf van een Yamaha FZ1 van dichtbij", "Brake caliper and disc of a Yamaha FZ1 up close", "Versleten remblok FZ1N", "FZ1N: worn brake pad", ""], ["/p-27bd21e96e9bfb2c/assets/og/ce8aba0217e8dcd0.webp", "Gele Yamaha FZ1 op de heftafel in onze werkplaats", "Yellow Yamaha FZ1 on the lift table in our workshop", "Yamaha FZ1N op de heftafel", "Yamaha FZ1N on the lift", ""], ["/p-27bd21e96e9bfb2c/assets/og/fb128274ac34d922.webp", "BMW R1200GS Adventure uit 2008 bij OG MotoWorks, waar we met de diagnosetablet de versnellingssensor opnieuw inleren omdat hij niet in neutraal bleef", "2008 BMW R1200GS Adventure at OG MotoWorks, re-learning the gear position sensor with the diagnostic tablet because it would not stay in neutral", "BMW R1200GS Adventure: neutraalstand opnieuw ingeleerd", "BMW R1200GS Adventure: neutral position re-learned", ""]];
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
  return `<section class="section social-section"><div class="wrap"><div class="social-head"><div><span class="eyebrow">A look inside the workshop</span><h2>Bikes, work & stories.</h2></div><a class="btn secondary instagram-btn" href="https://www.instagram.com/og_motoworks" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="18" cy="6" r="1" fill="currentColor" stroke="none"/></svg>Follow OG MotoWorks on Instagram ↗</a></div><div class="photo-mix" data-mix><figure><img data-gallery-photo="MAINTENANCE_URI" alt="Freddy working on a BMW motorcycle" loading="lazy"><figcaption>Freddy at work</figcaption></figure><figure><img src="/p-27bd21e96e9bfb2c/assets/og/96faa0aebae8cc16.webp" width="560" height="700" alt="Gold chain and rear sprocket on a blue wheel, in our workshop" loading="lazy" decoding="async"><figcaption>Chain and rear sprocket</figcaption></figure><figure><img src="/p-27bd21e96e9bfb2c/assets/og/ac0a9ec9df792149.webp" width="560" height="700" alt="A motorcycle on our lift at OG MotoWorks, with the tools ready on the bench" loading="lazy" decoding="async"><figcaption>Stripping down on the lift</figcaption></figure><figure><img src="/p-27bd21e96e9bfb2c/assets/og/c23dc24f7b97c31f.webp" width="560" height="700" alt="Red and white front wheel with a sports tyre at OG MotoWorks" loading="lazy" decoding="async"><figcaption>Red-white front wheel, sports tyre</figcaption></figure><figure><img data-gallery-photo="GROUP_URI" alt="Three riders on different motorcycles" loading="lazy"><figcaption>Back on the road</figcaption></figure><figure><img src="/p-27bd21e96e9bfb2c/assets/og/b38577642d6bf19b.webp" width="560" height="700" alt="Carburettors on the workbench, ready for overhaul" loading="lazy" decoding="async"><figcaption>Carburettors ready for overhaul</figcaption></figure></div></div></section><section class="section customer-reviews" id="reviews" aria-labelledby="reviews-title"><div class="wrap"><div class="social-head"><div><span class="eyebrow">Customers in their own words</span><h2 id="reviews-title">Reviews on Google</h2></div><button class="btn secondary" id="reviews-pause" type="button" aria-pressed="false">Pause reviews</button></div><div class="review-viewport" id="review-viewport" role="region" aria-label="Customer reviews, changing automatically" tabindex="0"><div class="review-track">${rv.items.map((r) => reviewCard(r, rv.alle)).join("")}</div></div><p class="note" id="reviews-updated" style="margin-top:18px">Reviews via Google Maps (in Dutch) · Last updated: ${escapeHTML(new Date(rv.datum).toLocaleDateString(EN ? "en-GB" : "nl-NL", { day: "numeric", month: "long", year: "numeric" }))}</p><div class="actions"><a class="btn secondary" id="reviews-alle" href="${escapeHTML(rv.alle)}" target="_blank" rel="noopener">See all reviews on Google ↗</a><a class="btn text" href="https://g.page/r/CcwNZlk_nz-kEBM/review" target="_blank" rel="noopener">Write a review ↗</a></div></div></section>`;
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
    button.textContent = paused ? "Start reviews" : "Pause reviews";
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
  return `<section class="wrap winterhome" aria-labelledby="winterhome-h"><div class="winterhome-text"><span class="eyebrow">Winter offer 2026</span><h2 id="winterhome-h">Get your bike winter-ready</h2><p>Three fixed winter packages at a fixed price. These are winter packages, not a major service. Book by 30 November, we carry them out until 20 December.</p></div><ul class="winterhome-list">${WINTER.map((w) => `<li><strong>${w.naam}</strong><span>from ${euro(w.prijs)}</span></li>`).join("")}</ul><div class="winterhome-actions"><a href="${R.winter}" class="btn">View the winter packages →</a><a href="https://wa.me/31642939555?text=Hi%20OG%20MotoWorks%2C%20I%20would%20like%20to%20book%20a%20winter%20package." class="btn secondary btn-wa" target="_blank" rel="noopener">Book via WhatsApp ↗</a><a href="${mailHref(MAIL_T.winter, mailTpl(true))}" class="btn secondary btn-mail">${MAIL_T.btn}</a></div></section>`;
}
const PAKKETFOTO = [`<picture class="wh-cardpic"><source media="(max-width:900px)" srcset="/p-27bd21e96e9bfb2c/assets/og/17826df2c6c609a5.webp" width="120" height="120"><img src="/p-27bd21e96e9bfb2c/assets/og/11c54ee808cb0d59.webp" width="400" height="225" alt="Front wheel with brake disc and Michelin tyre at OG MotoWorks" decoding="async" loading="lazy"></picture>`, `<picture class="wh-cardpic"><source media="(max-width:900px)" srcset="/p-27bd21e96e9bfb2c/assets/og/7af7ee53a2346d2f.webp" width="120" height="120"><img src="/p-27bd21e96e9bfb2c/assets/og/0661db28612e74d1.webp" width="400" height="225" alt="Oil change on the lift in our workshop" decoding="async" loading="lazy"></picture>`, `<picture class="wh-cardpic"><source media="(max-width:900px)" srcset="/p-27bd21e96e9bfb2c/assets/og/95e23693e91587eb.webp" width="120" height="120"><img src="/p-27bd21e96e9bfb2c/assets/og/287dcd85fb55674f.webp" width="400" height="225" alt="Testing brake fluid in our workshop" decoding="async" loading="lazy"></picture>`]; // PAKKETFOTOS (19 okt 2026)
function winterHero() {
  if (BODY.winter !== "live") return "";
  const k = (w, i) => `<li><a href="${R.winter}">${PAKKETFOTO[i] || ""}<strong>${w.naam.replace("Winterklaar ", "").replace("Basis", "Basic").replace("Compleet", "Complete")}</strong><span>from</span><b>${euro(w.prijs)}</b></a></li>`;
  return `<section class="wrap hero winterhero" aria-labelledby="wh-h1"><div class="wh-main"><h1 class="home-h1" id="wh-h1">Motorcycle workshop in Waalwijk for servicing, repairs and tyres</h1><p class="wh-lead">In our workshop in Waalwijk you can come to us for servicing, repairs and tyres. We work by appointment.</p><div class="wh-actions"><a href="https://wa.me/31642939555?text=Hi%20OG%20MotoWorks%2C%20I%20would%20like%20to%20book%20a%20winter%20package." class="btn btn-wa wh-big" target="_blank" rel="noopener">Book via WhatsApp ↗</a><a href="${mailHref(MAIL_T.winter, mailTpl(true))}" class="btn secondary wh-big btn-mail">${MAIL_T.btn}</a></div><a href="${R.afspraak}" class="wh-other" data-start>Other work on your bike? ${motor ? "Continue with your bike" : "Choose your bike"} →</a></div><figure class="wh-photo wh-carousel" data-carousel><picture class="wh-slide is-active"><source media="(max-width:900px)" srcset="/p-27bd21e96e9bfb2c/assets/og/cfa6457b5e49e167.webp" width="800" height="350"><img src="/p-27bd21e96e9bfb2c/assets/og/03f636bf6c7387d2.webp" width="627" height="941" alt="Freddy, owner of OG MotoWorks, with a diagnostic tablet next to a BMW in our workshop in Waalwijk" fetchpriority="high"></picture><picture class="wh-slide" aria-hidden="true"><source media="(max-width:900px)" srcset="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" data-srcset="/p-27bd21e96e9bfb2c/assets/og/d8d40614cc6e5c7e.webp" width="800" height="350"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" data-src="/p-27bd21e96e9bfb2c/assets/og/f30af2a867cafd0e.webp" width="627" height="941" alt="${EN ? "Freddy checking a part next to a yellow Yamaha in our workshop" : "Freddy met een onderdeel bij een gele Yamaha in onze werkplaats"}" decoding="async" fetchpriority="low"></picture><picture class="wh-slide" aria-hidden="true"><source media="(max-width:900px)" srcset="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" data-srcset="/p-27bd21e96e9bfb2c/assets/og/157450d395733487.webp" width="800" height="350"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" data-src="/p-27bd21e96e9bfb2c/assets/og/d4c440bce03ab51e.webp" width="627" height="941" alt="${EN ? "Freddy reading out a BMW GS with a diagnostic tablet on the motorcycle lift" : "Freddy leest met een diagnosetablet een BMW GS uit op de motorbrug"}" decoding="async" fetchpriority="low"></picture><picture class="wh-slide" aria-hidden="true"><source media="(max-width:900px)" srcset="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" data-srcset="/p-27bd21e96e9bfb2c/assets/og/62c16cbb375aea08.webp" width="800" height="350"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" data-src="/p-27bd21e96e9bfb2c/assets/og/e28c45985cb66235.webp" width="627" height="941" alt="${EN ? "Freddy adjusting the clutch of a BMW M 1000 R" : "Freddy stelt de koppeling van een BMW M 1000 R bij"}" decoding="async" fetchpriority="low"></picture><picture class="wh-slide" aria-hidden="true"><source media="(max-width:900px)" srcset="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" data-srcset="/p-27bd21e96e9bfb2c/assets/og/16cc27f2851ef762.webp" width="800" height="350"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" data-src="/p-27bd21e96e9bfb2c/assets/og/19b93c24c14f6da3.webp" width="627" height="941" alt="${EN ? "Freddy with the diagnostic tablet next to a BMW R 1200 GS Adventure on the lift" : "Freddy met de diagnosetablet bij een BMW R 1200 GS Adventure op de motorbrug"}" decoding="async" fetchpriority="low"></picture><!-- HEROFREDDY --><figcaption class="reception-caption">Freddy · OG MotoWorks</figcaption></figure><!-- WINTERFOTO --></section>`;
}
function home() {
  if (winterHero()) return winterHero() + homeRest();
  return homeOrig();
}
function homeOrig() {
  return `<section class="wrap hero reception"><div class="welcome"><span class="eyebrow">Motorcycle workshop · Waalwijk</span><h1>Welcome to<br>OG MotoWorks.</h1><p class="welcome-story">Our workshop in Waalwijk takes care of servicing, repairs, tyres and custom work on your motorcycle. Owner Freddy talks you through what's needed up front, so you know where you stand.</p><p class="welcome-note">Personal contact, honest advice and work by appointment.</p><a href="${R.afspraak}" class="btn" data-start>${motor ? "Continue with your bike" : "Choose your bike"} →</a><p class="welcome-help">Then choose what you need in a few steps.</p></div><figure><img src="/p-27bd21e96e9bfb2c/assets/og/c927c25d6be18e37.jpg" width="941" height="1672" alt="Freddy with a BMW in the OG MotoWorks workshop"><figcaption class="reception-caption">Freddy · OG MotoWorks</figcaption></figure></section><section class="reception-bottom"><div class="wrap reception-info"><span>Maintenance · Repairs · Tyres · Custom work</span><a href="${R.contact}">Waalwijk, by appointment ↗</a><a href="https://share.google/mfVz03Qhs4EkLpyDO" target="_blank" rel="noopener">Reviews on Google ↗</a><a href="${R.schade}">${SCHADE.home}</a></div></section>${winterHome()}${socialReviews()}`;
}
function homeRest() {
  return `<section class="reception-bottom"><div class="wrap reception-info"><span>Maintenance · Repairs · Tyres · Custom work</span><a href="${R.contact}">Waalwijk, by appointment ↗</a><a href="https://share.google/mfVz03Qhs4EkLpyDO" target="_blank" rel="noopener">Reviews on Google ↗</a><a href="${R.schade}">${SCHADE.home}</a></div></section><section class="wrap home-regio"><p>We are based in Waalwijk, close to Kaatsheuvel, Drunen, Tilburg and 's-Hertogenbosch. Many riders from the region come to us for servicing, repairs and tyres.</p></section><section class="wrap home-diensten" aria-labelledby="home-diensten-h"><h2 id="home-diensten-h">Our services</h2><ul class="home-diensten-list"><li><a href="/p-27bd21e96e9bfb2c/en/tyres/"><strong>Motorcycle tyres</strong><span>Advice that suits your riding style, and we fit them too.</span></a></li><li><a href="/p-27bd21e96e9bfb2c/en/services/maintenance/"><strong>Motorcycle servicing in Waalwijk</strong><span>Minor and major service following your manufacturer&#39;s schedule.</span></a></li><li><a href="/p-27bd21e96e9bfb2c/en/services/repairs/"><strong>Motorcycle repairs</strong><span>Leak, brakes or a fault: first the cause, then the repair.</span></a></li><li><a href="/p-27bd21e96e9bfb2c/en/services/pre-purchase-inspection/"><strong>Pre-purchase inspection</strong><span>Buying a bike? We check it first. €75 per inspection.</span></a></li><li class="hd-winter"><a href="/p-27bd21e96e9bfb2c/en/winter/"><strong>Winter packages</strong><span>Your bike ready for winter, from €89. Book until 30 November.</span></a></li></ul><p><a class="link" href="/p-27bd21e96e9bfb2c/en/services/">All services →</a></p><h2>Why OG MotoWorks</h2><p>We work on motorcycles of all makes. With any complaint we first find the real cause, before we replace parts. And we never do extra work without consultation: you hear up front what is needed and what it costs.</p></section>${socialReviews()}`;
}
function services() {
  return (
    pagehead(
      own("What do you need?"),
      ownText("Choose what best fits your question."),
      "onderhoud",
      true,
    ) + `<div class="wrap section">${selected()}${cards()}</div>`
  );
}
function commonFields() {
  return `<fieldset class="customer-fields" style="border:0;border-top:1px solid #3a3d44;padding:24px 0 0;margin:26px 0 0"><legend class="heading" style="padding:0 10px 0 0;font-size:23px">Your details</legend><p class="note">So we can discuss your request and make an appointment with you.</p><div class="fields"><div class="full"><label for="naam">Name</label><input id="naam" name="naam" autocomplete="name" required maxlength="120" placeholder="First and last name"></div><div><label for="telefoon">Mobile number</label><input id="telefoon" name="telefoon" type="tel" autocomplete="tel" required maxlength="30" minlength="6" placeholder="06… or +31…"></div><div><label for="email">Email address (optional)</label><input id="email" name="email" type="email" autocomplete="email" maxlength="180" placeholder="For a quote by email"></div><div><label for="kenteken">Registration (optional)</label><input id="kenteken" name="kenteken" maxlength="14" autocomplete="off" autocapitalize="characters" placeholder="AB-12-CD"></div><div><label for="voorkeur">Preferred day (optional)</label><input id="voorkeur" name="voorkeur" placeholder="For example Friday afternoon" maxlength="100"></div></div><p class="note" style="margin-top:15px">We use these details to handle your request. <a href="${R.privacy}">More about privacy</a>.</p><div class="optlist review-opt"><label class="tyre"><input type="checkbox" id="review" name="review" value="ja" aria-describedby="review-note"><strong>I agree that OG MotoWorks may ask me for a review afterwards by email or WhatsApp</strong></label></div><p class="note review-note" id="review-note" aria-live="polite"></p></fieldset>`;
}
function requestFields(k) {
  if (k === "onderhoud")
    return `<div class="fields"><div><label for="km">Mileage in km (optional)</label><input id="km" name="km" type="number" min="0" max="999999"></div><div><label for="beurt">Which service?</label><select name="beurt" id="beurt">${BODY.winterpage === "1" ? winterOptions() : ""}<option>Scheduled maintenance</option><option>Oil change</option><option>Major service</option><option>Replace fork seals (from €350)</option><option>Replace chain and sprockets (quotation)</option><option>I don't know yet</option>${winterOn() && BODY.winterpage !== "1" ? winterOptions() : ""}</select></div><div class="full"><label for="toelichting">Notes (optional)</label><textarea name="toelichting" id="toelichting" maxlength="2000" placeholder="What would you like done?"></textarea></div></div>`;
  if (k === "probleem")
    return `<label for="toelichting">What do you notice?</label><textarea name="toelichting" id="toelichting" required maxlength="2000" placeholder="${BODY.placeholder ? escapeHTML(BODY.placeholder) : "For example: the bike is hard to start when it's warm."}"></textarea><label for="wanneer" style="margin-top:20px">When does it happen? (optional)</label><input name="wanneer" id="wanneer" maxlength="200" placeholder="Since when, cold or warm, while riding…">`;
  return `<label for="toelichting">What would you like to change?</label><textarea name="toelichting" id="toelichting" required maxlength="2000" placeholder="For example different indicators or heated grips."></textarea>`;
}
function winterOptions() {
  return WINTER.map((w) => `<option>${escapeHTML(winterLabel(w))}</option>`).join("");
}
function routePage(k) {
  const s = SERVICES[k];
  return (
    pagehead(own(s.title), ownText(s.text), k, true) +
    `<div class="wrap workgrid"><div>${selected()}<form id="request-form" data-intent="${k}" class="panel"><h2>${k === "banden" ? "Choose your tyres" : "Your request"}</h2>${k === "banden" ? tyreFields() : requestFields(k)}${commonFields()}<div class="actions"><button class="btn" type="submit">Review my request →</button></div><p class="note" style="margin-top:15px">You send it yourself via WhatsApp or email. A request is not a confirmed appointment yet.</p><input class="hp" type="text" name="_gotcha" tabindex="-1" autocomplete="off" aria-hidden="true"></form></div><aside class="panel"><span class="eyebrow">Clear up front</span><p class="price">${BODY.price ? escapeHTML(BODY.price) : s.price}</p><p class="muted">${BODY.pricenote ? escapeHTML(BODY.pricenote) : s.priceNote}</p><div class="line"><span>Parts</span><strong>List price</strong></div><div class="line"><span>Up front</span><strong>Quote</strong></div><div class="line"><span>Extra work</span><strong>After consultation</strong></div><p class="note" style="margin-top:18px">Prices incl. VAT. We agree the work with you first.</p><a class="btn secondary" href="${R.tarieven}">All prices</a></aside></div><section class="section"><div class="wrap">${faqBlock(k)}</div></section>`
  );
}
function tyreFields() {
  return `<details class="hintbox"><summary>Where do I find my tyre size?</summary><p>On the sidewall of your tyre, for example 120/70 ZR17. 120 is the width in millimetres, 70 the aspect ratio and 17 the rim size in inches. Copy the full marking; we also check the version and the other markings.</p><p>Not sure? Leave the size empty and ask for advice.</p></details><p class="note" id="oem-note"></p><div class="fields"><div><label for="voor">Front tyre size</label><input id="voor" name="voor" list="sizes" maxlength="40" placeholder="120/70 ZR17"></div><div><label for="achter">Rear tyre size</label><input id="achter" name="achter" list="sizes" maxlength="40" placeholder="180/55 ZR17"></div><datalist id="sizes">${Object.keys(
    DATA.banden.assortiment,
  )
    .map((s) => `<option value="${s}"></option>`)
    .join(
      "",
    )}</datalist><div><label for="rijtype">Tyre type</label><select id="rijtype" name="rijtype"><option value="">All types</option>${DATA.banden.types.map(([v, t]) => `<option value="${v}">${escapeHTML(t)}</option>`).join("")}</select></div><div><label for="zoek">Search by tyre name</label><input id="zoek" name="zoek" maxlength="100" placeholder="Road 6 or SportSmart"></div><div><label for="bandmerk">Tyre brand</label><select id="bandmerk" name="bandmerk"><option value="">All brands</option>${[
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
    )}</select></div><div><label for="sortering">Sort</label><select id="sortering" name="sortering"><option value="naam">Name A–Z</option><option value="laag">Price low–high</option><option value="hoog">Price high–low</option></select></div><div class="full"><label for="positie">Which tyre do you want to replace?</label><select id="positie" name="positie"><option value="beide">Front and rear</option><option value="voor">Front only</option><option value="achter">Rear only</option></select></div></div><p class="note" style="margin-top:15px">Check the sizes on your bike. Prices are indicative, as of ${escapeHTML(datumLang(DATA.banden.datum))}; stock and the final price are confirmed in the quote.</p><div id="tyre-results"></div><fieldset class="tyre-extras"><legend class="heading smallhead">Extras (optional)</legend><div class="optlist"><label class="tyre"><input type="checkbox" name="ventielen" value="ja"><strong>Right-angle valves</strong><span class="money">+${euro(VENTIELEN)} per set</span><small>Only if they fit. Easier to check and top up your tyre pressure.</small></label><label class="tyre"><input type="checkbox" name="afvoer" value="ja"><strong>Old tyre disposal</strong><span class="money">+${euro(AFVOEREN)} per tyre</span><small>You can also take your old tyre home yourself.</small></label></div></fieldset><div id="tyre-total" class="panel" style="margin-top:20px"></div><label for="toelichting" style="margin-top:20px">Notes (optional)</label><textarea name="toelichting" id="toelichting" maxlength="2000" placeholder="For example: I'd like advice on my choice."></textarea>`;
}
function tariffs() {
  return (
    pagehead(
      own("Prices"),
      ownText("We charge a service as labour: €75 per hour incl. VAT, plus parts at list price. You get an indication up front. No extra work without consultation."),
      "onderhoud",
      true,
    ) +
    `<div class="wrap workgrid"><div class="panel"><h2>Our prices</h2><div class="line"><span>Labour</span><strong>€75 / hour</strong></div><div class="line"><span>Tyre fitting (tyre not included)</span><strong>€50 / tyre</strong></div><div class="line"><span>Right-angle valves (optional, only if they fit)</span><strong>€20 / set</strong></div><div class="line"><span>Old tyre disposal (optional)</span><strong>€5 / tyre</strong></div><div class="line"><span>Replace fork seals</span><strong>from €350</strong></div><div class="line"><span>Pre-purchase inspection (about 1 to 1.5 hours)</span><strong>€75 / inspection</strong></div><div class="line"><span>Parts</span><strong>List price</strong></div><div class="line"><span>Replace chain and sprockets</span><strong>Quotation</strong></div><p class="note" style="margin-top:20px">Prices incl. VAT. The quote states which work and materials are included.</p></div><div class="panel"><h2>How we work</h2><p>Tell us which bike you ride and what you need. You get a quote up front.</p><p class="muted">If something extra comes up during the work, we consult you first.</p><a href="${R.afspraak}" class="btn">Ask for a quote →</a></div></div>`
  );
}
function about() {
  return (
    pagehead(
      "About OG MotoWorks",
      "Personal contact and attention to your bike.",
      "probleem",
      true,
    ) +
    `<div class="wrap about"><img src="/p-27bd21e96e9bfb2c/assets/og/c927c25d6be18e37.jpg" width="941" height="1672" alt="Freddy at work on a motorcycle"><div><span class="eyebrow">The owner behind OG MotoWorks</span><h2>You talk directly to the person<br>who works on your bike.</h2><p>Freddy is the owner and mechanic of OG MotoWorks. We take care of servicing, repairs, tyres and custom work on your motorcycle.</p><p class="muted">The workshop is in Waalwijk. We work by appointment, so we can discuss your question and the work up front.</p><p>Honest advice, a quote up front and consultation on extra work.</p><a href="${R.contact}" class="btn">Get in touch →</a></div></div>`
  );
}
function contact() {
  return (
    pagehead(
      "Contact",
      "Message or email us and tell us what your bike needs.",
      "probleem",
      true,
    ) +
    `<div class="wrap workgrid"><div class="panel"><h2>Where to find us</h2><p>Professor Zeemanweg 6-10<br>5144 NN Waalwijk</p><p class="hours">We work by appointment. Message us on WhatsApp to book.</p><div class="actions"><a class="btn" href="${R.afspraak}">Request an appointment</a><a class="btn secondary" href="https://www.google.com/maps/search/?api=1&query=Professor+Zeemanweg+6-10%2C+5144+NN+Waalwijk" target="_blank" rel="noopener">Directions</a></div></div><div class="panel"><h2>Direct contact</h2><p>06 42 93 95 55<br><a href="mailto:info@ogmotoworks.nl">info@ogmotoworks.nl</a></p><div class="actions"><a href="https://wa.me/31642939555?text=Hi%20Freddy%2C%20I%20have%20a%20question%20about%20my%20motorcycle." class="btn" target="_blank" rel="noopener">Open WhatsApp ↗</a><a href="${mailHref(MAIL_T.std, mailTpl())}" class="btn secondary btn-mail">${MAIL_T.btn}</a></div><p class="note privacy-link" style="margin:14px 0 0;font-size:14px"><a href="${R.privacy}">Privacy statement</a></p></div></div><div class="wrap og-kaart"><iframe src="https://www.google.com/maps?q=OG+MotoWorks,+Professor+Zeemanweg+6-10,+5144+NN+Waalwijk&amp;output=embed" title="Map: OG MotoWorks, Professor Zeemanweg 6-10, Waalwijk" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe></div>`
  );
}
function privacy() {
  return (
    pagehead(own("Privacy"), ownText("Your data at OG MotoWorks."), "onderhoud", true) +
    `<div class="wrap section"><div class="panel"><h2>On your device</h2><p>We only keep your chosen bike in your browser. What you fill in on the request form stays only in this tab and is gone when you close it.</p><button class="btn secondary" id="clear-motor">Clear my bike choice</button></div></div>`
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
  b.title = motorLabel(motor) + " — change";
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
const PICK = { merk: "Choose a brand", model: "Choose a model", uitvoering: "Choose a version" };
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
        return `<h3 class="smallhead" style="margin-top:24px">${pos === "voor" ? "Front tyre" : "Rear tyre"}</h3><div class="tyre-auto" id="rear-auto"><p class="note" role="status">Picked for you: same brand and type as your front tyre. You can always change it.</p><div class="tyrelist">${tyreCard(auto, "achter", true)}</div><button class="btn text rear-change" type="button" id="rear-change">Choose a different rear tyre</button></div>`;
      const items = tyreItems(pos);
      let visible = items.slice(0, limits[pos]);
      const gekozen = items.find((t) => tyreId(t) === d["band-" + pos]);
      if (gekozen && !visible.includes(gekozen)) visible = [gekozen, ...visible.slice(0, -1)];
      const mis = pos === "achter" && positions.length === 2 && d["band-voor"] && !d["band-achter"] ? rearMissNote(d) : "";
      return `<h3 class="smallhead" style="margin-top:24px">${pos === "voor" ? "Front tyre" : "Rear tyre"}</h3>${mis}<p class="note" role="status">${items.length ? `${items.length} results · ${Math.min(items.length, limits[pos])} shown. Fitment will still be checked.` : "No tyres found for this size. Message us and we'll find out for you."}</p><div class="tyrelist">${
        visible
          .map((t) => tyreCard(t, pos, d["band-" + pos] === tyreId(t)))
          .join("") ||
        '<p class="note">No results? Adjust the filters or ask for advice below without choosing tyres.</p>'
      }</div>${items.length > limits[pos] ? `<button class="btn secondary showmore" type="button" data-more="${pos}">Show more ${pos === "voor" ? "front tyres" : "rear tyres"}</button>` : ""}`;
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
            return `<label class="tyre"><input type="radio" name="band-${pos}" value="${escapeHTML(id)}" ${checked ? "checked" : ""}><strong>${escapeHTML(t.merk + " " + t.band)}</strong><small>${escapeHTML(t.notatie)} · ${escapeHTML(DATA.banden.types.find((x) => x[0] === t.type)?.[1] || t.type)}</small><span class="money">${t.prijs ? euro(t.prijs) + " for the tyre" : "Price on request"}</span><small>Fitting: ${euro(DATA.banden.montage)}</small><span class="included">${t.prijs ? euro(t.prijs + DATA.banden.montage) + " together incl. VAT" : "Final price via quote"}</span></label>`;
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
    ? `<p class="note rear-miss" role="status">We don't have the ${naam} in your rear size. Please choose a rear tyre below.</p>`
    : `<p class="note rear-miss" role="status">Enter your rear tyre size and we'll pick the same tyre for the rear.</p>`;
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
  if (d.ventielen === "ja") out.push(["Right-angle valves (only if they fit), per set", VENTIELEN]);
  if (d.afvoer === "ja") out.push(["Old tyre disposal " + rows.length + " × " + euro(AFVOEREN), AFVOEREN * rows.length]);
  return out;
}
function renderTotal() {
  saveDraft();
  const rows = chosenTyres(drafts.banden);
  const extras = tyreExtras(drafts.banden, rows);
  let total = extras.reduce((n, e) => n + e[1], 0),
    complete = true;
  $("#tyre-total").innerHTML =
    "<h3>Your indicative price</h3>" +
    `<div class="selectedtyres">${rows
      .filter((r) => r.band)
      .map(
        (r) =>
          `<span>${r.pos === "voor" ? "Front" : "Rear"}: ${escapeHTML(r.band.merk + " " + r.band.band)}</span>`,
      )
      .join("")}</div>` +
    rows
      .map((r) => {
        if (!r.band) {
          complete = false;
          return `<div class="line"><span>${r.pos === "voor" ? "Front" : "Rear"}</span><strong>Still to choose or advice</strong></div>`;
        }
        if (r.band.prijs == null) complete = false;
        else total += r.band.prijs + DATA.banden.montage;
        return `<div class="line"><span>${r.pos === "voor" ? "Front" : "Rear"} · tyre</span><strong>${r.band.prijs ? euro(r.band.prijs) : "On request"}</strong></div><div class="line"><span>Fitting</span><strong>${euro(DATA.banden.montage)}</strong></div>`;
      })
      .join("") +
    extras.map((e) => `<div class="line"><span>${escapeHTML(e[0])}</span><strong>${euro(e[1])}</strong></div>`).join("") +
    `<p style="margin-top:18px"><strong>${complete ? (extras.length ? "Total incl. fitting and extras: " : "Total incl. fitting: ") + euro(total) : "The total price follows after your choice, in the quote."}</strong></p><p class="note">Incl. VAT. Availability and any extra work in consultation.</p>`;
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
    ? "Sizes from our motorcycle overview. Check them on your bike; adjust them if your version differs."
    : "We have no fixed tyre sizes for this bike. Enter your tyre sizes, or ask us for advice.";
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
    "Hi Freddy, I'd like to request an appointment.",
    "Motorcycle: " + motorLabel(m),
    "Request: " + SERVICES[k].title,
  ];
  if (d.naam?.trim()) lines.splice(1, 0, "Name: " + d.naam.trim());
  if (d.telefoon?.trim()) lines.push("Mobile: " + d.telefoon.trim());
  if (d.email?.trim()) lines.push("Email: " + d.email.trim());
  if (d.kenteken?.trim())
    lines.push("Registration: " + d.kenteken.trim().toUpperCase());
  if (k === "onderhoud") {
    if (d.beurt) lines.push("Service: " + d.beurt);
    if (d.km) lines.push("Mileage: " + d.km + " km");
  }
  if (k === "probleem" && d.wanneer) lines.push("When: " + d.wanneer);
  if (k === "banden")
    chosenTyres(d).forEach((r) =>
      lines.push(
        (r.pos === "voor" ? "Front tyre: " : "Rear tyre: ") +
          (r.size || "Size still to check") +
          (r.band
            ? " · " + r.band.merk + " " + r.band.band
            : " · advice please"),
      ),
    );
  if (k === "banden") {
    const rows = chosenTyres(d);
    rows
      .filter((r) => r.band)
      .forEach((r) =>
        lines.push(
          (r.pos === "voor" ? "Front" : "Rear") +
            " indicative price: " +
            (r.band.prijs != null
              ? euro(r.band.prijs) +
                " tyre + " +
                euro(DATA.banden.montage) +
                " fitting"
              : "tyre price on request + " +
                euro(DATA.banden.montage) +
                " fitting"),
        ),
      );
    const extras = tyreExtras(d, rows);
    extras.forEach((e) => lines.push(e[0] + ": " + euro(e[1])));
    if (rows.every((r) => r.band && r.band.prijs != null))
      lines.push(
        (extras.length ? "Indicative price incl. fitting, extras and VAT: " : "Indicative price incl. fitting and VAT: ") +
          euro(
            rows.reduce((n, r) => n + r.band.prijs + DATA.banden.montage, 0) + extras.reduce((n, e) => n + e[1], 0),
          ),
      );
    lines.push("Please confirm the final price and availability.");
  }
  if (d.toelichting?.trim()) lines.push("Notes: " + d.toelichting.trim());
  if (d.voorkeur?.trim()) lines.push("Preference: " + d.voorkeur.trim());
  if (d.review === "ja") lines.push("Review request (email/WhatsApp): yes");
  lines.push("Could you send me a price indication and an available date?");
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
  return { Winterpakket: w.naam + " (from " + euro(w.prijs) + ")" };
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
    "Banden overzicht": tyres.map((r) => (r.pos === "voor" ? "Front tyre: " : "Rear tyre: ") + (r.size || "Size still to check") + (r.band ? " · " + r.band.merk + " " + r.band.band + (r.band.prijs != null ? " (" + euro(r.band.prijs) + ")" : "") : " · advice please")).join("\n"),
    "Haakse ventielen": k === "banden" && d.ventielen === "ja" ? "yes, only if they fit (" + euro(VENTIELEN) + " per set)" : "",
    "Oude band afvoeren": k === "banden" && d.afvoer === "ja" ? "yes, " + tyres.length + " × " + euro(AFVOEREN) + " = " + euro(AFVOEREN * tyres.length) : "",
    "Richtprijs banden": full ? euro(tyres.reduce((n, r) => n + r.band.prijs + DATA.banden.montage, 0) + extraSum) + (extras.length ? " incl. fitting, extras and VAT" : " incl. fitting and VAT") : "",
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
      "Check your request",
      "All correct? Send the message yourself via WhatsApp or email.",
      "probleem",
    ) +
    `<div class="wrap workgrid"><div class="panel"><h2>Your message to OG MotoWorks</h2><div class="summary">${escapeHTML(summaryText)}</div><div class="actions"><a class="btn" id="wa-open" href="https://wa.me/31642939555?text=${encodeURIComponent(summaryText)}" target="_blank" rel="noopener">Open WhatsApp ↗</a><a class="btn secondary btn-mail" id="mail-open" href="${mailHref(intent === "onderhoud" && winterOf(drafts.onderhoud?.beurt) ? MAIL_T.winter : MAIL_T.std, summaryText)}">${MAIL_T.btn}</a><a class="btn secondary" href="#formulier">Edit</a></div></div><div class="panel">${selected()}<p>Your request is only sent when you press send in WhatsApp or in your email app.</p><p class="muted">We confirm the price and an available date. This is not an automatic booking.</p></div></div>`
  );
}
const ROUTES = ["home", "diensten", "onderhoud", "probleem", "banden", "ombouw", "tarieven", "over-ons", "contact", "privacy", "info"];
const ROUTE = ROUTES.includes(BODY.route) ? BODY.route : "home";
const BASE_TITLE = document.title;
function info() {
  return pagehead(own("OG MotoWorks"), ownText(""), BODY.bg || "onderhoud", true) + `<div class="wrap section"><div class="actions"><a class="btn" href="${R.afspraak}">Request an appointment →</a><a class="btn secondary" href="${R.tarieven}">All prices</a></div></div>`;
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
  document.title = page === "overzicht" ? "Your request | OG MotoWorks" : BASE_TITLE;
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
  const get = (f) => fetch("/p-27bd21e96e9bfb2c/assets/data/" + f).then((r) => {
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
