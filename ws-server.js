// Standalone WebSocket server for real-time seat updates.
// Run alongside Next.js: `node server.js`
const http = require("http");
const { Server } = require("socket.io");
const { jwtVerify } = require("jose");

const PORT = Number(process.env.WS_PORT ?? 3001);
const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "dev-secret-change-me"
);
const ISSUER = process.env.JWT_ISSUER ?? "reihen";
const AUDIENCE = process.env.JWT_AUDIENCE ?? "reihen-users";

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ service: "reihen-ws", ok: true }));
});

const ALLOWED_ORIGIN = process.env.NEXT_PUBLIC_APP_URL || null;
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGIN ? ALLOWED_ORIGIN.split(",") : false,
    credentials: true,
  },
});

// Authenticate every connection via JWT
io.use(async (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace("Bearer ", "");
    if (!token) return next(new Error("Authentication required"));

    const { payload } = await jwtVerify(token, SECRET, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    socket.data.userId = payload.sub;
    socket.data.role = payload.role;
    next();
  } catch {
    next(new Error("Invalid or expired token"));
  }
});

const BRANCH_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;

io.on("connection", (socket) => {
  socket.on("branch:join", (id) => {
    if (typeof id === "string" && BRANCH_ID_RE.test(id)) {
      socket.join(`branch:${id}`);
    }
  });
  socket.on("branch:leave", (id) => {
    if (typeof id === "string" && BRANCH_ID_RE.test(id)) {
      socket.leave(`branch:${id}`);
    }
  });

  // Only server-side emitSeatUpdate should broadcast — clients cannot emit seat:update
  // (removed: socket.on("seat:update") listener)
});

server.listen(PORT, () => {
  console.log(`[reihen-ws] listening on :${PORT}`);
});
