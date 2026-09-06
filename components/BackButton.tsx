"use client";

import {useRouter} from "next/navigation";

export default function BackButton({eventName}:{eventName?:string}){
  const router=useRouter();
  const goBack=()=>{
    if(eventName==="player-dna-previous"&&document.querySelector(".saved-analysis-panel")){
      router.push("/");
      return;
    }
    if(eventName){window.dispatchEvent(new Event(eventName));return}
    router.back();
  };
  return <button type="button" className="module-back" onClick={goBack}>← ANTERIOR</button>;
}
