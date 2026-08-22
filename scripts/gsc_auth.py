#!/usr/bin/env python3
"""Re-authorize the runany.dev Google Search Console OAuth client.

The GSC refresh token expires when the user revokes access, when 6 months
of inactivity pass, or when the OAuth consent screen scope changes. The
last working token expired 2026-06-09 (per project memory). This script
runs the standard Google OAuth 2.0 loopback flow and writes the new
refresh token to .env so downstream scripts (searchanalytics, sitemaps,
index coverage) can use it.

Prerequisites:
- ~/client_secret_*.apps.googleusercontent.com.json must exist
- runany.dev must already be a verified property in the Google account
  that grants consent (the account that owns sc-domain:runany.dev)

Usage:
    python3 scripts/gsc_auth.py            # interactive, opens browser
    python3 scripts/gsc_auth.py --no-open  # print URL, copy-paste manually
    python3 scripts/gsc_auth.py --test     # after auth, list sites + recent queries
"""
import argparse
import glob
import http.server
import json
import os
import socket
import sys
import urllib.parse
import urllib.request
import webbrowser
from pathlib import Path

# Project GSC property (sc-domain matches the runany.dev setup).
DEFAULT_PROPERTY = "sc-domain:runany.dev"

# Read-only GSC scope is enough for search analytics, sitemap inspection,
# and index coverage checks. Use a different scope only if the user needs
# to mutate sitemaps or settings.
DEFAULT_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly"

ENV_PATH = Path(__file__).resolve().parent.parent / ".env"


def find_client_secret() -> dict:
    candidates = sorted(glob.glob(os.path.expanduser("~/client_secret_*.json")))
    if not candidates:
        print("error: no client_secret_*.json found in $HOME", file=sys.stderr)
        sys.exit(1)
    with open(candidates[0]) as f:
        return json.load(f)["installed"]


def pick_port() -> int:
    """Pick a free localhost port for the loopback redirect."""
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


def build_auth_url(client_id: str, redirect_uri: str, scope: str) -> str:
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "scope": scope,
        "response_type": "code",
        "access_type": "offline",
        "prompt": "consent",  # force re-issue of refresh_token
        "include_granted_scopes": "true",
    }
    return "https://accounts.google.com/o/oauth2/auth?" + urllib.parse.urlencode(params)


def exchange_code(client: dict, code: str, redirect_uri: str) -> dict:
    data = urllib.parse.urlencode({
        "client_id": client["client_id"],
        "client_secret": client["client_secret"],
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": redirect_uri,
    }).encode()
    req = urllib.request.Request(client["token_uri"], data=data, method="POST")
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read())


def capture_code(port: int) -> str:
    """Run a one-shot HTTP server that captures ?code=... from Google."""
    captured: dict = {}

    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            qs = urllib.parse.urlparse(self.path).query
            params = urllib.parse.parse_qs(qs)
            if "code" in params:
                captured["code"] = params["code"][0]
                body = (
                    "<!doctype html><meta charset=utf-8>"
                    "<h1 style='font-family:system-ui'>GSC auth complete</h1>"
                    "<p>You can close this tab. The terminal will continue.</p>"
                )
            else:
                err = params.get("error", ["unknown"])[0]
                captured["error"] = err
                body = (
                    "<!doctype html><meta charset=utf-8>"
                    f"<h1 style='font-family:system-ui;color:#c00'>Auth failed: {err}</h1>"
                )
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(body.encode())

        def log_message(self, *a, **kw):
            pass  # silence access log

    server = http.server.HTTPServer(("127.0.0.1", port), Handler)
    server.handle_request()
    if "error" in captured:
        raise RuntimeError(f"OAuth error from Google: {captured['error']}")
    return captured.get("code", "")


def write_env_token(refresh_token: str) -> None:
    """Persist GSC_REFRESH_TOKEN=... to .env (preserve other lines)."""
    if not ENV_PATH.exists():
        ENV_PATH.touch()
        ENV_PATH.chmod(0o600)
    lines = ENV_PATH.read_text().splitlines()
    out = []
    replaced = False
    for line in lines:
        if line.startswith("GSC_REFRESH_TOKEN="):
            out.append(f"GSC_REFRESH_TOKEN={refresh_token}")
            replaced = True
        else:
            out.append(line)
    if not replaced:
        out.append(f"GSC_REFRESH_TOKEN={refresh_token}")
    ENV_PATH.write_text("\n".join(out) + "\n")
    ENV_PATH.chmod(0o600)


