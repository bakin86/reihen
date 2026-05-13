#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
# Reihen Security Test Suite
# Requires: curl, node
# Usage:
#   npm run dev        (terminal 1)
#   node ws-server.js     (terminal 2)
#   bash test-security.sh   (terminal 3 / Claude Code)
#
# Auth rate limit = 5 req / 15 min (in-memory).
# Restart dev server between runs to reset.
# ─────────────────────────────────────────────────────────

set -uo pipefail

BASE="${BASE_URL:-http://localhost:3000}"
WS="${WS_URL:-http://localhost:3001}"
COOKIES=$(mktemp)
PASS=0
FAIL=0
SKIP=0

EMAIL="sectest-$(date +%s)@test.com"
PASSWORD="Test1234"
PHONE="99$(shuf -i 100000-999999 -n 1)"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; CYAN='\033[0;36m'; NC='\033[0m'
pass() { ((PASS++)); echo -e "  ${GREEN}PASS${NC} $1"; }
fail() { ((FAIL++)); echo -e "  ${RED}FAIL${NC} $1 — $2"; }
skip() { ((SKIP++)); echo -e "  ${YELLOW}SKIP${NC} $1 — $2"; }
header() { echo -e "\n${CYAN}[$1]${NC}"; }
status() { curl -s -o /dev/null -w "%{http_code}" "$@"; }
json_get() { node -e "try{const o=JSON.parse(process.argv[2]);process.stdout.write(String(o[process.argv[1]]||''))}catch{}" -- "$1" "$2"; }

# ══════════════════════════════════════════════════════════
header "0. Setup — Register test user"
# Uses 1 auth request
# ══════════════════════════════════════════════════════════

REG_RES=$(curl -s -c "$COOKIES" -X POST "$BASE/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Security Tester\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"phone\":\"$PHONE\"}")

TOKEN=$(json_get token "$REG_RES")
REFRESH=$(json_get refreshToken "$REG_RES")
CSRF=$(json_get csrfToken "$REG_RES")

if [[ -z "$TOKEN" ]]; then
  echo -e "${RED}Setup failed: $(json_get error "$REG_RES")${NC}"
  echo -e "${YELLOW}Restart dev server to reset rate limits, then re-run.${NC}"
  rm -f "$COOKIES"; exit 1
fi
echo "  Registered. Token + cookies acquired. (1/5 auth requests used)"

# ══════════════════════════════════════════════════════════
# SECTION A: Tests using Bearer token (no auth rate limit cost)
# ══════════════════════════════════════════════════════════

header "1. JWT Tampering"
# Use /api/bookings (GET) instead of /api/auth/me to avoid auth rate limit
# /api/bookings requires auth but falls under api: rate limit (100/min)

CODE=$(status "$BASE/api/bookings/history" -H "Authorization: Bearer $TOKEN")
[[ "$CODE" == "200" ]] && pass "Valid token accepted (200)" || fail "Valid token" "expected 200, got $CODE"

BAD="${TOKEN:0:-2}XX"
CODE=$(status "$BASE/api/bookings/history" -H "Authorization: Bearer $BAD")
[[ "$CODE" == "401" ]] && pass "Tampered token rejected (401)" || fail "Tampered token" "expected 401, got $CODE"

CODE=$(status "$BASE/api/bookings/history")
[[ "$CODE" == "401" ]] && pass "No token rejected (401)" || fail "No token" "expected 401, got $CODE"

CODE=$(status "$BASE/api/bookings/history" -H "Authorization: Bearer ")
[[ "$CODE" == "401" ]] && pass "Empty bearer rejected (401)" || fail "Empty bearer" "expected 401, got $CODE"

# ─────────────────────────────────────────────────────────
header "2. CSRF Protection"

CODE=$(status -X POST "$BASE/api/bookings" -b "$COOKIES" \
  -H "Content-Type: application/json" \
  -d '{"centerId":"x","seatIds":["x"],"startTime":"2099-01-01T00:00:00Z","endTime":"2099-01-01T01:00:00Z"}')
[[ "$CODE" == "403" ]] && pass "No CSRF header → blocked (403)" || fail "CSRF missing" "expected 403, got $CODE"

CODE=$(status -X POST "$BASE/api/bookings" -b "$COOKIES" \
  -H "Content-Type: application/json" -H "x-csrf-token: wrong" \
  -d '{"centerId":"x","seatIds":["x"],"startTime":"2099-01-01T00:00:00Z","endTime":"2099-01-01T01:00:00Z"}')
[[ "$CODE" == "403" ]] && pass "Wrong CSRF header → blocked (403)" || fail "CSRF wrong" "expected 403, got $CODE"

