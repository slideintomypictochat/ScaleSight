// ===== THEORY ENGINE =====
const LETTERS=['C','D','E','F','G','A','B'], LETTER_PC=[0,2,4,5,7,9,11];
const PC_FLAT=['C','D♭','D','E♭','E','F','G♭','G','A♭','A','B♭','B'];
const PC_SHARP=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
const MAJ_NAME=['C','D♭','D','E♭','E','F','G♭','G','A♭','A','B♭','B'];
const MIN_NAME=['C','C♯','D','E♭','E','F','F♯','G','G♯','A','B♭','B'];
const MAJOR=[0,2,4,5,7,9,11], NATMIN=[0,2,3,5,7,8,10];
const acc=n=>n===0?'':n>0?'♯'.repeat(n):'♭'.repeat(-n);
function parseName(s){return{l:LETTERS.indexOf(s[0]),a:(s.match(/♯/g)||[]).length-(s.match(/♭/g)||[]).length}}
function keyName(k){return (k.mode==='major'?MAJ_NAME:MIN_NAME)[k.tonic]+(k.mode==='major'?' major':' minor')}
function keyShort(k){return (k.mode==='major'?MAJ_NAME:MIN_NAME)[k.tonic]+(k.mode==='major'?'':'m')}
function spellLetters(tonicName,ints){
  const {l,a}=parseName(tonicName), tpc=(LETTER_PC[l]+a+12)%12;
  return ints.map((iv,i)=>{const L=(l+i)%7,target=(tpc+iv)%12;let d=((target-LETTER_PC[L]+18)%12)-6;
    return Math.abs(d)>1?null:LETTERS[L]+acc(d)});
}
function keyScale(k){return (k.mode==='major'?MAJOR:NATMIN).map(i=>(k.tonic+i)%12)}
function prefersFlats(k){const n=spellLetters((k.mode==='major'?MAJ_NAME:MIN_NAME)[k.tonic],k.mode==='major'?MAJOR:NATMIN);
  return n.some(x=>x&&x.includes('♭'))||!n.some(x=>x&&x.includes('♯'))}
function pcName(pc,flats){return (flats?PC_FLAT:PC_SHARP)[((pc%12)+12)%12]}
function spellScale(rootPc,ints,flats){
  const rootName=pcName(rootPc,flats);
  if(ints.length===7)for(const rn of [rootName,pcName(rootPc,!flats)]){const s=spellLetters(rn,ints);if(s.every(Boolean))return s}
  return ints.map(i=>pcName(rootPc+i,flats));
}

// chord templates: i = intervals, opt = intervals that may be omitted
const CHORDS=[
 ['',[0,4,7]],['m',[0,3,7]],['dim',[0,3,6]],['aug',[0,4,8]],['sus2',[0,2,7]],['sus4',[0,5,7]],
 ['6',[0,4,7,9]],['m6',[0,3,7,9]],['7',[0,4,7,10]],['maj7',[0,4,7,11]],['m7',[0,3,7,10]],
 ['m7♭5',[0,3,6,10]],['dim7',[0,3,6,9]],['mMaj7',[0,3,7,11]],['7♯5',[0,4,8,10]],['7♭5',[0,4,6,10]],
 ['7sus4',[0,5,7,10]],['add9',[0,2,4,7]],['madd9',[0,2,3,7]],['9',[0,2,4,7,10]],['maj9',[0,2,4,7,11]],
 ['m9',[0,2,3,7,10]],['7♭9',[0,1,4,7,10]],['7♯9',[0,3,4,7,10]],['9sus4',[0,2,5,7,10]],
 ['m11',[0,2,3,5,7,10]],['13',[0,2,4,7,9,10]],['13sus',[0,2,5,7,9,10]],['maj7♯11',[0,4,6,7,11]],
 ['7♯5♭9',[0,1,4,8,10]],['maj13',[0,2,4,7,9,11]],['m7♭9',[0,1,3,7,10]]
].map(([q,i])=>({q,i,opt:i.length>=4&&i.includes(7)?(q.includes('13')?[7,2]:[7]):[]}));

