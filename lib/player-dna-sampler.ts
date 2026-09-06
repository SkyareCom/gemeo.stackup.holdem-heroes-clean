import type {AnteFormat,CashProfile,GameMode,PlayerAction,PlayerDnaSpot,TournamentProfile} from "@/data/player-dna-spots";

type Street=PlayerDnaSpot["street"];
type StackBand="SHORT"|"MEDIUM"|"DEEP";
type Heads="HEADS-UP"|"MULTIWAY";
type PositionState="IP"|"OOP";
type PotType="LIMPED"|"SRP"|"3BET"|"4BET"|"OTHER";
type Theme="VALUE"|"BLUFF"|"BLUFF-CATCH"|"BLIND-WAR"|"SQUEEZE"|"ALL-IN"|"DRAW"|"PRESSURE"|"STANDARD";
type Texture="PREFLOP"|"DRY"|"WET"|"PAIRED"|"MONOTONE"|"CONNECTED";
type Sizing="SMALL"|"MEDIUM"|"LARGE"|"OVERBET"|"NONE";
type TablePlayer=PlayerDnaSpot["players"][number];
type ActionHistoryItem={position:string;action:string;value:number};
type SpotWithHistory=PlayerDnaSpot&{actionHistory?:ActionHistoryItem[];heroToCall?:number;currentBet?:number};
type PriorAnswer={action:PlayerAction};

export type SpotDimensions={street:Street;heroPosition:string;stackBand:StackBand;heads:Heads;positionState:PositionState;potType:PotType;theme:Theme;texture:Texture;sizing:Sizing;tournamentPhase:"EARLY"|"MID"|"BUBBLE"|"ITM"|"FT"|"NA";icm:boolean;ante:boolean;gameProfile:string;anteMode:AnteFormat};

const streets:Street[]=["PREFLOP","FLOP","TURN","RIVER"];
const tablePositions:Record<number,string[]>={
  6:["UTG","HJ","CO","BTN","SB","BB"],
  8:["UTG","UTG+1","MP","HJ","CO","BTN","SB","BB"],
  9:["UTG","UTG+1","UTG+2","MP","HJ","CO","BTN","SB","BB"],
  10:["UTG","UTG+1","UTG+2","MP","MP+1","HJ","CO","BTN","SB","BB"]
};
const tableSizes=[6,8,9,10];
const ranks=["A","K","Q","J","T","9","8","7","6","5","4","3","2"];
const suits=["♠","♥","♦","♣"];
const deckCards=ranks.flatMap(rank=>suits.map(suit=>`${rank}${suit}`));
const holeCardCombinations=deckCards.flatMap((first,index)=>deckCards.slice(index+1).map(second=>[first,second] as const));
const cashStacks=[40,60,80,100,150,200,300];
const tournamentStacks=[8,12,18,25,35,50,75,100];

function roundAmount(value:number,mode:GameMode){if(value<=0)return 0;return mode==="TORNEIO"?Math.round(value*10)/10:Math.max(1,Math.round(value));}
function has(spot:PlayerDnaSpot,text:string){return spot.scenario.some(x=>x.toUpperCase().includes(text));}
function hero(spot:PlayerDnaSpot){return spot.players.find(p=>p.hero)??spot.players[0];}
function hashText(value:string){let hash=2166136261;for(let i=0;i<value.length;i++){hash^=value.charCodeAt(i);hash=Math.imul(hash,16777619)}return hash>>>0}
function makeRandom(seed:number){let state=(seed||1)>>>0;return()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296}}
function take<T>(items:T[],random:()=>number){return items[Math.floor(random()*items.length)]}
function deal(count:number,random:()=>number,excluded:string[]=[]){const deck=deckCards.filter(card=>!excluded.includes(card));const cards:string[]=[];while(cards.length<count){const index=Math.floor(random()*deck.length);cards.push(deck.splice(index,1)[0])}return cards}

