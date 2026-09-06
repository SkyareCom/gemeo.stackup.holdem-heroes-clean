import {NextRequest,NextResponse} from "next/server";
import {completePokerVision,type VisionMode} from "@/lib/stackup-ai-vision";
import {creditCost,normalizeDepth} from "@/lib/stackup-ai";
import {checkStackupAiQuota,consumeStackupAiQuota,resolveStackupAiEntitlement,stackupAiUsage} from "@/lib/stackup-ai-entitlements";
import {parseVisionHandDraft} from "@/lib/vision-hand-draft";

export const runtime="nodejs";
const MAX_IMAGE_BYTES=8*1024*1024;
const ALLOWED=new Set(["image/jpeg","image/png","image/webp"]);

export async function POST(request:NextRequest){
  try{
    const form=await request.formData();
    const file=form.get("image");
    const mode=(form.get("mode")==="HAND_REVIEW"?"HAND_REVIEW":"QUESTION") as VisionMode;
    const question=String(form.get("question")||"").trim().slice(0,2500);
    if(!(file instanceof File))return NextResponse.json({error:"IMAGE_REQUIRED"},{status:400});
    if(!ALLOWED.has(file.type))return NextResponse.json({error:"UNSUPPORTED_IMAGE"},{status:415});
    if(file.size<=0||file.size>MAX_IMAGE_BYTES)return NextResponse.json({error:"IMAGE_TOO_LARGE"},{status:413});

    const entitlement=resolveStackupAiEntitlement(request);
    const requestedDepth=mode==="HAND_REVIEW"?"DEEP":"SMART";
    const depth=normalizeDepth(entitlement.plan,requestedDepth);
    const credits=creditCost(depth);
    const quota=checkStackupAiQuota(entitlement,credits);
    if(!quota.allowed)return NextResponse.json({error:quota.reason,usage:stackupAiUsage(entitlement)},{status:429});

    const bytes=Buffer.from(await file.arrayBuffer());
    const completion=await completePokerVision(bytes.toString("base64"),file.type,mode,question);
    const draft=mode==="HAND_REVIEW"?parseVisionHandDraft(completion.text):null;
    if(mode==="HAND_REVIEW"&&!draft)return NextResponse.json({error:"VISION_PARSE_FAILED"},{status:422});
    consumeStackupAiQuota(entitlement,credits);
    if(process.env.NODE_ENV!=="production")console.info("[stackup-ai-vision]",{provider:completion.provider,model:completion.model,mode,credits,plan:entitlement.plan});
    return NextResponse.json({answer:mode==="HAND_REVIEW"?null:completion.text,draft,meta:{mode,depth,credits,plan:entitlement.plan,usage:stackupAiUsage(entitlement)}});
  }catch(error){
    console.error("[stackup-ai-vision] failed",error instanceof Error?error.message:error);
    return NextResponse.json({error:"VISION_TEMPORARILY_UNAVAILABLE"},{status:503});
  }
}
