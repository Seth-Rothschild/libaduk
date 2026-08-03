#!/bin/sh
set -e
npx tsc -p tsconfig.typecheck.json
errors=$(npx svelte-check --tsconfig ./jsconfig.json --threshold error --output machine 2>&1 | grep ' ERROR ' | grep -v 'stories.svelte' || true)
if [ -n "$errors" ]; then
  echo "$errors"
  exit 1
fi
