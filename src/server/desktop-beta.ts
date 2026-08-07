import { createHmac, timingSafeEqual } from "node:crypto";

export const desktopBetaCookieName = "thought_space_desktop_beta";

type BetaPayload = { exp: number };

function signature(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function isAllowedInviteCode(value: string, configuredCodes: string | undefined) {
  if (!configuredCodes) return false;
  return configuredCodes.split(",").map((code) => code.trim()).filter(Boolean).some((code) => {
    const expected = Buffer.from(code);
    const received = Buffer.from(value.trim());
    return expected.length === received.length && timingSafeEqual(expected, received);
  });
}

export function createBetaAccessCookie(secret: string, now = Date.now(), lifetimeMs = 30 * 24 * 60 * 60 * 1000) {
  const payload = Buffer.from(JSON.stringify({ exp: now + lifetimeMs } satisfies BetaPayload)).toString("base64url");
  return `${payload}.${signature(payload, secret)}`;
}

export function hasBetaAccess(value: string | undefined, secret: string | undefined, now = Date.now()) {
  if (!value || !secret) return false;
  const [payload, suppliedSignature, ...rest] = value.split(".");
  if (!payload || !suppliedSignature || rest.length) return false;
  const expectedSignature = signature(payload, secret);
  const expected = Buffer.from(expectedSignature);
  const received = Buffer.from(suppliedSignature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as BetaPayload;
    return Number.isFinite(parsed.exp) && parsed.exp > now;
  } catch {
    return false;
  }
}