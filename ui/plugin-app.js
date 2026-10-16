const $=id=>document.getElementById(id);
// ---- host (DAW) bridge: present when running inside the JUCE plugin ----
const HOST=(window.__JUCE__&&window.__JUCE__.backend)||null;
const toHost=(id,obj)=>{if(HOST)try{HOST.emitEvent(id,obj)}catch(e){}};
let LOW=36,HIGH=96,compact=false,pickKey={tonic:0,mode:'major'};const midiHeld=new Set();
let held=new Set(),latch=true,soundOn=true,octave=0;
let hist=Array(12).fill(0),rh={major:{},minor:{}};
let cur=null,prev=null,key=null,locked=null,selScale=0,preview=null,progression=[],mode='scale';

// ---- audio ----
let ac=null,master=null;const voices={};
function audio(){if(!ac){try{ac=new (window.AudioContext||window.webkitAudioContext)();master=ac.createGain();master.gain.value=0.32;master.connect(ac.destination)}catch(e){soundOn=false}}if(ac&&ac.state==='suspended')ac.resume();return ac}
function vOn(m){if(!soundOn||!audio())return;vOff(m,true);const f=440*2**((m-69)/12),t=ac.currentTime,g=ac.createGain();
 g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(0.2,t+0.008);g.gain.exponentialRampToValueAtTime(0.05,t+1.6);g.connect(master);
 const o1=ac.createOscillator(),o2=ac.createOscillator(),g2=ac.createGain();o1.type='sine';o1.frequency.value=f;o2.type='triangle';o2.frequency.value=f*2;g2.gain.value=0.12;
 o1.connect(g);o2.connect(g2);g2.connect(g);o1.start(t);o2.start(t);voices[m]={g,o:[o1,o2]}}
function vOff(m,now){const v=voices[m];if(!v||!ac)return;const t=ac.currentTime,r=now?0.02:0.35;
 v.g.gain.cancelScheduledValues(t);v.g.gain.setValueAtTime(v.g.gain.value,t);v.g.gain.linearRampToValueAtTime(0,t+r);v.o.forEach(o=>o.stop(t+r+0.02));delete voices[m]}

// ---- notes ----
let pending=null;
const clickHeld=new Set();
function press(m){if(held.has(m))return;held.add(m);vOn(m);schedule()}
function clickOn(m){clickHeld.add(m);press(m);toHost('uiNote',{note:m,on:true})}
function clickOff(m){clickHeld.delete(m);if(!midiHeld.has(m))release(m);toHost('uiNote',{note:m,on:false})}
function release(m){if(!held.has(m))return;held.delete(m);vOff(m);schedule()}
function releaseAll(){[...clickHeld].forEach(m=>toHost('uiNote',{note:m,on:false}));clickHeld.clear();[...held].forEach(m=>{held.delete(m);vOff(m)});schedule()}
function schedule(){clearTimeout(pending);pending=setTimeout(analyse,50)}

// ---- analysis ----
function sameChord(a,b){return a&&b&&a.root===b.root&&a.q===b.q&&a.bass===b.bass}
function currentKey(){return mode==='key'?{...pickKey,conf:'Chosen'}:locked?{...locked,conf:'Locked'}:key}
let lastNotes=new Set();
function analyse(){
 const notes=[...held],onlyReleased=notes.length<lastNotes.size&&notes.every(n=>lastNotes.has(n));lastNotes=new Set(notes);
 if(onlyReleased){render();return}
 const c=detectChords(notes)[0];
 if(c&&!sameChord(c,cur)){
  const building=cur&&cur.notes.length&&cur.notes.every(n=>notes.includes(n));
  if(!building)prev=cur;else progression.pop();
  cur={...c,notes,alts:detectChords(notes).slice(1)};selScale=0;
  hist=hist.map(x=>x*0.7);c.pcs.forEach(p=>hist[p]+=1);hist[c.bass]+=0.5;
  for(const m of ['major','minor'])for(const t in rh[m])rh[m][t]*=0.7;
  if(!isSus(c)&&!/^(7|9|13)/.test(c.q)){const m=/^m(?!aj)/.test(c.q)||c.q.startsWith('dim')?'minor':'major';rh[m][c.root]=(rh[m][c.root]||0)+1}
  key=estimateKey(hist,rh);
  progression.push({...c,label:chordName(c,prefersFlats(currentKey()))});if(progression.length>16)progression.shift();
 } else if(c&&cur){cur.notes=notes}
 render();
setTimeout(()=>toHost('ready',{}),0);
}

