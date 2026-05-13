const baseUrl = process.env.SMOKE_URL ?? "http://127.0.0.1:3000";

async function request(path, options = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    throw new Error(`${path} returned ${res.status}: ${text.slice(0, 300)}`);
  }
  return body;
}

async function login(email, password) {
  return request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

async function authRequest(path, token) {
  return request(path, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function main() {
  const checks = [];

  const health = await request("/api/health");
  checks.push(["health", health.status === "ok" && health.db?.status === "ok"]);

  const centers = await request("/api/centers");
  checks.push(["centers", Array.isArray(centers.centers) && centers.centers.length > 0]);

  const centerId = centers.centers?.[0]?.id;
  const seats = await request(`/api/centers/${centerId}/seats`);
  checks.push(["center seats", Array.isArray(seats.seats) && seats.seats.length > 0]);

  const player = await login("batbayar@gmail.com", "player123");
  const me = await authRequest("/api/auth/me", player.token);
  checks.push(["player auth", me.user?.role === "PLAYER"]);

  const bookings = await authRequest("/api/bookings", player.token);
  checks.push(["player bookings", Array.isArray(bookings.bookings)]);

  const openSeat = seats.seats.find((seat) => seat.status === "OPEN");
  checks.push(["open seat available", Boolean(openSeat)]);
  if (openSeat) {
    const start = new Date(Date.now() + 2 * 60 * 60_000);
    start.setMinutes(0, 0, 0);
    const created = await request("/api/bookings", {
      method: "POST",
      headers: { Authorization: `Bearer ${player.token}` },
      body: JSON.stringify({
        seatIds: [openSeat.id],
        startTime: start.toISOString(),
        hours: 1,
        paymentMethod: "QPAY",
      }),
    });
    checks.push(["booking create", Boolean(created.booking?.id)]);

    const cancelled = await request(`/api/bookings/${created.booking.id}/cancel`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${player.token}` },
      body: JSON.stringify({ reason: "Smoke test cleanup" }),
    });
    checks.push(["booking cancel", cancelled.cancelled === true]);
  }

  const owner = await login("bold@reihen.mn", "owner123");
  const ownerDashboard = await authRequest("/api/owner/dashboard", owner.token);
  checks.push(["owner dashboard", Array.isArray(ownerDashboard.centerIds)]);

  const staff = await login("tulgaa@reihen.mn", "staff123");
  const staffDashboard = await authRequest("/api/staff/dashboard", staff.token);
  checks.push(["staff dashboard", Array.isArray(staffDashboard.centers)]);

  const failed = checks.filter(([, ok]) => !ok);
  for (const [name, ok] of checks) {
    console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  }
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`FAIL smoke test: ${error.message}`);
  process.exitCode = 1;
});
