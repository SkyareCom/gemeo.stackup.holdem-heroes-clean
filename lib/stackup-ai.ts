export type StackupAiPlan="FREE"|"PRO"|"ELITE"|"UNLIMITED";
export type StackupAiDepth="FAST"|"SMART"|"DEEP";
export type StackupAiProvider="GEMINI"|"NVIDIA"|"OPENAI"|"ANTHROPIC";

export interface StackupAiPlanPolicy{
  monthlyCredits:number|null;
  dailyQuestions:number|null;
  maxDepth:StackupAiDepth;
}

export const STACKUP_AI_PLAN_POLICIES:Record<StackupAiPlan,StackupAiPlanPolicy>={
  FREE:{monthlyCredits:null,dailyQuestions:5,maxDepth:"FAST"},
  PRO:{monthlyCredits:100,dailyQuestions:null,maxDepth:"SMART"},
  ELITE:{monthlyCredits:500,dailyQuestions:null,maxDepth:"DEEP"},
  UNLIMITED:{monthlyCredits:null,dailyQuestions:null,maxDepth:"DEEP"},
};

export const STACKUP_AI_CREDIT_COST:Record<StackupAiDepth,number>={FAST:1,SMART:3,DEEP:5};

export function depthAllowed(plan:StackupAiPlan,depth:StackupAiDepth){
  const order:StackupAiDepth[]=["FAST","SMART","DEEP"];
  return order.indexOf(depth)<=order.indexOf(STACKUP_AI_PLAN_POLICIES[plan].maxDepth);
}

export function normalizeDepth(plan:StackupAiPlan,requested:StackupAiDepth){
  return depthAllowed(plan,requested)?requested:STACKUP_AI_PLAN_POLICIES[plan].maxDepth;
}

export function creditCost(depth:StackupAiDepth){return STACKUP_AI_CREDIT_COST[depth]}

export function classifyDepth(question:string):StackupAiDepth{
  const q=question.toLowerCase();
  if(question.length>420||/(icm|range|ranges|equity|\bev\b|exploit|all.?in|shove|side pot|multiway|combo|combinat|analise profunda)/i.test(q))return "DEEP";
  if(question.length>140||/(estrateg|regra|dealer|torneio|cash|preflop|flop|turn|river|3.?bet|4.?bet|pot odds|implied|mdf|spr)/i.test(q))return "SMART";
  return "FAST";
}

export const STACKUP_POKER_SYSTEM_PROMPT=`Você é STACKUP AI, um assistente especializado exclusivamente em poker.
Responda em português claro, técnico e objetivo. Você pode explicar regras, estratégia, ranges, matemática, cash games e torneios.
Nunca use dados do Player DNA neste módulo. PERGUNTE À IA é independente do perfil do jogador.
Quando a pergunta envolver uma decisão, explicite as premissas: posição, stack efetivo, sequência de ações, tamanho do pote/sizing e contexto cash/torneio.
Quando houver matemática, mostre a fórmula e diferencie dado exato de estimativa.
Quando regras variarem por organização ou casa, diga que a regra pode variar e descreva a convenção mais comum sem inventar certeza.
Não alegue precisão de solver quando não houver cálculo de solver disponível.`;

export function isPokerQuestion(question:string){return question.trim().length>=3}
