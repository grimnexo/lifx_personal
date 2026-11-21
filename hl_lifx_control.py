#!/usr/bin/env python3
"""hl_lifx_control: local LIFX controller. Speaks the LIFX LAN UDP protocol and serves a web UI + JSON API.
Standard library only (Python 3.8+). See README.md."""
import datetime as dt, hashlib, hmac, ipaddress, json, math, mimetypes, os, random, re, secrets, socket, sqlite3, struct, threading, time
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from lifx_db import DATA_KEYS, LIST_KEYS, Store

VERSION = '1.1.0'  # bump on every release and add an entry to CHANGELOG.md
PORT = int(os.environ.get('PORT', 8080))
LIFX = 56700
SRC = 0x4C494658
HERE = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(HERE, 'web', 'dist')  # built by `npm run build` in web/
DATA_DIR = os.path.abspath(os.environ.get('LIFX_DATA_DIR') or HERE)
os.makedirs(DATA_DIR, exist_ok=True)
DB_FILE = os.path.join(DATA_DIR, 'lifx.db')
LEGACY_FILES = (os.path.join(DATA_DIR, 'config.json'), os.path.join(DATA_DIR, 'data.json'))  # JSON config from earlier versions


def read_legacy():
    for path in LEGACY_FILES:
        if os.path.exists(path):
            try:
                with open(path) as f:
                    return json.load(f)
            except (OSError, ValueError) as e:
                print(f'Could not read {os.path.basename(path)}: {e}')
    return None


store = Store(DB_FILE)
if not store.has_app_data() and store.user_count() == 0:
    legacy = read_legacy()
    if legacy is not None:
        store.import_legacy(legacy)
        print(f'Imported settings and accounts into {os.path.basename(DB_FILE)}')

def clean_light_ips(items):
    out, seen = [], set()
    for x in (items if isinstance(items, list) else []):
        raw_ip, name = (x.get('ip'), x.get('name')) if isinstance(x, dict) else (x, '')
        ip = str(raw_ip or '').strip()
        try:
            ipaddress.IPv4Address(ip)
        except ValueError:
            continue
        if ip in seen:
            continue
        seen.add(ip)
        out.append({'ip': ip, 'name': str(name or '').strip()[:60]})
    return out


DEFAULT_WARM_PRESETS = [2000, 2700, 3500, 4000, 5000, 6500]
db = {'settings': {'broadcast': '255.255.255.255', 'ips': [], 'poll': 3, 'transition': 0.5, 'scan': [], 'lat': None, 'lon': None, 'light_order': [], 'offline_after': None,
                   'warm_presets': DEFAULT_WARM_PRESETS, 'favorite_colors': []}}
db['settings'].update(store.get_data('settings', {}))
db['settings']['ips'] = clean_light_ips(db['settings']['ips'])
for _key in LIST_KEYS:
    db[_key] = store.get_data(_key, [])

lock = threading.Lock()
devices = {}
_seq = 0
sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
sock.bind(('', 0))


def save():
    store.save_data({k: db[k] for k in DATA_KEYS})


def num(v, default=0.0):
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def clean_rooms(lst):
    out, taken = [], set()
    for r in lst if isinstance(lst, list) else []:
        if not isinstance(r, dict) or not str(r.get('id', '')).strip():
            continue
        macs = [m for m in r.get('lights', []) if isinstance(m, str) and m not in taken]
        taken.update(macs)
        out.append({'id': str(r['id']), 'name': str(r.get('name', '')).strip()[:40] or 'Room', 'lights': macs})
    return out


def macs_of(lst):
    return [m for m in lst if isinstance(m, str)] if isinstance(lst, list) else []


def clean_patterns(lst):
    out = []
    for p in lst if isinstance(lst, list) else []:
        if not isinstance(p, dict) or not str(p.get('id', '')).strip():
            continue
        steps = [{'h': num(c.get('h')) % 360, 's': min(100, max(0, num(c.get('s')))), 'b': min(100, max(0, num(c.get('b'), 100))),
                  'k': max(1500, min(9000, num(c.get('k'), 3500))), 'seconds': min(60, max(0.5, num(c.get('seconds'), 2)))}
                 for c in (p.get('steps') if isinstance(p.get('steps'), list) else []) if isinstance(c, dict)][:32]
        if steps:
            out.append({'id': str(p['id']), 'name': str(p.get('name', '')).strip()[:40] or 'Pattern', 'steps': steps})
    return out


def clean_scenes(lst):
    out = []
    for s in lst if isinstance(lst, list) else []:
        if not isinstance(s, dict) or not str(s.get('id', '')).strip() or not isinstance(s.get('lights'), dict):
            continue
        lights = {m: {'on': bool(c.get('on')), 'h': num(c.get('h')), 's': num(c.get('s')), 'b': num(c.get('b')), 'k': num(c.get('k'), 3500)}
                  for m, c in s['lights'].items() if isinstance(c, dict)}
        runs = [{'pattern': str(r['pattern']), 'lights': macs_of(r.get('lights'))}
                for r in (s.get('patterns') if isinstance(s.get('patterns'), list) else [])
                if isinstance(r, dict) and r.get('pattern')]
        out.append({'id': str(s['id']), 'name': str(s.get('name', '')).strip()[:40] or 'Scene', 'lights': lights, 'patterns': runs})
    return out


