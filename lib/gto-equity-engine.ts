import {canonicalCard,normalizeWeightedRange,type WeightedRangeEntry,type WeightedCombo} from "@/lib/gto-range-engine";

export type EquityResult={heroEquity:number;villainEquity:number;ties:number;heroWins:number;villainWins:number;weightedTrials:number;runouts:number;status:"OK"|"INVALID";issues:string[]};

const RANKS="23456789TJQKA";
const SUITS=["S","H","D","C"] as const;
const RANK_VALUE:Record<string,number>=Object.fromEntries([...RANKS].map((r,i)=>[r,i+2]));
const DECK=[...RANKS].flatMap(rank=>SUITS.map(suit=>`${rank}${suit}`));

type Score=[number,...number[]];
function combinations<T>(items:T[],k:number){const out:T[][]=[];const walk=(start:number,picked:T[])=>{if(picked.length===k){out.push(picked);return}for(let i=start;i<=items.length-(k-picked.length);i++)walk(i+1,[...picked,items[i]])};walk(0,[]);return out}
function compareScore(a:Score,b:Score){const n=Math.max(a.length,b.length);for(let i=0;i<n;i++){const d=(a[i]??0)-(b[i]??0);if(d)return d>0?1:-1}return 0}
function fiveCardScore(cards:string[]):Score{const ranks=cards.map(c=>RANK_VALUE[c[0]]??0).sort((a,b)=>b-a),counts=new Map<number,number>();for(const r of ranks)counts.set(r,(counts.get(r)??0)+1);const groups=[...counts.entries()].sort((a,b)=>b[1]-a[1]||b[0]-a[0]);const flush=cards.every(c=>c[1]===cards[0][1]);const unique=[...new Set(ranks)];if(unique.includes(14))unique.push(1);let straightHigh=0;for(let high=14;high>=5;high--)if([0,1,2,3,4].every(d=>unique.includes(high-d))){straightHigh=high;break}
  if(flush&&straightHigh)return[8,straightHigh];
  if(groups[0]?.[1]===4)return[7,groups[0][0],groups[1]?.[0]??0];
  if(groups[0]?.[1]===3&&groups[1]?.[1]>=2)return[6,groups[0][0],groups[1][0]];
  if(flush)return[5,...ranks];
  if(straightHigh)return[4,straightHigh];
  if(groups[0]?.[1]===3)return[3,groups[0][0],...groups.filter(g=>g[1]===1).map(g=>g[0]).sort((a,b)=>b-a).slice(0,2)];
  const pairs=groups.filter(g=>g[1]===2).map(g=>g[0]).sort((a,b)=>b-a);if(pairs.length>=2){const kicker=groups.filter(g=>g[1]===1).map(g=>g[0]).sort((a,b)=>b-a)[0]??0;return[2,pairs[0],pairs[1],kicker]}
  if(pairs.length===1)return[1,pairs[0],...groups.filter(g=>g[1]===1).map(g=>g[0]).sort((a,b)=>b-a).slice(0,3)];
  return[0,...ranks.slice(0,5)];
}
export function bestHoldemScore(cards:string[]):Score{if(cards.length<5||cards.length>7)throw new Error("HOLDEM_SCORE_REQUIRES_5_TO_7_CARDS");let best:Score|undefined;for(const five of combinations(cards,5)){const score=fiveCardScore(five);if(!best||compareScore(score,best)>0)best=score}return best!}
export function compareHoldem(hero:[string,string],villain:[string,string],board:string[]){const h=[...hero,...board],v=[...villain,...board];if(h.length<5||h.length>7||v.length<5||v.length>7)throw new Error("INVALID_BOARD_LENGTH");return compareScore(bestHoldemScore(h),bestHoldemScore(v))}
function canonicalCards(raw:string[]){return raw.map(canonicalCard).filter(Boolean) as string[]}
function legalRunouts(dead:Set<string>,needed:number){const available=DECK.filter(card=>!dead.has(card));if(needed===0)return[[]] as string[][];return combinations(available,needed)}
function comboOverlap(a:[string,string],b:[string,string]){return a.some(card=>b.includes(card))}

export function exactComboEquity(heroRaw:[string,string],villainRaw:[string,string],boardRaw:string[]):EquityResult{
  const issues:string[]=[],hero=canonicalCards(heroRaw) as [string,string],villain=canonicalCards(villainRaw) as [string,string],board=canonicalCards(boardRaw);const all=[...hero,...villain,...board];
  if(hero.length!==2||villain.length!==2||board.length!==boardRaw.length||new Set(all).size!==all.length||board.length<3||board.length>5)return{heroEquity:0,villainEquity:0,ties:0,heroWins:0,villainWins:0,weightedTrials:0,runouts:0,status:"INVALID",issues:["CARTAS INVÁLIDAS/DUPLICADAS OU BOARD FORA DE FLOP-TURN-RIVER."]};
  const dead=new Set(all),runouts=legalRunouts(dead,5-board.length);let heroWins=0,villainWins=0,ties=0;for(const runout of runouts){const result=compareHoldem(hero,villain,[...board,...runout]);if(result>0)heroWins++;else if(result<0)villainWins++;else ties++}const total=runouts.length||1;return{heroEquity:(heroWins+ties*.5)/total,villainEquity:(villainWins+ties*.5)/total,ties,heroWins,villainWins,weightedTrials:total,runouts:runouts.length,status:"OK",issues};
}