// ---- keyboard ----
const kb=$('kb');let keyEls={};
function buildKb(){
 kb.innerHTML='';keyEls={};kb.classList.toggle('compact',compact);
 const whites=[];for(let m=LOW;m<=HIGH;m++)if(![1,3,6,8,10].includes(m%12))whites.push(m);
 const w=100/whites.length;
 for(let m=LOW;m<=HIGH;m++){
  const black=[1,3,6,8,10].includes(m%12),el=document.createElement('div');
  el.className='key '+(black?'b':'w')+(m%12===0?' c':'');el.tabIndex=-1;
  el.innerHTML='<span class="bar"></span><span class="dot"></span><span class="nm"></span>'+(m%12===0&&!compact?'<span class="oct">C'+(m/12-2)+'</span>':'');
  if(black){const wi=whites.indexOf(m-1);el.style.left=`calc(${(wi+1)*w}% - ${w*0.32}%)`;el.style.width=w*0.64+'%'}
  else{const wi=whites.indexOf(m);el.style.left=wi*w+'%';el.style.width=w+'%'}
  el.addEventListener('pointerdown',e=>{e.preventDefault();audio();stopDemo();
   if(latch){clickHeld.has(m)?clickOff(m):clickOn(m)}else{clickOn(m);el.setPointerCapture(e.pointerId)}});
  el.addEventListener('pointerup',()=>{if(!latch)clickOff(m)});
  el.addEventListener('pointercancel',()=>{if(!latch)clickOff(m)});
  kb.appendChild(el);keyEls[m]=el;
 }
}
buildKb();
function setCompact(v){compact=v;LOW=compact?60:36;HIGH=compact?71:96;$('octBtn').setAttribute('aria-pressed',compact);buildKb()}
$('octBtn').onclick=()=>{setCompact(!compact);saveState();render()};

// ---- computer keyboard ----
const QW={a:0,w:1,s:2,e:3,d:4,f:5,t:6,g:7,y:8,h:9,u:10,j:11,k:12,o:13,l:14,p:15,';':16};
const qwHeld={};
document.addEventListener('keydown',e=>{
 if(e.repeat||e.metaKey||e.ctrlKey||e.target.tagName==='SELECT')return;const k=e.key.toLowerCase();
 if(k==='z'){octave=Math.max(-1,octave-1);return}if(k==='x'){octave=Math.min(1,octave+1);return}
 if(k in QW){audio();stopDemo();const m=60+12*octave+QW[k];qwHeld[k]=m;clickOn(m)}});
document.addEventListener('keyup',e=>{const k=e.key.toLowerCase();if(k in qwHeld){clickOff(qwHeld[k]);delete qwHeld[k]}});

// ---- incoming MIDI ----
function midiNote(d,on){if(on){midiHeld.add(d);press(d)}else{midiHeld.delete(d);if(!clickHeld.has(d))release(d)}schedule()}
function midiMsg(ev){const [st,d,v]=ev.data,t=st&0xf0;
 if(t===0x90&&v>0)midiNote(d,true);else if(t===0x80||(t===0x90&&v===0))midiNote(d,false);
 else if(t===0xB0&&(d===123||d===120))[...midiHeld].forEach(n=>midiNote(n,false))}
function setStatus(t,on){$('hostStatus').textContent=t;$('hostStatus').classList.toggle('on',!!on)}
function connectMidi(){
 if(!navigator.requestMIDIAccess){setStatus('No Web MIDI');return}
 navigator.requestMIDIAccess().then(acc=>{const hook=()=>{const n=[];acc.inputs.forEach(i=>{i.onmidimessage=midiMsg;n.push(i.name)});
  setStatus(n.length?'MIDI: '+n.join(', '):'Preview · no MIDI',n.length>0)};hook();acc.onstatechange=hook}).catch(()=>setStatus('MIDI blocked'));
}
if(HOST){
 document.querySelectorAll('.preview-only').forEach(e=>e.hidden=true);soundOn=false;
 setStatus('Live in DAW',true);
 // the plugin sends the full set of notes it is hearing ~30 times a second, only when it changes
 HOST.addEventListener('notes',ev=>{const now=new Set((ev&&ev.held)||[]);
  [...midiHeld].forEach(n=>{if(!now.has(n))midiNote(n,false)});now.forEach(n=>{if(!midiHeld.has(n))midiNote(n,true)})});
 HOST.addEventListener('state',ev=>{if(ev&&typeof ev==='object')restoreState(ev)});
} else {$('midiBtn').onclick=connectMidi;connectMidi();}

