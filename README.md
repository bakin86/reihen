# Reihen

PC Gaming Center Booking & Management System — Mongolia.

## Stack
- Next.js 14 (App Router) + TypeScript
- Prisma ORM + MariaDB
- TailwindCSS (Swiss editorial design system)
- JWT (jose) + bcrypt (salt rounds: 12)
- express-rate-limit
- socket.io for real-time seat updates
- web-push for push notifications
- node-cron for scheduled jobs

## Setup

```bash
cp .env.example .env
npm install
npx prisma generate
npx prisma db push
npm run dev        # Next.js on :3000
npm run ws:server  # Socket server on :3001
```

## Layout
- `/app` — App Router pages & API routes
- `/prisma` — Prisma schema and migrations
- `/lib` — prisma client, auth, socket, push, cron, rate-limit
- `/components` — UI components
- `/types` — shared TS types

## Design tokens
- `--black: #0A0A0A`
- `--white: #F5F5F5`
- `--gray: #888`
- Font: Inter (900 for display)
