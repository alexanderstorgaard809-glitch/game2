// =====================================================================
// RENDER: three.js scene, 3D models, overlay and minimap
// =====================================================================
const view=$('view'),ui=$('ui'),uctx=ui.getContext('2d'),mini=$('mini'),mctx=mini.getContext('2d');
let W=0,H=0,VH=0;
const renderer=new THREE.WebGLRenderer({canvas:view,antialias:true});
renderer.setPixelRatio(Math.min(2,devicePixelRatio||1));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x0b0812);scene.fog=new THREE.Fog(0x0b0812,1400,3200);
const camera=new THREE.PerspectiveCamera(45,1,10,6000);
const hemi=new THREE.HemisphereLight(0xfff0dd,0x4a2c1a,0.75);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffe8cc,1.6);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera,{left:-900,right:900,top:900,bottom:-900,near:10,far:2500});sun.shadow.bias=-0.0008;sun.shadow.normalBias=1.5;
scene.add(sun);scene.add(sun.target);
const cam={x:0,y:0,dist:760,yaw:0.7,pitch:0.92};
function resize(){W=innerWidth;H=innerHeight;VH=Math.max(100,H-HUDH);renderer.setSize(W,VH);ui.width=W;ui.height=VH;camera.aspect=W/VH;camera.updateProjectionMatrix()}
addEventListener('resize',resize);resize();
function applyTheme(){scene.background.set(theme.bg);scene.fog.color.set(theme.bg);hemi.color.set(theme.hemi[0]);hemi.groundColor.set(theme.hemi[1]);sun.color.set(theme.sun)}
function buildTerrainMesh(){
  const geo=new THREE.BufferGeometry(),pos=new Float32Array(HN*HN*3),uv=new Float32Array(HN*HN*2),ind=[];
  for(let j=0;j<HN;j++)for(let i=0;i<HN;i++){const k=j*HN+i;pos[k*3]=i*HSTEP;pos[k*3+1]=hv[k];pos[k*3+2]=j*HSTEP;uv[k*2]=i/(HN-1);uv[k*2+1]=1-j/(HN-1)}
  for(let j=0;j<HN-1;j++)for(let i=0;i<HN-1;i++){const a=j*HN+i,b=a+HN,c=a+1,d=b+1;ind.push(a,b,c,b,d,c)}
  geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));geo.setIndex(ind);geo.computeVertexNormals();
  const tex=new THREE.CanvasTexture(terrainCv);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=renderer.capabilities.getMaxAnisotropy();
  const m=new THREE.Mesh(geo,new THREE.MeshLambertMaterial({map:tex}));m.receiveShadow=true;m.castShadow=true;return m;
}