CODE=$(status -X POST "$BASE/api/bookings" -b "$COOKIES" \
  -H "Content-Type: application/json" -H "x-csrf-token: $CSRF" \
  -d '{"centerId":"x","seatIds":["x"],"startTime":"2099-01-01T00:00:00Z","endTime":"2099-01-01T01:00:00Z"}')
[[ "$CODE" != "403" ]] && pass "Correct CSRF → passes check ($CODE)" || fail "CSRF correct" "still 403"

CODE=$(status -X POST "$BASE/api/bookings" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"centerId":"x","seatIds":["x"],"startTime":"2099-01-01T00:00:00Z","endTime":"2099-01-01T01:00:00Z"}')
[[ "$CODE" != "403" ]] && pass "Bearer auth skips CSRF ($CODE)" || fail "Bearer CSRF" "got 403"

# ─────────────────────────────────────────────────────────
header "3. Role Escalation"

CODE=$(status -X PATCH "$BASE/api/admin/users/fakeid/role" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"role":"ADMIN"}')
[[ "$CODE" == "403" ]] && pass "Player → admin endpoint blocked (403)" || fail "Admin escalation" "expected 403, got $CODE"

CODE=$(status "$BASE/api/owner/dashboard" -H "Authorization: Bearer $TOKEN")
[[ "$CODE" == "403" ]] && pass "Player → owner endpoint blocked (403)" || fail "Owner escalation" "expected 403, got $CODE"

# ─────────────────────────────────────────────────────────
header "4. Input Validation"

CODE=$(status "$BASE/api/centers?q=%27%3BDROP%20TABLE%20User%3B--")
[[ "$CODE" == "200" ]] && pass "SQL injection in search harmless (200)" || fail "SQL injection" "expected 200, got $CODE"

CODE=$(status -X POST "$BASE/api/bookings" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}')
[[ "$CODE" == "400" ]] && pass "Empty booking body rejected (400)" || fail "Empty booking" "expected 400, got $CODE"

# ─────────────────────────────────────────────────────────
header "5. File Upload Spoofing"

FAKE=$(mktemp --suffix=.jpg)
echo "not an image" > "$FAKE"
CODE=$(status -X POST "$BASE/api/upload" \
  -H "Authorization: Bearer $TOKEN" -F "files=@$FAKE")
rm -f "$FAKE"

if [[ "$CODE" == "400" ]]; then pass "Fake image rejected by magic bytes (400)"
elif [[ "$CODE" == "403" ]]; then pass "Upload blocked for non-owner (403)"
else fail "Upload spoofing" "expected 400/403, got $CODE"
fi

# ─────────────────────────────────────────────────────────
header "6. Security Headers"

HDRS=$(curl -s -I "$BASE" 2>/dev/null)
chk() { echo "$HDRS" | grep -qi "$1.*$2" && pass "$1: $2" || fail "$1" "missing"; }
chk "X-Frame-Options" "DENY"
chk "X-Content-Type-Options" "nosniff"
chk "Referrer-Policy" "strict-origin-when-cross-origin"
chk "Content-Security-Policy" "default-src"

# ─────────────────────────────────────────────────────────
header "7. CORS"

CORS=$(curl -s -I -X OPTIONS "$BASE/api/centers" \
  -H "Origin: https://evil.com" -H "Access-Control-Request-Method: GET" 2>/dev/null \
  | grep -i "access-control-allow-origin" || true)
if [[ -z "$CORS" ]] || echo "$CORS" | grep -qi "localhost\|reihen"; then
  pass "Evil origin not allowed"
else
  fail "CORS" "allowed evil origin: $CORS"
fi

# ─────────────────────────────────────────────────────────
header "8. WebSocket Auth"

if command -v wscat &>/dev/null; then
  WS_OUT=$(timeout 3 wscat -c "$WS" 2>&1 || true)
  echo "$WS_OUT" | grep -qi "error\|disconnect\|auth" \
    && pass "No-token WebSocket rejected" \
    || fail "WS no auth" "not rejected"
else
  skip "WebSocket tests" "install wscat: npm i -g wscat"
fi

# ══════════════════════════════════════════════════════════
# SECTION B: Tests that consume auth rate limit (4 remaining)
# Register used 1/5. We have 4 left for: refresh(2) + timing(2)
# ══════════════════════════════════════════════════════════

header "9. Refresh Token Rotation (uses 2 auth requests)"

