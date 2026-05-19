import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { cacheGet, cacheSet } from "@/lib/redis";

/**
 * GET /api/centers
 * Filters: district, priceMax, seatType, date, time, q, available, lat, lng
 * Returns: centers with open seat count, rating, distance (if lat/lng provided)
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const district = searchParams.get("district") ?? undefined;
  const minPrice = searchParams.get("minPrice");
  const maxPrice = searchParams.get("maxPrice") ?? searchParams.get("priceMax");
  const seatType = searchParams.get("seatType");
  const date = searchParams.get("date");      // YYYY-MM-DD
  const time = searchParams.get("time");      // HH (hour)
  const available = searchParams.get("available") === "true";
  const q = searchParams.get("q")?.trim();
  const userLat = searchParams.get("lat") ? Number(searchParams.get("lat")) : null;
  const userLng = searchParams.get("lng") ? Number(searchParams.get("lng")) : null;
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 50)));

  const priceWhere: any = {};
  if (minPrice) priceWhere.gte = Number(minPrice);
  if (maxPrice) priceWhere.lte = Number(maxPrice);

  const where: Prisma.PCCenterWhereInput = {
    ...(district ? { district } : {}),
    ...(q ? { OR: [{ name: { contains: q } }, { address: { contains: q } }] } : {}),
    ...(Object.keys(priceWhere).length
      ? { seatTypes: { some: { pricePerHour: priceWhere } } }
      : {}),
    ...(seatType ? { seatTypes: { some: { name: { contains: seatType } } } } : {}),
    ...(available ? { seats: { some: { status: "OPEN" as const } } } : {}),
  };

  // Cache key based on all query params — skip cache if lat/lng (personalized)
  const cacheKey = userLat === null
    ? `centers:${new URL(req.url).search}`
    : null;

  if (cacheKey) {
    const cached = await cacheGet<any>(cacheKey);
    if (cached) {
      const res = NextResponse.json(cached);
      res.headers.set("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
      res.headers.set("X-Cache", "HIT");
      return res;
    }
  }

  const centers = await prisma.pCCenter.findMany({
    where,
    include: {
      seatTypes: { select: { id: true, name: true, pricePerHour: true, peakHourPrice: true, description: true } },
      _count: { select: { seats: true, reviews: true } },
    },
    orderBy: [{ isVerified: "desc" }, { rating: "desc" }],
    skip: (page - 1) * limit,
    take: limit,
  });

  const openSeatGroups = await prisma.seat.groupBy({
    by: ["centerId"],
    where: { centerId: { in: centers.map((c) => c.id) }, status: "OPEN" },
    _count: { _all: true },
  });
  const openSeatCountByCenter = new Map(openSeatGroups.map((row) => [row.centerId, row._count._all]));

  // If date+time provided, check actual availability for that slot
  let slotAvailability: Map<string, number> | null = null;
  if (date && time) {
    const startHour = Number(time);
    const slotStart = new Date(`${date}T${String(startHour).padStart(2, "0")}:00:00`);
    const slotEnd = new Date(slotStart.getTime() + 3_600_000);

    // Find all booked seats in that slot
    const bookedSeats = await prisma.bookingSeat.findMany({
      where: {
        seat: { centerId: { in: centers.map((c) => c.id) } },
        booking: {
          status: { in: ["PENDING", "CONFIRMED"] },
          startTime: { lt: slotEnd },
          endTime: { gt: slotStart },
        },
      },
      select: { seat: { select: { centerId: true } } },
    });

    const bookedCountByCenter = new Map<string, number>();
    for (const bs of bookedSeats) {
      const cid = bs.seat.centerId;
      bookedCountByCenter.set(cid, (bookedCountByCenter.get(cid) ?? 0) + 1);
    }
    slotAvailability = bookedCountByCenter;
  }

  const shaped = centers.map((c) => {
    const totalSeats = c._count.seats;
    const openSeats = openSeatCountByCenter.get(c.id) ?? 0;

    // If checking a specific slot, use slot-based availability
    let availableSeats = openSeats;
    if (slotAvailability) {
      const bookedInSlot = slotAvailability.get(c.id) ?? 0;
      availableSeats = Math.max(0, totalSeats - bookedInSlot);
    }

    const minRate = c.seatTypes.reduce(
      (m, t) => (m === null || t.pricePerHour < m ? t.pricePerHour : m),
      null as number | null
    );

    // Distance calculation (Haversine) if user lat/lng provided
    let distance: number | null = null;
    if (userLat !== null && userLng !== null && c.lat !== null && c.lng !== null) {
      distance = haversine(userLat, userLng, c.lat, c.lng);
    }

    return {
      id: c.id,
      name: c.name,
      address: c.address,
      district: c.district,
      description: c.description,
      images: c.images,
      rating: c.rating,
      isVerified: c.isVerified,
      lat: c.lat,
      lng: c.lng,
      seatCount: totalSeats,
      reviewCount: c._count.reviews,
      availableSeats,
      minPricePerHour: minRate,
      seatTypes: c.seatTypes,
      distance, // km, null if no coords
    };
  });

  // Sort by distance if available, otherwise by rating
  if (userLat !== null && userLng !== null) {
    shaped.sort((a, b) => {
      if (a.distance === null && b.distance === null) return 0;
      if (a.distance === null) return 1;
      if (b.distance === null) return -1;
      return a.distance - b.distance;
    });
  }

  const payload = { centers: shaped, count: shaped.length, page, limit };
  if (cacheKey) await cacheSet(cacheKey, payload, 30);

  const res = NextResponse.json(payload);
  res.headers.set("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
  res.headers.set("X-Cache", "MISS");
  return res;
}

/** Haversine distance in km */
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
