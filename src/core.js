'use strict';
// =====================================================================
// CORE: definitions, map, pathfinding, entities and simulation
// =====================================================================
const TILE=40,HUDH=170,HSTEP=20,AIR_H=80,UNIT_CAP=60;
let MW=64,MH=64,WW=MW*TILE,WH=MH*TILE,HN=MW*2+1;
function setMapSize(n){MW=MH=n;WW=WH=n*TILE;HN=n*2+1}
const $=id=>document.getElementById(id);
const R=Math.random,dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const idx=(x,y)=>y*MW+x, inb=(x,y)=>x>=0&&y>=0&&x<MW&&y<MH, tileOf=v=>Math.floor(v/TILE);
function turnTo(a,b,m){let d=((b-a+Math.PI*3)%(Math.PI*2))-Math.PI;return Math.abs(d)<=m?b:a+Math.sign(d)*m}
function angDiff(a,b){return Math.abs(((b-a+Math.PI*3)%(Math.PI*2))-Math.PI)}

// ---------- DEFINITIONS ----------
const TEAM=[{main:0x4f8f3a,light:0x94d86c,dark:0x2c5220,mini:'#6f6',css:'#8f8'},{main:0xa13a30,light:0xea6d5c,dark:0x5a1d18,mini:'#f55',css:'#f88'},
  {main:0x3a5fb0,light:0x7fa3ff,dark:0x1d2f60,mini:'#69f',css:'#8af'},{main:0xc07a20,light:0xffc060,dark:0x60380a,mini:'#fa4',css:'#fc7'}];
const TEAM_NAMES=['Green','Red','Blue','Orange'];
const BODIES={
  viper:{name:'Viper',hp:170,cost:30,spd:1.05,size:1,desc:'Light body. Cheap and quick.'},
  cobra:{name:'Cobra',hp:330,cost:65,spd:1,size:1.2,desc:'Medium body. A good all-rounder.'},
  python:{name:'Python',hp:540,cost:110,spd:.88,size:1.4,req:'python',desc:'Heavy body. Very tough but slower.'}
};
const PROPS={
  wheels:{name:'Wheels',speed:92,hpm:.85,cost:10,desc:'Fast and cheap, but fragile.'},
  half:{name:'Half-tracks',speed:76,hpm:1,cost:20,desc:'Balanced speed and armor.'},
  tracks:{name:'Tracks',speed:58,hpm:1.3,cost:35,req:'tracks',desc:'Slow but very tough.'},
  hover:{name:'Hover',speed:122,hpm:.7,cost:30,req:'hover',desc:'Very fast, light armor.'},
  vtol:{name:'VTOL',speed:175,hpm:.75,cost:70,req:'vtol',air:true,desc:'Flies over everything. Rearms at VTOL Pads.'}
};
const WEAPONS={
  mg:{name:'Machinegun',cost:20,dmg:9,rof:.35,range:190,proj:'mg',cls:'mg',air:true,desc:'Rapid fire. Can also hit VTOLs.'},
  cannon:{name:'Cannon',cost:50,dmg:40,rof:1.8,range:225,proj:'cannon',cls:'cannon',heavy:true,desc:'Strong shells, slow reload.'},
  lancer:{name:'Lancer',cost:60,dmg:36,rof:1.6,range:245,proj:'rocket',cls:'rocket',req:'lancer',desc:'Anti-tank rockets with long range.'},
  mortar:{name:'Mortar',cost:70,dmg:40,rof:3.2,range:430,minRange:90,splash:55,proj:'mortar',cls:'rocket',req:'mortar',noVtol:true,desc:'Long-range artillery with splash damage. Cannot hit targets up close.'},
  aa:{name:'Hurricane AA',cost:45,dmg:16,rof:.45,range:320,proj:'flak',cls:'mg',air:true,airOnly:true,req:'aa',noVtol:true,desc:'Shoots down VTOLs. Cannot hit ground targets.'},
  bomb:{name:'Cluster Bombs',cost:60,dmg:75,rof:1.1,range:60,splash:45,proj:'bomb',cls:'cannon',req:'vtol',vtolOnly:true,desc:'VTOL only. Heavy splash damage on the ground.'},
  construct:{name:'Construction',cost:15,util:'truck',noVtol:true,desc:'Builds and repairs structures.'},
  repair:{name:'Repair Turret',cost:40,util:'repair',noVtol:true,heal:14,range:90,desc:'Repairs nearby damaged units.'}
};
const VTOL_AMMO={mg:10,cannon:3,lancer:4,bomb:4};
const BDEF={
  hq:{name:'Command Center',w:3,h:3,hp:2400,cost:0,time:1,desc:'Your headquarters. Protect it at all costs.'},
  factory:{name:'Factory',w:3,h:3,hp:1300,cost:250,time:20,desc:'Produces your unit designs.'},
  research:{name:'Research Facility',w:2,h:2,hp:750,cost:150,time:15,desc:'Researches new technology.'},
  derrick:{name:'Oil Derrick',w:1,h:1,hp:450,cost:50,time:6,desc:'Build on a burning oil resource to generate power.'},
  wall:{name:'Wall',w:1,h:1,hp:900,cost:20,time:3,desc:'Blocks enemy tanks. Click and drag to build a line.'},
  tower:{name:'Guard Tower',w:1,h:1,hp:650,cost:125,time:10,weapon:'mg',gunH:26,desc:'Machinegun tower. Can also hit VTOLs.'},
  bunker:{name:'MG Bunker',w:1,h:1,hp:1500,cost:110,time:12,weapon:'mg',dmgMul:1.3,rangeAdd:10,gunH:10,req:'hardpoint',desc:'Very tough machinegun bunker.'},
  hardpoint:{name:'Cannon Hardpoint',w:1,h:1,hp:1800,cost:250,time:18,weapon:'cannon',rangeAdd:30,gunH:32,req:'hardpoint',desc:'Heavy cannon fortress.'},
  mortarPit:{name:'Mortar Pit',w:1,h:1,hp:800,cost:200,time:15,weapon:'mortar',rangeAdd:20,gunH:10,req:'mortar',desc:'Long-range artillery emplacement.'},
  aaSite:{name:'AA Site',w:1,h:1,hp:700,cost:150,time:12,weapon:'aa',rangeAdd:20,gunH:16,req:'aa',desc:'Anti-air guns against VTOLs.'},
  repairFac:{name:'Repair Facility',w:2,h:2,hp:900,cost:200,time:18,req:'repairfac',heal:32,range:110,desc:'Repairs nearby units. Send damaged units here.'},
  vtolPad:{name:'VTOL Pad',w:1,h:1,hp:500,cost:100,time:8,req:'vtol',desc:'VTOLs land here to rearm and repair.'}
};
const BUILD_LIST=['factory','research','derrick','wall','tower','bunker','hardpoint','mortarPit','aaSite','repairFac','vtolPad'];
const DEFENSES=['tower','bunker','hardpoint','mortarPit','aaSite'];
const RESEARCH=[
  {id:'mg',name:'Hardened MG Bullets',desc:'+30% machinegun and AA damage',cost:120,time:18},
  {id:'tracks',name:'Tracked Propulsion',desc:'Unlocks Tracks',cost:150,time:20},
  {id:'hardpoint',name:'Hardened Defenses',desc:'Unlocks MG Bunkers and Cannon Hardpoints',cost:150,time:20},
  {id:'lancer',name:'Lancer Rockets',desc:'Unlocks the Lancer anti-tank weapon',cost:150,time:22},
  {id:'python',name:'Python Body',desc:'Unlocks the heavy Python body',cost:200,time:25},
  {id:'repairfac',name:'Repair Facility',desc:'Unlocks the Repair Facility',cost:150,time:20},
  {id:'cannon',name:'HEAT Cannon Shells',desc:'+30% cannon and bomb damage',cost:180,time:24},
  {id:'mortar',name:'Mortar',desc:'Unlocks Mortar turrets and Mortar Pits',cost:175,time:24},
  {id:'hover',name:'Hover Propulsion',desc:'Unlocks fast Hover propulsion',cost:150,time:20},
  {id:'aa',name:'Hurricane AA',desc:'Unlocks AA Sites and AA turrets',cost:150,time:20},
  {id:'vtol',name:'VTOL Aircraft',desc:'Unlocks VTOL propulsion, bombs and VTOL Pads',cost:300,time:35,req:'aa'},
  {id:'rocket',name:'HE Rocket Warheads',desc:'+30% rocket and mortar damage',cost:200,time:25,req:'lancer'},
  {id:'armor',name:'Composite Alloys',desc:'+35% armor for everything',cost:250,time:30},
  {id:'oil',name:'Improved Derricks',desc:'+50% oil output',cost:200,time:25},
  {id:'engine',name:'Improved Engines',desc:'+20% unit speed',cost:150,time:20}
];
const RANKS=[0,1,3,6,10],RANK_NAMES=['Rookie','Green','Trained','Veteran','Elite'];
const DIFF={easy:{inc:.7,first:420,gap:200},normal:{inc:1,first:300,gap:160},hard:{inc:1.45,first:210,gap:120}};
const THEMES={
  desert:{name:'Desert Canyon',ground:'#9a7650',blot:['125,72,45','175,140,92'],speck:['rgba(60,40,25,.35)','rgba(215,185,135,.25)'],rockBase:'#5a4535',rock:['#6b5240','#4a392c','#7a604a','#3a2c22','#5e4a3a'],road:'#353432',bg:0x0b0812,hemi:[0xfff0dd,0x4a2c1a],sun:0xffe8cc,gen:'canyon',cliff:78,rocks:24},
  snow:{name:'Frozen Pass',ground:'#d6dbe2',blot:['150,160,178','245,248,252'],speck:['rgba(110,120,140,.3)','rgba(255,255,255,.5)'],rockBase:'#59606b',rock:['#6e7682','#4b515b','#8a929e','#3a3f47','#626a75'],road:'#4a4d52',bg:0x0d1118,hemi:[0xe8f0ff,0x4a5260],sun:0xf0f4ff,gen:'canyon',cliff:92,rocks:30},
  city:{name:'Ruined City',ground:'#6f6c66',blot:['90,88,84','135,128,118'],speck:['rgba(40,40,40,.35)','rgba(180,175,165,.25)'],rockBase:'#4c4845',rock:['#5d5955','#3e3b38','#6d6863','#2e2c2a','#55514c'],road:'#2e2e30',bg:0x0a0a0c,hemi:[0xf2eee8,0x3a3632],sun:0xfff4e0,gen:'city',cliff:72}
};
const DEFAULT_TEMPLATES=[
  {name:'Truck',body:'viper',prop:'wheels',weapon:'construct'},
  {body:'viper',prop:'wheels',weapon:'mg'},
  {body:'cobra',prop:'half',weapon:'cannon'},
  {name:'Repair Truck',body:'viper',prop:'wheels',weapon:'repair'},
  {body:'cobra',prop:'half',weapon:'lancer'},
  {body:'python',prop:'tracks',weapon:'cannon'},
  {body:'cobra',prop:'tracks',weapon:'mortar'},
  {body:'cobra',prop:'half',weapon:'aa'},
  {body:'cobra',prop:'hover',weapon:'mg'},
  {body:'cobra',prop:'vtol',weapon:'bomb'}
];

