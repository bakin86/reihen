const DEFAULT_BASE_URL = "https://reihen.vercel.app";
const baseUrl = (process.argv[2] || process.env.WARMUP_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
const centerLimit = Number(process.env.WARMUP_CENTER_LIMIT || 8);
const concurrency = Number(process.env.WARMUP_CONCURRENCY || 4);
const timeoutMs = Number(process.env.WARMUP_TIMEOUT_MS || 15000);

const baseHeaders = {
  "User-Agent": "ReihenDefenseWarmup/1.0",
  "Accept": "application/json,text/html;q=0.9,*/*;q=0.8",
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();

  try {
    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        ...baseHeaders,
        ...(options.headers || {}),
      },
      signal: controller.signal,
      cache: "no-store",
    });
    const ms = Date.now() - started;
    const contentType = res.headers.get("content-type") || "";
    let body = null;
    if (options.method !== "HEAD") {
      const text = await res.text();
      if (contentType.includes("application/json")) {
        try {
          body = text ? JSON.parse(text) : null;
        } catch {
          body = null;
        }
      } else {
        body = text;
      }
    }
    return { path, ok: res.ok, status: res.status, ms, body, xCache: res.headers.get("x-cache") || "" };
  } catch (error) {
    return { path, ok: false, status: "ERR", ms: Date.now() - started, error: error.message };
  } finally {
    clearTimeout(timer);
  }
}

async function runQueue(items, worker) {
  const results = [];
  let index = 0;

  async function next() {
    while (index < items.length) {
      const current = items[index++];
      const result = await worker(current);
      results.push(result);
      await sleep(120);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, next));
  return results;
}

function printResult(label, result) {
  const status = String(result.status).padEnd(3, " ");
  const time = `${result.ms}ms`.padStart(7, " ");
  const mark = result.ok ? "OK " : "BAD";
  const cache = result.xCache ? `  cache=${result.xCache}` : "";
  console.log(`${mark} ${status} ${time}  ${label}${cache}`);
}

function centerName(center) {
  const idTail = String(center.id || "").slice(-6);
  return `${center.name || center.id}${idTail ? ` #${idTail}` : ""}`;
}

async function main() {
  console.log(`Warming ${baseUrl}`);
  console.log(`Centers: ${centerLimit}, concurrency: ${concurrency}, timeout: ${timeoutMs}ms`);
  console.log("");

  const firstPass = [
    { label: "HEAD /api/health", path: "/api/health", options: { method: "HEAD" } },
    { label: "GET  /api/health", path: "/api/health" },
    { label: "GET  /", path: "/" },
    { label: "GET  /events", path: "/events" },
    { label: "GET  /login", path: "/login" },
    { label: "GET  /register", path: "/register" },
    { label: "GET  /profile", path: "/profile" },
    { label: "GET  /api/centers", path: "/api/centers?limit=50" },
    { label: "GET  /api/events", path: "/api/events" },
  ];

  const firstResults = await runQueue(firstPass, async (item) => {
    const result = await fetchWithTimeout(item.path, item.options);
    printResult(item.label, result);
    return { ...item, result };
  });

  const centersResult = firstResults.find((r) => r.path.startsWith("/api/centers"))?.result;
  const centers = Array.isArray(centersResult?.body?.centers)
    ? centersResult.body.centers.slice(0, centerLimit)
    : [];

  if (centers.length === 0) {
    console.log("");
    console.log("No centers returned. Core warm-up finished, but center detail warm-up was skipped.");
  } else {
    console.log("");
    console.log(`Warming ${centers.length} center detail flows`);

    const centerRequests = centers.flatMap((center) => [
      { label: `GET  /centers/${center.id}`, path: `/centers/${center.id}` },
      { label: `GET  seats ${centerName(center)}`, path: `/api/centers/${center.id}/seats` },
      { label: `GET  reviews ${centerName(center)}`, path: `/api/centers/${center.id}/reviews` },
      { label: `GET  tournaments ${centerName(center)}`, path: `/api/centers/${center.id}/tournaments` },
    ]);

    const centerResults = await runQueue(centerRequests, async (item) => {
      const result = await fetchWithTimeout(item.path);
      printResult(item.label, result);
      return { ...item, result };
    });

    const tournamentPages = [];
    for (const item of centerResults) {
      if (!item.path.includes("/tournaments")) continue;
      const tournaments = item.result.body?.tournaments;
      if (!Array.isArray(tournaments)) continue;
      const centerId = item.path.split("/")[3];
      for (const tournament of tournaments.slice(0, 1)) {
        if (tournament?.id) {
          tournamentPages.push({
            label: `GET  tournament page ${tournament.name || tournament.id}`,
            path: `/centers/${centerId}/tournaments/${tournament.id}`,
          });
        }
      }
    }

    if (tournamentPages.length > 0) {
      console.log("");
      console.log(`Warming ${tournamentPages.length} tournament pages`);
      await runQueue(tournamentPages, async (item) => {
        const result = await fetchWithTimeout(item.path);
        printResult(item.label, result);
        return result;
      });
    }

    const cacheVerifyRequests = [
      { label: "VERIFY /api/centers", path: "/api/centers?limit=50" },
      { label: "VERIFY /api/events", path: "/api/events" },
      ...centers.map((center) => ({
        label: `VERIFY seats ${centerName(center)}`,
        path: `/api/centers/${center.id}/seats`,
      })),
    ];

    console.log("");
    console.log("Verifying Redis cache hits");
    await sleep(600);
    await runQueue(cacheVerifyRequests, async (item) => {
      const result = await fetchWithTimeout(item.path);
      printResult(item.label, result);
      return result;
    });
  }

  console.log("");
  console.log("Warm-up complete. Run this 2-3 minutes before the diploma demo.");
}

main().catch((error) => {
  console.error(`Warm-up failed: ${error.message}`);
  process.exitCode = 1;
});
