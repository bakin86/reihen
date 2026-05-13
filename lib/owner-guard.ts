import { prisma } from "./prisma";
import { AuthError, type SessionPayload } from "./auth";

/** Ensure session user owns the given center (ADMIN bypasses). */
export async function assertCenterOwner(session: SessionPayload, centerId: string) {
  const center = await prisma.pCCenter.findUnique({
    where: { id: centerId },
    select: { ownerId: true },
  });
  if (!center) throw new AuthError("Center not found", 404);
  if (session.role !== "ADMIN" && center.ownerId !== session.sub) {
    throw new AuthError("Forbidden — not your center", 403);
  }
}

/**
 * Ensure session user has access to the center — either as owner or staff with the required permission.
 * ADMIN bypasses all checks.
 */
export async function assertCenterAccess(
  session: SessionPayload,
  centerId: string,
  permission?: "canCheckin" | "canSeatStatus" | "canViewBookings"
) {
  const center = await prisma.pCCenter.findUnique({
    where: { id: centerId },
    select: { ownerId: true },
  });
  if (!center) throw new AuthError("Center not found", 404);

  // ADMIN and owner bypass
  if (session.role === "ADMIN" || center.ownerId === session.sub) return;

  // Check staff assignment
  const staff = await prisma.centerStaff.findUnique({
    where: { userId_centerId: { userId: session.sub, centerId } },
  });
  if (!staff) throw new AuthError("Forbidden — no access to this center", 403);

  // Check specific permission if required
  if (permission && !staff[permission]) {
    throw new AuthError(`Forbidden — missing ${permission} permission`, 403);
  }
}

export async function getBookingForOwner(session: SessionPayload, bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      center: { select: { ownerId: true, name: true } },
      bookingSeats: {
        include: { seat: true },
      },
      user: { select: { id: true, name: true } },
    },
  });
  if (!booking) throw new AuthError("Booking not found", 404);
  if (session.role !== "ADMIN" && booking.center.ownerId !== session.sub) {
    throw new AuthError("Forbidden — not your center", 403);
  }
  return booking;
}

/**
 * Get booking and verify that the session user (owner or staff) has access with the given permission.
 */
export async function getBookingForStaff(
  session: SessionPayload,
  bookingId: string,
  permission?: "canCheckin" | "canSeatStatus" | "canViewBookings"
) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      center: { select: { ownerId: true, name: true } },
      bookingSeats: {
        include: { seat: true },
      },
      user: { select: { id: true, name: true } },
    },
  });
  if (!booking) throw new AuthError("Booking not found", 404);

  // Use the shared access check
  await assertCenterAccess(session, booking.centerId, permission);

  return booking;
}
