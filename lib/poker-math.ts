export const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

export function requiredEquity(potBeforeBet: number, villainBet: number, call: number = villainBet) {
  const finalPot = potBeforeBet + villainBet + call;
  return finalPot > 0 ? call / finalPot : 0;
}

export function potOdds(potBeforeBet: number, villainBet: number, call: number = villainBet) {
  return requiredEquity(potBeforeBet, villainBet, call);
}

export function spr(effectiveStack: number, pot: number) {
  return pot > 0 ? effectiveStack / pot : 0;
}

export function mdf(pot: number, bet: number) {
  return pot + bet > 0 ? pot / (pot + bet) : 0;
}

export function bluffBreakEven(pot: number, bet: number) {
  return pot + bet > 0 ? bet / (pot + bet) : 0;
}

export function simpleEV(winProbability: number, amountWon: number, loseProbability: number, amountLost: number) {
  return winProbability * amountWon - loseProbability * amountLost;
}

export function callEV(equity: number, potBeforeBet: number, villainBet: number, call: number = villainBet) {
  const winProfit = potBeforeBet + villainBet;
  return equity * winProfit - (1 - equity) * call;
}

export function bluffEV(foldProbability: number, pot: number, bet: number) {
  return foldProbability * pot - (1 - foldProbability) * bet;
}

export function outsApproxEquity(outs: number, cardsToCome: 1 | 2) {
  return Math.min(1, (Math.max(0,outs) * (cardsToCome === 2 ? 4 : 2)) / 100);
}

export function outsExactEquity(outs: number, cardsToCome: 1 | 2) {
  const safeOuts=Math.max(0,Math.min(46,outs));
  if(cardsToCome===1)return safeOuts/46;
  if(safeOuts>=47)return 1;
  const missFlopToTurn=(47-safeOuts)/47;
  const missTurnToRiver=(46-safeOuts)/46;
  return 1-(missFlopToTurn*missTurnToRiver);
}

export function oddsAgainst(probability:number){
  if(probability<=0)return Infinity;
  if(probability>=1)return 0;
  return (1-probability)/probability;
}

export function impliedFutureWinNeeded(potBeforeBet:number,villainBet:number,call:number,equity:number){
  if(equity<=0)return Infinity;
  const currentFinalPot=potBeforeBet+villainBet+call;
  const targetFinalPot=call/equity;
  return Math.max(0,targetFinalPot-currentFinalPot);
}

export function effectiveStack(...stacks:number[]){
  const valid=stacks.filter(value=>Number.isFinite(value)&&value>=0);
  return valid.length?Math.min(...valid):0;
}

export function sanitizeAmount(value:number){return Number.isFinite(value)?Math.max(0,value):0}
