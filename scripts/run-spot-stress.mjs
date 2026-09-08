import {execFileSync,spawnSync} from "node:child_process";
import {readFileSync,writeFileSync,rmSync} from "node:fs";

rmSync(".spot-test",{recursive:true,force:true});
execFileSync(process.platform==="win32"?"npx.cmd":"npx",["tsc","-p","tsconfig.spot-test.json"],{stdio:"inherit"});
const patchAlias=(path,replacements)=>{let code=readFileSync(path,"utf8");for(const [from,to] of replacements)code=code.replaceAll(from,to);writeFileSync(path,code)};
patchAlias(".spot-test/lib/player-dna-sampler.js",[['require("@/lib/spot-identity")','require("./spot-identity")']]);
patchAlias(".spot-test/lib/player-dna-technical-analysis.js",[['require("@/lib/player-dna-solver-v2")','require("./player-dna-solver-v2")']]);
patchAlias(".spot-test/lib/player-dna-solver-v2.js",[['require("@/lib/gto-reference-validation")','require("./gto-reference-validation")']]);
patchAlias(".spot-test/lib/gto-benchmark-corpus.js",[['require("@/lib/gto-reference-validation")','require("./gto-reference-validation")']]);
const run=file=>{const result=spawnSync(process.execPath,[file],{stdio:"inherit"});if(result.status!==0){rmSync(".spot-test",{recursive:true,force:true});process.exit(result.status??1)}};
run(".spot-test/tests/spot-generation-stress.js");
run(".spot-test/tests/player-dna-diagnostic-sanity.js");
run(".spot-test/tests/gto-reference-validation.js");
run(".spot-test/tests/gto-benchmark-corpus.js");
rmSync(".spot-test",{recursive:true,force:true});
