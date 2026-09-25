// =====================================================================
// UI: HUD, unit designer, menus, input, save/load and game flow
// =====================================================================
const mouse={x:0,y:0,in:false,world:null},keys={};let drag=null,rot=null,lastClick={t:0,key:null},lastGroupKey={k:null,t:0};
let inGameMenu=false,menuPrevPause=false,sk={map:'desert',size:64,ais:1,mode:'vs',diff:'normal',weather:'clear',allies:[false,false,false]};
function uiOpen(){return !$('designer').hidden||!$('editor').hidden||$('overlay').style.display!=='none'}
function lsGet(k){try{return localStorage.getItem(k)}catch(e){return null}}
function lsSet(k,v){try{localStorage.setItem(k,v);return true}catch(e){return false}}
function showMenu(html){$('obox').innerHTML=html;$('overlay').style.display='flex'}
function hideMenu(){$('overlay').style.display='none'}
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

// ---------- HUD ----------
let panelKey='',refs=[];
function mkBtn(label,cost,img,tip,onL,onR){
  const b=document.createElement('div');b.className='btn';b.title=tip;
  b.innerHTML=`${img?`<img src="${img}" alt="">`:''}<div>${esc(label)}</div>${cost!==''?`<div class="cost">⚡${cost}</div>`:''}<div class="q"></div><div class="prog"></div>`;
  b.addEventListener('mousedown',e=>{e.preventDefault();e.stopPropagation();if(e.button===0)onL(e);else if(e.button===2&&onR)onR(e)});
  b.addEventListener('contextmenu',e=>e.preventDefault());
  $('buttons').appendChild(b);return b}
const iconCache={};
function textIcon(txt,col){const k=txt+col;if(iconCache[k])return iconCache[k];const c=document.createElement('canvas');c.width=84;c.height=56;const g=c.getContext('2d');g.fillStyle=col;g.beginPath();g.arc(42,28,20,0,7);g.fill();g.fillStyle='#123';g.font='bold 20px Verdana';g.textAlign='center';g.textBaseline='middle';g.fillText(txt,42,30);return iconCache[k]=c.toDataURL()}
function researchAllowed(team,r){if(tech[team][r.id]||(r.req&&!tech[team][r.req]))return false;if(game.mode==='campaign'&&team===0)return MISSIONS[game.mission].research.includes(r.id);return true}
function unitLabel(e){return e.kind==='b'?BDEF[e.type].name:(e.convoy?'Convoy ':'')+e.st.name}
function rebuildPanel(){
  $('buttons').innerHTML='';refs=[];
  const own=sel.filter(e=>e.team===0);
  if(!sel.length){$('selTitle').textContent='Nothing selected. Drag a box around your units or click a building.';return}
  if(own.some(isTruck))for(const t of BUILD_LIST){const d=BDEF[t];if(!avail(0,d))continue;
    const b=mkBtn(d.name,d.cost,thumbB(t),d.desc,()=>{placing={type:t};if(t==='derrick')msg('Click on a burning oil resource to build a derrick',2);if(t==='wall')msg('Click and drag to build a line of walls',2)});
    refs.push(()=>b.classList.toggle('dis',power[0]<d.cost))}
  if(own.some(e=>e.kind==='u'&&e.st.util==='transport'))mkBtn('Unload','',textIcon('⇩','#6cf'),'Drop off all carried units below the transport (U)',unloadSel);
  if(own.length===1&&own[0].kind==='b'){const f=own[0];
    if(f.built>=1&&f.type==='factory'){
      for(const tp of templates[0]){if(!designOk(0,tp))continue;const st=calcStats(tp),key=dkey(tp);
        const b=mkBtn(tp.name,st.cost,thumbUnit(tp),st.name+'. HP '+st.hp+'. Left-click: build. Right-click: cancel.',
          ()=>{if(f.queue.length>=8)return deny('Queue is full');if(power[0]<st.cost)return deny('Not enough power!');power[0]-=st.cost;f.queue.push({body:tp.body,prop:tp.prop,weapon:tp.weapon,name:tp.name});sfx('click')},
          ()=>{let i=-1;f.queue.forEach((q,j)=>{if(dkey(q)===key)i=j});if(i>=0){f.queue.splice(i,1);power[0]+=st.cost;if(i===0)f.prog=0}});
        refs.push(()=>{const n=f.queue.filter(q=>dkey(q)===key).length;b.querySelector('.q').textContent=n?n:'';b.querySelector('.prog').style.width=f.queue[0]&&dkey(f.queue[0])===key?(f.prog/st.time*100)+'%':'0';b.classList.toggle('dis',power[0]<st.cost)})}
      mkBtn('Design new unit','',textIcon('+','#ffe066'),'Open the unit designer',openDesigner)}
    if(f.built>=1&&f.type==='research'){const list=RESEARCH.filter(r=>researchAllowed(0,r));
      if(!list.length)$('buttons').insertAdjacentHTML('beforeend','<div class="note">All available research is complete.</div>');
      for(const r of list){
        const b=mkBtn(r.name,r.cost,textIcon('R','#5cf'),r.desc,
          ()=>{if(f.res)return deny('This facility is already researching');if(ents.some(e=>e.team===0&&e.res&&e.res.id===r.id))return deny('Already being researched');if(power[0]<r.cost)return deny('Not enough power!');power[0]-=r.cost;f.res={id:r.id,prog:0};sfx('click')},
          ()=>{if(f.res&&f.res.id===r.id){power[0]+=r.cost;f.res=null}});
        refs.push(()=>{b.querySelector('.prog').style.width=f.res&&f.res.id===r.id?(f.res.prog/r.time*100)+'%':'0';b.classList.toggle('dis',power[0]<r.cost||(!!f.res&&f.res.id!==r.id))})}}}
  refs.push(()=>{let t;
    if(sel.length===1){const e=sel[0];t=(e.team?TEAM_NAMES[e.team]+' ':'')+unitLabel(e)+'  —  HP '+Math.ceil(e.hp)+'/'+e.maxHp;
      if(e.kind==='u'&&e.rank)t+='  ·  '+RANK_NAMES[e.rank]+' ('+e.kills+' kills)';
      if(e.kind==='u'&&e.st.air&&!e.st.util)t+='  ·  Ammo '+e.ammo+'/'+(VTOL_AMMO[e.d.weapon]||4)+(e.rearming?' (rearming)':'');
      if(e.kind==='b'&&e.built<1)t+='  (under construction '+Math.floor(e.built*100)+'%)';
      if(e.kind==='u'&&e.st.util==='transport')t+='  ·  Cargo '+cargoOf(e).length+'/'+e.st.w.cap+'. Right-click it with units to board, U to unload';
      if(e.type==='derrick'&&e.built>=1)t+='  (+'+(2.6*(tech[e.team].oil?1.5:1)).toFixed(1)+' power/s)';
      if(e.team===0&&e.type==='factory'&&e.built>=1)t+='  ·  Right-click the map to set a rally point'}
    else{const c={};for(const e of sel){const n=unitLabel(e);c[n]=(c[n]||0)+1}t=sel.length+' selected: '+Object.entries(c).map(([k,v])=>v+'× '+k).join(', ')}
    $('selTitle').textContent=t});
}
function updateHud(){
  const key=sel.map(e=>e.id+':'+(e.built>=1?1:0)).join(',')+'|'+Object.keys(tech[0]).join()+'|'+templates[0].map(dkey).join();
  if(key!==panelKey){panelKey=key;rebuildPanel()}
  for(const f of refs)f();
  $('power').textContent=Math.floor(power[0]);$('pbar').firstChild.style.width=Math.min(100,power[0]/20)+'%';
  $('income').textContent='+'+incomeOf(0).toFixed(1)+'/s';
  $('counts').textContent='Units '+ents.filter(e=>e.team===0&&e.kind==='u').length+'/'+UNIT_CAP+' · Kills '+stats.kills;
}

