import "server-only";
import {completePokerQuestion} from "@/lib/stackup-ai-server";
import type {PlayerDnaSpot} from "@/data/player-dna-spots";
import {validateAiSpot,type AiSpotBatch,type AiSpotGenerationRequest} from "@/lib/ai-spot-pipeline";

function extractJson(text:string){
  const fenced=text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]??text;
  const first=fenced.indexOf("{");const last=fenced.lastIndexOf("}");
  if(first<0||last<=first)throw new Error("ai_spot_json_missing");
  return JSON.parse(fenced.slice(first,last+1));
}

function promptFor(request:AiSpotGenerationRequest){
  return `GERADOR STACKUP DE SPOTS DE NO-LIMIT HOLD'EM.\n\nCRIE ${request.count} SPOTS INÉDITOS E INTERNAMENTE COERENTES.\nMODOS: ${request.modes.join(", ")}.\nCOBERTURA PRIORITÁRIA: ${request.requiredCoverage.join(", ")}.\n\nREGRAS OBRIGATÓRIAS:\n- CADA SPOT DEVE REPRESENTAR UM ESTADO LEGAL E PLAUSÍVEL DE TEXAS HOLD'EM NO-LIMIT.\n- VARIE MESA, POSIÇÕES, STACKS, CARTAS, BOARD, STREET, POT, SEQUÊNCIA COMPLETA DE AÇÕES, SIZINGS, HU/MULTIWAY, SIDE POTS, ALL-INS, ANTES E CONTEXTO DE TORNEIO.\n- NÃO INFORME EV, FREQUÊNCIA GTO, AÇÃO CORRETA OU RESULTADOS DE SOLVERS. A AVALIAÇÃO É OUTRO MOTOR.\n- NÃO REPITA ESTADOS DENTRO DO LOTE.\n- NÃO USE NENHUMA DAS FINGERPRINTS PROIBIDAS COMO ESTADO EQUIVALENTE: ${request.forbiddenFingerprints.slice(-500).join(",")||"NENHUMA"}.\n- HERO DEVE SER EXATAMENTE UM JOGADOR.\n- BOARD: 0 CARTAS PREFLOP, 3 FLOP, 4 TURN, 5 RIVER.\n- CARTAS DO HERO E BOARD NÃO PODEM SE REPETIR.\n- actions DEVE CONTER SOMENTE AÇÕES LEGAIS ENTRE FOLD,CHECK,CALL,BET,RAISE,ALL-IN.\n- weights NÃO REPRESENTA CORREÇÃO GTO; USE APENAS PERFIL COMPORTAMENTAL NEUTRO/CONSISTENTE.\n\nRETORNE APENAS JSON VÁLIDO NESTE FORMATO:\n{"spots":[{"id":"ai-...","mode":"CASH|TORNEIO","street":"PREFLOP|FLOP|TURN|RIVER","heroCards":"A♠ K♠","board":"...","players":[{"position":"BTN","stack":100,"action":"---","value":0,"hero":true}],"pot":{"main":10,"sides":[]},"scenario":["CASH","6-MAX","PREFLOP"],"prompt":"...","actions":["FOLD","CALL","RAISE","ALL-IN"],"weights":{"FOLD":{"aggression":0,"discipline":1,"pressure":0,"passivity":1},"CALL":{"aggression":0,"discipline":1,"pressure":1,"passivity":1},"RAISE":{"aggression":2,"discipline":1,"pressure":2,"passivity":0},"ALL-IN":{"aggression":2,"discipline":0,"pressure":3,"passivity":0}}}],"model":"..."}`;
}

export async function generateStackupAiSpots(request:AiSpotGenerationRequest):Promise<AiSpotBatch>{
  const completion=await completePokerQuestion(promptFor(request),request.count<=32?"SMART":"DEEP");
  const parsed=extractJson(completion.text) as {spots?:unknown[]};
  const spots=(Array.isArray(parsed.spots)?parsed.spots:[]).filter(validateAiSpot) as PlayerDnaSpot[];
  if(!spots.length)throw new Error("ai_spot_batch_empty_after_validation");
  return{spots,model:`${completion.provider}:${completion.model}`,generatedAt:new Date().toISOString()};
}
