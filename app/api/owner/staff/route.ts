import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authErrorResponse, requireOwner } from "@/lib/auth";
import { z } from "zod";
import { sendPushToUser } from "@/lib/push";
import { normalizeIdentifier } from "@/lib/phone";

const InviteSchema = z.object({
  name: z.string().trim().min(2).max(64).optional(),
  email: z.string().trim().email().toLowerCase().optional(),
  phone: z.string().trim().min(4),
  centerId: z.string().optional(),
  canCheckin: z.boolean().optional().default(true),
  canSeatStatus: z.boolean().optional().default(true),
  canViewBookings: z.boolean().optional().default(true),
});

// GET /api/owner/staff — list staff for owner's centers
export async function GET(req: Request) {
  try {
    const session = await requireOwner(req);
    const centers = await prisma.pCCenter.findMany({
      where: session.role === "ADMIN" ? {} : { ownerId: session.sub },
      select: { id: true, name: true },
    });
    const centerIds = centers.map((c) => c.id);

    const [staffAssignments, invites, unassignedUsers] = await Promise.all([
      prisma.centerStaff.findMany({
        where: { centerId: { in: centerIds } },
        include: {
          user: { select: { id: true, name: true, phone: true, email: true } },
          center: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.staffInvite.findMany({
        where: { centerId: { in: centerIds }, usedAt: null, expiresAt: { gt: new Date() } },
        include: { center: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.findMany({
        where: {
          role: "STAFF",
          staffCenters: { none: {} },
        },
        select: { id: true, name: true, phone: true, email: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const unassignedStaff = unassignedUsers.map((u) => ({
      id: `unassigned-${u.id}`,
      canCheckin: true,
      canSeatStatus: true,
      canViewBookings: true,
      createdAt: u.createdAt,
      user: u,
      center: { id: "unassigned", name: "UNASSIGNED" },
    }));
    const staff = [...staffAssignments, ...unassignedStaff];

    return NextResponse.json({ staff, invites, centers });
  } catch (e) {
    return authErrorResponse(e);
  }
}

// POST /api/owner/staff — invite staff by phone or email
export async function POST(req: Request) {
  try {
    const session = await requireOwner(req);
    const body = await req.json();
    const data = InviteSchema.parse(body);

    const phone = normalizeIdentifier(data.phone).value;
    if (!/^\d{8,12}$/.test(phone)) {
      return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
    }

    let center: { ownerId: string; name: string } | null = null;
    if (data.centerId) {
      center = await prisma.pCCenter.findUnique({
        where: { id: data.centerId },
        select: { ownerId: true, name: true },
      });
      if (!center || (center.ownerId !== session.sub && session.role !== "ADMIN")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Check if user already exists with this phone or email
    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ phone }, ...(data.email ? [{ email: data.email }] : [])] },
      select: { id: true, name: true, email: true, phone: true, role: true },
    });

    if (existingUser && !data.centerId) {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { role: existingUser.role === "PLAYER" ? "STAFF" : existingUser.role },
      });
      return NextResponse.json({ added: true, user: existingUser });
    }

    if (existingUser) {
      const assignedCenterId = data.centerId;
      if (!assignedCenterId) {
        return NextResponse.json({ added: true, user: existingUser });
      }
      // Check if already staff at this center
      const existingStaff = await prisma.centerStaff.findUnique({
        where: { userId_centerId: { userId: existingUser.id, centerId: assignedCenterId } },
      });
      if (existingStaff) {
        return NextResponse.json({ error: "Энэ хэрэглэгч аль хэдийн ажилтан байна" }, { status: 409 });
      }

      // Directly add as staff (user exists)
      await prisma.$transaction(async (tx) => {
        await tx.centerStaff.create({
          data: {
            userId: existingUser.id,
            centerId: assignedCenterId,
            canCheckin: data.canCheckin,
            canSeatStatus: data.canSeatStatus,
            canViewBookings: data.canViewBookings,
          },
        });
        // Promote role if PLAYER
        if (existingUser.role === "PLAYER") {
          await tx.user.update({
            where: { id: existingUser.id },
            data: { role: "STAFF" },
          });
        }
      });

      if (center) {
        sendPushToUser(existingUser.id, {
          title: "Staff access granted",
          body: `${center.name} staff access granted`,
          url: "/staff",
          tag: `staff-invite-${assignedCenterId}`,
        }).catch(() => {});
      }

      return NextResponse.json({ added: true, user: existingUser });
    }

    // User doesn't exist. Clerk owns credentials, so create a STAFF shadow
    // record that links when the staff member signs in with this email.
    if (!data.name || !data.email) {
      return NextResponse.json(
        { error: "Name and email are required for a new staff account" },
        { status: 400 }
      );
    }

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: data.name!,
          email: data.email!,
          phone,
          password: "CLERK_MANAGED",
          role: "STAFF",
        },
        select: { id: true, name: true, email: true, phone: true, role: true },
      });
      if (data.centerId) {
        await tx.centerStaff.create({
          data: {
            userId: created.id,
            centerId: data.centerId,
            canCheckin: data.canCheckin,
            canSeatStatus: data.canSeatStatus,
            canViewBookings: data.canViewBookings,
          },
        });
      }
      return created;
    });

    return NextResponse.json({ created: true, added: true, user });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.errors[0].message }, { status: 400 });
    }
    return authErrorResponse(e);
  }
}
