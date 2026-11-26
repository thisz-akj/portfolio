#!/usr/bin/env bash
# Start everything the portfolio needs for local development, in one go.
#
#   ./start-portfolio.sh          start all services (Ctrl+C stops the ones it started)
#   ./start-portfolio.sh status   show what's running
#
# Services:  site :3000 · assistant :8001 · DocDesk :8002 · voice :8003 · LiveKit voice agent
# Logs:      .logs/<service>.log   (tail -f .logs/site.log)
# Services already running are left alone, so it's safe to run twice.

set -uo pipefail
cd "$(dirname "$0")"
ROOT="$(pwd)"
LOGS="$ROOT/.logs"
mkdir -p "$LOGS"
export PATH="$HOME/.local/node/bin:$PATH"

c_ok=$'\e[32m'; c_warn=$'\e[33m'; c_err=$'\e[31m'; c_dim=$'\e[2m'; c_off=$'\e[0m'
ok()   { printf "  ${c_ok}✓${c_off} %s\n" "$*"; }
warn() { printf "  ${c_warn}!${c_off} %s\n" "$*"; }
err()  { printf "  ${c_err}✗${c_off} %s\n" "$*"; }

port_busy() { ss -ltn 2>/dev/null | grep -q ":$1 "; }
agent_running() { ps -eo args | grep -q "[a]gent.worker dev"; }
env_has() { grep -qE "^$1=.+" "$ROOT/.env.local" 2>/dev/null; }

# name | port (or "-") | directory | command | health URL (or "-")
SERVICES=(
  "site|3000|$ROOT|npm run dev|http://127.0.0.1:3000/"
  "assistant|8001|$ROOT/assistant|env -u PYTHONPATH .venv/bin/uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8001 --reload|http://127.0.0.1:8001/health"
  "docdesk|8002|$ROOT/docintel|env -u PYTHONPATH .venv/bin/uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8002 --reload|http://127.0.0.1:8002/health"
  "voice|8003|$ROOT/voice|env -u PYTHONPATH .venv/bin/uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8003 --reload|http://127.0.0.1:8003/health"
  "voice-agent|-|$ROOT/voice|env -u PYTHONPATH .venv/bin/python -m agent.worker dev|-"
)

is_running() {  # name port
  if [ "$2" = "-" ]; then agent_running; else port_busy "$2"; fi
}

status() {
  echo
  printf "  %-12s %-7s %s\n" "SERVICE" "PORT" "STATE"
  for s in "${SERVICES[@]}"; do
    IFS='|' read -r name port _ _ _ <<<"$s"
    if is_running "$name" "$port"; then state="${c_ok}running${c_off}"; else state="${c_dim}stopped${c_off}"; fi
    printf "  %-12s %-7s %b\n" "$name" "$port" "$state"
  done
  if port_busy 5432; then db="${c_ok}running${c_off}"; else db="${c_warn}not running${c_off}"; fi
  printf "  %-12s %-7s %b\n" "postgres" "5432" "$db"
  echo
}

if [ "${1:-}" = "status" ]; then status; exit 0; fi

echo "Portfolio — starting local services"
echo

# ── prerequisites ──
command -v node >/dev/null || { err "Node not found (expected in ~/.local/node/bin)"; exit 1; }
[ -d node_modules ] || { warn "node_modules missing — running npm install"; npm install --silent || exit 1; }
[ -f .env.local ] || warn ".env.local missing — AI features, the database and live calls will be offline"
for d in assistant docintel voice; do
  [ -x "$d/.venv/bin/python" ] || warn "$d/.venv missing — create it: cd $d && python3 -m venv .venv && env -u PYTHONPATH .venv/bin/pip install -r requirements.txt"
done
if port_busy 5432; then ok "Postgres is running (Ops Suite database)"
else warn "Postgres isn't running on :5432 — Ops Suite needs it (e.g. sudo systemctl start postgresql)"; fi
env_has GROQ_API_KEY || warn "GROQ_API_KEY not set — AI answers fall back to offline mode"
LIVEKIT_OK=1
for v in LIVEKIT_URL LIVEKIT_API_KEY LIVEKIT_API_SECRET; do env_has "$v" || LIVEKIT_OK=0; done
[ $LIVEKIT_OK = 1 ] || warn "LiveKit keys not set — live voice calls are off (sample calls still play)"
echo

# ── start ──
STARTED=()
for s in "${SERVICES[@]}"; do
  IFS='|' read -r name port dir cmd health <<<"$s"
  if is_running "$name" "$port"; then
    ok "$name already running — leaving it"
    continue
  fi
  if [ "$name" = "voice-agent" ] && [ $LIVEKIT_OK = 0 ]; then
    warn "voice-agent skipped (no LiveKit keys)"
    continue
  fi
  if [ ! -d "$dir" ] || { [ "$dir" != "$ROOT" ] && [ ! -x "$dir/.venv/bin/python" ]; }; then
    warn "$name skipped (no virtualenv in ${dir#$ROOT/})"
    continue
  fi
  # setsid: each service gets its own process group, so Ctrl+C can stop it (and its children) cleanly
  (cd "$dir" && exec setsid bash -c "$cmd" >"$LOGS/$name.log" 2>&1) &
  STARTED+=("$name:$!")
  printf "  ${c_dim}…${c_off} starting %-12s ${c_dim}(log: .logs/%s.log)${c_off}\n" "$name" "$name"
done

stop_started() {
  echo
  echo "Stopping the services this script started…"
  for entry in "${STARTED[@]}"; do
    pid="${entry#*:}"
    kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null
  done
  sleep 1
  for entry in "${STARTED[@]}"; do
    pid="${entry#*:}"
    kill -KILL -- "-$pid" 2>/dev/null || true
  done
  echo "Done."
  exit 0
}
trap stop_started INT TERM

# ── wait for health ──
if [ ${#STARTED[@]} -gt 0 ]; then
  echo
  echo "Waiting for services…"
  for s in "${SERVICES[@]}"; do
    IFS='|' read -r name port _ _ health <<<"$s"
    started=0
    for entry in "${STARTED[@]}"; do [ "${entry%%:*}" = "$name" ] && started=1; done
    [ $started = 1 ] || continue
    if [ "$health" = "-" ]; then
      for _ in $(seq 1 60); do grep -q "registered worker" "$LOGS/$name.log" 2>/dev/null && break; sleep 1; done
      if grep -q "registered worker" "$LOGS/$name.log" 2>/dev/null; then ok "$name connected to LiveKit"
      else err "$name didn't register — see .logs/$name.log"; fi
      continue
    fi
    for _ in $(seq 1 90); do curl -s -o /dev/null "$health" && break; sleep 1; done
    if curl -s -o /dev/null "$health"; then ok "$name is up on :$port"
    else err "$name didn't come up — see .logs/$name.log"; fi
  done
fi

status
echo "  Site            http://localhost:3000"
echo "  Ops Suite       http://localhost:3000/demos/ops-suite/app"
echo "  DocDesk         http://localhost:3000/demos/document-intelligence/app"
echo "  Front Desk Voice http://localhost:3000/demos/voice-ai/app"
echo "  Autopilot       http://localhost:3000/demos/autopilot/app"
echo

if [ ${#STARTED[@]} -eq 0 ]; then
  echo "Everything was already running. (./start-portfolio.sh status to check again)"
  exit 0
fi
echo "${c_dim}Logs: tail -f .logs/<service>.log · Press Ctrl+C to stop what this script started.${c_off}"
# `wait` (unlike a foreground sleep) is interrupted at once by Ctrl+C, so the trap runs immediately
while true; do sleep 3600 & wait $!; done
