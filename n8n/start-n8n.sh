#!/usr/bin/env bash
# Start the self-hosted (open source) n8n instance.
# n8n requires Node 22 (Node 23 breaks its native modules), so this pins the
# Homebrew node@22 keg and the isolated install at ~/.n8n-runtime.
set -euo pipefail

NODE22_BIN="$(echo /opt/homebrew/Cellar/node@22/*/bin)"
if [ ! -x "$NODE22_BIN/node" ]; then
  echo "Node 22 not found. Install it with: brew install node@22" >&2
  exit 1
fi

N8N="$HOME/.n8n-runtime/node_modules/.bin/n8n"
if [ ! -x "$N8N" ]; then
  echo "n8n not installed. Install with:" >&2
  echo "  PATH=\"$NODE22_BIN:\$PATH\" npm install --prefix ~/.n8n-runtime n8n" >&2
  exit 1
fi

export PATH="$NODE22_BIN:$PATH"
export N8N_SECURE_COOKIE=false
exec "$N8N" start
