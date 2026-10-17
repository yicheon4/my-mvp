import { useEffect, useRef, useState } from 'react';
import { Microphone, Stop, SpeakerHigh, Keyboard, ArrowLeft, ArrowRight, BookOpen, Sparkle, Check, X, PencilSimple, Trash, LockSimple, Chats, PaperPlaneTilt, House, TShirt, Scissors, Flower, BookmarkSimple, Heart, MapPin, Crown, CreditCard, Sun, MoonStars, Footprints } from '@phosphor-icons/react';
import { BottomSheet, Carousel, KeyboardInput, MobileScroll, useKeyboard, useScreenPortal } from './mobile';
import { people, stories } from './story-data';
import type { StoryScene } from './story-data';
import WorldMap from './world/WorldMap';
import { mapArt, worldMaps, MAP_IDS } from './world/world-data';
import CharacterFrame from './presets/CharacterFrame';
import { DEFAULT_SELECTION, loadPresetData, readSelection, saveSelection, lookThumb, headThumb } from './presets/presets';
import type { Catalog as PresetCatalog, Manifest as PresetManifest, Selection as PresetSelection, Extra } from './presets/presets';
import type { MapId } from './world/world-data';
import { loadWorld, saveWorld } from './world/world-engine';
import type { WorldState } from './world/world-engine';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/noto-sans-kr/400.css';
import '@fontsource/noto-sans-kr/500.css';
import '@fontsource/noto-serif-kr/500.css';

