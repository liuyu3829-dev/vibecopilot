import { NextResponse } from "next/server";

import { createBetaAccessCookie, desktopBetaCookieName, isAllowedInviteCode } from "@/server/desktop-beta";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { code?: unknown } | null;
  const code = typeof body?.code === "string" ? body.code : "";
  if (!isAllowedInviteCode(code, process.env.DESKTOP_BETA_INVITE_CODES)) {
    return Response.json({ error: { code: "INVALID_INVITE_CODE", message: "This desktop beta invite code is not valid." } }, { status: 401 });
  }
  const secret = process.env.DESKTOP_BETA_COOKIE_SECRET;
  if (!secret) return Response.json({ error: { code: "BETA_NOT_CONFIGURED", message: "Desktop beta access is not configured." } }, { status: 503 });
  const response = NextResponse.json({ data: { granted: true } });
  response.cookies.set(desktopBetaCookieName, createBetaAccessCookie(secret), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 30 * 24 * 60 * 60, path: "/" });
  return response;
}