export function describeSpot(spot:PlayerDnaSpot):SpotDimensions{
  const h=hero(spot);const maxAction=Math.max(0,...spot.players.filter(p=>!p.hero).map(p=>p.value));const stack=h.stack;
  const board=(spot.board??"").split(" ").filter(Boolean);const boardRanks=board.map(c=>c[0]);const boardSuits=board.map(c=>c.slice(1));
  const paired=new Set(boardRanks).size<boardRanks.length;const monotone=boardSuits.length>=3&&new Set(boardSuits).size===1;const connected=board.length>=3&&/([TJQK9].*){2}/.test(board.join(""));const wet=has(spot,"DRAW")||has(spot,"COMBO")||monotone||connected;const pot=spot.pot.main||1;const ratio=maxAction/pot;
  return{street:spot.street,heroPosition:h.position,stackBand:stack<=30?"SHORT":stack<=80?"MEDIUM":"DEEP",heads:spot.players.filter(p=>p.hero||p.action!=="FOLD").length>2?"MULTIWAY":"HEADS-UP",positionState:has(spot,"OOP")?"OOP":"IP",potType:has(spot,"4-BET")?"4BET":has(spot,"3-BET")?"3BET":has(spot,"LIMP")?"LIMPED":has(spot,"SRP")?"SRP":"OTHER",theme:has(spot,"BLUFF CATCH")?"BLUFF-CATCH":has(spot,"THIN VALUE")||has(spot,"VALUE")?"VALUE":has(spot,"BLIND WAR")?"BLIND-WAR":has(spot,"SQUEEZE")?"SQUEEZE":spot.players.some(p=>p.action==="ALL-IN")?"ALL-IN":has(spot,"DRAW")?"DRAW":has(spot,"ICM")||has(spot,"BOLHA")?"PRESSURE":"STANDARD",texture:spot.street==="PREFLOP"?"PREFLOP":paired?"PAIRED":monotone?"MONOTONE":wet?"WET":"DRY",sizing:maxAction===0?"NONE":ratio<=.33?"SMALL":ratio<=.7?"MEDIUM":ratio<=1?"LARGE":"OVERBET",tournamentPhase:has(spot,"EARLY")?"EARLY":has(spot,"MID")?"MID":has(spot,"BOLHA")?"BUBBLE":has(spot,"ITM")?"ITM":has(spot,"FT")?"FT":"NA",icm:has(spot,"ICM"),ante:has(spot,"ANTE"),gameProfile:spot.gameProfile??spot.mode,anteMode:spot.anteMode??"NONE"};
}

function bettingOrder(positions:string[],street:Street){
  if(street==="PREFLOP")return [...positions];
  return [...positions.filter(p=>p==="SB"||p==="BB"),...positions.filter(p=>p!=="SB"&&p!=="BB")];
}
function blindContribution(position:string,street:Street){if(street!=="PREFLOP")return 0;if(position==="SB")return .5;if(position==="BB")return 1;return 0}

function buildRealisticSequence(positions:string[],heroPosition:string,street:Street,stacks:Map<string,number>,pot:number,mode:GameMode,random:()=>number){
  const order=bettingOrder(positions,street);const heroIndex=order.indexOf(heroPosition);const beforeHero=heroIndex>=0?order.slice(0,heroIndex):[];
  const commitments=new Map<string,number>();positions.forEach(position=>commitments.set(position,blindContribution(position,street)));
  const actions=new Map<string,{action:string;value:number}>();const history:ActionHistoryItem[]=[];
  let currentBet=street==="PREFLOP"?1:0;
  let lastFullRaise=street==="PREFLOP"?1:0;
  let raisesReopened=true;

  for(const position of beforeHero){
    const stack=stacks.get(position)??100;const committed=commitments.get(position)??0;const toCall=Math.max(0,currentBet-committed);
    let action:string="CHECK";let target=committed;

    if(toCall<=0){
      const canOpen=stack>committed;
      const aggressive=street==="PREFLOP"&&currentBet>0?"RAISE":"BET";
      action=canOpen?take(["CHECK","CHECK","CHECK",aggressive],random):"CHECK";
      if(action==="BET"){
        const size=roundAmount(Math.max(1,pot*take([.25,.33,.5,.66,.75,1],random)),mode);
        target=Math.min(stack,Math.max(committed+1,size));
        lastFullRaise=Math.max(1,target-currentBet);currentBet=target;raisesReopened=true;
      }else if(action==="RAISE"){
        const minTarget=currentBet+Math.max(lastFullRaise,1);const desired=roundAmount(currentBet*take([2.2,2.5,3,3.5],random),mode);
        target=Math.min(stack,Math.max(minTarget,desired));
        if(target>currentBet){lastFullRaise=target-currentBet;currentBet=target;raisesReopened=true}else action="CHECK";
      }
    }else{
      const minRaiseTarget=currentBet+Math.max(lastFullRaise,street==="PREFLOP"?1:currentBet||1);
      const canFullRaise=raisesReopened&&stack>=minRaiseTarget;
      const canJamRaise=stack>currentBet;
      const options=canFullRaise?["FOLD","FOLD","CALL","CALL","RAISE","ALL-IN"]:canJamRaise?["FOLD","FOLD","CALL","CALL","ALL-IN"]:["FOLD","CALL","CALL"];
      action=take(options,random);
      if(action==="FOLD")target=committed;
      else if(action==="CALL")target=Math.min(stack,currentBet);
      else if(action==="RAISE"){
        const multiplier=take(street==="PREFLOP"?[2.2,2.5,3]:[2,2.5,3],random);const desired=roundAmount(currentBet*multiplier,mode);
        target=Math.min(stack,Math.max(minRaiseTarget,desired));
        const increment=target-currentBet;if(increment>=lastFullRaise){lastFullRaise=increment;raisesReopened=true}currentBet=target;
      }else{
        target=stack;
        if(target<=currentBet){action="CALL"}
        else{
          const increment=target-currentBet;
          if(increment>=lastFullRaise){lastFullRaise=increment;raisesReopened=true}else raisesReopened=false;
          currentBet=target;
        }
      }
    }

    target=roundAmount(target,mode);commitments.set(position,target);
    const displayValue=action==="FOLD"||action==="CHECK"?0:target;
    actions.set(position,{action,value:displayValue});history.push({position,action,value:displayValue});
  }

  const heroStack=stacks.get(heroPosition)??100;const heroCommitted=commitments.get(heroPosition)??0;const heroToCall=Math.max(0,currentBet-heroCommitted);
  let legalActions:PlayerAction[];
  if(heroToCall>0){
    legalActions=["FOLD","CALL"];
    const minRaiseTarget=currentBet+Math.max(lastFullRaise,street==="PREFLOP"?1:currentBet||1);
    if(raisesReopened&&heroStack>=minRaiseTarget)legalActions.push("RAISE");
    if(heroStack>currentBet)legalActions.push("ALL-IN");
  }else if(street==="PREFLOP"&&currentBet>0){
    legalActions=["CHECK"];
    if(heroStack>=currentBet+Math.max(lastFullRaise,1))legalActions.push("RAISE");
    if(heroStack>currentBet)legalActions.push("ALL-IN");
  }else{
    legalActions=["CHECK"];
    if(heroStack>0)legalActions.push("BET","ALL-IN");
  }
  return{actions,history,currentBet,heroToCall,legalActions,commitments};
}