// ---- controls ----
$('soundBtn').onclick=e=>{audio();soundOn=!soundOn;e.target.setAttribute('aria-pressed',soundOn);if(!soundOn)Object.keys(voices).forEach(m=>vOff(+m,true))};
$('latchBtn').onclick=e=>{latch=!latch;e.target.setAttribute('aria-pressed',latch);saveState();releaseAll()};
$('clearBtn').onclick=()=>{stopDemo();midiHeld.clear();releaseAll();cur=null;prev=null;preview=null;hist=Array(12).fill(0);rh={major:{},minor:{}};key=null;locked=null;lock.value='';progression=[];render();toHost('uiState',stateObj())};
const lock=$('lock');
lock.innerHTML='<option value="">Auto-detect</option>'+[...Array(12).keys()].map(t=>`<option value="${t}-major">${MAJ_NAME[t]} major</option>`).join('')+[...Array(12).keys()].map(t=>`<option value="${t}-minor">${MIN_NAME[t]} minor</option>`).join('');
lock.onchange=()=>{const v=lock.value;locked=v?{tonic:+v.split('-')[0],mode:v.split('-')[1]}:null;preview=null;saveState();render()};
function lockTo(k){if(mode==='key'){pickKey=k;$('keyPick').value=k.tonic+'-'+k.mode}else{locked=k;lock.value=k.tonic+'-'+k.mode}preview=null;saveState();render()}
$('keyPick').innerHTML=lock.innerHTML.replace('<option value="">Auto-detect</option>','');
$('keyPick').onchange=()=>{const v=$('keyPick').value.split('-');pickKey={tonic:+v[0],mode:v[1]};preview=null;saveState();render()};
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;preview=null;saveState();render()});
// ---- saved settings (stored inside the DAW project) ----
function stateObj(){return{mode,pickKey,locked,compact,latch}}
function saveState(){toHost('uiState',stateObj())}
function restoreState(st){
 if(['scale','key','flow'].includes(st.mode))mode=st.mode;
 if(st.pickKey&&st.pickKey.mode){pickKey={tonic:+st.pickKey.tonic%12,mode:st.pickKey.mode};$('keyPick').value=pickKey.tonic+'-'+pickKey.mode}
 locked=st.locked&&st.locked.mode?{tonic:+st.locked.tonic%12,mode:st.locked.mode}:null;lock.value=locked?locked.tonic+'-'+locked.mode:'';
 if(typeof st.latch==='boolean'){latch=st.latch;$('latchBtn').setAttribute('aria-pressed',latch)}
 if(typeof st.compact==='boolean'&&st.compact!==compact)setCompact(st.compact);
 render();
setTimeout(()=>toHost('ready',{}),0);
}

// ---- demo ----
const DEMO=[['Verse',[58,62,65,68,71]],['Verse',[58,62,66,68]],['Verse',[51,58,61,65,66]],['Verse',[56,61,66,70,65]],['Verse',[54,59,64,68,63]],
 ['Bridge',[57,61,64,68,71]],['Bridge',[52,57,61,62,66]],['Bridge',[50,55,60,64,59]],['Bridge',[55,59,62,66,69]]];
let demoIdx=-1,demoTimer=null;
function demoStep(){audio();demoIdx=(demoIdx+1)%DEMO.length;[...clickHeld].forEach(clickOff);
 DEMO[demoIdx][1].forEach(n=>{if(compact)n=60+n%12;clickOn(n)});$('stepDemo').textContent=`Demo ${demoIdx+1}/${DEMO.length}`}
