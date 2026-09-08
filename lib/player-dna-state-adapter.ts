import type {PlayerDnaSpot} from "@/data/player-dna-spots";
import type {SolverSpotState} from "@/lib/player-dna-solver-v2";

export function playerDnaSpotToSolverState(spot:PlayerDnaSpot):SolverSpotState|null{
  const hero=spot.players.find(player=>player.hero)??spot.players[0];
  if(!hero)return null;
  return{
    mode:spot.mode,
    street:spot.street,
    hero:{position:hero.position,stack:hero.stack,cards:spot.heroCards.split(" ").filter(Boolean)},
    board:(spot.board??"").split(" ").filter(Boolean),
    pot:spot.pot.main,
    potSides:spot.pot.sides,
    players:spot.players.map(player=>({position:player.position,stack:player.stack,action:player.action,value:player.value})),
    scenario:spot.scenario,
    actionHistory:spot.actionHistory,
    heroToCall:spot.heroToCall,
    currentBet:spot.currentBet,
    legalActions:spot.legalActions??spot.actions,
    rakePct:spot.rakePct,
    anteBb:spot.anteBb,
    payouts:spot.payouts,
    fieldStacks:spot.fieldStacks,
    bounties:spot.bounties,
    ranges:spot.ranges,
    commitments:spot.commitments,
  };
}