// ---------- UNIT DESIGNER ----------
let dz={body:'viper',prop:'wheels',weapon:'mg'},dPrev=false;
function openDesigner(){if(state!=='play')return;$('designer').hidden=false;dPrev=paused;paused=true;renderDesigner()}
function closeDesigner(){$('designer').hidden=true;paused=dPrev;panelKey=''}
function reqText(c){return c.req?'Requires research: '+RESEARCH.find(r=>r.id===c.req).name:''}
function chipRow(el,defs,part){const boxEl=$(el);boxEl.innerHTML='';
  for(const k in defs){if(defs[k].structOnly)continue;const c=defs[k],ok=avail(0,c),b=document.createElement('button');b.type='button';b.className='chip'+(dz[part]===k?' on':'');b.disabled=!ok;b.title=ok?c.desc:reqText(c);
    b.innerHTML=esc(c.name)+'<small>'+(ok?'⚡'+c.cost:'Locked')+'</small>';b.onclick=()=>{dz[part]=k;sfx('click');renderDesigner()};boxEl.appendChild(b)}}
function renderDesigner(){
  chipRow('dBody',BODIES,'body');chipRow('dProp',PROPS,'prop');chipRow('dWeap',WEAPONS,'weapon');
  const st=calcStats(dz),err=designError(dz),w=st.w;$('dImg').src=thumbUnit(dz);$('dName').textContent=st.name;
  const rows=[['Hit points',st.hp],['Speed',Math.round(st.speed)],['Cost','⚡'+st.cost],['Build time',st.time+' s']];
  if(w.util==='truck')rows.push(['Role','Builds and repairs structures']);else if(w.util==='repair')rows.push(['Role','Repairs '+w.heal+' HP per second']);
  else if(w.util==='transport')rows.push(['Role','Carries '+w.cap+' ground units']);else if(w.util==='sensor')rows.push(['Role','Sees very far, spots targets for artillery']);
  else{rows.push(['Damage',Math.round(w.dmg)+(w.splash?' (splash)':'')]);rows.push(['Range',w.range]);rows.push(['Targets',w.airOnly?'Air only':w.air?'Ground and air':'Ground only'])}
  if(st.air&&!w.util)rows.push(['Ammo',(VTOL_AMMO[dz.weapon]||4)+' shots, rearms at a VTOL Pad']);
  $('dStats').innerHTML=rows.map(r=>'<tr><td>'+r[0]+'</td><td>'+r[1]+'</td></tr>').join('');
  const dup=templates[0].some(t=>dkey(t)===dkey(dz));
  $('dErr').textContent=err||(dup?'You already have this design.':!designOk(0,dz)?'Some parts are still locked.':'');
  $('dSave').disabled=!!err||dup||templates[0].length>=16||!designOk(0,dz);
  const lst=$('dList');lst.innerHTML='';
  templates[0].forEach((t,i)=>{const b=document.createElement('button');b.type='button';b.className='chip';b.title='Remove this design';b.innerHTML=esc(t.name)+'<small>✕ Remove</small>';b.onclick=()=>{templates[0].splice(i,1);renderDesigner()};lst.appendChild(b)});
}
$('dSave').onclick=()=>{if($('dSave').disabled)return;templates[0].push({...dz,name:calcStats(dz).name});sfx('complete');msg('Design saved. Build it from your Factory.',2.5);renderDesigner()};
$('dClose').onclick=closeDesigner;
$('bDesign').onclick=openDesigner;$('bMenu').onclick=()=>openGameMenu();$('snd').onclick=toggleSound;

