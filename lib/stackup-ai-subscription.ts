export type StackupAiPlan="FREE"|"PRO"|"ELITE";
export type StackupAiEntitlement={
  plan:StackupAiPlan;
  active:boolean;
  expiresAt?:string;
  monthlyAiCredits:number;
  remainingAiCredits:number;
  features:string[];
  token?:string;
};

const KEY="stackup.ai.entitlement.v1";

export const STACKUP_AI_PLAN_CAPABILITIES={
  FREE:{remoteAi:false,spotGeneration:false,handReview:false,pokerAssistant:false},
  PRO:{remoteAi:true,spotGeneration:true,handReview:true,pokerAssistant:true},
  ELITE:{remoteAi:true,spotGeneration:true,handReview:true,pokerAssistant:true},
} as const;

function browser(){return typeof window!=="undefined"&&typeof window.localStorage!=="undefined"}
function validPlan(value:unknown):value is StackupAiPlan{return value==="FREE"||value==="PRO"||value==="ELITE"}

export function freeEntitlement():StackupAiEntitlement{return{plan:"FREE",active:true,monthlyAiCredits:0,remainingAiCredits:0,features:[]}}

export function loadStackupAiEntitlement():StackupAiEntitlement{
  if(!browser())return freeEntitlement();
  try{
    const raw=window.localStorage.getItem(KEY);if(!raw)return freeEntitlement();
    const parsed=JSON.parse(raw) as Partial<StackupAiEntitlement>;
    if(!validPlan(parsed.plan)||parsed.active!==true)return freeEntitlement();
    if(parsed.expiresAt&&!Number.isNaN(Date.parse(parsed.expiresAt))&&Date.parse(parsed.expiresAt)<=Date.now())return freeEntitlement();
    return{plan:parsed.plan,active:true,expiresAt:parsed.expiresAt,monthlyAiCredits:Number.isFinite(parsed.monthlyAiCredits)?Math.max(0,parsed.monthlyAiCredits??0):0,remainingAiCredits:Number.isFinite(parsed.remainingAiCredits)?Math.max(0,parsed.remainingAiCredits??0):0,features:Array.isArray(parsed.features)?parsed.features.filter(x=>typeof x==="string"):[],token:typeof parsed.token==="string"?parsed.token:undefined};
  }catch{return freeEntitlement()}
}

export function saveStackupAiEntitlement(entitlement:StackupAiEntitlement){if(!browser())return;window.localStorage.setItem(KEY,JSON.stringify(entitlement))}
export function clearStackupAiEntitlement(){if(browser())window.localStorage.removeItem(KEY)}

export function canUseStackupAi(feature:"spotGeneration"|"handReview"|"pokerAssistant"){
  const entitlement=loadStackupAiEntitlement();
  const capabilities=STACKUP_AI_PLAN_CAPABILITIES[entitlement.plan];
  return entitlement.active&&capabilities.remoteAi&&capabilities[feature]&&entitlement.remainingAiCredits>0;
}

export function stackupAiAuthHeaders(){const entitlement=loadStackupAiEntitlement();return entitlement.token?{authorization:`Bearer ${entitlement.token}`}:{} as Record<string,string>}
