import "server-only";
import {createHmac,timingSafeEqual} from "node:crypto";
import {NextRequest} from "next/server";
import {STACKUP_AI_PLAN_POLICIES,StackupAiPlan} from "@/lib/stackup-ai";

export interface StackupAiEntitlement{subject:string;plan:StackupAiPlan;authenticated:boolean}
interface SignedPayload{sub:string;plan:StackupAiPlan;exp:number}
interface UsageBucket{day:string;dayQuestions:number;month:string;monthCredits:number}

const usage=new Map<string,UsageBucket>();
const validPlans=new Set<StackupAiPlan>(["FREE","PRO","ELITE","UNLIMITED"]);

function b64url(value:Buffer|string){return Buffer.from(value).toString("base64url")}
function safeEqual(a:string,b:string){const aa=Buffer.from(a),bb=Buffer.from(b);return aa.length===bb.length&&timingSafeEqual(aa,bb)}

function verifyToken(token:string,secret:string):SignedPayload|null{
  const [encoded,signature]=token.split(".");if(!encoded||!signature)return null;
  const expected=b64url(createHmac("sha256",secret).update(encoded).digest());if(!safeEqual(signature,expected))return null;
  try{
    const payload=JSON.parse(Buffer.from(encoded,"base64url").toString("utf8")) as SignedPayload;
    if(!payload.sub||!validPlans.has(payload.plan)||!payload.exp||payload.exp*1000<Date.now())return null;
    return payload;
  }catch{return null}
}

function anonymousSubject(request:NextRequest){
  const forwarded=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `anon:${forwarded||"local"}`;
}

export function resolveStackupAiEntitlement(request:NextRequest):StackupAiEntitlement{
  const secret=process.env.STACKUP_AI_ENTITLEMENT_SECRET;
  const auth=request.headers.get("authorization");
  if(secret&&auth?.startsWith("Bearer ")){
    const payload=verifyToken(auth.slice(7).trim(),secret);
    if(payload)return{subject:payload.sub,plan:payload.plan,authenticated:true};
  }
  return{subject:anonymousSubject(request),plan:"FREE",authenticated:false};
}

function currentBucket(subject:string){
  const now=new Date();const day=now.toISOString().slice(0,10),month=day.slice(0,7);const found=usage.get(subject);
  if(!found){const fresh={day,dayQuestions:0,month,monthCredits:0};usage.set(subject,fresh);return fresh}
  if(found.day!==day){found.day=day;found.dayQuestions=0}
  if(found.month!==month){found.month=month;found.monthCredits=0}
  return found;
}

export function checkStackupAiQuota(entitlement:StackupAiEntitlement,credits:number){
  const policy=STACKUP_AI_PLAN_POLICIES[entitlement.plan];const bucket=currentBucket(entitlement.subject);
  if(policy.dailyQuestions!==null&&bucket.dayQuestions>=policy.dailyQuestions)return{allowed:false as const,reason:"DAILY_LIMIT",remaining:0};
  if(policy.monthlyCredits!==null&&bucket.monthCredits+credits>policy.monthlyCredits)return{allowed:false as const,reason:"MONTHLY_CREDITS",remaining:Math.max(0,policy.monthlyCredits-bucket.monthCredits)};
  return{allowed:true as const,remaining:policy.monthlyCredits===null?null:Math.max(0,policy.monthlyCredits-bucket.monthCredits-credits)};
}

export function consumeStackupAiQuota(entitlement:StackupAiEntitlement,credits:number){const bucket=currentBucket(entitlement.subject);bucket.dayQuestions+=1;bucket.monthCredits+=credits}

export function stackupAiUsage(entitlement:StackupAiEntitlement){
  const bucket=currentBucket(entitlement.subject),policy=STACKUP_AI_PLAN_POLICIES[entitlement.plan];
  return{plan:entitlement.plan,dayQuestions:bucket.dayQuestions,dailyLimit:policy.dailyQuestions,monthCredits:bucket.monthCredits,monthlyCredits:policy.monthlyCredits};
}

// For the future auth/billing service: issue the same compact entitlement token
// after checkout/login without exposing provider API keys to the browser.
export function signStackupAiEntitlement(payload:SignedPayload,secret:string){const encoded=b64url(JSON.stringify(payload));const signature=b64url(createHmac("sha256",secret).update(encoded).digest());return`${encoded}.${signature}`}
