export type HandGameMode="CASH"|"TORNEIO";
export type TournamentType="MTT"|"SNG"|"BOUNTY"|"MULTIDAY"|"HIGH ROLLER"|"REGULAR"|"TURBO";
export type TournamentPhase="EARLY"|"MID"|"BOLHA ITM"|"BOLHA FT"|"ITM"|"FT";
export type FieldLeft="10%"|"20%"|"30%"|"50%";
export type TableSize=2|6|8|9|10;
export type Position="SB"|"BB"|"UTG1"|"UTG2"|"MP1"|"MP2"|"LJ"|"HJ"|"CO"|"BTN";
export type Street="PREFLOP"|"FLOP"|"TURN"|"RIVER";
export type HandAction="FOLD"|"CHECK"|"CALL"|"RAISE"|"3-BET"|"4-BET"|"ALL-IN";
export type Rank="2"|"3"|"4"|"5"|"6"|"7"|"8"|"9"|"T"|"J"|"Q"|"K"|"A";
export type Suit="♠"|"♥"|"♦"|"♣";
export type Card=`${Rank}${Suit}`;

export interface HandReviewInput{
  game:HandGameMode;
  tournamentTypes:TournamentType[];
  tournamentPhase:TournamentPhase|null;
  fieldLeft:FieldLeft|null;
  tableSize:TableSize|null;
  bigBlind:number|null;
  ante:number|null;
  pot:number|null;
  heroPosition:Position|null;
  villainPositions:Position[];
  heroStack:number|null;
  villainStacks:Partial<Record<Position,number>>;
  street:Street;
  board:Card[];
  heroCards:Card[];
  villainActions:Partial<Record<Position,HandAction>>;
  villainActionAmounts:Partial<Record<Position,number>>;
  heroAction:HandAction|null;
  heroActionAmount:number|null;
  notes:string;
}

export interface HandReviewValidation{valid:boolean;missing:string[];conflicts:string[]}
export interface HandMathResult{
  basePot:number;basePotBB:number|null;potBeforeHeroAction:number;potBeforeHeroActionBB:number|null;potAfterActions:number;potAfterActionsBB:number|null;
  heroCallCost:number|null;heroCallCostBB:number|null;potOdds:number|null;equityRequired:number|null;effectiveStack:number|null;effectiveStackBB:number|null;spr:number|null;alpha:number|null;mdf:number|null;
}
export interface PreflopAllInAssessment{
  applies:boolean;handClass:string;estimatedJamRange:number|null;estimatedEquity:number|null;requiredEquity:number|null;margin:number|null;recommendedAction:"CALL"|"FOLD"|null;classification:"DECISÃO CORRETA"|"DECISÃO INCORRETA"|"DADOS INSUFICIENTES";reason:string;
}

export const positions:Position[]=["SB","BB","UTG1","UTG2","MP1","MP2","LJ","HJ","CO","BTN"];
export const ranks:Rank[]=["2","3","4","5","6","7","8","9","T","J","Q","K","A"];
export const suits:Suit[]=["♠","♥","♦","♣"];
export const actions:HandAction[]=["FOLD","CHECK","CALL","RAISE","3-BET","4-BET","ALL-IN"];
export const tournamentTypes:TournamentType[]=["MTT","SNG","BOUNTY","MULTIDAY","HIGH ROLLER","REGULAR","TURBO"];
export const tournamentPhases:TournamentPhase[]=["EARLY","MID","BOLHA ITM","BOLHA FT","ITM","FT"];
export const fieldLeftOptions:FieldLeft[]=["10%","20%","30%","50%"];
export const tableSizes:TableSize[]=[2,6,8,9,10];
export const streets:Street[]=["PREFLOP","FLOP","TURN","RIVER"];

export function requiredBoardCards(street:Street){if(street==="PREFLOP")return 0;if(street==="FLOP")return 3;if(street==="TURN")return 4;return 5}
export function actionNeedsAmount(action:HandAction|null|undefined){return !!action&&["CALL","RAISE","3-BET","4-BET","ALL-IN"].includes(action)}

