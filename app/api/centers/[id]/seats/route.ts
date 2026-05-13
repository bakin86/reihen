import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { maskName } from "@/lib/booking-code";

// GET /api/centers/:id/seats — seats with status, freeAt, masked user name, peak pricing
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const center = await prisma.pCCenter.findUnique({
    where: { id: params.id },
    select: {
      id: true, name: true, images: true, district: true,
      address: true, description: true, rating: true, lat: true, lng: true,
      seatTypes: { select: { id: true, name: true, pricePerHour: true, peakHourPrice: true } },
      cancelPolicy: { select: { maxSeatsPerBooking: true } },
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

  // Find active bookings for all seats via BookingSeat
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
  const res = NextResponse.json({
    center: { ...centerData, reviewCount: _count.reviews, maxSeatsPerBooking: cancelPolicy?.maxSeatsPerBooking ?? 10 },
    seats: shaped,
    isPeakHour,
  });
  // Short cache — seats change frequently but benefit from dedup within 10s
  res.headers.set("Cache-Control", "public, max-age=10, stale-while-revalidate=30");
  return res;
}
