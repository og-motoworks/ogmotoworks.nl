#!/usr/bin/env python3
"""Google-reviews bijwerken voor ogmotoworks.nl (draait 's nachts in GitHub Actions, workflow reviews.yml).

Haalt de reviews van OG MotoWorks op via de Google Places API en voegt ze samen in assets/data/reviews.json:
- alleen 4-5 sterren mét tekst; teksten worden nooit aangepast of vertaald (originalText gaat voor);
- ontdubbeld op review-id, anders op naam + tijdstip; een start-review (seed, ingekort) wordt vervangen door de
  volledige versie van Google als naam en begin van de tekst overeenkomen;
- positieve reviews blijven staan als ze uit Google's 5 vallen (archief, max. max_archief); met "archief": false
  in de config niet: dan staan alleen Google's huidige reviews erin (plus de start-reviews die Google niet teruggaf),
  conform het Places-beleid ("must not ... store Places API content");
- nieuwste eerst; reviews zonder datum (seed) achteraan in hun oorspronkelijke volgorde.
Bij een fout (geen sleutel, netwerk, quota, onverwacht antwoord, geen reviews) verandert er NIETS: exit 0 met een
waarschuwing (::warning:: in GitHub Actions). Er wordt nooit een leeg of ongeldig bestand geschreven.
Geen extra pakketten nodig (alleen de standaardbibliotheek van Python 3).

Omgeving: GOOGLE_PLACES_KEY (repo-secret). Alleen voor tests: PLACES_API_BASE, REVIEWS_JSON, REVIEWS_CONFIG, REVIEWS_NOW.
"""
import json, os, re, sys, tempfile, unicodedata, urllib.error, urllib.parse, urllib.request
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
CONFIG = os.environ.get('REVIEWS_CONFIG') or os.path.join(REPO, '.github', 'reviews-config.json')
TARGET = os.environ.get('REVIEWS_JSON') or os.path.join(REPO, 'assets', 'data', 'reviews.json')
NEW_BASE = os.environ.get('PLACES_API_BASE') or 'https://places.googleapis.com/v1'
LEGACY_BASE = os.environ.get('PLACES_API_BASE') or 'https://maps.googleapis.com/maps/api/place'
FIELDS_NEW = 'id,displayName,rating,userRatingCount,googleMapsUri,reviews'


def warn(msg):
    print('::warning::' + msg if os.environ.get('GITHUB_ACTIONS') else 'WAARSCHUWING: ' + msg)


def now_iso():
    n = os.environ.get('REVIEWS_NOW')
    d = datetime.fromisoformat(n) if n else datetime.now(timezone.utc)
    return d.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')


def norm(s):
    s = unicodedata.normalize('NFKD', str(s or '')).lower()
    return re.sub(r'[^a-z0-9]+', '', ''.join(c for c in s if not unicodedata.combining(c)))


def norm_time(t):
    """RFC 3339 of unix-seconden -> 'YYYY-MM-DDTHH:MM:SSZ' (UTC), anders ''."""
    if t in (None, ''):
        return ''
    try:
        if isinstance(t, (int, float)) or re.fullmatch(r'\d+', str(t)):
            d = datetime.fromtimestamp(int(t), timezone.utc)
        else:
            s = re.sub(r'\.\d+', '', str(t)).replace('Z', '+00:00')
            d = datetime.fromisoformat(s)
            d = d if d.tzinfo else d.replace(tzinfo=timezone.utc)
        return d.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')
    except (ValueError, OverflowError, OSError):
        return ''


def key_of(r):
    return r.get('id') or 'k:' + norm(r.get('naam')) + '|' + (r.get('datum') or '')


# ---------- Google-antwoorden -> eigen formaat ----------
def from_new(rv):
    """Place Details (New): reviews[] met name, rating, text, originalText, authorAttribution, publishTime, googleMapsUri."""
    orig, txt = rv.get('originalText') or {}, rv.get('text') or {}
    tekst = (orig.get('text') or txt.get('text') or '').strip()
    taal = orig.get('languageCode') or txt.get('languageCode') or ''
    au = rv.get('authorAttribution') or {}
    return {'id': rv.get('name') or '', 'naam': (au.get('displayName') or '').strip(), 'sterren': int(rv.get('rating') or 0),
            'tekst': tekst, 'taal': taal, 'datum': norm_time(rv.get('publishTime')), 'auteur_url': au.get('uri') or '',
            'google_url': rv.get('googleMapsUri') or '', 'bron': 'google'}


