import type {PlayerDnaSpot} from "@/data/player-dna-spots";

type HistoryItem={position:string;action:string;value:number};
type SpotWithHistory=PlayerDnaSpot&{actionHistory?:HistoryItem[];heroToCall?:number;currentBet?:number};

function n(value:number){return Number.isFinite(value)?Math.round(value*10000)/10000:0}
function t(value:string|undefined){return(value??"").trim().toUpperCase()}
function hash32(value:string,seed:number){let hash=seed>>>0;for(let i=0;i<value.length;i++){hash^=value.charCodeAt(i);hash=Math.imul(hash,16777619);hash^=hash>>>13;hash=Math.imul(hash,0x5bd1e995);hash^=hash>>>15}return(hash>>>0).toString(16).padStart(8,"0")}

export function canonicalSpotState(spot:PlayerDnaSpot){
  const extended=spot as SpotWithHistory;
  const hero=spot.players.find(player=>player.hero)??spot.players[0];
  const players=spot.players.map(player=>({position:t(player.position),stack:n(player.stack),action:t(player.action),value:n(player.value),hero:Boolean(player.hero)}));
  const history=(extended.actionHistory??spot.players.filter(player=>!player.hero&&t(player.action)!=="---").map(player=>({position:player.position,action:player.action,value:player.value}))).map(item=>({position:t(item.position),action:t(item.action),value:n(item.value)}));
  const sides=(spot.pot.sides??[]).map(side=>({value:n(side.value),players:[...side.players].map(value=>t(value)).sort()}));
  return{
    mode:spot.mode,
    profile:t(spot.gameProfile),
    anteMode:t(spot.anteMode),
    street:spot.street,
    hero:{position:t(hero?.position),stack:n(hero?.stack??0),cards:t(spot.heroCards)},
    board:t(spot.board),
    players,
    pot:{main:n(spot.pot.main),sides},
    history,
    heroToCall:n(extended.heroToCall??0),
    currentBet:n(extended.currentBet??0),
    legalActions:[...spot.actions].map(value=>t(value)).sort(),
    scenario:[...spot.scenario].map(value=>t(value)).sort(),
  };
}

export function exactSpotFingerprint(spot:PlayerDnaSpot){
  const canonical=JSON.stringify(canonicalSpotState(spot));
  return`spot-${hash32(canonical,0x811c9dc5)}${hash32(canonical,0x9e3779b9)}${hash32(canonical,0x85ebca6b)}${hash32(canonical,0xc2b2ae35)}`;
}