export function heroVsWeightedRangeEquity(heroRaw:[string,string],villainRange:WeightedRangeEntry[],boardRaw:string[]):EquityResult{
  const hero=canonicalCards(heroRaw) as [string,string],board=canonicalCards(boardRaw);if(hero.length!==2||board.length!==boardRaw.length||new Set([...hero,...board]).size!==hero.length+board.length||board.length<3||board.length>5)return{heroEquity:0,villainEquity:0,ties:0,heroWins:0,villainWins:0,weightedTrials:0,runouts:0,status:"INVALID",issues:["ESTADO DE CARTAS INVÁLIDO PARA EQUITY."]};
  const normalized=normalizeWeightedRange(villainRange,[...hero,...board]);if(!normalized.combos.length)return{heroEquity:0,villainEquity:0,ties:0,heroWins:0,villainWins:0,weightedTrials:0,runouts:0,status:"INVALID",issues:["RANGE DO VILÃO SEM COMBOS VÁLIDOS APÓS CARD REMOVAL.",...normalized.invalidEntries.map(x=>`ENTRADA INVÁLIDA: ${x}`)]};
  let heroScore=0,villainScore=0,tieWeight=0,heroWinWeight=0,villainWinWeight=0,totalWeight=0,runouts=0;for(const combo of normalized.combos){if(comboOverlap(hero,combo.cards))continue;const dead=new Set([...hero,...combo.cards,...board]);const boards=legalRunouts(dead,5-board.length);for(const runout of boards){const w=combo.weight/(boards.length||1),result=compareHoldem(hero,combo.cards,[...board,...runout]);if(result>0){heroScore+=w;heroWinWeight+=w}else if(result<0){villainScore+=w;villainWinWeight+=w}else{heroScore+=w*.5;villainScore+=w*.5;tieWeight+=w}totalWeight+=w;runouts++}}
  if(totalWeight<=0)return{heroEquity:0,villainEquity:0,ties:0,heroWins:0,villainWins:0,weightedTrials:0,runouts,status:"INVALID",issues:["NENHUM RUNOUT LEGAL PARA O RANGE."]};
  return{heroEquity:heroScore/totalWeight,villainEquity:villainScore/totalWeight,ties:tieWeight,heroWins:heroWinWeight,villainWins:villainWinWeight,weightedTrials:totalWeight,runouts,status:"OK",issues:normalized.invalidEntries.map(x=>`ENTRADA INVÁLIDA IGNORADA: ${x}`)};
}

export function rangeVsRangeEquity(heroRange:WeightedRangeEntry[],villainRange:WeightedRangeEntry[],boardRaw:string[]):EquityResult{
  const board=canonicalCards(boardRaw);if(board.length!==boardRaw.length||new Set(board).size!==board.length||board.length<3||board.length>5)return{heroEquity:0,villainEquity:0,ties:0,heroWins:0,villainWins:0,weightedTrials:0,runouts:0,status:"INVALID",issues:["BOARD INVÁLIDO PARA EQUITY DE RANGES."]};
  const hero=normalizeWeightedRange(heroRange,board),villain=normalizeWeightedRange(villainRange,board);if(!hero.combos.length||!villain.combos.length)return{heroEquity:0,villainEquity:0,ties:0,heroWins:0,villainWins:0,weightedTrials:0,runouts:0,status:"INVALID",issues:["UM DOS RANGES NÃO POSSUI COMBOS VÁLIDOS."]};
  let hEq=0,vEq=0,hWin=0,vWin=0,tie=0,total=0,runouts=0;for(const hc of hero.combos)for(const vc of villain.combos){if(comboOverlap(hc.cards,vc.cards))continue;const pairWeight=hc.weight*vc.weight,dead=new Set([...board,...hc.cards,...vc.cards]),boards=legalRunouts(dead,5-board.length);for(const runout of boards){const w=pairWeight/(boards.length||1),result=compareHoldem(hc.cards,vc.cards,[...board,...runout]);if(result>0){hEq+=w;hWin+=w}else if(result<0){vEq+=w;vWin+=w}else{hEq+=w*.5;vEq+=w*.5;tie+=w}total+=w;runouts++}}
  if(total<=0)return{heroEquity:0,villainEquity:0,ties:0,heroWins:0,villainWins:0,weightedTrials:0,runouts,status:"INVALID",issues:["RANGES SEM PARES DE COMBOS COMPATÍVEIS."]};
  return{heroEquity:hEq/total,villainEquity:vEq/total,ties:tie,heroWins:hWin,villainWins:vWin,weightedTrials:total,runouts,status:"OK",issues:[...hero.invalidEntries,...villain.invalidEntries].map(x=>`ENTRADA INVÁLIDA IGNORADA: ${x}`)};
}
