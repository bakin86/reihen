// PM2 process manager config — manages both Next.js and the WebSocket server.
//
// Usage:
//   npm install -g pm2
//   pm2 start ecosystem.config.js --env production
//   pm2 save          # persist process list across reboots
//   pm2 startup       # generate OS startup script
//   pm2 logs          # tail all logs
//   pm2 monit         # live dashboard

module.exports = {
  apps: [
    {
      name: "reihen-web",
      script: "scripts/start-standalone.js",
      cwd: "./",
      instances: 1,           // increase for multi-core (requires Redis rate limiter)
      exec_mode: "fork",      // use "cluster" if instances > 1
      watch: false,
      max_memory_restart: "512M",
      restart_delay: 2000,
      env: {
        NODE_ENV: "development",
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      error_file: "logs/web-error.log",
      out_file: "logs/web-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
    {
      name: "reihen-ws",
      script: "ws-server.js",
      cwd: "./",
      instances: 1,           // must stay 1 — Socket.io rooms are in-memory
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "256M",
      restart_delay: 1000,
      env: {
        NODE_ENV: "development",
        WS_PORT: 3001,
      },
      env_production: {
        NODE_ENV: "production",
        WS_PORT: 3001,
      },
      error_file: "logs/ws-error.log",
      out_file: "logs/ws-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};
