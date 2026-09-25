// =====================================================================
// ENEMY AI
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
  vlan:{body:'viper',prop:'vtol',weapon:'lancer'}
};
const AI_RESEARCH=['mg','tracks','lancer','hardpoint','python','cannon','mortar','armor','aa','repairfac','rocket','oil','engine','hover','vtol'];
function newAI(o){o=o||{};return{t:3,time:0,wave:0,size:o.size||6,maxSize:o.maxSize||22,next:o.first||220,gap:o.gap||140,inc:o.inc||1,mode:o.mode||'base',
  base:o.base||3,grow:o.grow||1.3,pool:o.pool||null,waveT:o.first||40,research:o.research||AI_RESEARCH}}
function aiPickUnit(ctx){
  const W={mgv:ai.wave<2?3:.6,mgc:2,can:2,canp:3,lan:2,lanp:3,mor:1.1,hov:1,rep:ctx.army>5?.8:0,aa:ctx.playerAir?2.5:0,vbomb:ctx.pads?1.6:0,vlan:ctx.pads?1:0};
  let tot=0;const c=[];for(const k in W)if(W[k]>0&&designOk(1,AI_T[k])){c.push([k,W[k]]);tot+=W[k]}
  let x=R()*tot;for(const[k,w]of c){x-=w;if(x<=0)return AI_T[k]}return AI_T.mgv}
function findSpot(type,cx,cy){
  for(let r=2;r<16;r++)for(let k=0;k<24;k++){const a=R()*Math.PI*2,tx=Math.round(cx+Math.cos(a)*r),ty=Math.round(cy+Math.sin(a)*r);if(canPlace(type,tx,ty,1))return[tx,ty]}
  return null}
