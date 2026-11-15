#!/usr/bin/env bash
# Starts the backend (http://localhost:8000) and the frontend (http://localhost:3000)
# and stops both on Ctrl+C. Run from anywhere: ./run_local.sh
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PY="$ROOT/venv/bin/python"
BACKEND_PORT=8000
FRONTEND_PORT=3000

fail=0

if [ ! -x "$PY" ]; then
  echo "Virtual environment not found at $ROOT/venv."
  echo "Create it with:"
  echo "  python3.10 -m venv venv && source venv/bin/activate && pip install -r backend/requirements-dev.txt"
  fail=1
fi

if [ ! -d "$ROOT/frontend/node_modules" ]; then
  echo "Frontend dependencies not found at $ROOT/frontend/node_modules."
  echo "Install them with:"
  echo "  cd frontend && npm install"
  fail=1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm was not found. Install Node 20 first."
  fail=1
fi

port_in_use() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

if command -v lsof >/dev/null 2>&1; then
  if port_in_use "$BACKEND_PORT"; then
    echo "Port $BACKEND_PORT is already in use, so the backend was not started."
    echo "Find the process with:  lsof -i :$BACKEND_PORT"
    fail=1
  fi
  if port_in_use "$FRONTEND_PORT"; then
    echo "Port $FRONTEND_PORT is already in use, so the frontend was not started."
    echo "Find the process with:  lsof -i :$FRONTEND_PORT"
    fail=1
  fi
fi

[ "$fail" -eq 0 ] || exit 1

# Job control gives each server its own process group, so Ctrl+C can stop
# the whole tree (npm start spawns child processes).
set -m
BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  trap - INT TERM EXIT
  echo
  echo "Stopping servers..."
  [ -n "$BACKEND_PID" ] && kill -TERM -- "-$BACKEND_PID" 2>/dev/null
  [ -n "$FRONTEND_PID" ] && kill -TERM -- "-$FRONTEND_PID" 2>/dev/null
  wait 2>/dev/null
  exit 0
}
trap cleanup INT TERM EXIT

(cd "$ROOT/backend" && exec "$PY" -m uvicorn main:app --reload --port "$BACKEND_PORT") &
BACKEND_PID=$!

(cd "$ROOT/frontend" && BROWSER=none exec npm start) &
FRONTEND_PID=$!

echo "Backend:  http://localhost:$BACKEND_PORT  (API docs: http://localhost:$BACKEND_PORT/docs)"
echo "Frontend: http://localhost:$FRONTEND_PORT"
echo "Press Ctrl+C to stop both."

# Exit when either server stops, then clean up the other.
while kill -0 "$BACKEND_PID" 2>/dev/null && kill -0 "$FRONTEND_PID" 2>/dev/null; do
  sleep 1
done
echo "A server stopped. Shutting down."
