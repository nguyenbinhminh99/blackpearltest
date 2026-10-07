#!/bin/sh
set -e
npx prisma migrate deploy
if [ "${AUTO_IMPORT:-1}" = "1" ]; then
  echo "Import batch_1 rồi batch_2..."
  node dist/cli.js data/batch_1.json data/batch_2.json --export
fi
exec node dist/main.js
