import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const runtime = "nodejs";

function r2Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) return null;
  return new S3Client({ region: "auto", endpoint: `https://${accountId}.r2.cloudflarestorage.com`, credentials: { accessKeyId, secretAccessKey } });
}

export async function GET() {
  const client = r2Client();
  const bucket = process.env.R2_BUCKET;
  const key = process.env.R2_DESKTOP_INSTALLER_KEY;
  if (!client || !bucket || !key) return Response.json({ error: { code: "DESKTOP_DOWNLOAD_NOT_CONFIGURED", message: "Desktop installer download is not configured." } }, { status: 503 });
  const url = await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key, ResponseContentDisposition: 'attachment; filename="Thought-Space-Orb-Setup.exe"' }), { expiresIn: 300 });
  return Response.redirect(url, 302);
}
