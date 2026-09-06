"use client";

import {useMemo,useState} from "react";
import {mathConcepts} from "@/data/math-concepts";
import {answerLabel,checkPracticeAnswer,createPracticeProblem} from "@/lib/math-practice";
import {bluffBreakEven,callEV,impliedFutureWinNeeded,mdf,outsExactEquity,percent,requiredEquity,spr} from "@/lib/poker-math";
import styles from "./MathLabWorkspace.module.css";

type Tab="concepts"|"practice"|"doubts";
type AiResponse={answer?:string;error?:string};

export default function MathLabWorkspace(){
  const[tab,setTab]=useState<Tab>("concepts");
  const[conceptId,setConceptId]=useState("pot-odds");
  const[seed,setSeed]=useState(()=>Date.now());
  const[practiceAnswer,setPracticeAnswer]=useState("");
  const[checked,setChecked]=useState(false);
  const[question,setQuestion]=useState("");
  const[aiAnswer,setAiAnswer]=useState("");
  const[aiError,setAiError]=useState("");
  const[asking,setAsking]=useState(false);
  const[pot,setPot]=useState("80");const[bet,setBet]=useState("40");const[stack,setStack]=useState("240");const[equity,setEquity]=useState("30");const[outs,setOuts]=useState("9");const[cardsToCome,setCardsToCome]=useState<1|2>(1);
  const concept=useMemo(()=>mathConcepts.find(item=>item.id===conceptId)??mathConcepts[0],[conceptId]);
  const problem=useMemo(()=>createPracticeProblem(seed),[seed]);
  const result=checked?checkPracticeAnswer(problem,practiceAnswer):null;
  const safe=(value:string)=>Math.max(0,Number(value.replace(",","."))||0);
  const potN=safe(pot),betN=safe(bet),stackN=safe(stack),equityN=Math.min(100,safe(equity))/100,outsN=Math.round(safe(outs));

  function changeTab(next:Tab){if(tab===next)return;setTab(next);setAiError("")}
  function nextProblem(){setSeed(value=>value+7919);setPracticeAnswer("");setChecked(false)}
  function speak(){if(!("speechSynthesis" in window))return;speechSynthesis.cancel();speechSynthesis.speak(new SpeechSynthesisUtterance(`${concept.title}. ${concept.what} ${concept.purpose} ${concept.formula} ${concept.when} ${concept.example}`))}
  async function askMath(){const text=question.trim();if(text.length<3||asking)return;setAsking(true);setAiError("");setAiAnswer("");try{const response=await fetch("/api/poker-ai",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({question:`RESPONDA COMO TUTOR DE MATEMÁTICA DO POKER. SEPARE DADOS EXATOS DE ESTIMATIVAS E MOSTRE A FÓRMULA QUANDO HOUVER CÁLCULO. PERGUNTA: ${text}`})});const data=await response.json() as AiResponse;if(!response.ok||!data.answer)throw new Error(data.error||"AI_TEMPORARILY_UNAVAILABLE");setAiAnswer(data.answer.toLocaleUpperCase("pt-BR"))}catch{setAiError("STACKUP AI INDISPONÍVEL NO MOMENTO. OS CÁLCULOS DETERMINÍSTICOS ABAIXO CONTINUAM FUNCIONANDO NORMALMENTE.")}finally{setAsking(false)}}

  return <div className={styles.shell}>
    <div className={styles.head}><div><div className="eyebrow">POKER MATH LAB</div><h2>MATEMÁTICA DO POKER</h2></div><div className={styles.tabs}>{(["concepts","practice","doubts"] as Tab[]).map(item=><button type="button" key={item} aria-pressed={tab===item} className={tab===item?styles.active:""} onClick={()=>changeTab(item)}>{item==="concepts"?"CONCEITOS":item==="practice"?"PRÁTICA":"DÚVIDAS"}</button>)}</div></div>
    {tab==="concepts"&&<div className={styles.conceptLayout}><aside>{mathConcepts.map(item=><button type="button" key={item.id} aria-pressed={conceptId===item.id} className={conceptId===item.id?styles.active:""} onClick={()=>setConceptId(item.id)}>{item.title}</button>)}</aside><article className={styles.explanation}><span className="tag">CONCEITO</span><h3>{concept.title}</h3><Info title="O QUE É" text={concept.what}/><Info title="PARA QUE SERVE" text={concept.purpose}/><Info title="COMO CALCULAR" text={concept.formula}/><Info title="QUANDO USAR" text={concept.when}/><Info title="EXEMPLO" text={concept.example}/><Info title="NA MESA" text={concept.table}/><button type="button" className="primary" onClick={speak}>▶ OUVIR EXPLICAÇÃO</button></article></div>}
    {tab==="practice"&&<div className={styles.practice}><section className={styles.problem}><div className="tag">{problem.kind} · EXERCÍCIO DINÂMICO</div><h3>{problem.title}</h3><p>{problem.prompt}</p><div className={styles.context}>{problem.context.map(item=><span key={item}>{item}</span>)}</div><div className={styles.answerRow}><input inputMode="decimal" value={practiceAnswer} onChange={e=>{setPracticeAnswer(e.target.value);setChecked(false)}} placeholder="SUA RESPOSTA"/><b>{problem.unit}</b></div><div className={styles.actions}><button type="button" className="primary" onClick={()=>setChecked(true)} disabled={!practiceAnswer.trim()}>VERIFICAR</button><button type="button" onClick={nextProblem}>PRÓXIMO PROBLEMA</button></div>{result&&<div className={`${styles.feedback} ${result.correct?styles.ok:styles.bad}`}><strong>{result.correct?`CORRETO · ${answerLabel(problem)}`:`RESPOSTA: ${answerLabel(problem)}`}</strong><p>{problem.explanation}</p><small>{problem.tableNote}</small></div>}</section><section className={styles.trainingInfo}><span className="tag">TREINO ATIVO</span><h3>SEM DECOREBA</h3><p>OS VALORES E O TIPO DE EXERCÍCIO MUDAM A CADA PROBLEMA.</p></section></div>}
    {tab==="doubts"&&<div className={styles.doubts}><section className={styles.card}><span className="tag">DÚVIDA LIVRE</span><h3>PERGUNTE SOBRE MATEMÁTICA</h3><textarea value={question} onChange={e=>setQuestion(e.target.value)} placeholder="EX.: POR QUE UMA APOSTA DE 1/2 POTE PRECISA FUNCIONAR 33,3% DAS VEZES COMO BLUFF PURO?"/><button type="button" className="primary" onClick={()=>void askMath()} disabled={asking||question.trim().length<3}>{asking?"ANALISANDO...":"EXPLICAR COM STACKUP AI"}</button>{aiError&&<div className={styles.error}>{aiError}</div>}{aiAnswer&&<article className={styles.aiAnswer}>{aiAnswer}</article>}</section><section className={styles.card}><span className="tag">CALCULADORA DE SPOT</span><h3>DADOS EXATOS</h3><div className={styles.grid}><Field label="POTE" value={pot} onChange={setPot}/><Field label="APOSTA" value={bet} onChange={setBet}/><Field label="STACK EFETIVO" value={stack} onChange={setStack}/><Field label="EQUITY ESTIMADA %" value={equity} onChange={setEquity}/><Field label="OUTS" value={outs} onChange={setOuts}/><label>CARTAS POR VIR<select value={cardsToCome} onChange={e=>setCardsToCome(Number(e.target.value) as 1|2)}><option value={1}>1</option><option value={2}>2</option></select></label></div><div className={styles.metrics}><Metric label="EQUITY MÍNIMA" value={percent(requiredEquity(potN,betN))}/><Metric label="SPR" value={spr(stackN,potN||1).toFixed(2)}/><Metric label="MDF" value={percent(mdf(potN,betN))}/><Metric label="ALPHA" value={percent(bluffBreakEven(potN,betN))}/><Metric label="EV DO CALL" value={`${callEV(equityN,potN,betN).toFixed(2)} BB`}/><Metric label="EQUITY DOS OUTS" value={percent(outsExactEquity(outsN,cardsToCome))}/><Metric label="VALOR FUTURO NECESSÁRIO" value={`${impliedFutureWinNeeded(potN,betN,betN,equityN).toFixed(2)} BB`}/></div><small className={styles.exact}>● CÁLCULOS DETERMINÍSTICOS</small></section></div>}
  </div>;
}
function Info({title,text}:{title:string;text:string}){return <div className={styles.info}><b>{title}</b><p>{text.toLocaleUpperCase("pt-BR")}</p></div>}
function Metric({label,value}:{label:string;value:string}){return <div className={styles.metric}><small>{label}</small><strong>{value}</strong></div>}
function Field({label,value,onChange}:{label:string;value:string;onChange:(value:string)=>void}){return <label>{label}<input inputMode="decimal" value={value} onChange={e=>onChange(e.target.value)}/></label>}
