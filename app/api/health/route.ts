import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function checkDb() {
  const start = Date.now();
  await prisma.$queryRaw`SELECT 1`;
  return Date.now() - start;
}

// GET /api/health — liveness + readiness check
// Used by load balancers, container orchestrators, and uptime monitors.
export async function GET() {
  try {
    const dbMs = await checkDb();

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

// Some uptime monitors use HEAD by default. Keep this warm-up path valid too.
export async function HEAD() {
  try {
    await checkDb();
    return new Response(null, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    console.error("[health] HEAD DB check failed:", e);
    return new Response(null, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      Allow: "GET, HEAD, OPTIONS",
      "Cache-Control": "no-store",
    },
  });
}