// ---------- STATE ----------
let rock,bldMap,oilMap,oils=[],hv,ents=[],byId=new Map(),nextId=1,power=[0,0],tech=[{},{}],sel=[],placing=null,projs=[],fx=[],decals=[],time=0,state='menu',paused=false,diff='normal',ais=[],stats={kills:0,lost:0,built:0},terrainCv,miniBg,lastAlert=-99,msgT=0,roadPts=[],world=null,markers=[];
let explored,visible,fogCur,fogTex=null,fogCv=null,fogT=0,missionT=0;
let gameId=0,mapSeed=0,themeId='desert',theme=THEMES.desert,templates=[[],[]],groups={},game={mode:'skirmish',mission:-1,ms:{},teams:2,ally:[0,1]};
const alive=e=>!!e&&e.hp>0&&byId.has(e.id);
function hostile(a,b){const al=game.ally||[0,1,2,3];return a!==b&&al[a]!==al[b]}
function blocked(tx,ty){return !inb(tx,ty)||rock[idx(tx,ty)]===1||bldMap[idx(tx,ty)]!==0}
function edgeDist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)-(b.kind==='b'?b.r:b.r*0.5)}
function msg(t,d=3){$('msg').textContent=t;msgT=d}
const has=(team,id)=>!!tech[team][id], avail=(team,c)=>!c.req||has(team,c.req);
const findHQ=t=>ents.find(e=>e.team===t&&e.type==='hq'&&e.hp>0);
const countB=(t,type,any)=>ents.filter(e=>e.team===t&&e.type===type&&e.hp>0&&(any||e.built>=1)).length;

// ---------- DESIGNS ----------
const dkey=d=>d.body+'.'+d.prop+'.'+d.weapon;
function calcStats(d){const b=BODIES[d.body],p=PROPS[d.prop],w=WEAPONS[d.weapon],cost=b.cost+p.cost+w.cost;
  return{hp:Math.round(b.hp*p.hpm),speed:p.speed*b.spd*(w.heavy?.92:1),cost,time:Math.round(Math.max(4,cost/17)),r:Math.round(11*b.size+2),air:!!p.air,w,util:w.util||null,
    gunH:(p.air?3:(d.prop==='tracks'||d.prop==='hover'?11:10))+6*b.size,name:w.util==='truck'&&d.body==='viper'&&d.prop==='wheels'?'Truck':w.name+' '+b.name+' '+p.name}}
function designError(d){const p=PROPS[d.prop],w=WEAPONS[d.weapon];if(p.air&&w.noVtol)return w.name+' cannot be mounted on a VTOL.';if(w.vtolOnly&&!p.air)return w.name+' can only be carried by a VTOL.';return ''}
function designOk(team,d){return !designError(d)&&avail(team,BODIES[d.body])&&avail(team,PROPS[d.prop])&&avail(team,WEAPONS[d.weapon])}
function addDefaultTemplates(team){let n=0;for(const t of DEFAULT_TEMPLATES)if(designOk(team,t)&&!templates[team].some(x=>dkey(x)===dkey(t))){templates[team].push({...t,name:t.name||calcStats(t).name});n++}return n}
function structWeapon(type){const d=BDEF[type];if(!d.weapon)return null;const w=WEAPONS[d.weapon];return{...w,range:w.range+(d.rangeAdd||0),dmg:w.dmg*(d.dmgMul||1)}}
const wOf=e=>e.kind==='u'?e.st.w:e.sw;
const isAir=e=>e.kind==='u'&&e.st.air;
const isTruck=e=>e.kind==='u'&&e.st.util==='truck';
function dmgMult(team,cls){const t=tech[team];return cls==='mg'?(t.mg?1.3:1):cls==='cannon'?(t.cannon?1.3:1):(t.rocket?1.3:1)}
function dmgOf(e){const w=wOf(e);return w.dmg*dmgMult(e.team,w.cls)*(e.kind==='u'?1+.12*e.rank:1)}
function canHit(e,o){const w=wOf(e);if(!w||w.util)return false;if(isAir(o))return !!w.air&&!isAir(e);return !w.airOnly}

