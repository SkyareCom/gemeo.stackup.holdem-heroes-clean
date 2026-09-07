import type {PlayerAction} from "@/data/player-dna-spots";
import type {SolverSpotState} from "@/lib/player-dna-solver-v2";

export type TechnicalActionMix={action:PlayerAction;frequency:number;classification:"MAIOR EV"|"MISTA"|"MENOR EV"};
export type TechnicalDecision={
  verdict:"AÇÃO CORRETA (+EV)"|"AÇÃO AJUSTÁVEL (MISTA / EV NEUTRO)"|"AÇÃO INCORRETA (-EV)";
  mix:TechnicalActionMix[];
  summary:string;
  handClass:string;
  estimatedEquity:number;
  potOdds:number;
  spr:number;
};

const rankValue:Record<string,number>={"2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"T":10,"J":11,"Q":12,"K":13,"A":14};

function clamp(v:number,min=0,max=1){return Math.max(min,Math.min(max,v))}
function round(v:number,p=1){const f=10**p;return Math.round(v*f)/f}
function parseCard(card:string){const c=card.trim().toUpperCase();return{rank:c[0]??"2",suit:c.slice(1)}}
function cards(state:SolverSpotState){return [...state.hero.cards,...state.board].map(parseCard)}

function hasStraight(values:number[]){
  const unique=[...new Set(values)].sort((a,b)=>a-b);if(unique.includes(14))unique.unshift(1);
  let run=1;for(let i=1;i<unique.length;i++){if(unique[i]===unique[i-1]+1){run++;if(run>=5)return true}else run=1}return false;
}
function straightDraw(values:number[]){
  const unique=[...new Set(values)].sort((a,b)=>a-b);if(unique.includes(14))unique.unshift(1);
  for(let start=1;start<=10;start++){let hits=0;for(let n=start;n<start+5;n++)if(unique.includes(n))hits++;if(hits===4)return true}return false;
}

function evaluateMadeHand(state:SolverSpotState){
  const all=cards(state);const values=all.map(c=>rankValue[c.rank]??2);const suits=all.map(c=>c.suit);
  const rankCounts=new Map<number,number>();values.forEach(v=>rankCounts.set(v,(rankCounts.get(v)??0)+1));
  const counts=[...rankCounts.values()].sort((a,b)=>b-a);
  const suitCounts=new Map<string,number>();suits.forEach(s=>suitCounts.set(s,(suitCounts.get(s)??0)+1));
  const flush=[...suitCounts.values()].some(n=>n>=5);const flushDraw=[...suitCounts.values()].some(n=>n===4);
  const straight=hasStraight(values);const oesd=straightDraw(values);
  if(straight&&flush)return{strength:.98,label:"STRAIGHT/FLUSH+",draw:false};
  if(counts[0]>=4)return{strength:.97,label:"QUADRA",draw:false};
  if(counts[0]>=3&&counts[1]>=2)return{strength:.95,label:"FULL HOUSE",draw:false};
  if(flush)return{strength:.91,label:"FLUSH",draw:false};
  if(straight)return{strength:.87,label:"SEQUÊNCIA",draw:false};
  if(counts[0]>=3)return{strength:.78,label:"TRINCA",draw:flushDraw||oesd};
  if(counts[0]===2&&counts[1]===2)return{strength:.70,label:"DOIS PARES",draw:flushDraw||oesd};
  if(counts[0]===2){
    const pairRank=[...rankCounts.entries()].find(([,n])=>n===2)?.[0]??2;
    const boardValues=state.board.map(parseCard).map(c=>rankValue[c.rank]??2);
    const top=Math.max(0,...boardValues);
    const kicker=Math.max(...state.hero.cards.map(parseCard).map(c=>rankValue[c.rank]??2));
    const topPair=pairRank>=top;
    return{strength:topPair?.60+(kicker>=12?.06:0):.47,label:topPair?"TOP PAIR":"PAR",draw:flushDraw||oesd};
  }
  if(flushDraw&&oesd)return{strength:.51,label:"COMBO DRAW",draw:true};
  if(flushDraw)return{strength:.42,label:"FLUSH DRAW",draw:true};
  if(oesd)return{strength:.39,label:"STRAIGHT DRAW",draw:true};
  const high=Math.max(...state.hero.cards.map(parseCard).map(c=>rankValue[c.rank]??2));
  return{strength:.18+(high-2)/12*.17,label:"HIGH CARD",draw:false};
}

function preflopStrength(state:SolverSpotState){
  const h=state.hero.cards.map(parseCard);if(h.length<2)return{strength:.35,label:"MÃO NÃO CLASSIFICADA",draw:false};
  const a=rankValue[h[0].rank]??2,b=rankValue[h[1].rank]??2;const hi=Math.max(a,b),lo=Math.min(a,b);const pair=a===b,suited=h[0].suit===h[1].suit,gap=hi-lo;
  let s=.22+(hi-2)/12*.32+(lo-2)/12*.16;
  if(pair)s=.42+(hi-2)/12*.48;
  if(suited)s+=.05;if(gap===1)s+=.04;else if(gap===2)s+=.02;if(hi===14&&lo>=10)s+=.12;if(hi===13&&lo>=11)s+=.07;
  s=clamp(s,.08,.98);
  return{strength:s,label:pair?`${h[0].rank}${h[1].rank}`:`${h[0].rank}${h[1].rank}${suited?"S":"O"}`,draw:false};
}

function math(state:SolverSpotState){
  const live=state.players.filter(p=>p.action.toUpperCase()!=="FOLD");const heroPos=state.hero.position.toUpperCase();
  const heroBlind=state.street==="PREFLOP"?(heroPos==="SB"?.5:heroPos==="BB"?1:0):0;
  const maxCommit=Math.max(0,...live.map(p=>p.value));const toCall=Math.max(0,maxCommit-heroBlind);
  const potOdds=toCall>0?toCall/(Math.max(0,state.pot)+toCall):0;
  const opponents=live.filter(p=>p.position.toUpperCase()!==heroPos);const eff=Math.min(state.hero.stack,...(opponents.length?opponents.map(p=>p.stack):[state.hero.stack]));
  const spr=state.pot>0?eff/state.pot:0;return{toCall,potOdds,spr,heads:opponents.length,multiway:opponents.length>1};
}

function positionBonus(position:string){const p=position.toUpperCase();if(["BTN","CO"].includes(p))return .05;if(["HJ","LJ"].includes(p))return .02;if(["SB","BB"].includes(p))return -.03;return 0}

function softmax(scores:Record<string,number>,legal:PlayerAction[]){
  const vals=legal.map(a=>({a,v:scores[a]??-9}));const max=Math.max(...vals.map(x=>x.v));const exps=vals.map(x=>({a:x.a,e:Math.exp((x.v-max)*2.2)}));const sum=exps.reduce((s,x)=>s+x.e,0)||1;
  let freqs=exps.map(x=>({action:x.a,frequency:Math.max(0,Math.round(x.e/sum*1000)/10)}));
  const total=freqs.reduce((s,x)=>s+x.frequency,0);if(freqs.length)freqs[0].frequency=round(freqs[0].frequency+(100-total),1);
  const sorted=[...freqs].sort((a,b)=>b.frequency-a.frequency);const best=sorted[0]?.frequency??0;const worst=sorted[sorted.length-1]?.frequency??0;
  return freqs.sort((a,b)=>b.frequency-a.frequency).map(x=>({action:x.action,frequency:x.frequency,classification:(Math.abs(x.frequency-best)<.05?"MAIOR EV":Math.abs(x.frequency-worst)<.05?"MENOR EV":"MISTA") as TechnicalActionMix["classification"]}));
}

export function analyzeTechnicalDecision(state:SolverSpotState,selectedAction:PlayerAction,legalActions:PlayerAction[]):TechnicalDecision{
  const m=math(state);const hand=state.street==="PREFLOP"?preflopStrength(state):evaluateMadeHand(state);
  const scenario=state.scenario.join(" ").toUpperCase();
  const icm=state.mode==="TORNEIO"&&(scenario.includes("ICM")||scenario.includes("BOLHA")||scenario.includes("FT"));
  const pressure=icm?.08:0;const multiwayPenalty=m.multiway?.08:0;const pos=positionBonus(state.hero.position);
  const equity=clamp(hand.strength+pos-multiwayPenalty-pressure*.5,.03,.98);
  const facing=m.toCall>0;
  const score:Record<string,number>={FOLD:-9,CHECK:-9,CALL:-9,BET:-9,RAISE:-9,"ALL-IN":-9};
  if(facing){
    const margin=equity-m.potOdds;
    score.FOLD=1.1-margin*4+(icm?.35:0);
    score.CALL=1.2+margin*5+(hand.draw?.12:0)-Math.max(0,m.spr<1?.12:0);
    score.RAISE=.7+equity*2.2+(hand.draw?.28:0)+(m.spr<=3?.18:0)-(icm?.25:0)-(m.multiway?.12:0);
    score["ALL-IN"]=.25+equity*2.7+(m.spr<=1.5?.5:0)+(hand.strength>.8?.3:0)-(icm?.45:0);
  }else{
    score.CHECK=1.15+(1-equity)*.65+(hand.draw?.12:0);
    score.BET=.85+equity*2.0+(hand.draw?.22:0)+pos+(m.spr>1?.1:0);
    score["ALL-IN"]=-.1+equity*2.4+(m.spr<=1?.65:0)+(hand.strength>.88?.35:0)-(icm?.35:0);
    score.RAISE=score.BET;
  }
  const legal=legalActions.filter((a,i,arr)=>arr.indexOf(a)===i);const mix=softmax(score,legal);
  const chosen=mix.find(x=>x.action===selectedAction);const best=mix[0];
  let verdict:TechnicalDecision["verdict"]="AÇÃO INCORRETA (-EV)";
  if(chosen&&best){if(chosen.frequency>=Math.max(35,best.frequency*.72))verdict="AÇÃO CORRETA (+EV)";else if(chosen.frequency>=10)verdict="AÇÃO AJUSTÁVEL (MISTA / EV NEUTRO)";}
  const summary=`${hand.label} · EQ. BASE ${round(equity*100,1)}% · POT ODDS ${round(m.potOdds*100,1)}% · SPR ${round(m.spr,2)}${icm?" · PRESSÃO ICM":""}${m.multiway?" · MULTIWAY":""}`;
  return{verdict,mix,summary,handClass:hand.label,estimatedEquity:round(equity*100,1),potOdds:round(m.potOdds*100,1),spr:round(m.spr,2)};
}
