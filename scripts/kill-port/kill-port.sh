#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-5173}"

pids=$(lsof -ti ":${PORT}" 2>/dev/null || true)

if [ -z "$pids" ]; then
  echo "No process found on port ${PORT}"
  exit 0
fi

echo "Killing processes on port ${PORT}: ${pids}"
echo "$pids" | xargs kill -9
echo "Done"
