// =====================================================================
// MAP EDITOR: paint cliffs, place oil and start positions, save maps
// =====================================================================
let ED=null,edPaint=null;
const edCv=$('eCanvas'),ectx=edCv.getContext('2d');
function edNew(size,themeKey){const r=new Uint8Array(size*size);for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(x<2||y<2||x>=size-2||y>=size-2)r[y*size+x]=1;
  ED={size,theme:themeKey,rock:r,oils:[],starts:[],tool:'rock',brush:2,mirror:true,name:ED?ED.name:'My map'}}
function customMaps(){try{return JSON.parse(lsGet('if_maps')||'{}')}catch(e){return{}}}
function loadCustomMap(name){const m=customMaps()[name];return m?{...m}:null}
function openEditor(){state='menu';hideMenu();$('editor').hidden=false;if(!ED)edNew(64,'desert');$('eName').value=ED.name;edUI();edResize()}
function closeEditor(){$('editor').hidden=true;mainMenu()}
function edMirror(x,y){const S=ED.size;if(!ED.mirror)return[[x,y]];const out=[[x,y],[S-1-x,y],[x,S-1-y],[S-1-x,S-1-y]];return out.filter((p,i)=>out.findIndex(q=>q[0]===p[0]&&q[1]===p[1])===i)}
function edSetRock(x,y,v){const S=ED.size;for(const[px,py]of edMirror(x,y)){if(px<2||py<2||px>=S-2||py>=S-2)continue;ED.rock[py*S+px]=v;if(v){ED.oils=ED.oils.filter(o=>o[0]!==px||o[1]!==py)}}}
function edBrush(cx,cy,v){const b=ED.brush;for(let y=cy-b;y<=cy+b;y++)for(let x=cx-b;x<=cx+b;x++)if((x-cx)**2+(y-cy)**2<=b*b+.5)edSetRock(x,y,v)}
function edToggle(list,x,y,max){const S=ED.size;const pts=edMirror(x,y).filter(p=>p[0]>=2&&p[1]>=2&&p[0]<S-2&&p[1]<S-2);
  const hit=list.findIndex(o=>Math.abs(o[0]-x)<=1&&Math.abs(o[1]-y)<=1);
  if(hit>=0){const h=list[hit];const rm=edMirror(h[0],h[1]);for(const p of rm){const i=list.findIndex(o=>o[0]===p[0]&&o[1]===p[1]);if(i>=0)list.splice(i,1)}return}
  for(const p of pts){if(list.length>=max)break;if(!list.some(o=>o[0]===p[0]&&o[1]===p[1]))list.push(p)}}
function edClearAround(x,y,r){const S=ED.size;for(let yy=y-r;yy<=y+r;yy++)for(let xx=x-r;xx<=x+r;xx++)if(xx>=2&&yy>=2&&xx<S-2&&yy<S-2&&(xx-x)**2+(yy-y)**2<=r*r)ED.rock[yy*S+xx]=0}
function edApply(tx,ty,erase,first){
  const S=ED.size;if(tx<0||ty<0||tx>=S||ty>=S)return;
  if(ED.tool==='rock'||ED.tool==='ground')edBrush(tx,ty,erase?0:(ED.tool==='rock'?1:0));
  else if(!first)return;
  else if(ED.tool==='oil'){if(erase){ED.oils=ED.oils.filter(o=>Math.abs(o[0]-tx)>1||Math.abs(o[1]-ty)>1)}else{edToggle(ED.oils,tx,ty,64);for(const o of ED.oils)ED.rock[o[1]*S+o[0]]=0}}
  else if(ED.tool==='start'){if(erase){ED.starts=ED.starts.filter(o=>Math.abs(o[0]-tx)>2||Math.abs(o[1]-ty)>2)}else{const cx=clamp(tx,7,S-8),cy=clamp(ty,7,S-8);edToggle(ED.starts,cx,cy,4);for(const s of ED.starts)edClearAround(s[0],s[1],5)}}
  edDraw();
}
function edCell(){const S=ED.size;return Math.max(2,Math.floor(Math.min(edCv.width,edCv.height)/S))}
function edTile(e){const r=edCv.getBoundingClientRect(),c=edCell(),S=ED.size,ox=(edCv.width-c*S)/2,oy=(edCv.height-c*S)/2;
  return[Math.floor((e.clientX-r.left-ox)/c),Math.floor((e.clientY-r.top-oy)/c)]}
