import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession, authErrorResponse } from "@/lib/auth";
import { processPayment, processRefund, cancelQPayInvoice } from "@/lib/payment";
import { sendPushToUser } from "@/lib/push";
import { emitTournamentUpdate } from "@/lib/socket";

const registerSchema = z.object({
  teamName: z.string().min(1).max(64),
  playerNames: z.array(z.string().min(1).max(40)).max(10).optional(),
  paymentMethod: z.enum(["QPAY", "BALANCE"]).optional(),
});

// POST /api/tournaments/[id]/register — register for tournament
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession(req);

    const tournament = await prisma.tournament.findUnique({
      where: { id: params.id },
      include: {
        _count: { select: { teams: true } },
        center: { select: { ownerId: true, name: true } },
      },
    });
    if (!tournament) {
      return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
    }
    if (tournament.status !== "UPCOMING") {
      return NextResponse.json({ error: "Registration is closed" }, { status: 400 });
    }
    if (tournament._count.teams >= tournament.maxTeams) {
      return NextResponse.json({ error: "Tournament is full" }, { status: 400 });
    }

    // Check if user already registered
    const existing = await prisma.tournamentTeam.findUnique({
      where: { tournamentId_captainId: { tournamentId: params.id, captainId: session.sub } },
    });
    if (existing) {
      return NextResponse.json({ error: "Already registered" }, { status: 409 });
    }

    const parsed = registerSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { teamName, paymentMethod } = parsed.data;
    const currentUser = await prisma.user.findUnique({
      where: { id: session.sub },
      select: { name: true },
    });
    const playerNames = Array.from(
      new Set(
        (parsed.data.playerNames ?? [])
          .map((name) => name.trim())
          .filter(Boolean)
      )
    ).slice(0, tournament.teamSize);
    if (playerNames.length === 0) {
      playerNames.push(currentUser?.name ?? teamName);
    }

    // Handle entry fee payment
    let paymentRef: string | null = null;
    let paymentStatus: "PAID" | "UNPAID" = "UNPAID";
    let paymentResult: Awaited<ReturnType<typeof processPayment>> | null = null;

    if (tournament.entryFee > 0) {
      const method = paymentMethod ?? "BALANCE";
      const payment = await processPayment(
        session.sub,
        tournament.entryFee,
        method,
        `TRN-${tournament.id.slice(-6)}`
      );
      if (!payment.ok) {
        return NextResponse.json(
          { error: payment.error ?? "Payment failed" },
          { status: 402 }
        );
      }
      paymentRef = payment.reference;
      paymentStatus = payment.pending ? "UNPAID" : "PAID";
      paymentResult = payment;
    } else {
      paymentStatus = "PAID"; // Free tournament
    }

    let team;
    try {
      team = await prisma.$transaction(
        async (tx) => {
          const [teamCount, alreadyRegistered] = await Promise.all([
            tx.tournamentTeam.count({ where: { tournamentId: params.id } }),
            tx.tournamentTeam.findUnique({
              where: { tournamentId_captainId: { tournamentId: params.id, captainId: session.sub } },
              select: { id: true },
            }),
          ]);
          if (alreadyRegistered) throw new Error("ALREADY_REGISTERED");
          if (teamCount >= tournament.maxTeams) throw new Error("TOURNAMENT_FULL");

          return tx.tournamentTeam.create({
            data: {
              tournamentId: params.id,
              name: teamName,
              playerNames,
              captainId: session.sub,
              paymentMethod: tournament.entryFee > 0 ? (paymentMethod ?? "BALANCE") : null,
              paymentRef,
              paymentStatus,
              members: {
                create: { userId: session.sub },
              },
            },
            include: {
              members: { include: { user: { select: { id: true, name: true } } } },
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } catch (e: any) {
      if (tournament.entryFee > 0 && paymentStatus === "PAID") {
        await processRefund(session.sub, tournament.entryFee, paymentMethod ?? "BALANCE").catch(() => {});
      } else if (tournament.entryFee > 0 && paymentResult?.invoiceId) {
        await cancelQPayInvoice(paymentResult.invoiceId).catch(() => {});
      }
      if (e?.message === "ALREADY_REGISTERED") {
        return NextResponse.json({ error: "Already registered" }, { status: 409 });
      }
      if (e?.message === "TOURNAMENT_FULL") {
        return NextResponse.json({ error: "Tournament is full" }, { status: 400 });
      }
      throw e;
    }

    // Notify center owner
    sendPushToUser(tournament.center.ownerId, {
      title: "Тэмцээнд бүртгэл",
      body: `${teamName} · ${tournament.name}`,
      tag: `tournament-reg-${team.id}`,
    }).catch(() => {});

    emitTournamentUpdate(tournament.centerId, {
      id: params.id,
      status: tournament.status,
      teamCount: tournament._count.teams + 1,
    });

    return NextResponse.json({ team, payment: paymentResult }, { status: 201 });
  } catch (e) {
    return authErrorResponse(e);
  }
}

// DELETE /api/tournaments/[id]/register — unregister from tournament
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession(req);

    const tournament = await prisma.tournament.findUnique({
      where: { id: params.id },
      include: { _count: { select: { teams: true } } },
    });
    if (!tournament) {
      return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
    }
    if (tournament.status !== "UPCOMING") {
      return NextResponse.json({ error: "Cannot unregister after registration closes" }, { status: 400 });
    }

    const team = await prisma.tournamentTeam.findUnique({
      where: { tournamentId_captainId: { tournamentId: params.id, captainId: session.sub } },
    });
    if (!team) {
      return NextResponse.json({ error: "Not registered" }, { status: 404 });
    }

    // Refund entry fee — pass qpayPaymentId so live QPay refunds work
    if (tournament.entryFee > 0 && team.paymentStatus === "PAID") {
      await processRefund(
        session.sub,
        tournament.entryFee,
        team.paymentMethod ?? "BALANCE",
        team.qpayPaymentId ?? undefined
      );
    }

    await prisma.tournamentTeam.delete({ where: { id: team.id } });

    emitTournamentUpdate(tournament.centerId, {
      id: params.id,
      status: tournament.status,
      teamCount: tournament._count.teams - 1,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return authErrorResponse(e);
  }
}
