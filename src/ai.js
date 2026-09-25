// =====================================================================
// ENEMY AI (one instance per computer player)
// =====================================================================
const AI_T={
  truck:{body:'viper',prop:'wheels',weapon:'construct'},
  mgv:{body:'viper',prop:'wheels',weapon:'mg'},
  mgc:{body:'cobra',prop:'half',weapon:'mg'},
  can:{body:'cobra',prop:'half',weapon:'cannon'},
  canp:{body:'python',prop:'tracks',weapon:'cannon'},
  lan:{body:'cobra',prop:'half',weapon:'lancer'},
  lanp:{body:'python',prop:'tracks',weapon:'lancer'},
  mor:{body:'cobra',prop:'tracks',weapon:'mortar'},
  hov:{body:'cobra',prop:'hover',weapon:'mg'},
  rep:{body:'viper',prop:'half',weapon:'repair'},
  aa:{body:'cobra',prop:'half',weapon:'aa'},
  vbomb:{body:'cobra',prop:'vtol',weapon:'bomb'},
  vlan:{body:'viper',prop:'vtol',weapon:'lancer'},
  flc:{body:'cobra',prop:'half',weapon:'flamer'},
  lasm:{body:'mantis',prop:'tracks',weapon:'laser'},
  canm:{body:'mantis',prop:'tracks',weapon:'cannon'}
};
const AI_RESEARCH=['mg','tracks','lancer','flamer','hardpoint','python','cannon','mortar','armor','aa','repairfac','rocket','mantis','oil','engine','laser','optics','howitzer','hover','vtol','ripple'];
function newAI(o){o=o||{};return{t:2+R()*2,time:0,wave:0,size:o.size||6,maxSize:o.maxSize||22,next:o.first||220,gap:o.gap||140,inc:o.inc||1,mode:o.mode||'base',
  base:o.base||3,grow:o.grow||1.3,harass:o.harass??true,squads:[],pool:o.pool||null,waveT:o.first||40,research:o.research||AI_RESEARCH}}
const foesOf=T=>ents.filter(e=>e.hp>0&&!e.stranded&&hostile(T,e.team));
function aiPickUnit(ai,T,ctx){
  const W={mgv:ai.wave<2?3:.6,mgc:2,can:2,canp:3,lan:2,lanp:3,mor:1.1,hov:1,rep:ctx.army>5?.8:0,aa:ctx.foeAir?2.5:0,vbomb:ctx.pads?1.6:0,vlan:ctx.pads?1:0,flc:1.2,lasm:3,canm:2.5};
  let tot=0;const c=[];for(const k in W)if(W[k]>0&&designOk(T,AI_T[k])){c.push([k,W[k]]);tot+=W[k]}
  let x=R()*tot;for(const[k,w]of c){x-=w;if(x<=0)return AI_T[k]}return AI_T.mgv}
function findSpot(type,cx,cy){
  for(let r=2;r<16;r++)for(let k=0;k<24;k++){const a=R()*Math.PI*2,tx=Math.round(cx+Math.cos(a)*r),ty=Math.round(cy+Math.sin(a)*r);if(canPlace(type,tx,ty,1))return[tx,ty]}
  return null}