function edDraw(){
  const T=THEMES[ED.theme],S=ED.size,c=edCell(),ox=Math.floor((edCv.width-c*S)/2),oy=Math.floor((edCv.height-c*S)/2);
  ectx.fillStyle='#07060f';ectx.fillRect(0,0,edCv.width,edCv.height);
  ectx.fillStyle=T.ground;ectx.fillRect(ox,oy,c*S,c*S);
  ectx.fillStyle=T.rockBase;for(let y=0;y<S;y++)for(let x=0;x<S;x++)if(ED.rock[y*S+x])ectx.fillRect(ox+x*c,oy+y*c,c,c);
  ectx.strokeStyle='rgba(0,0,0,.15)';ectx.lineWidth=1;ectx.beginPath();for(let k=0;k<=S;k+=8){ectx.moveTo(ox+k*c+.5,oy);ectx.lineTo(ox+k*c+.5,oy+S*c);ectx.moveTo(ox,oy+k*c+.5);ectx.lineTo(ox+S*c,oy+k*c+.5)}ectx.stroke();
  for(const o of ED.oils){const x=ox+(o[0]+.5)*c,y=oy+(o[1]+.5)*c;ectx.fillStyle='#111';ectx.beginPath();ectx.arc(x,y,Math.max(3,c*.7),0,7);ectx.fill();ectx.strokeStyle='#ff9a30';ectx.lineWidth=2;ectx.stroke()}
  ED.starts.forEach((s,i)=>{const x=ox+(s[0]+.5)*c,y=oy+(s[1]+.5)*c;ectx.fillStyle=TEAM[i].css;ectx.beginPath();ectx.arc(x,y,Math.max(8,c*2.2),0,7);ectx.fill();ectx.fillStyle='#111';ectx.font='bold '+Math.max(11,c*2)+'px Verdana';ectx.textAlign='center';ectx.textBaseline='middle';ectx.fillText(i+1,x,y+1)});
}
function edResize(){const r=$('eArea').getBoundingClientRect();edCv.width=Math.max(200,Math.floor(r.width));edCv.height=Math.max(200,Math.floor(r.height));edDraw()}
addEventListener('resize',()=>{if(!$('editor').hidden)edResize()});
function edChips(el,opts,cur,fn){const b=$(el);b.innerHTML='';for(const[v,t]of opts){const x=document.createElement('button');x.type='button';x.className='chip'+(cur===v?' on':'');x.textContent=t;x.onclick=()=>fn(v);b.appendChild(x)}}
function edUI(){
  edChips('eTool',[['rock','Cliff'],['ground','Ground'],['oil','Oil resource'],['start','Start position']],ED.tool,v=>{ED.tool=v;edUI()});
  edChips('eBrush',[[1,'Small'],[2,'Medium'],[4,'Large']],ED.brush,v=>{ED.brush=v;edUI()});
  edChips('eSym',[[true,'Mirror to 4 corners'],[false,'Off']],ED.mirror,v=>{ED.mirror=v;edUI()});
  edChips('eTheme',Object.keys(THEMES).map(k=>[k,THEMES[k].name]),ED.theme,v=>{ED.theme=v;edUI();edDraw()});
  edChips('eSize',[[64,'Small'],[96,'Medium'],[128,'Large'],[192,'Huge']],ED.size,v=>{if(v!==ED.size){edNew(v,ED.theme);edUI();edDraw()}});
  const maps=customMaps(),lst=$('eList');lst.innerHTML='';
  for(const n of Object.keys(maps)){const b=document.createElement('button');b.type='button';b.className='chip';b.innerHTML=esc(n)+'<small>Load</small>';b.onclick=()=>edLoad(n);lst.appendChild(b);
    const d=document.createElement('button');d.type='button';d.className='chip';d.title='Delete '+n;d.innerHTML='✕<small>Delete</small>';d.onclick=()=>{const m=customMaps();delete m[n];lsSet('if_maps',JSON.stringify(m));edUI()};lst.appendChild(d)}
  if(!Object.keys(maps).length)lst.textContent='No saved maps yet.';
  const info=$('eInfo');info.textContent=ED.starts.length+' start positions (2-4 needed) · '+ED.oils.length+' oil resources';
}
function edLoad(n){const m=loadCustomMap(n);if(!m)return;ED={size:m.size,theme:m.theme,rock:Uint8Array.from(m.rock,ch=>ch==='1'?1:0),oils:m.oils.map(o=>[...o]),starts:m.starts.map(s=>[...s]),tool:'rock',brush:2,mirror:true,name:n};$('eName').value=n;edUI();edDraw();edMsg('Loaded "'+n+'"')}
function edMsg(t,bad){const m=$('eMsg');m.textContent=t;m.style.color=bad?'#f9a':'#9f9'}
function edValidate(){const S=ED.size;
  if(ED.starts.length<2)return 'Place at least 2 start positions.';
  const seen=new Uint8Array(S*S),st=[ED.starts[0][1]*S+ED.starts[0][0]];seen[st[0]]=1;
  while(st.length){const n=st.pop(),x=n%S,y=n/S|0;for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,i=ny*S+nx;if(nx>=0&&ny>=0&&nx<S&&ny<S&&!ED.rock[i]&&!seen[i]){seen[i]=1;st.push(i)}}}
  for(let i=1;i<ED.starts.length;i++){const s=ED.starts[i];if(!seen[s[1]*S+s[0]])return 'Start '+(i+1)+' cannot be reached from start 1. Clear a path through the cliffs.'}
  if(ED.oils.length<ED.starts.length)return 'Place at least one oil resource per start position.';
  return ''}
