export const runtime = "nodejs";

function publicReleaseUrl(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "github.com" && url.pathname.includes("/releases/download/") ? url : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const url = publicReleaseUrl(process.env.DESKTOP_RELEASE_URL);
  if (!url) return Response.json({ error: { code: "DESKTOP_DOWNLOAD_NOT_CONFIGURED", message: "Desktop installer download is not configured." } }, { status: 503 });
  return Response.redirect(url, 302);
}
