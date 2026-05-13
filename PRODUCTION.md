# Reihen — Production Deployment Guide

## 1. Server Requirements

- **Node.js** 18.17+ (LTS recommended)
- **MariaDB** 10.6+ (or MySQL 8+)
- **Reverse proxy**: nginx, Caddy, or Cloudflare (SSL termination + `x-forwarded-for`)
- **Process manager**: PM2 or systemd (Next.js + WebSocket server)
- **OS**: Ubuntu 22.04+ recommended

---

## 2. Environment Variables

Copy `.env.example` to `.env` and fill in production values.

### Required (app will not work without these)

| Variable | Example | Notes |
|---|---|---|
| `DATABASE_URL` | `mysql://reihen:STRONG_PASS@localhost:3306/reihen` | Dedicated DB user, NOT root |
| `JWT_SECRET` | `openssl rand -base64 48` | **Minimum 32 chars**, random. Shared between Next.js and `ws-server.js` |
| `NEXT_PUBLIC_APP_URL` | `https://reihen.mn` | No trailing slash. Used for CORS, cookies, callbacks |
| `NEXT_PUBLIC_WS_URL` | `wss://ws.reihen.mn` | WebSocket URL (must be `wss://` in prod) |

### Payment & SMS (live mode)

| Variable | Notes |
|---|---|
| `PAYMENT_MODE` | Set to `live` |
| `QPAY_USERNAME` | QPay merchant username |
| `QPAY_PASSWORD` | QPay merchant password |
| `QPAY_INVOICE_CODE` | QPay invoice code |
| `SMS_MODE` | Set to `live` |
| `SMS_GATEWAY_URL` | SMS provider endpoint |
| `SMS_API_KEY` | SMS provider API key |

### Security

| Variable | Value | Notes |
|---|---|---|
| `TRUSTED_PROXY` | `true` | **Must be `true`** behind nginx/Cloudflare, otherwise rate limiting uses wrong IP |
| `NODE_ENV` | `production` | Enables: HTTPS redirect, secure cookies, Prisma logging reduction |

### Web Push (optional)

```bash
npx web-push generate-vapid-keys
```

Set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.

---

## 3. Database Setup

```bash
# Create database and user
mysql -u root -p
```

```sql
CREATE DATABASE reihen CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'reihen'@'localhost' IDENTIFIED BY 'STRONG_PASSWORD_HERE';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, INDEX, REFERENCES ON reihen.* TO 'reihen'@'localhost';
FLUSH PRIVILEGES;
```

```bash
# Push schema
npx prisma db push --accept-data-loss   # first deploy only
# OR use migrations for subsequent deploys:
npx prisma migrate deploy
```

---

## 4. Build & Start

```bash
# Install dependencies
npm ci --omit=dev

# Generate Prisma client
npx prisma generate

# Build Next.js
npm run build

# Start both processes (PM2 recommended)
pm2 start ecosystem.config.js
```

### PM2 ecosystem file (create `ecosystem.config.js`)

```js
module.exports = {
  apps: [
    {
      name: "reihen-web",
      script: "node_modules/.bin/next",
      args: "start -p 3000",
      env: { NODE_ENV: "production" },
    },
    {
      name: "reihen-ws",
      script: "ws-server.js",
      env: { NODE_ENV: "production" },
    },
  ],
};
```

---

## 5. Nginx Config

```nginx
upstream reihen_web {
    server 127.0.0.1:3000;
}

upstream reihen_ws {
    server 127.0.0.1:3001;
}

server {
    listen 80;
    server_name reihen.mn;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name reihen.mn;

    ssl_certificate     /etc/letsencrypt/live/reihen.mn/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/reihen.mn/privkey.pem;

    # Security headers (Next.js also sets these, but double-layer is fine)
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Proxy headers — CRITICAL for rate limiting and auth
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # Main app
    location / {
        proxy_pass http://reihen_web;
    }

    # File uploads — increase limit
    location /api/upload {
        client_max_body_size 10m;
        proxy_pass http://reihen_web;
    }

    # QPay callback — allow QPay servers
    location /api/qpay/callback {
        proxy_pass http://reihen_web;
    }
}

# WebSocket server (separate subdomain or path)
server {
    listen 443 ssl http2;
    server_name ws.reihen.mn;

    ssl_certificate     /etc/letsencrypt/live/reihen.mn/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/reihen.mn/privkey.pem;

    location / {
        proxy_pass http://reihen_ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
```

