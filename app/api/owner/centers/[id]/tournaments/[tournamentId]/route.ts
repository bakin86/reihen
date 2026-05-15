import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOwner, authErrorResponse } from "@/lib/auth";
import { assertCenterOwner } from "@/lib/owner-guard";
import { processRefund } from "@/lib/payment";
import { sendPushToUser } from "@/lib/push";
import { emitTournamentUpdate } from "@/lib/socket";

const VALID_TRANSITIONS: Record<string, string[]> = {
  UPCOMING: ["REGISTRATION_CLOSED", "CANCELLED"],
  REGISTRATION_CLOSED: ["LIVE", "CANCELLED"],
  LIVE: ["COMPLETED", "CANCELLED"],
};

const updateSchema = z.object({
  name: z.string().min(2).max(128).optional(),
  description: z.string().max(2000).optional(),
  game: z.string().min(1).max(64).optional(),
  startTime: z.coerce.date().optional(),
  endTime: z.coerce.date().optional(),
  maxTeams: z.number().int().min(2).max(256).optional(),
  teamSize: z.number().int().min(1).max(10).optional(),
  entryFee: z.number().int().min(0).optional(),
  prizePool: z.number().int().min(0).optional(),
  prizeDescription: z.string().max(2000).optional(),
  rules: z.string().max(5000).optional(),
  images: z.array(z.string().url()).max(5).optional(),
  status: z.enum(["REGISTRATION_CLOSED", "LIVE", "COMPLETED", "CANCELLED"]).optional(),
});

type Params = { params: { id: string; tournamentId: string } };

// GET /api/owner/centers/[id]/tournaments/[tournamentId]
export async function GET(req: Request, { params }: Params) {
  try {
    const session = await requireOwner(req);
    await assertCenterOwner(session, params.id);

    const tournament = await prisma.tournament.findUnique({
      where: { id: params.tournamentId, centerId: params.id },
      include: {
        teams: {
          include: {
            captain: { select: { id: true, name: true, phone: true } },
            members: {
              include: { user: { select: { id: true, name: true } } },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        matches: {
          include: {
            teamA: { select: { id: true, name: true, playerNames: true } },
            teamB: { select: { id: true, name: true, playerNames: true } },
            winnerTeam: { select: { id: true, name: true } },
            stationSeat: { select: { id: true, number: true } },
          },
          orderBy: [{ round: "asc" }, { matchNumber: "asc" }],
        },
        _count: { select: { teams: true } },
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
    }

    return NextResponse.json({ tournament });
  } catch (e) {
    return authErrorResponse(e);
  }
}

// PATCH /api/owner/centers/[id]/tournaments/[tournamentId]
export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await requireOwner(req);
    await assertCenterOwner(session, params.id);

    const tournament = await prisma.tournament.findUnique({
      where: { id: params.tournamentId, centerId: params.id },
    });
    if (!tournament) {
      return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
    }

    const parsed = updateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { status: newStatus, ...fields } = parsed.data;

    // Only allow field edits when UPCOMING
    if (Object.keys(fields).length > 0 && tournament.status !== "UPCOMING") {
      return NextResponse.json(
        { error: "Can only edit tournament details while UPCOMING" },
        { status: 400 }
      );
    }

    // Validate status transition
    if (newStatus) {
      const allowed = VALID_TRANSITIONS[tournament.status];
      if (!allowed?.includes(newStatus)) {
        return NextResponse.json(
          { error: `Cannot transition from ${tournament.status} to ${newStatus}` },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.tournament.update({
      where: { id: params.tournamentId },
      data: {
        ...fields,
        ...(fields.images !== undefined ? { images: fields.images } : {}),
        ...(newStatus ? { status: newStatus } : {}),
      },
      include: { _count: { select: { teams: true } } },
    });

    // Handle cancellation — refund all paid teams
    if (newStatus === "CANCELLED") {
      const teams = await prisma.tournamentTeam.findMany({
        where: { tournamentId: params.tournamentId, paymentStatus: "PAID" },
        include: { captain: { select: { id: true } } },
      });
      for (const team of teams) {
        if (tournament.entryFee > 0) {
          await processRefund(
            team.captainId,
            tournament.entryFee,
            team.paymentMethod ?? "BALANCE",
            team.qpayPaymentId ?? undefined
          );
        }
      }
    }

    // Push notifications on status change
    if (newStatus) {
      const statusLabels: Record<string, string> = {
        REGISTRATION_CLOSED: "Бүртгэл хаагдлаа",
        LIVE: "Тэмцээн эхэллээ!",
        COMPLETED: "Тэмцээн дууслаа",
        CANCELLED: "Тэмцээн цуцлагдлаа",
      };
      const members = await prisma.tournamentMember.findMany({
        where: { team: { tournamentId: params.tournamentId } },
        select: { userId: true },
      });
      const userIds = [...new Set(members.map((m) => m.userId))];
      for (const uid of userIds) {
        sendPushToUser(uid, {
          title: statusLabels[newStatus] ?? newStatus,
          body: `${tournament.name} · ${tournament.game}`,
          tag: `tournament-${params.tournamentId}`,
        }).catch(() => {});
      }

      emitTournamentUpdate(params.id, {
        id: params.tournamentId,
        status: newStatus,
        teamCount: updated._count.teams,
      });
    }

    return NextResponse.json({ tournament: updated });
  } catch (e) {
    return authErrorResponse(e);
  }
}

// DELETE /api/owner/centers/[id]/tournaments/[tournamentId] — cancel tournament
export async function DELETE(req: Request, { params }: Params) {
  try {
    const session = await requireOwner(req);
    await assertCenterOwner(session, params.id);

    const tournament = await prisma.tournament.findUnique({
      where: { id: params.tournamentId, centerId: params.id },
      include: {
        teams: {
          where: { paymentStatus: "PAID" },
          include: { captain: { select: { id: true } } },
        },
      },
    });
    if (!tournament) {
      return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
    }
    if (tournament.status === "COMPLETED" || tournament.status === "CANCELLED") {
      return NextResponse.json({ error: "Tournament already finished" }, { status: 400 });
    }

    // Refund paid teams
    for (const team of tournament.teams) {
      if (tournament.entryFee > 0) {
        await processRefund(
          team.captainId,
          tournament.entryFee,
          team.paymentMethod ?? "BALANCE",
          team.qpayPaymentId ?? undefined
        );
      }
    }

    await prisma.tournament.update({
      where: { id: params.tournamentId },
      data: { status: "CANCELLED" },
    });

    // Notify all participants
    const members = await prisma.tournamentMember.findMany({
      where: { team: { tournamentId: params.tournamentId } },
      select: { userId: true },
    });
    for (const m of members) {
      sendPushToUser(m.userId, {
        title: "Тэмцээн цуцлагдлаа",
        body: `${tournament.name} · ${tournament.game}`,
        tag: `tournament-${params.tournamentId}`,
      }).catch(() => {});
    }

    emitTournamentUpdate(params.id, {
      id: params.tournamentId,
      status: "CANCELLED",
      teamCount: 0,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return authErrorResponse(e);
  }
}
