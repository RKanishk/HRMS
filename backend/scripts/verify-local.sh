#!/usr/bin/env bash
set -euo pipefail
node scripts/with-local-services.mjs bash -c 'npm run db:migrate && npm run db:seed && npm run test:e2e && npm run openapi:export'