function detectChords(notes){
  if(notes.length<2)return[];
  const pcs=[...new Set(notes.map(n=>n%12))], bass=Math.min(...notes)%12, out=[];
  if(pcs.length<2)return[];
  for(const r of pcs){
    const rel=new Set(pcs.map(p=>(p-r+12)%12));
    for(const c of CHORDS){
      const t=new Set(c.i);let m=0,ex=0,mi=0;
      rel.forEach(x=>t.has(x)?m++:ex++);
      t.forEach(x=>{if(!rel.has(x)&&!c.opt.includes(x))mi++});
      if(ex>0||m<2)continue;
      const score=m-mi*1.3+(r===bass?1:0)-c.i.length*0.02;
      out.push({root:r,q:c.q,bass,score,pcs});
    }
  }
  out.sort((a,b)=>b.score-a.score);
  return out.slice(0,4);
}
function chordName(c,flats){return pcName(c.root,flats)+c.q+(c.bass!==c.root?'/'+pcName(c.bass,flats):'')}
const has=(c,iv)=>c.pcs.some(p=>(p-c.root+12)%12===iv);
const isMinorQ=c=>/^m(?!aj)/.test(c.q)||c.q.startsWith('dim');
const isDom=c=>has(c,4)&&has(c,10);
const isSus=c=>c.q.includes('sus');

// ===== KEY TRACKING (Krumhansl profiles) =====
const PROF={major:[6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88],minor:[6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17]};
function corr(a,b){const n=12,ma=a.reduce((x,y)=>x+y)/n,mb=b.reduce((x,y)=>x+y)/n;let s=0,sa=0,sb=0;
  for(let i=0;i<n;i++){s+=(a[i]-ma)*(b[i]-mb);sa+=(a[i]-ma)**2;sb+=(b[i]-mb)**2}return s/Math.sqrt(sa*sb||1)}
function estimateKey(hist,rootHist){
  const res=[];
  for(const mode of ['major','minor'])for(let t=0;t<12;t++){
    const p=PROF[mode].map((_,i)=>PROF[mode][(i-t+12)%12]);
    res.push({tonic:t,mode,score:corr(hist,p)+0.25*(rootHist[mode][t]||0)});
  }
  res.sort((a,b)=>b.score-a.score);
  const gap=res[0].score-res[1].score;
  return {...res[0],conf:gap>0.12?'Strong':gap>0.04?'Likely':'Unsure'};
}

