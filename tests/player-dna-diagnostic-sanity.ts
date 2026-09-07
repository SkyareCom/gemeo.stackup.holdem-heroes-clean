import {analyzeTechnicalDecision} from "../lib/player-dna-technical-analysis";
import type {SolverSpotState} from "../lib/player-dna-solver-v2";
import type {PlayerAction} from "../data/player-dna-spots";

function expect(condition:boolean,message:string){if(!condition)throw new Error(message)}
function state(overrides:Partial<SolverSpotState>):SolverSpotState{return{mode:"CASH",street:"PREFLOP",hero:{position:"HJ",stack:100,cards:["Q♠","9♥"]},board:[],pot:30,players:[{position:"UTG",stack:100,action:"CALL",value:4},{position:"MP",stack:100,action:"RAISE",value:14},{position:"HJ",stack:100,action:"---",value:0},{position:"CO",stack:100,action:"CALL",value:4}],scenario:["CASH","MULTIWAY","3-BET POT"],heroToCall:14,currentBet:14,legalActions:["FOLD","CALL","RAISE","ALL-IN"],...overrides}}
function judge(s:SolverSpotState,action:PlayerAction){return analyzeTechnicalDecision(s,action,s.legalActions??[action])}

const q9=state({});
const q9Fold=judge(q9,"FOLD");
const q9Call=judge(q9,"CALL");
expect(q9Fold.bestAction==="FOLD","Q9o multiway facing large raise must prefer fold baseline");
expect(q9Call.verdict!=="AÇÃO CORRETA (+EV)","Q9o multiway large call cannot be marked clearly correct");

const aa=state({hero:{position:"BTN",stack:100,cards:["A♠","A♥"]},pot:18,players:[{position:"CO",stack:100,action:"RAISE",value:8},{position:"BTN",stack:100,action:"---",value:0}],scenario:["CASH","HEADS-UP","3-BET POT"],heroToCall:8,currentBet:8,legalActions:["FOLD","CALL","RAISE","ALL-IN"]});
const aaFold=judge(aa,"FOLD");
expect(aaFold.verdict==="AÇÃO INCORRETA (-EV)","AA facing ordinary preflop raise must not prefer fold");
expect(aaFold.bestAction!=="FOLD","AA best line cannot be fold baseline");

const nuts=state({street:"RIVER",hero:{position:"BTN",stack:80,cards:["A♠","K♠"]},board:["Q♠","J♠","T♠","2♦","3♣"],pot:40,players:[{position:"BB",stack:70,action:"CHECK",value:0},{position:"BTN",stack:80,action:"---",value:0}],scenario:["CASH","HEADS-UP","RIVER","IP"],heroToCall:0,currentBet:0,legalActions:["CHECK","BET","ALL-IN"]});
const nutsCheck=judge(nuts,"CHECK");
expect(nutsCheck.bestAction!=="CHECK","River straight flush should not default to check when value betting is legal");

const bubble=state({mode:"TORNEIO",hero:{position:"BTN",stack:18,cards:["A♦","T♠"]},pot:17,players:[{position:"CO",stack:14,action:"ALL-IN",value:14},{position:"BTN",stack:18,action:"---",value:0}],scenario:["TORNEIO","BOLHA","ICM"],heroToCall:14,currentBet:14,legalActions:["FOLD","CALL"]});
const bubbleCall=judge(bubble,"CALL");
expect(bubbleCall.confidence!=="ALTA","ICM without payouts/field stacks must not claim high confidence");

console.log("PLAYER DNA DIAGNOSTIC SANITY: PASS");
