#!/bin/sh
# Prisma migrate on startup
npx prisma db push --accept-data-loss 2>/dev/null || true

# WebSocket server (background)
node ws-server.js &

# Next.js standalone server (foreground)
exec node server.js
