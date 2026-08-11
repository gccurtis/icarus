#!/usr/bin/env bash
# Local dev setup: register a dev account against a running core, so you can sign
# in and exercise the app without a seeded user. The core generates a self-signed
# certificate in dev mode, so we pass curl -k to accept it.
#
# Usage:
#   1. Start the core in dev mode:  go run ./core
#   2. In another terminal:         ./scripts/dev-setup.sh
#
# Override the target or credentials with BASE_URL / DEV_EMAIL / DEV_PASSWORD.

set -euo pipefail

BASE_URL="${BASE_URL:-https://127.0.0.1:8443}"
EMAIL="${DEV_EMAIL:-dev@taurus.local}"
PASSWORD="${DEV_PASSWORD:-devpassword}"

echo "Registering dev user $EMAIL at $BASE_URL ..."
resp="$(mktemp)"
code="$(curl -sk -o "$resp" -w '%{http_code}' -X POST "$BASE_URL/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")"

case "$code" in
  201) echo "✓ created dev user $EMAIL" ;;
  409) echo "✓ dev user $EMAIL already exists" ;;
  *)   echo "✗ unexpected status $code: $(cat "$resp")"; rm -f "$resp"; exit 1 ;;
esac
rm -f "$resp"

echo
echo "Sign in with:"
echo "  curl -k -c cookies.txt -X POST $BASE_URL/auth/login \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}'"
