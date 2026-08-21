import { requestIdentity } from "@/server/identity";
import { createDesktopTicket } from "@/server/supabase";
export const runtime="nodejs";
export async function POST(request:Request) { const identity=await requestIdentity(request); if(!identity || identity.mode !== "supabase") return Response.json({error:{code:"UNAUTHENTICATED",message:"Please sign in to pair the desktop app."}},{status:401}); try{return Response.json({data:await createDesktopTicket(identity.id)})}catch{return Response.json({error:{code:"PAIRING_FAILED",message:"Unable to pair the desktop app."}},{status:502});} }
