import type {PlayerAction} from "@/data/player-dna-spots";
import type {SolverSpotState} from "@/lib/player-dna-solver-v2";

export type TechnicalActionMix={action:PlayerAction;frequency:number;classification:"MAIOR EV"|"MISTA"|"MENOR EV"};
export type DiagnosticSection={key:string;label:string;text:string};
export type TechnicalDecision={
  verdict:"AÇÃO CORRETA (+EV)"|"AÇÃO AJUSTÁVEL (MISTA / EV NEUTRO)"|"AÇÃO INCORRETA (-EV)";
  mix:TechnicalActionMix[];
  summary:string;
  handClass:string;
  estimatedEquity:number;
  diagnosticStrength:number;
  potOdds:number;
  spr:number;
  mdf:number;
  effectiveStack:number;
  confidence:"ALTA"|"MÉDIA"|"BAIXA";
  bestAction:PlayerAction;
  diagnostics:string[];
  sections:DiagnosticSection[];
  comments:string[];
};

const rankValue:Record<string,number>={"2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"T":10,"J":11,"Q":12,"K":13,"A":14};
const positionRank:Record<string,number>={SB:0,BB:1,UTG:2,"UTG+1":3,UTG1:3,"UTG+2":4,UTG2:4,MP:5,MP1:5,MP2:6,"MP+1":6,LJ:7,HJ:8,CO:9,BTN:10};
function clamp(v:number,min=0,max=1){return Math.max(min,Math.min(max,v))}
function round(v:number,p=1){const f=10**p;return Math.round(v*f)/f}
function parseCard(card:string){const c=card.trim().toUpperCase();return{rank:c[0]??"2",suit:c.slice(1)}}
function combinations<T>(items:T[],k:number){const out:T[][]=[];const walk=(start:number,pick:T[])=>{if(pick.length===k){out.push(pick);return}for(let i=start;i<items.length;i++)walk(i+1,[...pick,items[i]])};walk(0,[]);return out}
function fiveCardRank(raw:{rank:string;suit:string}[]){const values=raw.map(c=>rankValue[c.rank]??2).sort((a,b)=>b-a),counts=new Map<number,number>();values.forEach(v=>counts.set(v,(counts.get(v)??0)+1));const groups=[...counts.entries()].sort((a,b)=>b[1]-a[1]||b[0]-a[0]),unique=[...new Set(values)];if(unique.includes(14))unique.push(1);let straightHigh=0;for(let high=14;high>=5;high--){if([0,1,2,3,4].every(d=>unique.includes(high-d))){straightHigh=high;break}}const flush=raw.every(c=>c.suit===raw[0].suit);if(flush&&straightHigh)return{cat:8,label:"STRAIGHT FLUSH",score:8e6+straightHigh};if(groups[0][1]===4)return{cat:7,label:"QUADRA",score:7e6+groups[0][0]*100+groups[1][0]};if(groups[0][1]===3&&groups[1]?.[1]===2)return{cat:6,label:"FULL HOUSE",score:6e6+groups[0][0]*100+groups[1][0]};if(flush)return{cat:5,label:"FLUSH",score:5e6+values.reduce((s,v,i)=>s+v*10**(4-i),0)};if(straightHigh)return{cat:4,label:"SEQUÊNCIA",score:4e6+straightHigh};if(groups[0][1]===3)return{cat:3,label:"TRINCA",score:3e6+groups[0][0]*10000};if(groups[0][1]===2&&groups[1]?.[1]===2){const p=[groups[0][0],groups[1][0]].sort((a,b)=>b-a);return{cat:2,label:"DOIS PARES",score:2e6+p[0]*10000+p[1]*100+(groups[2]?.[0]??0)}}if(groups[0][1]===2)return{cat:1,label:"PAR",score:1e6+groups[0][0]*10000};return{cat:0,label:"HIGH CARD",score:values.reduce((s,v,i)=>s+v*10**(4-i),0)}}

function drawProfile(state:SolverSpotState){
  const all=[...state.hero.cards,...state.board].map(parseCard),suits=new Map<string,number>();all.forEach(c=>suits.set(c.suit,(suits.get(c.suit)??0)+1));
  const flushDraw=[...suits.values()].some(v=>v===4),ranks=[...new Set(all.map(c=>rankValue[c.rank]??2))];if(ranks.includes(14))ranks.push(1);ranks.sort((a,b)=>a-b);
  let oesd=false,gutshot=false;for(let start=1;start<=10;start++){const present=[0,1,2,3,4].filter(d=>ranks.includes(start+d));if(present.length===4){const missing=[0,1,2,3,4].find(d=>!ranks.includes(start+d));if(missing===0||missing===4)oesd=true;else gutshot=true}}
  const boardSuits=state.board.map(parseCard).map(c=>c.suit),heroSuits=state.hero.cards.map(parseCard).map(c=>c.suit),backdoorFlush=state.street==="FLOP"&&heroSuits.some(s=>boardSuits.filter(x=>x===s).length===1);
  return{flushDraw,oesd,gutshot,backdoorFlush,label:flushDraw?"FLUSH DRAW":oesd?"OESD":gutshot?"GUTSHOT":backdoorFlush?"BACKDOOR FLUSH":"SEM DRAW RELEVANTE"};
}
function postflopStrength(state:SolverSpotState){const all=[...state.hero.cards,...state.board].map(parseCard);if(all.length<5)return{strength:.2,label:"MÃO NÃO CLASSIFICADA",nutty:false};const best=combinations(all,5).map(fiveCardRank).sort((a,b)=>b.score-a.score)[0];let strength=[.15,.36,.59,.72,.81,.88,.94,.975,.995][best.cat]??.15;const heroRanks=state.hero.cards.map(parseCard).map(c=>rankValue[c.rank]??2),boardRanks=state.board.map(parseCard).map(c=>rankValue[c.rank]??2),topBoard=Math.max(0,...boardRanks);if(best.cat===1&&heroRanks.some(r=>r===topBoard))strength+=.07;return{strength:clamp(strength,.03,.995),label:best.label,nutty:best.cat>=4}}
function preflopStrength(state:SolverSpotState){const h=state.hero.cards.map(parseCard);if(h.length<2)return{strength:.2,label:"MÃO NÃO CLASSIFICADA",nutty:false};const a=rankValue[h[0].rank]??2,b=rankValue[h[1].rank]??2,hi=Math.max(a,b),lo=Math.min(a,b),pair=a===b,suited=h[0].suit===h[1].suit,gap=hi-lo;let s=.06+(hi-2)/12*.24+(lo-2)/12*.10;if(pair)s=.28+(hi-2)/12*.55;if(suited)s+=.04;if(gap===1)s+=.03;else if(gap===2)s+=.015;if(hi===14&&lo>=10)s+=.12;if(hi===13&&lo>=11)s+=.06;if(hi<=12&&lo<=9&&!suited&&gap>=3)s-=.06;return{strength:clamp(s,.03,.97),label:pair?`${h[0].rank}${h[1].rank}`:`${h[0].rank}${h[1].rank}${suited?"S":"O"}`,nutty:pair&&hi>=12||hi===14&&lo>=13}}
function math(state:SolverSpotState){const heroPos=state.hero.position.toUpperCase(),active=state.players.filter(p=>p.action.toUpperCase()!=="FOLD"&&p.position.toUpperCase()!==heroPos),blind=state.street==="PREFLOP"?(heroPos==="SB"?.5:heroPos==="BB"?1:0):0,maxCommit=Math.max(0,...state.players.filter(p=>p.action.toUpperCase()!=="FOLD").map(p=>p.value)),toCall=Math.max(0,state.heroToCall??(maxCommit-blind)),pot=Math.max(0,state.pot),potOdds=toCall>0?toCall/(pot+toCall):0,eff=Math.max(0,Math.min(state.hero.stack,...(active.length?active.map(p=>p.stack):[state.hero.stack]))),spr=pot>0?eff/pot:0,mdf=toCall>0&&pot>0?pot/(pot+toCall):1;return{toCall,potOdds,spr,mdf,opponents:active.length,multiway:active.length>1,effective:eff}}
function texture(state:SolverSpotState){if(state.street==="PREFLOP")return{wet:false,paired:false,monotone:false,twoTone:false,connected:false,high:false,label:"PRÉ-FLOP"};const cards=state.board.map(parseCard),ranks=cards.map(c=>rankValue[c.rank]??2),suits=cards.map(c=>c.suit),paired=new Set(ranks).size<ranks.length,suitCount=new Map<string,number>();suits.forEach(s=>suitCount.set(s,(suitCount.get(s)??0)+1));const monotone=[...suitCount.values()].some(v=>v>=3),twoTone=[...suitCount.values()].some(v=>v===2),sorted=[...new Set(ranks)].sort((a,b)=>a-b);let connected=false;for(let i=0;i<sorted.length;i++)for(let j=i+1;j<sorted.length;j++)if(sorted[j]-sorted[i]<=4&&j-i>=2)connected=true;const high=Math.max(0,...ranks)>=12;const wet=monotone||connected||twoTone;return{wet,paired,monotone,twoTone,connected,high,label:`${paired?"PAREADO":"NÃO PAREADO"} · ${monotone?"MONOTONE":twoTone?"TWO-TONE":"RAINBOW"} · ${connected?"CONECTADO":"SECO"}`}}
function positionalProfile(state:SolverSpotState){const hero=positionRank[state.hero.position.toUpperCase()]??5;const active=state.players.filter(p=>p.action.toUpperCase()!=="FOLD"&&p.position.toUpperCase()!==state.hero.position.toUpperCase()).map(p=>positionRank[p.position.toUpperCase()]??5);if(!active.length)return{factor:0,label:"SEM ADVERSÁRIO ATIVO"};const avg=active.reduce((a,b)=>a+b,0)/active.length;return hero>avg?{factor:.04,label:"IP / VANTAGEM POSICIONAL"}:hero<avg?{factor:-.035,label:"OOP / DESVANTAGEM POSICIONAL"}:{factor:0,label:"POSIÇÃO NEUTRA"}}
function pressureProfile(state:SolverSpotState){const h=state.actionHistory??[];const raises=h.filter(x=>x.action.toUpperCase()==="RAISE").length,allins=h.filter(x=>x.action.toUpperCase()==="ALL-IN").length,calls=h.filter(x=>x.action.toUpperCase()==="CALL").length,bets=h.filter(x=>x.action.toUpperCase()==="BET").length;const aggression=raises+allins*2+bets;return{raises,allins,calls,bets,aggression,label:allins?"PRESSÃO MÁXIMA / ALL-IN":raises>=2?"3-BET+ / RANGE COMPRIMIDO":raises||bets?"PRESSÃO AGRESSIVA":calls>=2?"MULTI-CALL / RANGE CONDENSADO":"PRESSÃO PADRÃO"}}
function sizingRisk(selectedSizing?:string){if(!selectedSizing)return 0;const s=selectedSizing.toUpperCase();if(s.includes("150%"))return .18;if(s.includes("125%"))return .12;if(s.includes("POT"))return .08;if(s.includes("4X"))return .12;if(s.includes("3X"))return .07;if(s.includes("SQUEEZE"))return .11;return 0}
function sizingLabel(selectedSizing?:string){if(!selectedSizing)return"SEM SIZING SELECIONADO";const risk=sizingRisk(selectedSizing);return`${selectedSizing.toUpperCase()} · ${risk>=.12?"POLAR / ALTA EXIGÊNCIA":risk>=.07?"PRESSÃO ELEVADA":"SIZING PADRÃO"}`}
function rankActions(scores:Record<string,number>,legal:PlayerAction[]){const uniq=[...new Set(legal)],sorted=uniq.map(action=>({action,score:scores[action]??-99})).sort((a,b)=>b.score-a.score),best=sorted[0]?.score??0,worst=sorted.length?sorted[sorted.length-1].score:0;return sorted.map(x=>({action:x.action,frequency:0,classification:(best-x.score<=.10?"MAIOR EV":x.score-worst<=.10?"MENOR EV":"MISTA") as TechnicalActionMix["classification"]}))}
function tournamentProfile(state:SolverSpotState,m:{effective:number;multiway:boolean}){if(state.mode!=="TORNEIO")return{active:false,penalty:0,label:"CASH · SEM RISK PREMIUM DE TORNEIO",confidencePenalty:0};const hasIcmData=Boolean(state.payouts?.length&&state.fieldStacks?.length);const short=m.effective<=25;const penalty=(short?.06:.025)+(m.multiway?.025:0);return{active:true,penalty,label:hasIcmData?`TORNEIO · CONTEXTO DE PAYOUT DISPONÍVEL${short?" · STACK CURTO":""}`:`TORNEIO · RISK PREMIUM CONTEXTUAL${short?" · STACK CURTO":""} · SEM DADOS COMPLETOS DE ICM`,confidencePenalty:hasIcmData?0:1}}
function confidence(state:SolverSpotState,m:{multiway:boolean},tour:{confidencePenalty:number}){let score=4;if(m.multiway)score--;score-=tour.confidencePenalty;if(state.mode==="CASH"&&state.rakePct===undefined)score--;if(!(state.actionHistory?.length))score--;return score>=3?"ALTA":score===2?"MÉDIA":"BAIXA" as const}
function rangeProfile(state:SolverSpotState,pressure:{raises:number;allins:number;calls:number;aggression:number},m:{multiway:boolean}){const heroPos=state.hero.position.toUpperCase(),pos=positionRank[heroPos]??5;let label=pos<=4?"POSIÇÃO INICIAL / RANGE HERO MAIS FORTE":pos>=8?"POSIÇÃO TARDIA / RANGE HERO MAIS AMPLO":"POSIÇÃO MÉDIA / RANGE INTERMEDIÁRIO";if(pressure.allins)label+=" · RANGE ADVERSÁRIO MUITO COMPRIMIDO";else if(pressure.raises>=2)label+=" · 3-BET+ COMPRIME RANGES";else if(pressure.raises)label+=" · AGRESSÃO REDUZ CONTINUAÇÕES";if(m.multiway)label+=" · MULTIWAY ELEVA REQUISITO DE EQUITY/NUTS";return label}
function blockerProfile(state:SolverSpotState,board:{monotone:boolean;paired:boolean;high:boolean}){if(state.street==="PREFLOP")return"BLOCKERS PRÉ-FLOP CONSIDERADOS PELA ESTRUTURA DE RANKS";const hero=state.hero.cards.map(parseCard),b=state.board.map(parseCard);const top=Math.max(0,...b.map(c=>rankValue[c.rank]??2)),overcards=hero.filter(c=>(rankValue[c.rank]??2)>top).length;const nutSuit=board.monotone&&hero.some(c=>c.rank==="A"&&b.some(x=>x.suit===c.suit));return`${nutSuit?"NUT FLUSH BLOCKER PRESENTE":"SEM NUT BLOCKER DOMINANTE"}${overcards?` · ${overcards} OVERCARD(S)`:""}${board.paired?" · BOARD PAREADO MUDA NUT ADVANTAGE":""}`}

export function analyzeTechnicalDecision(state:SolverSpotState,selectedAction:PlayerAction,legalActions:PlayerAction[],selectedSizing?:string):TechnicalDecision{
  const m=math(state),hand=state.street==="PREFLOP"?preflopStrength(state):postflopStrength(state),board=texture(state),draw=drawProfile(state),pressure=pressureProfile(state),position=positionalProfile(state),tour=tournamentProfile(state,m);let strength=hand.strength+position.factor;
  if(m.opponents>1)strength*=Math.pow(.78,m.opponents-1);
  if(state.street==="PREFLOP"){strength-=Math.min(.24,pressure.aggression*.05);if(m.toCall>=8)strength-=.04;if(m.toCall>=12)strength-=.05;if(m.toCall>=20)strength-=.06;if(m.multiway)strength-=.035;if(state.hero.position.toUpperCase()==="SB")strength-=.025}
  else{if(board.wet&&!hand.nutty)strength-=.025;if(m.multiway&&!hand.nutty)strength-=.055;if(draw.flushDraw||draw.oesd)strength+=.04;else if(draw.gutshot)strength+=.018}
  strength-=tour.penalty;strength=clamp(strength,.01,.995);
  const margin=strength-m.potOdds,score:Record<string,number>={FOLD:-99,CHECK:-99,CALL:-99,BET:-99,RAISE:-99,"ALL-IN":-99};
  if(m.toCall>0){score.FOLD=.52-margin*3.8+(m.multiway?.28:0)+(tour.active?.12:0)+(pressure.aggression>=2?.12:0);score.CALL=.46+margin*4.8-(m.multiway?.29:0)-(pressure.aggression>=2?.14:0)-(tour.active?.08:0);score.RAISE=.08+strength*1.92+((draw.flushDraw||draw.oesd)?.10:0)+(hand.nutty?.20:0)-(m.multiway?.27:0)-(tour.active?.12:0)-sizingRisk(selectedSizing);score["ALL-IN"]=-.12+strength*2.12+(m.spr<=1.5?.34:0)+(hand.nutty?.22:0)-(m.multiway?.32:0)-(tour.active?.22:0)}else{score.CHECK=.58+(1-strength)*.48+(board.wet&&!hand.nutty?.08:0);score.BET=.30+strength*1.72+((draw.flushDraw||draw.oesd)?.10:0)+(board.high?.04:0)-sizingRisk(selectedSizing);score.RAISE=score.BET-.05;score["ALL-IN"]=-.18+strength*2+(m.spr<=1?.36:0)+(hand.nutty?.16:0)-(tour.active?.18:0)}
  if(state.street==="PREFLOP"&&m.multiway&&m.toCall>=10&&!hand.nutty){score.FOLD+=.35;score.CALL-=.34;score.RAISE-=.15;score["ALL-IN"]-=.25}
  const legal=[...new Set(legalActions)],mix=rankActions(score,legal),best=mix[0]?.action??selectedAction,chosenScore=score[selectedAction]??-99,bestScore=Math.max(...legal.map(a=>score[a]??-99)),gap=bestScore-chosenScore;let verdict:TechnicalDecision["verdict"]="AÇÃO AJUSTÁVEL (MISTA / EV NEUTRO)";if(gap<=.10)verdict="AÇÃO CORRETA (+EV)";else if(gap>=.48)verdict="AÇÃO INCORRETA (-EV)";
  const conf=confidence(state,m,tour),idx=round(strength*100,0),range=rangeProfile(state,pressure,m),blockers=blockerProfile(state,board),structure=`${state.mode} · ${state.street} · ${m.multiway?`${m.opponents+1}-WAY`:"HEADS-UP"} · STACK EFETIVO ${round(m.effective,1)} BB · ${position.label}`;
  const sections:DiagnosticSection[]=[
    {key:"ESTRUTURA",label:"CONTEXTO ESTRUTURAL",text:structure},
    {key:"RANGES",label:"RANGES E PRÉ-FLOP",text:range},
    {key:"BOARD",label:"TEXTURA DO BOARD",text:state.street==="PREFLOP"?"PRÉ-FLOP · SEM BOARD":`${board.label} · ${draw.label}`},
    {key:"MATH",label:"MATEMÁTICA DO POTE",text:`TO CALL ${round(m.toCall,1)} BB · POT ODDS ${round(m.potOdds*100,1)}% · SPR ${round(m.spr,2)} · MDF ${round(m.mdf*100,1)}%`},
    {key:"BET",label:"ARQUITETURA DE APOSTA",text:`${pressure.label} · ${sizingLabel(selectedSizing)}`},
    {key:"GTO",label:"EXECUÇÃO GTO DIAGNÓSTICA",text:`ÍNDICE ESTRATÉGICO ${idx}/100 · MELHOR LINHA ${best} · GAP RELATIVO ${round(gap,2)}`},
    {key:"BLOCKERS",label:"BLOCKERS E NUT ADVANTAGE",text:blockers},
    {key:"EXPLOIT",label:"EXPLOIT / MDA",text:"SEM DADOS POPULACIONAIS: NÃO APLICAR DESVIO EXPLOIT COMO VERDADE; PRIORIZAR LINHA ROBUSTA"},
    {key:"TOURNAMENT",label:"TORNEIO / ICM / RISK PREMIUM",text:tour.label},
    {key:"CONFIDENCE",label:"CONFIANÇA E LIMITES",text:`CONFIANÇA ${conf} · MODELO DIAGNÓSTICO GTO + MATEMÁTICA; SEM FREQUÊNCIAS OU EV EXATOS INVENTADOS`},
  ];
  const diagnostics=sections.map(s=>`${s.label}: ${s.text}`);
  const comments=[
    selectedAction===best?"A AÇÃO ESCOLHIDA COINCIDE COM A LINHA PRINCIPAL DO MODELO DIAGNÓSTICO.":`A AÇÃO ESCOLHIDA PERDE PRIORIDADE PARA ${best} NESTA CONFIGURAÇÃO.`,
    m.multiway?"EM MULTIWAY, EXIGIR MAIS EQUITY REALIZÁVEL E MAIS NUT POTENTIAL; REDUZIR CONTINUAÇÕES MARGINAIS.":"HEADS-UP PERMITE DEFENDER/AGREDIR MAIS AMPLO QUE MULTIWAY, SUJEITO À POSIÇÃO E AO SIZING.",
    tour.active?"EM TORNEIOS, RISCO DE ELIMINAÇÃO E PAYOUTS PODEM MUDAR A DECISÃO; SEM DADOS COMPLETOS, O AJUSTE É CONSERVADOR.":"EM CASH, RISCO DE ELIMINAÇÃO NÃO ENTRA; RAKE E PROFUNDIDADE DEVEM SER CONSIDERADOS QUANDO DISPONÍVEIS.",
  ];
  const summary=`${hand.label} · ${m.multiway?"MULTIWAY":"HEADS-UP"} · POT ODDS ${round(m.potOdds*100,1)}% · SPR ${round(m.spr,2)} · CONFIANÇA ${conf}`;
  return{verdict,mix,summary,handClass:hand.label,estimatedEquity:idx,diagnosticStrength:idx,potOdds:round(m.potOdds*100,1),spr:round(m.spr,2),mdf:round(m.mdf*100,1),effectiveStack:round(m.effective,1),confidence:conf,bestAction:best,diagnostics,sections,comments};
}
