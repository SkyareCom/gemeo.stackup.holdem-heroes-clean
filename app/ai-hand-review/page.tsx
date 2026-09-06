import Link from "next/link";
import HandVisionImport from "@/components/HandVisionImport";
import HandReviewWorkspace from "@/components/HandReviewWorkspace";
import BackButton from "@/components/BackButton";

export default function AiHandReviewPage(){return <main className="module-page ai-hand-review-page"><nav className="module-navigation" aria-label="Navegação do módulo"><BackButton/><Link className="module-back" href="/">MÓDULOS</Link></nav><HandVisionImport/><HandReviewWorkspace/></main>}