function aiThink(T){
  const ai=ais[T],hq=findHQ(T);if(!hq)return;
  const mine=ents.filter(e=>e.team===T&&e.hp>0),trucks=mine.filter(isTruck),units=mine.filter(e=>e.kind==='u'&&!isTruck(e)&&!e.guard);
  const army=units.filter(e=>!isAir(e)),air=units.filter(isAir),foes=foesOf(T);
  const facs=mine.filter(e=>e.type==='factory'),unf=mine.filter(e=>e.kind==='b'&&e.built<1);
  const cnt=t=>mine.filter(e=>e.type===t).length,pw=()=>power[T];
  const foeAir=foes.some(isAir);
  const hx=hq.tx+1,hy=hq.ty+1,toward=[hx+Math.sign(MW/2-hx)*6,hy+Math.sign(MH/2-hy)*6];
  const tryBuild=(type,cx,cy)=>{if(!avail(T,BDEF[type])||pw()<BDEF[type].cost)return null;const s=findSpot(type,cx,cy);return s?placeBuilding(type,T,s[0],s[1]):null};
  const reach=700+MW*12;
  // early on, only claim oil that is closer to our HQ than to any other HQ, so every player gets a fair share
  const hqs=ents.filter(e=>e.type==='hq'&&e.hp>0&&e.team!==T),mineFirst=ai.time<240;
  const free=oils.filter(o=>!o.bid&&!ents.some(e=>e.hp>0&&e.team!==T&&dist(e,o)<260)&&(!mineFirst||hqs.every(h=>dist(o,h)>dist(o,hq)))).sort((a,b)=>dist(a,hq)-dist(b,hq));
  for(const t of trucks){if(t.order)continue;
    if(unf.length){orderBuild(t,unf[0]);continue}
    let b=null;
    if(free.length&&pw()>=50&&dist(free[0],hq)<reach)b=placeBuilding('derrick',T,free[0].tx,free[0].ty);
    else if(ai.time>80&&cnt('research')===0)b=tryBuild('research',hx,hy);
    else if(ai.time>150&&cnt('sensorTower')===0&&pw()>=200)b=tryBuild('sensorTower',toward[0],toward[1]);
    else if(ai.time>200&&facs.length<(pw()>800?3:2)&&pw()>=320)b=tryBuild('factory',hx,hy);
    else if(foeAir&&cnt('aaSite')<3)b=tryBuild('aaSite',hx,hy);
    else if(has(T,'vtol')&&cnt('vtolPad')<2&&pw()>=250)b=tryBuild('vtolPad',hx-Math.sign(MW/2-hx)*3,hy);
    else if(has(T,'repairfac')&&cnt('repairFac')===0&&pw()>=300)b=tryBuild('repairFac',hx,hy);
    else if(has(T,'mortar')&&cnt('mortarPit')<1&&pw()>=300)b=tryBuild('mortarPit',toward[0],toward[1]);
    else if(has(T,'ripple')&&cnt('ripple')<1&&pw()>=1100)b=tryBuild('ripple',hx,hy);
    else if(has(T,'howitzer')&&cnt('howitzer')<2&&pw()>=600)b=tryBuild('howitzer',hx,hy);
    else if(DEFENSES.slice(0,3).reduce((s,d)=>s+cnt(d),0)<2+ai.wave&&pw()>=260)b=tryBuild(has(T,'hardpoint')?(R()<.5?'hardpoint':'bunker'):'tower',toward[0],toward[1]);
    if(b){orderBuild(t,b);unf.push(b)}}
  for(const f of facs){if(f.built<1||f.queue.length>=2)continue;
    const qt=facs.reduce((s,x)=>s+x.queue.filter(q=>q.weapon==='construct').length,0);
    const d=trucks.length+qt<3?AI_T.truck:aiPickUnit(ai,T,{army:army.length,foeAir,pads:cnt('vtolPad')});
    const reserve=(cnt('research')===0&&ai.time>60?160:0)+(free.length&&trucks.length?60:0),c=calcStats(d).cost;if(pw()>=c+(d===AI_T.truck?0:reserve)){power[T]-=c;f.queue.push({...d})}}
  for(const r of mine.filter(e=>e.type==='research'&&e.built>=1&&!e.res)){
    const n=RESEARCH.find(x=>ai.research.includes(x.id)&&!has(T,x.id)&&(!x.req||has(T,x.req))&&!mine.some(m=>m.res&&m.res.id===x.id));
    if(n&&pw()>=n.cost+150){power[T]-=n.cost;r.res={id:n.id,prog:0}}}
  // ---------- squads: defenders stay home, raiders harass, main groups gather, attack and retreat ----------
  ai.squads=ai.squads||[];if(ai.harassT===undefined)ai.harassT=ai.next*.55+R()*40;
  const inSquad=new Set();for(const s of ai.squads){s.u=s.u.filter(id=>alive(byId.get(id)));for(const id of s.u)inSquad.add(id)}
  const homePt=()=>{const p=mine.find(e=>e.type==='repairFac'&&e.built>=1)||hq;return{x:p.x+(R()-.5)*140,y:p.y+(R()-.5)*140}};
  // badly damaged units pull back for repairs, like a careful player would
  for(const a of army){if(a.hp<a.maxHp*.3&&!a.retreat&&a.st.util!=='repair'){a.retreat=true;for(const s of ai.squads)s.u=s.u.filter(id=>id!==a.id);inSquad.delete(a.id);const p=homePt();orderMove(a,p.x,p.y)}
    else if(a.retreat&&a.hp>a.maxHp*.8)a.retreat=false}
  ai.squads=ai.squads.filter(s=>s.u.length);
  const idle=army.filter(a=>!inSquad.has(a.id)&&!a.retreat);
  const homes=ents.filter(e=>e.type==='hq'&&e.hp>0&&!hostile(T,e.team));
  const threat=foes.find(e=>e.kind==='u'&&dist(e,hq)<600)||foes.find(e=>e.kind==='u'&&homes.some(h=>dist(e,h)<500));
  if(threat){for(const a of idle)if(!a.order||a.order.t!=='attack')orderMove(a,threat.x,threat.y,'amove');
    for(const s of ai.squads)if(s.st==='gather')for(const id of s.u)orderMove(byId.get(id),threat.x,threat.y,'amove');
    for(const a of air)if(!a.order&&canHit(a,threat))a.order={t:'attack',id:threat.id}}
  else for(const a of idle)if(!a.order&&dist(a,hq)>650){const p=homePt();orderMove(a,p.x,p.y)}
  const fb=foes.filter(e=>e.kind==='b');
  const pickTarget=(from,role)=>{if(!fb.length)return null;
    if(role==='harass'){const soft=fb.filter(e=>e.type==='derrick'||e.type==='sensorTower'||e.type==='research'),pool=soft.length?soft:fb;
      return pool.map(e=>{const eh=findHQ(e.team);return[e,dist(e,from)*.6-(eh?dist(e,eh):0)*.8+R()*300]}).sort((a,b)=>a[1]-b[1])[0][0]}
    const hqs=fb.filter(e=>e.type==='hq');if(hqs.length&&R()<.35)return hqs.sort((a,b)=>dist(a,from)-dist(b,from))[0];
    return fb.map(e=>[e,dist(e,from)+R()*400]).sort((a,b)=>a[1]-b[1])[0][0]};
  const sendHome=s=>{s.st='retreat';s.t=0;for(const id of s.u){const p=homePt();orderMove(byId.get(id),p.x,p.y)}};
  // small, fast raiding parties go after oil derricks and other soft targets
  if(ai.harass&&!threat&&ai.time>ai.harassT&&idle.length>=4&&!ai.squads.some(s=>s.role==='harass')){
    const fast=idle.slice().sort((a,b)=>speedOf(b)-speedOf(a)).slice(0,2+Math.floor(R()*3)),t=pickTarget(hq,'harass');
    if(t){ai.squads.push({role:'harass',u:fast.map(a=>a.id),st:'move',tid:t.id,tgtTeam:t.team,str:fast.reduce((s,a)=>s+a.hp,0),t:0});for(const a of fast)orderMove(a,t.x+(R()-.5)*60,t.y+(R()-.5)*60,'amove')}
    ai.harassT=ai.time+50+R()*70}
  // main attack: gather at a rally point outside the base first, leave a few defenders behind
  const need=Math.max(3,Math.round(ai.size*(.7+R()*.3)));
  // groups are capped, so a big army comes as several waves instead of one blob
  if(!threat&&((ai.time>ai.next&&idle.length>=need)||(ai.wave>0&&idle.length>=ai.size*2.5&&ai.time>(ai.lastLaunch||0)+25+R()*30))){
    const keep=Math.min(3,Math.floor(idle.length*.25)),grp=idle.slice(keep,keep+ai.size+Math.floor(R()*5)),t=pickTarget(hq,'attack');
    if(t&&grp.length>=3){const rx=hq.x+(t.x-hq.x)*.3+(R()-.5)*150,ry=hq.y+(t.y-hq.y)*.3+(R()-.5)*150;
      ai.squads.push({role:'attack',u:grp.map(a=>a.id),st:'gather',tid:t.id,tgtTeam:t.team,rx,ry,str:grp.reduce((s,a)=>s+a.hp,0),t:0});
      for(const a of grp)orderMove(a,rx+(R()-.5)*90,ry+(R()-.5)*90);
      ai.wave++;ai.lastLaunch=ai.time;ai.size=Math.min(ai.maxSize,ai.size+2);ai.next=ai.time+ai.gap*(.7+R()*.6)}}
  for(const s of ai.squads){s.t++;const us=s.u.map(id=>byId.get(id)),cx=us.reduce((a,u)=>a+u.x,0)/us.length,cy=us.reduce((a,u)=>a+u.y,0)/us.length,str=us.reduce((a,u)=>a+u.hp,0)/s.str;
    if(s.st!=='retreat'&&str<(s.role==='harass'?.5:.4)){sendHome(s);if(s.tgtTeam===0&&s.role==='attack')msg(TEAM_NAMES[T]+' forces are retreating!',2.5);continue}
    if(s.st==='gather'){if(us.filter(u=>Math.hypot(u.x-s.rx,u.y-s.ry)<220).length>=us.length*.8||s.t>30){
        let tt=byId.get(s.tid);if(!alive(tt))tt=pickTarget({x:cx,y:cy},'attack');if(!tt){sendHome(s);continue}
        s.st='move';s.t=0;s.tid=tt.id;s.tgtTeam=tt.team;for(const u of us)orderMove(u,tt.x+(R()-.5)*80,tt.y+(R()-.5)*80,'amove');
        for(const a of air)if(!a.rearming&&!a.order)a.order={t:'attack',id:tt.id};
        if(tt.team===0)msg(TEAM_NAMES[T]+' attack incoming!',3)}}
    else if(s.st==='move'){const tt=byId.get(s.tid);
      if(!alive(tt)){const nx=fb.filter(e=>e.hp>0).map(e=>[e,Math.hypot(e.x-cx,e.y-cy)]).sort((a,b)=>a[1]-b[1])[0];
        if(nx&&((s.role==='attack'&&str>.55)||nx[1]<400)){s.tid=nx[0].id;for(const u of us)orderMove(u,nx[0].x+(R()-.5)*80,nx[0].y+(R()-.5)*80,'amove')}else sendHome(s)}
      else for(const u of us)if(!u.order)orderMove(u,tt.x+(R()-.5)*80,tt.y+(R()-.5)*80,'amove')}
    else if(s.t>35||us.every(u=>dist(u,hq)<500))s.u=[]}
  ai.squads=ai.squads.filter(s=>s.u.length);
  for(const a of air)if(!a.order&&!a.rearming&&ai.wave>0&&R()<.2){const pb=foes.filter(e=>canHit(a,e));if(pb.length)a.order={t:'attack',id:pb[Math.floor(R()*pb.length)].id}}
  ai.time+=1;
}
// Wave mode: no enemy base, groups of units arrive from the enemy corner.
function aiWaves(T,dt){
  const ai=ais[T];ai.waveT-=dt;ai.time+=dt;
  if(ai.waveT<=0){ai.waveT=ai.gap;const pool=ai.pool[Math.min(ai.pool.length-1,Math.floor(ai.wave/2))],n=Math.round(ai.base+ai.wave*ai.grow);
    const hq=findHQ(0);if(hq){const list=[];for(let i=0;i<n;i++)list.push(pool[Math.floor(R()*pool.length)]);
      const sx=(MW-8+R()*3)*TILE,sy=(6+R()*3)*TILE;
      for(const u of spawnUnits(T,list,sx,sy)){u.raid=true;if(isAir(u))u.order={t:'attack',id:hq.id};else orderMove(u,hq.x+(R()-.5)*120,hq.y+(R()-.5)*120,'amove')}
      ai.wave++;msg('Enemy wave '+ai.wave+' incoming!');sfx('alert')}}
  ai.t-=dt;if(ai.t<=0){ai.t=1;const foes=foesOf(T);for(const a of ents)if(a.team===T&&a.kind==='u'&&!a.order&&!isAir(a)){let best=null,bd=1e9;for(const e of foes){const d=dist(e,a);if(d<bd){bd=d;best=e}}if(best)orderMove(a,best.x,best.y,'amove')}}
}
