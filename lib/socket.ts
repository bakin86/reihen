import { Server as IOServer } from "socket.io";
import { jwtVerify } from "jose";
import type { Server as HTTPServer } from "http";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "dev-secret-change-me-min-32-chars!!"
);
const ISSUER = process.env.JWT_ISSUER ?? "reihen";
const AUDIENCE = process.env.JWT_AUDIENCE ?? "reihen-users";

// branchId must be a cuid-like string (alphanumeric, reasonable length)
const BRANCH_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;

let io: IOServer | null = null;

export function initSocket(server: HTTPServer) {
  if (io) return io;

  if (process.env.NODE_ENV === "production" && !process.env.NEXT_PUBLIC_APP_URL) {
    throw new Error("NEXT_PUBLIC_APP_URL must be set in production (required for Socket.io CORS)");
  }
  const allowedOrigin = process.env.NEXT_PUBLIC_APP_URL || null;
  io = new IOServer(server, {
    cors: {
      origin: allowedOrigin ? allowedOrigin.split(",") : false,
      credentials: true,
    },
  });

  // JWT authentication middleware
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

  io.on("connection", (socket) => {
    socket.on("branch:join", (branchId: string) => {
      if (typeof branchId === "string" && BRANCH_ID_RE.test(branchId)) {
        socket.join(`branch:${branchId}`);
      }
    });
    socket.on("branch:leave", (branchId: string) => {
      if (typeof branchId === "string" && BRANCH_ID_RE.test(branchId)) {
        socket.leave(`branch:${branchId}`);
      }
    });
  });

  return io;
}

export function emitSeatUpdate(
  branchId: string,
  seat: { id: string; status: string; code?: string; freeAt?: string | Date | null }
) {
  io?.to(`branch:${branchId}`).emit("seat:update", seat);
}

export function emitBookingUpdate(
  branchId: string,
  booking: { id: string; status: string; paymentStatus?: string; code?: string }
) {
  io?.to(`branch:${branchId}`).emit("booking:update", booking);
}

export function emitTournamentUpdate(
  branchId: string,
  tournament: { id: string; status: string; teamCount: number }
) {
  io?.to(`branch:${branchId}`).emit("tournament:update", tournament);
}

export function getIO() {
  return io;
}