// ===== SCALES =====
const SCALES={
 ionian:{n:'Major (Ionian)',i:MAJOR,ch:[4,11],why:'The plain major sound: bright and settled.'},
 dorian:{n:'Dorian',i:[0,2,3,5,7,9,10],ch:[9],why:'Minor with a raised 6th. It\'s the smooth, soulful minor of R&B and neo-soul.'},
 phrygian:{n:'Phrygian',i:[0,1,3,5,7,8,10],ch:[1],why:'Minor with a flat 2nd: dark, tense and slightly Spanish.'},
 lydian:{n:'Lydian',i:[0,2,4,6,7,9,11],ch:[6],why:'Major with a raised 4th. Dreamy and floating, and the ♯11 is the "jazzy" note on maj9 chords.'},
 mixolydian:{n:'Mixolydian',i:[0,2,4,5,7,9,10],ch:[10],why:'Major with a flat 7th: bluesy, funky and made for dominant and sus chords.'},
 aeolian:{n:'Natural minor (Aeolian)',i:NATMIN,ch:[8],why:'The standard minor sound, moody and plain.'},
 locrian:{n:'Locrian',i:[0,1,3,5,6,8,10],ch:[1,6],why:'The darkest mode, matching the half-diminished chord exactly.'},
 harmmin:{n:'Harmonic minor',i:[0,2,3,5,7,8,11],ch:[11],why:'Minor with a raised 7th, the leading tone that creates a strong pull home.'},
 melmin:{n:'Melodic minor',i:[0,2,3,5,7,9,11],ch:[9,11],why:'Minor 3rd with a major top half: sophisticated, jazzy minor.'},
 phrygdom:{n:'Phrygian dominant',i:[0,1,4,5,7,8,10],ch:[1,4],why:'A flat 2nd plus a major 3rd gives the Spanish/flamenco sound. It\'s the 5th mode of harmonic minor, which makes it the natural scale for a V chord resolving into a minor key.'},
 lyddom:{n:'Lydian dominant',i:[0,2,4,6,7,9,10],ch:[6,10],why:'Mixolydian with a ♯4: a bright, modern dominant, good on tritone subs.'},
 altered:{n:'Altered',i:[0,1,3,4,6,8,10],ch:[1,3,6,8],why:'Every tension is altered (♭9 ♯9 ♯11 ♭13), giving maximum tension right before a resolution.'},
 locrian2:{n:'Locrian ♮2',i:[0,2,3,5,6,8,10],ch:[2,6],why:'Locrian with a natural 9th. It\'s a smoother choice over half-diminished chords.'},
 wholetone:{n:'Whole tone',i:[0,2,4,6,8,10],ch:[6,8],why:'Only whole steps, so nothing pulls anywhere. Floaty and dreamlike, and it matches augmented chords.'},
 hwdim:{n:'Half-whole diminished',i:[0,1,3,4,6,7,9,10],ch:[1,3,9],why:'Alternating half and whole steps, symmetrical tension for 7♭9 chords.'},
 whdim:{n:'Whole-half diminished',i:[0,2,3,5,6,8,9,11],ch:[2,11],why:'Built from stacked minor 3rds, so it fits diminished chords perfectly.'},
 majpent:{n:'Major pentatonic',i:[0,2,4,7,9],ch:[],why:'Five notes and no half steps, so it\'s almost impossible to hit a clash.'},
 minpent:{n:'Minor pentatonic',i:[0,3,5,7,10],ch:[],why:'The safest minor choice: five notes, no clashes, instantly soulful.'},
 blues:{n:'Blues',i:[0,3,5,6,7,10],ch:[6],why:'Minor pentatonic plus the ♭5 "blue note" for grit.'}
};
const CHORD_SCALES={'':['ionian','lydian','mixolydian','majpent'],'6':['ionian','lydian','majpent'],'add9':['ionian','lydian','majpent'],
 'maj7':['ionian','lydian'],'maj9':['lydian','ionian'],'maj13':['lydian','ionian'],'maj7♯11':['lydian'],
 'm':['dorian','aeolian','phrygian','minpent'],'m7':['dorian','aeolian','phrygian','minpent'],'m9':['dorian','aeolian','minpent'],
 'm11':['dorian','aeolian','minpent'],'madd9':['aeolian','dorian','melmin'],'m6':['dorian','melmin'],'mMaj7':['melmin','harmmin'],'m7♭9':['phrygian'],
 '7':['mixolydian','phrygdom','lyddom','blues'],'9':['mixolydian','lyddom'],'13':['mixolydian','lyddom'],
 '7♭9':['phrygdom','hwdim','altered'],'7♯9':['altered','hwdim','blues'],'7♯5':['wholetone','altered','phrygdom'],
 '7♯5♭9':['phrygdom','altered'],'7♭5':['wholetone','lyddom'],'aug':['wholetone'],
 'sus4':['mixolydian','dorian'],'sus2':['ionian','mixolydian','dorian'],'7sus4':['mixolydian','dorian'],'9sus4':['mixolydian','dorian'],
 '13sus':['mixolydian','dorian'],'m7♭5':['locrian2','locrian'],'dim':['whdim','locrian'],'dim7':['whdim','harmmin']};
