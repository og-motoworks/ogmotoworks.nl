"use strict";
let DATA = null; // geladen uit /assets/data/*.json (zelfde bron en formule als de vorige site)
const BODY = document.body.dataset;
const R = window.OG_ROUTES; // route -> echte URL (per taal), uit de build
const FORMSPREE = "https://formspree.io/f/myezrojv";
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
const euro = (n) =>
  new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
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
const customer = Object.assign({ naam: "", telefoon: "", email: "", kenteken: "" }, saved.customer);
const drafts = Object.assign({ onderhoud: {}, probleem: {}, banden: {}, ombouw: {} }, saved.drafts);
function persist() {
  try {
    sessionStorage.setItem(STORE, JSON.stringify({ intent, customer, drafts }));
  } catch {}
}
// Winterpakketten (goedgekeurde prijzen incl. btw). Vroegboek: boeken t/m 30 november, afspraak t/m januari.
const WINTER = [
  { naam: "Winterbeurt", prijs: 179, vroeg: 159 },
  { naam: "Winterbeurt + Voorjaarsklaar", prijs: 219, vroeg: 199 },
  { naam: "Winter Compleet", prijs: 279, vroeg: 259 },
];
const VROEG_TOT = "2026-11-30";
function vroegboek() {
  const d = new Date();
  return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2) <= VROEG_TOT;
}
const winterOn = () => BODY.winterpage === "1" || BODY.winter === "live";
const winterLabel = (w) => w.naam + " (" + (vroegboek() ? "vroegboek " + euro(w.vroeg) + " i.p.v. " + euro(w.prijs) : euro(w.prijs)) + ")";
const winterOf = (beurt) => WINTER.find((w) => beurt && beurt.startsWith(w.naam + " ("));
const SERVICES = {
  onderhoud: {
    title: "Onderhoud",
    description: "Beurt volgens schema",
    text: "Vertel ons welke beurt je wilt. Je krijgt vooraf een offerte die past bij jouw motor.",
    price: "€60 / uur",
    priceNote: "Onderdelen worden apart berekend.",
  },
  probleem: {
    title: "Er is iets mis",
    description: "Lampje, lekkage, start niet",
    text: "Vertel wat je merkt. Freddy kijkt met je mee en bespreekt de volgende stap.",
    price: "€60 / uur",
    priceNote:
      "Onderzoek en reparatie in overleg. Eerst weten waar je aan toe bent.",
  },
  banden: {
    title: "Banden",
    description: "Advies en prijs voor jouw maat",
    text: "Kies passende maten en bekijk het assortiment. Freddy controleert de keuze en prijs in je offerte.",
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
function selected() {
  return `<div class="selected"><div><small>JOUW MOTOR</small><strong>${motor ? escapeHTML(motorLabel(motor)) : "Nog geen motor gekozen"}</strong></div><button class="btn secondary" data-motor>${motor ? "Wijzig" : "Kies je motor"}</button></div>`;
}
function cards() {
  return `<div class="cards">${Object.entries(SERVICES)
    .map(
      ([k, v], i) =>
        `<a class="service" href="${R[k]}"><span class="num">0${i + 1} ↗</span><h3>${v.title}</h3><p>${v.description}</p></a>`,
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
  return `<section class="pagehead" data-bg="${bg}"><div class="wrap"><div class="breadcrumbs">${crumbs(title, own)}</div><span class="eyebrow">OG MotoWorks · Waalwijk</span><h1>${title}</h1><p>${text}</p></div></section>`;
}
// Eigen kop van deze pagina (uit de build); anders Freddy's standaardkop.
const own = (t) => (BODY.h1 ? escapeHTML(BODY.h1) : t),
  ownText = (t) => (BODY.lead ? escapeHTML(BODY.lead) : t);
function processSteps() {
  return `<div class="steps"><div class="step"><h3><b>01</b> Jouw motor</h3><p>Kies je motor en vertel wat je nodig hebt.</p></div><div class="step"><h3><b>02</b> Offerte & datum</h3><p>Freddy bespreekt de prijs en een beschikbare datum.</p></div><div class="step"><h3><b>03</b> Aan de slag</h3><p>Werk op afspraak. Meerwerk alleen na overleg.</p></div></div>`;
}
function faqBlock(k = "algemeen") {
  const rows =
    k === "banden"
      ? [
          [
            "Ik weet mijn bandenmaat niet. Wat nu?",
            "Je kunt zonder bandenkeuze advies aanvragen. Vul je motor in en vertel dat je hulp wilt; Freddy controleert de maat met je.",
          ],
          [
            "Is montage inbegrepen in de bandprijs?",
            "Nee. De bandprijs en €50 montage per band staan apart. Bij een complete keuze zie je het gezamenlijke bedrag. Extra werkzaamheden worden vooraf besproken.",
          ],
          [
            "Zijn de banden direct beschikbaar?",
            "De lijst is een assortiment, geen live voorraad. Freddy bevestigt beschikbaarheid en definitieve prijs in de offerte.",
          ],
        ]
      : [
          [
            "Moet ik precies weten wat er nodig is?",
            "Nee. Kies de route die het beste past en beschrijf kort je vraag. Freddy denkt met je mee.",
          ],
          [
            "Wanneer staat mijn afspraak vast?",
            "Na bevestiging door Freddy. Een WhatsApp-aanvraag is nog geen boeking.",
          ],
          [
            "Wat gebeurt er bij extra werk?",
            "Meerwerk wordt eerst met je besproken. Je krijgt vooraf duidelijkheid over de kosten.",
          ],
        ];
  return `<div class="faq"><h2>Even handig om te weten</h2>${rows.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join("")}</div>`;
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
  return `<section class="section social-section"><div class="wrap"><div class="social-head"><div><span class="eyebrow">Een kijkje in de werkplaats</span><h2>Motoren, werk & verhalen.</h2></div><a class="btn secondary instagram-btn" href="https://www.instagram.com/og_motoworks" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="18" cy="6" r="1" fill="currentColor" stroke="none"/></svg>Volg OG MotoWorks op Instagram ↗</a></div><div class="photo-mix"><figure><img data-gallery-photo="MAINTENANCE_URI" alt="Freddy sleutelt aan een BMW motor" loading="lazy"><figcaption>Aandacht voor het werk</figcaption></figure><figure><img data-gallery-photo="CHAIN_URI" alt="Controle van de kettingspeling op een motor" loading="lazy"><figcaption>Het zit in de details</figcaption></figure><figure><img data-gallery-photo="HONDA_URI" alt="Witte Honda voor de werkplaats" loading="lazy"><figcaption>Verschillende motoren, dezelfde aandacht</figcaption></figure><figure><img data-gallery-photo="TYRE_URI" alt="Motor van achteren met brede achterband" loading="lazy"><figcaption>Banden en persoonlijk contact</figcaption></figure><figure><img data-gallery-photo="GROUP_URI" alt="Drie motorrijders op verschillende motoren" loading="lazy"><figcaption>De passie achter OG MotoWorks</figcaption></figure></div></div></section><section class="section customer-reviews" id="reviews" aria-labelledby="reviews-title"><div class="wrap"><div class="social-head"><div><span class="eyebrow">Klanten aan het woord</span><h2 id="reviews-title">Ervaringen op Google</h2></div><button class="btn secondary" id="reviews-pause" type="button" aria-pressed="false">Pauzeer reviews</button></div><div class="review-viewport" id="review-viewport" role="region" aria-label="Klantreviews, automatisch wisselend" tabindex="0"><div class="review-track">${REVIEWS.map((r) => `<figure class="quote-card"><div class="review-stars" aria-label="5 van 5 sterren">★★★★★ <span>Google</span></div><blockquote>${escapeHTML(r.text)}</blockquote><figcaption>${escapeHTML(r.name)}</figcaption></figure>`).join("")}</div></div><p class="note" style="margin-top:18px">Korte fragmenten uit de Google-reviews op onze bestaande website · bronstand 1 oktober 2026.</p><div class="actions"><a class="btn secondary" href="https://share.google/mfVz03Qhs4EkLpyDO" target="_blank" rel="noopener">Alle reviews op Google ↗</a><a class="btn text" href="https://g.page/r/CcwNZlk_nz-kEBM/review" target="_blank" rel="noopener">Schrijf een review ↗</a></div></div></section>`;
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

function home() {
  return `<section class="wrap hero reception"><div class="welcome"><span class="eyebrow">Motorwerkplaats · Waalwijk</span><h1>Welkom bij<br>OG MotoWorks.</h1><p class="welcome-story">Ik ben Freddy. Bij OG MotoWorks kun je terecht voor onderhoud, reparatie, banden en ombouw van je motor. We bespreken samen wat er nodig is, zodat je vooraf weet waar je aan toe bent.</p><p class="welcome-note">Persoonlijk contact, eerlijk advies en werk op afspraak.</p><a href="${R.afspraak}" class="btn" data-start>${motor ? "Verder met jouw motor" : "Kies je motor"} →</a><p class="welcome-help">Daarna kies je rustig wat je nodig hebt.</p></div><figure><img src="/assets/og/c927c25d6be18e37.jpg" width="941" height="1672" alt="Freddy bij een BMW in de werkplaats van OG MotoWorks"><figcaption class="reception-caption">Freddy · OG MotoWorks</figcaption></figure></section><section class="reception-bottom"><div class="wrap reception-info"><span>Onderhoud · Reparatie · Banden · Ombouw</span><a href="${R.contact}">Waalwijk, op afspraak ↗</a><a href="https://share.google/mfVz03Qhs4EkLpyDO" target="_blank" rel="noopener">Ervaringen op Google ↗</a></div></section>${socialReviews()}`;
}
function services() {
  return (
    pagehead(
      own("Wat heb je nodig?"),
      ownText("Kies de route die past bij jouw vraag."),
      "onderhoud",
      true,
    ) + `<div class="wrap section">${selected()}${cards()}</div>`
  );
}
function commonFields() {
  return `<fieldset class="customer-fields" style="border:0;border-top:1px solid #3a3d44;padding:24px 0 0;margin:26px 0 0"><legend class="heading" style="padding:0 10px 0 0;font-size:23px">Jouw gegevens</legend><p class="note">Zo kan Freddy je aanvraag bespreken en een afspraak met je maken.</p><div class="fields"><div class="full"><label for="naam">Naam</label><input id="naam" name="naam" autocomplete="name" required maxlength="120" placeholder="Voor- en achternaam"></div><div><label for="telefoon">Mobiel nummer</label><input id="telefoon" name="telefoon" type="tel" autocomplete="tel" required maxlength="30" minlength="6" placeholder="06… of +31…"></div><div><label for="email">E-mailadres (optioneel)</label><input id="email" name="email" type="email" autocomplete="email" maxlength="180" placeholder="Voor een offerte per mail"></div><div><label for="kenteken">Kenteken (optioneel)</label><input id="kenteken" name="kenteken" maxlength="14" autocomplete="off" autocapitalize="characters" placeholder="AB-12-CD"></div><div><label for="voorkeur">Voorkeursdag (optioneel)</label><input id="voorkeur" name="voorkeur" placeholder="Bijvoorbeeld vrijdagmiddag" maxlength="100"></div></div><p class="note" style="margin-top:15px">We gebruiken deze gegevens om jouw aanvraag af te handelen. <a href="${R.privacy}">Meer over privacy</a>.</p></fieldset>`;
}
function requestFields(k) {
  if (k === "onderhoud")
    return `<div class="fields"><div><label for="km">Kilometerstand (optioneel)</label><input id="km" name="km" type="number" min="0" max="999999"></div><div><label for="beurt">Welke beurt?</label><select name="beurt" id="beurt">${BODY.winterpage === "1" ? winterOptions() : ""}<option>Onderhoud volgens schema</option><option>Oliewissel</option><option>Grote beurt</option><option>Voorvorkkeerringen vervangen (€350 vast)</option><option>Kettingset vervangen (offerte)</option><option>Ik weet het nog niet</option>${winterOn() && BODY.winterpage !== "1" ? winterOptions() : ""}</select></div><div class="full"><label for="toelichting">Toelichting (optioneel)</label><textarea name="toelichting" id="toelichting" maxlength="2000" placeholder="Wat wil je laten doen?"></textarea></div></div>`;
  if (k === "probleem")
    return `<label for="toelichting">Wat merk je?</label><textarea name="toelichting" id="toelichting" required maxlength="2000" placeholder="Bijvoorbeeld: de motor start moeilijk als hij warm is."></textarea><label for="wanneer" style="margin-top:20px">Wanneer gebeurt het? (optioneel)</label><input name="wanneer" id="wanneer" maxlength="200" placeholder="Sinds wanneer, koud of warm, tijdens het rijden…">`;
  return `<label for="toelichting">Wat wil je veranderen?</label><textarea name="toelichting" id="toelichting" required maxlength="2000" placeholder="Bijvoorbeeld andere knipperlichten of handvatverwarming."></textarea>`;
}
function winterOptions() {
  return WINTER.map((w) => `<option>${escapeHTML(winterLabel(w))}</option>`).join("");
}
function routePage(k) {
  const s = SERVICES[k];
  return (
    pagehead(own(s.title), ownText(s.text), k, true) +
    `<div class="wrap workgrid"><div>${selected()}<form id="request-form" data-intent="${k}" class="panel"><h2>${k === "banden" ? "Kies je banden" : "Jouw aanvraag"}</h2>${k === "banden" ? tyreFields() : requestFields(k)}${commonFields()}<div class="actions"><button class="btn" type="submit">Bekijk mijn aanvraag →</button></div><p class="note" style="margin-top:15px">Je verstuurt zelf via WhatsApp. Een aanvraag is nog geen bevestigde afspraak.</p><input class="hp" type="text" name="_gotcha" tabindex="-1" autocomplete="off" aria-hidden="true"></form></div><aside class="panel"><span class="eyebrow">Helder vooraf</span><p class="price">${BODY.price ? escapeHTML(BODY.price) : s.price}</p><p class="muted">${BODY.pricenote ? escapeHTML(BODY.pricenote) : s.priceNote}</p><div class="line"><span>Onderdelen</span><strong>Adviesprijs</strong></div><div class="line"><span>Vooraf</span><strong>Offerte</strong></div><div class="line"><span>Meerwerk</span><strong>Na overleg</strong></div><p class="note" style="margin-top:18px">Prijzen incl. btw. We stemmen het werk eerst met je af.</p><a class="btn secondary" href="${R.tarieven}">Alle tarieven</a></aside></div><section class="section"><div class="wrap">${faqBlock(k)}</div></section>`
  );
}
function tyreFields() {
  return `<details class="hintbox"><summary>Waar vind ik mijn bandenmaat?</summary><p>Op de zijkant van je motorband, bijvoorbeeld 120/70 ZR17. 120 is de breedte in millimeters, 70 de hoogteverhouding en 17 de velgmaat in inches. Neem de volledige notatie over; Freddy controleert ook de uitvoering en de overige aanduidingen.</p><p>Weet je het niet? Laat de maat leeg en vraag advies.</p></details><p class="note" id="oem-note"></p><div class="fields"><div><label for="voor">Voorbandmaat</label><input id="voor" name="voor" list="sizes" maxlength="40" placeholder="120/70 ZR17"></div><div><label for="achter">Achterbandmaat</label><input id="achter" name="achter" list="sizes" maxlength="40" placeholder="180/55 ZR17"></div><datalist id="sizes">${Object.keys(
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
    )}</select></div><div><label for="sortering">Sorteren</label><select id="sortering" name="sortering"><option value="naam">Naam A–Z</option><option value="laag">Prijs laag–hoog</option><option value="hoog">Prijs hoog–laag</option></select></div><div class="full"><label for="positie">Welke band wil je vervangen?</label><select id="positie" name="positie"><option value="beide">Voor en achter</option><option value="voor">Alleen voor</option><option value="achter">Alleen achter</option></select></div></div><p class="note" style="margin-top:15px">Controleer de maten op je motor. Prijzen zijn richtprijzen uit ${escapeHTML(DATA.banden.datum)}; voorraad en definitieve prijs worden bevestigd in de offerte.</p><div id="tyre-results"></div><fieldset class="tyre-extras"><legend class="heading smallhead">Extra's (optioneel)</legend><div class="optlist"><label class="tyre"><input type="checkbox" name="ventielen" value="ja"><strong>Haakse ventielen</strong><span class="money">+${euro(VENTIELEN)} per set</span><small>Alleen als ze passen. Makkelijker je bandenspanning checken en bijpompen.</small></label><label class="tyre"><input type="checkbox" name="afvoer" value="ja"><strong>Oude band afvoeren</strong><span class="money">+${euro(AFVOEREN)} per band</span><small>Je mag je oude band ook zelf meenemen.</small></label></div></fieldset><div id="tyre-total" class="panel" style="margin-top:20px"></div><label for="toelichting" style="margin-top:20px">Toelichting (optioneel)</label><textarea name="toelichting" id="toelichting" maxlength="2000" placeholder="Bijvoorbeeld: ik wil advies over mijn keuze."></textarea>`;
}
function tariffs() {
  return (
    pagehead(
      own("Tarieven"),
      ownText("Je weet vooraf waar je aan toe bent. Geen meerwerk zonder overleg."),
      "onderhoud",
      true,
    ) +
    `<div class="wrap workgrid"><div class="panel"><h2>Onze tarieven</h2><div class="line"><span>Arbeid</span><strong>€60 / uur</strong></div><div class="line"><span>Banden monteren, band apart</span><strong>€50 / band</strong></div><div class="line"><span>Haakse ventielen, alleen als ze passen</span><strong>€20 / set</strong></div><div class="line"><span>Oude band afvoeren (optioneel)</span><strong>€5 / band</strong></div><div class="line"><span>Voorvorkkeerringen vervangen</span><strong>€350 vast</strong></div><div class="line"><span>Onderdelen</span><strong>Adviesprijs</strong></div><div class="line"><span>Kettingset vervangen</span><strong>Offerte</strong></div><p class="note" style="margin-top:20px">Prijzen incl. btw. Bij de offerte staat welk werk en materiaal inbegrepen is.</p></div><div class="panel"><h2>Zo werken wij</h2><p>Vertel welke motor je rijdt en wat je nodig hebt. Je krijgt vooraf een offerte.</p><p class="muted">Komt er tijdens het werk iets extra's naar voren? Dan overleggen we eerst.</p><a href="${R.afspraak}" class="btn">Vraag een offerte →</a></div></div>`
  );
}
function about() {
  return (
    pagehead(
      "Freddy. OG MotoWorks.",
      "Persoonlijk contact, aandacht voor jouw motor.",
      "probleem",
      true,
    ) +
    `<div class="wrap about"><img src="/assets/og/c927c25d6be18e37.jpg" width="941" height="1672" alt="Freddy aan het werk met een motor"><div><span class="eyebrow">De monteur achter OG MotoWorks</span><h2>Je spreekt met de man<br>die aan je motor werkt.</h2><p>Ik ben Freddy, monteur bij OG MotoWorks. Je kunt bij mij terecht voor onderhoud, reparatie, banden en ombouw van je motor.</p><p class="muted">De werkplaats zit in Waalwijk. We werken op afspraak, zodat we jouw vraag en het werk vooraf kunnen bespreken.</p><p>Eerlijk advies, een offerte vooraf en overleg bij meerwerk.</p><a href="${R.contact}" class="btn">Neem contact op →</a></div></div>`
  );
}
function contact() {
  return (
    pagehead(
      "Contact",
      "App Freddy en vertel wat je motor nodig heeft.",
      "probleem",
      true,
    ) +
    `<div class="wrap workgrid"><div class="panel"><h2>Hier vind je ons</h2><p>Professor Zeemanweg 6-10<br>5144 NN Waalwijk</p><p class="muted">Op afspraak. Stuur een bericht voor een beschikbare datum.</p><p class="hours">Wij werken op afspraak. App ons voor een afspraak.</p><div class="actions"><a class="btn" href="${R.afspraak}">Afspraak aanvragen</a><a class="btn secondary" href="https://www.google.com/maps/search/?api=1&query=Professor+Zeemanweg+6-10%2C+5144+NN+Waalwijk" target="_blank" rel="noopener">Route</a></div></div><div class="panel"><h2>Direct contact</h2><p>06 42 93 95 55<br><a href="mailto:info@ogmotoworks.nl">info@ogmotoworks.nl</a></p><a href="https://wa.me/31642939555?text=Hoi%20Freddy%2C%20ik%20heb%20een%20vraag%20over%20mijn%20motor." class="btn" target="_blank" rel="noopener">Open WhatsApp ↗</a></div></div>`
  );
}
function privacy() {
  return (
    pagehead(own("Privacy"), ownText("Jouw gegevens bij OG MotoWorks."), "onderhoud", true) +
    `<div class="wrap section"><div class="panel"><h2>Op jouw apparaat</h2><p>Je gekozen motor bewaren we alleen in de lokale opslag van je browser. Wat je in het aanvraagformulier invult, blijft tijdens je bezoek in het sessiegeheugen van dit tabblad en is weg als je het tabblad sluit.</p><p>Klik je op 'Open WhatsApp', dan gaat het samengestelde bericht naar WhatsApp; je kiest daar zelf of je het verstuurt. Tegelijk sturen we een kopie van je aanvraag per e-mail naar OG MotoWorks (via Formspree), zodat je aanvraag niet kwijtraakt.</p><button class="btn secondary" id="clear-motor">Wis mijn motorkeuze</button></div></div>`
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
function pickOptions(k) {
  const merk = $("#merk").value.trim(),
    model = $("#model").value.trim();
  if (k === "merk") return Object.keys(DATA.motoren.merken);
  if (k === "model") return DATA.motoren.merken[merk] || [];
  return DATA.motoren.uitvoeringen[merk]?.[model] || [];
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
    v = el.value.trim().toLowerCase(),
    exact = all.some((o) => o.toLowerCase() === v),
    list = !v || exact ? all : all.filter((o) => o.toLowerCase().includes(v));
  if (!list.length) return hidePick();
  pickField = el;
  pickRow.setAttribute("aria-label", PICK[el.id]);
  pickRow.innerHTML = list.map((o) => `<button type="button" class="pill" tabindex="-1" data-v="${escapeHTML(o)}" aria-pressed="${o.toLowerCase() === v}">${escapeHTML(o)}</button>`).join("");
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
      old = { merk: $("#merk").value.trim(), model: $("#model").value.trim() };
    el.value = b.dataset.v;
    // ander merk gekozen: een bekend model van het vorige merk past niet meer
    if (k === "merk" && (DATA.motoren.merken[old.merk] || []).includes(old.model) && !(DATA.motoren.merken[el.value] || []).includes(old.model)) {
      $("#model").value = "";
      $("#uitvoering").value = "";
    }
    if (k === "model" && !(DATA.motoren.uitvoeringen[$("#merk").value.trim()]?.[el.value] || []).includes($("#uitvoering").value.trim())) $("#uitvoering").value = "";
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
  $("#modellen").innerHTML = (DATA.motoren.merken[merk] || [])
    .map((x) => `<option value="${escapeHTML(x)}"></option>`)
    .join("");
  $("#uitvoeringen").innerHTML = (
    DATA.motoren.uitvoeringen[merk]?.[model] || []
  )
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
  $("#tyre-results").innerHTML = positions
    .map((pos) => {
      const items = tyreItems(pos),
        visible = items.slice(0, limits[pos]);
      return `<h3 class="smallhead" style="margin-top:24px">${pos === "voor" ? "Voorband" : "Achterband"}</h3><p class="note" role="status">${items.length} resultaten · ${Math.min(items.length, limits[pos])} getoond. Toepasbaarheid wordt nog gecontroleerd.</p><div class="tyrelist">${
        visible
          .map((t) => {
            const id = t.merk + "|" + t.band;
            return `<label class="tyre"><input type="radio" name="band-${pos}" value="${escapeHTML(id)}" ${d["band-" + pos] === id ? "checked" : ""}><strong>${escapeHTML(t.merk + " " + t.band)}</strong><small>${escapeHTML(t.notatie)} · ${escapeHTML(DATA.banden.types.find((x) => x[0] === t.type)?.[1] || t.type)}</small><span class="money">${t.prijs ? euro(t.prijs) + " voor de band" : "Prijs op aanvraag"}</span><small>Montage: ${euro(DATA.banden.montage)}</small><span class="included">${t.prijs ? euro(t.prijs + DATA.banden.montage) + " samen incl. btw" : "Definitieve prijs via offerte"}</span></label>`;
          })
          .join("") ||
        '<p class="note">Geen resultaat? Pas de filters aan of vraag hieronder advies zonder bandenkeuze.</p>'
      }</div>${items.length > limits[pos] ? `<button class="btn secondary showmore" type="button" data-more="${pos}">Toon meer ${pos === "voor" ? "voorbanden" : "achterbanden"}</button>` : ""}`;
    })
    .join("");
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
      renderTotal();
    }),
  );
  renderTotal();
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
          return `<div class="line"><span>${r.pos === "voor" ? "Voor" : "Achter"}</span><strong>Nog kiezen / advies</strong></div>`;
        }
        if (r.band.prijs == null) complete = false;
        else total += r.band.prijs + DATA.banden.montage;
        return `<div class="line"><span>${r.pos === "voor" ? "Voor" : "Achter"} · band</span><strong>${r.band.prijs ? euro(r.band.prijs) : "Op aanvraag"}</strong></div><div class="line"><span>Montage</span><strong>${euro(DATA.banden.montage)}</strong></div>`;
      })
      .join("") +
    extras.map((e) => `<div class="line"><span>${escapeHTML(e[0])}</span><strong>${euro(e[1])}</strong></div>`).join("") +
    `<p style="margin-top:18px"><strong>${complete ? (extras.length ? "Totaal incl. montage en extra's: " : "Totaal incl. montage: ") + euro(total) : "Complete prijs na keuze en offerte"}</strong></p><p class="note">Incl. btw. Beschikbaarheid en eventuele extra werkzaamheden in overleg.</p>`;
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
    : "Geen eenduidige maten voor deze motor in het overzicht. Vul de maat van je banden in, of vraag Freddy om advies.";
  ["voor", "achter"].forEach((p) =>
    $("#" + p).addEventListener("input", () => {
      $$('input[name="band-' + p + '"]').forEach((el) => (el.checked = false));
      delete drafts.banden["band-" + p];
      renderTyres();
    }),
  );
  $$('.tyre-extras input[type="checkbox"]').forEach((el) => el.addEventListener("change", renderTotal));
  ["rijtype", "zoek", "positie", "bandmerk", "sortering"].forEach((p) =>
    $("#" + p).addEventListener(p === "zoek" ? "input" : "change", () => {
      limits = { voor: 8, achter: 8 };
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
  const v = vroegboek();
  return { Winterpakket: w.naam + " (" + euro(v ? w.vroeg : w.prijs) + ")", Vroegboek: v ? "ja (" + euro(w.vroeg) + " i.p.v. " + euro(w.prijs) + ")" : "nee" };
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
      "Alles klopt? Open WhatsApp en verstuur zelf het bericht.",
      "probleem",
    ) +
    `<div class="wrap workgrid"><div class="panel"><h2>Jouw bericht aan Freddy</h2><div class="summary">${escapeHTML(summaryText)}</div><div class="actions"><a class="btn" id="wa-open" href="https://wa.me/31642939555?text=${encodeURIComponent(summaryText)}" target="_blank" rel="noopener">Open WhatsApp ↗</a><a class="btn secondary" href="#formulier">Aanpassen</a></div></div><div class="panel">${selected()}<p>Je aanvraag wordt pas verstuurd wanneer je in WhatsApp op verzenden drukt.</p><p class="muted">Freddy bevestigt de prijs en beschikbare datum. Je hebt daarmee nog geen automatische boeking.</p></div></div>`
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
  const d = Object.fromEntries(new FormData(e.target));
  for (const k of ["merk", "model", "uitvoering"]) d[k] = d[k].trim();
  if (!d.merk || !d.model) return;
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
  const [motoren, banden, assort] = await Promise.all([get("motoren.json"), get("banden.json"), get("banden-assortiment.json")]);
  const f = banden.formule,
    prijs = (t) => (t.inkoop_excl_btw > 0 ? round(t.inkoop_excl_btw * (1 + f.marge) * (1 + f.buffer) * f.btw) : null),
    assortiment = {};
  for (const [k, list] of Object.entries(assort.maten)) assortiment[k] = list.map((t) => ({ merk: t.merk, band: t.band, type: t.type, notatie: t.notatie, prijs: prijs(t) }));
  DATA = {
    motoren,
    banden: { maten: banden.maten, montage: banden.montage_per_band, datum: banden.prijzen_bijgewerkt, assortiment, types: assort.types.map((t) => [t[0], t[1]]) },
  };
  motor = loadMotor();
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
window.OG_READY = boot().catch(() => {
  document.documentElement.classList.add("og-nodata");
});