def clean_kelvin(lst):
    out = set()
    for x in lst:
        try:
            out.add(max(1500, min(9000, int(float(x)))))
        except (TypeError, ValueError):
            pass
    return sorted(out)


def clean_favorites(lst):
    return [{'type': f['type'], 'id': str(f['id'])} for f in (lst if isinstance(lst, list) else [])
            if isinstance(f, dict) and f.get('type') in ('light', 'group', 'room', 'scene') and f.get('id')]


db['scenes'] = clean_scenes(db['scenes'])
db['patterns'] = clean_patterns(db['patterns'])


PBKDF2_ROUNDS = 200_000
SESSION_SECONDS = 30 * 24 * 3600
attempts = {}  # username -> [failed count, locked until]


def hash_secret(secret, salt=None):
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac('sha256', secret.encode(), salt, PBKDF2_ROUNDS)
    return {'salt': salt.hex(), 'hash': digest.hex()}


def check_secret(secret, rec):
    if not rec:
        return False
    digest = hashlib.pbkdf2_hmac('sha256', secret.encode(), bytes.fromhex(rec['salt']), PBKDF2_ROUNDS)
    return hmac.compare_digest(digest.hex(), rec['hash'])


def new_user(username, name, password):
    return {'id': secrets.token_hex(6), 'username': username, 'name': name, 'theme': 'auto',
            'password': hash_secret(password), 'pin': None}


APPEARANCE_OPTIONS = {
    'theme': ('auto', 'light', 'dark'),
    'accent': ('blue', 'teal', 'green', 'violet', 'amber', 'orange', 'rose', 'slate'),
    'palette': ('default', 'paper', 'mist', 'sage', 'dusk'),
    'layout': ('top', 'side'),
    'contrast': ('standard', 'high'),
    'textSize': ('small', 'default', 'large'),
    'motion': ('system', 'reduce'),
}
APPEARANCE_DEFAULTS = {'theme': 'auto', 'accent': 'blue', 'palette': 'default', 'layout': 'top',
                       'contrast': 'standard', 'textSize': 'default', 'motion': 'system'}


def appearance_of(u):
    return {k: u.get(k, APPEARANCE_DEFAULTS[k]) for k in APPEARANCE_OPTIONS}


def public_user(u):
    return {'id': u['id'], 'username': u['username'], 'name': u['name'], **appearance_of(u),
            'hasPin': bool(u.get('pin'))}


if store.user_count() == 0:
    if os.environ.get('LIFX_REQUIRE_ADMIN') == '1':
        raise SystemExit('No accounts exist. Run ./manage.sh install to create an administrator first.')
    store.insert_user(new_user('test', 'Test user', 'test'))  # legacy direct-start development behavior


def packet(mtype, mac=None, payload=b''):
    global _seq
    _seq = (_seq + 1) & 255
    flags = 1024 | 0x1000 | (0 if mac else 0x2000)  # protocol, addressable, tagged if broadcast
    target = (bytes.fromhex(mac) if mac else b'\0' * 6) + b'\0\0'
    hdr = struct.pack('<HHI8s6sBB8sH2s', 36 + len(payload), flags, SRC, target,
                      b'\0' * 6, 1, _seq, b'\0' * 8, mtype, b'\0\0')  # res_required = 1
    return hdr + payload


send_failures = {}


def tx(buf, ip):
    try:
        sock.sendto(buf, (ip, LIFX))
    except OSError as e:
        send_failures[e.errno] = send_failures.get(e.errno, 0) + 1
        if send_failures[e.errno] == 1:
            print('send error:', ip, e, '(further errors of this type are suppressed)')


stats = {'replies': 0}


def local_ip(target):
    for t in (target, '8.8.8.8'):
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect((t, LIFX))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except OSError:
            pass
    return None


def scan_targets():
    """Unicast addresses to probe: configured CIDR ranges, else the /24 around this machine."""
    nets = []
    for c in db['settings'].get('scan', []):
        try:
            nets.append(ipaddress.ip_network(c, strict=False))
        except ValueError:
            pass
    if not nets:
        ip = local_ip(db['settings']['broadcast'])
        if ip:
            nets.append(ipaddress.ip_network(ip + '/24', strict=False))
    return [str(h) for n in nets if n.num_addresses <= 1024 for h in n.hosts()]