function stopDemo(){}
$('stepDemo').onclick=demoStep;

// ---- circle of fifths ----
const svg=$('circle'),segs=[];
(function buildCircle(){
 const arc=(r1,r2,a1,a2)=>{const p=(r,a)=>[r*Math.cos(a),r*Math.sin(a)].map(x=>x.toFixed(2)).join(' ');
  return `M${p(r2,a1)} A${r2} ${r2} 0 0 1 ${p(r2,a2)} L${p(r1,a2)} A${r1} ${r1} 0 0 0 ${p(r1,a1)} Z`};
 let h='';
 for(let i=0;i<12;i++){const a=(i*30-105)*Math.PI/180,b=(i*30-75)*Math.PI/180,mid=(i*30-90)*Math.PI/180;
  const maj=(i*7)%12,min=(maj+9)%12;
  h+=`<path class="segc" data-t="${maj}" data-m="major" d="${arc(92,146,a,b)}"><title>${MAJ_NAME[maj]} major</title></path>`;
  h+=`<path class="segc" data-t="${min}" data-m="minor" d="${arc(52,92,a,b)}"><title>${MIN_NAME[min]} minor</title></path>`;
  h+=`<text x="${(119*Math.cos(mid)).toFixed(1)}" y="${(119*Math.sin(mid)+9).toFixed(1)}" text-anchor="middle" font-size="25" font-weight="700" fill="currentColor">${MAJ_NAME[maj]}</text>`;
  h+=`<text x="${(72*Math.cos(mid)).toFixed(1)}" y="${(72*Math.sin(mid)+6).toFixed(1)}" text-anchor="middle" font-size="17" fill="currentColor">${MIN_NAME[min]}m</text>`;}
 svg.innerHTML=h;svg.style.color='var(--ink)';
 svg.querySelectorAll('.segc').forEach(s=>{segs.push(s);s.addEventListener('click',()=>lockTo({tonic:+s.dataset.t,mode:s.dataset.m}))});
})();