def test_token(refresh_token: str, client: dict, property_url: str) -> None:
    """Refresh the access token, then list sites + one searchanalytics row."""
    data = urllib.parse.urlencode({
        "client_id": client["client_id"],
        "client_secret": client["client_secret"],
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    }).encode()
    req = urllib.request.Request(client["token_uri"], data=data, method="POST")
    with urllib.request.urlopen(req, timeout=15) as r:
        access = json.loads(r.read())["access_token"]
    headers = {"Authorization": f"Bearer {access}"}

    print("\n--- sites.list ---")
    req = urllib.request.Request(
        "https://www.googleapis.com/webmasters/v3/sites",
        headers=headers,
    )
    with urllib.request.urlopen(req, timeout=15) as r:
        for entry in json.loads(r.read()).get("siteEntry", []):
            print(f"  {entry['siteUrl']}  permission={entry.get('permissionLevel')}")

    print(f"\n--- searchanalytics.query ({property_url}, last 7d) ---")
    body = json.dumps({
        "startDate": "2026-08-15",
        "endDate": "2026-08-22",
        "dimensions": ["query"],
        "rowLimit": 5,
    }).encode()
    req = urllib.request.Request(
        f"https://www.googleapis.com/webmasters/v3/sites/{urllib.parse.quote(property_url, safe='')}/searchAnalytics/query",
        data=body,
        headers={**headers, "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as r:
        rows = json.loads(r.read()).get("rows", [])
    if not rows:
        print("  (no data — either no traffic in range, or property not yet verified for this scope)")
    for row in rows:
        print(f"  {row['keys'][0]:<40} clicks={row['clicks']} impr={row['impressions']} pos={row['position']:.1f}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--no-open", action="store_true",
                        help="Don't auto-open browser; print URL for manual visit")
    parser.add_argument("--scope", default=DEFAULT_SCOPE,
                        help=f"OAuth scope (default: {DEFAULT_SCOPE})")
    parser.add_argument("--property", default=DEFAULT_PROPERTY,
                        help=f"GSC property to test (default: {DEFAULT_PROPERTY})")
    parser.add_argument("--test", action="store_true",
                        help="Skip auth, just test existing GSC_REFRESH_TOKEN in .env")
    args = parser.parse_args()

    client = find_client_secret()
    print(f"Using client_id: {client['client_id']}")
    print(f"Project:        {client['project_id']}")
    print(f"Scope:          {args.scope}")
    print(f"Property:       {args.property}")

    if args.test:
        if not ENV_PATH.exists() or "GSC_REFRESH_TOKEN=" not in ENV_PATH.read_text():
            print("error: GSC_REFRESH_TOKEN not found in .env", file=sys.stderr)
            return 1
        for line in ENV_PATH.read_text().splitlines():
            if line.startswith("GSC_REFRESH_TOKEN="):
                test_token(line.split("=", 1)[1], client, args.property)
                return 0

    port = pick_port()
    redirect_uri = f"http://localhost:{port}"
    auth_url = build_auth_url(client["client_id"], redirect_uri, args.scope)
    print(f"\nLoopback redirect: {redirect_uri}")
    print(f"Auth URL (length {len(auth_url)} chars):")
    print(f"  {auth_url}\n")
    if not args.no_open:
        print("Opening browser...")
        webbrowser.open(auth_url)
    else:
        print("Copy the URL above into a browser, then come back here.")

    print("Waiting for Google to redirect with the auth code...")
    code = capture_code(port)
    if not code:
        print("error: no code received", file=sys.stderr)
        return 1
    print(f"Got code (len={len(code)}). Exchanging for tokens...")

    token = exchange_code(client, code, redirect_uri)
    if "error" in token:
        print(f"error: {token['error']}: {token.get('error_description', '')}", file=sys.stderr)
        return 1

    refresh = token.get("refresh_token")
    if not refresh:
        print("error: no refresh_token in response (try --no-open + re-add `prompt=consent`)", file=sys.stderr)
        print(f"Full response: {token}", file=sys.stderr)
        return 1

    print(f"Got refresh_token (len={len(refresh)}). Saving to {ENV_PATH}...")
    write_env_token(refresh)
    print(f"✓ GSC_REFRESH_TOKEN written (file mode 600).")
    print()
    test_token(refresh, client, args.property)
    return 0


if __name__ == "__main__":
    sys.exit(main())