export function validateHandReview(input:HandReviewInput):HandReviewValidation{
  const missing:string[]=[];const conflicts:string[]=[];
  if(input.game==="TORNEIO"){
    if(input.tournamentTypes.length===0)missing.push("TIPO DE TORNEIO");
    if(!input.tournamentPhase)missing.push("FASE DO TORNEIO");
    if(!input.fieldLeft)missing.push("FIELD LEFT");
  }
  if(!input.tableSize)missing.push("JOGADORES POR MESA");
  if(!(input.bigBlind&&input.bigBlind>0))missing.push("VALOR DO BB");
  if(input.ante===null||input.ante<0)missing.push("VALOR DO ANTE");
  if(input.pot===null||input.pot<0)missing.push("POT ANTES DAS AÇÕES");
  if(!input.heroPosition)missing.push("POSIÇÃO DO HERÓI");
  if(input.villainPositions.length===0)missing.push("AO MENOS UM VILÃO");
  if(!(input.heroStack&&input.heroStack>0))missing.push("STACK DO HERÓI");
  input.villainPositions.forEach(position=>{
    if(!(input.villainStacks[position]&&input.villainStacks[position]!>0))missing.push(`STACK ${position}`);
    const action=input.villainActions[position];if(!action)missing.push(`AÇÃO ${position}`);
    if(actionNeedsAmount(action)&&!(input.villainActionAmounts[position]&&input.villainActionAmounts[position]!>0))missing.push(`VALOR DA AÇÃO ${position}`);
  });
  const heroCards=input.heroCards.filter(Boolean);if(heroCards.length!==2)missing.push("2 CARTAS DO HERÓI");
  const required=requiredBoardCards(input.street);const board=input.board.filter(Boolean);if(board.length!==required)missing.push(`BOARD COMPLETO NO ${input.street}`);
  if(!input.heroAction)missing.push("AÇÃO DO HERÓI");
  if(actionNeedsAmount(input.heroAction)&&!(input.heroActionAmount&&input.heroActionAmount>0))missing.push("VALOR DA AÇÃO DO HERÓI");
  if(input.heroPosition&&input.villainPositions.includes(input.heroPosition))conflicts.push("HERÓI E VILÃO NÃO PODEM OCUPAR A MESMA POSIÇÃO");
  const allCards=[...heroCards,...board];if(new Set(allCards).size!==allCards.length)conflicts.push("A MESMA CARTA FOI USADA MAIS DE UMA VEZ");
  if(input.tableSize&&input.villainPositions.length+1>input.tableSize)conflicts.push("JOGADORES INFORMADOS EXCEDEM O TAMANHO DA MESA");
  return{valid:missing.length===0&&conflicts.length===0,missing:[...new Set(missing)],conflicts:[...new Set(conflicts)]};
}

export function effectiveStack(input:HandReviewInput){
  const stacks=[input.heroStack,...input.villainPositions.map(position=>input.villainStacks[position])].filter((value):value is number=>typeof value==="number"&&value>0);
  return stacks.length?Math.min(...stacks):null;
}

export function calculateHandMath(input:HandReviewInput):HandMathResult{
  const bb=input.bigBlind&&input.bigBlind>0?input.bigBlind:null;const basePot=Math.max(0,input.pot??0);
  const villainContrib=input.villainPositions.reduce((sum,position)=>sum+Math.max(0,input.villainActionAmounts[position]??0),0);
  const heroContribution=Math.max(0,input.heroActionAmount??0);const potBeforeHeroAction=basePot+villainContrib;const potAfterActions=potBeforeHeroAction+heroContribution;
  const heroCallCost=input.heroAction==="CALL"&&heroContribution>0?heroContribution:null;
  const potOdds=heroCallCost!==null&&potBeforeHeroAction+heroCallCost>0?heroCallCost/(potBeforeHeroAction+heroCallCost)*100:null;
  const eff=effectiveStack(input);const spr=eff!==null&&potBeforeHeroAction>0?eff/potBeforeHeroAction:null;
  const alpha=heroCallCost!==null&&potBeforeHeroAction+heroCallCost>0?heroCallCost/(potBeforeHeroAction+heroCallCost)*100:null;const mdf=alpha!==null?100-alpha:null;
  return{basePot,basePotBB:bb?basePot/bb:null,potBeforeHeroAction,potBeforeHeroActionBB:bb?potBeforeHeroAction/bb:null,potAfterActions,potAfterActionsBB:bb?potAfterActions/bb:null,heroCallCost,heroCallCostBB:bb&&heroCallCost!==null?heroCallCost/bb:null,potOdds,equityRequired:potOdds,effectiveStack:eff,effectiveStackBB:bb&&eff!==null?eff/bb:null,spr,alpha,mdf};
}

export function formatBB(chips:number|null|undefined,bigBlind:number|null|undefined){if(chips===null||chips===undefined||!bigBlind||bigBlind<=0)return"— BB";return`${trim(chips/bigBlind)} BB`}
export function trim(value:number){return Number(value.toFixed(2)).toLocaleString("pt-BR",{maximumFractionDigits:2})}