// ---------- MENUS ----------
function progress(){return +(lsGet('if_progress')||0)}
function mainMenu(){state='menu';inGameMenu=false;$('obj').hidden=true;$('designer').hidden=true;
  showMenu(`<h1>IRON FRONTIER</h1><p class="sub">A 3D real-time strategy game</p><div class="menu-list">
  <button class="big" onclick="campaignMenu()">Campaign</button><button class="big" onclick="skirmishMenu()">Skirmish</button>
  <button class="big" onclick="slotsMenu('load')">Load game</button><button class="big" onclick="openEditor()">Map editor</button><button class="big" onclick="helpMenu()">How to play</button></div>`)}
function campaignMenu(){const p=progress();
  showMenu(`<h1>CAMPAIGN</h1><div class="menu-list">${MISSIONS.map((m,i)=>`<button class="mission" ${i>p?'disabled':''} onclick="briefing(${i})"><b>Mission ${i+1}: ${esc(m.name)}</b><small>${i>p?'Locked: complete the previous mission':THEMES[m.theme].name}</small></button>`).join('')}
  <button class="big" onclick="mainMenu()">Back</button></div>`)}
function briefing(i){const M=MISSIONS[i];
  showMenu(`<h1>MISSION ${i+1}</h1><h2>${esc(M.name)}</h2><p class="sub">${THEMES[M.theme].name}</p><p class="story">${esc(M.brief)}</p>
  <div class="dlabel">Objectives</div><ul>${M.objectives.map(o=>'<li>'+esc(o.text)+(o.timer?' ('+fmtTime(o.timer)+')':'')+'</li>').join('')}<li>Keep your Command Center alive</li></ul>
  <div><button class="big" onclick="startMission(${i})">Start mission</button><button class="big" onclick="campaignMenu()">Back</button></div>`)}