// ---------- MATERIALS & GEOMETRY HELPERS ----------
const L=(c,o)=>new THREE.MeshLambertMaterial(Object.assign({color:c},o||{}));
const MAT={steel:L(0x8d949c),steelL:L(0xb9bfc7),steelD:L(0x55595e),black:L(0x1d1d1d),track:L(0x2a2826),yellow:L(0xe0b020),red:L(0x7a2a22),redC:L(0xd02020),green:L(0x30c050),concrete:L(0x7b7666),glass:L(0x5a90b0),oil:L(0x0d0a08),white:L(0xdddddd)};
const TMAT=TEAM.map(t=>({main:L(t.main),light:L(t.light),dark:L(t.dark)}));
const GLOW_MAT=new THREE.MeshBasicMaterial({color:0x60d0ff});
function canvasTex(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'));const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t}
MAT.stripe=new THREE.MeshLambertMaterial({map:canvasTex(128,8,g=>{for(let i=0;i<16;i++){g.fillStyle=i%2?'#eeeeee':'#1a1a1a';g.fillRect(i*8,0,8,8)}})});
const letterTex=(ch,bg)=>canvasTex(64,64,g=>{g.fillStyle=bg;g.fillRect(0,0,64,64);g.fillStyle='#fff';g.font='bold 46px Verdana';g.textAlign='center';g.textBaseline='middle';g.fillText(ch,32,35)});
const FMAT=TEAM.map(t=>new THREE.MeshLambertMaterial({map:letterTex('F','#'+t.main.toString(16).padStart(6,'0'))}));
const HMAT=new THREE.MeshLambertMaterial({map:letterTex('H','#2a2a2a')});
const GEO={};
function geo(key,fn){return GEO[key]||(GEO[key]=fn())}
function mesh(g,m,x=0,y=0,z=0){const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;return o}
const box=(w,h,d,m,x,y,z)=>mesh(geo('b'+w+'_'+h+'_'+d,()=>new THREE.BoxGeometry(w,h,d)),m,x,y,z);
const cyl=(rt,rb,h,s,m,x,y,z)=>mesh(geo('c'+rt+'_'+rb+'_'+h+'_'+s,()=>new THREE.CylinderGeometry(rt,rb,h,s)),m,x,y,z);
const sph=(r,m,x,y,z,ph=Math.PI)=>mesh(geo('s'+r+'_'+ph,()=>new THREE.SphereGeometry(r,16,10,0,Math.PI*2,0,ph)),m,x,y,z);
function barrel(r,len,m,x,y,z=0){const b=cyl(r,r,len,8,m,x+len/2,y,z);b.rotation.z=Math.PI/2;return b}
function wheel(r,w,x,y,z,m){const o=cyl(r,r,w,10,m||MAT.black,x,y,z);o.rotation.x=Math.PI/2;return o}

// ---------- UNIT MODELS (composed from body + propulsion + weapon) ----------
function makeUnitModel(d,team){
  const T=TMAT[team],g=new THREE.Group(),tur=new THREE.Group();
  const s=BODIES[d.body].size,Lb=Math.round(22*s),Wd=Math.round(12*s),Hb=Math.round(6*s),air=d.prop==='vtol';
  let py=0;
  if(d.prop==='wheels'){const wr=3.5+s;for(const x of[-Lb*.32,Lb*.32])for(const z of[-1,1])g.add(wheel(wr,3.5,x,wr,z*(Wd/2+1.5)));py=wr+1.5}
  else if(d.prop==='half'){const wr=3.5+s;for(const z of[-1,1]){g.add(wheel(wr,3.5,Lb*.32,wr,z*(Wd/2+1.5)));g.add(box(Math.round(Lb*.55),Math.round(wr*2),4,MAT.track,-Lb*.18,wr,z*(Wd/2+1.5)))}py=wr+1.5}
  else if(d.prop==='tracks'){const th=Math.round(4+3*s),tw=Math.round(4+2*s);for(const z of[-1,1]){g.add(box(Lb+2,th,tw,MAT.track,0,th/2,z*(Wd/2+1)));for(let i=0;i<4;i++)g.add(wheel(th*.4,tw+1,-Lb/2+3+i*(Lb-4)/3,th/2,z*(Wd/2+1),MAT.steelD))}py=th}
  else if(d.prop==='hover'){g.add(box(Lb+4,4,Wd+6,MAT.black,0,3,0));const gl=mesh(geo('hg'+Lb,()=>new THREE.BoxGeometry(Lb+2,1,Wd+4)),GLOW_MAT,0,.6,0);gl.castShadow=false;g.add(gl);py=5}
  else{g.add(box(Math.round(Lb*.45),1.5,Math.round(Wd*2.8),T.dark,-2,Hb*.5,0));
    for(const z of[-1,1]){const e=cyl(2.2,2.6,Math.round(Lb*.5),8,MAT.steelD,-3,Hb*.3,z*Wd*.8);e.rotation.z=Math.PI/2;g.add(e)}
    g.add(box(6,Hb+4,1.5,T.dark,-Lb*.5,Hb,0))}
  if(air){g.add(box(Math.round(Lb*1.1),Math.round(Hb*.9),Math.round(Wd*.6),T.main,0,Hb*.5,0));g.add(box(6,3,Math.round(Wd*.45),MAT.glass,Lb*.4,Hb,0))}
  else{g.add(box(Lb,Hb,Wd,T.main,0,py+Hb/2,0));const gl=box(Math.round(5*s),Math.round(Hb*.8),Wd-1,T.dark,Lb/2-1,py+Hb*.55,0);gl.rotation.z=-.5;g.add(gl);
    if(d.body!=='viper')for(const z of[-1,1])g.add(box(Lb-6,Math.round(Hb*.7),1.5,T.dark,-1,py+Hb*.5,z*(Wd/2+.6)));
    if(d.body==='python'){g.add(box(Math.round(Lb*.5),2,Wd-4,T.light,-Lb*.18,py+Hb+1,0));g.add(cyl(1.3,1.3,5,6,MAT.black,-Lb/2+3,py+Hb+2,Wd*.3))}}
  tur.position.set(air?Lb*.1:0,air?Hb:py+Hb,0);g.add(tur);
  const k=.85+.25*s;
  switch(d.weapon){
    case 'mg':tur.add(cyl(4*k,5*k,3,10,T.dark,0,1.5,0));if(d.body==='python'){tur.add(barrel(1,13*k,MAT.black,3,2,-1.5));tur.add(barrel(1,13*k,MAT.black,3,2,1.5))}else tur.add(barrel(1,13*k,MAT.black,3,2));break;
    case 'cannon':tur.add(box(Math.round(13*k),Math.round(5*k),Math.round(10*k),T.dark,-1,2.5*k,0));tur.add(barrel(1.8*k,Math.round(18*k),MAT.steelD,4,2.5*k));tur.add(box(4,4,4,MAT.black,4+Math.round(18*k),2.5*k,0));break;
    case 'lancer':tur.add(box(Math.round(11*k),Math.round(7*k),Math.round(10*k),T.dark,1,3.5*k,0));tur.add(box(2,Math.round(5*k),Math.round(8*k),T.light,-4.5*k,3.5*k,0));
      for(const[yy,zz]of[[2,-2.2],[2,2.2],[5,-2.2],[5,2.2]])tur.add(barrel(1.3,1,MAT.black,1+5.5*k,yy*k,zz*k));break;
    case 'mortar':{tur.add(cyl(5*k,6*k,3,10,T.dark,0,1.5,0));const t=cyl(2.2*k,2.4*k,Math.round(15*k),10,MAT.steelD,3,8*k,0);t.rotation.z=-.6;tur.add(t);break}
    case 'aa':tur.add(cyl(5*k,6*k,3,10,T.dark,0,1.5,0));tur.add(box(6,5,8,T.light,-2,4,0));for(const z of[-2.5,2.5]){const b=cyl(1.1,1.1,Math.round(15*k),6,MAT.black,3,8*k,z);b.rotation.z=-.8;tur.add(b)}break;
    case 'bomb':for(const z of[-1,1]){const b=cyl(2,2,9,8,MAT.steelD,-2,-1,z*Wd*.9);b.rotation.z=Math.PI/2;g.add(b)}break;
    case 'construct':{tur.add(cyl(2.5,2.5,3,8,MAT.yellow,0,1.5,0));const arm=box(Math.round(14*k),2.5,2.5,MAT.yellow,7*k,4,0);arm.rotation.z=.35;tur.add(arm);tur.add(box(2,6,2,MAT.steelD,13*k,5,0));break}
    case 'repair':tur.add(box(Math.round(9*k),Math.round(6*k),Math.round(9*k),MAT.white,0,3*k,0));tur.add(box(Math.round(7*k),1.5,2,MAT.redC,0,6*k+.8,0));tur.add(box(2,1.5,Math.round(7*k),MAT.redC,0,6*k+.8,0));break;
  }
  return{g,tur};
}
function pad(g,s){g.add(box(s-4,3,s-4,MAT.concrete,0,1.5,0));for(const[x,z,w,d]of[[0,-(s/2-4),s-6,2],[0,s/2-4,s-6,2],[-(s/2-4),0,2,s-6],[s/2-4,0,2,s-6]])g.add(box(w,1,d,MAT.yellow,x,3.3,z))}
function makeBuildingModel(type,team){
  const T=TMAT[team],g=new THREE.Group(),r={g};const s=BDEF[type].w*TILE;if(type!=='wall')pad(g,s);
  if(type==='hq'){
    g.add(cyl(52,54,14,8,MAT.red,0,10,0));g.add(cyl(46,46,9,32,MAT.stripe,0,21,0));
    g.add(cyl(34,38,34,8,MAT.steel,0,42,0));g.add(cyl(40,36,6,8,MAT.steelL,0,62,0));
    for(let k=0;k<4;k++){const a=k*Math.PI/2+Math.PI/4;g.add(box(9,24,9,MAT.steelD,Math.cos(a)*36,68,Math.sin(a)*36));g.add(cyl(1,1,22,6,MAT.black,Math.cos(a)*36,90,Math.sin(a)*36))}
    g.add(sph(14,T.main,0,65,0,Math.PI/2));
    const rad=new THREE.Group();rad.position.set(0,78,0);rad.add(cyl(2,2,14,8,MAT.steelD,0,0,0));const dish=sph(10,MAT.white,8,8,0,Math.PI/2.6);dish.rotation.z=Math.PI/2+.3;rad.add(dish);g.add(rad);r.spin=rad;
  }else if(type==='factory'){
    g.add(box(72,42,94,MAT.steel,-14,24,0));g.add(box(74,4,96,MAT.steelL,-14,46,0));
    for(let i=0;i<4;i++)g.add(box(60,2,3,MAT.steelD,-14,48,-33+i*22));
    g.add(box(32,38,64,MAT.steelD,34,22,0));g.add(box(2,30,48,MAT.black,50.5,19,0));
    g.add(cyl(12,12,56,16,MAT.steelL,-36,31,-30));g.add(cyl(13,13,4,16,MAT.steelD,-36,60,-30));
    g.add(cyl(8,9,66,12,MAT.steelD,20,36,-38));g.add(cyl(6,6,2,12,MAT.black,20,70,-38));
    g.add(box(2,22,22,FMAT[team],22.2,26,30));g.add(box(20,6,94,T.main,-14,8,0));
    r.smoke=[20,74,-38];
  }else if(type==='research'){
    g.add(box(66,22,66,MAT.steel,0,14,0));g.add(box(70,3,70,MAT.steelL,0,26,0));
    g.add(sph(26,MAT.white,0,27,0,Math.PI/2));
    const orb=mesh(geo('orb',()=>new THREE.SphereGeometry(7,16,10)),new THREE.MeshBasicMaterial({color:0x60e0ff}),0,58,0);orb.castShadow=false;g.add(orb);g.add(cyl(1.5,1.5,10,6,MAT.steelD,0,50,0));r.orb=orb;
    const ring=mesh(geo('torus',()=>new THREE.TorusGeometry(31,2,8,32)),T.light,0,34,0);ring.rotation.x=Math.PI/2;g.add(ring);r.ring=ring;
    g.add(box(20,8,6,T.main,-20,10,34));
  }else if(type==='derrick'){
    g.add(cyl(10,11,6,12,MAT.oil,0,4,0));
    for(const[x,z]of[[-11,-11],[11,-11],[-11,11],[11,11]]){const l=cyl(1,1,48,5,MAT.steelL,x*.55,26,z*.55);l.rotation.z=x>0?.24:-.24;l.rotation.x=z>0?-.24:.24;g.add(l)}
    for(let i=1;i<4;i++)g.add(box(22-i*5,1,22-i*5,MAT.steelL,0,i*11,0));
    const arm=new THREE.Group();arm.position.set(0,48,0);arm.add(box(36,4,4,MAT.yellow,0,0,0));arm.add(box(6,10,6,MAT.steelD,-18,-2,0));arm.add(box(4,8,5,MAT.black,17,-4,0));g.add(arm);r.arm=arm;
    g.add(cyl(5,5,12,10,T.main,13,8,13));
  }else if(type==='wall'){
    g.add(box(40,24,40,MAT.concrete,0,12,0));g.add(box(42,4,42,MAT.steel,0,26,0));g.add(box(41,3,41,T.dark,0,6,0));
  }else if(type==='tower'){
    g.add(cyl(15,17,16,10,MAT.steelD,0,11,0));g.add(cyl(13,13,4,10,MAT.steel,0,21,0));
    const tur=new THREE.Group();tur.position.set(0,26,0);tur.add(sph(8,T.dark,0,-2,0,Math.PI/2));tur.add(barrel(1.3,20,MAT.black,4,1));tur.add(box(4,3,4,T.light,-3,4,0));g.add(tur);r.tur=tur;
  }else if(type==='bunker'){
    g.add(box(34,14,34,MAT.concrete,0,8,0));g.add(box(36,4,36,MAT.steelD,0,16,0));g.add(box(8,2,8,T.main,0,19,0));
    const tur=new THREE.Group();tur.position.set(0,10,0);tur.add(barrel(1.2,22,MAT.black,6,0));g.add(tur);r.tur=tur;
  }else if(type==='hardpoint'){
    g.add(box(36,28,36,MAT.steel,0,15,0));g.add(box(38,4,38,MAT.steelD,0,30,0));g.add(box(37,4,37,T.dark,0,6,0));
    const tur=new THREE.Group();tur.position.set(0,35,0);tur.add(box(18,8,16,T.dark,0,0,0));tur.add(barrel(2.2,26,MAT.steelD,8,0));tur.add(box(5,5,5,MAT.black,34,0,0));g.add(tur);r.tur=tur;
  }else if(type==='mortarPit'){
    const ring=mesh(geo('pitring',()=>new THREE.TorusGeometry(14,4,6,16)),MAT.concrete,0,5,0);ring.rotation.x=Math.PI/2;g.add(ring);g.add(cyl(12,12,2,12,MAT.black,0,3,0));
    const tur=new THREE.Group();tur.position.set(0,4,0);tur.add(cyl(5,6,3,10,T.dark,0,1,0));const tube=cyl(2.6,2.8,18,10,MAT.steelD,4,9,0);tube.rotation.z=-.6;tur.add(tube);g.add(tur);r.tur=tur;
  }else if(type==='aaSite'){
    g.add(cyl(14,16,8,10,MAT.steelD,0,6,0));
    const tur=new THREE.Group();tur.position.set(0,12,0);tur.add(box(12,7,12,T.dark,0,2,0));for(const z of[-3,3]){const b=cyl(1.3,1.3,20,6,MAT.black,6,11,z);b.rotation.z=-.85;tur.add(b)}g.add(tur);r.tur=tur;
  }else if(type==='repairFac'){
    for(const[x,z]of[[-26,-26],[26,-26],[-26,26],[26,26]])g.add(box(4,34,4,MAT.steel,x,19,z));g.add(box(56,3,4,MAT.steelL,0,36,-26));g.add(box(56,3,4,MAT.steelL,0,36,26));
    const arm=new THREE.Group();arm.position.set(0,36,0);arm.add(box(4,3,54,MAT.yellow,0,0,0));arm.add(box(3,10,3,MAT.steelD,0,-6,0));g.add(arm);r.spin=arm;
    g.add(box(18,1.5,5,MAT.green,0,3.8,0));g.add(box(5,1.5,18,MAT.green,0,3.8,0));g.add(box(8,6,8,T.main,-26,6,-26));
  }else if(type==='vtolPad'){
    g.add(cyl(17,18,3,16,MAT.steelD,0,3.5,0));g.add(box(16,.6,16,HMAT,0,5.3,0));
    for(const[x,z]of[[-15,-15],[15,-15],[-15,15],[15,15]]){const l=mesh(geo('padl',()=>new THREE.SphereGeometry(1.5,8,6)),GLOW_MAT,x,4,z);l.castShadow=false;g.add(l)}
  }
  return r;
}

// ---------- SCENE SYNC ----------
const DECAL_GEO=new THREE.CircleGeometry(1,20);
const DECAL_MAT=new THREE.MeshBasicMaterial({map:canvasTex(64,64,g=>{const gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(15,8,4,.85)');gr.addColorStop(.6,'rgba(25,14,6,.5)');gr.addColorStop(1,'rgba(25,14,6,0)');g.fillStyle=gr;g.fillRect(0,0,64,64)}),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});
const PROJ_GEO={mg:new THREE.BoxGeometry(12,1.2,1.2),rocket:new THREE.BoxGeometry(9,2.2,2.2),cannon:new THREE.SphereGeometry(2.6,8,6),mortar:new THREE.SphereGeometry(3,8,6),flak:new THREE.SphereGeometry(1.8,6,4),bomb:new THREE.CapsuleGeometry?new THREE.CapsuleGeometry(2,5,4,8):new THREE.SphereGeometry(3,8,6)};
const PROJ_MAT={mg:new THREE.MeshBasicMaterial({color:0xfff2a0}),rocket:new THREE.MeshBasicMaterial({color:0xffe0a0}),cannon:new THREE.MeshBasicMaterial({color:0xffc060}),mortar:new THREE.MeshBasicMaterial({color:0xffb050}),flak:new THREE.MeshBasicMaterial({color:0xffe080}),bomb:L(0x333333)};
function makeProjMesh(p){const m=new THREE.Mesh(PROJ_GEO[p],PROJ_MAT[p]);if(p==='bomb')m.rotation.z=Math.PI/2;return m}
const GLOW_TEX=canvasTex(32,32,g=>{const gr=g.createRadialGradient(16,16,0,16,16,16);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,32,32)});
const FLAME_MAT=new THREE.SpriteMaterial({color:0xff9a30,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,map:GLOW_TEX});
const meshes=new Map();
const BOOMS=[];for(let i=0;i<40;i++){const m=new THREE.Mesh(new THREE.SphereGeometry(1,14,10),new THREE.MeshBasicMaterial({color:0xffa040,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));m.visible=false;scene.add(m);BOOMS.push(m)}
function makePoints(n,additive,size){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(n*3),3));g.setAttribute('color',new THREE.BufferAttribute(new Float32Array(n*3),3));
  const p=new THREE.Points(g,new THREE.PointsMaterial({size,vertexColors:true,transparent:true,opacity:additive?1:.5,depthWrite:false,blending:additive?THREE.AdditiveBlending:THREE.NormalBlending,map:GLOW_TEX}));p.frustumCulled=false;scene.add(p);return p}
const FIREP=makePoints(3000,true,9),SMOKEP=makePoints(3000,false,18);
let ghost=null,ghostType=null,wallGhosts=[];
const GHOST_OK=new THREE.MeshBasicMaterial({color:0x60ff60,transparent:true,opacity:.45,depthWrite:false}),GHOST_BAD=new THREE.MeshBasicMaterial({color:0xff4040,transparent:true,opacity:.45,depthWrite:false});

function syncScene(rt){
  if(fogTex){const d=fogTex.image.data;for(let ty=0;ty<MH;ty++)for(let tx=0;tx<MW;tx++){const i=idx(tx,ty),tg=visible[i]?0:explored[i]?150:238;fogCur[i]+=(tg-fogCur[i])*.15;const o=((MH-1-ty)*MW+tx)*4;d[o]=d[o+1]=d[o+2]=fogCur[i];d[o+3]=255}fogTex.needsUpdate=true}
  for(const e of ents){if(e.hp<=0)continue;let m=meshes.get(e.id);
    if(!m){m=e.kind==='u'?makeUnitModel(e.d,e.team):makeBuildingModel(e.type,e.team);world.add(m.g);meshes.set(e.id,m);if(e.kind==='b')m.g.position.set(e.x,heightAt(e.x,e.y),e.y)}
    m.g.visible=shown(e);
    if(e.kind==='u'){m.g.position.set(e.x,heightAt(e.x,e.y)+(e.h||0),e.y);m.g.rotation.y=-e.angle;m.tur.rotation.y=-(e.turret-e.angle);if(e.stranded)m.g.visible=true}
    else{m.g.scale.y=e.built<1?.08+.92*e.built:1;
      if(m.spin)m.spin.rotation.y=rt*1.4;if(m.ring)m.ring.rotation.z=rt*(e.res?3:.8);if(m.arm)m.arm.rotation.z=Math.sin(rt*2.5+e.id)*.35;if(m.tur)m.tur.rotation.y=-e.turret;
      if(m.orb)m.orb.scale.setScalar(1+.25*Math.sin(rt*(e.res?9:2)));
      if(m.smoke&&e.queue.length&&e.built>=1&&!paused&&R()<.3)fx.push({t:'p',k:'smoke',x:e.x+m.smoke[0],y:e.y+m.smoke[2],h:heightAt(e.x,e.y)+m.smoke[1],vx:(R()-.5)*10,vy:(R()-.5)*10,vh:30,life:1.5,max:1.6})}}
  for(const[id,m]of meshes)if(!byId.has(id)){world.remove(m.g);meshes.delete(id)}
  for(const o of oils){const ob=o.bid&&byId.get(o.bid),ov=!ob||!shown(ob);o.mesh.visible=ov;o.flame.visible=ov&&explored[idx(o.tx,o.ty)]===1;const f=.7+.3*Math.sin(rt*9+o.x);o.flame.scale.set(14*f,22*f,1)}
  for(const p of projs)if(p.mesh){const tot=Math.hypot(p.tx-p.x,p.ty-p.y),gnd=heightAt(p.x,p.y);let hh;
    if(p.proj==='mortar'){const k=1-tot/p.d0;hh=gnd+p.h*(1-k)+Math.sin(k*Math.PI)*p.d0*.4}
    else if(p.proj==='bomb'){const k=1-tot/p.d0;hh=gnd+p.h*(1-k)}
    else{const t=p.tid?byId.get(p.tid):null,th=(p.th||0)+(t&&t.kind==='b'?25:10);hh=gnd+th+(p.h-th)*Math.min(1,tot/200)}
    p.hh=hh;p.mesh.position.set(p.x,hh,p.y);if(p.proj!=='bomb')p.mesh.rotation.y=-Math.atan2(p.ty-p.y,p.tx-p.x);const ptx=tileOf(p.x),pty=tileOf(p.y);p.mesh.visible=inb(ptx,pty)&&visible[idx(ptx,pty)]===1}
  let bi=0;
  for(const f of fx){if((f.t==='boom'||f.t==='flash')&&bi<BOOMS.length){const b=BOOMS[bi++],k=f.life/f.max;b.visible=true;b.position.set(f.x,f.t==='flash'?heightAt(f.x,f.y)+f.h:f.h,f.y);b.scale.setScalar(f.t==='boom'?f.size*(1.6-k):f.size);b.material.opacity=f.t==='boom'?k*.9:1;b.material.color.setRGB(1,.4+.5*k,.15*k)}}
  for(;bi<BOOMS.length;bi++)BOOMS[bi].visible=false;
  const fp=FIREP.geometry.attributes.position.array,fc=FIREP.geometry.attributes.color.array,sp=SMOKEP.geometry.attributes.position.array,sc=SMOKEP.geometry.attributes.color.array;let nf=0,ns=0;
  for(const f of fx){if(f.t!=='p')continue;const k=Math.max(0,f.life/f.max);
    if(f.k==='fire'&&nf<3000){fp[nf*3]=f.x;fp[nf*3+1]=f.h;fp[nf*3+2]=f.y;fc[nf*3]=k*1.6;fc[nf*3+1]=k*k*1.1;fc[nf*3+2]=k*k*.3;nf++}
    else if(f.k==='smoke'&&ns<3000){sp[ns*3]=f.x;sp[ns*3+1]=f.h;sp[ns*3+2]=f.y;const c=.18+.25*(1-k);sc[ns*3]=c;sc[ns*3+1]=c;sc[ns*3+2]=c;ns++}}
  FIREP.geometry.setDrawRange(0,nf);FIREP.geometry.attributes.position.needsUpdate=FIREP.geometry.attributes.color.needsUpdate=true;
  SMOKEP.geometry.setDrawRange(0,ns);SMOKEP.geometry.attributes.position.needsUpdate=SMOKEP.geometry.attributes.color.needsUpdate=true;
  const line=placing&&placing.type==='wall'&&placing.start&&mouse.world?wallLine(placing.start,[tileOf(mouse.world.x),tileOf(mouse.world.y)]):[];
  while(wallGhosts.length<line.length){const g=makeBuildingModel('wall',0).g;g.traverse(o=>{if(o.isMesh)o.castShadow=false});scene.add(g);wallGhosts.push(g)}
  wallGhosts.forEach((g,i)=>{if(i<line.length){const[tx,ty]=line[i],x=(tx+.5)*TILE,y=(ty+.5)*TILE,ok=canPlace('wall',tx,ty);g.visible=true;g.position.set(x,heightAt(x,y),y);g.traverse(o=>{if(o.isMesh)o.material=ok?GHOST_OK:GHOST_BAD})}else g.visible=false});
  if(placing&&mouse.world&&!placing.start){
    if(ghostType!==placing.type){if(ghost)scene.remove(ghost);ghost=makeBuildingModel(placing.type,0).g;ghostType=placing.type;scene.add(ghost)}
    const d=BDEF[placing.type],tx=Math.round(mouse.world.x/TILE-d.w/2),ty=Math.round(mouse.world.y/TILE-d.h/2),ok=canPlace(placing.type,tx,ty)&&power[0]>=d.cost;
    const x=(tx+d.w/2)*TILE,y=(ty+d.h/2)*TILE;ghost.position.set(x,heightAt(x,y),y);
    ghost.traverse(o=>{if(o.isMesh){o.material=ok?GHOST_OK:GHOST_BAD;o.castShadow=false}})}
  else if(ghost){scene.remove(ghost);ghost=null;ghostType=null}
}

// ---------- CAMERA ----------
function updateCamera(){
  cam.x=clamp(cam.x,0,WW);cam.y=clamp(cam.y,0,WH);cam.dist=clamp(cam.dist,280,1500);
  const th=heightAt(cam.x,cam.y)*.5,cp=Math.cos(cam.pitch)*cam.dist;
  camera.position.set(cam.x+Math.sin(cam.yaw)*cp,th+Math.sin(cam.pitch)*cam.dist,cam.y+Math.cos(cam.yaw)*cp);camera.lookAt(cam.x,th,cam.y);camera.updateMatrixWorld();
  sun.position.set(cam.x-500,900,cam.y-300);sun.target.position.set(cam.x,0,cam.y);
}
const ray=new THREE.Raycaster(),ndc=new THREE.Vector2(),tmpV=new THREE.Vector3();
function screenToWorld(sx,sy){ndc.set(sx/W*2-1,-(sy/VH)*2+1);ray.setFromCamera(ndc,camera);const o=ray.ray.origin,d=ray.ray.direction;if(d.y>=-1e-4)return null;
  let h=0,x=0,z=0;for(let k=0;k<5;k++){const t=(h-o.y)/d.y;x=o.x+d.x*t;z=o.z+d.z*t;h=heightAt(x,z)}return{x,y:z}}
function worldToScreen(x,h,y){tmpV.set(x,h,y).project(camera);return{x:(tmpV.x+1)/2*W,y:(1-tmpV.y)/2*VH,z:tmpV.z}}
function pxPerUnit(x,h,y){const d=camera.position.distanceTo(tmpV.set(x,h,y));return VH/(2*Math.tan(camera.fov*Math.PI/360)*d)}
const entH=e=>heightAt(e.x,e.y)+(e.h||0)+(e.kind==='b'?20:8);

// ---------- OVERLAY ----------
function hpBar(x,y,w,f,c){uctx.fillStyle='rgba(0,0,0,.7)';uctx.fillRect(x-w/2-1,y-1,w+2,5);uctx.fillStyle=c||(f>.5?'#5f5':f>.25?'#ee4':'#f44');uctx.fillRect(x-w/2,y,w*f,3)}
function brackets(x,y,r,c){uctx.strokeStyle=c;uctx.lineWidth=2;const k=r*.45;uctx.beginPath();
  for(const[sx,sy]of[[-1,-1],[1,-1],[-1,1],[1,1]]){uctx.moveTo(x+sx*r,y+sy*(r-k));uctx.lineTo(x+sx*r,y+sy*r);uctx.lineTo(x+sx*(r-k),y+sy*r)}uctx.stroke()}
function chevrons(x,y,n){uctx.strokeStyle='#ffd23a';uctx.lineWidth=2;for(let i=0;i<n;i++){const yy=y-i*4;uctx.beginPath();uctx.moveTo(x-4,yy-2);uctx.lineTo(x,yy+1);uctx.lineTo(x+4,yy-2);uctx.stroke()}}
function drawOverlay(rt){
  uctx.clearRect(0,0,W,VH);if(!world)return;
  const grp={};for(const k in groups)for(const id of groups[k])grp[id]=k;
  uctx.font='bold 11px Verdana';uctx.textAlign='center';
  for(const e of ents){if(e.hp<=0||!shown(e))continue;
    if(e.healT){const t=byId.get(e.healT);if(t){const a=worldToScreen(e.x,entH(e),e.y),b=worldToScreen(t.x,entH(t),t.y);uctx.strokeStyle=isTruck(e)?'rgba(255,220,90,.8)':'rgba(90,255,140,.85)';uctx.lineWidth=2;uctx.setLineDash([5,4]);uctx.lineDashOffset=-rt*30;uctx.beginPath();uctx.moveTo(a.x,a.y);uctx.lineTo(b.x,b.y);uctx.stroke();uctx.setLineDash([])}}
    const s=sel.includes(e),g=grp[e.id];
    if(!s&&!g&&e.hp>=e.maxHp&&!(e.kind==='b'&&e.built<1)&&!e.stranded)continue;
    const hh=entH(e),p=worldToScreen(e.x,hh,e.y);if(p.z>1||p.x<-50||p.x>W+50||p.y<-50||p.y>VH+50)continue;
    const r=(e.kind==='b'?e.w*TILE*.5:e.r+6)*pxPerUnit(e.x,hh,e.y);
    if(s)brackets(p.x,p.y,r,TEAM[e.team].css);
    if(g){uctx.fillStyle='#fff';uctx.fillText(g,p.x+r+6,p.y+r)}
    if(e.stranded){uctx.fillStyle='#ffe066';uctx.fillText('CONVOY',p.x,p.y-r-12)}
    if(s||e.hp<e.maxHp||(e.kind==='b'&&e.built<1)){const bw=Math.max(22,Math.min(70,r*1.6));hpBar(p.x,p.y-r-8,bw,e.hp/e.maxHp);
      if(e.kind==='b'&&e.built<1)hpBar(p.x,p.y-r-2,bw,e.built,'#fe8');
      if(e.kind==='u'&&e.st.air&&s)hpBar(p.x,p.y-r-2,bw,e.ammo/(VTOL_AMMO[e.d.weapon]||4),'#6cf');
      if(e.kind==='u'&&e.rank)chevrons(p.x-bw/2-8,p.y-r-5,e.rank)}
    if(s&&e.type==='factory'&&e.rally){const q=worldToScreen(e.rally.x,heightAt(e.rally.x,e.rally.y),e.rally.y);uctx.strokeStyle='rgba(140,255,140,.6)';uctx.setLineDash([4,4]);uctx.beginPath();uctx.moveTo(p.x,p.y);uctx.lineTo(q.x,q.y);uctx.stroke();uctx.setLineDash([]);uctx.fillStyle='#8f8';uctx.fillRect(q.x,q.y-18,12,8);uctx.fillRect(q.x-1,q.y-18,2,18)}}
  if(placing&&placing.type==='derrick')for(const o of oils)if(!o.bid){const p=worldToScreen(o.x,heightAt(o.x,o.y),o.y),r=(18+4*Math.sin(rt*5))*pxPerUnit(o.x,0,o.y);uctx.strokeStyle='rgba(255,230,100,.9)';uctx.lineWidth=2;uctx.beginPath();uctx.ellipse(p.x,p.y,r,r*.6,0,0,7);uctx.stroke()}
  for(const m of markers){const p=worldToScreen(m.x,heightAt(m.x,m.y),m.y),k=m.life/.5;uctx.strokeStyle=m.c;uctx.globalAlpha=k;uctx.lineWidth=2;uctx.beginPath();uctx.ellipse(p.x,p.y,18*k+4,(18*k+4)*.55,0,0,7);uctx.stroke();uctx.globalAlpha=1}
  if(drag&&drag.active){uctx.strokeStyle='#8f8';uctx.lineWidth=1;uctx.fillStyle='rgba(120,255,120,.1)';const x=Math.min(drag.x0,drag.x1),y=Math.min(drag.y0,drag.y1),w=Math.abs(drag.x1-drag.x0),h=Math.abs(drag.y1-drag.y0);uctx.fillRect(x,y,w,h);uctx.strokeRect(x+.5,y+.5,w,h)}
  if(paused&&state==='play'&&!uiOpen()){uctx.fillStyle='rgba(0,0,0,.4)';uctx.fillRect(0,0,W,VH);uctx.fillStyle='#fff';uctx.font='bold 36px Verdana';uctx.fillText('PAUSED',W/2,VH/2)}
}
function drawMinimap(){
  mctx.drawImage(miniBg,0,0);const k=154/WW;
  for(const o of oils)if(!o.bid){mctx.fillStyle='#000';mctx.fillRect(o.x*k-1.5,o.y*k-1.5,3,3)}
  for(const e of ents){if(!shown(e))continue;mctx.fillStyle=e.stranded?'#ffe066':TEAM[e.team].mini;if(e.kind==='b')mctx.fillRect(e.tx*TILE*k,e.ty*TILE*k,Math.max(3,e.w*TILE*k),Math.max(3,e.h*TILE*k));else mctx.fillRect(e.x*k-1,e.y*k-1,2.5,2.5)}
  if(!fogCv){fogCv=document.createElement('canvas');fogCv.width=MW;fogCv.height=MH}
  {const fg=fogCv.getContext('2d'),im=fg.createImageData(MW,MH);for(let i=0;i<MW*MH;i++)im.data[i*4+3]=fogCur[i]*.92;fg.putImageData(im,0,0);mctx.imageSmoothingEnabled=true;mctx.drawImage(fogCv,0,0,154,154)}
  const c=[[0,0],[W,0],[W,VH],[0,VH]].map(p=>screenToWorld(p[0],p[1])||(()=>{ndc.set(p[0]/W*2-1,-(p[1]/VH)*2+1);ray.setFromCamera(ndc,camera);const d=ray.ray.direction,o=ray.ray.origin;return{x:o.x+d.x*2500,y:o.z+d.z*2500}})());
  mctx.strokeStyle='#fff';mctx.lineWidth=1;mctx.beginPath();c.forEach((p,i)=>i?mctx.lineTo(p.x*k,p.y*k):mctx.moveTo(p.x*k,p.y*k));mctx.closePath();mctx.stroke();
}

// ---------- THUMBNAILS ----------
let TR=null;const THUMBS={};
function thumb(key,make,rotY){
  if(THUMBS[key])return THUMBS[key];
  if(!TR){const r=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});r.setSize(240,160);r.setPixelRatio(1);
    const s=new THREE.Scene();s.add(new THREE.HemisphereLight(0xffffff,0x444466,1.1));const dl=new THREE.DirectionalLight(0xffffff,1.6);dl.position.set(-1,2,1.5);s.add(dl);
    TR={r,s,c:new THREE.PerspectiveCamera(30,1.5,1,3000)}}
  const m=make();if(rotY)m.rotation.y=rotY;TR.s.add(m);
  const b=new THREE.Box3().setFromObject(m),c=b.getCenter(new THREE.Vector3()),sz=b.getSize(new THREE.Vector3()).length();
  TR.c.position.set(c.x+sz*.9,c.y+sz*.75,c.z+sz*.9);TR.c.lookAt(c);TR.r.render(TR.s,TR.c);THUMBS[key]=TR.r.domElement.toDataURL();TR.s.remove(m);return THUMBS[key];
}
const thumbUnit=d=>thumb('u:'+dkey(d),()=>makeUnitModel(d,0).g,.5);
const thumbB=t=>thumb('b:'+t,()=>makeBuildingModel(t,0).g);
