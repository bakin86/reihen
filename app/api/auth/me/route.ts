import { NextResponse } from "next/server";
import { authErrorResponse, getCurrentUser } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    return NextResponse.json({ user });
  } catch (e) {
    return authErrorResponse(e);
  }
}
