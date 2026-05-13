import cron from "node-cron";
import { prisma } from "./prisma";
import { sendPushToUser } from "./push";
import { emitSeatUpdate, emitTournamentUpdate } from "./socket";

const TZ = process.env.TZ ?? "Asia/Ulaanbaatar";

// In-process dedup maps with TTL. For horizontal scaling, move to Redis/DB.
const TTL_2H = 2 * 60 * 60_000;
const TTL_30M = 30 * 60_000;

class TTLSet {
  private map = new Map<string, number>();
  constructor(private ttl: number) {}
  has(key: string) {
    const exp = this.map.get(key);
    if (!exp) return false;
    if (Date.now() > exp) { this.map.delete(key); return false; }
    return true;
  }
  add(key: string) { this.map.set(key, Date.now() + this.ttl); }
  cleanup() {
    const now = Date.now();
    for (const [k, exp] of this.map) {
      if (now > exp) this.map.delete(k);
    }
  }
}

const reminded1h = new TTLSet(TTL_2H);
const reminded15m = new TTLSet(TTL_30M);
const reviewRequested = new TTLSet(TTL_2H);
const favNotified = new TTLSet(TTL_30M); // dedup favorite seat-free notifications per center

export function startCronJobs() {
  if (process.env.ENABLE_CRON !== "true") return;

  cron.schedule(
    "* * * * *",
    async () => {
      const cutoff = new Date(Date.now() - 15 * 60_000);
      const expired = await prisma.booking.findMany({
        where: {
          status: "PENDING",
          paymentStatus: "UNPAID",
          paymentMethod: "QPAY",
          createdAt: { lt: cutoff },
        },
        include: {
          bookingSeats: { include: { seat: { select: { number: true } } } },
        },
        take: 100,
      });

      for (const b of expired) {
        await prisma.booking.update({
          where: { id: b.id },
          data: {
            status: "CANCELLED",
            cancelledAt: new Date(),
            cancelReason: "Payment expired",
          },
        });

        for (const bs of b.bookingSeats) {
          emitSeatUpdate(b.centerId, { id: bs.seatId, status: "OPEN", code: bs.seat.number });
        }
      }
    },
    { timezone: TZ }
  );

  // ───── No-show sweep: every 5 min ─────
  // Auto-releases ALL seats for overdue bookings
  cron.schedule(
    "*/5 * * * *",
    async () => {
      const now = new Date();
      // Cleanup expired TTL entries periodically
      reminded1h.cleanup();
      reminded15m.cleanup();
      reviewRequested.cleanup();
      favNotified.cleanup();

      const confirmed = await prisma.booking.findMany({
        where: { status: "CONFIRMED", startTime: { lte: now } },
        include: {
          center: { include: { cancelPolicy: true } },
          bookingSeats: { include: { seat: true } },
          user: true,
        },
        take: 200,
      });

      for (const b of confirmed) {
        const noShowMinutes = b.center.cancelPolicy?.noShowMinutes ?? 60;
        const cutoff = new Date(b.startTime.getTime() + noShowMinutes * 60_000);
        if (now < cutoff) continue;

        // Check if ANY seat is occupied (checked in)
        const anyOccupied = b.bookingSeats.some((bs) => bs.seat.status === "OCCUPIED");
        if (anyOccupied) continue;

        const seatIds = b.bookingSeats.map((bs) => bs.seatId);

        await prisma.$transaction([
          prisma.booking.update({
            where: { id: b.id },
            data: { status: "NOSHOW" },
          }),
          prisma.user.update({
            where: { id: b.userId },
            data: { noShowCount: { increment: 1 } },
          }),
          prisma.seat.updateMany({
            where: { id: { in: seatIds } },
            data: { status: "OPEN", freeAt: null },
          }),
        ]);

        for (const bs of b.bookingSeats) {
          emitSeatUpdate(b.centerId, { id: bs.seatId, status: "OPEN", code: bs.seat.number });
        }
        sendPushToUser(b.userId, {
          title: "Суудал суллагдлаа",
          body: `${b.code} · ${b.bookingSeats.length} суудал · ирээгүй тул цуцлагдлаа`,
          tag: b.id,
        }).catch(() => {});
      }
    },
    { timezone: TZ }
  );

  // ───── 1-hour reminder: every minute ─────
  cron.schedule(
    "* * * * *",
    async () => {
      const now = Date.now();
      const upcoming = await prisma.booking.findMany({
        where: {
          status: "CONFIRMED",
          startTime: { gte: new Date(now + 55 * 60_000), lte: new Date(now + 65 * 60_000) },
        },
        include: {
          center: { select: { name: true } },
          bookingSeats: { include: { seat: { select: { number: true } } } },
        },
        take: 200,
      });

      for (const b of upcoming) {
        if (reminded1h.has(b.id)) continue;
        reminded1h.add(b.id);
        const seatNumbers = b.bookingSeats.map((bs) => bs.seat.number).join(", ");
        sendPushToUser(b.userId, {
          title: "1 цагийн дараа тоглолт",
          body: `${b.code} · ${b.center.name} · ${seatNumbers}`,
          url: `/bookings/${b.id}`,
          tag: `reminder-1h-${b.id}`,
        }).catch(() => {});
      }
    },
    { timezone: TZ }
  );

  // ───── 15-minute warning: every minute ─────
  cron.schedule(
    "* * * * *",
    async () => {
      const now = Date.now();
      const upcoming = await prisma.booking.findMany({
        where: {
          status: "CONFIRMED",
          startTime: { gte: new Date(now + 12 * 60_000), lte: new Date(now + 18 * 60_000) },
        },
        include: {
          center: { select: { name: true, address: true } },
          bookingSeats: { include: { seat: { select: { number: true } } } },
        },
        take: 200,
      });

      for (const b of upcoming) {
        if (reminded15m.has(b.id)) continue;
        reminded15m.add(b.id);
        const seatNumbers = b.bookingSeats.map((bs) => bs.seat.number).join(", ");
        sendPushToUser(b.userId, {
          title: "15 минутын дараа!",
          body: `${b.code} · ${b.center.name} · ${seatNumbers} · Одоо явна уу!`,
          url: `/bookings/${b.id}`,
          tag: `reminder-15m-${b.id}`,
        }).catch(() => {});
      }
    },
    { timezone: TZ }
  );

  // ───── Session close + review request: every minute ─────
  cron.schedule(
    "* * * * *",
    async () => {
      const now = new Date();

      // Release seats for expired bookings
      const expiring = await prisma.booking.findMany({
        where: { status: "CONFIRMED", endTime: { lte: now } },
        include: {
          bookingSeats: { include: { seat: { select: { id: true, number: true } } } },
          center: { select: { name: true } },
        },
        take: 200,
      });

      for (const b of expiring) {
        const seatIds = b.bookingSeats.map((bs) => bs.seatId);

        await prisma.seat.updateMany({
          where: { id: { in: seatIds } },
          data: { status: "OPEN", freeAt: null },
        });

        // Accumulate totalPlayHours for the user
        await prisma.user.update({
          where: { id: b.userId },
          data: { totalPlayHours: { increment: b.hours } },
        });

        for (const bs of b.bookingSeats) {
          emitSeatUpdate(b.centerId, { id: bs.seatId, status: "OPEN", code: bs.seat.number });
        }

        // Send review request (once per booking)
        if (!reviewRequested.has(b.id)) {
          reviewRequested.add(b.id);
          sendPushToUser(b.userId, {
            title: "Тоглолт дууслаа! Үнэлгээ өгнө үү",
            body: `${b.center.name} · ${b.code} · Та сэтгэл ханамжаа хуваалцаарай`,
            url: `/centers/${b.centerId}#review`,
            tag: `review-${b.id}`,
          }).catch(() => {});
        }

        // Notify users who favorited this center (max once per 30 min per center)
        if (!favNotified.has(b.centerId)) {
          favNotified.add(b.centerId);
          const favUsers = await prisma.favoriteCenter.findMany({
            where: { centerId: b.centerId, userId: { not: b.userId } },
            select: { userId: true },
            take: 100,
          });
          const seatCount = b.bookingSeats.length;
          for (const fav of favUsers) {
            sendPushToUser(fav.userId, {
              title: `${seatCount} суудал чөлөөлөгдлөө`,
              body: `${b.center.name} · Одоо захиалаарай!`,
              url: `/centers/${b.centerId}`,
              tag: `fav-seat-${b.centerId}`,
            }).catch(() => {});
          }
        }
      }
    },
    { timezone: TZ }
  );

  // ───── Tournament auto-transitions: every minute ─────
  cron.schedule(
    "* * * * *",
    async () => {
      const now = new Date();

      // UPCOMING → LIVE when startTime passes
      const startingTournaments = await prisma.tournament.findMany({
        where: { status: "UPCOMING", startTime: { lte: now } },
        include: {
          teams: { select: { members: { select: { userId: true } } } },
          _count: { select: { teams: true } },
        },
        take: 50,
      });

      for (const t of startingTournaments) {
        await prisma.tournament.update({
          where: { id: t.id },
          data: { status: "LIVE" },
        });

        const userIds = [...new Set(t.teams.flatMap((team) => team.members.map((m) => m.userId)))];
        for (const uid of userIds) {
          sendPushToUser(uid, {
            title: "Тэмцээн эхэллээ!",
            body: `${t.name} · ${t.game}`,
            tag: `tournament-${t.id}`,
          }).catch(() => {});
        }

        emitTournamentUpdate(t.centerId, {
          id: t.id,
          status: "LIVE",
          teamCount: t._count.teams,
        });
      }

      // LIVE → COMPLETED when endTime passes
      const endingTournaments = await prisma.tournament.findMany({
        where: { status: "LIVE", endTime: { not: null, lte: now } },
        include: {
          teams: { select: { members: { select: { userId: true } } } },
          _count: { select: { teams: true } },
        },
        take: 50,
      });

      for (const t of endingTournaments) {
        await prisma.tournament.update({
          where: { id: t.id },
          data: { status: "COMPLETED" },
        });

        const userIds = [...new Set(t.teams.flatMap((team) => team.members.map((m) => m.userId)))];
        for (const uid of userIds) {
          sendPushToUser(uid, {
            title: "Тэмцээн дууслаа",
            body: `${t.name} · ${t.game}`,
            tag: `tournament-${t.id}`,
          }).catch(() => {});
        }

        emitTournamentUpdate(t.centerId, {
          id: t.id,
          status: "COMPLETED",
          teamCount: t._count.teams,
        });
      }
    },
    { timezone: TZ }
  );

  // Nightly at 03:00 — purge expired refresh tokens from DB
  cron.schedule(
    "0 3 * * *",
    async () => {
      try {
        const { count } = await prisma.refreshToken.deleteMany({
          where: { expiresAt: { lt: new Date() } },
        });
        if (count > 0) console.log(`[cron] Purged ${count} expired refresh tokens`);
      } catch (e) {
        console.error("[cron] Token cleanup failed:", e);
      }
    },
    { timezone: TZ }
  );
}