def from_legacy(rv):
    """Place Details (Legacy): reviews[] met author_name, author_url, rating, text, language, original_language, time."""
    return {'id': '', 'naam': (rv.get('author_name') or '').strip(), 'sterren': int(rv.get('rating') or 0),
            'tekst': (rv.get('text') or '').strip(), 'taal': rv.get('original_language') or rv.get('language') or '',
            'datum': norm_time(rv.get('time')), 'auteur_url': rv.get('author_url') or '', 'google_url': '', 'bron': 'google'}


def http_json(url, headers):
    req = urllib.request.Request(url, headers={'Accept': 'application/json', 'User-Agent': 'ogmotoworks-reviews/1', **headers})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode('utf-8'))


def fetch(cfg, key):
    """-> (place_info, [reviews]) of raise RuntimeError met een korte reden (zonder de sleutel)."""
    pid, taal = cfg['place_id'], cfg.get('taal', 'nl')
    try:
        if cfg.get('api', 'new') == 'legacy':
            q = urllib.parse.urlencode({'place_id': pid, 'fields': 'reviews,rating,user_ratings_total', 'reviews_sort': 'newest',
                                        'reviews_no_translations': 'true', 'language': taal, 'key': key})
            d = http_json(LEGACY_BASE + '/details/json?' + q, {})
            if d.get('status') != 'OK':
                raise RuntimeError('Places API (Legacy) status %s %s' % (d.get('status'), d.get('error_message', '')[:120]))
            res = d.get('result') or {}
            return {'rating': res.get('rating'), 'aantal': res.get('user_ratings_total')}, [from_legacy(x) for x in res.get('reviews') or []]
        q = urllib.parse.urlencode({'languageCode': taal, 'regionCode': 'NL'})
        d = http_json(NEW_BASE + '/places/' + urllib.parse.quote(pid) + '?' + q, {'X-Goog-Api-Key': key, 'X-Goog-FieldMask': FIELDS_NEW})
        name = (d.get('displayName') or {}).get('text', '')
        return {'rating': d.get('rating'), 'aantal': d.get('userRatingCount'), 'naam': name, 'url': d.get('googleMapsUri') or ''}, [from_new(x) for x in d.get('reviews') or []]
    except urllib.error.HTTPError as e:
        body = ''
        try:
            body = json.loads(e.read().decode('utf-8')).get('error', {}).get('status', '')
        except Exception:
            pass
        raise RuntimeError('HTTP %s %s' % (e.code, body))
    except urllib.error.URLError as e:
        raise RuntimeError('netwerkfout: %s' % e.reason)
    except (ValueError, KeyError, TypeError, AttributeError) as e:
        raise RuntimeError('onverwacht antwoord: %s' % type(e).__name__)


# ---------- samenvoegen ----------
def positive(r, min_sterren):
    return bool(r.get('naam')) and bool((r.get('tekst') or '').strip()) and int(r.get('sterren') or 0) >= min_sterren


def name_compatible(short, full):
    """'Pleun van D.' past bij 'Pleun van Dijk': elk woord van de korte naam is het begin van het woord op die plek."""
    a = [norm(w) for w in str(short or '').split() if norm(w)]
    b = [norm(w) for w in str(full or '').split() if norm(w)]
    return bool(a) and len(a) <= len(b) and all(b[i].startswith(w) for i, w in enumerate(a))


def seed_matches(seed, r):
    """Seed-tekst is ingekort met '…': klopt naam en begin van de tekst, dan is r de volledige versie."""
    if seed.get('bron') != 'seed' or not name_compatible(seed.get('naam'), r.get('naam')):
        return False
    first = norm(re.split(r'…|\.\.\.', seed.get('tekst') or '')[0])
    return len(first) >= 20 and norm(r.get('tekst')).startswith(first)