function skirmishMenu(){
  const maps=customMaps(),cm=sk.map.startsWith('custom:')?maps[sk.map.slice(7)]:null;if(sk.map.startsWith('custom:')&&!cm)sk.map='desert';
  const maxAI=cm?Math.min(3,cm.starts.length-1):3;if(sk.ais>maxAI)sk.ais=maxAI;
  const q=v=>typeof v==='string'?"'"+v.replace(/'/g,"\\'")+"'":v;
  const row=(label,key,opts)=>`<div class="dlabel">${label}</div><div class="chips center">${opts.map(([v,t])=>`<button class="chip${sk[key]===v?' on':''}" onclick="sk.${key}=${esc(q(v))};skirmishMenu()">${esc(t)}</button>`).join('')}</div>`;
  const aiOpts=[[1,'1 AI'],[2,'2 AIs'],[3,'3 AIs']].filter(o=>o[0]<=maxAI);
  const teams=`<div class="dlabel">Teams</div><div class="chips center">${[1,2,3].slice(0,sk.ais).map(t=>`<button class="chip${sk.allies[t-1]?' on':''}" onclick="sk.allies[${t-1}]=!sk.allies[${t-1}];skirmishMenu()">${TEAM_NAMES[t]}: ${sk.allies[t-1]?'Ally':'Enemy'}</button>`).join('')}</div>`;
  const enemies=[1,2,3].slice(0,sk.ais).filter(t=>!sk.allies[t-1]).length;
  showMenu(`<h1>SKIRMISH</h1>${row('Map','map',Object.keys(THEMES).map(k=>[k,THEMES[k].name]).concat(Object.keys(maps).map(n=>['custom:'+n,n+' (custom)'])))}
  ${cm?'':row('Map size','size',[[64,'Small'],[96,'Medium'],[128,'Large'],[192,'Huge']])}
  ${row('Opponents','ais',aiOpts)}${teams}${enemies>1?row('Enemies','mode',[['vs','Team up against you'],['ffa','Fight each other too']]):''}
  ${row('Weather','weather',Object.keys(WEATHER).map(k=>[k,WEATHER[k].name]))}${row('Difficulty','diff',[['easy','Easy'],['normal','Normal'],['hard','Hard']])}
  ${enemies?'':'<p class="sub">Make at least one AI an enemy.</p>'}
  <div><button class="big" ${enemies?'':'disabled'} onclick="newSkirmish(JSON.parse(JSON.stringify(sk)))">Start game</button><button class="big" onclick="mainMenu()">Back</button></div>`)}
function helpMenu(){showMenu(`<h1>HOW TO PLAY</h1><ul>
  <li><b>Select</b> units by dragging a box or clicking. Double-click selects all units of that design.</li>
  <li><b>Right-click</b> to move or attack. Right-click a damaged building with trucks to repair it.</li>
  <li><b>Camera:</b> WASD, arrow keys or screen edge to scroll. Q / E or middle mouse to rotate. Mouse wheel to zoom.</li>
  <li><b>Power:</b> build Oil Derricks on burning oil resources.</li>
  <li><b>Design</b> your own units: choose a body, propulsion and weapon, then build them in the Factory.</li>
  <li><b>Research</b> unlocks new parts, defenses, VTOL aircraft and upgrades.</li>
  <li><b>Veterans:</b> units that destroy enemies earn ranks (yellow chevrons) and get stronger.</li>
  <li><b>Repair</b> with Repair Trucks, a Repair Facility, or trucks for buildings. VTOLs repair and rearm on VTOL Pads.</li>
  <li><b>Groups:</b> Ctrl + 1-9 (or Shift + 1-9) saves a group. Press the number to select it, twice to jump to it.</li>
  <li><b>Transport:</b> right-click a Transport with ground units to board, then fly it and press U to unload.</li>
  <li><b>Radar:</b> Radar Towers and Radar Turrets see far. Mortars fire at everything they spot.</li>
  <li><b>Keys:</b> H = base, G = select army, P = pause, M = sound, Esc = menu.</li></ul>
  <button class="big" onclick="mainMenu()">Back</button>`)}
function openGameMenu(){if(state!=='play'||inGameMenu)return;if(!$('designer').hidden)closeDesigner();inGameMenu=true;menuPrevPause=paused;paused=true;
  showMenu(`<h1>PAUSED</h1><div class="menu-list"><button class="big" onclick="resumeGame()">Resume</button><button class="big" onclick="slotsMenu('save')">Save game</button>
  <button class="big" onclick="slotsMenu('load')">Load game</button><button class="big" onclick="restartGame()">Restart</button><button class="big" onclick="mainMenu()">Quit to main menu</button></div>`)}
function resumeGame(){inGameMenu=false;paused=menuPrevPause;hideMenu()}
function restartGame(){if(game.mode==='campaign')startMission(game.mission);else newSkirmish(game.sk||sk)}
function slotsMenu(mode){
  const back=inGameMenu?'inGameMenu=false;openGameMenu()':'mainMenu()';
  const rows=[1,2,3].map(i=>{let meta=null;try{meta=JSON.parse(lsGet('if_meta_'+i)||'null')}catch(e){}
    const label=meta?`<b>Slot ${i}: ${esc(meta.label)}</b><small>Game time ${esc(meta.time)} · saved ${esc(meta.date)}</small>`:`<b>Slot ${i}</b><small>Empty</small>`;
    return `<button class="mission" ${mode==='load'&&!meta?'disabled':''} onclick="${mode==='save'?'saveGame':'loadGame'}(${i})">${label}</button>`}).join('');
  showMenu(`<h1>${mode==='save'?'SAVE GAME':'LOAD GAME'}</h1><div class="menu-list">${rows}<p class="sub" id="slotMsg"></p><button class="big" onclick="${back}">Back</button></div>`)}
function endGame(win,reason){if(state!=='play')return;state='over';inGameMenu=false;$('designer').hidden=true;
  const tm=fmtTime(time);let btns;
  if(game.mode==='campaign'){const i=game.mission,last=i===MISSIONS.length-1;
    if(win&&progress()<i+1)lsSet('if_progress',String(Math.min(MISSIONS.length-1,i+1)));
    btns=(win&&!last?`<button class="big" onclick="briefing(${i+1})">Next mission</button>`:'')+`<button class="big" onclick="startMission(${i})">${win?'Play again':'Retry mission'}</button><button class="big" onclick="mainMenu()">Main menu</button>`;
    if(win&&last)reason='Campaign complete! The valley is yours, Commander.'}
  else btns=`<button class="big" onclick="restartGame()">Play again</button><button class="big" onclick="mainMenu()">Main menu</button>`;
  sfx(win?'complete':'alert');say(win?'Mission accomplished':'Mission failed');
  showMenu(`<h1>${win?'VICTORY':'DEFEAT'}</h1><p>${esc(reason||(win?'The enemy Command Center has been destroyed!':''))}</p>
  <p class="sub">Time ${tm} · Units built ${stats.built} · Enemies destroyed ${stats.kills} · Losses ${stats.lost}</p><div id="statsBox"></div><div>${btns}</div>`);
  if(stats.hist){recordStats();renderStats($('statsBox'))}}

// ---------- END-OF-GAME STATISTICS ----------
const STAT_COL=['#5fbf4a','#e8584f','#6a95f5','#e0a03a'],STAT_DASH=[[],[7,4],[2,3],[9,3,2,3]];
function renderStats(box){
  const n=stats.team.length,h=stats.hist;if(!box||h.length<2)return;
  const rows=stats.team.map((s,t)=>`<tr><td><span class="key" style="border-color:${STAT_COL[t]};border-top-style:${t?'dashed':'solid'}"></span>${TEAM_NAMES[t]}${t===0?' (you)':game.ally&&game.ally[t]===0?' (ally)':''}</td><td>${s.built}</td><td>${s.kills}</td><td>${s.lost}</td><td>${Math.round(s.earned)}</td></tr>`).join('');
  box.innerHTML=`<table class="stab"><thead><tr><th>Player</th><th>Units built</th><th>Destroyed</th><th>Lost</th><th>Power earned</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="charts"><figure><figcaption>Army size</figcaption><canvas class="chart" data-k="u"></canvas></figure><figure><figcaption>Power earned</figcaption><canvas class="chart" data-k="p"></canvas></figure></div><div class="ctip" hidden></div>`;
  const tip=box.querySelector('.ctip');
  for(const cv of box.querySelectorAll('canvas.chart')){const k=cv.dataset.k,W=Math.min(260,Math.floor((box.clientWidth||520)/2-12)),H=150,dpr=Math.min(2,devicePixelRatio||1);
    cv.width=W*dpr;cv.height=H*dpr;cv.style.width=W+'px';cv.style.height=H+'px';
    const L=34,Rp=46,Tp=8,B=20,maxT=h[h.length-1].t||1,maxV=Math.max(1,...h.map(s=>Math.max(...s[k])));
    const X=t=>L+(W-L-Rp)*t/maxT,Y=v=>Tp+(H-Tp-B)*(1-v/maxV);
    const draw=hover=>{const g=cv.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,W,H);
      g.strokeStyle='rgba(200,200,255,.12)';g.lineWidth=1;g.fillStyle='#aab';g.font='10px Verdana';g.textAlign='right';
      for(let i=0;i<=2;i++){const v=maxV*i/2,y=Math.round(Y(v))+.5;g.beginPath();g.moveTo(L,y);g.lineTo(W-Rp,y);g.stroke();g.fillText(Math.round(v),L-4,y+3)}
      g.textAlign='center';g.fillText('0:00',L,H-6);g.fillText(fmtTime(maxT),W-Rp,H-6);
      for(let t=0;t<n;t++){g.strokeStyle=STAT_COL[t];g.lineWidth=2;g.setLineDash(STAT_DASH[t]);g.beginPath();h.forEach((s,i)=>{const x=X(s.t),y=Y(s[k][t]||0);i?g.lineTo(x,y):g.moveTo(x,y)});g.stroke();g.setLineDash([])}
      const ends=[...Array(n).keys()].map(t=>({t,y:Y(h[h.length-1][k][t]||0)})).sort((a,b)=>a.y-b.y);for(let i=1;i<ends.length;i++)if(ends[i].y-ends[i-1].y<11)ends[i].y=ends[i-1].y+11;
      g.textAlign='left';g.font='10px Verdana';for(const e of ends){g.fillStyle='#dfe6ff';g.fillText(TEAM_NAMES[e.t],W-Rp+4,e.y+3)}
      if(hover!=null){const s=h[hover],x=Math.round(X(s.t))+.5;g.strokeStyle='rgba(255,255,255,.5)';g.beginPath();g.moveTo(x,Tp);g.lineTo(x,H-B);g.stroke();
        for(let t=0;t<n;t++){g.fillStyle=STAT_COL[t];g.beginPath();g.arc(x,Y(s[k][t]||0),4,0,7);g.fill();g.strokeStyle='#1b1850';g.lineWidth=2;g.stroke()}}};
    draw(null);
    cv.onpointermove=ev=>{const r=cv.getBoundingClientRect(),mx=ev.clientX-r.left;let bi=0,bd=1e9;h.forEach((s,i)=>{const d=Math.abs(X(s.t)-mx);if(d<bd){bd=d;bi=i}});draw(bi);
      const s=h[bi];tip.hidden=false;tip.textContent='';const hd=document.createElement('div');hd.className='th';hd.textContent=fmtTime(s.t);tip.appendChild(hd);
      for(let t=0;t<n;t++){const rw=document.createElement('div');const sw=document.createElement('span');sw.className='key';sw.style.borderColor=STAT_COL[t];sw.style.borderTopStyle=t?'dashed':'solid';const b=document.createElement('b');b.textContent=s[k][t]||0;rw.append(sw,b,document.createTextNode(' '+TEAM_NAMES[t]));tip.appendChild(rw)}
      const br=box.getBoundingClientRect();tip.style.left=(ev.clientX-br.left+12)+'px';tip.style.top=(ev.clientY-br.top-10)+'px'};
    cv.onpointerleave=()=>{draw(null);tip.hidden=true}}
}

