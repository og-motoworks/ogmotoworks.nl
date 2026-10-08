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
  { naam: "Winter service", prijs: 179, vroeg: 159 },
  { naam: "Winter service + Spring ready", prijs: 219, vroeg: 199 },
  { naam: "Winter Complete", prijs: 279, vroeg: 259 },
];
const VROEG_TOT = "2026-11-30";
function vroegboek() {
  const d = new Date();
  return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2) <= VROEG_TOT;
}
const winterOn = () => BODY.winterpage === "1" || BODY.winter === "live";
const winterLabel = (w) => w.naam + " (" + (vroegboek() ? "early booking " + euro(w.vroeg) + " instead of " + euro(w.prijs) : euro(w.prijs)) + ")";
const winterOf = (beurt) => WINTER.find((w) => beurt && beurt.startsWith(w.naam + " ("));
const SERVICES = {
  onderhoud: {
    title: "Maintenance",
    description: "Service by the schedule",
    text: "Tell us which service you want. You get a quote up front that fits your bike.",
    price: "€60 / hour",
    priceNote: "Parts are charged separately.",
  },
  probleem: {
    title: "Something's wrong",
    description: "Warning light, leak, won't start",
    text: "Tell us what you notice. Freddy looks into it with you and discusses the next step.",
    price: "€60 / hour",
    priceNote:
      "Diagnosis and repair in consultation. First you know where you stand.",
  },
  banden: {
    title: "Tyres",
    description: "Advice and price for your size",
    text: "Choose matching sizes and browse the range. Freddy checks the choice and price in your quote.",
    price: "€50 / tyre",
    priceNote: "Fitting incl. VAT. The tyre itself is extra.",
  },
  ombouw: {
    title: "Custom work & lights",
    description: "Indicators and accessories",
    text: "Make your bike the way you want it. Tell us which lights or accessories you want fitted.",
    price: "On request",
    priceNote: "A quote up front. Extra work always after consultation.",
  },
};
function selected() {
  return `<div class="selected"><div><small>YOUR BIKE</small><strong>${motor ? escapeHTML(motorLabel(motor)) : "No bike chosen yet"}</strong></div><button class="btn secondary" data-motor>${motor ? "Change" : "Choose your bike"}</button></div>`;
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
  return `<div class="steps"><div class="step"><h3><b>01</b> Your bike</h3><p>Choose your bike and tell us what you need.</p></div><div class="step"><h3><b>02</b> Quote & date</h3><p>Freddy discusses the price and an available date.</p></div><div class="step"><h3><b>03</b> Getting to work</h3><p>Work by appointment. Extra work only after consultation.</p></div></div>`;
}
function faqBlock(k = "algemeen") {
  const rows =
    k === "banden"
      ? [
          [
            "I don't know my tyre size. What now?",
            "You can ask for advice without choosing tyres. Enter your bike and say you'd like help; Freddy checks the size with you.",
          ],
          [
            "Is fitting included in the tyre price?",
            "No. The tyre price and €50 fitting per tyre are shown separately. With a complete choice you see the combined amount. Extra work is discussed up front.",
          ],
          [
            "Are the tyres available right away?",
            "The list is a range, not live stock. Freddy confirms availability and the final price in the quote.",
          ],
        ]
      : [
          [
            "Do I need to know exactly what's needed?",
            "No. Pick the route that fits best and briefly describe your question. Freddy thinks along with you.",
          ],
          [
            "When is my appointment confirmed?",
            "Once Freddy confirms it. A WhatsApp request is not a booking yet.",
          ],
          [
            "What happens with extra work?",
            "Extra work is discussed with you first. You know the costs up front.",
          ],
        ];
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
  return `<section class="section social-section"><div class="wrap"><div class="social-head"><div><span class="eyebrow">A look inside the workshop</span><h2>Bikes, work & stories.</h2></div><a class="btn secondary instagram-btn" href="https://www.instagram.com/og_motoworks" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="18" cy="6" r="1" fill="currentColor" stroke="none"/></svg>Follow OG MotoWorks on Instagram ↗</a></div><div class="photo-mix"><figure><img data-gallery-photo="MAINTENANCE_URI" alt="Freddy working on a BMW motorcycle" loading="lazy"><figcaption>Attention to the work</figcaption></figure><figure><img data-gallery-photo="CHAIN_URI" alt="Checking the chain slack on a motorcycle" loading="lazy"><figcaption>It's in the details</figcaption></figure><figure><img data-gallery-photo="HONDA_URI" alt="White Honda in front of the workshop" loading="lazy"><figcaption>Different bikes, the same attention</figcaption></figure><figure><img data-gallery-photo="TYRE_URI" alt="Motorcycle from behind with a wide rear tyre" loading="lazy"><figcaption>Tyres and personal contact</figcaption></figure><figure><img data-gallery-photo="GROUP_URI" alt="Three riders on different motorcycles" loading="lazy"><figcaption>The passion behind OG MotoWorks</figcaption></figure></div></div></section><section class="section customer-reviews" id="reviews" aria-labelledby="reviews-title"><div class="wrap"><div class="social-head"><div><span class="eyebrow">Customers in their own words</span><h2 id="reviews-title">Reviews on Google</h2></div><button class="btn secondary" id="reviews-pause" type="button" aria-pressed="false">Pause reviews</button></div><div class="review-viewport" id="review-viewport" role="region" aria-label="Customer reviews, changing automatically" tabindex="0"><div class="review-track">${REVIEWS.map((r) => `<figure class="quote-card"><div class="review-stars" aria-label="5 out of 5 stars">★★★★★ <span>Google</span></div><blockquote>${escapeHTML(r.text)}</blockquote><figcaption>${escapeHTML(r.name)}</figcaption></figure>`).join("")}</div></div><p class="note" style="margin-top:18px">Short excerpts from our Google reviews (in Dutch) · as of 1 October 2026.</p><div class="actions"><a class="btn secondary" href="https://share.google/mfVz03Qhs4EkLpyDO" target="_blank" rel="noopener">All reviews on Google ↗</a><a class="btn text" href="https://g.page/r/CcwNZlk_nz-kEBM/review" target="_blank" rel="noopener">Write a review ↗</a></div></div></section>`;
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

function home() {
  return `<section class="wrap hero reception"><div class="welcome"><span class="eyebrow">Motorcycle workshop · Waalwijk</span><h1>Welcome to<br>OG MotoWorks.</h1><p class="welcome-story">I'm Freddy. At OG MotoWorks you can come for maintenance, repairs, tyres and custom work on your motorcycle. We discuss together what's needed, so you know where you stand up front.</p><p class="welcome-note">Personal contact, honest advice and work by appointment.</p><a href="${R.afspraak}" class="btn" data-start>${motor ? "Continue with your bike" : "Choose your bike"} →</a><p class="welcome-help">Then you calmly choose what you need.</p></div><figure><img src="/assets/og/c927c25d6be18e37.jpg" width="941" height="1672" alt="Freddy with a BMW in the OG MotoWorks workshop"><figcaption class="reception-caption">Freddy · OG MotoWorks</figcaption></figure></section><section class="reception-bottom"><div class="wrap reception-info"><span>Maintenance · Repairs · Tyres · Custom work</span><a href="${R.contact}">Waalwijk, by appointment ↗</a><a href="https://share.google/mfVz03Qhs4EkLpyDO" target="_blank" rel="noopener">Reviews on Google ↗</a></div></section>${socialReviews()}`;
}
function services() {
  return (
    pagehead(
      own("What do you need?"),
      ownText("Choose the route that fits your question."),
      "onderhoud",
      true,
    ) + `<div class="wrap section">${selected()}${cards()}</div>`
  );
}
function commonFields() {
  return `<fieldset class="customer-fields" style="border:0;border-top:1px solid #3a3d44;padding:24px 0 0;margin:26px 0 0"><legend class="heading" style="padding:0 10px 0 0;font-size:23px">Your details</legend><p class="note">So Freddy can discuss your request and make an appointment with you.</p><div class="fields"><div class="full"><label for="naam">Name</label><input id="naam" name="naam" autocomplete="name" required maxlength="120" placeholder="First and last name"></div><div><label for="telefoon">Mobile number</label><input id="telefoon" name="telefoon" type="tel" autocomplete="tel" required maxlength="30" minlength="6" placeholder="06… or +31…"></div><div><label for="email">Email address (optional)</label><input id="email" name="email" type="email" autocomplete="email" maxlength="180" placeholder="For a quote by email"></div><div><label for="kenteken">Registration (optional)</label><input id="kenteken" name="kenteken" maxlength="14" autocomplete="off" autocapitalize="characters" placeholder="AB-12-CD"></div><div><label for="voorkeur">Preferred day (optional)</label><input id="voorkeur" name="voorkeur" placeholder="For example Friday afternoon" maxlength="100"></div></div><p class="note" style="margin-top:15px">We use these details to handle your request. <a href="${R.privacy}">More about privacy</a>.</p></fieldset>`;
}
function requestFields(k) {
  if (k === "onderhoud")
    return `<div class="fields"><div><label for="km">Mileage in km (optional)</label><input id="km" name="km" type="number" min="0" max="999999"></div><div><label for="beurt">Which service?</label><select name="beurt" id="beurt">${BODY.winterpage === "1" ? winterOptions() : ""}<option>Scheduled maintenance</option><option>Oil change</option><option>Major service</option><option>Replace fork seals (€350 fixed)</option><option>Replace chain and sprockets (quotation)</option><option>I don't know yet</option>${winterOn() && BODY.winterpage !== "1" ? winterOptions() : ""}</select></div><div class="full"><label for="toelichting">Notes (optional)</label><textarea name="toelichting" id="toelichting" maxlength="2000" placeholder="What would you like done?"></textarea></div></div>`;
  if (k === "probleem")
    return `<label for="toelichting">What do you notice?</label><textarea name="toelichting" id="toelichting" required maxlength="2000" placeholder="For example: the bike is hard to start when it's warm."></textarea><label for="wanneer" style="margin-top:20px">When does it happen? (optional)</label><input name="wanneer" id="wanneer" maxlength="200" placeholder="Since when, cold or warm, while riding…">`;
  return `<label for="toelichting">What would you like to change?</label><textarea name="toelichting" id="toelichting" required maxlength="2000" placeholder="For example different indicators or heated grips."></textarea>`;
}
function winterOptions() {
  return WINTER.map((w) => `<option>${escapeHTML(winterLabel(w))}</option>`).join("");
}
function routePage(k) {
  const s = SERVICES[k];
  return (
    pagehead(own(s.title), ownText(s.text), k, true) +
    `<div class="wrap workgrid"><div>${selected()}<form id="request-form" data-intent="${k}" class="panel"><h2>${k === "banden" ? "Choose your tyres" : "Your request"}</h2>${k === "banden" ? tyreFields() : requestFields(k)}${commonFields()}<div class="actions"><button class="btn" type="submit">Review my request →</button></div><p class="note" style="margin-top:15px">You send it yourself via WhatsApp. A request is not a confirmed appointment yet.</p><input class="hp" type="text" name="_gotcha" tabindex="-1" autocomplete="off" aria-hidden="true"></form></div><aside class="panel"><span class="eyebrow">Clear up front</span><p class="price">${BODY.price ? escapeHTML(BODY.price) : s.price}</p><p class="muted">${BODY.pricenote ? escapeHTML(BODY.pricenote) : s.priceNote}</p><div class="line"><span>Parts</span><strong>List price</strong></div><div class="line"><span>Up front</span><strong>Quote</strong></div><div class="line"><span>Extra work</span><strong>After consultation</strong></div><p class="note" style="margin-top:18px">Prices incl. VAT. We agree the work with you first.</p><a class="btn secondary" href="${R.tarieven}">All prices</a></aside></div><section class="section"><div class="wrap">${faqBlock(k)}</div></section>`
  );
}
function tyreFields() {
  return `<details class="hintbox"><summary>Where do I find my tyre size?</summary><p>On the sidewall of your tyre, for example 120/70 ZR17. 120 is the width in millimetres, 70 the aspect ratio and 17 the rim size in inches. Copy the full marking; Freddy also checks the version and the other markings.</p><p>Not sure? Leave the size empty and ask for advice.</p></details><p class="note" id="oem-note"></p><div class="fields"><div><label for="voor">Front tyre size</label><input id="voor" name="voor" list="sizes" maxlength="40" placeholder="120/70 ZR17"></div><div><label for="achter">Rear tyre size</label><input id="achter" name="achter" list="sizes" maxlength="40" placeholder="180/55 ZR17"></div><datalist id="sizes">${Object.keys(
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
    )}</select></div><div><label for="sortering">Sort</label><select id="sortering" name="sortering"><option value="naam">Name A–Z</option><option value="laag">Price low–high</option><option value="hoog">Price high–low</option></select></div><div class="full"><label for="positie">Which tyre do you want to replace?</label><select id="positie" name="positie"><option value="beide">Front and rear</option><option value="voor">Front only</option><option value="achter">Rear only</option></select></div></div><p class="note" style="margin-top:15px">Check the sizes on your bike. Prices are indicative prices from ${escapeHTML(DATA.banden.datum)}; stock and the final price are confirmed in the quote.</p><div id="tyre-results"></div><fieldset class="tyre-extras"><legend class="heading smallhead">Extras (optional)</legend><div class="optlist"><label class="tyre"><input type="checkbox" name="ventielen" value="ja"><strong>Right-angle valves</strong><span class="money">+${euro(VENTIELEN)} per set</span><small>Only if they fit. Easier to check and top up your tyre pressure.</small></label><label class="tyre"><input type="checkbox" name="afvoer" value="ja"><strong>Old tyre disposal</strong><span class="money">+${euro(AFVOEREN)} per tyre</span><small>You can also take your old tyre home yourself.</small></label></div></fieldset><div id="tyre-total" class="panel" style="margin-top:20px"></div><label for="toelichting" style="margin-top:20px">Notes (optional)</label><textarea name="toelichting" id="toelichting" maxlength="2000" placeholder="For example: I'd like advice on my choice."></textarea>`;
}
function tariffs() {
  return (
    pagehead(
      own("Prices"),
      ownText("You know where you stand up front. No extra work without consultation."),
      "onderhoud",
      true,
    ) +
    `<div class="wrap workgrid"><div class="panel"><h2>Our prices</h2><div class="line"><span>Labour</span><strong>€60 / hour</strong></div><div class="line"><span>Tyre fitting, tyre extra</span><strong>€50 / tyre</strong></div><div class="line"><span>Right-angle valves, only if they fit</span><strong>€20 / set</strong></div><div class="line"><span>Old tyre disposal (optional)</span><strong>€5 / tyre</strong></div><div class="line"><span>Replace fork seals</span><strong>€350 fixed</strong></div><div class="line"><span>Parts</span><strong>List price</strong></div><div class="line"><span>Replace chain and sprockets</span><strong>Quotation</strong></div><p class="note" style="margin-top:20px">Prices incl. VAT. The quote states which work and materials are included.</p></div><div class="panel"><h2>How we work</h2><p>Tell us which bike you ride and what you need. You get a quote up front.</p><p class="muted">Does something extra come up during the work? Then we consult you first.</p><a href="${R.afspraak}" class="btn">Ask for a quote →</a></div></div>`
  );
}
function about() {
  return (
    pagehead(
      "Freddy. OG MotoWorks.",
      "Personal contact, attention for your bike.",
      "probleem",
      true,
    ) +
    `<div class="wrap about"><img src="/assets/og/c927c25d6be18e37.jpg" width="941" height="1672" alt="Freddy at work on a motorcycle"><div><span class="eyebrow">The mechanic behind OG MotoWorks</span><h2>You talk to the man<br>who works on your bike.</h2><p>I'm Freddy, mechanic at OG MotoWorks. You can come to me for maintenance, repairs, tyres and custom work on your motorcycle.</p><p class="muted">The workshop is in Waalwijk. We work by appointment, so we can discuss your question and the work up front.</p><p>Honest advice, a quote up front and consultation on extra work.</p><a href="${R.contact}" class="btn">Get in touch →</a></div></div>`
  );
}
function contact() {
  return (
    pagehead(
      "Contact",
      "Message Freddy and tell him what your bike needs.",
      "probleem",
      true,
    ) +
    `<div class="wrap workgrid"><div class="panel"><h2>Where to find us</h2><p>Professor Zeemanweg 6-10<br>5144 NN Waalwijk</p><p class="muted">By appointment. Send a message for an available date.</p><p class="hours">We work by appointment. Message us on WhatsApp to book.</p><div class="actions"><a class="btn" href="${R.afspraak}">Request an appointment</a><a class="btn secondary" href="https://www.google.com/maps/search/?api=1&query=Professor+Zeemanweg+6-10%2C+5144+NN+Waalwijk" target="_blank" rel="noopener">Directions</a></div></div><div class="panel"><h2>Direct contact</h2><p>06 42 93 95 55<br><a href="mailto:info@ogmotoworks.nl">info@ogmotoworks.nl</a></p><a href="https://wa.me/31642939555?text=Hi%20Freddy%2C%20I%20have%20a%20question%20about%20my%20motorcycle." class="btn" target="_blank" rel="noopener">Open WhatsApp ↗</a></div></div>`
  );
}
function privacy() {
  return (
    pagehead(own("Privacy"), ownText("Your data at OG MotoWorks."), "onderhoud", true) +
    `<div class="wrap section"><div class="panel"><h2>On your device</h2><p>We only keep your chosen bike in your browser's local storage. What you fill in on the request form stays in this tab's session storage during your visit and is gone when you close the tab.</p><p>When you click 'Open WhatsApp', the composed message goes to WhatsApp; you decide there whether to send it. At the same time we email a copy of your request to OG MotoWorks (via Formspree), so your request doesn't get lost.</p><button class="btn secondary" id="clear-motor">Clear my bike choice</button></div></div>`
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
  $("#tyre-results").innerHTML = positions
    .map((pos) => {
      const items = tyreItems(pos),
        visible = items.slice(0, limits[pos]);
      return `<h3 class="smallhead" style="margin-top:24px">${pos === "voor" ? "Front tyre" : "Rear tyre"}</h3><p class="note" role="status">${items.length} results · ${Math.min(items.length, limits[pos])} shown. Fitment is still checked.</p><div class="tyrelist">${
        visible
          .map((t) => {
            const id = t.merk + "|" + t.band;
            return `<label class="tyre"><input type="radio" name="band-${pos}" value="${escapeHTML(id)}" ${d["band-" + pos] === id ? "checked" : ""}><strong>${escapeHTML(t.merk + " " + t.band)}</strong><small>${escapeHTML(t.notatie)} · ${escapeHTML(DATA.banden.types.find((x) => x[0] === t.type)?.[1] || t.type)}</small><span class="money">${t.prijs ? euro(t.prijs) + " for the tyre" : "Price on request"}</span><small>Fitting: ${euro(DATA.banden.montage)}</small><span class="included">${t.prijs ? euro(t.prijs + DATA.banden.montage) + " together incl. VAT" : "Final price via quote"}</span></label>`;
          })
          .join("") ||
        '<p class="note">No results? Adjust the filters or ask for advice below without choosing tyres.</p>'
      }</div>${items.length > limits[pos] ? `<button class="btn secondary showmore" type="button" data-more="${pos}">Show more ${pos === "voor" ? "front tyres" : "rear tyres"}</button>` : ""}`;
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
          return `<div class="line"><span>${r.pos === "voor" ? "Front" : "Rear"}</span><strong>Still to choose / advice</strong></div>`;
        }
        if (r.band.prijs == null) complete = false;
        else total += r.band.prijs + DATA.banden.montage;
        return `<div class="line"><span>${r.pos === "voor" ? "Front" : "Rear"} · tyre</span><strong>${r.band.prijs ? euro(r.band.prijs) : "On request"}</strong></div><div class="line"><span>Fitting</span><strong>${euro(DATA.banden.montage)}</strong></div>`;
      })
      .join("") +
    extras.map((e) => `<div class="line"><span>${escapeHTML(e[0])}</span><strong>${euro(e[1])}</strong></div>`).join("") +
    `<p style="margin-top:18px"><strong>${complete ? (extras.length ? "Total incl. fitting and extras: " : "Total incl. fitting: ") + euro(total) : "Complete price after choice and quote"}</strong></p><p class="note">Incl. VAT. Availability and any extra work in consultation.</p>`;
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
    : "No single set of sizes for this bike in the overview. Enter your tyre sizes, or ask Freddy for advice.";
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
  const v = vroegboek();
  return { Winterpakket: w.naam + " (" + euro(v ? w.vroeg : w.prijs) + ")", Vroegboek: v ? "yes (" + euro(w.vroeg) + " instead of " + euro(w.prijs) + ")" : "no" };
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
      "All correct? Open WhatsApp and send the message yourself.",
      "probleem",
    ) +
    `<div class="wrap workgrid"><div class="panel"><h2>Your message to Freddy</h2><div class="summary">${escapeHTML(summaryText)}</div><div class="actions"><a class="btn" id="wa-open" href="https://wa.me/31642939555?text=${encodeURIComponent(summaryText)}" target="_blank" rel="noopener">Open WhatsApp ↗</a><a class="btn secondary" href="#formulier">Edit</a></div></div><div class="panel">${selected()}<p>Your request is only sent when you press send in WhatsApp.</p><p class="muted">Freddy confirms the price and an available date. This is not an automatic booking.</p></div></div>`
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
window.OG_READY = boot().catch(() => {
  document.documentElement.classList.add("og-nodata");
});
