import Link from "next/link";
import PlayerDnaWorkspace from "@/components/PlayerDnaWorkspace";
import PlayerDnaAnalysisControllerV2 from "@/components/PlayerDnaAnalysisControllerV2";
import PlayerDnaVisualFixes from "@/components/PlayerDnaVisualFixes";
import PlayerDnaAiSpotReplenisher from "@/components/PlayerDnaAiSpotReplenisher";
import "./player-dna-typography.css";
import "./restored-latest.css";

export default function PlayerDnaPage(){
  return <main className="module-page player-dna-page">
    <PlayerDnaAiSpotReplenisher/>
    <PlayerDnaAnalysisControllerV2/>
    <PlayerDnaVisualFixes/>
    <nav className="module-navigation player-dna-navigation" aria-label="NAVEGAÇÃO DO MÓDULO">
      <Link className="module-back player-dna-nav-button" href="/">← ANTERIOR</Link>
      <Link className="module-back player-dna-nav-button" href="/">MÓDULOS</Link>
    </nav>
    <section className="panel profile-panel">
      <PlayerDnaWorkspace/>
    </section>
  </main>;
}
