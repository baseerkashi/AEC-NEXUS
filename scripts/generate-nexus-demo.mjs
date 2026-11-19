import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = mkdtempSync(path.join(tmpdir(), "obs-nexus-ifc-"));
const tsc = spawnSync("npx", ["tsc", "--rootDir", "src", "--outDir", out, "--module", "commonjs", "--target", "ES2022", "--skipLibCheck", "--noCheck", "src/modules/bim-gaps/authored-ifc.ts"], { cwd: root, stdio: "inherit", shell: true });
if (tsc.status !== 0) process.exit(1);
const require = createRequire(import.meta.url);
const { exportAuthoredToIfc } = require(path.join(out, "modules/bim-gaps/authored-ifc.js"));
const levels = [{ id: "L0", name: "Level 0", elevation: 0 }, { id: "L1", name: "Level 1", elevation: 3.2 }];
const structural = [
  ...[[1,1],[9,1],[1,7],[9,7]].map(([x,z],i)=>({id:`C${i+1}`,type:"column",name:`Concrete Column ${i+1}`,params:{point:[x,z],height:6.4,thickness:.45,depth:.45,elevation:0},levelId:"L0"})),
  ...[[0,2,10,2],[0,4,10,4]].map(([x,z,xx,zz],i)=>({id:`B${i+1}`,type:"beam",name:`Steel Beam ${i+1}`,params:{start:[x,z],end:[xx,zz],height:.45,thickness:.3,elevation:3.0},levelId:"L1"})),
  {id:"S1",type:"slab",name:"Level 1 Concrete Slab",params:{polygon:[[0,0],[10,0],[10,8],[0,8]],height:.25,thickness:.25,elevation:3.0},levelId:"L1"},
  {id:"F1",type:"slab",name:"Ground Floor Slab",params:{polygon:[[0,0],[10,0],[10,8],[0,8]],height:.25,thickness:.25,elevation:0},levelId:"L0"},
  {id:"W1",type:"wall",name:"North Partition Wall",params:{start:[0,5],end:[10,5],height:3,thickness:.2,elevation:0},levelId:"L0"},
  {id:"W2",type:"wall",name:"East Partition Wall",params:{start:[12,0],end:[12,8],height:3,thickness:.2,elevation:0},levelId:"L0"},
  {id:"CL1",type:"ceiling",name:"Level 0 Ceiling",params:{polygon:[[0,0],[10,0],[10,8],[0,8]],height:.15,thickness:.15,elevation:4.5},levelId:"L0"},
];
const mep = [
  {id:"D1",type:"duct",name:"Supply Duct A",params:{start:[0,2],end:[10,2],height:.4,thickness:.5,elevation:3.0},levelId:"L1"},
  {id:"D2",type:"duct",name:"Supply Duct B",params:{start:[0,4],end:[10,4],height:.4,thickness:.5,elevation:3.0},levelId:"L1"},
  {id:"P1",type:"pipe",name:"CHW Pipe North",params:{start:[0,5],end:[10,5],height:.12,thickness:.12,elevation:1.1},levelId:"L0"},
  {id:"P2",type:"pipe",name:"Riser Pipe",params:{start:[5,0],end:[5,8],height:.12,thickness:.12,elevation:1.1},levelId:"L0"},
  {id:"P3",type:"pipe",name:"Drain Pipe",params:{start:[0,0],end:[10,0],height:.12,thickness:.12,elevation:.1},levelId:"L0"},
  {id:"CT1",type:"cable-tray",name:"Power Tray North",params:{start:[0,5],end:[10,5],height:.15,thickness:.3,elevation:1.2},levelId:"L0"},
];
mkdirSync(path.join(root,"public","samples"),{recursive:true});
for (const [name, elements] of [["nexus-structural.ifc",structural],["nexus-mep.ifc",mep]]) {
  const result=exportAuthoredToIfc(elements,{schema:"IFC4",levels,projectName:`AEC Nexus ${name.includes("mep")?"MEP":"Structural"}`,timestamp:new Date().toISOString()});
  if (result.stats.skipped.length) throw new Error(`${name}: ${JSON.stringify(result.stats.skipped)}`);
  writeFileSync(path.join(root,"public","samples",name),result.text);
  console.log(`${name}: ${result.stats.elements} elements`);
}