// ---------- MAP ----------
function rng(s){return function(){s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function setRock(x,y,v){x=Math.round(x);y=Math.round(y);if(inb(x,y)){rock[idx(x,y)]=v;rock[idx(MW-1-x,y)]=v;rock[idx(x,MH-1-y)]=v;rock[idx(MW-1-x,MH-1-y)]=v}}
function disc(cx,cy,r,v){for(let y=Math.floor(cy-r);y<=cy+r;y++)for(let x=Math.floor(cx-r);x<=cx+r;x++)if((x-cx)**2+(y-cy)**2<=r*r)setRock(x,y,v)}
function carve(x0,y0,x1,y1,r){const n=Math.ceil(Math.hypot(x1-x0,y1-y0))*2;for(let i=0;i<=n;i++)disc(x0+(x1-x0)*i/n,y0+(y1-y0)*i/n,r,0)}
// the map is mirrored into four corners; these give the bottom-left quarter
const baseTile=()=>[11,MH-11];
function oilQuarter(){const S=MW,b=baseTile(),o=[[b[0]-5,b[1]-6],[b[0]+4,b[1]+5],[b[0]+7,b[1]-5],[b[0]-7,b[1]+5]];
  const f=[[.34,.63],[.42,.81],[.47,.53],[.19,.53]];if(S>64)f.push([.27,.72],[.12,.66],[.4,.93]);if(S>96)f.push([.22,.88],[.33,.57]);
  for(const[fx,fy]of f)o.push([Math.round(fx*S),Math.round(fy*S)]);return o}
function genMap(seed,tid,clears){
  theme=THEMES[tid];themeId=tid;mapSeed=seed;
  const r=rng(seed);rock=new Uint8Array(MW*MH);
  if(theme.gen==='city'){for(let by=1;by<MH;by+=8)for(let bx=1;bx<MW;bx+=8){if(r()<.18)continue;const w=2+Math.floor(r()*4),h=2+Math.floor(r()*4),ox=bx+1+Math.floor(r()*(7-w)),oy=by+1+Math.floor(r()*(7-h));for(let y=oy;y<oy+h;y++)for(let x=ox;x<ox+w;x++)setRock(x,y,1)}}
  else for(let i=0;i<theme.rocks*(MW/64)**2;i++){const cx=3+r()*(MW-6),cy=3+r()*(MH-6),rad=1.5+r()*3.2;disc(cx,cy,rad,1);for(let k=0;k<3;k++)disc(cx+(r()-.5)*rad*2.2,cy+(r()-.5)*rad*2.2,rad*.7,1)}
  const B=baseTile(),MID=[MW/2-.5,MH/2-.5],OQ=oilQuarter();
  disc(B[0],B[1],10,0);
  for(const o of OQ){carve(o[0],o[1],MID[0],MID[1],1.3);disc(o[0],o[1],2,0)}
  carve(B[0],B[1],MID[0],MID[1],1.8);
  for(const c of clears||[]){disc(c[0],c[1],c[2],0);carve(c[0],c[1],MID[0],MID[1],1.3)}
  for(let x=0;x<MW;x++)for(let y=0;y<MH;y++)if(x<2||y<2||x>=MW-2||y>=MH-2)rock[idx(x,y)]=1;
  const seen=new Uint8Array(MW*MH),st=[idx(B[0],B[1])];seen[st[0]]=1;
  while(st.length){const n=st.pop(),x=n%MW,y=n/MW|0;for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(inb(nx,ny)&&!rock[idx(nx,ny)]&&!seen[idx(nx,ny)]){seen[idx(nx,ny)]=1;st.push(idx(nx,ny))}}}
  for(let i=0;i<MW*MH;i++)if(!seen[i])rock[i]=1;
  oils=[];oilMap=new Int16Array(MW*MH);
  for(const o of OQ)for(const p of[[o[0],o[1]],[MW-1-o[0],o[1]],[o[0],MH-1-o[1]],[MW-1-o[0],MH-1-o[1]]]){if(!inb(p[0],p[1])||oilMap[idx(p[0],p[1])]||rock[idx(p[0],p[1])])continue;oils.push({tx:p[0],ty:p[1],x:(p[0]+.5)*TILE,y:(p[1]+.5)*TILE,bid:0});oilMap[idx(p[0],p[1])]=oils.length}
  roadPts=[[B[0],B[1]],[MW-B[0],B[1]],[B[0],MH-B[1]],[MW-B[0],MH-B[1]]].map(p=>[[p[0]*TILE,p[1]*TILE],[MID[0]*TILE,MID[1]*TILE]]);
  hv=new Float32Array(HN*HN);
  const isR=(x,y)=>{const tx=tileOf(x),ty=tileOf(y);return !inb(tx,ty)||rock[idx(tx,ty)]?1:0},city=theme.gen==='city';
  for(let j=0;j<HN;j++)for(let i=0;i<HN;i++){const x=i*HSTEP,y=j*HSTEP;
    const f=(isR(x-10,y-10)+isR(x+10,y-10)+isR(x-10,y+10)+isR(x+10,y+10))/4;
    const n=(Math.sin(x*.011+1.3)*Math.cos(y*.009)*5+Math.sin(x*.031+y*.027)*2)*(city?.25:1);
    hv[j*HN+i]=n+f*(city?theme.cliff+(f>=1?(r()<.5?0:18):0):theme.cliff+r()*26*f)}
  buildTerrainTexture(r);
}
function heightAt(x,y){const fx=clamp(x/HSTEP,0,HN-1.001),fy=clamp(y/HSTEP,0,HN-1.001),i=fx|0,j=fy|0,u=fx-i,v=fy-j;
  const a=hv[j*HN+i],b=hv[j*HN+i+1],c=hv[(j+1)*HN+i],d=hv[(j+1)*HN+i+1];return a*(1-u)*(1-v)+b*u*(1-v)+c*(1-u)*v+d*u*v}
function buildTerrainTexture(r){
  const T=theme,k=Math.min(1,3072/WW),area=(MW/64)**2;terrainCv=document.createElement('canvas');terrainCv.width=terrainCv.height=Math.round(WW*k);const g=terrainCv.getContext('2d');g.scale(k,k);
  g.fillStyle=T.ground;g.fillRect(0,0,WW,WH);
  for(let i=0;i<260*area;i++){const x=r()*WW,y=r()*WH,rad=40+r()*160,gr=g.createRadialGradient(x,y,0,x,y,rad);const c=r()<.5?T.blot[0]:T.blot[1];gr.addColorStop(0,`rgba(${c},${.25+r()*.25})`);gr.addColorStop(1,`rgba(${c},0)`);g.fillStyle=gr;g.fillRect(x-rad,y-rad,rad*2,rad*2)}
  for(let i=0;i<30000*area;i++){g.fillStyle=r()<.5?T.speck[0]:T.speck[1];g.fillRect(r()*WW,r()*WH,1+r()*2,1+r()*2)}
  g.lineCap='round';g.lineJoin='round';
  const road=pts=>{g.strokeStyle='#1f1f1f';g.lineWidth=36;g.beginPath();pts.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.stroke();g.strokeStyle=T.road;g.lineWidth=30;g.stroke();g.strokeStyle='#d8c040';g.lineWidth=2;g.setLineDash([16,14]);g.stroke();g.setLineDash([])};
  if(T.gen==='city'){for(let k=1;k<MW;k+=8){road([[k*TILE,0],[k*TILE,WH]]);road([[0,k*TILE],[WW,k*TILE]])}}
  for(const rp of roadPts)road(rp);
  for(let i=0;i<40*area;i++){const x=r()*WW,y=r()*WH;if(rock[idx(tileOf(x),tileOf(y))])continue;const rad=8+r()*14;const gr=g.createRadialGradient(x,y,0,x,y,rad);gr.addColorStop(0,'rgba(30,18,10,.8)');gr.addColorStop(.7,'rgba(70,40,20,.5)');gr.addColorStop(1,'rgba(160,110,60,0)');g.fillStyle=gr;g.beginPath();g.arc(x,y,rad,0,7);g.fill()}
  if(T.gen==='city'){
    for(let y=0;y<MH;y++)for(let x=0;x<MW;x++)if(rock[idx(x,y)]){g.fillStyle=T.rockBase;g.fillRect(x*TILE,y*TILE,TILE,TILE);g.fillStyle=T.rock[Math.floor(r()*5)];g.fillRect(x*TILE+4,y*TILE+4,TILE-8,TILE-8);
      if(r()<.5){g.fillStyle='#2a2826';g.fillRect(x*TILE+8+r()*16,y*TILE+8+r()*16,8,8)}
      g.strokeStyle='rgba(0,0,0,.35)';g.lineWidth=1;g.strokeRect(x*TILE+.5,y*TILE+.5,TILE-1,TILE-1)}}
  else{
    for(let y=0;y<MH;y++)for(let x=0;x<MW;x++)if(rock[idx(x,y)]){g.fillStyle=T.rockBase;g.fillRect(x*TILE-6,y*TILE-6,TILE+12,TILE+12)}
    for(let y=0;y<MH;y++)for(let x=0;x<MW;x++)if(rock[idx(x,y)]){for(let k=0;k<5;k++){const px=x*TILE+r()*TILE,py=y*TILE+r()*TILE,s=6+r()*14;g.fillStyle=T.rock[k];g.beginPath();g.moveTo(px,py-s);g.lineTo(px+s,py);g.lineTo(px+s*.3,py+s*.8);g.lineTo(px-s*.8,py+s*.2);g.closePath();g.fill()}}}
  miniBg=document.createElement('canvas');miniBg.width=miniBg.height=154;miniBg.getContext('2d').drawImage(terrainCv,0,0,154,154);
}

// ---------- PATHFINDING ----------
function nearestFree(tx,ty,rx,ry){
  tx=clamp(tx,0,MW-1);ty=clamp(ty,0,MH-1);
  if(!blocked(tx,ty))return[tx,ty];
  for(let r=1;r<20;r++){let best=null,bd=1e9;
    for(let y=ty-r;y<=ty+r;y++)for(let x=tx-r;x<=tx+r;x++){if(Math.max(Math.abs(x-tx),Math.abs(y-ty))!==r||blocked(x,y))continue;const d=(x-rx)**2+(y-ry)**2;if(d<bd){bd=d;best=[x,y]}}
    if(best)return best}
  return null;
}
const DIRS=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
function findPath(sx,sy,gx,gy){
  sx=clamp(sx,0,MW-1);sy=clamp(sy,0,MH-1);
  if(blocked(gx,gy)){const f=nearestFree(gx,gy,sx,sy);if(!f)return null;gx=f[0];gy=f[1]}
  const N=MW*MH,g=new Float32Array(N).fill(1e9),came=new Int32Array(N).fill(-1),closed=new Uint8Array(N);
  const hf=(x,y)=>{const dx=Math.abs(x-gx),dy=Math.abs(y-gy);return Math.max(dx,dy)+.4142*Math.min(dx,dy)};
  const heap=[];const push=(f,n)=>{heap.push([f,n]);let i=heap.length-1;while(i>0){const p=(i-1)>>1;if(heap[p][0]<=heap[i][0])break;[heap[p],heap[i]]=[heap[i],heap[p]];i=p}};
  const pop=()=>{const top=heap[0],last=heap.pop();if(heap.length){heap[0]=last;let i=0;for(;;){const l=i*2+1,r=l+1;let m=i;if(l<heap.length&&heap[l][0]<heap[m][0])m=l;if(r<heap.length&&heap[r][0]<heap[m][0])m=r;if(m===i)break;[heap[m],heap[i]]=[heap[i],heap[m]];i=m}}return top[1]};
  const s=idx(sx,sy),goal=idx(gx,gy);g[s]=0;push(hf(sx,sy),s);let best=s,bestH=hf(sx,sy),it=0;
  while(heap.length&&it++<MW*MH*.7){const n=pop();if(closed[n])continue;closed[n]=1;if(n===goal){best=n;break}
    const x=n%MW,y=n/MW|0,h=hf(x,y);if(h<bestH){bestH=h;best=n}
    for(const[dx,dy]of DIRS){const nx=x+dx,ny=y+dy;if(blocked(nx,ny))continue;if(dx&&dy&&(blocked(x+dx,y)||blocked(x,y+dy)))continue;
      const ni=idx(nx,ny);if(closed[ni])continue;const ng=g[n]+(dx&&dy?1.4142:1);if(ng<g[ni]){g[ni]=ng;came[ni]=n;push(ng+hf(nx,ny),ni)}}}
  const out=[];let c=best;while(c!==-1){out.push(c);c=came[c]}out.reverse();
  return out.map(i=>[(i%MW+.5)*TILE,((i/MW|0)+.5)*TILE]);
}
function lineClear(ax,ay,bx,by){const d=Math.hypot(bx-ax,by-ay),n=Math.ceil(d/8),px=-(by-ay)/(d||1)*10,py=(bx-ax)/(d||1)*10;
  for(let i=1;i<=n;i++){const x=ax+(bx-ax)*i/n,y=ay+(by-ay)*i/n;if(blocked(tileOf(x),tileOf(y))||blocked(tileOf(x+px),tileOf(y+py))||blocked(tileOf(x-px),tileOf(y-py)))return false}return true}
function setPath(u,x,y){
  if(u.st.air){u.path=[];return}
  const tx=tileOf(x),ty=tileOf(y),p=findPath(tileOf(u.x),tileOf(u.y),tx,ty);
  if(!p){u.path=[];return}
  const last=p[p.length-1];if(!blocked(tx,ty)&&tileOf(last[0])===tx&&tileOf(last[1])===ty)p[p.length-1]=[x,y];
  if(p.length>1)p.shift();
  const res=[];let cx=u.x,cy=u.y,i=0;
  while(i<p.length){let j=p.length-1;while(j>i&&!lineClear(cx,cy,p[j][0],p[j][1]))j--;res.push(p[j]);cx=p[j][0];cy=p[j][1];i=j+1}
  u.path=res;u.stuck=0;
}

// ---------- ENTITIES ----------
function makeBuilding(type,team,tx,ty,built){
  const d=BDEF[type],e={id:nextId++,kind:'b',type,team,tx,ty,w:d.w,h:d.h,x:(tx+d.w/2)*TILE,y:(ty+d.h/2)*TILE,r:d.w*TILE*.45,maxHp:d.hp,hp:built?d.hp:d.hp*.1,built:built?1:0,queue:[],prog:0,rally:null,cd:0,turret:team?2.4:-.8,res:null,scan:R()*.3,auto:null,sw:structWeapon(type),heal:0,healT:0};
  for(let y=ty;y<ty+d.h;y++)for(let x=tx;x<tx+d.w;x++)bldMap[idx(x,y)]=e.id;
  if(type==='derrick'){const o=oils[oilMap[idx(tx,ty)]-1];if(o)o.bid=e.id}
  ents.push(e);byId.set(e.id,e);return e;
}
function makeUnit(d,team,x,y){
  const st=calcStats(d),e={id:nextId++,kind:'u',team,d:{body:d.body,prop:d.prop,weapon:d.weapon},st,x,y,h:st.air?AIR_H:0,r:st.r,maxHp:st.hp,hp:st.hp,angle:team?Math.PI*.75:-Math.PI/4,turret:0,path:[],order:null,cd:0,scan:R()*.3,auto:null,tread:0,home:{x,y},repath:0,stuck:0,lx:x,ly:y,chasing:false,kills:0,rank:0,ammo:st.air?(VTOL_AMMO[d.weapon]||4):0,rearming:false,heal:0,healT:0};
  e.turret=e.angle;ents.push(e);byId.set(e.id,e);return e;
}
function canPlace(type,tx,ty,margin=0){
  const d=BDEF[type];
  if(type==='derrick'){if(!inb(tx,ty))return false;const o=oilMap[idx(tx,ty)];return o>0&&!oils[o-1].bid&&!blocked(tx,ty)}
  for(let y=ty-margin;y<ty+d.h+margin;y++)for(let x=tx-margin;x<tx+d.w+margin;x++){
    const inner=x>=tx&&y>=ty&&x<tx+d.w&&y<ty+d.h;
    if(!inb(x,y))return false;
    if(inner&&(rock[idx(x,y)]||bldMap[idx(x,y)]||oilMap[idx(x,y)]))return false;
    if(!inner&&(bldMap[idx(x,y)]||oilMap[idx(x,y)]))return false}
  return true;
}
function placeBuilding(type,team,tx,ty){
  const c=BDEF[type].cost;if(power[team]<c||!canPlace(type,tx,ty))return null;
  power[team]-=c;const b=makeBuilding(type,team,tx,ty,false);b.built=0.01;
  for(const u of ents)if(u.kind==='u'&&!isAir(u)&&bldMap[idx(tileOf(u.x),tileOf(u.y))]===b.id){const f=nearestFree(tileOf(u.x),tileOf(u.y),tileOf(u.x),tileOf(u.y));if(f){u.x=(f[0]+.5)*TILE;u.y=(f[1]+.5)*TILE}}
  return b;
}
function orderBuild(u,b,queue){if(queue&&u.order&&u.order.t==='build'){(u.bq=u.bq||[]).push(b.id);return}u.bq=[];u.order={t:'build',id:b.id};u.path=[];u.repath=0}
function orderMove(u,x,y,t='move'){u.order={t,x,y};u.chasing=false;u.heal=0;setPath(u,x,y)}
function speedOf(u){return u.st.speed*(tech[u.team].engine?1.2:1)}

function damage(t,d,team,src){
  if(!alive(t)||!hostile(team,t.team))return;
  t.hp-=d*(tech[t.team].armor?1/1.35:1)*(t.kind==='u'?1-.04*t.rank:1);
  if(t.team===0&&time-lastAlert>15){lastAlert=time;msg(t.kind==='b'?'Our base is under attack!':'Our units are under attack!');sfx('alert');say(t.kind==='b'?'Base under attack':'Units under attack')}
  if(t.hp<=0){kill(t,team);if(src&&alive(src)&&src.kind==='u')addKill(src)}
}
function addKill(u){u.kills++;let r=0;for(let i=0;i<RANKS.length;i++)if(u.kills>=RANKS[i])r=i;
  if(r>u.rank){u.rank=r;if(u.team===0){msg(u.st.name+' promoted to '+RANK_NAMES[r],2.5);sfx('rankup');say('Unit promoted')}}}
// delayed callback that is dropped if a new game has started in the meantime
function later(fn,ms){const g=gameId;setTimeout(()=>{if(g===gameId)fn()},ms)}
function kill(t,killer){
  t.hp=0;byId.delete(t.id);sfx(t.kind==='b'?'bigboom':'boom',t.x,t.y);
  boom(t.x,t.y,t.kind==='b'?t.r*.9:t.r*1.3,t.kind==='b'?60:26,t.h?heightAt(t.x,t.y)+t.h:undefined);addDecal(t.x,t.y,t.kind==='b'?t.r:t.r*1.4);
  if(t.team===0)stats.lost++;else if(killer===0)stats.kills++;
  if(t.kind==='b'){for(let y=t.ty;y<t.ty+t.h;y++)for(let x=t.tx;x<t.tx+t.w;x++)if(bldMap[idx(x,y)]===t.id)bldMap[idx(x,y)]=0;
    if(t.type==='derrick')for(const o of oils)if(o.bid===t.id)o.bid=0;
    if(t.type==='hq'){if(t.team===0)later(()=>endGame(false,'Your Command Center was destroyed.'),1500);
      else if(game.mode==='skirmish'){if(ents.some(e=>e.type==='hq'&&e.hp>0&&hostile(0,e.team)))msg(TEAM_NAMES[t.team]+' has been defeated!',4);else later(()=>endGame(true,'All enemy Command Centers destroyed!'),1500)}}}
  sel=sel.filter(e=>e!==t);
}

// ---------- EFFECTS ----------
function boom(x,y,size,n,h){h=h===undefined?heightAt(x,y)+8:h;fx.push({t:'boom',x,y,h,life:.7,max:.7,size});
  for(let i=0;i<n;i++){const a=R()*7,s=30+R()*size*3,fire=R()<.55;fx.push({t:'p',k:fire?'fire':'smoke',x,y,h,vx:Math.cos(a)*s,vy:Math.sin(a)*s,vh:fire?40+R()*120:20+R()*50,life:.5+R()*(fire?.6:1.4),max:1.6})}}
function addDecal(x,y,r){const d={x,y,r:r+R()*6};decals.push(d);if(world){d.mesh=new THREE.Mesh(DECAL_GEO,DECAL_MAT);d.mesh.rotation.x=-Math.PI/2;d.mesh.rotation.z=R()*7;d.mesh.scale.set(d.r,d.r,1);d.mesh.position.set(x,heightAt(x,y)+.8,y);d.mesh.renderOrder=1;world.add(d.mesh)}
  if(decals.length>70){const o=decals.shift();if(o.mesh)world.remove(o.mesh)}}

// ---------- COMBAT ----------
function findTarget(e,range,minR=0){let best=null,bs=1e9;
  for(const o of ents){if(!hostile(e.team,o.team)||o.hp<=0||o.stranded||(e.team===0&&!shown(o))||!canHit(e,o))continue;const d=edgeDist(e,o);if(d>range||d<minR)continue;
    const s=d+(o.kind==='b'?(o.type==='wall'?220:80):0)+(isTruck(o)?30:0);if(s<bs){bs=s;best=o}}return best}
const PROJ_SPEED={mg:950,cannon:560,rocket:620,mortar:330,flak:800,bomb:260};
function fire(e,t){
  const w=wOf(e),dmg=dmgOf(e);
  const gh=e.kind==='b'?BDEF[e.type].gunH:e.st.gunH+(e.h||0),len=w.proj==='cannon'?24:w.proj==='bomb'?0:14;
  const bx=e.x+Math.cos(e.turret)*len,by=e.y+Math.sin(e.turret)*len;
  const p={x:bx,y:by,h:gh,tid:t.id,th:t.h||0,tx:t.x,ty:t.y,ox:(R()-.5)*t.r*.8,oy:(R()-.5)*t.r*.8,sp:PROJ_SPEED[w.proj],dmg,proj:w.proj,team:e.team,src:e.id,splash:w.splash||0,air:isAir(t)};
  if(w.proj==='mortar'||w.proj==='bomb'){const sc=w.proj==='bomb'?20:30;p.tid=0;p.tx=t.x+(R()-.5)*sc;p.ty=t.y+(R()-.5)*sc;p.th=0;p.d0=Math.max(1,Math.hypot(p.tx-bx,p.ty-by))}
  if(world){p.mesh=makeProjMesh(p.proj);world.add(p.mesh)}
  projs.push(p);
  if(w.proj!=='bomb')fx.push({t:'flash',x:bx,y:by,h:gh,life:.07,max:.07,size:w.proj==='cannon'||w.proj==='mortar'?9:5});
  sfx(w.proj,e.x,e.y);
  e.cd=w.rof*(.9+R()*.2)/(e.kind==='u'?1+.06*e.rank:1);
  if(isAir(e))e.ammo--;
}
function combat(e,dt,want){
  const w=wOf(e);if(!w||w.util)return;const mr=w.minRange||0;
  const ok=o=>{if(!alive(o)||!canHit(e,o))return false;const d=edgeDist(e,o);return d<=w.range&&d>=mr};
  let ft=want&&ok(want)?want:(ok(e.auto)?e.auto:null);
  if(isAir(e)&&e.ammo<=0)ft=null;
  if(ft){const a=Math.atan2(ft.y-e.y,ft.x-e.x);e.turret=isAir(e)?a:turnTo(e.turret,a,(w.heavy||w.proj==='mortar'?2.5:5)*dt);if(e.cd<=0&&angDiff(e.turret,a)<.2)fire(e,ft)}
  else if(e.kind==='u')e.turret=turnTo(e.turret,e.angle,2*dt);
}

// ---------- UNIT UPDATE ----------
function moveAlong(u,dt){
  if(!u.path.length)return true;
  const[px,py]=u.path[0],dx=px-u.x,dy=py-u.y,d=Math.hypot(dx,dy),sp=speedOf(u)*dt;
  u.angle=turnTo(u.angle,Math.atan2(dy,dx),5*dt);
  let nx,ny;if(d<=sp){nx=px;ny=py}else{nx=u.x+dx/d*sp;ny=u.y+dy/d*sp}
  // slide along cliffs and buildings instead of driving into them; ask for a new route if boxed in
  if(blocked(tileOf(nx),tileOf(ny))&&!blocked(tileOf(u.x),tileOf(u.y))){
    if(!blocked(tileOf(nx),tileOf(u.y)))ny=u.y;else if(!blocked(tileOf(u.x),tileOf(ny)))nx=u.x;else{u.stuck=Math.max(u.stuck,1.3);return false}}
  u.x=nx;u.y=ny;if(d<=sp)u.path.shift();
  u.tread+=sp;return !u.path.length;
}
function updateUnit(u,dt){
  u.cd-=dt;u.scan-=dt;u.healT=0;
  if(u.stranded)return;
  if(u.st.air){updateAir(u,dt);return}
  u.stuck+=dt;if(u.stuck>1.2){const mv=Math.hypot(u.x-u.lx,u.y-u.ly);u.lx=u.x;u.ly=u.y;u.stuck=0;
    if(u.path.length&&mv<6&&u.order&&u.order.t==='build'){const b=byId.get(u.order.id);if(b)setPath(u,b.x,b.y)}
    else if(u.path.length&&mv<6&&u.order&&u.order.x!==undefined){if(Math.hypot(u.x-u.order.x,u.y-u.order.y)<70){u.path=[];if(u.order.t==='move'||u.order.t==='amove'){u.order=null;u.home={x:u.x,y:u.y}}}else setPath(u,u.order.x,u.order.y)}}
  if(u.st.util==='truck'){updateTruck(u,dt);return}
  if(u.st.util==='repair'){updateRepairUnit(u,dt);return}
  const w=u.st.w,range=w.range;
  if(u.scan<=0){u.scan=.25+R()*.1;u.auto=findTarget(u,range+130,w.minRange||0)}
  let want=null,o=u.order;
  if(o&&o.t==='attack'){want=byId.get(o.id);if(!alive(want)||!canHit(u,want)){u.order=o=null;want=null;u.home={x:u.x,y:u.y}}}
  if(!want&&alive(u.auto)){
    if(!o&&edgeDist(u,u.auto)<=range+100&&Math.hypot(u.x-u.home.x,u.y-u.home.y)<380)want=u.auto;
    else if(o&&o.t==='amove')want=u.auto}
  if(want){
    const d=edgeDist(u,want);
    if(d>range-5){u.chasing=true;u.repath-=dt;if(u.repath<=0||!u.path.length){u.repath=.8;setPath(u,want.x,want.y)}moveAlong(u,dt)}
    else u.path=[];
  }else if(o&&(o.t==='move'||o.t==='amove')){
    if(u.chasing){u.chasing=false;setPath(u,o.x,o.y)}
    if(moveAlong(u,dt)){u.order=null;u.home={x:u.x,y:u.y}}
  }else if(!o){
    if(u.chasing){u.chasing=false;u.path=[];if(Math.hypot(u.x-u.home.x,u.y-u.home.y)>60)setPath(u,u.home.x,u.home.y)}
    moveAlong(u,dt)}
  combat(u,dt,want);
}
function nextBuild(u){while(u.bq&&u.bq.length){const n=byId.get(u.bq.shift());if(n&&(n.built<1||n.hp<n.maxHp)){u.order={t:'build',id:n.id};u.path=[];u.repath=0;return}}u.order=null;u.path=[];u.home={x:u.x,y:u.y}}
// true when the truck stands on a tile touching the building (diagonals included)
function nearFootprint(u,b){const tx=tileOf(u.x),ty=tileOf(u.y),dx=Math.max(b.tx-tx,0,tx-(b.tx+b.w-1)),dy=Math.max(b.ty-ty,0,ty-(b.ty+b.h-1));return Math.max(dx,dy)<=1||(!u.path.length&&edgeDist(u,b)<=60)}
function updateTruck(u,dt){
  const o=u.order;
  if(o&&o.t==='build'){const b=byId.get(o.id);
    if(!b||(b.built>=1&&b.hp>=b.maxHp)){nextBuild(u);return}
    if(nearFootprint(u,b)){u.path=[];u.angle=turnTo(u.angle,Math.atan2(b.y-u.y,b.x-u.x),4*dt);u.turret+=dt*3;u.healT=b.id;
      if(b.built<1){const d=BDEF[b.type],st=dt/d.time;b.built=Math.min(1,b.built+st);b.hp=Math.min(b.maxHp,b.hp+b.maxHp*.9*st);
        if(b.built>=1){b.hp=Math.max(b.hp,b.maxHp*.6);if(b.team===0){msg(BDEF[b.type].name+' completed');if(b.type!=='wall'){sfx('complete');say('Structure complete')}}}}
      else b.hp=Math.min(b.maxHp,b.hp+45*dt);
      if(R()<dt*10)fx.push({t:'p',k:'fire',x:b.x+(R()-.5)*b.r,y:b.y+(R()-.5)*b.r,h:heightAt(b.x,b.y)+10+R()*30*b.built,vx:(R()-.5)*30,vy:(R()-.5)*30,vh:40,life:.4,max:.4})}
    else{u.repath-=dt;if(!u.path.length&&u.repath<=0){u.repath=1;setPath(u,b.x,b.y)}moveAlong(u,dt)}
    return}
  if(o){if(moveAlong(u,dt)){u.order=null;u.home={x:u.x,y:u.y}}return}
  // idle trucks finish unfinished buildings and repair damaged ones nearby
  if(u.scan<=0){u.scan=1+R()*.5;let best=null,bd=1e9;for(const b of ents)if(b.team===u.team&&b.kind==='b'&&(b.built<1||b.hp<b.maxHp*.9)){const d=dist(b,u)-(b.built<1?300:0);if(d<(b.built<1?300:320)&&d<bd){bd=d;best=b}}if(best)orderBuild(u,best)}
}
function updateRepairUnit(u,dt){
  const w=u.st.w,o=u.order;
  if(o&&o.t==='move'){if(moveAlong(u,dt)){u.order=null;u.home={x:u.x,y:u.y}}return}
  let t=u.heal?byId.get(u.heal):null;
  if(!t||t.hp>=t.maxHp||dist(t,u)>500){t=null;u.heal=0;
    if(u.scan<=0){u.scan=.5;let bd=400;for(const e of ents)if(e.team===u.team&&e.kind==='u'&&e!==u&&!isAir(e)&&!e.stranded&&e.hp<e.maxHp){const d=dist(e,u);if(d<bd){bd=d;t=e}}if(t)u.heal=t.id}}
  if(t){const d=dist(t,u);
    if(d>w.range-10){u.repath-=dt;if(u.repath<=0||!u.path.length){u.repath=.8;setPath(u,t.x,t.y)}moveAlong(u,dt)}
    else{u.path=[];t.hp=Math.min(t.maxHp,t.hp+w.heal*dt);u.healT=t.id;u.turret=turnTo(u.turret,Math.atan2(t.y-u.y,t.x-u.x),4*dt)}
    return}
  if(o&&o.t==='amove'){if(!u.path.length&&Math.hypot(u.x-o.x,u.y-o.y)>60)setPath(u,o.x,o.y);if(moveAlong(u,dt)){u.order=null;u.home={x:u.x,y:u.y}}}
  else moveAlong(u,dt);
}
function nearestPad(u){let best=null,bd=1e9;for(const e of ents)if(e.team===u.team&&e.kind==='b'&&e.built>=1&&e.hp>0&&(e.type==='vtolPad'||e.type==='hq')){const d=dist(e,u)+(e.type==='hq'?900:0);if(d<bd){bd=d;best=e}}return best}
function flyTo(u,x,y,dt){const dx=x-u.x,dy=y-u.y,d=Math.hypot(dx,dy);
  if(d>4){u.angle=turnTo(u.angle,Math.atan2(dy,dx),(d<60?5:2.6)*dt);const sp=Math.min(d,speedOf(u)*dt);u.x+=Math.cos(u.angle)*sp;u.y+=Math.sin(u.angle)*sp}
  u.x=clamp(u.x,40,WW-40);u.y=clamp(u.y,40,WH-40);return d}
function updateAir(u,dt){
  const w=u.st.w,maxA=VTOL_AMMO[u.d.weapon]||4,o=u.order;u.h=AIR_H+Math.sin(time*2+u.id)*3;
  if(u.ammo<=0)u.rearming=true;
  if(u.rearming){const pad=nearestPad(u);if(!pad){flyTo(u,u.home.x,u.home.y,dt);return}
    if(flyTo(u,pad.x,pad.y,dt)<18){u.rt=(u.rt||0)+dt;const need=pad.type==='vtolPad'?1:3;
      if(u.rt>=need){u.rt=0;u.ammo++;if(pad.type==='vtolPad')u.hp=Math.min(u.maxHp,u.hp+u.maxHp*.15)}
      if(u.ammo>=maxA){u.ammo=maxA;u.rearming=false;u.home={x:pad.x,y:pad.y}}}
    return}
  if(u.scan<=0){u.scan=.4;u.auto=findTarget(u,w.range+220)}
  let want=null;
  if(o&&o.t==='attack'){want=byId.get(o.id);if(!alive(want)||!canHit(u,want)){u.order=null;want=null}}
  if(!want&&alive(u.auto)&&(!u.order||u.order.t==='amove'))want=u.auto;
  if(want){const a=time*1.1+u.id,rad=w.proj==='bomb'?18:110;flyTo(u,want.x+Math.cos(a)*rad,want.y+Math.sin(a)*rad,dt)}
  else if(u.order&&(u.order.t==='move'||u.order.t==='amove')){if(flyTo(u,u.order.x,u.order.y,dt)<30){u.home={x:u.order.x,y:u.order.y};u.order=null}}
  else{const a=time*.7+u.id;flyTo(u,u.home.x+Math.cos(a)*70,u.home.y+Math.sin(a)*70,dt)}
  combat(u,dt,want);
}

// ---------- BUILDINGS ----------
function updateBuilding(b,dt){
  if(b.built<1)return;
  b.healT=0;
  if(b.type==='factory'&&b.queue.length){b.prog+=dt;const st=calcStats(b.queue[0]);
    if(b.prog>=st.time){const cnt=ents.filter(e=>e.kind==='u'&&e.team===b.team).length;
      if(cnt<UNIT_CAP){b.prog=0;spawnUnit(b,b.queue.shift());if(b.team===0){sfx('ready');say('Unit ready')}}else b.prog=st.time}}
  if(b.type==='research'&&b.res){b.res.prog+=dt;const r=RESEARCH.find(x=>x.id===b.res.id);
    if(b.res.prog>=r.time){b.res=null;onResearch(b.team,r)}}
  if(b.sw){b.cd-=dt;b.scan-=dt;if(b.scan<=0){b.scan=.3;b.auto=findTarget(b,b.sw.range,b.sw.minRange||0)}combat(b,dt,null)}
  if(b.type==='repairFac'){const D=BDEF.repairFac;let t=b.heal?byId.get(b.heal):null;
    if(!t||t.hp>=t.maxHp||dist(t,b)>D.range){t=null;b.heal=0;b.scan-=dt;if(b.scan<=0){b.scan=.4;let bd=D.range;for(const e of ents)if(e.team===b.team&&e.kind==='u'&&!isAir(e)&&e.hp<e.maxHp){const d=dist(e,b);if(d<bd){bd=d;t=e}}if(t)b.heal=t.id}}
    if(t){t.hp=Math.min(t.maxHp,t.hp+D.heal*dt);b.healT=t.id}}
}
function onResearch(team,r){tech[team][r.id]=true;
  if(team===0){msg('Research complete: '+r.name);sfx('complete');say('Research completed');const n=addDefaultTemplates(0);if(n)setTimeout(()=>msg('New unit designs are available in your Factory',3),1500)}}
const towardY=b=>b.y<WH/2?1:-1;
function spawnUnit(b,d){
  const st=calcStats(d);if(b.team===0)stats.built++;
  if(st.air){const u=makeUnit(d,b.team,b.x,b.y+20);u.home={x:b.x+(R()-.5)*80,y:b.y+90*towardY(b)};if(b.rally)u.order={t:'move',x:b.rally.x,y:b.rally.y};return u}
  const f=nearestFree(b.tx+1,b.ty+b.h,b.tx+1,b.ty+b.h+3*towardY(b));if(!f)return null;
  const u=makeUnit(d,b.team,(f[0]+.5)*TILE,(f[1]+.5)*TILE);
  if(b.rally)orderMove(u,b.rally.x+(R()-.5)*40,b.rally.y+(R()-.5)*40);
  else orderMove(u,u.x+(R()-.5)*80,u.y+towardY(b)*(40+R()*50));
  return u;
}
function incomeOf(t){let r=0;for(const e of ents)if(e.team===t&&e.kind==='b'&&e.built>=1){if(e.type==='hq')r+=1;if(e.type==='derrick')r+=2.6*(tech[t].oil?1.5:1)}return r*(t>0&&ais[t]?ais[t].inc:1)}

// ---------- MAIN UPDATE ----------
function update(dt){
  time+=dt;
  for(let t=0;t<power.length;t++)power[t]+=incomeOf(t)*dt;
  for(const e of ents){if(e.hp<=0)continue;if(e.kind==='u')updateUnit(e,dt);else updateBuilding(e,dt)}
  const us=ents.filter(e=>e.kind==='u'&&e.hp>0&&!e.st.air),as=ents.filter(e=>e.kind==='u'&&e.hp>0&&e.st.air);
  for(const u of us){u.sx=u.x;u.sy=u.y}
  for(let i=0;i<us.length;i++)for(let j=i+1;j<us.length;j++){const a=us[i],b=us[j],dx=b.x-a.x,dy=b.y-a.y,m=a.r+b.r-6;
    if(Math.abs(dx)<m&&Math.abs(dy)<m){const d=Math.hypot(dx,dy)||.01;if(d<m){const p=(m-d)/2*.5,nx=dx/d,ny=dy/d;if(!a.stranded){a.x-=nx*p;a.y-=ny*p}if(!b.stranded){b.x+=nx*p;b.y+=ny*p}}}}
  for(let i=0;i<as.length;i++)for(let j=i+1;j<as.length;j++){const a=as[i],b=as[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||.01;if(d<30){const p=(30-d)*.5*dt*4;a.x-=dx/d*p;a.y-=dy/d*p;b.x+=dx/d*p;b.y+=dy/d*p}}
  for(const u of us){if(blocked(tileOf(u.x),tileOf(u.y))){u.x=u.sx;u.y=u.sy;
    if(blocked(tileOf(u.x),tileOf(u.y))){const f=nearestFree(tileOf(u.x),tileOf(u.y),tileOf(u.x),tileOf(u.y));if(f){u.x+=((f[0]+.5)*TILE-u.x)*Math.min(1,dt*6);u.y+=((f[1]+.5)*TILE-u.y)*Math.min(1,dt*6)}}}}
  for(const p of projs){const t=p.tid?byId.get(p.tid):null;if(t){p.tx=t.x+p.ox;p.ty=t.y+p.oy;p.th=t.h||0}
    if(p.proj==='rocket'&&R()<.8)fx.push({t:'p',k:'smoke',x:p.x,y:p.y,h:p.hh||heightAt(p.x,p.y)+14,vx:0,vy:0,vh:8,life:.6,max:1.6});
    const dx=p.tx-p.x,dy=p.ty-p.y,d=Math.hypot(dx,dy),s=p.sp*dt;
    if(d<=s){p.dead=true;if(p.mesh)world.remove(p.mesh);const src=byId.get(p.src);
      if(p.proj==='mortar'||p.proj==='bomb'){for(const o of ents)if(hostile(p.team,o.team)&&o.hp>0&&!isAir(o)&&!o.stranded&&edgeDist({x:p.tx,y:p.ty},o)<=p.splash)damage(o,p.dmg*(o.kind==='b'?1:.85),p.team,src);
        boom(p.tx,p.ty,16,22);addDecal(p.tx,p.ty,14);sfx('boom',p.tx,p.ty)}
      else if(t)damage(t,p.dmg*(p.air&&p.proj==='mg'?.6:1),p.team,src);
      const gh=heightAt(p.tx,p.ty)+(p.th||0);
      if(p.proj==='cannon'||p.proj==='rocket'){boom(p.tx,p.ty,8,10,gh+8);sfx('hit',p.tx,p.ty);if(R()<.3&&!p.th)addDecal(p.tx,p.ty,6)}
      else if(p.proj==='flak'){for(let k=0;k<6;k++)fx.push({t:'p',k:'smoke',x:p.tx,y:p.ty,h:gh+8,vx:(R()-.5)*60,vy:(R()-.5)*60,vh:(R()-.5)*30,life:.8,max:1.6});fx.push({t:'flash',x:p.tx,y:p.ty,h:(p.th||0)+8,life:.1,max:.1,size:6})}
      else if(p.proj==='mg')for(let k=0;k<3;k++)fx.push({t:'p',k:'fire',x:p.tx,y:p.ty,h:gh+10,vx:(R()-.5)*120,vy:(R()-.5)*120,vh:R()*80,life:.2,max:.2})}
    else{p.x+=dx/d*s;p.y+=dy/d*s}}
  projs=projs.filter(p=>!p.dead);
  for(const f of fx){f.life-=dt;if(f.t==='p'){f.x+=f.vx*dt;f.y+=f.vy*dt;f.h+=f.vh*dt;f.vx*=.94;f.vy*=.94;if(f.k==='fire')f.vh-=150*dt}}
  fx=fx.filter(f=>f.life>0);
  if(ents.some(e=>e.hp<=0))ents=ents.filter(e=>e.hp>0);
  for(let t=1;t<ais.length;t++){const a=ais[t];if(!a)continue;if(a.mode==='waves')aiWaves(t,dt);else{a.t-=dt;if(a.t<=0){a.t=1;aiThink(t)}}}
  fogT-=dt;if(fogT<=0){fogT=.2;updateFog()}
  missionTick(dt);
}

// ---------- FOG OF WAR ----------
function sightOf(e){if(e.kind==='u')return e.st.air?330:e.d.weapon==='mortar'?300:270;return{hq:380,tower:320,hardpoint:320,aaSite:320,bunker:260,mortarPit:280,wall:90}[e.type]||210}
function updateFog(){visible.fill(0);
  for(const e of ents){if(e.team!==0||e.hp<=0||e.stranded)continue;const r=sightOf(e)/TILE,cx=e.x/TILE,cy=e.y/TILE;
    for(let y=Math.max(0,Math.floor(cy-r));y<=Math.min(MH-1,Math.ceil(cy+r));y++)for(let x=Math.max(0,Math.floor(cx-r));x<=Math.min(MW-1,Math.ceil(cx+r));x++)if((x+.5-cx)**2+(y+.5-cy)**2<=r*r){visible[idx(x,y)]=1;explored[idx(x,y)]=1}}
  for(const e of ents)if(e.team!==0&&e.kind==='b'&&!e.seen){for(let y=e.ty;y<e.ty+e.h&&!e.seen;y++)for(let x=e.tx;x<e.tx+e.w;x++)if(visible[idx(x,y)]){e.seen=true;break}}}
function shown(e){if(e.team===0)return true;if(e.kind==='b')return !!e.seen;const tx=tileOf(e.x),ty=tileOf(e.y);return inb(tx,ty)&&visible[idx(tx,ty)]===1}