const DEG=['1','♭2','2','♭3','3','4','♯4','5','♭6','6','♭7','7'];
function chordDeg(c,iv){
  return ({0:'R',1:'♭9',2:'9',3:has(c,4)?'♯9':'♭3',4:'3',5:(has(c,3)||has(c,4))?'11':'4',6:has(c,7)?'♯11':'♭5',
    7:'5',8:has(c,7)?'♭13':'♯5',9:c.q==='dim7'?'°7':(c.q.includes('6')?'6':'13'),10:'♭7',11:'7'})[iv];
}
const STEP={0:0,1:1,2:1,4:2,5:3,7:4,9:5,10:6,11:6};
function spellTone(c,pc,flats){
  const iv=(pc-c.root+12)%12,lab=chordDeg(c,iv);let st=STEP[iv];
  if(iv===3)st=lab==='♯9'?1:2;if(iv===6)st=lab==='♯11'?3:4;if(iv===8)st=lab==='♭13'?5:4;
  for(const rf of [flats,!flats]){const {l,a}=parseName(pcName(c.root,rf)),L=(l+st)%7,d=((pc%12-LETTER_PC[L]+18)%12)-6;
    if(Math.abs(d)<=1)return LETTERS[L]+acc(d)}
  return pcName(pc,flats);
}
function keyPalette(k){const s=new Set(keyScale(k));if(k.mode==='minor')s.add((k.tonic+11)%12);return s}
function scaleOptions(c,k,flats){
  const pal=keyPalette(k);
  return (CHORD_SCALES[c.q]||['ionian']).map((id,order)=>{
    const S=SCALES[id],abs=S.i.map(i=>(c.root+i)%12);
    if(!c.pcs.every(p=>abs.includes(p)))return null;
    const fit=abs.filter(p=>pal.has(p)).length/abs.length;
    return {id,...S,abs,fit,order,notes:spellScale(c.root,S.i,flats)};
  }).filter(Boolean).sort((a,b)=>b.fit-a.fit||a.order-b.order);
}

// ===== EXPLANATIONS =====
const ROMAN=['I','II','III','IV','V','VI','VII'];
function roman(c,k){
  const iv=(c.root-k.tonic+12)%12, sc=k.mode==='major'?MAJOR:NATMIN;
  let d=sc.indexOf(iv),pre='';
  if(d<0){const up=sc.indexOf((iv+1)%12);if(up>=0){d=up;pre='♭'}else{d=sc.indexOf((iv+11)%12);pre='♯'}}
  let r=ROMAN[d];if(isMinorQ(c))r=r.toLowerCase();
  let suf=c.q;
  if(c.q==='dim')suf='°';else if(c.q==='dim7')suf='°7';else if(c.q==='m7♭5')suf='ø7';
  else if(isMinorQ(c))suf=c.q.replace(/^m/,'');
  return pre+r+suf;
}
const FUNC_MAJ=['the home chord (tonic). Everything resolves here.','a pre-dominant: it naturally leads towards the V.',
 'a mediant, a softer, more colourful stand-in for the home chord.','the subdominant: it moves away from home and builds motion.',
 'the dominant: tension that wants to resolve home.','the relative minor, which shares two notes with home so it feels like an alternative home.',
 'the leading-tone chord, unstable and pushing home.'];
const FUNC_MIN=['the home chord (tonic). Everything resolves here.','a dark pre-dominant chord.','the relative major, a brighter alternative home.',
 'the subdominant, building motion away from home.','the minor v, a soft dominant without the strong pull.','a warm chord that often moves to V or back to i.',
 'the subtonic, a smooth R&B/rock move that often leads to III or i.'];