// ---------- SAVE / LOAD ----------
function saveGame(slot){
  const data={v:4,weather,size:MW,seed:mapSeed,theme:themeId,game,diff,time,power,tech,stats,ais,nextId,templates,groups,cam:{x:cam.x,y:cam.y,dist:cam.dist,yaw:cam.yaw,pitch:cam.pitch},
    explored:Array.from(explored).join(''),ents:ents.filter(e=>e.hp>0).map(e=>{const o={};for(const k in e)if(k!=='auto'&&k!=='st'&&k!=='sw')o[k]=e[k];return o})};
  const label=game.mode==='campaign'?'Mission '+(game.mission+1)+': '+MISSIONS[game.mission].name:'Skirmish: '+THEMES[themeId].name+', '+(game.teams-1)+' AI ('+diff+')';
  const ok=lsSet('if_save_'+slot,JSON.stringify(data))&&lsSet('if_meta_'+slot,JSON.stringify({label,time:fmtTime(time),date:new Date().toLocaleString()}));
  if(ok){msg('Game saved to slot '+slot,2);sfx('complete');resumeGame()}else{const m=$('slotMsg');if(m)m.textContent='Saving failed. Your browser does not allow saving here.'}}
function loadGame(slot){let s=null;try{s=JSON.parse(lsGet('if_save_'+slot)||'null')}catch(e){}
  if(!s){const m=$('slotMsg');if(m)m.textContent='This save could not be loaded.';return}
  audioInit();setMapSize(s.size||64);weather=s.weather||'clear';const clears=s.game.mode==='campaign'?(MISSIONS[s.game.mission].clears||[]):[];
  startWorld(s.seed,s.theme,clears,s.game.custom);
  game=s.game;diff=s.diff;time=s.time;power=s.power;tech=s.tech;stats=s.stats;ais=s.ais||[null,s.ai];templates=s.templates;groups=s.groups||{};
  for(const e of s.ents){e.auto=null;if(e.kind==='u')e.st=calcStats(e.d);else{e.sw=structWeapon(e.type);for(let y=e.ty;y<e.ty+e.h;y++)for(let x=e.tx;x<e.tx+e.w;x++)bldMap[idx(x,y)]=e.id;if(e.type==='derrick'){const o=oils[oilMap[idx(e.tx,e.ty)]-1];if(o)o.bid=e.id}}ents.push(e);byId.set(e.id,e)}
  nextId=s.nextId;for(let i=0;i<MW*MH;i++){explored[i]=+s.explored[i]||0;fogCur[i]=explored[i]?150:238}
  beginPlay();Object.assign(cam,s.cam);msg('Game loaded',2)}

