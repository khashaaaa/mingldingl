#!/usr/bin/env python3
"""Live latency, measured on the screen: rename the character through the engine API (as another
signed-in device would), then screenshot the device in a loop until the name's pixels change.
Maestro cannot measure this — its waits poll every few seconds.

  live-latency.py <adb serial> <phone> [--max 2] [--runs 5]

The device must be on the Character tab, signed in to <phone>. The measured time includes up to one
screenshot's own duration (≈0.5 s emulator, ≈1.1 s A51), which is subtracted before comparing
with --max."""
import io, json, re, statistics, subprocess, sys, time, urllib.request
from PIL import Image, ImageChops

args = sys.argv[1:]
opt = lambda k, d: float(args[args.index(k) + 1]) if k in args else d
dev, phone = args[0], args[1]
limit, runs = opt('--max', 2.0), int(opt('--runs', 5))
E = 'http://localhost:5150'

def call(path, body=None, token=None, method='POST'):
    req = urllib.request.Request(E + path, method=method if body is not None else 'GET',
        data=json.dumps(body).encode() if body is not None else None,
        headers={'Content-Type': 'application/json', **({'Authorization': 'Bearer ' + token} if token else {})})
    with urllib.request.urlopen(req) as r:
        t = r.read(); return json.loads(t) if t else None

def adb(*a): return subprocess.run(['adb', '-s', dev, *a], capture_output=True).stdout

# The name is the "<name>, <age>" text; its bounds come from the device's own UI dump.
adb('shell', 'uiautomator', 'dump', '/sdcard/ui.xml')
xml = adb('exec-out', 'cat', '/sdcard/ui.xml').decode()
m = re.search(r'text="[^"]+, \d+"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', xml)
if not m: sys.exit('no "<name>, <age>" on screen — open the Character tab first')
box = tuple(map(int, m.groups()))

def shot():
    return Image.open(io.BytesIO(adb('exec-out', 'screencap', '-p'))).convert('RGB').crop(box)

s = call('/auth/phone/start', {'phone': phone})
call('/auth/phone/status/' + s['verificationId'])
token = call('/auth/phone/complete', {'verificationId': s['verificationId'], 'deviceName': 'live-latency'})['accessToken']
seen, caps = [], []
for _ in range(runs):
    t0 = time.time(); base = shot(); caps.append(time.time() - t0)
    call('/me', {'name': 'Lat%d' % (int(time.time() * 1000) % 100000)}, token, 'PUT'); sent = time.time()
    while True:
        img = shot(); t = time.time()
        if ImageChops.difference(base, img).getbbox(): seen.append(t - sent); break
        if t - sent > 10: seen.append(float('inf')); break
    time.sleep(1.5)
cap = statistics.median(caps)
worst = max(seen) - cap
print('%s: name changed %s s after the save returned (screenshot ≈ %.2f s) → worst ≈ %.2f s, limit %.1f s'
      % (dev, ', '.join('%.2f' % x for x in seen), cap, worst, limit))
sys.exit(0 if worst <= limit else 1)
