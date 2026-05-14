import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOwner, authErrorResponse } from "@/lib/auth";
import { assertCenterOwner } from "@/lib/owner-guard";

type Params = { params: { id: string; tournamentId: string } };

const updateMatchSchema = z.object({
  matchId: z.string().min(1),
  scoreA: z.number().int().min(0).nullable().optional(),
  scoreB: z.number().int().min(0).nullable().optional(),
  winnerTeamId: z.string().nullable().optional(),
  scheduledAt: z.coerce.date().nullable().optional(),
  stationSeatId: z.string().nullable().optional(),
  status: z.enum(["PENDING", "LIVE", "COMPLETED"]).optional(),
});

const matchInclude = {
  teamA: { select: { id: true, name: true, playerNames: true } },
  teamB: { select: { id: true, name: true, playerNames: true } },
  winnerTeam: { select: { id: true, name: true } },
  stationSeat: { select: { id: true, number: true } },
} as const;

function nextPowerOfTwo(value: number) {
  let power = 1;
  while (power < value) power *= 2;
  return power;
}

async function pushWinnerToNextRound(tournamentId: string, round: number, matchNumber: number, winnerTeamId: string) {
  const nextMatch = await prisma.tournamentMatch.findUnique({
    where: {
      tournamentId_round_matchNumber: {
        tournamentId,
        round: round + 1,
        matchNumber: Math.ceil(matchNumber / 2),
      },
    },
  });
  if (!nextMatch) return;

  const slot = matchNumber % 2 === 1 ? { teamAId: winnerTeamId } : { teamBId: winnerTeamId };
  await prisma.tournamentMatch.update({
    where: { id: nextMatch.id },
    data: slot,
  });
}

async function loadMatches(tournamentId: string) {
  return prisma.tournamentMatch.findMany({
    where: { tournamentId },
    include: matchInclude,
    orderBy: [{ round: "asc" }, { matchNumber: "asc" }],
  });
}

// POST /api/owner/centers/[id]/tournaments/[tournamentId]/bracket
export async function POST(req: Request, { params }: Params) {
  try {
    const session = await requireOwner(req);
    await assertCenterOwner(session, params.id);

    const tournament = await prisma.tournament.findUnique({
      where: { id: params.tournamentId, centerId: params.id },
      include: {
        teams: {
          where: { paymentStatus: "PAID" },
          orderBy: { createdAt: "asc" },
          select: { id: true },
        },
      },
    });
    if (!tournament) {
      return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
    }
    if (tournament.teams.length < 2) {
      return NextResponse.json({ error: "At least 2 paid teams are required" }, { status: 400 });
    }

    const bracketSize = nextPowerOfTwo(tournament.teams.length);
    const rounds = Math.log2(bracketSize);
    const firstRoundMatchCount = bracketSize / 2;

    await prisma.$transaction(async (tx) => {
      await tx.tournamentMatch.deleteMany({ where: { tournamentId: params.tournamentId } });

      const createdByes: { round: number; matchNumber: number; winnerTeamId: string }[] = [];
      for (let round = 1; round <= rounds; round++) {
        const matchCount = bracketSize / Math.pow(2, round);
        for (let matchNumber = 1; matchNumber <= matchCount; matchNumber++) {
          const indexA = round === 1 ? matchNumber - 1 : -1;
          const indexB = round === 1 ? firstRoundMatchCount + matchNumber - 1 : -1;
          const teamAId = round === 1 ? tournament.teams[indexA]?.id ?? null : null;
          const teamBId = round === 1 ? tournament.teams[indexB]?.id ?? null : null;
          const isBye = round === 1 && !!teamAId && !teamBId;

          await tx.tournamentMatch.create({
            data: {
              tournamentId: params.tournamentId,
              round,
              matchNumber,
              teamAId,
              teamBId,
              winnerTeamId: isBye ? teamAId : null,
              status: isBye ? "COMPLETED" : "PENDING",
            },
          });

          if (isBye && teamAId) {
            createdByes.push({ round, matchNumber, winnerTeamId: teamAId });
          }
        }
      }

      for (const bye of createdByes) {
        const nextRound = bye.round + 1;
        const nextMatchNumber = Math.ceil(bye.matchNumber / 2);
        const slot = bye.matchNumber % 2 === 1 ? { teamAId: bye.winnerTeamId } : { teamBId: bye.winnerTeamId };
        await tx.tournamentMatch.updateMany({
          where: { tournamentId: params.tournamentId, round: nextRound, matchNumber: nextMatchNumber },
          data: slot,
        });
      }
    });

    const matches = await loadMatches(params.tournamentId);
    return NextResponse.json({ matches });
  } catch (e) {
    return authErrorResponse(e);
  }
}

// PATCH /api/owner/centers/[id]/tournaments/[tournamentId]/bracket
export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await requireOwner(req);
    await assertCenterOwner(session, params.id);

    const parsed = updateMatchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const match = await prisma.tournamentMatch.findUnique({
      where: { id: parsed.data.matchId },
      include: { tournament: { select: { centerId: true } } },
    });
    if (!match || match.tournamentId !== params.tournamentId || match.tournament.centerId !== params.id) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    const winnerTeamId = parsed.data.winnerTeamId ?? undefined;
    if (winnerTeamId && winnerTeamId !== match.teamAId && winnerTeamId !== match.teamBId) {
      return NextResponse.json({ error: "Winner must be one of the match teams" }, { status: 400 });
    }

    const updated = await prisma.tournamentMatch.update({
      where: { id: match.id },
      data: {
        ...(parsed.data.scoreA !== undefined ? { scoreA: parsed.data.scoreA } : {}),
        ...(parsed.data.scoreB !== undefined ? { scoreB: parsed.data.scoreB } : {}),
        ...(parsed.data.scheduledAt !== undefined ? { scheduledAt: parsed.data.scheduledAt } : {}),
        ...(parsed.data.stationSeatId !== undefined ? { stationSeatId: parsed.data.stationSeatId } : {}),
        ...(parsed.data.winnerTeamId !== undefined ? { winnerTeamId: parsed.data.winnerTeamId } : {}),
        status: winnerTeamId ? "COMPLETED" : parsed.data.status,
      },
      include: matchInclude,
    });

    if (winnerTeamId) {
      await pushWinnerToNextRound(params.tournamentId, match.round, match.matchNumber, winnerTeamId);
    }

    const matches = await loadMatches(params.tournamentId);
    return NextResponse.json({ match: updated, matches });
  } catch (e) {
    return authErrorResponse(e);
  }
}
