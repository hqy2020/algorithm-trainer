#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: ./run.sh [--build]"
}

if [[ "${1:-}" == "--build" ]]; then
  docker compose up -d --build
elif [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
elif [[ -z "${1:-}" ]]; then
  docker compose up -d
else
  usage
  exit 1
fi

echo ""
echo "Services are running:"
echo "- Frontend: http://localhost:10000"
echo "- Backend API: http://localhost:10001/api/"
echo "- Django Admin: http://localhost:10001/admin/"
echo ""
echo "Django Admin is passwordless by default (auto-login enabled)."
echo "To disable it, set ADMIN_AUTO_LOGIN=0 and restart containers."
