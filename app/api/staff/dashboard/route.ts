import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authErrorResponse, requireStaff } from "@/lib/auth";

// GET /api/staff/dashboard — get staff's assigned centers + today's bookings
export async function GET(req: Request) {
  try {
    const session = await requireStaff(req);

    const assignments = await prisma.centerStaff.findMany({
      where: { userId: session.sub },
      include: {
        center: {
          select: { id: true, name: true, district: true, address: true },
        },
      },
    });

    if (assignments.length === 0) {
      return NextResponse.json({ centers: [], bookings: [], seats: [] });
    }

    const centerIds = assignments.map((a) => a.centerId);
    const permissions = Object.fromEntries(
      assignments.map((a) => [a.centerId, {
        canCheckin: a.canCheckin,
        canSeatStatus: a.canSeatStatus,
        canViewBookings: a.canViewBookings,
      }])
    );

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

    // Only fetch bookings for centers where the staff member can view them
    const viewableCenterIds = assignments
      .filter((a) => a.canViewBookings)
      .map((a) => a.centerId);

    const [bookings, seats] = await Promise.all([
      viewableCenterIds.length > 0
        ? prisma.booking.findMany({
            where: {
              centerId: { in: viewableCenterIds },
              startTime: { gte: start, lt: end },
              status: { in: ["PENDING", "CONFIRMED"] },
            },
            include: {
              bookingSeats: {
                select: { seatId: true, seat: { select: { number: true, status: true } } },
              },
              user: { select: { name: true, phone: true } },
              center: { select: { id: true, name: true } },
            },
            orderBy: { startTime: "asc" },
          })
        : Promise.resolve([]),
      prisma.seat.findMany({
        where: { centerId: { in: centerIds } },
        select: { id: true, number: true, status: true, centerId: true, freeAt: true },
        orderBy: { number: "asc" },
      }),
    ]);

    return NextResponse.json({
      centers: assignments.map((a) => ({ ...a.center, permissions: permissions[a.centerId] })),
      bookings,
      seats,
    });
  } catch (e) {
    return authErrorResponse(e);
  }
}
