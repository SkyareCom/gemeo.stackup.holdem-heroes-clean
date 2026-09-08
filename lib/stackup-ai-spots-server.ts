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
  return `GERADOR STACKUP DE ESTADOS CANDIDATOS PARA VALIDAÇÃO EXATA POR SOLVER.\n\nCRIE ${request.count} SPOTS INÉDITOS E INTERNAMENTE COERENTES.\nMODOS: ${request.modes.join(", ")}.\nCOBERTURA PRIORITÁRIA: ${request.requiredCoverage.join(", ")}.\n\nREGRAS OBRIGATÓRIAS:\n- VOCÊ GERA SOMENTE O ESTADO DA MÃO. NUNCA GERE EV, FREQUÊNCIA GTO, MELHOR AÇÃO OU RESULTADO DE SOLVER.\n- CADA SPOT DEVE REPRESENTAR UM NÓ LEGAL DE TEXAS HOLD'EM NO-LIMIT E SER SUFICIENTEMENTE COMPLETO PARA UM SOLVER/VALIDADOR EXTERNO.\n- INFORME heroToCall, currentBet, legalActions E actionHistory COERENTES COM O NÓ ATUAL.\n- INFORME commitments TOTAIS DE TODOS OS JOGADORES QUE CONTRIBUÍRAM PARA O POTE, INCLUSIVE FOLDED PLAYERS QUANDO PRESENTES.\n- INFORME ranges PONDERADOS DE HERO E DE TODOS OS VILÕES ATIVOS, COM PESOS ENTRE 0 E 1, CONSISTENTES COM POSIÇÃO, AÇÕES E CARD REMOVAL.\n- NUNCA USE CARTA VISÍVEL EM UMA COMBINAÇÃO DE RANGE.\n- CASH: INFORME rakePct EXPLÍCITO. NÃO PRESUMA RAKE DESCONHECIDO.\n- TORNEIO: INFORME anteBb QUANDO APLICÁVEL; PARA BOLHA/FT/ICM, INFORME payouts E fieldStacks COMPLETOS E COERENTES.\n- MULTIWAY: commitments E pot.main/pot.sides DEVEM RECONCILIAR O POTE.\n- VARIE MESA, POSIÇÕES, STACKS, CARTAS, BOARD, STREET, POT, SEQUÊNCIA COMPLETA DE AÇÕES, SIZINGS, HU/MULTIWAY, SIDE POTS, ALL-INS, ANTES E CONTEXTO DE TORNEIO.\n- NÃO REPITA ESTADOS DENTRO DO LOTE.\n- NÃO USE NENHUMA DAS FINGERPRINTS PROIBIDAS COMO ESTADO EQUIVALENTE: ${request.forbiddenFingerprints.slice(-500).join(",")||"NENHUMA"}.\n- HERO DEVE SER EXATAMENTE UM JOGADOR.\n- BOARD: 0 CARTAS PREFLOP, 3 FLOP, 4 TURN, 5 RIVER.\n- CARTAS DO HERO E BOARD NÃO PODEM SE REPETIR.\n- actions E legalActions DEVEM CONTER SOMENTE AÇÕES LEGAIS ENTRE FOLD,CHECK,CALL,BET,RAISE,ALL-IN.\n- weights NÃO REPRESENTA CORREÇÃO GTO; USE APENAS PERFIL COMPORTAMENTAL NEUTRO/CONSISTENTE.\n\nRETORNE APENAS JSON VÁLIDO NESTE FORMATO:\n{"spots":[{"id":"ai-...","mode":"CASH|TORNEIO","street":"PREFLOP|FLOP|TURN|RIVER","heroCards":"A♠ K♠","board":"...","players":[{"position":"BTN","stack":100,"action":"---","value":0,"hero":true},{"position":"BB","stack":100,"action":"BET","value":6}],"pot":{"main":10,"sides":[]},"scenario":["CASH","6-MAX"],"prompt":"...","actions":["FOLD","CALL","RAISE","ALL-IN"],"legalActions":["FOLD","CALL","RAISE","ALL-IN"],"heroToCall":6,"currentBet":6,"actionHistory":[{"position":"BTN","action":"RAISE","value":2.5},{"position":"BB","action":"RAISE","value":6}],"commitments":{"BTN":2.5,"BB":6},"ranges":{"hero":[{"hand":"AsKs","weight":1}],"villains":{"BB":[{"hand":"QhQs","weight":0.5},{"hand":"JcJs","weight":0.5}]}},"rakePct":5,"weights":{"FOLD":{"aggression":0,"discipline":1,"pressure":0,"passivity":1},"CALL":{"aggression":0,"discipline":1,"pressure":1,"passivity":1},"RAISE":{"aggression":2,"discipline":1,"pressure":2,"passivity":0},"ALL-IN":{"aggression":2,"discipline":0,"pressure":3,"passivity":0}}}],"model":"..."}`;
}

export async function generateStackupAiSpots(request:AiSpotGenerationRequest):Promise<AiSpotBatch>{
  const completion=await completePokerQuestion(promptFor(request),request.count<=32?"SMART":"DEEP");
  const parsed=extractJson(completion.text) as {spots?:unknown[]};
  const spots=(Array.isArray(parsed.spots)?parsed.spots:[]).filter(validateAiSpot) as PlayerDnaSpot[];
  if(!spots.length)throw new Error("ai_spot_batch_empty_after_validation");
  return{spots,model:`${completion.provider}:${completion.model}`,generatedAt:new Date().toISOString()};
}