def rx_loop():
    while True:
        try:
            m, (ip, _) = sock.recvfrom(1024)
        except OSError:
            continue
        if len(m) < 36 or struct.unpack_from('<I', m, 4)[0] != SRC:
            continue
        mtype = struct.unpack_from('<H', m, 32)[0]
        mac = m[8:14].hex()
        if mtype == 3:
            stats['replies'] += 1
        if mtype in (3, 107):
            with lock:
                d = devices.setdefault(mac, {'mac': mac, 'label': mac, 'h': 0, 's': 0, 'b': 0, 'k': 3500, 'on': False})
                d['ip'] = ip
                d['seen'] = time.time()
                if mtype == 107:
                    h, s, b, k, _, power = struct.unpack_from('<HHHHhH', m, 36)
                    d.update(on=power > 0)
                    if time.time() >= d.get('fx_until', 0):  # during an effect the bulb reports transient colors
                        d.update(h=h, s=s, b=b, k=k)
                        d.pop('fx', None)
                    d['label'] = m[48:80].split(b'\0')[0].decode('utf8', 'replace') or mac


def poll_loop():
    n = 0
    while True:
        try:
            poll_once(n)
        except Exception as e:
            print('poll error:', repr(e))
        n += 1
        time.sleep(max(1, db['settings']['poll']))


def poll_once(n):
    if True:
        s = db['settings']
        tx(packet(2), s['broadcast'])  # GetService: discovers new lights
        tx(packet(2), '255.255.255.255')
        for rec in s['ips']:
            tx(packet(2), rec['ip'])
        if not devices or n % 10 == 0:  # broadcasts can be filtered; also probe each address directly
            for ip in scan_targets():
                tx(packet(2), ip)
        with lock:
            known = [(d['mac'], d['ip']) for d in devices.values()]
        for mac, ip in known:
            tx(packet(101, mac), ip)  # LightGet: current state


def u16(v, mx):
    return max(0, min(65535, round(v / mx * 65535)))


def set_light(d, c):
    d['fx_until'] = 0  # manual control cancels our idea of a running effect
    d.pop('fx', None)
    d.pop('fl', None)
    dur = round(db['settings']['transition'] * 1000)
    if any(k in c for k in ('h', 's', 'b', 'k')):
        h = c.get('h', d['h'] / 65535 * 360)
        s = c.get('s', d['s'] / 65535 * 100)
        b = c.get('b', d['b'] / 65535 * 100)
        k = int(max(1500, min(9000, c.get('k', d['k']))))
        hh, ss, bb = u16(h % 360, 360), u16(s, 100), u16(b, 100)
        tx(packet(102, d['mac'], struct.pack('<BHHHHI', 0, hh, ss, bb, k, dur)), d['ip'])
        d.update(h=hh, s=ss, b=bb, k=k)
    if 'power' in c:
        tx(packet(117, d['mac'], struct.pack('<HI', 65535 if c['power'] else 0, dur)), d['ip'])
        d['on'] = bool(c['power'])


def apply(macs, c):
    with lock:
        for m in macs:
            if m in devices:
                set_light(devices[m], c)


# ---- Effects: the bulb itself runs LIFX "SetWaveform" (type 103), so no cloud and no flicker from network lag ----
# kind -> (waveform id, period in ms, dip: fraction of own brightness used when no color is given)
WAVES = {'breathe': (1, 3000, 0.03), 'pulse': (4, 1000, 0.0), 'strobe': (4, 100, 0.0)}  # 1 = SINE, 4 = PULSE
CONTINUOUS_SECONDS = 3600  # toggled-on breathe/pulse/flicker run up to an hour; strobe is capped at 60 s
EFFECTS = set(WAVES) | {'flicker'}
# 'flicker' (candle) has no bulb-side waveform, so the server emulates it: see flicker_loop()


def offline_limit():
    s = db['settings']
    return s['offline_after'] or s['poll'] * 4 + 3


def is_online(d):
    return time.time() - d['seen'] < offline_limit()


def run_effect(macs, kind, color=None, times=None, seconds=None):
    """Breathe/pulse/strobe lights that are ON, then the bulb returns to its previous color by itself."""
    if kind == 'stop':
        return stop_effect(macs)
    if kind == 'flicker':
        return start_flicker(macs, color, seconds)
    wave, period, dip = WAVES[kind]
    if kind == 'strobe':
        cycles = min(float(seconds or 30), 60) * 1000 / period
    else:
        cycles = min(float(times), 1000) if times else CONTINUOUS_SECONDS * 1000 / period
    with lock:
        for m in macs:
            d = devices.get(m)
            if not d or not d.get('on') or not is_online(d):
                continue  # lights that are off (or unreachable) are skipped
            if time.time() >= d.get('fx_until', 0):
                d['base'] = (d['h'], d['s'], d['b'], d['k'])  # remember the real state, polls are gated during the effect
            bh, bs, bb, bk = d['base']
            if d.get('fx') == 'flicker':  # leaving candle mode: snap back so the wave returns to the real color
                tx(packet(102, m, struct.pack('<BHHHHI', 0, bh, bs, bb, bk, 0)), d['ip'])
                d.pop('fl', None)
            if color:
                h, s, b, k = u16(color['h'] % 360, 360), u16(color['s'], 100), u16(color['b'], 100), int(color.get('k', 3500))
            else:
                h, s, b, k = bh, bs, int(bb * dip), bk
            payload = struct.pack('<BBHHHHIfhB', 0, 1, h, s, b, max(1500, min(9000, k)), period, cycles, 0, wave)
            tx(packet(103, m, payload), d['ip'])
            d['fx'] = kind
            d['fx_until'] = time.time() + cycles * period / 1000 + 1