type Page = 'world' | 'home' | 'prepare' | 'profile' | 'scenes' | 'paywall' | 'checkout' | 'voice' | 'feedback' | 'notebook';
type Phrase = { id:string; en:string; ko:string; context:string };
type Turn = { role:'you'|'friend'; text:string; ko?:string };
type Session = { version?:2; sceneDetails?:StoryScene; character:number; scene:number; avatar:string; turns:Turn[]; phrases:Phrase[]; reply:string; translation:string; tip?:Phrase };
const legacyPeople = [
  {name:'엘리', en:'ELI', art:'/art/roommate.png', trait:'차분하게 귀 기울이는', greeting:'Tell me what’s on your mind.'},
  {name:'미라', en:'MIRA', art:'/art/mira.png', trait:'다정하고 솔직한', greeting:'You can tell me anything.'},
  {name:'노엘', en:'NOEL', art:'/art/noel.png', trait:'장난스럽고 따뜻한', greeting:'Hey, how was your day, really?'},
];
const legacyScenes = ['기숙사에서 함께 저녁','저녁을 먹으며 오늘 이야기','식탁에서 나누는 속마음'];
const phrases:Phrase[] = [
 {id:'mind',en:'It’s been on my mind.',ko:'계속 마음에 걸렸어.',context:'쉽게 떨쳐내지 못한 고민을 친구에게 꺼낼 때'},
 {id:'chest',en:'I needed to get it off my chest.',ko:'누군가에게 털어놓고 싶었어.',context:'혼자 품고 있던 마음을 이야기하고 후련함을 표현할 때'},
 {id:'overwhelmed',en:'I’m feeling a little overwhelmed.',ko:'조금 벅차게 느껴져.',context:'과제나 해야 할 일이 겹쳐 감당하기 버거울 때'},
 {id:'mean',en:'That means a lot to me.',ko:'그 말이 나에게 정말 큰 힘이 돼.',context:'친구의 다정한 말이나 도움에 진심으로 고마울 때'},
 {id:'wrong',en:'I’m worried it came out wrong.',ko:'내 말이 다르게 들렸을까 봐 걱정돼.',context:'친구에게 한 말이 내 의도와 다르게 전해졌을까 걱정될 때'},
 {id:'future',en:'I’m still figuring things out.',ko:'아직 내 방향을 찾아가는 중이야.',context:'진로나 앞으로의 계획을 확신하기 어려울 때'},
];
type Look = { outfit:0|1; hair:0|1; makeup:0|1; background:0|1 };
const LOOK_STORE='persona-world-look-v1';
const defaultLook:Look={outfit:0,hair:0,makeup:0,background:0};
function readLook():Look {try {const x=JSON.parse(localStorage.getItem(LOOK_STORE)||'{}');return Object.fromEntries(Object.keys(defaultLook).map(k=>[k,x[k]===1?1:0])) as Look;}catch{return defaultLook;}}
const avatarArts=[
 '/art/avatar-000.png','/art/avatar-001.png','/art/avatar-010.png','/art/avatar-011.png',
 '/art/avatar-100.png','/art/avatar-101.png','/art/avatar-110.png','/art/avatar-111.png',
];
const rooms=[{name:'비 오는 저녁',detail:'포근한 램프와 창밖의 빗소리',art:'/art/home-evening.png'}, {name:'노을빛 오후',detail:'따뜻한 햇살이 머무는 방',art:'/art/home-sunset.png'}];
const wardrobe={outfit:{title:'옷',icon:TShirt,options:['아이보리 니트','로즈 리본 블라우스']},hair:{title:'헤어',icon:Scissors,options:['롱 웨이브','반묶음 리본']},makeup:{title:'메이크업',icon:Flower,options:['내추럴 피치','로지 글로우']}};
type ClosetTab = 'head' | 'look' | 'extra';
const STORE='persona-world-v1';
function readSaved(){try {const x=JSON.parse(localStorage.getItem(STORE)||'{}');return {notes:Array.isArray(x.notes)?x.notes.filter((n:Phrase)=>n&&typeof n.id==='string'&&typeof n.en==='string'&&typeof n.ko==='string'):[],session:x.session&&Array.isArray(x.session.turns)&&Array.isArray(x.session.phrases)&&(x.session.version===2?people[x.session.character]&&stories[x.session.character]?.[x.session.scene]:legacyPeople[x.session.character]&&legacyScenes[x.session.scene])?x.session:null};}catch{return {notes:[],session:null};}}
function demoReply(text:string,count:number,character=0){
 const t=text.toLowerCase();
 if(character===2&&/love you|miss you|사랑|보고 싶/.test(t))return {text:'I love being close to you, too. What made you feel that way today?',ko:'나도 너와 가까이 있는 게 좋아. 오늘 어떤 순간에 그런 마음이 들었어?',phrase:phrases[3]};
 if(/thank|고마|means a lot/.test(t))return {text:'I’m glad you told me. You don’t have to carry everything on your own.',ko:'말해 줘서 고마워. 모든 걸 혼자 감당할 필요는 없어.',phrase:phrases[3]};
 if(/friend|misunder|wrong|친구|오해/.test(t))return {text:'It’s hard when your words don’t land the way you hoped. What did you want them to understand?',ko:'내 말이 뜻대로 전해지지 않으면 속상하지. 어떤 마음을 전하고 싶었어?',phrase:phrases[4]};
 if(/future|career|job|진로|미래/.test(t))return {text:'You don’t need all the answers tonight. What’s one thing you’d like to try?',ko:'오늘 밤 모든 답을 찾을 필요는 없어. 한번 해 보고 싶은 건 뭐야?',phrase:phrases[5]};
 if(/stress|tired|overwhelm|assignment|exam|과제|힘들|시험/.test(t))return {text:'That sounds like a lot. Take your time, and tell me what’s been weighing on you.',ko:'많이 버거웠겠다. 뭐가 힘들었는지 천천히 들려줘.',phrase:phrases[2]};
 if(/chest|worr|mind|걱정|고민/.test(t))return {text:'I’m here to listen. You can say it in your own words, even if they’re not perfect.',ko:'내가 들어줄게. 완벽한 표현이 아니어도 네 말로 이야기하면 돼.',phrase:phrases[1]};
 if(count%2)return {text:'What part of that matters most to you? Take your time; I’m listening.',ko:'그중 어떤 부분이 너에게 가장 중요해? 천천히 말해도 돼.',phrase:phrases[0]};
 return character===1?{text:'You don’t need to put on a brave face with me. Tell me the honest version.',ko:'내 앞에서는 씩씩한 척하지 않아도 돼. 솔직한 마음을 들려줘.',phrase:phrases[1]}:character===2?{text:'I’m on your side. What would help you feel understood right now?',ko:'나는 네 편이야. 지금 어떻게 하면 네 마음을 잘 이해할 수 있을까?',phrase:phrases[1]}:{text:'We can take this one thing at a time. What would help you right now?',ko:'하나씩 천천히 생각해 보자. 지금 어떤 게 도움이 될까?',phrase:phrases[1]};
}
export default function Prototype(){
 const [initial]=useState(readSaved);
 const [page,setPage]=useState<Page>('home');
 const [look,setLook]=useState<Look>(readLook);
 // v7 world state (separate versioned key): look, map, feet position, day/night. The old look key above is kept untouched.
 const [world,setWorld]=useState<WorldState>(()=>loadWorld(localStorage));
 const [origin,setOrigin]=useState<'home'|'world'>('home');
 // v9 character presets: {head, look, extra} -> one complete full-body frame. Saved under persona-world-presets-v9 only.
 const [presetData,setPresetData]=useState<{catalog:PresetCatalog;manifest:PresetManifest}|null>(null);
 const [presetError,setPresetError]=useState(false);
 const [presetSel,setPresetSel]=useState<PresetSelection>(DEFAULT_SELECTION);
 const loadPresets=()=>{setPresetError(false);loadPresetData().then(d=>{setPresetData(d);setPresetSel(readSelection(d.catalog,localStorage));}).catch(()=>setPresetError(true));};
 useEffect(loadPresets,[]);
 useEffect(()=>{if(!presetData)return;try{saveSelection(presetSel,presetData.catalog,localStorage);}catch{setError('꾸미기 설정을 저장할 수 없어요.');}},[presetSel,presetData]);
 const headName=presetData?.catalog.heads.find(h=>h.id===presetSel.head)?.name??'';
 const lookName=presetData?.catalog.looks.find(l=>l.id===presetSel.look)?.name??'';
 const extraName=presetData?.catalog.extras.find(e=>e.id===presetSel.extra)?.name??'';
 const characterLabel=presetData?`나의 캐릭터 · ${headName} · ${lookName}${presetSel.extra!=='none'?` · ${extraName}`:''}`:'나의 캐릭터';
 const pickPreset=(patch:Partial<PresetSelection>)=>setPresetSel(s=>({...s,...patch}));
 const artOf=(mapId:MapId)=>mapArt[mapId][world.timeOfDay];
 const homeMapOf=(i:number):MapId=>MAP_IDS.find(m=>worldMaps[m].npcs.some(n=>n.person===i))??'living-room';
 const [closet,setCloset]=useState<ClosetTab|null>(null);
 const avatarArt=avatarArts[look.outfit*4+look.hair*2+look.makeup];
 const [character,setCharacter]=useState(initial.session?.version===2?initial.session.character:0);
 const [scene,setScene]=useState(initial.session?.version===2?initial.session.scene:0);
 const avatar='있는 그대로의 나';
 const [sceneFilter,setSceneFilter]=useState<'all'|'free'|'premium'>('all');
 const [payTarget,setPayTarget]=useState({name:'',detail:'',art:'',back:'prepare' as Page});
 const [session,setSession]=useState<Session|null>(initial.session);
 const [notes,setNotes]=useState<Phrase[]>(initial.notes);
 const [selected,setSelected]=useState<string[]>([]);
 const [sheet,setSheet]=useState<'compose'|'history'|'edit'|null>(null);
 const [draft,setDraft]=useState('');
 const [edit,setEdit]=useState<Phrase|null>(null);
 const [toast,setToast]=useState('');
 const [error,setError]=useState('');
 const [listening,setListening]=useState(false);
 const [busy,setBusy]=useState(false);
 const [speaking,setSpeaking]=useState(false);
 const recognition=useRef<any>(null);
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const keyboard=useKeyboard();
 const {screenRef}=useScreenPortal();
 useEffect(()=>{const root=screenRef.current;if(!root)return;const previous=root.style.overflow;root.scrollTop=0;root.style.overflow="clip";return()=>{root.style.overflow=previous;};},[page,sheet,closet]);
 useEffect(()=>{try{localStorage.setItem(LOOK_STORE,JSON.stringify(look));}catch{setError('꾸미기 설정을 저장할 수 없어요.');}},[look]);
 useEffect(()=>{try{saveWorld(localStorage,world);}catch{setError('월드 상태를 저장할 수 없어요.');}},[world]);
 const person=session?.version===2?people[session.character]:{...legacyPeople[session?.character??0],relation:'룸메이트'};
 const chosen=people[character];
 const chosenScene=stories[character][scene];
 useEffect(()=>{try{localStorage.setItem(STORE,JSON.stringify({notes,session}));}catch{setError('이 브라우저에서 기록을 저장할 수 없어요.');}},[notes,session]);
 useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),3000);return()=>clearTimeout(t);},[toast]);
 useEffect(()=>()=>{recognition.current?.abort();if(timer.current)clearTimeout(timer.current);window.speechSynthesis?.cancel();},[]);
 function stopAudio(){recognition.current?.abort();setListening(false);window.speechSynthesis?.cancel();setSpeaking(false);}
 function go(next:Page){keyboard.hide();stopAudio();setSheet(null);setCloset(null);setError('');setPage(next);}
 function openPaywall(name:string,detail:string,art:string,back:Page){setPayTarget({name,detail,art,back});go('paywall');}
 function pickPerson(i:number){setCharacter(i);setScene(0);setSceneFilter('all');if(people[i].locked){openPaywall(people[i].name+'와 친밀도 쌓기',people[i].description,people[i].art,'prepare');}else go('profile');}
 // Met on the map: keep the place in mind (scene at this place if one exists) and come back to the same spot afterwards.
 function talkFromWorld(i:number,s:WorldState){setWorld(s);setOrigin('world');setCharacter(i);const here=stories[i].findIndex(sc=>!sc.locked&&sc.mapId===s.mapId);setScene(here>=0?here:0);setSceneFilter('all');if(people[i].locked){openPaywall(people[i].name+'와 친밀도 쌓기',people[i].description,people[i].art,'world');}else go('profile');}
 function startFromHome(){setOrigin('home');go('prepare');}
 function start(){
  if(chosen.locked||chosenScene.locked){openPaywall(chosenScene.title,chosenScene.detail,chosenScene.art,'scenes');return;}
  if(timer.current)clearTimeout(timer.current);setBusy(false);
  const reply=chosenScene.opening;
  setSession({version:2,sceneDetails:chosenScene,character,scene,avatar,reply,translation:chosenScene.translation,turns:[{role:'friend',text:reply,ko:chosenScene.translation}],phrases:[phrases[0]],tip:phrases[0]});go('voice');
 }
 function speak(text:string){
  if(!('speechSynthesis'in window)){setError('음성 재생을 지원하지 않는 브라우저예요. 자막으로 읽어 주세요.');return;}
  window.speechSynthesis.cancel();
  const utterance=new SpeechSynthesisUtterance(text);utterance.lang='en-US';utterance.rate=.87;
  const voice=window.speechSynthesis.getVoices().find(v=>v.lang==='en-US');if(voice)utterance.voice=voice;
  utterance.onend=()=>setSpeaking(false);utterance.onerror=()=>{setSpeaking(false);setError('음성을 재생하지 못했어요. 다시 눌러 주세요.');};setSpeaking(true);window.speechSynthesis.speak(utterance);
 }
 function send(text:string){
  if(!text.trim()||!session||busy)return;
  keyboard.hide();stopAudio();setSheet(null);setDraft('');setError('');setBusy(true);
  const result=demoReply(text,session.turns.filter(t=>t.role==='you').length,session.version===2?session.character:0);
  setSession(s=>s?{...s,turns:[...s.turns,{role:'you',text:text.trim()}]}:s);
  timer.current=setTimeout(()=>{
   setSession(s=>s?{...s,reply:result.text,translation:result.ko,tip:result.phrase,turns:[...s.turns,{role:'friend',text:result.text,ko:result.ko}],phrases:[...s.phrases.filter(p=>p.id!==result.phrase.id),{...result.phrase,context:`내 이야기: “${text.trim()}” · ${result.phrase.context}`}]}:s);
   setBusy(false);
  },700);
 }
 function mic(){
  if(listening){recognition.current?.stop();return;}
  const SpeechRecognition=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
  if(!SpeechRecognition||!window.isSecureContext){setError('이 환경에서는 마이크를 사용할 수 없어요. 영어를 직접 입력하거나 예시로 대화할 수 있어요.');setSheet('compose');return;}
  stopAudio();setError('');const rec=new SpeechRecognition();recognition.current=rec;rec.lang='en-US';rec.interimResults=false;rec.continuous=false;
  rec.onresult=(e:any)=>{const text=e.results[0][0].transcript;setDraft(text);setListening(false);setSheet('compose');};
  rec.onerror=(e:any)=>{setListening(false);if(e.error==='aborted')return;setError(e.error==='not-allowed'?'마이크 권한을 허용해 주세요. 지금은 글로도 대화할 수 있어요.':'음성을 알아듣지 못했어요. 다시 시도하거나 글로 말해 주세요.');setSheet('compose');};
  rec.onend=()=>setListening(false);
  try{rec.start();setListening(true);}catch{setError('마이크를 시작하지 못했어요. 글로 입력해 주세요.');setSheet('compose');}
 }
 function finish(){if(busy)return;setSelected([]);go('feedback');}
 function save(){const additions=(session?.phrases??[]).filter(p=>selected.includes(p.id));setNotes(n=>[...n,...additions.filter(p=>!n.some(x=>x.id===p.id))]);setToast(`${additions.length}개 표현을 메모장에 남겼어요`);go('notebook');}
 const heading=(title:string,subtitle:string,back:Page=origin)=><header className="page-header"><button className="icon-button" onClick={()=>go(back)} aria-label="뒤로"><ArrowLeft size={22}/></button><div><p className="eyebrow">PERSONA WORLD</p><h1>{title}</h1><p className="muted">{subtitle}</p></div></header>;
 return <div className={`persona-app ${page==='notebook'?'paper-theme':''}`}>
 {page==='home'&&<section className={`home-screen ${closet?'is-customizing':''}`} aria-label="나의 방">
  <img className="home-background" src={artOf('bedroom')} alt={world.timeOfDay==='day'?'햇살이 드는 나의 방':'불빛이 켜진 밤의 나의 방'}/>
  <div className="home-shade"/>
  <header className="home-header"><div className="wordmark"><Sparkle size={23} weight="thin"/><span>PERSONA WORLD</span></div></header>
  <div className="home-welcome"><span className="eyebrow">여기는, 나의 작은 세계</span><h1>오늘도 나답게.</h1></div>
  <CharacterFrame className="player-avatar" selection={presetSel} manifest={presetData?.manifest??null} label={characterLabel} dataError={presetError} onRetryData={loadPresets}/>
  <nav className="home-left" aria-label="나의 기록"><button className="home-menu diary-shortcut" onClick={()=>go('notebook')}><BookOpen size={25} weight="thin"/><span>나의 메모장</span>{notes.length>0&&<small>{notes.length}</small>}</button></nav>
  <nav className="home-right" aria-label="나의 캐릭터 꾸미기"><span className="rail-label">MY STYLE</span><button className={`home-menu ${closet?'active':''}`} aria-label="꾸미기 열기" aria-expanded={!!closet} onClick={()=>{keyboard.hide();setCloset(closet?null:'head');}}><TShirt size={24} weight="thin"/><span>꾸미기</span></button><button className="home-menu" aria-label={world.timeOfDay==='day'?'밤으로 바꾸기':'낮으로 바꾸기'} onClick={()=>setWorld(w=>({...w,timeOfDay:w.timeOfDay==='day'?'night':'day'}))}>{world.timeOfDay==='day'?<Sun size={24} weight="thin"/>:<MoonStars size={24} weight="thin"/>}<span>{world.timeOfDay==='day'?'낮':'밤'}</span></button></nav>
  {!closet?<footer className="home-footer"><div className="home-caption"><span>YOUR STORY, YOUR WORLD</span><p>이곳에서, 나의 말로 조금 더 가까이.</p></div><button className="gold-button story-start" onClick={()=>go('world')}><Footprints size={19}/>나의 세계로 나가기<ArrowRight size={20}/></button><button className="home-resume" onClick={startFromHome}>바로 이야기 시작하기</button>{session&&<button className="home-resume" onClick={()=>{setOrigin('home');go('voice');}}>지난 이야기 이어하기</button>}</footer>:<section className="closet-panel preset-panel" aria-label="꾸미기"><div className="closet-heading"><div><p className="eyebrow">MAKE IT YOURS</p><h2>나의 캐릭터</h2></div><button className="icon-button" aria-label="꾸미기 닫기" onClick={()=>setCloset(null)}><X size={20}/></button></div><div className="closet-tabs preset-tabs" role="tablist" aria-label="꾸미기 종류">{([['head','인물'],['look','착장'],['extra','추가 아이템']] as const).map(([t,label])=><button role="tab" aria-selected={closet===t} key={t} onClick={()=>setCloset(t)}>{label}</button>)}</div>
   {!presetData?<p className="closet-help">{presetError?<>목록을 불러오지 못했어요. <button className="text-link" onClick={loadPresets}>다시 시도</button></>:'불러오는 중…'}</p>:closet==='head'?<Carousel ariaLabel="인물 선택" className="preset-rail" contentClassName="preset-track">{presetData.catalog.heads.map(h=>{const on=h.id===presetSel.head;return <button key={h.id} className={`preset-card head-card ${on?'selected':''}`} aria-pressed={on} aria-label={`인물 ${h.name}`} onClick={()=>pickPreset({head:h.id})}><span className="preset-face"><img src={headThumb(h.id)} alt="" loading="lazy" draggable={false}/></span><span>{h.name}</span>{on&&<Check size={13}/>}</button>;})}</Carousel>
   :closet==='look'?<Carousel ariaLabel="착장 선택" className="preset-rail" contentClassName="preset-track">{presetData.catalog.looks.map(l=>{const on=l.id===presetSel.look;return <button key={l.id} className={`preset-card look-card ${on?'selected':''}`} aria-pressed={on} aria-label={`착장 ${l.name}`} onClick={()=>pickPreset({look:l.id})}><span className="preset-body"><img src={lookThumb(presetSel.head,l.id)} alt="" loading="lazy" draggable={false}/></span><span>{l.name}</span>{on&&<Check size={13}/>}</button>;})}</Carousel>
   :<div className="preset-extras"><div className="extra-free" role="radiogroup" aria-label="무료 추가 아이템 (하나만 선택)">{presetData.catalog.extras.filter(e=>!e.locked).map(e=>{const on=e.id===presetSel.extra;return <button key={e.id} role="radio" aria-checked={on} className={on?'selected':''} onClick={()=>pickPreset({extra:e.id as Extra})}>{e.name}</button>;})}</div><p className="extra-note">무료 아이템은 한 번에 하나만 착용할 수 있어요.</p><p className="extra-locked-title"><LockSimple size={12}/>유료 예정 · 잠김 {presetData.catalog.extras.filter(e=>e.locked).length}종 <small>착용 그림 준비 전 · 구매 불가</small></p><Carousel ariaLabel="유료 예정 아이템" className="preset-rail locked-rail" contentClassName="preset-track">{presetData.catalog.extras.filter(e=>e.locked).map(e=><button key={e.id} className="locked-chip" disabled aria-disabled="true" aria-label={`${e.name} 잠김`}><LockSimple size={11}/>{e.name}</button>)}</Carousel></div>}
   <p className="closet-help"><Check size={12}/>얼굴·헤어는 인물로, 옷·신발은 착장으로 함께 바뀌어요. 선택은 자동 저장돼요.</p></section>}
  {error&&<div role="alert" className="home-error">{error}</div>}
 </section>}
 {page==='world'&&<WorldMap initial={world} people={people} lookLabel={presetData?`${headName} · ${lookName}`:'선택한 캐릭터'} onSave={setWorld} onTalk={talkFromWorld} onHome={s=>{setWorld(s);go('home');}}/>}
 {page==='prepare'&&<>
  {heading('누구와 이야기할까?','서로 다른 여섯 사람, 너와 이어질 이야기.')}
  <MobileScroll className="pw-scroll"><main className="cast-content"><div className="cast-intro"><span><Heart size={14}/>지금 만날 수 있는 3명</span><span><LockSimple size={13}/>친밀도 쌓기 3명</span></div><div className="cast-grid">{people.map((p,i)=><button className={`cast-card ${p.locked?'locked':''}`} key={p.en} aria-label={`${p.name} ${p.locked?'친밀도 쌓기':'소개 보기'}`} onClick={()=>pickPerson(i)}><div className="cast-image"><img src={p.art} alt={`${p.name}, ${p.relation}`}/><span className="cast-badge">{p.locked?<><LockSimple size={11}/>친밀도 쌓기</>:'바로 대화 가능'}</span></div><div className="cast-label"><span>{p.en}</span><h2>{p.name}<ArrowRight size={15}/></h2><p>{p.relation}</p><small>{p.trait}</small></div></button>)}</div><p className="cast-footnote">친밀도 쌓기는 유료 콘텐츠 이름이에요.<br/>현재는 결제 흐름을 살펴볼 수 있는 체험 버전이에요.</p></main></MobileScroll>
 </>}
 {page==='profile'&&<section className="profile-screen" aria-label={`${chosen.name} 소개`}><img className="profile-room" src={artOf(homeMapOf(character))} alt=""/><div className="profile-dim"/><header className="profile-top"><button className="icon-button" aria-label={origin==='world'?'맵으로 돌아가기':'캐릭터 목록으로'} onClick={()=>go(origin==='world'?'world':'prepare')}><ArrowLeft size={22}/></button><span>MEET YOUR PERSON</span><button className="icon-button" aria-label="메모장 열기" onClick={()=>go('notebook')}><BookOpen size={21}/></button></header><img className="profile-portrait" src={chosen.art} alt={chosen.name}/><div className="profile-info"><p className="eyebrow">{chosen.en}</p><div className="profile-name"><h1>{chosen.name}</h1><span>{chosen.relation}</span></div><p className="profile-quote">“{chosen.quote}”</p><p className="profile-description">{chosen.description}</p><div className="profile-tags">{chosen.tags.map(t=><span key={t}>{t}</span>)}</div><button className="gold-button" onClick={()=>{if(origin!=='world')setScene(0);setSceneFilter('all');go('scenes');}}>대화하러 가기<ArrowRight size={19}/></button></div></section>}
 {page==='scenes'&&<>
  {heading('우리의 장면 고르기',`${chosen.name} · ${chosen.relation}`,'profile')}
  <MobileScroll className="pw-scroll"><main className="scenes-content">{origin==='world'&&<p className="scene-here"><MapPin size={12}/>지금 있는 곳 · {worldMaps[world.mapId].name} · {world.timeOfDay==='day'?'낮':'밤'}</p>}<div className="scene-hero"><img src={artOf(chosenScene.mapId)} alt={chosenScene.place}/><div><span><MapPin size={12}/>{chosenScene.place}</span><h2>{chosenScene.title}</h2></div></div><div className="scene-filter" aria-label="상황 필터">{([['all','전체 10'],['free','무료 7'],['premium','특별한 순간 3']] as const).map(([key,label])=><button key={key} aria-pressed={sceneFilter===key} onClick={()=>setSceneFilter(key)}>{label}</button>)}</div><div className="story-scenes">{stories[character].map((sc,i)=>({sc,i})).filter(({sc})=>sceneFilter==='all'||(sceneFilter==='free'?!sc.locked:sc.locked)).map(({sc,i})=><button key={sc.title} className={`story-scene ${scene===i?'selected':''}`} aria-pressed={scene===i} aria-label={`${sc.title}${sc.locked?' 유료':''}`} onClick={()=>{if(sc.locked){openPaywall(sc.title,sc.detail,artOf(sc.mapId),'scenes');}else setScene(i);}}><img src={artOf(sc.mapId)} alt=""/><div><small>{sc.place}{sc.locked&&<span><LockSimple size={10}/>유료</span>}</small><h3>{sc.title}</h3><p>{sc.detail}</p></div>{sc.locked?<LockSimple size={18}/>:scene===i?<Check size={18}/>:<ArrowRight size={16}/>}</button>)}</div><p className="cast-footnote">같은 사람과도, 매일 다른 이야기를.<br/>일부 장면은 같은 장소를 공유해요.</p></main></MobileScroll><footer className="fixed-footer scene-footer"><span>선택한 장면 · {chosen.name} · {chosenScene.title}</span><button className="gold-button" onClick={start}>이 장면에서 시작하기<ArrowRight size={18}/></button></footer>
 </>}
 {(page==='paywall'||page==='checkout')&&<>
  {heading(page==='paywall'?'조금 더 가까운 이야기':'결제 안내',page==='paywall'?'친밀도 쌓기 · 특별한 관계와 순간': '실제 결제가 발생하지 않는 MVP 시안',page==='paywall'?payTarget.back:'paywall')}
  <MobileScroll className="pw-scroll"><main className="pay-content">{page==='paywall'?<><div className={`pay-preview ${payTarget.back!=='scenes'?'is-person':''}`}><img src={payTarget.art} alt={payTarget.name}/><span><LockSimple size={20}/></span></div><p className="eyebrow">CLOSER STORIES</p><h2>{payTarget.name}</h2><p className="pay-description">{payTarget.detail}</p><div className="pass-card"><Crown size={24}/><h3>친밀도 패스</h3><p>새로운 인물 3명과의 대화<br/>캐릭터마다 특별한 순간 3개</p><small>요금과 이용 기간은 출시 시 안내할 예정이에요.</small></div></>:<><CreditCard size={34} className="checkout-icon"/><h2>새로운 이야기를<br/>열기 전에.</h2><div className="checkout-summary"><div><span>선택한 콘텐츠</span><strong>{payTarget.name}</strong></div><div><span>이용 상품</span><strong>친밀도 패스</strong></div><div><span>결제 금액</span><strong>미정</strong></div><div><span>결제 수단</span><strong>아직 연결되지 않았어요</strong></div></div><div className="checkout-notice"><LockSimple size={18}/><p>결제 기능을 준비하고 있어요.<br/>이 화면에서는 카드 정보를 받거나 요금을 청구하지 않아요. 잠긴 콘텐츠도 아직 열리지 않아요.</p></div></>}</main></MobileScroll><footer className="fixed-footer">{page==='paywall'?<button className="gold-button" onClick={()=>go('checkout')}>결제 화면 보기<ArrowRight size={18}/></button>:<button className="gold-button" onClick={()=>go(payTarget.back)}>무료 이야기로 돌아가기<ArrowRight size={18}/></button>}<button className="text-button" onClick={()=>go(payTarget.back)}>{page==='paywall'?'지금은 무료로 이야기할게':'다음에 다시 살펴보기'}</button></footer>
 </>}
 {page==='voice'&&session&&<section className="voice-screen" aria-label="보이스 대화">
  {session.version===2&&session.sceneDetails?<><img className="scene-art" src={artOf(stories[session.character]?.[session.scene]?.mapId??'kitchen')} alt={session.sceneDetails.place}/><div className="conversation-shade"/><img className="conversation-character" src={person.art} alt={`${person.name}와 대화`}/></>:<img className="scene-art" src={person.art} alt="이전 대화의 상대"/>}
  <header className="voice-header"><div className="voice-brand"><Sparkle size={23} weight="thin"/><span>PERSONA WORLD</span><button className="icon-button" aria-label={origin==='world'?'맵으로 돌아가기':'나의 방으로 돌아가기'} onClick={()=>go(origin)}><X size={19}/></button></div><h1>{session.sceneDetails?.title??legacyScenes[session.scene]}</h1><p>{person.relation} · {person.name} <span className="mode">체험 모드</span></p>{session.sceneDetails&&<span className="conversation-location"><MapPin size={12}/>{session.sceneDetails.place}</span>}</header>
  <button className="history-toggle" onClick={()=>setSheet('history')}><Chats size={17}/> 대화 기록 {session.turns.filter(t=>t.role==='you').length>0&&session.turns.filter(t=>t.role==='you').length}</button>
  <div className="voice-bottom">
   <div className="dialogue" aria-live="polite"><div className="speaker-label"><span/>{person.name}<span/></div><p className="english-line">{busy?'Let me think…':session.reply}<button disabled={busy} className={`inline-sound ${speaking?'playing':''}`} aria-label="상대 대사 듣기" onClick={()=>speak(session.reply)}><SpeakerHigh size={19}/></button></p><p className="translation">{busy?'네 이야기를 듣고 있어.':session.translation}</p>{session.tip&&!busy&&<div className="phrase-tip"><Sparkle size={20} weight="thin"/><div><p>{session.tip.en}</p><small>{session.tip.ko}</small></div></div>}</div>
   {error&&<p role="alert" className="voice-error">{error}</p>}
   <div className="voice-actions"><button className="side-action" disabled={busy||listening} onClick={()=>{setDraft('');setSheet('compose');}}><Keyboard size={22}/><span>글로 말하기</span></button><div className="mic-wrap"><button className={`mic-button ${listening?'listening':''}`} onClick={mic} disabled={busy} aria-label={listening?'음성 입력 마치기':'마이크로 말하기'}>{listening?<Stop size={29} weight="fill"/>:<Microphone size={35} weight="fill"/>}</button><span>{busy?'답변 준비 중':listening?'듣고 있어요…':'눌러서 말하기'}</span></div><button className="side-action" disabled={busy||listening} onClick={finish}><ArrowRight size={22}/><span>대화 마치기</span></button></div>
  </div>
 </section>}
 {page==='feedback'&&<>
  {heading('오늘 남은 표현들','우리의 대화가 나의 말이 되는 순간.','voice')}
  <MobileScroll className="pw-scroll feedback-scroll"><main className="feedback-content"><p className="eyebrow">A PAGE FROM OUR CONVERSATION</p><h2>기억하고 싶은 말을<br/>골라 담아 봐.</h2><p className="muted">{session?.turns.filter(t=>t.role==='you').length??0}번 마음을 나누고, {session?.phrases.length??0}개의 표현을 만났어요.</p>
   {!session?.phrases.length?<div className="empty-state"><BookOpen size={36} weight="thin"/><p>아직 함께 배운 표현이 없어요.</p><button className="text-button" onClick={()=>go('voice')}>한마디 나누러 돌아가기 <ArrowRight size={17}/></button></div>:<div className="expression-list">{session.phrases.map(p=>{const saved=notes.some(n=>n.id===p.id);const checked=selected.includes(p.id);return <button key={p.id} className={`expression ${checked?'checked':''}`} aria-pressed={checked} disabled={saved} onClick={()=>setSelected(s=>s.includes(p.id)?s.filter(x=>x!==p.id):[...s,p.id])}><div className="check-box">{(checked||saved)&&<Check size={16}/>}</div><div><span className="tiny-label">{saved?'메모장에 저장됨':'대화 속 추천 표현'}</span><h3>{p.en}</h3><p>{p.ko}</p><small>{p.context}</small></div></button>;})}</div>}
   <p className="demo-note">체험 대화에서 추천한 표현이에요.<br/>발음 점수나 실제 AI 평가는 제공하지 않아요.</p>
  </main></MobileScroll><footer className="fixed-footer"><button className="gold-button" disabled={!selected.length} onClick={save}><BookOpen size={19}/>{selected.length?`${selected.length}개 표현 내 메모장에 추가`:'저장할 표현을 골라 주세요'}</button><button className="text-button" onClick={()=>go('notebook')}>내 메모장 보기</button></footer>
 </>}
 {page==='notebook'&&<>
  {heading('나의 메모장','마음에 남은 말을, 한 장씩.')}
  <MobileScroll className="pw-scroll notebook-scroll"><main className="notebook-content"><div className="diary-binding" aria-hidden="true"/><div className="notebook-intro"><BookmarkSimple size={25} weight="fill" className="diary-bookmark"/><p className="eyebrow">MY WORDS, MY LITTLE DIARY</p><h2>오늘의 마음을<br/>오래 기억하는 방법.</h2><span>{notes.length}개의 소중한 표현</span><Flower size={32} weight="thin" className="diary-flower"/></div>
   {!notes.length?<div className="empty-state"><BookOpen size={42} weight="thin"/><p>아직 쓰이지 않은 첫 페이지.</p><small>친구와 대화한 뒤, 마음에 드는 말을 남겨 봐요.</small></div>:notes.map((n,i)=><article className="note" key={n.id}><div className="note-top"><span>PAGE {String(i+1).padStart(2,'0')}</span><button aria-label={`${n.en} 듣기`} className="icon-button" onClick={()=>speak(n.en)}><SpeakerHigh size={20}/></button></div><h3>{n.en}</h3><p className="note-meaning">{n.ko}</p><p className="note-context">{n.context}</p><button className="edit-note" onClick={()=>{setEdit(n);setDraft(n.ko);setSheet('edit');}}><PencilSimple size={14}/> 나만의 뜻으로 수정</button></article>)}
   <p className="local-note">기록은 지금 사용하는 브라우저에 저장돼요.</p>
  </main></MobileScroll><footer className="fixed-footer paper-footer">{session&&<button className="gold-button" onClick={()=>go('voice')}>대화 마저 이어하기 <ArrowRight size={18}/></button>}<button className={session?'text-button':'gold-button'} onClick={()=>go('prepare')}>새 대화하기</button></footer>
 </>}
 {toast&&<div className="toast" role="status"><Check size={16}/>{toast}</div>}
 <BottomSheet open={sheet==='compose'} onOpenChange={open=>{if(!open){keyboard.hide();setSheet(null);}}} title="네 이야기를 들려줘" description="영어로 입력하거나 아래 예시를 골라 보세요." snap={.72}><div className="sheet-body" onPointerDown={e=>{if((e.target as HTMLElement).closest("button"))e.preventDefault();}}>{error&&<p className="inline-error" role="alert">{error}</p>}<form onSubmit={e=>{e.preventDefault();send(draft);}}><KeyboardInput aria-label="영어로 내 이야기" placeholder="Today, I felt…" value={draft} maxLength={500} onChange={e=>setDraft(e.target.value)}/><button className="gold-button" type="submit" disabled={!draft.trim()||busy}>이야기 전하기 <PaperPlaneTilt size={18}/></button></form><p className="muted">이렇게 시작해도 좋아요</p>{['I’m overwhelmed by my assignments.','I’m worried my friend misunderstood me.','I’m not sure about my future.','Thank you for listening to me.'].map(s=><button className="sample" key={s} onClick={()=>send(s)}>{s}<ArrowRight size={16}/></button>)}<p className="demo-note">준비된 답변으로 흐름을 경험하는 체험 모드예요.<br/>음성 입력은 브라우저의 인식 서비스를 사용해요.</p></div></BottomSheet>
 <BottomSheet open={sheet==='history'} onOpenChange={open=>{if(!open)setSheet(null);}} title="우리의 대화" description={session?.sceneDetails?.title??"함께 나눈 이야기"} snap={.8}><div className="history-list">{session?.turns.map((t,i)=><div key={i} className={`history-turn ${t.role}`}><small>{t.role==='you'?'나':person.name}</small><p>{t.text}</p>{t.ko&&<small>{t.ko}</small>}</div>)}</div></BottomSheet>
 <BottomSheet open={sheet==='edit'} onOpenChange={open=>{if(!open){keyboard.hide();setSheet(null);}}} title="나만의 뜻으로 기록하기" description={edit?.en} snap={.6}><div className="sheet-body" onPointerDown={e=>{if((e.target as HTMLElement).closest("button"))e.preventDefault();}}><form onSubmit={e=>{e.preventDefault();if(!draft.trim()||!edit)return;setNotes(n=>n.map(p=>p.id===edit.id?{...p,ko:draft.trim()}:p));keyboard.hide();setSheet(null);setToast('나만의 뜻을 저장했어요');}}><KeyboardInput aria-label="나만의 한국어 뜻" value={draft} maxLength={200} onChange={e=>setDraft(e.target.value)}/><button className="gold-button" disabled={!draft.trim()}>뜻 저장하기 <Check size={18}/></button></form><button className="delete-note" onClick={()=>{setNotes(n=>n.filter(p=>p.id!==edit?.id));keyboard.hide();setSheet(null);setToast('표현을 메모장에서 지웠어요');}}><Trash size={16}/> 이 표현 지우기</button></div></BottomSheet>
 </div>;
}