function explain(c,k,prev,flats){
  const out=[],ks=keyScale(k),iv=(c.root-k.tonic+12)%12,n=p=>pcName(p,flats),t=p=>spellTone(c,(p+12)%12,flats),kn=keyName(k);
  const outside=c.pcs.filter(p=>!ks.includes(p));
  const deg=(k.mode==='major'?MAJOR:NATMIN).indexOf(iv);
  if(outside.length===0&&deg>=0){
    out.push(`Every note comes from ${kn}, so it's a home-key chord. As ${roman(c,k)} it is ${(k.mode==='major'?FUNC_MAJ:FUNC_MIN)[deg]}`);
  } else if(k.mode==='minor'&&iv===7&&has(c,4)){
    out.push(`This is the V chord of ${kn}, with its major 3rd (${t(c.root+4)}) borrowed from harmonic minor. ${t(c.root+4)} sits a half step below ${n(k.tonic)}, so it pulls hard into the home chord.`);
    if(has(c,1))out.push(`The ♭9 (${t(c.root+1)}) is a note from the key itself, which keeps the chord dark and Spanish-sounding.`);
    if(has(c,8))out.push(`The ♯5 (${t(c.root+8)}) leans up a half step towards the next chord, adding even more push.`);
  } else if(isDom(c)&&iv===(1)){
    out.push(`Tritone substitute: it shares its 3rd and 7th with the real V chord, then slides down a half step to home.`);
  } else if(isDom(c)&&ks.includes((c.root+5)%12)&&(c.root+5)%12!==k.tonic){
    out.push(`Secondary dominant: it works as the V of ${n(c.root+5)}, borrowing that chord's pull to lead there.`);
  } else {
    const par={tonic:k.tonic,mode:k.mode==='major'?'minor':'major'};
    if(outside.length&&c.pcs.every(p=>keyScale(par).includes(p)))
      out.push(`Borrowed from ${keyName(par)} (modal interchange): same home note, the other mood's colour.`);
    if(outside.length)out.push(`Notes outside ${kn}: ${outside.map(t).join(', ')}. ${outside.length===1?'One outside note adds colour without losing the key.':'Several outside notes, so the ear may hear a new key here.'}`);
  }
  if(isSus(c))out.push(`Sus chord: the 4th replaces the 3rd, so it's neither major nor minor. That ambiguity lets it fit several keys, which is why sus chords are a favourite way to slip between them.`);
  if(prev){
    const d=(c.root-prev.root+12)%12;
    if(d===0&&prev.q!==c.q){const ch=c.pcs.filter(p=>!prev.pcs.includes(p));
      out.push(`Same root, new colour: only ${ch.length?ch.map(t).join(', '):'the voicing'} changed from the previous chord, a small move that creates movement without changing harmony.`)}
    else if(prev.q===c.q&&[1,2,10,11].includes(d))
      out.push(`Planing: the same chord shape slid ${d<6?'up':'down'} a ${d%2?'half':'whole'} step. The ear follows the shape rather than the key, a classic Neptunes move.`);
    else if(d===5)out.push(`The root falls a fifth from ${n(prev.root)}, the strongest move in harmony (one step anticlockwise round the circle).`);
    else if(d===7)out.push(`The root rises a fifth from ${n(prev.root)}, one step clockwise. It opens up rather than resolving.`);
    else if([3,4,8,9].includes(d)&&!isMinorQ(c)&&!isMinorQ(prev)&&!isSus(c)&&!isSus(prev)&&!isDom(c)&&!isDom(prev))out.push(`Chromatic mediant: the roots sit a third apart, giving a cinematic, sudden lift.`);
  }
  return out;
}

// ===== WHERE YOU COULD SHIFT =====
function shiftOptions(k){
  const t=k.tonic,maj=k.mode==='major',other=maj?'minor':'major';
  const list=[
   ['Relative '+other,{tonic:maj?(t+9)%12:(t+3)%12,mode:other},'Same seven notes, different home note. The smoothest shift there is.'],
   ['Up a fifth',{tonic:(t+7)%12,mode:k.mode},'One step clockwise on the circle.'],
   ['Down a fifth',{tonic:(t+5)%12,mode:k.mode},'One step anticlockwise on the circle.'],
   ['Parallel '+other,{tonic:t,mode:other},'Same home note, opposite mood. Borrow chords from it for instant colour.'],
   ['Down a whole step',{tonic:(t+10)%12,mode:k.mode},'Slide everything down two semitones, the Señorita bridge trick (A → G). Abrupt but smooth, because the chord shapes stay the same.'],
   ['Up a half step',{tonic:(t+1)%12,mode:k.mode},'The classic last-chorus lift for instant energy.'],
   ['Up a major third',{tonic:(t+4)%12,mode:k.mode},'Chromatic mediant: a cinematic jump that keeps just one or two notes.']
  ];
  const a=new Set(keyScale(k));
  return list.map(([label,key,why])=>{
    const b=new Set(keyScale(key)),fl=prefersFlats(key);
    const gone=[...a].filter(p=>!b.has(p)),added=[...b].filter(p=>!a.has(p));
    const pair=p=>added.find(q=>[1,11].includes((q-p+12)%12))??added[0];
    const diff=gone.length?`Changes ${gone.length} note${gone.length>1?'s':''}: ${gone.map(p=>pcName(p,prefersFlats(k))+' → '+pcName(pair(p),fl)).join(', ')}.`:'No notes change.';
    return {label,key,why,diff};
  });
}
if(typeof module!=='undefined')module.exports={isDom,isSus,spellTone,chordDeg,SCALES,MAJ_NAME,MIN_NAME,detectChords,chordName,estimateKey,scaleOptions,explain,shiftOptions,keyName,roman,prefersFlats,spellScale,keyScale,pcName};

