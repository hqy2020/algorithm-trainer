#!/usr/bin/env bash
set -euo pipefail

# 读取端口配置
FRONTEND_PORT="${FRONTEND_PORT:-10000}"
BACKEND_PORT="${BACKEND_PORT:-10001}"

usage() {
  echo "Usage: ./run.sh [--build] [--no-browser]"
}

OPEN_BROWSER=true

if [[ "${1:-}" == "--build" ]]; then
  docker compose up -d --build
elif [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
elif [[ "${1:-}" == "--no-browser" ]]; then
  OPEN_BROWSER=false
  docker compose up -d
elif [[ -z "${1:-}" ]]; then
  docker compose up -d
else
  usage
  exit 1
fi

# 等待服务启动
echo "Waiting for services to start..."
sleep 3

echo ""
echo "Services are running:"
echo "- Frontend: http://localhost:${FRONTEND_PORT}"
echo "- Backend API: http://localhost:${BACKEND_PORT}/api/"
echo "- Django Admin: http://localhost:${BACKEND_PORT}/admin/"

LAN_IP=$(
  python3 - <<'PY'
import socket
s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
try:
    s.connect(("8.8.8.8", 80))
    print(s.getsockname()[0])
except Exception:
    print("")
finally:
    s.close()
PY
)

if [[ -n "${LAN_IP}" ]]; then
  echo "- LAN Frontend: http://${LAN_IP}:${FRONTEND_PORT}"
  echo "- LAN Backend API: http://${LAN_IP}:${BACKEND_PORT}/api/"
  echo "- LAN Django Admin: http://${LAN_IP}:${BACKEND_PORT}/admin/"
fi
echo ""
echo "Django Admin is passwordless by default (auto-login enabled)."
echo "To disable it, set ADMIN_AUTO_LOGIN=0 and restart containers."

# 自动打开浏览器
if [[ "${OPEN_BROWSER}" == "true" ]]; then
  echo ""
  echo "Opening browser..."
  if [[ "$(uname)" == "Darwin" ]]; then
    open "http://localhost:${FRONTEND_PORT}"
  elif [[ "$(uname)" == "Linux" ]]; then
    xdg-open "http://localhost:${FRONTEND_PORT}" 2>/dev/null || sensible-browser "http://localhost:${FRONTEND_PORT}" 2>/dev/null || true
  fi
fi
