import {NextRequest,NextResponse} from "next/server";
import {completePokerQuestion} from "@/lib/stackup-ai-server";
import {classifyDepth,creditCost,isPokerQuestion,normalizeDepth,STACKUP_AI_PLAN_POLICIES} from "@/lib/stackup-ai";
import {checkStackupAiQuota,consumeStackupAiQuota,resolveStackupAiEntitlement,stackupAiUsage} from "@/lib/stackup-ai-entitlements";

export const runtime="nodejs";

export async function POST(request:NextRequest){
  let body:{question?:unknown};
  try{body=await request.json()}catch{return NextResponse.json({error:"INVALID_REQUEST"},{status:400})}
  const question=typeof body.question==="string"?body.question.trim():"";
  if(!isPokerQuestion(question))return NextResponse.json({error:"QUESTION_REQUIRED"},{status:400});
  if(question.length>4000)return NextResponse.json({error:"QUESTION_TOO_LONG"},{status:413});

  const entitlement=resolveStackupAiEntitlement(request);
  const requestedDepth=classifyDepth(question);
  const depth=normalizeDepth(entitlement.plan,requestedDepth);
  const credits=creditCost(depth);
  const quota=checkStackupAiQuota(entitlement,credits);
  if(!quota.allowed)return NextResponse.json({error:quota.reason,usage:stackupAiUsage(entitlement)},{status:429});

  try{
    const completion=await completePokerQuestion(question,depth);
    consumeStackupAiQuota(entitlement,credits);
    if(process.env.NODE_ENV!=="production")console.info("[stackup-ai]",{provider:completion.provider,model:completion.model,depth,credits,plan:entitlement.plan});
    return NextResponse.json({
      answer:completion.text,
      meta:{depth,credits,plan:entitlement.plan,policy:STACKUP_AI_PLAN_POLICIES[entitlement.plan],usage:stackupAiUsage(entitlement)}
    });
  }catch(error){
    console.error("[stackup-ai] completion failed",error instanceof Error?error.message:error);
    return NextResponse.json({error:"AI_TEMPORARILY_UNAVAILABLE"},{status:503});
  }
}