function variant(seed:PlayerDnaSpot,n:number,sessionSeed:number,adaptationKey:string,forcedHeroCards:readonly [string,string]):PlayerDnaSpot{
  const random=makeRandom(hashText(`${seed.id}:${sessionSeed}:${n}:${adaptationKey}`));const street=streets[(n+Math.floor(random()*streets.length))%streets.length];const playerCount=tableSizes[(n+Math.floor(random()*tableSizes.length))%tableSizes.length];const positions=tablePositions[playerCount];
  const heroPosition=positions[Math.floor(random()*positions.length)];const baseStack=take(seed.mode==="CASH"?cashStacks:tournamentStacks,random);const initialPot=roundAmount(seed.mode==="CASH"?2+random()*18:2+random()*12,seed.mode);
  const stacks=new Map<string,number>();positions.forEach(position=>stacks.set(position,roundAmount(baseStack*(.62+random()*.9),seed.mode)));
  const sequence=buildRealisticSequence(positions,heroPosition,street,stacks,initialPot,seed.mode,random);
  const players:TablePlayer[]=positions.map(position=>{const isHero=position===heroPosition;const prior=sequence.actions.get(position);return{position,stack:stacks.get(position)??baseStack,action:isHero?"---":prior?.action??"---",value:isHero?0:prior?.value??0,...(isHero?{hero:true}:{})}});
  const boardCount=street==="PREFLOP"?0:street==="FLOP"?3:street==="TURN"?4:5;const heroCards=forcedHeroCards.join(" ");const board=deal(boardCount,random,[...forcedHeroCards]).join(" ")||undefined;
  const committed=sequence.history.reduce((sum,item)=>sum+item.value,0);const main=roundAmount(initialPot+committed,seed.mode);
  const allInCommitments=sequence.history.filter(item=>item.action==="ALL-IN").map(item=>item.value).sort((a,b)=>a-b);let sides:PlayerDnaSpot["pot"]["sides"];
  if(allInCommitments.length){const cap=allInCommitments[0];const above=sequence.history.filter(item=>item.action!=="FOLD"&&item.value>cap);if(above.length>=2){const sideValue=roundAmount(above.reduce((sum,item)=>sum+(item.value-cap),0),seed.mode);if(sideValue>0)sides=[{value:sideValue,players:[heroPosition,...above.map(item=>item.position)]}]}}
  const cashProfiles:CashProfile[]=["MICRO STAKES","MID STAKES","HIGH STAKES"];const tournamentProfiles:TournamentProfile[]=["MTT REGULAR","BOUNTY","HIGH ROLLER","TURBO"];const tournamentPhases=["EARLY GAME","MID GAME","BOLHA","ITM","FT"];const themes=["THIN VALUE","BLUFF CATCH","BLIND WAR","SQUEEZE","DRAW","PRESSURE","STANDARD"];const anteModes:AnteFormat[]=["NONE","BB_ANTE","BB_PL"];
  const gameProfile=seed.mode==="CASH"?take(cashProfiles,random):take(tournamentProfiles,random);const tournamentPhase=take(tournamentPhases,random);const theme=take(themes,random);const anteMode:AnteFormat=seed.mode==="TORNEIO"?take(anteModes,random):"NONE";
  const fallback=seed.weights.CALL??seed.weights.CHECK??Object.values(seed.weights)[0];const aggressive=seed.weights.RAISE??seed.weights.BET??seed.weights["ALL-IN"]??fallback;const weights={FOLD:seed.weights.FOLD??fallback,CHECK:seed.weights.CHECK??fallback,CALL:seed.weights.CALL??fallback,BET:seed.weights.BET??aggressive,RAISE:seed.weights.RAISE??aggressive,"ALL-IN":seed.weights["ALL-IN"]??aggressive};
  const boardCards=board?.split(" ")??[];const texture=boardCards.length&&new Set(boardCards.map(card=>card.slice(1))).size===1?"MONOTONE":boardCards.length&&new Set(boardCards.map(card=>card[0])).size<boardCards.length?"PAIRED":board?"BOARD VARIADO":"PREFLOP";const phaseTags=seed.mode==="TORNEIO"?[tournamentPhase,...(["BOLHA","FT"].includes(tournamentPhase)?[`${tournamentPhase} ICM`]:[])]:[];
  const activePositions=players.filter(player=>player.hero||player.action!=="FOLD").map(player=>player.position);const matchup=activePositions.length>6?`${heroPosition} VS MESA`:activePositions.join(" VS ");const scenario=[seed.mode,String(gameProfile),`${playerCount}-MAX`,...phaseTags,street,texture,theme,activePositions.length>2?"MULTIWAY":"HEADS-UP",matchup,heroPosition==="BTN"||heroPosition==="CO"?"IP":"OOP"];
  const last=sequence.history.at(-1);const lastActor=last?.position??"MESA";const stateText=sequence.heroToCall>0?`ENFRENTA ${roundAmount(sequence.heroToCall,seed.mode)} BB`:`TEM AÇÃO LIVRE`;const prompt=`MESA ${playerCount}-MAX: O HERÓI ESTÁ EM ${heroPosition} NO ${street}. ${stateText}. ÚLTIMA AÇÃO: ${last?.action??"---"} DE ${lastActor}.`;
  return {...seed,id:`${seed.id}-${sessionSeed.toString(36)}-${hashText(adaptationKey).toString(36)}-v${n}`,street,heroCards,board,players,pot:{main,sides},scenario,prompt,actions:sequence.legalActions,weights,gameProfile,anteMode,actionHistory:sequence.history,heroToCall:sequence.heroToCall,currentBet:sequence.currentBet} as SpotWithHistory;
}