def start_flicker(macs, color, seconds):
    """Candle flicker: the flicker_loop thread sends randomized SetColor commands until the time is up."""
    secs = min(float(seconds or CONTINUOUS_SECONDS), CONTINUOUS_SECONDS)
    now = time.time()
    with lock:
        for m in macs:
            d = devices.get(m)
            if not d or not d.get('on') or not is_online(d):
                continue
            if now >= d.get('fx_until', 0):
                d['base'] = (d['h'], d['s'], d['b'], d['k'])
            if color:
                peak = (u16(color['h'] % 360, 360), u16(color['s'], 100), u16(color['b'], 100), int(color.get('k', 3500)))
            else:
                peak = d['base']
            d['fx'] = 'flicker'
            d['fl'] = {'end': now + secs, 'next': now, 'peak': peak, 'lvl': 1.0}
            d['fx_until'] = now + secs + 2  # keep polls from overwriting the saved state while we run and restore


def flicker_step(d, now):
    """One candle update for a bulb (called under the lock). Returns False when its flicker is over."""
    f = d.get('fl')
    if d.get('fx') != 'flicker' or not f:
        return False  # cancelled by hand or replaced by another effect: leave the bulb alone
    h, s, b, k = f['peak']
    if now >= f['end']:
        bh, bs, bb, bk = d['base']
        tx(packet(102, d['mac'], struct.pack('<BHHHHI', 0, bh, bs, bb, bk, 400)), d['ip'])  # fade back
        d.pop('fx', None)
        d.pop('fl', None)
        return False
    if now < f['next']:
        return True
    r = random.random()  # mostly gentle wobble, sometimes a deeper gust
    target = random.uniform(0.7, 1.0) if r < 0.7 else random.uniform(0.45, 0.7) if r < 0.93 else random.uniform(0.25, 0.45)
    f['lvl'] += (target - f['lvl']) * 0.8
    gap = random.uniform(0.15, 0.4)
    if s > 0:  # colored light: wiggle the hue a few degrees
        h = (h + random.randint(-700, 700)) % 65536
    else:      # white light: wiggle the warmth
        k = max(1500, min(9000, k + random.randint(-250, 250)))
    tx(packet(102, d['mac'], struct.pack('<BHHHHI', 0, h, s, max(1, int(b * f['lvl'])), k, int(gap * 1000))), d['ip'])
    f['next'] = now + gap
    return True


def flicker_loop():
    while True:
        try:
            now = time.time()
            with lock:
                for d in list(devices.values()):
                    if d.get('fx') == 'flicker':
                        flicker_step(d, now)
        except Exception as e:
            print('flicker error:', repr(e))
        time.sleep(0.05)


def run_pattern(macs, pattern):
    """Cycle lights that are ON through the pattern's color steps until stopped or the hour is up."""
    now = time.time()
    with lock:
        for m in macs:
            d = devices.get(m)
            if not d or not d.get('on') or not is_online(d):
                continue
            if now >= d.get('fx_until', 0):
                d['base'] = (d['h'], d['s'], d['b'], d['k'])
            d['fx'] = 'pattern'
            d['pat'] = {'steps': pattern['steps'], 'i': -1, 'next': now}
            d['fx_until'] = now + CONTINUOUS_SECONDS
            d.pop('fl', None)


def pattern_step(d, now):
    """Advance one light's pattern (called under the lock)."""
    p = d.get('pat')
    if d.get('fx') != 'pattern' or not p:
        return
    if now >= d['fx_until']:
        bh, bs, bb, bk = d['base']
        tx(packet(102, d['mac'], struct.pack('<BHHHHI', 0, bh, bs, bb, bk, 400)), d['ip'])
        d.pop('fx', None)
        return
    if now < p['next']:
        return
    p['i'] = (p['i'] + 1) % len(p['steps'])
    c = p['steps'][p['i']]
    h, s, b = u16(c['h'], 360), u16(c['s'], 100), u16(c['b'], 100)
    tx(packet(102, d['mac'], struct.pack('<BHHHHI', 0, h, s, b, int(c['k']), round(c['seconds'] * 500))), d['ip'])
    p['next'] = now + c['seconds']


def pattern_loop():
    while True:
        try:
            now = time.time()
            with lock:
                for d in list(devices.values()):
                    if d.get('fx') == 'pattern':
                        pattern_step(d, now)
        except Exception as e:
            print('pattern error:', repr(e))
        time.sleep(0.05)


