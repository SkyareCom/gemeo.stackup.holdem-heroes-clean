"use client";

import {useEffect,useMemo,useState} from "react";
import PlayerDnaPokerTable from "@/components/PlayerDnaPokerTable";
import {evaluatePlayerDna,type DecisionSizing,type PlayerDnaAnswer} from "@/lib/player-dna";
import {buildBalancedSpotSession} from "@/lib/player-dna-sampler";
import {playerDnaSpots,type GameMode,type PlayerAction,type PlayerDnaSpot} from "@/data/player-dna-spots";
import styles from "./PlayerDnaWorkspace.module.css";

const depths=[100,250,500,1000,1500,3000] as const;
const STORAGE_KEY="stackup.player-dna.library.v2";
const LEGACY_STORAGE_KEY="stackup.player-dna.session.v1";
const betSizings:DecisionSizing[]=["25%","33%","50%","66%","75%","POT","125%","150%"];
const raiseSizings:DecisionSizing[]=["2X","2.5X","3X","4X","SQUEEZE"];

type AnalysisMode=GameMode|"ALEATORIO";
type SavedDnaSession={mode:AnalysisMode;target:number;index:number;answers:PlayerDnaAnswer[];finished:boolean;sessionSeed:number;updatedAt:number};
type DnaScores={aggression:number;discipline:number;pressure:number;passivity:number};
type DnaReport=SavedDnaSession&{id:string;name:string;completedAt:number;result:{label:string;scores:DnaScores}};
type DnaLibrary={active:SavedDnaSession|null;reports:DnaReport[]};

const emptyLibrary:DnaLibrary={active:null,reports:[]};

function buildSession(mode:AnalysisMode,count:number,seed:number,answers:PlayerDnaAnswer[]){
  if(mode!=="ALEATORIO")return buildBalancedSpotSession(playerDnaSpots,mode,count,seed,answers);
  const cashCount=Math.ceil(count/2);
  const tournamentCount=Math.floor(count/2);
  const cash=buildBalancedSpotSession(playerDnaSpots,"CASH",cashCount,seed,answers.filter((_,i)=>i%2===0));
  const tournament=buildBalancedSpotSession(playerDnaSpots,"TORNEIO",tournamentCount,seed^0x9e3779b9,answers.filter((_,i)=>i%2===1));
  const startCash=(seed&1)===0;
  const mixed:PlayerDnaSpot[]=[];
  for(let i=0;i<count;i++){
    const cashTurn=startCash?i%2===0:i%2===1;
    const source=cashTurn?cash:tournament;
    const item=source[Math.floor(i/2)];
    if(item)mixed.push(item);
  }
  return mixed;
}