// ===== FLOW MODE (chord-only, key-free) =====
function family(c){if(c.q==='aug')return'aug';if(c.q.startsWith('dim'))return'dim';if(c.q==='m7♭5')return'half';if(c.q==='mMaj7')return'mmaj';
 if(isSus(c))return'sus';if(isMinorQ(c))return'min';if(isDom(c)||c.q.startsWith('7'))return/♭9|♯9|♯5|♭5/.test(c.q)?'alt':'dom';return'maj'}
const FLOW={maj:{b:[2,6,9,11],y:[10,3,8]},min:{b:[2,5,9,10],y:[8,11,6]},dom:{b:[2,9],y:[1,3,6,8]},alt:{b:[1,3,6,8],y:[2,9]},
 sus:{b:[2,9,10],y:[4,3,8,6,11]},half:{b:[2,5,8],y:[1,9]},dim:{b:[2,5,8,9,11],y:[]},aug:{b:[2,6,10],y:[11,9]},mmaj:{b:[2,5,9],y:[8,6]}};
const FAMILY_WHY={maj:'A major-family chord: stable and bright. The 9, ♯11 and 13 add colour. The natural 11 clashes with the 3rd.',
 min:'A minor-family chord: stable and soulful. The 9, 11 and 13 all sit well. The ♭9 rubs against the root.',
 dom:'A dominant chord, built to move. Its 3rd and ♭7 form a tritone that wants to resolve down a fifth. Natural tensions (9, 13) keep it smooth, and altered ones (♭9, ♯9, ♯11, ♭13) add pull.',
 alt:'An altered dominant: maximum tension, built to resolve. Lean on the altered notes, or use the natural 9 and 13 to soften it.',
 sus:'A sus chord: the 4th replaces the 3rd, so it floats. Nearly everything works apart from notes that rub against the root or ♭7.',
 half:'Half-diminished: the "ii" chord of a minor key, usually leading into a dominant.',
 dim:'Diminished: symmetrical and unstable. Every note can resolve up a half step.',
 aug:'Augmented: symmetrical and unresolved, pushing outwards. The whole-tone notes fit.',
 mmaj:'Minor-major 7th: dark and cinematic. The 7 usually slides down to the ♭7.'};