def stop_effect(macs):
    with lock:
        for m in macs:
            d = devices.get(m)
            if d and d.get('base') and d.get('fx_until', 0) > time.time():
                h, s, b, k = d['base']
                tx(packet(102, m, struct.pack('<BHHHHI', 0, h, s, b, k, 0)), d['ip'])
                d.update(h=h, s=s, b=b, k=k, fx_until=0)
                d.pop('fx', None)
                d.pop('fl', None)


def view(d):
    online = time.time() - d['seen'] < offline_limit()
    return {'mac': d['mac'], 'label': d['label'], 'ip': d['ip'], 'online': online, 'on': d['on'],
            'h': round(d['h'] / 65535 * 360), 's': round(d['s'] / 65535 * 100),
            'b': round(d['b'] / 65535 * 100), 'k': d['k'],
            'fx': d.get('fx') if time.time() < d.get('fx_until', 0) else None}


# ---- Schedules: run by a background thread, so they work with the browser closed ----
fired = {}  # schedule id -> date it last ran


def sun_event(day, lat, lon, rise):
    """Sunrise/sunset (Almanac for Computers algorithm, good to a few minutes) as a local datetime, or None."""
    n = day.timetuple().tm_yday
    lng = lon / 15
    tt = n + ((6 if rise else 18) - lng) / 24
    M = 0.9856 * tt - 3.289
    L = (M + 1.916 * math.sin(math.radians(M)) + 0.02 * math.sin(math.radians(2 * M)) + 282.634) % 360
    RA = math.degrees(math.atan(0.91764 * math.tan(math.radians(L)))) % 360
    RA = (RA + (math.floor(L / 90) - math.floor(RA / 90)) * 90) / 15
    sin_dec = 0.39782 * math.sin(math.radians(L))
    cos_dec = math.cos(math.asin(sin_dec))
    cos_h = (math.cos(math.radians(90.833)) - sin_dec * math.sin(math.radians(lat))) / (cos_dec * math.cos(math.radians(lat)))
    if not -1 <= cos_h <= 1:
        return None  # sun never rises/sets that day (polar)
    H = math.degrees(math.acos(cos_h))
    H = (360 - H if rise else H) / 15
    ut = (H + RA - 0.06571 * tt - 6.622 - lng) % 24
    loc = (dt.datetime(day.year, day.month, day.day, tzinfo=dt.timezone.utc) + dt.timedelta(hours=ut)).astimezone()
    for _ in range(2):  # keep it on the requested local date
        if loc.date() < day:
            loc += dt.timedelta(days=1)
        elif loc.date() > day:
            loc -= dt.timedelta(days=1)
    return loc


def fire_time(s, day):
    w = s.get('when', {})
    if w.get('type') == 'time':
        h, m = (int(x) for x in str(w.get('time', '00:00')).split(':')[:2])
        return dt.datetime.combine(day, dt.time(h, m)).astimezone()
    lat, lon = db['settings'].get('lat'), db['settings'].get('lon')
    if lat is None or lon is None:
        return None
    t0 = sun_event(day, lat, lon, w.get('type') == 'sunrise')
    return t0 + dt.timedelta(minutes=int(w.get('offset') or 0)) if t0 else None


def next_fire(s):
    if s.get('enabled', True) is False:
        return None
    now = dt.datetime.now().astimezone()
    for i in range(9):
        day = now.date() + dt.timedelta(days=i)
        if day.weekday() in (s.get('days') or range(7)):
            ft = fire_time(s, day)
            if ft and ft > now:
                return ft.isoformat()
    return None


def run_action(s):
    a = s.get('action', {})
    tgt, kind = a.get('target', 'all'), a.get('type')
    g = next((g for g in db['groups'] if g['id'] == tgt), None)
    with lock:
        macs = list(devices) if tgt == 'all' else (g['members'] if g else [])
    if kind in ('on', 'off'):
        apply(macs, {'power': kind == 'on'})
    elif kind in EFFECTS:
        run_effect(macs, kind, a.get('color'), a.get('times'), a.get('seconds'))
    elif kind == 'preset' and g:
        p = next((p for p in g.get('presets', []) if p['id'] == a.get('preset')), None)
        for mac, c in (p['lights'].items() if p else []):
            if mac in g['members']:
                apply([mac], {'h': c['h'], 's': c['s'], 'b': c['b'], 'k': c['k'], 'power': c['on']})
    print(f"[schedule] ran '{s.get('name')}': {kind} {tgt}")


def schedule_loop():
    while True:
        try:
            now = dt.datetime.now().astimezone()
            for s in list(db['schedules']):
                if s.get('enabled', True) is False or fired.get(s['id']) == now.date():
                    continue
                if now.weekday() not in (s.get('days') or range(7)):
                    continue
                ft = fire_time(s, now.date())
                if ft and ft <= now < ft + dt.timedelta(minutes=5):  # missed runs older than 5 min are skipped
                    fired[s['id']] = now.date()
                    run_action(s)
                    s['runs'] = s.get('runs', 0) + 1
                    save()
        except Exception as e:
            print('schedule error:', repr(e))
        time.sleep(15)