function stableShuffle<T>(items:T[],seed:number){const out=[...items];let x=(seed||1)>>>0;for(let i=out.length-1;i>0;i--){x=(x*1664525+1013904223)>>>0;const j=x%(i+1);[out[i],out[j]]=[out[j],out[i]]}return out}
function handClass(cards:readonly [string,string]){const first=cards[0][0],second=cards[1][0];if(first===second)return `${first}${second}`;const ordered=ranks.indexOf(first)<ranks.indexOf(second)?[first,second]:[second,first];return `${ordered[0]}${ordered[1]}${cards[0].slice(1)===cards[1].slice(1)?"S":"O"}`}
function balancedHandOrder(seed:number){const groups=new Map<string,Array<readonly [string,string]>>();holeCardCombinations.forEach(cards=>{const key=handClass(cards);groups.set(key,[...(groups.get(key)??[]),cards])});const classOrder=stableShuffle([...groups.keys()],seed);const shuffledGroups=new Map(classOrder.map((key,index)=>[key,stableShuffle(groups.get(key)??[],seed^(index*2654435761))]));const ordered:Array<readonly [string,string]>=[];for(let round=0;round<12;round++)classOrder.forEach(key=>{const cards=shuffledGroups.get(key)?.[round];if(cards)ordered.push(cards)});return ordered}
function keyEntries(d:SpotDimensions){return[`street:${d.street}`,`pos:${d.heroPosition}`,`stack:${d.stackBand}`,`heads:${d.heads}`,`state:${d.positionState}`,`pot:${d.potType}`,`theme:${d.theme}`,`texture:${d.texture}`,`sizing:${d.sizing}`,`phase:${d.tournamentPhase}`,`icm:${d.icm}`,`ante:${d.ante}`,`profile:${d.gameProfile}`,`ante-mode:${d.anteMode}`]}
function adaptationKey(answers:PriorAnswer[]){return answers.map(answer=>answer.action).join("|")||"START"}
function semanticSpotKey(spot:PlayerDnaSpot){const dimensions=describeSpot(spot);const heroPosition=hero(spot).position;const history=(spot as SpotWithHistory).actionHistory??spot.players.filter(player=>!player.hero&&player.action!=="---").map(player=>({position:player.position,action:player.action,value:player.value}));const actionSequence=history.map(item=>`${item.position}:${item.action}:${item.value}`).join(">");const phase=spot.scenario.find(item=>["EARLY GAME","MID GAME","BOLHA","ITM","FT"].includes(item))??"NA";const table=spot.scenario.find(item=>item.endsWith("-MAX"))??`${spot.players.length}-MAX`;return[spot.mode,spot.street,spot.gameProfile,spot.anteMode,table,phase,heroPosition,dimensions.stackBand,dimensions.positionState,dimensions.potType,dimensions.theme,dimensions.texture,dimensions.sizing,spot.pot.sides?.length?"SIDE":"MAIN",actionSequence].join("|")}
function adaptiveBias(d:SpotDimensions,answers:PriorAnswer[]){if(answers.length<3)return 0;const aggressive=answers.filter(answer=>["BET","RAISE","ALL-IN"].includes(answer.action)).length/answers.length;const passive=answers.filter(answer=>["FOLD","CHECK","CALL"].includes(answer.action)).length/answers.length;let score=0;if(aggressive>=.5){if(["BLUFF-CATCH","PRESSURE","ALL-IN"].includes(d.theme))score-=5;if(d.positionState==="OOP")score-=2;if(d.icm)score-=2}if(passive>=.55){if(["VALUE","DRAW","BLIND-WAR","SQUEEZE"].includes(d.theme))score-=5;if(d.positionState==="IP")score-=2}return score}

