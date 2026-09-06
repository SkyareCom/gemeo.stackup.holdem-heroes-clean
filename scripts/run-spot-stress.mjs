import {execFileSync,spawnSync} from "node:child_process";
import {readFileSync,writeFileSync,rmSync} from "node:fs";

rmSync(".spot-test",{recursive:true,force:true});
execFileSync(process.platform==="win32"?"npx.cmd":"npx",["tsc","-p","tsconfig.spot-test.json"],{stdio:"inherit"});
const samplerPath=".spot-test/lib/player-dna-sampler.js";
let sampler=readFileSync(samplerPath,"utf8");
sampler=sampler.replaceAll('require("@/lib/spot-identity")','require("./spot-identity")');
writeFileSync(samplerPath,sampler);
const result=spawnSync(process.execPath,[".spot-test/tests/spot-generation-stress.js"],{stdio:"inherit"});
rmSync(".spot-test",{recursive:true,force:true});
if(result.status!==0)process.exit(result.status??1);
