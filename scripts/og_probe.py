#!/usr/bin/env python3
"""
Probe a domain for OG / social-card images.

Tries in order:
  1. og:image meta tag from root
  2. Common OG path patterns (multi-CDN-aware)
  3. Reports all image candidates sorted by file size

Usage:
  python3 scripts/og_probe.py trigger.dev
  python3 scripts/og_probe.py miyagilabs.ai trychannel3.com
  python3 scripts/og_probe.py example.com --download /tmp/best.bin

Output: human-readable report to stdout, including:
  - og:image meta value (if any)
  - All image candidates with type, size, source

Cron mode safe: pure urllib, no execute_code.

Replaces the ad-hoc OG path probing loop that was rewritten in every session
(seen in Sonarly, Sequel, Skip, Lume, One/Pica, and now Trigger.dev).
"""
import urllib.request, re, sys, argparse

OG_PATHS = [
    '/og-image.png', '/opengraph-image.png', '/og.png', '/social-card.png',
    '/cover.png', '/thumbnail.png', '/assets/og.png', '/images/og.png',
    '/og-image.jpg', '/og.jpg', '/og-image.jpeg', '/og.jpeg',
    '/og-image.webp', '/opengraph-image.jpg',
]

TIMEOUT = 8


def fetch(url, timeout=TIMEOUT):
    """GET with Googlebot UA. Returns (content_bytes, content_type_str) or (None, error_str)."""
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)'})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.read(), r.headers.get('Content-Type', 'unknown')
    except Exception as e:
        return None, str(e)[:120]


def sniff_image_type(data):
    """Return ('PNG'|'JPEG'|'WebP'|'SVG'|'HTML'|None, '.ext'|None)."""
    if not data or len(data) < 12:
        return None, None
    head = data[:12]
    if head[:8] == b'\x89PNG\r\n\x1a\n':
        return 'PNG', '.png'
    if head[:3] == b'\xff\xd8\xff':
        return 'JPEG', '.jpg'
    if head[:4] == b'RIFF' and head[8:12] == b'WEBP':
        return 'WebP', '.webp'
    if head[:4] == b'<svg' or head[:5] == b'<?xml':
        return 'SVG', '.svg'
    if head[:5] == b'<!DO' or head[:5] == b'<html':
        return 'HTML', '.html'   # SPA shell / bot detection
    return 'unknown', None


def probe_domain(domain):
    base = f"https://{domain}"
    found = []

    # 1. Parse og:image from root
    og_url = None
    content, _ = fetch(base)
    if content:
        html = content.decode('utf-8', errors='ignore')
        m = re.search(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']', html)
        if not m:
            m = re.search(r'content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']', html)
        if m:
            og_url = m.group(1)

    # 2. Try the meta-discovered URL
    if og_url:
        data, _ = fetch(og_url)
        if data:
            t, ext = sniff_image_type(data)
            if t in ('PNG', 'JPEG', 'WebP'):
                found.append({'url': og_url, 'size': len(data), 'type': t, 'source': 'og-meta'})

    # 3. Try common paths
    for path in OG_PATHS:
        data, _ = fetch(base + path)
        if data:
            t, ext = sniff_image_type(data)
            if t in ('PNG', 'JPEG', 'WebP'):
                found.append({'url': base + path, 'size': len(data), 'type': t, 'source': f'path:{path}'})

    return {
        'domain': domain,
        'og_url_from_meta': og_url,
        'candidates': sorted(found, key=lambda x: -x['size']),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('domains', nargs='+', help='One or more domains to probe')
    parser.add_argument('--download', metavar='PATH', help='Download the largest candidate to this path')
    args = parser.parse_args()

    for d in args.domains:
        result = probe_domain(d)
        print(f"=== {d} ===")
        print(f"  og:image meta: {result['og_url_from_meta']}")
        if not result['candidates']:
            print(f"  No image candidates found — fall through to MiniMax")
            continue
        for c in result['candidates']:
            print(f"  [{c['source']:25s}] {c['type']:5s} {c['size']:>7d} bytes  {c['url']}")
        if args.download and result['candidates']:
            best = result['candidates'][0]
            data, _ = fetch(best['url'])
            with open(args.download, 'wb') as f:
                f.write(data)
            print(f"  → downloaded {len(data)} bytes to {args.download}")


if __name__ == '__main__':
    main()