function edSave(){const name=($('eName').value||'').trim().slice(0,24);if(!name){edMsg('Give the map a name first.',true);return false}
  const err=edValidate();if(err){edMsg(err,true);return false}
  const m=customMaps();m[name]={name,size:ED.size,theme:ED.theme,rock:Array.from(ED.rock).join(''),oils:ED.oils,starts:ED.starts};
  if(!lsSet('if_maps',JSON.stringify(m))){edMsg('Saving failed. Your browser does not allow saving here.',true);return false}
  ED.name=name;edUI();edMsg('Saved "'+name+'"');return true}
function edPlay(){if(!edSave())return;sk.map='custom:'+ED.name;sk.ais=Math.min(sk.ais,ED.starts.length-1);sk.allies=[false,false,false];$('editor').hidden=true;skirmishMenu()}
function edRandom(){const S=ED.size,r=rng(Math.floor(R()*1e9));edNew(S,ED.theme);ED.mirror=true;
  for(let i=0;i<24*(S/64)**2;i++){const cx=3+r()*(S-6),cy=3+r()*(S-6),rad=1.5+r()*3.2;const b=ED.brush;ED.brush=Math.round(rad);edBrush(Math.round(cx),Math.round(cy),1);ED.brush=b}
  const q=[[11,S-11],[6,S-17],[15,S-6],[18,S-16],[Math.round(S*.34),Math.round(S*.63)],[Math.round(S*.19),Math.round(S*.53)],[Math.round(S*.47),Math.round(S*.53)]];
  ED.tool='start';edApply(11,S-11,false,true);ED.tool='oil';for(const o of q.slice(1))edApply(o[0],o[1],false,true);
  for(const o of ED.oils)edClearAround(o[0],o[1],2);ED.tool='rock';edUI();edDraw();edMsg('Random map created. Edit it, then save.')}
edCv.addEventListener('contextmenu',e=>e.preventDefault());
edCv.addEventListener('mousedown',e=>{const[x,y]=edTile(e);edPaint={erase:e.button===2};edApply(x,y,edPaint.erase,true)});
edCv.addEventListener('mousemove',e=>{if(!edPaint)return;const[x,y]=edTile(e);edApply(x,y,edPaint.erase,false)});
addEventListener('mouseup',()=>{if(edPaint){edPaint=null;if(ED)edUI()}});
$('eSave').onclick=edSave;$('ePlay').onclick=edPlay;$('eBack').onclick=closeEditor;$('eRandom').onclick=edRandom;
$('eClear').onclick=()=>{edNew(ED.size,ED.theme);edUI();edDraw();edMsg('Map cleared')};
$('eName').addEventListener('input',()=>{ED.name=$('eName').value});
