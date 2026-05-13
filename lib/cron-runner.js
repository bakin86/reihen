// Standalone cron runner: `node lib/cron-runner.js`
// Imports the compiled TS lib. In dev use `tsx lib/cron-runner.ts` pattern or
// call startCronJobs() from a custom server.
require("dotenv/config");
const { startCronJobs } = require("./cron");
startCronJobs();
console.log("[reihen-cron] started");