def merge(archive, fresh, min_sterren=4, max_archief=40, archief=True):
    out = [dict(r) for r in archive if positive(r, min_sterren)]
    if not archief:  # oude Google-reviews niet bewaren; een vervangen start-review komt terug als seed
        out = [r if r.get('bron') == 'seed' else dict(r['seed']) for r in out if r.get('bron') == 'seed' or isinstance(r.get('seed'), dict)]
    for r in fresh:
        if not positive(r, min_sterren):
            continue
        k = key_of(r)
        hit = next((i for i, a in enumerate(out) if key_of(a) == k or (r.get('naam') and norm(a.get('naam')) == norm(r.get('naam')) and a.get('datum') and a.get('datum') == r.get('datum'))), None)
        if hit is None:
            hit = next((i for i, a in enumerate(out) if seed_matches(a, r)), None)
            if hit is not None:
                r = {**r, 'seed': {k2: v for k2, v in out[hit].items() if k2 != 'seed'}}
        if hit is None:
            out.append(r)
        else:
            out[hit] = {**out[hit], **{k2: v for k2, v in r.items() if v not in ('', None)}}
    dated = sorted([r for r in out if r.get('datum')], key=lambda r: r['datum'], reverse=True)
    undated = [r for r in out if not r.get('datum')]
    return (dated + undated)[:max_archief]


def load(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def write_atomic(path, data):
    txt = json.dumps(data, ensure_ascii=False, indent=1) + '\n'
    json.loads(txt)
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), prefix='.reviews-', suffix='.json')
    with os.fdopen(fd, 'w', encoding='utf-8') as f:
        f.write(txt)
    os.replace(tmp, path)


def main():
    try:
        cfg = load(CONFIG)
        cur = load(TARGET)
        assert isinstance(cur.get('reviews'), list) and cur['reviews'], 'archief leeg'
    except (OSError, ValueError, AssertionError) as e:
        warn('reviews.json of config onleesbaar (%s); niets gewijzigd.' % e)
        return 0
    key = os.environ.get('GOOGLE_PLACES_KEY', '').strip()
    if not key:
        warn('Geen GOOGLE_PLACES_KEY (repo-secret) ingesteld; reviews niet bijgewerkt.')
        return 0
    try:
        info, fresh = fetch(cfg, key)
    except RuntimeError as e:
        warn('Google Places API mislukt (%s); reviews niet bijgewerkt.' % e)
        return 0
    if not fresh:
        warn('Google gaf geen reviews terug; niets gewijzigd.')
        return 0
    if info.get('naam'):
        print('Plaats volgens Google: %s (%s reviews, %s sterren)' % (info.get('naam'), info.get('aantal'), info.get('rating')))
    merged = merge(cur['reviews'], fresh, int(cfg.get('min_sterren', 4)), int(cfg.get('max_archief', 40)), cfg.get('archief', True) is not False)
    if not merged:
        warn('Na samenvoegen geen reviews over; niets gewijzigd.')
        return 0
    new = dict(cur)
    new['reviews'] = merged
    for k in ('rating', 'aantal'):
        if info.get(k) is not None:
            new[k] = info[k]
    new['toon'] = int(cfg.get('toon', cur.get('toon', 8)))
    new['alle_reviews_url'] = cfg.get('alle_reviews_url') or cur.get('alle_reviews_url', '')
    if {k: v for k, v in new.items() if k != 'bijgewerkt'} == {k: v for k, v in cur.items() if k != 'bijgewerkt'}:
        print('Geen nieuwe of gewijzigde reviews; reviews.json blijft gelijk.')
        return 0
    new['bijgewerkt'] = now_iso()
    new['bron'] = 'Google Maps (Places API %s)' % ('Legacy' if cfg.get('api') == 'legacy' else 'New')
    write_atomic(TARGET, new)
    print('reviews.json bijgewerkt: %d reviews in archief (nieuw/gewijzigd t.o.v. vorige stand).' % len(merged))
    return 0


if __name__ == '__main__':
    sys.exit(main())
