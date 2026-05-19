import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/health — liveness + readiness check
// Used by load balancers, container orchestrators, and uptime monitors.
export async function GET() {
  const start = Date.now();

  try {
    // Check DB connectivity with a lightweight query
    await prisma.$queryRaw`SELECT 1`;
    const dbMs = Date.now() - start;

    return NextResponse.json(
      {
        status: "ok",
        db: { status: "ok", latencyMs: dbMs },
        uptime: Math.floor(process.uptime()),
        version: process.env.npm_package_version ?? "unknown",
        ts: new Date().toISOString(),
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (e) {
    console.error("[health] DB check failed:", e);
    return NextResponse.json(
      {
        status: "error",
        db: { status: "unreachable" },
        ts: new Date().toISOString(),
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}
