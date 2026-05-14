import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { maskName } from "@/lib/booking-code";
import { cacheGet, cacheSet } from "@/lib/redis";

export const SEATS_CACHE_TTL = 10; // seconds
export const seatsCacheKey = (centerId: string) => `seats:${centerId}`;

// GET /api/centers/:id/seats — seats with status, freeAt, masked user name, peak pricing
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const cacheKey = seatsCacheKey(params.id);
  const cached = await cacheGet<any>(cacheKey);
  if (cached) {
    const res = NextResponse.json(cached);
    res.headers.set("Cache-Control", "public, max-age=10, stale-while-revalidate=30");
    res.headers.set("X-Cache", "HIT");
    return res;
  }

  const center = await prisma.pCCenter.findUnique({
    where: { id: params.id },
    select: {
      id: true, name: true, images: true, district: true,
      address: true, description: true, rating: true, lat: true, lng: true,
      seatTypes: { select: { id: true, name: true, pricePerHour: true, peakHourPrice: true } },
      cancelPolicy: { select: { maxSeatsPerBooking: true, noShowMinutes: true, cancelMinutes: true } },
      _count: { select: { reviews: true } },
    },
  });
  if (!center) return NextResponse.json({ error: "Center not found" }, { status: 404 });

  const seats = await prisma.seat.findMany({
    where: { centerId: params.id },
    include: {
      floor: { select: { id: true, floorNumber: true, name: true } },
      type: { select: { id: true, name: true, pricePerHour: true, peakHourPrice: true } },
    },
    orderBy: [{ floor: { floorNumber: "asc" } }, { number: "asc" }],
  });

  const now = new Date();
  const currentHour = now.getHours();
  const isPeakHour = currentHour >= 18 && currentHour < 23;

  const seatIds = seats.map((s) => s.id);
  const activeBookingSeats = await prisma.bookingSeat.findMany({
    where: {
      seatId: { in: seatIds },
      booking: {
        status: { in: ["CONFIRMED", "PENDING"] },
        startTime: { lte: now },
        endTime: { gt: now },
      },
    },
    include: {
      booking: {
        select: {
          endTime: true,
          user: { select: { name: true } },
        },
      },
    },
  });
  const activeBySeat = new Map(activeBookingSeats.map((bs) => [bs.seatId, bs.booking]));

  const shaped = seats.map((s) => {
    const active = activeBySeat.get(s.id);
    const effectivePrice = (isPeakHour && s.type.peakHourPrice)
      ? s.type.peakHourPrice
      : s.type.pricePerHour;

    return {
      id: s.id,
      number: s.number,
      status: s.status,
      freeAt: active?.endTime ?? s.freeAt,
      floor: s.floor,
      type: {
        ...s.type,
        effectivePrice,
        isPeakPrice: isPeakHour && !!s.type.peakHourPrice,
      },
      posX: s.posX,
      posY: s.posY,
      currentUser: active ? { maskedName: maskName(active.user.name) } : null,
    };
  });

  const { _count, cancelPolicy, ...centerData } = center;
  const payload = {
    center: {
      ...centerData,
      reviewCount: _count.reviews,
      maxSeatsPerBooking: cancelPolicy?.maxSeatsPerBooking ?? 10,
      noShowMinutes: cancelPolicy?.noShowMinutes ?? 15,
      cancelMinutes: cancelPolicy?.cancelMinutes ?? 30,
    },
    seats: shaped,
    isPeakHour,
    qpaySurchargePct: Number(process.env.QPAY_SURCHARGE_PCT ?? 1),
  };

  await cacheSet(cacheKey, payload, SEATS_CACHE_TTL);

  const res = NextResponse.json(payload);
  res.headers.set("Cache-Control", "public, max-age=10, stale-while-revalidate=30");
  res.headers.set("X-Cache", "MISS");
  return res;
}