export function buildBalancedSpotSession(bank:PlayerDnaSpot[],mode:GameMode,count:number,seed=Date.now(),answers:PriorAnswer[]=[]):PlayerDnaSpot[]{
  const seeds=bank.filter(s=>s.mode===mode);if(!seeds.length||count<=0)return[];const selected:PlayerDnaSpot[]=[];const counts=new Map<string,number>();const semanticKeys=new Set<string>();const templateOrder=stableShuffle(seeds,seed);const handCycles=new Map<number,Array<readonly [string,string]>>();
  for(let slot=0;slot<count;slot++){
    const prior=answers.slice(0,slot);const key=adaptationKey(prior);const handCycle=Math.floor(slot/holeCardCombinations.length);let handOrder=handCycles.get(handCycle);if(!handOrder){handOrder=balancedHandOrder(seed^(handCycle*0x9e3779b9));handCycles.set(handCycle,handOrder)}const forcedHeroCards=handOrder[slot%holeCardCombinations.length];let pick:PlayerDnaSpot|null=null;let bestScore=Infinity;let uniqueCandidates=0;
    for(let candidate=0;candidate<256&&uniqueCandidates<32;candidate++){
      const ordinal=slot*256+candidate;const template=templateOrder[(slot+candidate)%templateOrder.length];const generated=variant(template,ordinal,seed,key,forcedHeroCards);const semanticKey=semanticSpotKey(generated);if(semanticKeys.has(semanticKey))continue;uniqueCandidates++;const dimensions=describeSpot(generated);const balanceScore=keyEntries(dimensions).reduce((sum,item)=>sum+(counts.get(item)??0),0);const score=balanceScore+adaptiveBias(dimensions,prior);if(score<bestScore){bestScore=score;pick=generated}
    }
    if(!pick)break;selected.push(pick);semanticKeys.add(semanticSpotKey(pick));keyEntries(describeSpot(pick)).forEach(k=>counts.set(k,(counts.get(k)??0)+1));
  }
  return selected;
}