function classify(c){
 const f=FLOW[family(c)],b=new Set(f.b),y=new Set(f.y);
 if(has(c,10))y.delete(11);if(has(c,11))y.delete(10);
 const out=Array(12);
 for(let iv=0;iv<12;iv++){const pc=(c.root+iv)%12;out[pc]=has(c,iv)||b.has(iv)?'b':y.has(iv)?'y':'r'}
 return out;
}
function redReason(c,pc,flats){
 for(const d of [1,-1]){const t=(pc-d+12)%12;if(c.pcs.includes(t))return`a half step ${d>0?'above':'below'} the ${chordDeg(c,(t-c.root+12)%12)==='R'?'root':chordDeg(c,(t-c.root+12)%12)} (${spellTone(c,t,flats)})`}
 return 'fights the chord\'s colour';
}
function explainMotion(c,prev,flats){
 const out=[],n=p=>pcName(p,flats),t=p=>spellTone(c,(p+12)%12,flats);
 if(!prev)return out;
 const d=(c.root-prev.root+12)%12;
 if(d===0&&prev.q!==c.q){const ch=c.pcs.filter(p=>!prev.pcs.includes(p));
  out.push(`Same root, new colour: only ${ch.length?ch.map(t).join(', '):'the voicing'} changed from the previous chord, a small move that creates movement without changing harmony.`)}
 else if(prev.q===c.q&&[1,2,10,11].includes(d))
  out.push(`Planing: the same chord shape slid ${d<6?'up':'down'} a ${d%2?'half':'whole'} step. The ear follows the shape rather than the key, a classic Neptunes move.`);
 else if(d===5)out.push(`The root falls a fifth from ${n(prev.root)}, the strongest move in harmony (one step anticlockwise round the circle).`);
 else if(d===7)out.push(`The root rises a fifth from ${n(prev.root)}, one step clockwise. It opens up rather than resolving.`);
 else if([3,4,8,9].includes(d)&&!isMinorQ(c)&&!isMinorQ(prev)&&!isSus(c)&&!isSus(prev)&&!isDom(c)&&!isDom(prev))out.push(`Chromatic mediant: the roots sit a third apart, giving a cinematic, sudden lift.`);
 const shared=c.pcs.filter(p=>prev.pcs.includes(p));
 if(shared.length)out.push(`Notes held over from the last chord: ${shared.map(t).join(', ')}. Common tones like these are what make a move sound smooth.`);
 return out;
}
function nextMoves(c,flats){
 const r=c.root,f=family(c),M=[],tn=iv=>spellTone(c,(r+iv)%12,flats),nm=(dr,q)=>pcName(r+dr,flats)+q;
 const add=(dr,q,label,why)=>M.push({root:(r+dr)%12,q,label,why});
 if(f==='dom'||f==='alt'){
  add(5,'maj7','Resolve down a fifth (major)',`The 3rd (${tn(4)}) rises a half step to the new root, and the ♭7 (${tn(10)}) falls a half step to the new 3rd. Smallest moves, strongest pull.`);
  add(5,'m7','Resolve down a fifth (minor)',`The same pull into a minor chord. Altered tensions like the ♭9 and ♭13 point here best.`);
  add(6,'7','Tritone substitute',`${nm(6,'7')} has the same 3rd and ♭7 as this chord, just swapped, so it can stand in for it and slide down a half step instead.`);
  add(2,'m7','Deceptive move',`Fake out the resolution: the ear expects ${pcName(r+5,flats)} and gets the chord a step up instead.`);
 }
 if(f==='min'){
  add(5,'7','ii–V: up a fourth to a dominant',`The ♭3 (${tn(3)}) stays put as the new ♭7, and the ♭7 (${tn(10)}) slips down a half step to the new 3rd.`);
  add(8,'maj7','Down a major third',`${nm(8,'maj7')} shares three notes with this chord, so it's a smooth, wistful move.`);
  add(0,'','Parallel major',`Same root, the 3rd moves up a half step: instant brightness.`);
 }
 if(f==='maj'){
  add(9,'m7','To the relative minor',`${nm(9,'m7')} shares three notes, so it barely moves but changes the mood.`);
  add(0,'7','Turn it dominant',`Add the ♭7 (${tn(10)}) and it starts pointing down a fifth to ${pcName(r+5,flats)}.`);
  add(4,'maj7','Chromatic mediant',`Up a major third. Only the 3rd (${tn(4)}) is shared, so it's a cinematic lift.`);
 }
 if(f==='sus'){
  add(0,has(c,10)?'7':'','Resolve the sus',`Let the 4th (${tn(5)}) fall a half step to the 3rd (${spellTone({...c,pcs:[...c.pcs,(r+4)%12]},(r+4)%12,flats)}).`);
  add(5,'maj9','Down a fifth',`A sus chord is a softer dominant, so it still pulls down a fifth.`);
 }
 if(f==='half')add(5,'7♭9','To its dominant',`m7♭5 is the "ii" of a minor ii–V: go up a fourth to a 7♭9.`);
 if(f==='dim'){add(1,'m7','Up a half step (minor)',`A diminished chord works like a 7♭9 without its root. Push any note up a half step to resolve.`);add(1,'maj7','Up a half step (major)',`The same resolution into a major chord.`)}
 if(f==='aug')add(5,'maj7','Down a fifth',`The ♯5 (${tn(8)}) rises to the new 3rd.`);
 if(f==='mmaj')add(0,'m7','Let the 7 fall',`The line cliché: the 7 (${tn(11)}) slides down to the ♭7 (${tn(10)}).`);
 add(10,c.q,'Plane down a whole step',`Slide the exact same shape down two semitones, like A♭13sus → G♭13sus in Señorita.`);
 add(1,c.q,'Plane up a half step',`Same shape, one semitone up: a quick, slippery lift.`);
 return M.map(m=>{const t=CHORDS.find(x=>x.q===m.q)||CHORDS[0];return{...m,pcs:t.i.map(i=>(m.root+i)%12),name:pcName(m.root,flats)+m.q}});
}
if(typeof module!=='undefined')Object.assign(module.exports,{family,classify,nextMoves,explainMotion,redReason});
