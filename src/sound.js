// =====================================================================
// SOUND: synthesized with Web Audio (no sound files needed)
// =====================================================================
const SFX={ctx:null,on:true,master:null,noise:null,last:{},lastSay:{}};
function audioInit(){if(SFX.ctx)return;try{const C=window.AudioContext||window.webkitAudioContext;const c=SFX.ctx=new C();SFX.master=c.createGain();SFX.master.gain.value=SFX.on?.55:0;SFX.master.connect(c.destination);
  const b=c.createBuffer(1,c.sampleRate*2,c.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;SFX.noise=b;
  const w=c.createBufferSource();w.buffer=b;w.loop=true;const f=c.createBiquadFilter();f.type='lowpass';f.frequency.value=320;const g=c.createGain();g.gain.value=.05;w.connect(f);f.connect(g);g.connect(SFX.master);w.start();
  const lfo=c.createOscillator(),lg=c.createGain();lfo.frequency.value=.13;lg.gain.value=160;lfo.connect(lg);lg.connect(f.frequency);lfo.start()}catch(e){SFX.ctx=null}}
function nz(t,dur,type,f0,f1,q,gain){const c=SFX.ctx,s=c.createBufferSource();s.buffer=SFX.noise;const f=c.createBiquadFilter();f.type=type;f.frequency.setValueAtTime(f0,t);f.frequency.exponentialRampToValueAtTime(f1,t+dur);f.Q.value=q;const g=c.createGain();g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);s.connect(f);f.connect(g);g.connect(SFX.master);s.start(t,Math.random()*1.5);s.stop(t+dur+.05)}
function tn(t,dur,type,f0,f1,gain){const c=SFX.ctx,o=c.createOscillator();o.type=type;o.frequency.setValueAtTime(f0,t);if(f1!==f0)o.frequency.exponentialRampToValueAtTime(f1,t+dur);const g=c.createGain();g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(gain,t+.01);g.gain.exponentialRampToValueAtTime(.001,t+dur);o.connect(g);g.connect(SFX.master);o.start(t);o.stop(t+dur+.05)}
const GAP={mg:.06,cannon:.08,rocket:.1,mortar:.12,flak:.08,bomb:.15,hit:.05,boom:.05,bigboom:.1};
function sfx(n,x,y){if(!SFX.ctx||!SFX.on)return;const c=SFX.ctx,t=c.currentTime;if(t-(SFX.last[n]||0)<(GAP[n]||.03))return;
  let v=1;if(x!==undefined){v=Math.max(0,1-Math.hypot(x-cam.x,y-cam.y)/1700)*Math.min(1,700/cam.dist);if(v<.03)return}
  SFX.last[n]=t;
  switch(n){
  case 'mg':nz(t,.07,'bandpass',2600,1400,.9,.5*v);tn(t,.03,'square',180,90,.08*v);break;
  case 'cannon':nz(t,.45,'lowpass',1600,120,.8,.9*v);tn(t,.35,'sine',140,40,.6*v);break;
  case 'rocket':nz(t,.5,'bandpass',700,3200,2,.45*v);tn(t,.3,'sawtooth',220,80,.05*v);break;
  case 'mortar':tn(t,.25,'sine',110,45,.7*v);nz(t,.2,'lowpass',900,150,.7,.5*v);break;
  case 'flak':nz(t,.12,'bandpass',900,400,1.2,.5*v);tn(t,.08,'square',120,60,.1*v);break;
  case 'bomb':tn(t,.6,'sine',1400,500,.08*v);break;
  case 'hit':nz(t,.25,'lowpass',1200,200,.7,.5*v);break;
  case 'boom':nz(t,.9,'lowpass',1400,70,.7,v);tn(t,.6,'sine',90,30,.7*v);break;
  case 'bigboom':nz(t,1.8,'lowpass',1800,50,.6,1.2*v);tn(t,1.2,'sine',70,25,.9*v);nz(t+.15,1.2,'lowpass',900,60,.6,.6*v);break;
  case 'click':tn(t,.05,'square',900,700,.08);break;
  case 'ack':tn(t,.06,'square',520,520,.07);tn(t+.07,.07,'square',780,780,.07);break;
  case 'place':tn(t,.15,'triangle',220,90,.35);nz(t,.12,'lowpass',800,200,.7,.3);break;
  case 'complete':[523,659,784].forEach((f,i)=>tn(t+i*.11,.18,'triangle',f,f,.25));break;
  case 'rankup':[784,988,1175].forEach((f,i)=>tn(t+i*.08,.12,'square',f,f,.08));break;
  case 'ready':tn(t,.09,'square',660,660,.1);tn(t+.1,.12,'square',990,990,.1);break;
  case 'deny':tn(t,.18,'square',200,150,.15);break;
  case 'alert':for(let i=0;i<3;i++){tn(t+i*.3,.14,'square',880,880,.12);tn(t+i*.3+.15,.14,'square',660,660,.12)}break;
  }}
function say(text){if(!SFX.on||!window.speechSynthesis)return;const now=performance.now();if(now-(SFX.lastSay[text]||0)<6000)return;SFX.lastSay[text]=now;
  try{const u=new SpeechSynthesisUtterance(text);u.lang='en-US';u.rate=1.05;u.pitch=.7;u.volume=.9;const v=speechSynthesis.getVoices().find(v=>/^en/i.test(v.lang));if(v)u.voice=v;speechSynthesis.speak(u)}catch(e){}}
function toggleSound(){SFX.on=!SFX.on;audioInit();if(SFX.master)SFX.master.gain.value=SFX.on?.55:0;if(!SFX.on&&window.speechSynthesis)speechSynthesis.cancel();$('snd').textContent='Sound: '+(SFX.on?'ON':'OFF')}
function deny(t){msg(t,1.5);sfx('deny')}