export default function PlayerDnaWorkspace(){
  const[mode,setMode]=useState<AnalysisMode>("CASH");
  const[target,setTarget]=useState<number|null>(null);
  const[selectedDepth,setSelectedDepth]=useState<number|null>(null);
  const[index,setIndex]=useState(0);
  const[answers,setAnswers]=useState<PlayerDnaAnswer[]>([]);
  const[selectedAction,setSelectedAction]=useState<PlayerAction|null>(null);
  const[selectedSizing,setSelectedSizing]=useState<DecisionSizing|null>(null);
  const[actionSequenceReady,setActionSequenceReady]=useState(false);
  const[finished,setFinished]=useState(false);
  const[sessionSeed,setSessionSeed]=useState(1);
  const[library,setLibrary]=useState<DnaLibrary>(emptyLibrary);
  const[hydrated,setHydrated]=useState(false);
  const[historyOpen,setHistoryOpen]=useState(false);
  const[selectedReportId,setSelectedReportId]=useState<string|null>(null);
  const[editingId,setEditingId]=useState<string|null>(null);
  const[editingName,setEditingName]=useState("");

  const generatedCount=target?Math.min(target,answers.length+1):0;
  const session=useMemo(()=>target?buildSession(mode,generatedCount,sessionSeed,answers):[],[mode,target,generatedCount,sessionSeed,answers]);
  const spot=session[index];
  const result=useMemo(()=>finished?evaluatePlayerDna(session,answers):null,[finished,session,answers]);
  const selectedReport=library.reports.find(report=>report.id===selectedReportId)??null;
  const latestReport=library.reports[0]??null;

  useEffect(()=>{
    let next:DnaLibrary=emptyLibrary;
    try{
      const raw=localStorage.getItem(STORAGE_KEY);
      if(raw){const parsed=JSON.parse(raw) as DnaLibrary;if(parsed&&Array.isArray(parsed.reports))next={active:parsed.active??null,reports:parsed.reports}}
      else{const legacy=localStorage.getItem(LEGACY_STORAGE_KEY);if(legacy){const parsed=JSON.parse(legacy) as SavedDnaSession;if(parsed&&parsed.target>0&&Array.isArray(parsed.answers))next={active:parsed.finished?null:parsed,reports:[]}}}
    }catch{}
    setLibrary(next);setHydrated(true);
  },[]);

  useEffect(()=>{
    if(!hydrated)return;
    const timer=window.setTimeout(()=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify(library))}catch{}},120);
    return()=>window.clearTimeout(timer);
  },[hydrated,library]);

  useEffect(()=>{
    if(!hydrated||target===null||finished)return;
    const snapshot:SavedDnaSession={mode,target,index,answers,finished:false,sessionSeed,updatedAt:Date.now()};
    setLibrary(prev=>({...prev,active:snapshot}));
  },[hydrated,mode,target,index,answers,finished,sessionSeed]);

  useEffect(()=>{
    if(!hydrated||target===null||!finished||answers.length<target||!result)return;
    setLibrary(prev=>{
      const id=String(sessionSeed);
      if(prev.reports.some(report=>report.id===id))return{...prev,active:null};
      const completedAt=Date.now();
      const report:DnaReport={mode,target,index,answers,finished:true,sessionSeed,updatedAt:completedAt,id,completedAt,name:`ANÁLISE ${prev.reports.length+1} · ${mode}`,result:{label:result.label,scores:{...result.scores}}};
      return{active:null,reports:[report,...prev.reports]};
    });
  },[hydrated,target,finished,answers,mode,index,sessionSeed,result]);

  useEffect(()=>{
    const previous=()=>{
      if(editingId){setEditingId(null);setEditingName("");return}
      if(selectedReportId){setSelectedReportId(null);return}
      if(historyOpen){setHistoryOpen(false);return}
      if(target!==null||finished){leave();return}
      window.location.assign("/");
    };
    window.addEventListener("player-dna-previous",previous);
    return()=>window.removeEventListener("player-dna-previous",previous);
  },[editingId,selectedReportId,historyOpen,target,finished]);

  function start(depth:number){const selectedMode=(document.querySelector<HTMLInputElement>('input[name="player-dna-mode"]:checked')?.value as AnalysisMode|undefined)??mode;const seed=Date.now();setSelectedDepth(depth);setMode(selectedMode);setSelectedReportId(null);setHistoryOpen(false);setSessionSeed(seed);setTarget(depth);setIndex(0);setAnswers([]);setSelectedAction(null);setSelectedSizing(null);setActionSequenceReady(false);setFinished(false);window.requestAnimationFrame(()=>document.querySelector(".profile-panel")?.scrollIntoView({behavior:"smooth",block:"start"}))}
  function leave(){setTarget(null);setIndex(0);setAnswers([]);setSelectedAction(null);setSelectedSizing(null);setActionSequenceReady(false);setFinished(false);setSelectedReportId(null)}
  function continueSaved(){const saved=library.active;if(!saved)return;setSelectedReportId(null);setHistoryOpen(false);setMode(saved.mode);setTarget(saved.target);setIndex(Math.min(saved.index,Math.max(0,saved.target-1)));setAnswers(saved.answers);setSelectedAction(null);setSelectedSizing(null);setActionSequenceReady(false);setFinished(false);setSessionSeed(saved.sessionSeed)}
  function deleteSaved(){setLibrary(prev=>({...prev,active:null}))}
  function resetAll(){try{localStorage.removeItem(STORAGE_KEY);localStorage.removeItem(LEGACY_STORAGE_KEY)}catch{}setLibrary(emptyLibrary);setSelectedReportId(null);setHistoryOpen(false);setEditingId(null);setTarget(null);setIndex(0);setAnswers([]);setSelectedAction(null);setSelectedSizing(null);setActionSequenceReady(false);setFinished(false);setSessionSeed(1)}
  function chooseAction(action:PlayerAction){if(!actionSequenceReady)return;setSelectedAction(current=>current===action?null:action);setSelectedSizing(null)}
  function nextSpot(){
    const sizingRequired=selectedAction==="BET"||selectedAction==="RAISE";
    if(!spot||!target||!selectedAction||(sizingRequired&&!selectedSizing))return;
    const answer:PlayerDnaAnswer={spotId:spot.id,action:selectedAction,...(selectedSizing?{sizing:selectedSizing}:{})};
    const next=[...answers,answer];
    setAnswers(next);setSelectedAction(null);setSelectedSizing(null);setActionSequenceReady(false);
    if(next.length>=target){setFinished(true);return}
    setIndex(v=>Math.min(v+1,target-1));
  }
  function beginRename(report:DnaReport){setEditingId(report.id);setEditingName(report.name)}
  function saveRename(){const name=editingName.trim();if(!editingId||!name)return;setLibrary(prev=>({...prev,reports:prev.reports.map(report=>report.id===editingId?{...report,name}:report)}));setEditingId(null);setEditingName("")}
  function deleteReport(id:string){setLibrary(prev=>({...prev,reports:prev.reports.filter(report=>report.id!==id)}));if(selectedReportId===id)setSelectedReportId(null)}

  if(selectedReport)return <ReportView report={selectedReport} onBack={()=>setSelectedReportId(null)} onRename={()=>beginRename(selectedReport)}/>;

  if(target===null)return <div className={styles.setup}>
    <div><div className="eyebrow">PLAYER DNA</div><h2>CONFIGURAÇÕES DE SPOTS</h2><p className="setup-intro">Escolha a modalidade e a quantidade de spots antes de entrar na mesa de operação.</p><p className="analysis-balance-note">EM ALEATÓRIO, O MOTOR ALTERNA SPOTS DE CASH E TORNEIO PARA FORMAR UMA LEITURA MAIS AMPLA DO SEU PERFIL.</p></div>
    <div className={`${styles.modeGrid} mode-choices`}>
      {(["CASH","TORNEIO","ALEATORIO"] as const).map(option=><label key={option} className={styles.modeButton}><input type="radio" name="player-dna-mode" value={option} checked={mode===option} onChange={()=>setMode(option)}/><strong>{option}</strong></label>)}
    </div>
    <div className={`${styles.depthGrid} depth-choices`}>{depths.map(n=><button type="button" key={n} aria-pressed={selectedDepth===n} onPointerDown={()=>setSelectedDepth(n)} onClick={()=>start(n)}><strong>{n}</strong><span>SPOTS</span></button>)}</div>
    <div className="saved-analysis-panel" style={{border:"1px solid rgba(92,187,126,.28)",borderRadius:16,padding:16,background:"rgba(9,31,18,.62)",display:"grid",gap:12}}>
      <div><div className="eyebrow saved-analysis-title">ANÁLISES SALVAS</div>{library.active?<><strong className="saved-analysis-status" style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:6,flexWrap:"nowrap",width:"100%",marginTop:4}}><span>{library.active.mode} · {library.active.answers.length} / {library.active.target} SPOTS</span><span style={{marginLeft:"auto",textAlign:"right"}}>{Math.round((Math.min(library.active.answers.length,library.active.target)/library.active.target)*100)}%</span></strong><small className="saved-analysis-description">ACESSE OU APAGUE A ANÁLISE EM ANDAMENTO.</small></>:<><strong className="saved-analysis-status" style={{display:"block",marginTop:4}}>NENHUMA ANÁLISE SALVA</strong><small className="saved-analysis-description">ESCOLHA A MODALIDADE E O NÚMERO DE SPOTS PARA COMEÇAR.</small></>}</div>
      {library.active&&<div className={styles.track}><i style={{width:`${(Math.min(library.active.answers.length,library.active.target)/library.active.target)*100}%`}}/></div>}
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button type="button" className="primary" onClick={continueSaved} disabled={!library.active}>ACESSAR ANÁLISE</button><button type="button" className={styles.modeButton} onClick={deleteSaved} disabled={!library.active}><strong>APAGAR</strong></button></div>
    </div>
    <div className="history-panel" style={{border:"1px solid rgba(92,187,126,.22)",borderRadius:16,padding:16,background:"rgba(5,20,12,.7)",display:"grid",gap:12}}><div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"}}><div><div className="eyebrow history-eyebrow">HISTÓRICO</div><strong className="history-count" style={{display:"block",marginTop:4}}>{library.reports.length} {library.reports.length===1?"ANÁLISE CONCLUÍDA":"ANÁLISES CONCLUÍDAS"}</strong><small className="history-description" style={{opacity:.65}}>ACESSE O HISTÓRICO E OS RELATÓRIOS FINAIS.</small></div><div className="history-actions"><button type="button" aria-expanded={historyOpen} className={`${styles.modeButton} history-action`} onClick={()=>setHistoryOpen(v=>!v)}><strong>{historyOpen?"FECHAR":"ACESSAR HISTÓRICO"}</strong></button><button type="button" className={`${styles.modeButton} history-action`} onClick={resetAll}><strong>ZERAR HISTÓRICO</strong></button></div></div>
      {latestReport&&<button type="button" className="primary" onClick={()=>setSelectedReportId(latestReport.id)}>RELATÓRIO FINAL</button>}
      {historyOpen&&<div style={{display:"grid",gap:10}}>{library.reports.length===0?<small style={{opacity:.58}}>NENHUM RELATÓRIO CONCLUÍDO AINDA.</small>:library.reports.map(report=><div key={report.id} style={{border:"1px solid rgba(92,187,126,.16)",borderRadius:12,padding:12,display:"grid",gap:10}}>{editingId===report.id?<div style={{display:"flex",gap:8,flexWrap:"wrap"}}><input value={editingName} onChange={e=>setEditingName(e.target.value)} maxLength={60} style={{flex:"1 1 220px",minHeight:42,borderRadius:9,border:"1px solid rgba(92,187,126,.25)",background:"#061009",color:"#e8f5ec",padding:"0 12px"}}/><button type="button" className="primary" onClick={saveRename} disabled={!editingName.trim()}>SALVAR NOME</button><button type="button" className={styles.modeButton} onClick={()=>{setEditingId(null);setEditingName("")}}><strong>CANCELAR</strong></button></div>:<div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"}}><div><strong>{report.name}</strong><small style={{display:"block",opacity:.62,marginTop:4}}>{report.mode} · {report.target} SPOTS · {new Date(report.completedAt).toLocaleDateString("pt-BR")} · {report.result.label}</small></div><div style={{display:"flex",gap:7,flexWrap:"wrap"}}><button type="button" className="primary" onClick={()=>setSelectedReportId(report.id)}>ACESSAR</button><button type="button" className={styles.modeButton} onClick={()=>beginRename(report)}><strong>EDITAR NOME</strong></button><button type="button" className={styles.modeButton} onClick={()=>deleteReport(report.id)}><strong>APAGAR</strong></button></div></div>}</div>)}</div>}
    </div>
  </div>;

  if(finished&&result)return <div className={styles.result}><div><span className="tag">RELATÓRIO FINAL · PLAYER DNA · {mode}</span><h3>{result.label}</h3><p>{answers.length} / {target} SPOTS CONCLUÍDOS · RELATÓRIO SALVO NO HISTÓRICO</p></div><div className={styles.resultGrid}><Metric label="AGRESSÃO" value={`${result.scores.aggression}%`}/><Metric label="DISCIPLINA" value={`${result.scores.discipline}%`}/><Metric label="PRESSÃO" value={`${result.scores.pressure}%`}/><Metric label="PASSIVIDADE" value={`${result.scores.passivity}%`}/></div><button type="button" className="primary" onClick={leave}>VOLTAR AO PLAYER DNA</button></div>;
  if(!spot)return <div className={styles.result}><h3>DADOS INSUFICIENTES</h3><button type="button" className="primary" onClick={leave}>VOLTAR</button></div>;

  const sizingOptions=selectedAction==="BET"?betSizings:selectedAction==="RAISE"?raiseSizings:[];
  const canContinue=Boolean(actionSequenceReady&&selectedAction&&(!(selectedAction==="BET"||selectedAction==="RAISE")||selectedSizing));
  const progress=Math.round((answers.length/target)*100);

  return <div className={`${styles.session} training-session`}>
    <div className="eyebrow">PLAYER DNA</div>
    <div className={styles.progressHead}><span>SPOT {String(answers.length+1).padStart(3,"0")} / {String(target).padStart(3,"0")}</span><strong>{String(progress).padStart(3,"0")}%</strong></div>
    <div className={styles.track}><i style={{width:`${progress}%`}}/></div>
    <Level spot={spot}/>
    <PlayerDnaPokerTable spot={spot} selectedAction={selectedAction} onSequenceReady={setActionSequenceReady}/>
    <p className={styles.prompt}>QUAL É A SUA AÇÃO ?</p>
    <div className={styles.actions} aria-busy={!actionSequenceReady}>{spot.actions.map(action=><button type="button" aria-disabled={!actionSequenceReady} aria-pressed={selectedAction===action} className={selectedAction===action?styles.actionSelected:""} key={action} onClick={()=>chooseAction(action)}>{action}</button>)}</div>
    {sizingOptions.length>0&&<div className={styles.sizingActions}>{sizingOptions.map(sizing=><button type="button" aria-pressed={selectedSizing===sizing} className={selectedSizing===sizing?styles.actionSelected:""} key={sizing} onClick={()=>setSelectedSizing(current=>current===sizing?null:sizing)}>{sizing}</button>)}</div>}
    <div className="training-footer" style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8}}><button type="button" className={styles.modeButton} onClick={leave}><strong>SALVAR ANÁLISE E SAIR</strong></button><button type="button" className="primary" aria-disabled={!canContinue} onClick={nextSpot}>PRÓXIMO</button></div>
    <Scenario spot={spot}/>
  </div>;
}

function ReportView({report,onBack,onRename}:{report:DnaReport;onBack:()=>void;onRename:()=>void}){return <div className={styles.result}><div><span className="tag">RELATÓRIO FINAL · PLAYER DNA · {report.mode}</span><h3>{report.name}</h3><p>{new Date(report.completedAt).toLocaleString("pt-BR")} · {report.answers.length} / {report.target} SPOTS</p></div><div className={styles.resultGrid}><Metric label="AGRESSÃO" value={`${report.result.scores.aggression}%`}/><Metric label="DISCIPLINA" value={`${report.result.scores.discipline}%`}/><Metric label="PRESSÃO" value={`${report.result.scores.pressure}%`}/><Metric label="PASSIVIDADE" value={`${report.result.scores.passivity}%`}/></div><div style={{border:"1px solid rgba(92,187,126,.2)",borderRadius:14,padding:14}}><small style={{opacity:.62}}>CLASSIFICAÇÃO FINAL</small><strong style={{display:"block",marginTop:5}}>{report.result.label}</strong></div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button type="button" className="primary" onClick={onBack}>VOLTAR AO HISTÓRICO</button><button type="button" className={styles.modeButton} style={{minHeight:44}} onClick={onRename}><strong>EDITAR NOME</strong></button></div></div>}

function Level({spot}:{spot:PlayerDnaSpot}){
  const phase=spot.scenario.find(item=>["EARLY GAME","MID GAME","BOLHA","ITM","FT"].includes(item))??(spot.mode==="CASH"?"CASH":"TORNEIO");
  const tournamentLevels:Record<string,{sb:number;bb:number}>={"EARLY GAME":{sb:100,bb:200},"MID GAME":{sb:500,bb:1000},BOLHA:{sb:1000,bb:2000},ITM:{sb:1500,bb:3000},FT:{sb:2500,bb:5000}};
  const tournamentLevelNumbers:Record<string,string>={"EARLY GAME":"01","MID GAME":"02",BOLHA:"03",ITM:"04",FT:"05"};
  const cashLevels:Record<string,{sb:string;bb:string}>={"MICRO STAKES":{sb:"$ 0,50",bb:"$ 1"},"MID STAKES":{sb:"$ 2,50",bb:"$ 5"},"HIGH STAKES":{sb:"$ 25",bb:"$ 50"}};
  const cashLevelNumbers:Record<string,string>={"MICRO STAKES":"01","MID STAKES":"02","HIGH STAKES":"03"};
  const tournament=tournamentLevels[phase]??tournamentLevels["EARLY GAME"];
  const profile=spot.gameProfile??"MICRO STAKES";
  const cash=cashLevels[profile]??cashLevels["MICRO STAKES"];
  const anteMode=spot.anteMode??"NONE";
  const playerCount=Math.max(1,spot.players.length);
  const anteValue=anteMode==="BB_ANTE"?tournament.bb:anteMode==="BB_PL"?tournament.bb/playerCount:0;
  const formatChips=(value:number)=>Math.round(value).toLocaleString("pt-BR");
  const levelNumber=spot.mode==="CASH"?(cashLevelNumbers[profile]??"01"):(tournamentLevelNumbers[phase]??"01");
  const values=spot.mode==="CASH"?`SB ${cash.sb} / BB ${cash.bb}`:`SB ${formatChips(tournament.sb)} / BB ${formatChips(tournament.bb)}${anteMode!=="NONE"?` (${formatChips(anteValue)})`:""}`;
  return <section className={`${styles.block} ${styles.levelSection}`}><h4 className={styles.blockTitle}>NÍVEL</h4><div className={styles.levelSummary}><span className={styles.levelNumber}>{levelNumber}</span><strong>{values}</strong></div></section>
}

function Scenario({spot}:{spot:PlayerDnaSpot}){return <section className={styles.block}><h4 className={styles.blockTitle}>CENÁRIO</h4><div className={styles.scenario}>{spot.scenario.map(item=><span className={styles.badge} key={item}>{item}</span>)}</div></section>}
function Metric({label,value}:{label:string;value:string}){return <div className="metric"><small>{label}</small><strong>{value}</strong></div>}