function cardRank(card:Card){return card[0] as Rank}
export function preflopHandClass(cards:Card[]){
  if(cards.length!==2)return"";const order="23456789TJQKA";const a=cardRank(cards[0]),b=cardRank(cards[1]);
  if(a===b)return`${a}${b}`;const hi=order.indexOf(a)>order.indexOf(b)?a:b;const lo=hi===a?b:a;const suited=cards[0].slice(-1)===cards[1].slice(-1);return`${hi}${lo}${suited?"s":"o"}`;
}
function estimateJamRange(input:HandReviewInput,math:HandMathResult){
  if(!input.bigBlind||math.effectiveStackBB===null)return null;const hasJam=input.villainPositions.some(p=>input.villainActions[p]==="ALL-IN");if(!hasJam)return null;
  const eff=math.effectiveStackBB;let width=eff<=10?18:eff<=15?14:eff<=20?11:eff<=25?8.5:6.5;
  if(input.villainPositions.includes("BB")&&["UTG1","UTG2","MP1"].includes(input.heroPosition??"BTN"))width*=.82;
  const notes=input.notes.toUpperCase();if(/AGRESS|3[- ]?BET ALTO|VPIP ALTO/.test(notes))width*=1.2;if(/PASSIV|NIT|3[- ]?BET BAIXO|VPIP BAIXO/.test(notes))width*=.8;
  return Math.max(3,Math.min(24,width));
}
function estimateEquityVsJam(handClass:string,jamRange:number){
  const pair:Record<string,number>={AA:81,KK:68,QQ:60,JJ:46+jamRange*.85,TT:41+jamRange*.75,"99":37+jamRange*.7,"88":34+jamRange*.65};
  if(pair[handClass]!==undefined)return Math.max(5,Math.min(92,pair[handClass]));
  const other:Record<string,number>={AKs:58,AKo:55,AQs:49,AQo:45,AJs:43,KQs:42};if(other[handClass]!==undefined)return Math.max(5,Math.min(92,other[handClass]+(jamRange-8)*.35));
  return null;
}
export function assessPreflopAllIn(input:HandReviewInput):PreflopAllInAssessment{
  const math=calculateHandMath(input);const handClass=preflopHandClass(input.heroCards.filter(Boolean));
  const applies=input.street==="PREFLOP"&&input.villainPositions.some(p=>input.villainActions[p]==="ALL-IN");
  if(!applies)return{applies:false,handClass,estimatedJamRange:null,estimatedEquity:null,requiredEquity:math.equityRequired,margin:null,recommendedAction:null,classification:"DADOS INSUFICIENTES",reason:"A calibração de all-in pré-flop não se aplica a este spot."};
  const jamRange=estimateJamRange(input,math);const equity=jamRange!==null?estimateEquityVsJam(handClass,jamRange):null;const required=math.equityRequired;
  if(jamRange===null||equity===null||required===null)return{applies:true,handClass,estimatedJamRange:jamRange,estimatedEquity:equity,requiredEquity:required,margin:null,recommendedAction:null,classification:"DADOS INSUFICIENTES",reason:"Faltam dados para comparar equity estimada com a equity mínima exigida pelo pote."};
  const margin=equity-required;const recommendedAction:PreflopAllInAssessment["recommendedAction"]=margin>=0?"CALL":"FOLD";const hero=input.heroAction==="CALL"?"CALL":input.heroAction==="FOLD"?"FOLD":null;
  const classification=hero&&hero===recommendedAction?"DECISÃO CORRETA":hero?"DECISÃO INCORRETA":"DADOS INSUFICIENTES";
  return{applies:true,handClass,estimatedJamRange:jamRange,estimatedEquity:equity,requiredEquity:required,margin,recommendedAction,classification,reason:`${handClass} tem equity estimada de ${trim(equity)}% contra um range de shove de aproximadamente ${trim(jamRange)}%. O pote exige ${trim(required)}%. Margem: ${margin>=0?"+":""}${trim(margin)} p.p.`};
}

export function handReviewSummary(input:HandReviewInput){
  const tournament=input.game==="TORNEIO"?`${input.tournamentTypes.join(" + ")} · ${input.tournamentPhase} · FIELD LEFT ${input.fieldLeft}`:"CASH";const math=calculateHandMath(input);
  return{modality:tournament,table:input.tableSize?`${input.tableSize}-MAX`:"—",blinds:input.bigBlind?`BB ${input.bigBlind.toLocaleString("pt-BR")} · ANTE ${(input.ante??0).toLocaleString("pt-BR")}`:"—",hero:input.heroPosition?`${input.heroPosition} · ${input.heroCards.filter(Boolean).join(" ")} · ${formatBB(input.heroStack,input.bigBlind)}`:"—",villains:input.villainPositions.map(position=>`${position} ${formatBB(input.villainStacks[position],input.bigBlind)} · ${input.villainActions[position]??"—"}${input.villainActionAmounts[position]?` ${formatBB(input.villainActionAmounts[position],input.bigBlind)}`:""}`).join(" · "),street:input.street,board:input.board.filter(Boolean).length?input.board.filter(Boolean).join(" "):"PREFLOP",heroAction:input.heroAction??"—",effectiveStack:math.effectiveStack,effectiveStackBB:math.effectiveStackBB,math};
}
