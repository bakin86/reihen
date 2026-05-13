import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOwner, authErrorResponse } from "@/lib/auth";
import { assertCenterOwner } from "@/lib/owner-guard";
import { checkCanCreateTournament } from "@/lib/subscription";
import { sendPushToUser } from "@/lib/push";

const createSchema = z.object({
  name: z.string().min(2).max(128),
  description: z.string().max(2000).optional(),
  game: z.string().min(1).max(64),
  startTime: z.coerce.date(),
  endTime: z.coerce.date().optional(),
  maxTeams: z.number().int().min(2).max(256),
  teamSize: z.number().int().min(1).max(10).default(1),
  entryFee: z.number().int().min(0).default(0),
  prizePool: z.number().int().min(0).default(0),
  prizeDescription: z.string().max(2000).optional(),
  rules: z.string().max(5000).optional(),
  images: z.array(z.string().url()).max(5).optional(),
});

// POST /api/owner/centers/[id]/tournaments — create tournament
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireOwner(req);
    await assertCenterOwner(session, params.id);

    const check = await checkCanCreateTournament(session.sub, params.id);
    if (!check.allowed) {
      return NextResponse.json(
        {
          error: check.reason === "NO_SUBSCRIPTION"
            ? "Subscription required"
            : `Tournament limit reached (${check.current}/${check.max} on ${check.sub?.plan} plan)`,
          code: check.reason,
          redirectTo: "/owner/subscription",
        },
        { status: 403 }
      );
    }

    const parsed = createSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    if (data.startTime < new Date()) {
      return NextResponse.json({ error: "Start time must be in the future" }, { status: 400 });
    }
    if (data.endTime && data.endTime <= data.startTime) {
      return NextResponse.json({ error: "End time must be after start time" }, { status: 400 });
    }

    const tournament = await prisma.tournament.create({
      data: {
        centerId: params.id,
        name: data.name,
        description: data.description,
        game: data.game,
        startTime: data.startTime,
        endTime: data.endTime,
        maxTeams: data.maxTeams,
        teamSize: data.teamSize,
        entryFee: data.entryFee,
        prizePool: data.prizePool,
        prizeDescription: data.prizeDescription,
        rules: data.rules,
        images: data.images ?? [],
      },
      include: { _count: { select: { teams: true } } },
    });

    // Notify users who favorited this center
    const favUsers = await prisma.favoriteCenter.findMany({
      where: { centerId: params.id },
      select: { userId: true },
      take: 200,
    });
    const center = await prisma.pCCenter.findUnique({
      where: { id: params.id },
      select: { name: true },
    });
    for (const fav of favUsers) {
      sendPushToUser(fav.userId, {
        title: "Шинэ тэмцээн!",
        body: `${data.name} · ${center?.name ?? ""} · ${data.game}`,
        url: `/centers/${params.id}`,
        tag: `fav-tournament-${tournament.id}`,
      }).catch(() => {});
    }

    return NextResponse.json({ tournament }, { status: 201 });
  } catch (e) {
    return authErrorResponse(e);
  }
}

// GET /api/owner/centers/[id]/tournaments — list tournaments
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireOwner(req);
    await assertCenterOwner(session, params.id);

    const tournaments = await prisma.tournament.findMany({
      where: { centerId: params.id },
      include: { _count: { select: { teams: true } } },
      orderBy: { startTime: "desc" },
    });

    return NextResponse.json({ tournaments });
  } catch (e) {
    return authErrorResponse(e);
  }
}