// ---------- GAME FLOW ----------
function startWorld(seed,tid,clears,custom){
  gameId++;
  if(world)scene.remove(world);meshes.clear();world=new THREE.Group();scene.add(world);
  ents=[];byId=new Map();nextId=1;sel=[];placing=null;projs=[];fx=[];decals=[];markers=[];time=0;paused=false;groups={};lastAlert=-99;stats={kills:0,lost:0,built:0};
  genMap(seed,tid,clears,custom);applyTheme();applyWeather();bldMap=new Int32Array(MW*MH);
  const tm=buildTerrainMesh();world.add(tm);
  explored=new Uint8Array(MW*MH);visible=new Uint8Array(MW*MH);fogCur=new Float32Array(MW*MH).fill(238);fogT=0;fogCv=null;
  fogTex=new THREE.DataTexture(new Uint8Array(MW*MH*4),MW,MH);fogTex.magFilter=fogTex.minFilter=THREE.LinearFilter;fogTex.needsUpdate=true;
  const fm=new THREE.Mesh(tm.geometry,new THREE.MeshBasicMaterial({color:0x000000,transparent:true,alphaMap:fogTex,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4}));fm.renderOrder=3;world.add(fm);
  for(const o of oils){const h=heightAt(o.x,o.y);o.mesh=mesh(geo('oilpool',()=>new THREE.CircleGeometry(15,20)),MAT.oil,o.x,h+.7,o.y);o.mesh.rotation.x=-Math.PI/2;o.mesh.castShadow=false;world.add(o.mesh);
    o.flame=new THREE.Sprite(FLAME_MAT);o.flame.position.set(o.x+4,h+12,o.y-2);world.add(o.flame)}
}
function beginPlay(){updateFog();state='play';inGameMenu=false;hideMenu();$('designer').hidden=true;panelKey='';missionT=0;
  const hq=findHQ(0)||ents.find(e=>e.team===0);if(hq){cam.x=hq.x+80;cam.y=hq.y-60}cam.yaw=.7;cam.dist=760;cam.pitch=.92;
  $('obj').hidden=game.mode!=='campaign';$('obj').innerHTML=''}
function newSkirmish(o){sk=JSON.parse(JSON.stringify(o));audioInit();
  const custom=o.map.startsWith('custom:')?loadCustomMap(o.map.slice(7)):null;setMapSize(custom?custom.size:o.size);const N=o.ais+1;
  const ally=[0];for(let t=1;t<N;t++)ally.push(o.allies[t-1]?0:o.mode==='ffa'?t:1);
  game={mode:'skirmish',mission:-1,ms:{},teams:N,ally,sk:JSON.parse(JSON.stringify(o)),custom};diff=o.diff;weather=o.weather||'clear';
  startWorld(Math.floor(R()*1e9),custom?custom.theme:o.map,[],custom);
  power=Array(N).fill(1000);tech=Array.from({length:N},()=>({}));templates=Array.from({length:N},()=>[]);addDefaultTemplates(0);initStats(N);
  const D=DIFF[o.diff],first=Math.round(D.first*(.8+.2*MW/64));
  ais=[null];for(let t=1;t<N;t++)ais.push(newAI({inc:D.inc,first:first+(t-1)*45,gap:D.gap,harass:o.diff!=='easy'}));
  // allies take the corners next to the player, enemies the far ones
  const free=[1,2,3],corner=[0];for(let t=1;t<N;t++){const pref=ally[t]===0?[2,3,1]:[1,3,2],c=pref.find(x=>free.includes(x));free.splice(free.indexOf(c),1);corner.push(c)}
  for(let t=0;t<N;t++)stdBase(t,{corner:corner[t],start:custom?custom.starts[t]:null,extra:t&&o.diff!=='easy'?[['tower',1]]:[]});
  beginPlay();msg('Build oil derricks to get power. The first enemy attack comes in about '+Math.round(first/60)+' minutes!',8)}
function startMission(i){const M=MISSIONS[i];audioInit();setMapSize(64);game={mode:'campaign',mission:i,ms:{t:0},teams:2,ally:[0,1]};diff='normal';weather=M.weather||'clear';startWorld(M.seed,M.theme,M.clears||[]);
  power=[M.power||1000,1200];tech=[Object.fromEntries(M.tech.map(k=>[k,true])),Object.fromEntries(M.enemyTech.map(k=>[k,true]))];templates=[[],[]];addDefaultTemplates(0);
  ais=[null,newAI(M.ai)];initStats(2);M.setup();beginPlay();msg('Mission '+(i+1)+': '+M.name,4)}

// ---------- INPUT ----------
function pickAt(sx,sy){let best=null,bd=1e9;
  for(const e of ents){if(e.kind!=='u'||e.hp<=0||!shown(e))continue;const h=entH(e),p=worldToScreen(e.x,h,e.y),r=Math.max(10,(e.r+4)*pxPerUnit(e.x,h,e.y)),d=Math.hypot(p.x-sx,p.y-sy);if(d<r&&d<bd){bd=d;best=e}}
  if(best)return best;const w=screenToWorld(sx,sy);if(!w)return null;const tx=tileOf(w.x),ty=tileOf(w.y);const id=inb(tx,ty)?bldMap[idx(tx,ty)]:0;const b=id?byId.get(id):null;return b&&shown(b)?b:null}
const selectable=u=>u.kind==='u'&&u.team===0&&u.hp>0&&!u.stranded&&!u.inside;
ui.addEventListener('contextmenu',e=>e.preventDefault());
ui.addEventListener('mousedown',e=>{if(state!=='play'||uiOpen())return;audioInit();
  if(e.button===1){e.preventDefault();rot={x:e.clientX,y:e.clientY};return}
  const w=screenToWorld(e.clientX,e.clientY);
  if(e.button===0){if(placing){if(w){if(placing.type==='wall')placing.start=[tileOf(w.x),tileOf(w.y)];else tryPlace(w.x,w.y,e.shiftKey)}return}drag={x0:e.clientX,y0:e.clientY,x1:e.clientX,y1:e.clientY,active:false,shift:e.shiftKey}}
  else if(e.button===2){if(placing){placing=null;return}const t=pickAt(e.clientX,e.clientY);if(w||t)rightClick(w?w.x:t.x,w?w.y:t.y,t)}});