function aiThink(){
  const T=1,hq=findHQ(T);if(!hq)return;
  const mine=ents.filter(e=>e.team===T&&e.hp>0),trucks=mine.filter(isTruck),units=mine.filter(e=>e.kind==='u'&&!isTruck(e)&&!e.guard);
  const army=units.filter(e=>!isAir(e)),air=units.filter(isAir);
  const facs=mine.filter(e=>e.type==='factory'),unf=mine.filter(e=>e.kind==='b'&&e.built<1);
  const cnt=t=>mine.filter(e=>e.type===t).length,pw=()=>power[T];
  const playerAir=ents.some(e=>e.team===0&&isAir(e)&&shownTo1(e));
  const hx=hq.tx+1,hy=hq.ty+1,toward=[hx-6,hy+6];
  const tryBuild=(type,cx,cy)=>{if(!avail(T,BDEF[type])||pw()<BDEF[type].cost)return null;const s=findSpot(type,cx,cy);return s?placeBuilding(type,T,s[0],s[1]):null};
  for(const t of trucks){if(t.order)continue;
    if(unf.length){orderBuild(t,unf[0]);continue}
    const free=oils.filter(o=>!o.bid&&!ents.some(e=>e.team===0&&dist(e,o)<260)).sort((a,b)=>dist(a,hq)-dist(b,hq));
    let b=null;
    if(free.length&&pw()>=50&&dist(free[0],hq)<1500)b=placeBuilding('derrick',T,free[0].tx,free[0].ty);
    else if(ai.time>80&&cnt('research')===0)b=tryBuild('research',hx,hy);
    else if(ai.time>200&&facs.length<(pw()>800?3:2)&&pw()>=320)b=tryBuild('factory',hx,hy);
    else if(playerAir&&cnt('aaSite')<3)b=tryBuild('aaSite',hx,hy);
    else if(has(T,'vtol')&&cnt('vtolPad')<2&&pw()>=250)b=tryBuild('vtolPad',hx+3,hy-3);
    else if(has(T,'repairfac')&&cnt('repairFac')===0&&pw()>=300)b=tryBuild('repairFac',hx,hy);
    else if(has(T,'mortar')&&cnt('mortarPit')<1&&pw()>=300)b=tryBuild('mortarPit',toward[0],toward[1]);
    else if(DEFENSES.slice(0,3).reduce((s,d)=>s+cnt(d),0)<2+ai.wave&&pw()>=260)b=tryBuild(has(T,'hardpoint')?(R()<.5?'hardpoint':'bunker'):'tower',toward[0],toward[1]);
    if(b){orderBuild(t,b);unf.push(b)}}
  for(const f of facs){if(f.built<1||f.queue.length>=2)continue;
    const qt=facs.reduce((s,x)=>s+x.queue.filter(q=>q.weapon==='construct').length,0);
    const d=trucks.length+qt<3?AI_T.truck:aiPickUnit({army:army.length,playerAir,pads:cnt('vtolPad')});
    const c=calcStats(d).cost;if(pw()>=c){power[T]-=c;f.queue.push({...d})}}
  for(const r of mine.filter(e=>e.type==='research'&&e.built>=1&&!e.res)){
    const n=RESEARCH.find(x=>ai.research.includes(x.id)&&!has(T,x.id)&&(!x.req||has(T,x.req))&&!mine.some(m=>m.res&&m.res.id===x.id));
    if(n&&pw()>=n.cost+150){power[T]-=n.cost;r.res={id:n.id,prog:0}}}
  const threat=ents.find(e=>e.team===0&&e.kind==='u'&&e.hp>0&&!e.stranded&&dist(e,hq)<600);
  if(threat){for(const a of army)if(!a.order||(a.order.t!=='attack'&&!a.raid))orderMove(a,threat.x,threat.y,'amove');
    for(const a of air)if(!a.order&&canHit(a,threat))a.order={t:'attack',id:threat.id};ai.time+=1;return}
  const home=army.filter(a=>!a.raid);
  if(home.length>=ai.size||(ai.time>ai.next&&home.length>=3)){
    const pb=ents.filter(e=>e.team===0&&e.kind==='b'&&e.hp>0);
    if(pb.length){const tgt=R()<.5?findHQ(0)||pb[0]:pb.sort((a,b)=>dist(a,hq)-dist(b,hq))[0];
      for(const a of home){a.raid=true;orderMove(a,tgt.x+(R()-.5)*60,tgt.y+(R()-.5)*60,'amove')}
      for(const a of air){const t=pb[Math.floor(R()*pb.length)];a.order={t:'attack',id:t.id}}
      ai.wave++;ai.size=Math.min(ai.maxSize,ai.size+2);ai.next=ai.time+ai.gap;if(ai.wave>1)msg('Enemy attack incoming!')}}
  for(const a of army)if(a.raid&&!a.order){const pb=ents.filter(e=>e.team===0&&e.hp>0&&!e.stranded).sort((x,y)=>dist(x,a)-dist(y,a))[0];if(pb)orderMove(a,pb.x,pb.y,'amove')}
  for(const a of air)if(!a.order&&!a.rearming&&ai.wave>0&&R()<.2){const pb=ents.filter(e=>e.team===0&&e.hp>0&&canHit(a,e));if(pb.length)a.order={t:'attack',id:pb[Math.floor(R()*pb.length)].id}}
  ai.time+=1;
}
function shownTo1(e){return true}
// Wave mode: no enemy base, groups of units arrive from the enemy corner.
function aiWaves(dt){
  ai.waveT-=dt;ai.time+=dt;
  if(ai.waveT<=0){ai.waveT=ai.gap;const pool=ai.pool[Math.min(ai.pool.length-1,Math.floor(ai.wave/2))],n=Math.round(ai.base+ai.wave*ai.grow);
    const hq=findHQ(0);if(hq){const list=[];for(let i=0;i<n;i++)list.push(pool[Math.floor(R()*pool.length)]);
      const sx=(MW-8+R()*3)*TILE,sy=(6+R()*3)*TILE;
      for(const u of spawnUnits(1,list,sx,sy)){u.raid=true;if(isAir(u))u.order={t:'attack',id:hq.id};else orderMove(u,hq.x+(R()-.5)*120,hq.y+(R()-.5)*120,'amove')}
      ai.wave++;msg('Enemy wave '+ai.wave+' incoming!');sfx('alert')}}
  ai.t-=dt;if(ai.t<=0){ai.t=1;for(const a of ents)if(a.team===1&&a.kind==='u'&&!a.order&&!isAir(a)){const pb=ents.filter(e=>e.team===0&&e.hp>0).sort((x,y)=>dist(x,a)-dist(y,a))[0];if(pb)orderMove(a,pb.x,pb.y,'amove')}}
}
