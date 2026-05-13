import { prisma } from "./prisma";
import type { SubPlan } from "@prisma/client";

export const PLANS = {
  STARTER: {
    name: "STARTER",
    maxCenters: 1,
    maxSeats: 30,
    maxFloors: 1,
    maxSeatTypes: 2,
    maxTournaments: 0,
    monthlyPrice: 99_000,
    features: ["1 PC Center", "1 давхар", "2 суудлын төрөл", "30 суудал хүртэл", "Dashboard"],
  },
  PRO: {
    name: "PRO",
    maxCenters: 3,
    maxSeats: 100,
    maxFloors: 5,
    maxSeatTypes: 10,
    maxTournaments: 5,
    monthlyPrice: 249_000,
    features: ["3 PC Center", "5 давхар", "10 суудлын төрөл", "100 суудал", "Push notification", "Analytics", "5 тэмцээн"],
  },
  ENTERPRISE: {
    name: "ENTERPRISE",
    maxCenters: 999,
    maxSeats: 9999,
    maxFloors: 999,
    maxSeatTypes: 999,
    maxTournaments: 999,
    monthlyPrice: 499_000,
    features: ["Хязгааргүй Center", "Хязгааргүй давхар", "Хязгааргүй төрөл", "Хязгааргүй суудал", "Dedicated support", "Хязгааргүй тэмцээн"],
  },
} as const satisfies Record<SubPlan, { name: string; maxCenters: number; maxSeats: number; maxFloors: number; maxSeatTypes: number; maxTournaments: number; monthlyPrice: number; features: string[] }>;

export type PlanInfo = (typeof PLANS)[SubPlan];

export async function getActiveSubscription(userId: string) {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (!sub) return null;
  if (sub.status !== "ACTIVE") return null;
  if (sub.expiresAt < new Date()) {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: "EXPIRED" },
    });
    return null;
  }
  return sub;
}

export async function checkCanAddCenter(userId: string) {
  const [sub, centerCount] = await Promise.all([
    getActiveSubscription(userId),
    prisma.pCCenter.count({ where: { ownerId: userId } }),
  ]);
  if (!sub) return { allowed: false, reason: "NO_SUBSCRIPTION" as const, sub: null };
  if (centerCount >= sub.maxCenters) {
    return { allowed: false, reason: "CENTER_LIMIT" as const, sub };
  }
  return { allowed: true, reason: null, sub };
}

export async function checkCanAddSeats(userId: string) {
  const [sub, seatCount] = await Promise.all([
    getActiveSubscription(userId),
    prisma.seat.count({ where: { center: { ownerId: userId } } }),
  ]);
  if (!sub) return { allowed: false, reason: "NO_SUBSCRIPTION" as const, sub: null, current: 0 };
  if (seatCount >= sub.maxSeats) {
    return { allowed: false, reason: "SEAT_LIMIT" as const, sub, current: seatCount };
  }
  return { allowed: true, reason: null, sub, current: seatCount };
}

export async function checkCanAddFloor(userId: string, centerId: string) {
  const [sub, floorCount] = await Promise.all([
    getActiveSubscription(userId),
    prisma.floor.count({ where: { centerId } }),
  ]);
  if (!sub) return { allowed: false, reason: "NO_SUBSCRIPTION" as const, sub: null, current: 0 };
  const plan = PLANS[sub.plan];
  if (floorCount >= plan.maxFloors) {
    return { allowed: false, reason: "FLOOR_LIMIT" as const, sub, current: floorCount, max: plan.maxFloors };
  }
  return { allowed: true, reason: null, sub, current: floorCount, max: plan.maxFloors };
}

export async function checkCanAddSeatType(userId: string, centerId: string) {
  const [sub, typeCount] = await Promise.all([
    getActiveSubscription(userId),
    prisma.seatType.count({ where: { centerId } }),
  ]);
  if (!sub) return { allowed: false, reason: "NO_SUBSCRIPTION" as const, sub: null, current: 0 };
  const plan = PLANS[sub.plan];
  if (typeCount >= plan.maxSeatTypes) {
    return { allowed: false, reason: "SEAT_TYPE_LIMIT" as const, sub, current: typeCount, max: plan.maxSeatTypes };
  }
  return { allowed: true, reason: null, sub, current: typeCount, max: plan.maxSeatTypes };
}

export async function checkCanCreateTournament(userId: string, centerId: string) {
  const [sub, tournamentCount] = await Promise.all([
    getActiveSubscription(userId),
    prisma.tournament.count({
      where: { centerId, status: { in: ["UPCOMING", "REGISTRATION_CLOSED", "LIVE"] } },
    }),
  ]);
  if (!sub) return { allowed: false, reason: "NO_SUBSCRIPTION" as const, sub: null, current: 0 };
  const plan = PLANS[sub.plan];
  if (tournamentCount >= plan.maxTournaments) {
    return { allowed: false, reason: "TOURNAMENT_LIMIT" as const, sub, current: tournamentCount, max: plan.maxTournaments };
  }
  return { allowed: true, reason: null, sub, current: tournamentCount, max: plan.maxTournaments };
}
