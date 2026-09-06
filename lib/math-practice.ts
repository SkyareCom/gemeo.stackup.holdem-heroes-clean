import {bluffBreakEven,mdf,outsExactEquity,percent,requiredEquity,spr} from "./poker-math";

export type PracticeKind="POT_ODDS"|"SPR"|"MDF"|"ALPHA"|"OUTS";
export type PracticeProblem={id:string;kind:PracticeKind;title:string;prompt:string;context:string[];answer:number;tolerance:number;unit:"%"|"x";explanation:string;tableNote:string};

type Rng=()=>number;
function mulberry32(seed:number):Rng{return()=>{let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
function pick<T>(rng:Rng,values:T[]){return values[Math.floor(rng()*values.length)]}

export function createPracticeProblem(seed=Date.now()):PracticeProblem{
  const rng=mulberry32(seed>>>0);
  const kind=pick(rng,["POT_ODDS","SPR","MDF","ALPHA","OUTS"] as PracticeKind[]);
  const pot=pick(rng,[40,60,80,100,120,150,200]);
  const betFraction=pick(rng,[0.25,0.33,0.5,0.67,0.75,1]);
  const bet=Math.max(10,Math.round((pot*betFraction)/5)*5);
  if(kind==="POT_ODDS"){
    const value=requiredEquity(pot,bet)*100;
    return{id:`pot-${seed}`,kind,title:"POT ODDS",prompt:"Qual é a equity mínima necessária para pagar?",context:[`POTE ANTES DA APOSTA ${pot} BB`,`VILLAIN BET ${bet} BB`,`CALL ${bet} BB`],answer:value,tolerance:0.6,unit:"%",explanation:`Equity mínima = call ÷ pote final = ${bet} ÷ (${pot} + ${bet} + ${bet}) = ${value.toFixed(1)}%.`,tableNote:"Compare este número com sua equity contra o range que aposta."};
  }
  if(kind==="SPR"){
    const stack=pick(rng,[120,160,200,240,300,400,500,600]);
    const value=spr(stack,pot);
    return{id:`spr-${seed}`,kind,title:"SPR",prompt:"Qual é o SPR no início desta street?",context:[`POTE ${pot} BB`,`STACK EFETIVO ${stack} BB`],answer:value,tolerance:0.08,unit:"x",explanation:`SPR = stack efetivo ÷ pote = ${stack} ÷ ${pot} = ${value.toFixed(2)}.`,tableNote:"SPR baixo reduz o espaço para manobras; SPR alto aumenta a importância de posição e realização de equity."};
  }
  if(kind==="MDF"){
    const value=mdf(pot,bet)*100;
    return{id:`mdf-${seed}`,kind,title:"MDF",prompt:"Qual é a frequência teórica mínima de defesa?",context:[`POTE ${pot} BB`,`APOSTA ${bet} BB`],answer:value,tolerance:0.6,unit:"%",explanation:`MDF = pote ÷ (pote + aposta) = ${pot} ÷ (${pot} + ${bet}) = ${value.toFixed(1)}%.`,tableNote:"MDF é referência teórica do range; não obriga cada mão individual a defender."};
  }
  if(kind==="ALPHA"){
    const value=bluffBreakEven(pot,bet)*100;
    return{id:`alpha-${seed}`,kind,title:"ALPHA",prompt:"Com que frequência este bluff puro precisa funcionar para empatar?",context:[`POTE ${pot} BB`,`BLUFF ${bet} BB`],answer:value,tolerance:0.6,unit:"%",explanation:`Alpha = aposta ÷ (pote + aposta) = ${bet} ÷ (${pot} + ${bet}) = ${value.toFixed(1)}%.`,tableNote:"Se o adversário foldar mais do que o alpha e o bluff não tiver equity, a aposta já ganha EV imediato."};
  }
  const outs=pick(rng,[4,5,8,9,12,15]);
  const cardsToCome=pick(rng,[1,2] as const);
  const value=outsExactEquity(outs,cardsToCome)*100;
  return{id:`outs-${seed}`,kind,title:"OUTS",prompt:`Qual é a chance exata aproximada de acertar pelo menos um dos ${outs} outs?`,context:[`${outs} OUTS`,cardsToCome===2?"DUAS CARTAS POR VIR":"UMA CARTA POR VIR"],answer:value,tolerance:0.8,unit:"%",explanation:cardsToCome===1?`Com uma carta por vir: ${outs}/46 = ${value.toFixed(1)}% (assumindo 46 cartas desconhecidas).`:`Com duas cartas por vir: 1 - ((47-${outs})/47 × (46-${outs})/46) = ${value.toFixed(1)}%.`,tableNote:"Só conte outs limpos; outs dominados ou que completam jogos melhores precisam ser descontados."};
}

export function checkPracticeAnswer(problem:PracticeProblem,input:string){
  const normalized=input.trim().replace(",",".");
  const number=Number(normalized);
  if(!Number.isFinite(number))return{valid:false,correct:false,difference:Infinity};
  const difference=Math.abs(number-problem.answer);
  return{valid:true,correct:difference<=problem.tolerance,difference};
}

export function answerLabel(problem:PracticeProblem){return problem.unit==="%"?percent(problem.answer/100):`${problem.answer.toFixed(2)}x`}