ui.addEventListener('wheel',e=>{e.preventDefault();cam.dist*=e.deltaY>0?1.1:1/1.1},{passive:false});
addEventListener('mousemove',e=>{mouse.x=e.clientX;mouse.y=e.clientY;mouse.in=true;
  if(rot){cam.yaw-=(e.clientX-rot.x)*.006;cam.pitch=clamp(cam.pitch+(e.clientY-rot.y)*.004,.55,1.35);rot={x:e.clientX,y:e.clientY}}
  if(drag){drag.x1=e.clientX;drag.y1=Math.min(e.clientY,VH);if(Math.abs(drag.x1-drag.x0)+Math.abs(drag.y1-drag.y0)>6)drag.active=true}});
document.addEventListener('mouseleave',()=>mouse.in=false);
addEventListener('mouseup',e=>{if(e.button===1){rot=null;return}if(e.button===0&&placing&&placing.start){finishWall(e.shiftKey);return}if(!drag||e.button!==0)return;const d=drag;drag=null;
  if(d.active){const x0=Math.min(d.x0,d.x1),x1=Math.max(d.x0,d.x1),y0=Math.min(d.y0,d.y1),y1=Math.max(d.y0,d.y1);
    const got=ents.filter(u=>{if(!selectable(u))return false;const p=worldToScreen(u.x,entH(u),u.y);return p.x>=x0&&p.x<=x1&&p.y>=y0&&p.y<=y1});
    sel=d.shift?[...new Set([...sel.filter(selectable),...got])]:got;if(sel.length)sfx('click');return}
  const p=pickAt(d.x0,d.y0),now=performance.now(),pk=p&&p.kind==='u'?dkey(p.d):null;
  if(p&&selectable(p)&&lastClick.key===pk&&now-lastClick.t<350){sel=ents.filter(u=>{if(!selectable(u)||dkey(u.d)!==pk)return false;const q=worldToScreen(u.x,entH(u),u.y);return q.x>0&&q.x<W&&q.y>0&&q.y<VH})}
  else if(p&&!p.stranded){if(d.shift&&selectable(p)){sel=sel.filter(selectable);sel=sel.includes(p)?sel.filter(e=>e!==p):[...sel,p]}else sel=[p]}
  else if(!d.shift)sel=[];
  if(p)sfx('click');
  lastClick={t:now,key:pk}});
function wallLine(a,b){const out=[];let[x0,y0]=a;const[x1,y1]=b,dx=Math.abs(x1-x0),dy=-Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1;let err=dx+dy;for(let i=0;i<40;i++){out.push([x0,y0]);if(x0===x1&&y0===y1)break;const e2=2*err;if(e2>=dy){err+=dy;x0+=sx}if(e2<=dx){err+=dx;y0+=sy}}return out}
function finishWall(keep){const w=mouse.world,line=w?wallLine(placing.start,[tileOf(w.x),tileOf(w.y)]):[placing.start];placing.start=null;
  const trucks=sel.filter(e=>isTruck(e)&&e.team===0);let n=0;
  for(const[tx,ty]of line){if(power[0]<BDEF.wall.cost){deny('Not enough power!');break}if(!canPlace('wall',tx,ty))continue;const b=placeBuilding('wall',0,tx,ty);for(const t of trucks)orderBuild(t,b,n>0||keep);n++}
  if(n)sfx('place');if(!keep)placing=null}
function tryPlace(wx,wy,keep){const d=BDEF[placing.type],tx=Math.round(wx/TILE-d.w/2),ty=Math.round(wy/TILE-d.h/2);
  if(power[0]<d.cost)return deny('Not enough power!');
  if(!canPlace(placing.type,tx,ty))return deny(placing.type==='derrick'?'Derricks must be built on free oil resources':'Cannot build there');
  const b=placeBuilding(placing.type,0,tx,ty);for(const t of sel.filter(e=>isTruck(e)&&e.team===0))orderBuild(t,b,true);sfx('place');if(!keep)placing=null}
function rightClick(wx,wy,t){
  const own=sel.filter(e=>e.team===0&&!e.stranded);if(!own.length)return;
  if(own.length===1&&own[0].kind==='b'){if(own[0].type==='factory'){own[0].rally={x:wx,y:wy};markers.push({x:wx,y:wy,life:.5,c:'#8f8'});sfx('ack')}return}
  const us=own.filter(e=>e.kind==='u');if(!us.length)return;
  if(t&&hostile(0,t.team)){for(const u of us){if(canHit(u,t)){u.order={t:'attack',id:t.id};u.repath=0;u.chasing=false;setPath(u,t.x,t.y)}else orderMove(u,wx,wy)}markers.push({x:t.x,y:t.y,life:.5,c:'#f66'});sfx('ack');return}
  if(t&&t.team===0&&t.kind==='u'&&t.st.util==='transport'&&us.some(u=>!isAir(u))){for(const u of us)if(!isAir(u)){u.order={t:'board',id:t.id};u.path=[];u.repath=0}markers.push({x:t.x,y:t.y,life:.5,c:'#6cf'});sfx('ack');return}
  if(t&&t.team===0&&t.kind==='b'&&(t.built<1||t.hp<t.maxHp)&&us.some(isTruck)){for(const u of us)if(isTruck(u))orderBuild(u,t);sfx('ack');return}
  if(t&&t.team===0&&t.kind==='u'&&t.hp<t.maxHp&&us.some(u=>u.st.util==='repair')){for(const u of us)if(u.st.util==='repair'){u.order=null;u.heal=t.id;u.path=[]}markers.push({x:t.x,y:t.y,life:.5,c:'#6f9'});sfx('ack');return}
  const n=us.length,cols=Math.ceil(Math.sqrt(n)),sp=34;
  us.sort((a,b)=>dist(a,{x:wx,y:wy})-dist(b,{x:wx,y:wy})).forEach((u,i)=>{const cx=i%cols-(cols-1)/2,cy=Math.floor(i/cols)-(Math.ceil(n/cols)-1)/2;orderMove(u,wx+cx*sp,wy+cy*sp)});
  markers.push({x:wx,y:wy,life:.5,c:'#8f8'});sfx('ack');
}
function unload(tr){const c=cargoOf(tr);const tx=tileOf(tr.x),ty=tileOf(tr.y);c.forEach((u,i)=>{const a=i*2.4,r=i?1+Math.floor(i/3):0,f=nearestFree(tx+Math.round(Math.cos(a)*r),ty+Math.round(Math.sin(a)*r),tx,ty);
  if(f){u.x=(f[0]+.5)*TILE;u.y=(f[1]+.5)*TILE}else{u.x=tr.x;u.y=tr.y}u.inside=0;u.order=null;u.path=[];u.home={x:u.x,y:u.y}});return c.length}