// ---- render ----
const esc=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const chordKey=c=>({tonic:c.root,mode:isMinorQ(c)?'minor':'major'});
// ---- values published to the DAW as read-only parameters (for a future FL/Ableton controller script) ----
let lastInfo='';
function publishInfo(k,flow){
 const info={key:k&&!flow?k.tonic+1+(k.mode==='minor'?12:0):0,mode:['scale','key','flow'].indexOf(mode),
  chordRoot:cur?cur.root+1:0,chordType:cur?CHORDS.findIndex(c=>c.q===cur.q)+1:0};
 const j=JSON.stringify(info);if(j!==lastInfo){lastInfo=j;toHost('info',info)}
}
const DEF={};['chordName','roman','alts','scales','why','shifts','keyName','conf','prog'].forEach(id=>DEF[id]=[$(id).innerHTML,$(id).className]);
function render(){
 const flow=mode==='flow',k=currentKey();
 if(!cur)Object.entries(DEF).forEach(([id,[html,cl]])=>{$(id).innerHTML=html;$(id).className=cl});
 const fl=flow&&cur?prefersFlats(chordKey(cur)):k?prefersFlats(k):true;
 document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.mode===mode));
 document.body.classList.toggle('flow',flow);$('legendB').textContent=flow?'Fits the chord':'In the scale';
 const km=mode==='key';
 $('modeHint').textContent=flow?'Flow mode ignores the key and reacts only to your last chord.':km?'Key mode: pick your key and everything is measured against it.':'Scale mode detects the key and picks scales for you.';
 $('keyLabel').textContent=km?'Your key':'Detected key';$('lock').hidden=km||flow;$('keyPick').hidden=!km;
 // header cards
 if(cur){
  $('chordName').textContent=chordName(cur,fl);
  $('roman').textContent=flow?family(cur)==='dom'||family(cur)==='alt'?'Dominant: wants to move':'Reacting to this chord only':k?`${roman(cur,k)} in ${keyName(k)}`:'';
  $('alts').textContent=cur.alts.length?'Could also be read as: '+cur.alts.map(a=>chordName(a,fl)).join(', '):'No other common reading.';
 }
 {const notes=[...held],lc=detectChords(notes)[0];
  $('live').textContent=lc?chordName(lc,fl):notes.length===1?pcName(notes[0]%12,fl):'–';
  $('live').classList.toggle('on',notes.some(n=>midiHeld.has(n)));
  $('liveSub').textContent=lc?(notes.some(n=>midiHeld.has(n))?(HOST?'From the DAW':'From MIDI'):'Held now'):notes.length===1?'Single note':'Nothing held';}
 if(k){$('keyName').textContent=keyName(k);$('conf').textContent=flow?'Not used in Flow mode':km?'Chosen by you':k.conf==='Locked'?'Locked by you':k.conf+' match';}
 const cls=cur?classify(cur):null;
 // left panel: scales (scale mode) or note map (flow mode)
 const opts=!flow&&cur&&k?scaleOptions(cur,k,fl):[];
 if(selScale>=opts.length)selScale=0;
 const sel=opts[selScale];
 $('leftTitle').textContent=flow?'Notes over this chord':'Scales that fit this chord';
 if(flow&&cur){
  const grp=g=>[...Array(12).keys()].filter(p=>cls[p]===g).sort((a,b)=>((a-cur.root+12)%12)-((b-cur.root+12)%12));
  const lab=p=>`${chordDeg(cur,(p-cur.root+12)%12)} (${spellTone(cur,p,fl)})`;
  $('scales').className='body';
  $('scales').innerHTML=`<p class="row"><i class="sw b"></i><b>Safe:</b> ${grp('b').map(lab).join(', ')}. Chord tones plus tensions that sit well.</p>
   <p class="row"><i class="sw y"></i><b>Tension:</b> ${grp('y').map(lab).join(', ')||'none'}. Use these on the way somewhere rather than sitting on them.</p>
   <p class="row"><i class="sw r"></i><b>Clash:</b> ${grp('r').map(p=>`${lab(p)} is ${redReason(cur,p,fl)}`).join('; ')}.</p>`;
 } else if(opts.length){
  $('scales').className='body';
  $('scales').innerHTML=opts.map((o,i)=>`<button class="scaleBtn" data-i="${i}" aria-pressed="${i===selScale}"><span class="tag">${o.fit===1?'Fully in key':o.fit>=0.8?'Mostly in key':'Outside colour'}</span><b>${esc(pcName(cur.root,fl))} ${esc(o.n)}</b><span class="notes">${o.notes.join('  ')}</span></button>`).join('');
  $('scales').querySelectorAll('.scaleBtn').forEach(b=>b.onclick=()=>{selScale=+b.dataset.i;render()});
 }
 // why
 if(cur&&(k||flow)){
  const lines=(flow?[FAMILY_WHY[family(cur)],...explainMotion(cur,prev,fl)]:explain(cur,k,prev,fl)).map(s=>`<p>${esc(s)}</p>`);
  if(sel){
   const extra=sel.abs.filter(p=>!cur.pcs.includes(p)),outs=sel.abs.filter(p=>!keyPalette(k).has(p));
   const yel=[...Array(12).keys()].filter(p=>!sel.abs.includes(p)&&cls[p]!=='r');
   lines.push(`<p class="add"><b>${esc(sel.n)}:</b> ${esc(sel.why)} Notes you can add over this chord: ${extra.map(p=>`${chordDeg(cur,(p-cur.root+12)%12)} (${spellTone(cur,p,fl)})`).join(', ')||'none, the chord already uses them all'}. ${outs.length?`Outside ${keyName(k)}: ${outs.map(p=>spellTone(cur,p,fl)).join(', ')}, which is where the extra colour comes from.`:`Every note is inside ${keyName(k)}, so it sounds smooth.`}</p>`);
   if(yel.length)lines.push(`<p class="add y">Outside this scale but still playable over the chord: ${yel.map(p=>`${chordDeg(cur,(p-cur.root+12)%12)} (${spellTone(cur,p,fl)})`).join(', ')}. These are your "relative" notes for stepping out.</p>`);
  }
  $('why').className='body';$('why').innerHTML=lines.join('');
 }
 // right panel: key shifts or next moves
 $('rightTitle').textContent=flow?'Where it could go next':'Where you could shift';
 const pvEq=(a,b)=>a&&b&&a.id===b.id;
 if(flow&&cur){
  const mv=nextMoves(cur,fl);
  $('shifts').className='body';
  $('shifts').innerHTML=mv.map((m,i)=>`<button class="shift" data-i="${i}" aria-pressed="${pvEq(preview,{id:'m'+m.name})}"><b>${esc(m.name)}: ${esc(m.label)}</b><span>${esc(m.why)}</span></button>`).join('');
  $('shifts').querySelectorAll('.shift').forEach(b=>b.onclick=()=>{const m=mv[+b.dataset.i],p={id:'m'+m.name,pcs:m.pcs,seg:{tonic:m.root,mode:isMinorQ(m)?'minor':'major'}};preview=pvEq(preview,p)?null:p;render()});
 } else if(k&&(cur||km)){
  const sh=shiftOptions(k);
  $('shifts').className='body';
  $('shifts').innerHTML=sh.map((s,i)=>`<button class="shift" data-i="${i}" aria-pressed="${pvEq(preview,{id:'k'+s.key.tonic+s.key.mode})}"><b>${esc(s.label)}: ${esc(keyName(s.key))}</b><span>${esc(s.diff)} ${esc(s.why)}</span></button>`).join('');
  $('shifts').querySelectorAll('.shift').forEach(b=>b.onclick=()=>{const s=sh[+b.dataset.i].key,p={id:'k'+s.tonic+s.mode,pcs:keyScale(s),seg:s};preview=pvEq(preview,p)?null:p;render()});
 }
 // circle: key in scale mode, last chord's home in flow mode
 const ck=flow?(cur?chordKey(cur):null):k;
 const near=ck?[{tonic:(ck.tonic+7)%12,mode:ck.mode},{tonic:(ck.tonic+5)%12,mode:ck.mode},{tonic:ck.mode==='major'?(ck.tonic+9)%12:(ck.tonic+3)%12,mode:ck.mode==='major'?'minor':'major'}]:[];
 segs.forEach(s=>{const t=+s.dataset.t,m=s.dataset.m,eq=x=>x&&x.tonic===t&&x.mode===m;
  s.classList.toggle('cur',eq(ck));s.classList.toggle('near',near.some(eq));s.classList.toggle('pv',!!preview&&eq(preview.seg))});
 // keyboard colours
 let col=null;
 const kset=k?new Set(keyScale(k)):null;
 if(km&&kset)col=[...Array(12).keys()].map(p=>kset.has(p)?'b':!cur?'':cls[p]==='r'?'r':'y');
 else if(cur){col=flow?cls:[...Array(12).keys()].map(p=>!sel?cls[p]:sel.abs.includes(p)?'b':cls[p]==='r'?'r':'y')}
 const pvSet=preview?new Set(preview.pcs):new Set(),ghost=held.size===0&&cur?new Set(cur.notes):new Set(),hasPc=(set,pc)=>[...set].some(n=>n%12===pc);
 for(let m=LOW;m<=HIGH;m++){const el=keyEls[m],pc=m%12,isH=compact?hasPc(held,pc):held.has(m),isG=(compact?hasPc(ghost,pc):ghost.has(m))&&!isH,c=col?col[pc]:'';
  el.classList.remove('kb-b','kb-y','kb-r');if(c)el.classList.add('kb-'+c);
  el.classList.toggle('held',isH);el.classList.toggle('midi',isH&&(compact?hasPc(midiHeld,pc):midiHeld.has(m)));el.classList.toggle('ghost',isG);el.classList.toggle('pv',pvSet.has(pc));
  const dot=el.querySelector('.dot'),nm=el.querySelector('.nm');
  dot.textContent=cur?chordDeg(cur,(pc-cur.root+12)%12):km&&k&&kset.has(pc)?DEG[(pc-k.tonic+12)%12]:'';dot.style.visibility=dot.textContent?'':'hidden';
  nm.textContent=isH||isG?(cur?spellTone(cur,pc,fl):pcName(pc,fl)):'';
 }
 publishInfo(k,flow);
 if(progression.length)$('prog').innerHTML=progression.map((c,i)=>`<span class="${i===progression.length-1?'last':''}">${esc(c.label)}</span>`).join('');
}
render();
setTimeout(()=>toHost('ready',{}),0);