```bash
# SSL certificate
sudo certbot --nginx -d reihen.mn -d ws.reihen.mn
```

---

## 6. Pre-launch Checklist

### Security
- [ ] `JWT_SECRET` is random 48+ chars (not `dev-secret-change-me`)
- [ ] `TRUSTED_PROXY=true` (behind nginx/Cloudflare)
- [ ] `NODE_ENV=production` (secure cookies, HTTPS redirect)
- [ ] Database user is NOT root, has minimal permissions
- [ ] `.env` file is NOT in git (check `.gitignore`)
- [ ] SSL certificate installed and auto-renewing
- [ ] Firewall: only 80, 443 open. DB port (3306) blocked externally

### Functionality
- [ ] `PAYMENT_MODE=live` with valid QPay credentials
- [ ] `SMS_MODE=live` with valid SMS provider credentials
- [ ] `NEXT_PUBLIC_APP_URL` matches actual domain (cookies depend on this)
- [ ] `NEXT_PUBLIC_WS_URL` uses `wss://` (not `ws://`)
- [ ] VAPID keys generated for push notifications
- [ ] `ENABLE_CRON=true` for booking expiry, seat status cleanup

### Database
- [ ] `npx prisma db push` or `npx prisma migrate deploy` ran successfully
- [ ] Backup strategy in place (daily mysqldump or equivalent)
- [ ] At least one ADMIN user exists (create via seed or direct SQL)

### Testing
- [ ] Register a new user (should set cookies, not localStorage)
- [ ] Login/logout flow works (cookies cleared on logout)
- [ ] Create a booking, verify seat status updates via WebSocket
- [ ] QPay payment flow: create invoice -> pay -> callback confirms booking
- [ ] Rate limiting works (hit `/api/auth/login` 20+ times rapidly)
- [ ] Account lockout: 5 wrong passwords -> 15 min lock
- [ ] CSRF: mutation without `x-csrf-token` header returns 403

### Monitoring
- [ ] PM2 logs: `pm2 logs reihen-web --lines 100`
- [ ] Set up log rotation (`pm2 install pm2-logrotate`)
- [ ] Monitor disk space (uploaded images)
- [ ] Set up uptime monitoring (UptimeRobot, Betterstack, etc.)

---

## 7. First Admin User

After deploying, create an admin user:

```bash
# Register normally through the app, then promote via DB:
mysql -u reihen -p reihen -e "UPDATE User SET role='ADMIN' WHERE email='admin@reihen.mn';"
```

Or use the admin API endpoint (requires existing admin):
```
PATCH /api/admin/users/{userId}/role
Body: { "role": "OWNER" }
```

---

## 8. Backup & Recovery

```bash
# Daily backup (add to crontab)
mysqldump -u reihen -p reihen > /backups/reihen-$(date +%Y%m%d).sql

# Restore
mysql -u reihen -p reihen < /backups/reihen-20260422.sql
```

---

## 9. Common Issues

| Problem | Fix |
|---|---|
| Cookies not set after login | Check `NEXT_PUBLIC_APP_URL` matches browser domain exactly |
| Rate limiting not working | Set `TRUSTED_PROXY=true`, verify nginx sends `X-Real-IP` |
| WebSocket connection fails | Check `wss://` URL, nginx upgrade headers, firewall port |
| CSRF 403 on mutations | Browser must send `x-csrf-token` header — check `credentials: "include"` in fetch |
| QPay callback not confirming | Ensure QPay can reach `NEXT_PUBLIC_APP_URL/api/qpay/callback` (public URL) |
| "dev-secret-change-me" in logs | `JWT_SECRET` env var is not set — app falls back to dev default |