function unloadSel(){let n=0;for(const e of sel)if(e.team===0&&e.kind==='u'&&e.st.util==='transport')n+=unload(e);if(n){msg(n+' units unloaded',1.5);sfx('ack')}else deny('The transport is empty')}
function miniPos(e){const r=mini.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width*WW,y:(e.clientY-r.top)/r.height*WH}}
let miniDrag=false;
mini.addEventListener('contextmenu',e=>e.preventDefault());
mini.addEventListener('mousedown',e=>{if(state!=='play'||uiOpen())return;const p=miniPos(e);if(e.button===0){miniDrag=true;cam.x=p.x;cam.y=p.y}else if(e.button===2)rightClick(p.x,p.y,null)});
mini.addEventListener('mousemove',e=>{if(miniDrag){const p=miniPos(e);cam.x=p.x;cam.y=p.y}});
addEventListener('mouseup',()=>miniDrag=false);
addEventListener('keydown',e=>{const k=e.key.toLowerCase();keys[k]=true;
  if(k==='escape'){if(!$('designer').hidden){closeDesigner();return}if(inGameMenu){resumeGame();return}if(state!=='play')return;if(placing){placing=null;return}if(sel.length){sel=[];return}openGameMenu();return}
  if(k==='f10'){e.preventDefault();openGameMenu();return}
  if(state!=='play'||uiOpen())return;
  const gm=/^Digit([1-9])$/.exec(e.code);
  if(gm){const g=gm[1];
    if(e.ctrlKey||e.metaKey||e.shiftKey){e.preventDefault();const ids=sel.filter(selectable).map(x=>x.id);if(ids.length){for(const q in groups)groups[q]=groups[q].filter(id=>!ids.includes(id));groups[g]=ids;msg('Group '+g+' saved ('+ids.length+' units)',1.5);sfx('ack')}}
    else{const list=(groups[g]||[]).map(id=>byId.get(id)).filter(alive);groups[g]=list.map(u=>u.id);
      if(list.length){const now=performance.now();if(lastGroupKey.k===g&&now-lastGroupKey.t<400){cam.x=list.reduce((s,u)=>s+u.x,0)/list.length;cam.y=list.reduce((s,u)=>s+u.y,0)/list.length}sel=list;sfx('click');lastGroupKey={k:g,t:now}}}
    return}
  if(k==='p')paused=!paused;
  if(k==='m')toggleSound();
  if(k==='u')unloadSel();
  if(k==='h'){const hq=findHQ(0);if(hq){cam.x=hq.x;cam.y=hq.y}}
  if(k==='g')sel=ents.filter(u=>selectable(u)&&!u.st.util);
  if(k.startsWith('arrow')||k===' ')e.preventDefault()});
addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);
addEventListener('blur',()=>{for(const k in keys)keys[k]=false});
function scrollCam(dt){const s=cam.dist*1.1*dt;let mx=0,my=0;
  if(keys.a||keys.arrowleft)mx-=1;if(keys.d||keys.arrowright)mx+=1;if(keys.w||keys.arrowup)my+=1;if(keys.s||keys.arrowdown)my-=1;
  if(mouse.in&&!drag&&!miniDrag&&!rot){if(mouse.x<8)mx-=1;if(mouse.x>W-8)mx+=1;if(mouse.y<8)my+=1;if(mouse.y>VH-6&&mouse.y<VH)my-=1}
  if(keys.q)cam.yaw+=1.6*dt;if(keys.e)cam.yaw-=1.6*dt;
  const fwx=-Math.sin(cam.yaw),fwy=-Math.cos(cam.yaw),rx=Math.cos(cam.yaw),ry=-Math.sin(cam.yaw);
  cam.x+=(fwx*my+rx*mx)*s;cam.y+=(fwy*my+ry*mx)*s}

// ---------- MAIN LOOP ----------
mainMenu();
let last=performance.now();
function loop(now){const dt=Math.min(.05,(now-last)/1000);last=now;const rt=now/1000;
  if(state!=='menu'){
    if(state==='play'){if(!uiOpen())scrollCam(dt);if(!paused)update(dt);updateHud();if(msgT>0){msgT-=dt;if(msgT<=0)$('msg').textContent=''}}
    for(const m of markers)m.life-=dt;markers=markers.filter(m=>m.life>0);
    updateCamera();updateWeather(dt,rt);syncScene(rt);renderer.render(scene,camera);mouse.world=screenToWorld(mouse.x,mouse.y);drawOverlay(rt);drawMinimap()}
  requestAnimationFrame(loop)}
requestAnimationFrame(loop);
