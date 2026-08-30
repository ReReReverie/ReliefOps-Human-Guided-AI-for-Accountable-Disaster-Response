#!/bin/sh
set -eu

# Local Compose runs may omit .env.local. Generate per-container fallback
# values so env validation remains fail-closed without committing secrets.
generate_secret() {
  node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))"
}

if [ -z "${NEON_AUTH_COOKIE_SECRET:-}" ]; then
  export NEON_AUTH_COOKIE_SECRET="$(generate_secret)"
fi

if [ -z "${REPORTER_SESSION_PEPPER:-}" ]; then
  export REPORTER_SESSION_PEPPER="$(generate_secret)"
fi

export NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL:-http://localhost:3000}"
export LOCAL_DEV="${LOCAL_DEV:-true}"
export LOCAL_AUTH_BYPASS="${LOCAL_AUTH_BYPASS:-true}"
export AI_PROVIDER="${AI_PROVIDER:-mock}"

exec "$@"
