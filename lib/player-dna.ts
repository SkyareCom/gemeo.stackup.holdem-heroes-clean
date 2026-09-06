import type { PlayerAction, PlayerDnaSpot } from "@/data/player-dna-spots";

export type DecisionSizing = "25%" | "33%" | "50%" | "66%" | "75%" | "POT" | "125%" | "150%" | "2X" | "2.5X" | "3X" | "4X" | "SQUEEZE";
export type PlayerDnaAnswer = { spotId: string; action: PlayerAction; sizing?: DecisionSizing };

export type PlayerDnaResult = {
  label: string;
  confidence: number;
  scores: { aggression: number; discipline: number; pressure: number; passivity: number };
  strengths: string[];
  watchouts: string[];
};

export function evaluatePlayerDna(spots: PlayerDnaSpot[], answers: PlayerDnaAnswer[]): PlayerDnaResult {
  const totals = { aggression: 0, discipline: 0, pressure: 0, passivity: 0 };
  let maxTotal = 0;

  for (const answer of answers) {
    const spot = spots.find((item) => item.id === answer.spotId);
    if (!spot) continue;
    const selected = spot.weights[answer.action];
    if (!selected) continue;
    totals.aggression += selected.aggression;
    totals.discipline += selected.discipline;
    totals.pressure += selected.pressure;
    totals.passivity += selected.passivity;
    maxTotal += 3;
  }

  const normalize = (value: number) => maxTotal ? Math.round((value / maxTotal) * 100) : 0;
  const scores = {
    aggression: normalize(totals.aggression),
    discipline: normalize(totals.discipline),
    pressure: normalize(totals.pressure),
    passivity: normalize(totals.passivity),
  };

  let label = "EQUILIBRADO";
  if (scores.aggression >= 58 && scores.pressure >= 48) label = "AGRESSOR DE PRESSÃO";
  else if (scores.discipline >= 58 && scores.passivity < 48) label = "SELETIVO DISCIPLINADO";
  else if (scores.passivity >= 55) label = "CONTROLADOR PASSIVO";
  else if (scores.aggression >= 50) label = "AGRESSOR SELETIVO";

  const strengths: string[] = [];
  const watchouts: string[] = [];
  if (scores.discipline >= 45) strengths.push("BOA CAPACIDADE DE ABANDONAR LINHAS MARGINAIS.");
  if (scores.aggression >= 45) strengths.push("DISPOSIÇÃO PARA DISPUTAR INICIATIVA E CONSTRUIR POTES.");
  if (scores.pressure >= 45) strengths.push("CONFORTO EM DECISÕES DE MAIOR VARIÂNCIA E PRESSÃO.");
  if (scores.passivity >= 50) watchouts.push("TENDÊNCIA A CEDER INICIATIVA EM SPOTS ONDE PRESSÃO PODE CAPTURAR EV.");
  if (scores.aggression >= 65 && scores.discipline < 35) watchouts.push("AGRESSÃO PODE ESTAR AVANÇANDO ALÉM DA SELETIVIDADE NECESSÁRIA.");
  if (scores.pressure >= 65 && scores.discipline < 40) watchouts.push("RISCO DE DEFENDER OU ESCALAR POTES DEMAIS SOB PRESSÃO.");
  if (!strengths.length) strengths.push("PERFIL AINDA EM FORMAÇÃO; AUMENTE A AMOSTRA PARA ESTABILIZAR O DIAGNÓSTICO.");
  if (!watchouts.length) watchouts.push("NENHUM DESVIO DOMINANTE APARECEU NESTA AMOSTRA INICIAL.");

  const sampleConfidence = Math.min(92, 35 + answers.length * 4.5);
  return { label, confidence: Math.round(sampleConfidence), scores, strengths, watchouts };
}
