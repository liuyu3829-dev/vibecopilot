import { exchangeDesktopTicket } from "@/server/supabase";
export const runtime="nodejs";
const desktopCors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(body: unknown, init?: ResponseInit) {
  return Response.json(body, { ...init, headers: { ...desktopCors, ...init?.headers } });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: desktopCors });
}

export async function POST(request:Request) {
  const body=await request.json().catch(()=>null) as {ticket?:unknown}|null;
  if(!body || typeof body.ticket!=="string") return json({error:{code:"INVALID_TICKET",message:"Pairing ticket is required."}},{status:400});
  try {
    const token=await exchangeDesktopTicket(body.ticket);
    return token ? json({data:{token}}) : json({error:{code:"PAIRING_EXPIRED",message:"Pairing link expired. Return to the website and try again."}},{status:401});
  } catch {
    return json({error:{code:"PAIRING_FAILED",message:"Unable to pair the desktop app."}},{status:502});
  }
}