def sun_today():
    s = db['settings']
    if s.get('lat') is None or s.get('lon') is None:
        return None
    day = dt.datetime.now().astimezone().date()
    out = {}
    for key, rise in (('sunrise', True), ('sunset', False)):
        t = sun_event(day, s['lat'], s['lon'], rise)
        out[key] = t.strftime('%H:%M') if t else None
    return out


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def stream_events(self):
        self.send_response(200)
        self.send_header('Content-Type', 'text/event-stream')
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('Connection', 'close')
        self.end_headers()
        last, idle = None, 0
        try:
            while True:
                with lock:
                    snap = json.dumps([view(d) for d in devices.values()])
                if snap != last:
                    last, idle = snap, 0
                    self.wfile.write(b'data: ' + snap.encode() + b'\n\n')
                else:
                    idle += 1
                    if idle >= 15:
                        idle = 0
                        self.wfile.write(b': keep-alive\n\n')
                self.wfile.flush()
                time.sleep(1)
        except OSError:
            pass
        self.close_connection = True

    def send_json(self, obj, code=200, headers=()):
        data = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        for k, v in headers:
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(data)

    def session_token(self):
        auth = self.headers.get('Authorization', '')
        if auth.startswith('Bearer '):
            return auth[7:]
        try:
            morsel = SimpleCookie(self.headers.get('Cookie', '')).get('lifx_session')
        except Exception:
            return None
        return morsel.value if morsel else None

    def session_user(self):
        return store.session_user(self.session_token())

    def login(self, b):
        name = str(b.get('username', '')).strip()
        user = store.user_by_name(name)
        tries = attempts.setdefault(name, [0, 0.0])
        if tries[1] > time.time():
            return self.send_json({'ok': False, 'error': 'Too many attempts. Wait a minute and try again.'}, 429)
        use_pin = 'pin' in b
        secret = str(b.get('pin' if use_pin else 'password', ''))
        ok = bool(user) and check_secret(secret, user['pin' if use_pin else 'password'])
        if not ok:
            tries[0] += 1
            if tries[0] >= 5:
                tries[:] = [0, time.time() + 60]
            return self.send_json({'ok': False, 'error': 'Wrong username or ' + ('PIN' if use_pin else 'password')}, 401)
        attempts.pop(name, None)
        token = secrets.token_urlsafe(32)
        store.create_session(token, user['id'], time.time() + SESSION_SECONDS)
        self.send_json({'ok': True, 'user': public_user(user), 'token': token},
                       headers=[('Set-Cookie', f'lifx_session={token}; Path=/; HttpOnly; SameSite=Strict; Max-Age={SESSION_SECONDS}')])

    def auth_route(self, path, method, b):
        if path == '/api/auth/login' and method == 'POST':
            return self.login(b)
        if path == '/api/auth/logout' and method == 'POST':
            store.delete_session(self.session_token())
            return self.send_json({'ok': True}, headers=[('Set-Cookie', 'lifx_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0')])
        user = self.session_user()
        if not user:
            return self.send_json({'ok': False, 'error': 'Not signed in'}, 401)
        if path == '/api/auth/me' and method == 'GET':
            return self.send_json({'ok': True, 'user': public_user(user)})
        self.send_json({'error': 'not found'}, 404)

    def update_account(self, user, b):
        name = str(b['name']).strip()[:40] if 'name' in b else user['name']
        if not name:
            return self.send_json({'ok': False, 'error': 'Name cannot be empty'}, 400)
        appearance = appearance_of(user)
        for key, options in APPEARANCE_OPTIONS.items():
            value = b.get(key, appearance[key])
            if value not in options:
                return self.send_json({'ok': False, 'error': f'Unknown value for {key}'}, 400)
            appearance[key] = value
        changes_secret = 'newPassword' in b or 'pin' in b
        if changes_secret and not check_secret(str(b.get('currentPassword', '')), user['password']):
            return self.send_json({'ok': False, 'error': 'Current password is wrong'}, 403)
        new_pw = str(b['newPassword']) if 'newPassword' in b else None
        if new_pw is not None and len(new_pw) < 4:
            return self.send_json({'ok': False, 'error': 'Password must be at least 4 characters'}, 400)
        pin = str(b['pin']).strip() if 'pin' in b else None
        if pin and not (pin.isdigit() and 4 <= len(pin) <= 8):
            return self.send_json({'ok': False, 'error': 'PIN must be 4 to 8 digits'}, 400)
        user['name'] = name
        user.update(appearance)
        if new_pw is not None:
            user['password'] = hash_secret(new_pw)
        if pin is not None:
            user['pin'] = hash_secret(pin) if pin else None
        try:
            store.update_user(user)
        except sqlite3.Error as e:
            return self.send_json({'ok': False, 'error': f'Could not save account: {e}'}, 500)
        if new_pw is not None:
            store.delete_other_sessions(user['id'], self.session_token())
        self.send_json({'ok': True, 'user': public_user(user)})

    def read_body(self):
        try:
            n = int(self.headers.get('Content-Length') or 0)
            b = json.loads(self.rfile.read(n) or b'{}')
            return b if isinstance(b, dict) else {}
        except Exception:
            return {}

    def serve_web(self, path):
        full = os.path.abspath(os.path.join(DIST, path.lstrip('/') or 'index.html'))
        if not full.startswith(DIST + os.sep) or not os.path.isfile(full):
            full = os.path.join(DIST, 'index.html')  # client-side fallback for unknown paths
        try:
            with open(full, 'rb') as f:
                data = f.read()
        except OSError:
            data = b'Web UI not built. Run: cd web && npm install && npm run build'
            return self.send_bytes(data, 'text/plain; charset=utf-8', 503)
        self.send_bytes(data, mimetypes.guess_type(full)[0] or 'application/octet-stream')

    def send_bytes(self, data, ctype, code=200):
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def route(self, method):
        try:
            self._route(method)
        except Exception as e:
            import traceback
            traceback.print_exc()
            try:
                self.send_json({'ok': False, 'error': f'Server error: {e!r}'}, 500)
            except OSError:
                pass

    def _route(self, method):
        path = self.path.split('?')[0]
        parts = [p for p in path.split('/') if p]
        if not parts or parts[0] != 'api':
            return self.serve_web(path)
        b = {} if method == 'GET' else self.read_body()
        if parts[1:2] == ['auth']:
            return self.auth_route(path, method, b)
        user = self.session_user()
        if not user:
            return self.send_json({'ok': False, 'error': 'Not signed in'}, 401)
        if path == '/api/account' and method == 'PUT':
            return self.update_account(user, b)
        if path == '/api/events' and method == 'GET':
            return self.stream_events()
        if path == '/api/state':
            with lock:
                lights = [view(d) for d in devices.values()]
            return self.send_json({'lights': lights, 'groups': db['groups'], 'settings': db['settings'],
                                   'schedules': [dict(s, next=next_fire(s)) for s in db['schedules']],
                                   'rooms': db['rooms'], 'scenes': db['scenes'], 'favorites': db['favorites'],
                                   'patterns': db['patterns'],
                                   'sun': sun_today(), 'version': VERSION,
                                   'diag': {'local_ip': local_ip(db['settings']['broadcast']), 'replies': stats['replies']}})
        if len(parts) == 4 and parts[1] == 'light' and parts[3] == 'label':
            label = str(b.get('label', '')).strip().encode()[:32].decode('utf8', 'ignore')
            if not label:
                return self.send_json({'ok': False, 'error': 'Name cannot be empty'}, 400)
            with lock:
                d = devices.get(parts[2])
                if d:
                    d['label'] = label
                    tx(packet(24, d['mac'], label.encode().ljust(32, b'\0')), d['ip'])
            return self.send_json({'ok': bool(d)}, 200 if d else 404)
        if len(parts) == 3 and parts[1] == 'light':
            apply([parts[2]], b)
            return self.send_json({'ok': True})
        if parts[1] == 'all':
            with lock:
                macs = list(devices)
            apply(macs, b)
            return self.send_json({'ok': True})
        if len(parts) == 3 and parts[1] == 'group':
            g = next((g for g in db['groups'] if g['id'] == parts[2]), None)
            if g:
                apply(g['members'], b)
            return self.send_json({'ok': bool(g)})
        if len(parts) == 3 and parts[1] == 'effect':
            tgt = parts[2]
            g = next((g for g in db['groups'] if g['id'] == tgt), None)
            kind = b.get('effect')
            if tgt != 'all' and not g and tgt not in devices:
                return self.send_json({'ok': False, 'error': 'unknown group or light'}, 404)
            if kind not in EFFECTS and kind != 'stop':
                return self.send_json({'ok': False, 'error': 'effect must be breathe, pulse, strobe, flicker or stop'}, 400)
            with lock:
                macs = list(devices) if tgt == 'all' else list(g['members']) if g else [tgt]
            run_effect(macs, kind, b.get('color'), b.get('times'), b.get('seconds'))
            return self.send_json({'ok': True})
        if len(parts) == 4 and parts[1] == 'schedule' and parts[3] == 'run':
            s = next((s for s in db['schedules'] if s['id'] == parts[2]), None)
            if s:
                run_action(s)
                s['manual_runs'] = s.get('manual_runs', 0) + 1
                save()
            return self.send_json({'ok': bool(s)})
        if path == '/api/schedules' and method == 'PUT':
            lst = b.get('schedules')
            old = {o['id']: o for o in db['schedules']}
            db['schedules'] = [s for s in lst if isinstance(s, dict) and 'id' in s] if isinstance(lst, list) else []
            for s in db['schedules']:
                s.pop('next', None)
                o = old.get(s['id'], {})  # counters belong to the server; a stale page can't overwrite them
                s['runs'] = o.get('runs', 0)
                s['manual_runs'] = o.get('manual_runs', 0)
            save()
            return self.send_json({'ok': True})
        if len(parts) == 3 and parts[1] == 'room':
            room = next((r for r in db['rooms'] if r['id'] == parts[2]), None)
            if room and 'power' in b:
                apply(room['lights'], {'power': bool(b['power'])})
            return self.send_json({'ok': bool(room)}, 200 if room else 404)
        if len(parts) == 4 and parts[1] == 'scene' and parts[3] == 'apply':
            sc = next((s for s in db['scenes'] if s['id'] == parts[2]), None)
            for mac, c in (sc['lights'].items() if sc else []):
                apply([mac], {'h': c['h'], 's': c['s'], 'b': c['b'], 'k': c['k'], 'power': c['on']})
            for run in (sc['patterns'] if sc else []):
                p = next((p for p in db['patterns'] if p['id'] == run['pattern']), None)
                if p:
                    run_pattern(run['lights'], p)
            return self.send_json({'ok': bool(sc)}, 200 if sc else 404)
        if len(parts) == 4 and parts[1] == 'pattern' and parts[3] == 'apply':
            p = next((p for p in db['patterns'] if p['id'] == parts[2]), None)
            if p:
                run_pattern(macs_of(b.get('lights')), p)
            return self.send_json({'ok': bool(p)}, 200 if p else 404)
        if path == '/api/stop-lights' and method == 'POST':
            stop_effect(macs_of(b.get('lights')))
            return self.send_json({'ok': True})
        if path == '/api/patterns' and method == 'PUT':
            db['patterns'] = clean_patterns(b.get('patterns'))
            save()
            return self.send_json({'ok': True})
        if path == '/api/rooms' and method == 'PUT':
            db['rooms'] = clean_rooms(b.get('rooms'))
            save()
            return self.send_json({'ok': True})
        if path == '/api/scenes' and method == 'PUT':
            db['scenes'] = clean_scenes(b.get('scenes'))
            save()
            return self.send_json({'ok': True})
        if path == '/api/favorites' and method == 'PUT':
            db['favorites'] = clean_favorites(b.get('favorites'))
            save()
            return self.send_json({'ok': True})
        if path == '/api/groups' and method == 'PUT':
            groups = b.get('groups')
            db['groups'] = groups if isinstance(groups, list) else []
            save()
            return self.send_json({'ok': True})
        if path == '/api/settings' and method == 'PUT':
            s = db['settings']
            if isinstance(b.get('broadcast'), str) and b['broadcast'].strip():
                s['broadcast'] = b['broadcast'].strip()
            if isinstance(b.get('ips'), list):
                s['ips'] = clean_light_ips(b['ips'])
            for k, lim in (('lat', 90), ('lon', 180)):
                if k in b:
                    try:
                        v = float(b[k])
                        s[k] = v if abs(v) <= lim else s.get(k)
                    except (TypeError, ValueError):
                        s[k] = None
            if isinstance(b.get('light_order'), list):
                s['light_order'] = [str(x) for x in b['light_order']]
            if isinstance(b.get('scan'), list):
                s['scan'] = [str(x).strip() for x in b['scan'] if str(x).strip()]
            try:
                if float(b.get('poll', 0)) >= 1:
                    s['poll'] = float(b['poll'])
                if float(b.get('transition', -1)) >= 0:
                    s['transition'] = float(b['transition'])
                if 'offline_after' in b:
                    s['offline_after'] = None if b['offline_after'] in (None, '') else max(3.0, float(b['offline_after']))
            except (TypeError, ValueError):
                pass
            if isinstance(b.get('warm_presets'), list):
                s['warm_presets'] = clean_kelvin(b['warm_presets'])
            if isinstance(b.get('favorite_colors'), list):
                s['favorite_colors'] = [str(x).lower() for x in b['favorite_colors']
                                        if re.fullmatch(r'#[0-9a-fA-F]{6}', str(x))]
            try:
                save()
            except sqlite3.Error as e:
                return self.send_json({'ok': False, 'error': f'Could not save settings: {e}'}, 500)
            return self.send_json({'ok': True})
        self.send_json({'error': 'not found'}, 404)

    def do_GET(self): self.route('GET')
    def do_POST(self): self.route('POST')
    def do_PUT(self): self.route('PUT')


if __name__ == '__main__':
    threading.Thread(target=rx_loop, daemon=True).start()
    threading.Thread(target=poll_loop, daemon=True).start()
    threading.Thread(target=schedule_loop, daemon=True).start()
    threading.Thread(target=flicker_loop, daemon=True).start()
    threading.Thread(target=pattern_loop, daemon=True).start()
    print(f'hl_lifx_control v{VERSION} running at http://localhost:{PORT}')
    try:
        ThreadingHTTPServer(('0.0.0.0', PORT), Handler).serve_forever()
    except OSError as e:
        print(f'\nCould not start on port {PORT}: {e}\nAnother program is probably using it. '
              f'Stop it, or run with a different port, e.g. PORT=9000 python3 hl_lifx_control.py')
    except KeyboardInterrupt:
        pass
