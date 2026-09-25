// =====================================================================
// CAMPAIGN: missions, story and objectives
// =====================================================================
const ALL_TECH=RESEARCH.map(r=>r.id);
function spawnUnits(team,list,x,y,extra){const out=[];
  list.forEach((k,i)=>{const d=typeof k==='string'?AI_T[k]:k,a=i*2.4,r=i?20+i*9:0,tx=tileOf(x+Math.cos(a)*r),ty=tileOf(y+Math.sin(a)*r),f=nearestFree(tx,ty,tx,ty);if(!f)return;
    const u=makeUnit(d,team,(f[0]+.5)*TILE,(f[1]+.5)*TILE);Object.assign(u,extra||{});u.home={x:u.x,y:u.y};out.push(u)});return out}
const CORNERS=[[0,0],[1,1],[0,1],[1,0]]; // [flipX, flipY] for bottom-left, top-right, top-left, bottom-right
function cornerTile(c,x,y,w){const[fx,fy]=CORNERS[c];return[fx?MW-x-w:x,fy?MH-y-w:y]}
function stdBase(team,o={}){
  let bt;const c=o.corner??team;
  if(o.start){bt=o.start;for(const type of o.factory===false?['hq']:['hq','factory']){const s=findSpot(type,bt[0]-1,bt[1]-1);if(s)makeBuilding(type,team,s[0],s[1],true)}}
  else{const m=(x,y,w)=>cornerTile(c,x,y,w);makeBuilding('hq',team,...m(8,MH-12,3),true);if(o.factory!==false)makeBuilding('factory',team,...m(13,MH-13,3),true);bt=m(11,MH-11,0)}
  const bx=bt[0]*TILE,by=bt[1]*TILE;
  const near=oils.filter(p=>!p.bid&&Math.hypot(p.x-bx,p.y-by)<460).sort((a,b)=>Math.hypot(a.x-bx,a.y-by)-Math.hypot(b.x-bx,b.y-by));
  for(let i=0;i<(o.derricks??1)&&i<near.length;i++)makeBuilding('derrick',team,near[i].tx,near[i].ty,true);
  const tw=[bt[0]+(bt[0]<MW/2?6:-6),bt[1]+(bt[1]<MH/2?6:-6)];
  for(const[type,n]of o.extra||[])for(let i=0;i<n;i++){const def=DEFENSES.includes(type)||type==='wall',s=findSpot(type,def?tw[0]:bt[0],def?tw[1]:bt[1]);if(s)makeBuilding(type,team,s[0],s[1],true)}
  const sp=o.start?[bt[0]+(bt[0]<MW/2?3:-3),bt[1]+(bt[1]<MH/2?3:-3)]:cornerTile(c,12,MH-15,0);spawnUnits(team,o.units||['truck','truck','mgv','mgv'],sp[0]*TILE,sp[1]*TILE);
}
const MISSIONS=[
  {name:'First Foothold',theme:'desert',seed:4101,
    brief:'Commander, the Collapse left this valley in ruins, but its oil fields still flow. A raider faction holds the northern ridge. Secure the oil, get your research running and build defenses before they come for us.',
    tech:[],research:['mg','tracks','hardpoint','oil','armor'],enemyTech:[],power:1000,
    ai:{inc:.55,first:420,gap:220,size:5,maxSize:10,research:['mg','armor']},
    setup(){stdBase(0,{units:['truck','truck','mgv','mgv']});stdBase(1,{extra:[['tower',1]],units:['truck','mgv','mgv']})},
    objectives:[{text:'Build 4 Oil Derricks',check:()=>countB(0,'derrick')>=4},{text:'Build a Research Facility',check:()=>countB(0,'research')>=1},{text:'Build 2 Guard Towers',check:()=>countB(0,'tower')>=2}]},
  {name:'Hold the Line',theme:'snow',seed:5202,weather:'snow',
    brief:'Scouts report a large enemy force moving through the frozen pass. We cannot stop them all, but reinforcements are on the way. Dig in, build defenses and hold the base for eight minutes.',
    tech:['mg','tracks'],research:['hardpoint','lancer','repairfac','cannon','armor','oil'],enemyTech:['tracks','python','lancer'],power:1600,
    ai:{mode:'waves',gap:55,first:90,base:3,grow:1.3,pool:[['mgv','mgc'],['mgc','can'],['can','mgc','lan'],['can','lan','canp'],['canp','lan','lanp']]},
    setup(){stdBase(0,{derricks:3,extra:[['research',1],['tower',2]],units:['truck','truck','mgc','mgc','can','can']})},
    objectives:[{text:'Survive until reinforcements arrive',timer:480}]},
  {name:'Lost Convoy',theme:'desert',seed:6303,clears:[[30,20,4]],
    brief:'A supply convoy carrying research data was ambushed near the old highway. Three trucks survived and are hiding in the canyon to the north. Find them, fight off the guards and bring at least two trucks home.',
    tech:['mg','tracks','hardpoint','lancer'],research:['repairfac','cannon','python','mortar','engine','armor','oil'],enemyTech:['tracks','lancer'],power:1200,
    ai:{inc:.8,first:380,gap:170,size:6},
    setup(){stdBase(0,{derricks:2,units:['truck','truck','mgc','mgc','lan','lan']});stdBase(1,{extra:[['tower',2]]});
      const cx=30.5*TILE,cy=20.5*TILE;spawnUnits(0,['truck','truck','truck'],cx,cy,{stranded:true,convoy:true});
      spawnUnits(1,['mgc','mgc','can'],cx+330,cy-110,{guard:true});spawnUnits(1,['mgc','lan'],cx-280,cy+240,{guard:true})},
    tick(){if(game.ms.rescued)return;const cv=ents.filter(e=>e.convoy&&e.hp>0);
      if(cv.some(c=>ents.some(e=>e.team===0&&e.kind==='u'&&!e.stranded&&dist(e,c)<220))){game.ms.rescued=true;for(const c of cv)c.stranded=false;msg('Convoy found! Escort the trucks back to base.',4);sfx('complete');say('Convoy located')}},
    objectives:[{text:'Find the convoy',check:()=>!!game.ms.rescued},{text:'Bring 2 convoy trucks to your Command Center',check:()=>{const hq=findHQ(0);return !!hq&&ents.filter(e=>e.convoy&&e.hp>0&&dist(e,hq)<360).length>=2}}],
    fail:()=>ents.filter(e=>e.convoy&&e.hp>0).length<2?'Too many convoy trucks were destroyed.':''},
  {name:'Outpost Delta',theme:'city',seed:7404,weather:'rain',
    brief:'The enemy has fortified an old city district and uses it to raid our supply lines. Break through their defenses and destroy the outpost. Their Command Center and every factory must fall.',
    tech:['mg','tracks','hardpoint','lancer','repairfac','cannon','python'],research:['mortar','rocket','hover','engine','armor','oil'],enemyTech:['tracks','hardpoint','lancer','python'],power:1400,
    ai:{inc:1,first:240,gap:150,size:7},
    setup(){stdBase(0,{derricks:2,extra:[['research',1]],units:['truck','truck','can','can','lan','rep']});stdBase(1,{derricks:2,extra:[['research',1],['hardpoint',2],['bunker',2]],units:['truck','truck','can','lan','mgc']})},
    objectives:[{text:'Destroy the enemy Command Center',check:()=>!findHQ(1)},{text:'Destroy all enemy Factories',check:()=>countB(1,'factory',true)===0}]},
  {name:'Eyes in the Sky',theme:'snow',seed:8505,
    brief:'The enemy has rebuilt old VTOL aircraft and is bombing our outposts. Our engineers have given us the Hurricane AA gun. Protect the base with AA Sites, then destroy their VTOL Pads and Command Center to end the air raids.',
    tech:['mg','tracks','hardpoint','lancer','repairfac','cannon','python','mortar','aa'],research:['vtol','rocket','hover','engine','armor','oil'],enemyTech:['tracks','hardpoint','lancer','python','aa','vtol','mortar'],power:1500,
    ai:{inc:1.05,first:200,gap:140,size:7},
    setup(){stdBase(0,{derricks:2,extra:[['research',1],['aaSite',1]],units:['truck','truck','can','lan','aa','rep']});stdBase(1,{derricks:3,extra:[['research',1],['vtolPad',3],['aaSite',2],['hardpoint',1]],units:['truck','truck','vbomb','vbomb','can','lan']})},
    objectives:[{text:'Destroy all enemy VTOL Pads',check:()=>countB(1,'vtolPad',true)===0},{text:'Destroy the enemy Command Center',check:()=>!findHQ(1)}]},
  {name:'Iron Fist',theme:'city',seed:9606,weather:'night',
    brief:"This is it, Commander. The enemy's main base lies ahead, heavily defended and fully equipped. Use everything you have learned. Destroy every factory and their Command Center, and the valley is ours.",
    tech:['mg','tracks','hardpoint','lancer','repairfac','cannon','python','mortar','aa','vtol'],research:ALL_TECH,enemyTech:ALL_TECH,power:1800,
    ai:{inc:1.35,first:170,gap:115,size:8},
    setup(){stdBase(0,{derricks:3,extra:[['research',1],['vtolPad',1]],units:['truck','truck','truck','canp','canp','lanp','mor','rep','aa']});
      stdBase(1,{derricks:4,extra:[['factory',1],['research',1],['hardpoint',3],['bunker',2],['aaSite',2],['vtolPad',2],['mortarPit',1],['repairFac',1]],units:['truck','truck','canp','lanp','mor','vbomb']})},
    objectives:[{text:'Destroy all enemy Factories',check:()=>countB(1,'factory',true)===0},{text:'Destroy the enemy Command Center',check:()=>!findHQ(1)}]}
];
function fmtTime(s){s=Math.max(0,Math.ceil(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')}
function objDone(o){return o.timer?game.ms.t>=o.timer:o.check()}
function missionTick(dt){
  if(game.mode!=='campaign'||state!=='play')return;
  game.ms.t=(game.ms.t||0)+dt;missionT-=dt;if(missionT>0)return;missionT=.5;
  const M=MISSIONS[game.mission];if(M.tick)M.tick();
  const res=M.objectives.map(o=>({o,done:objDone(o)}));
  $('obj').innerHTML='<b>Mission '+(game.mission+1)+': '+M.name+'</b>'+res.map(r=>'<div>'+(r.done?'✅':'⬜')+' '+r.o.text+(r.o.timer&&!r.done?' ('+fmtTime(r.o.timer-game.ms.t)+')':'')+'</div>').join('');
  const why=M.fail&&M.fail();if(why){endGame(false,why);return}
  if(res.every(r=>r.done))endGame(true,'All objectives complete.');
}