if [[ -n "$REFRESH" ]]; then
  # Use 1: refresh → 200
  R1=$(curl -s -X POST "$BASE/api/auth/refresh" \
    -H "Content-Type: application/json" \
    -d "{\"refreshToken\":\"$REFRESH\"}")
  R1_TK=$(json_get token "$R1")
  R1_RT=$(json_get refreshToken "$R1")
  [[ -n "$R1_TK" ]] && pass "Refresh token accepted (new token issued)" || fail "Refresh 1st use" "no token"

  # Use 2: replay same → 401
  CODE=$(status -X POST "$BASE/api/auth/refresh" \
    -H "Content-Type: application/json" \
    -d "{\"refreshToken\":\"$REFRESH\"}")
  [[ "$CODE" == "401" ]] && pass "Replayed refresh token rejected (401)" || fail "Refresh replay" "expected 401, got $CODE"
else
  skip "Refresh tests" "no refresh token"
fi

# ─────────────────────────────────────────────────────────
header "10. Logout → Token Revocation"

if [[ -n "${R1_TK:-}" && -n "${R1_RT:-}" ]]; then
  # Logout revokes all refresh tokens
  curl -s -o /dev/null -X POST "$BASE/api/auth/logout" \
    -H "Authorization: Bearer $R1_TK"

  # This hits /api/auth but the token is already deleted, so just check 401
  CODE=$(status -X POST "$BASE/api/auth/refresh" \
    -H "Content-Type: application/json" \
    -d "{\"refreshToken\":\"$R1_RT\"}")
  [[ "$CODE" == "401" ]] && pass "Refresh revoked after logout (401)" || fail "Post-logout" "expected 401, got $CODE"
else
  skip "Logout test" "no tokens from refresh test"
fi

# ─────────────────────────────────────────────────────────
header "11. Timing Attack Resistance (uses 2 auth requests)"

T1S=$(date +%s%N)
curl -s -o /dev/null -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"wrong\"}"
T1E=$(date +%s%N)
T1=$(( (T1E - T1S) / 1000000 ))

T2S=$(date +%s%N)
curl -s -o /dev/null -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"no-such-user-xyz@nowhere.invalid","password":"wrong"}'
T2E=$(date +%s%N)
T2=$(( (T2E - T2S) / 1000000 ))

DIFF=$(( T1 > T2 ? T1 - T2 : T2 - T1 ))
echo "  Existing: ${T1}ms | Non-existing: ${T2}ms | Diff: ${DIFF}ms"
[[ "$DIFF" -lt 200 ]] && pass "Timing within threshold (<200ms)" || fail "Timing" "${DIFF}ms gap"

# ─────────────────────────────────────────────────────────
header "12. Rate Limiting"

# Auth limit is 5/15min. We used ~5 already, so next should be 429.
CODE=$(status -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"x@x.com","password":"x"}')
[[ "$CODE" == "429" ]] && pass "Auth rate limit active (429)" || fail "Rate limit" "expected 429, got $CODE"

# API rate limit (100/min) — just verify header exists
API_HDRS=$(curl -s -I "$BASE/api/centers" 2>/dev/null)
echo "$API_HDRS" | grep -qi "x-ratelimit-limit" \
  && pass "API rate limit headers present" \
  || fail "API rate headers" "X-RateLimit-Limit missing"

# ─────────────────────────────────────────────────────────
header "13. Account Lockout"

# Can't test cleanly here (rate limit exhausted). Separate run:
skip "Account lockout" "run: TEST_LOCKOUT=1 bash test-security.sh (after server restart)"

if [[ "${TEST_LOCKOUT:-}" == "1" ]]; then
  LOCK_EMAIL="lockout-$(date +%s)@test.com"
  LOCK_PHONE="88$(shuf -i 100000-999999 -n 1)"
  curl -s -o /dev/null -X POST "$BASE/api/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"Lock Test\",\"email\":\"$LOCK_EMAIL\",\"password\":\"$PASSWORD\",\"phone\":\"$LOCK_PHONE\"}"
  LOCKED=false
  for i in $(seq 1 7); do
    CODE=$(status -X POST "$BASE/api/auth/login" \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"$LOCK_EMAIL\",\"password\":\"wrong\"}")
    if [[ "$CODE" == "429" ]]; then
      LOCKED=true; pass "Locked after $i attempts (429)"; break
    fi
  done
  [[ "$LOCKED" == "false" ]] && fail "Lockout" "no 429 after 7 attempts"
fi

# ══════════════════════════════════════════════════════════
# Results
# ══════════════════════════════════════════════════════════
rm -f "$COOKIES"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  ${GREEN}PASS: $PASS${NC}  ${RED}FAIL: $FAIL${NC}  ${YELLOW}SKIP: $SKIP${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [[ "$FAIL" -gt 0 ]]; then
  echo -e "${YELLOW}Tip: restart dev server between runs to reset rate limits${NC}"
  exit 1
else
  echo -e "${GREEN}All security tests passed!${NC}"
  exit 0
fi
