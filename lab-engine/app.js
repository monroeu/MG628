
const FOCUS_SHARE=0.7;
const CFG=window.LAB_CONFIG||{};
const LABINFO=CFG.lab||{id:"regression",title:"Lab"};const LAB=LABINFO.id;
const NARRATION_URL=CFG.narrationUrl||"narration.mp4";
{const t=document.getElementById("labTitle");if(t)t.textContent=LABINFO.title+" Lab";document.title=(LABINFO.week?"MG628 "+LABINFO.week+": ":"MG628 ")+LABINFO.title+" Lab"}
const FR={};for(const[n,c]of Object.entries(FRN))FR[n]=Array.from({length:c},(_,k)=>`frames/s${String(n).padStart(2,"0")}_${k}.webp`);
const LS_BASE="mg628-lab:"+LAB;let LS=LS_BASE+":guest";
const $=(s,r=document)=>r.querySelector(s);
const el=(t,a={},...k)=>{const e=document.createElement(t);for(const[x,v]of Object.entries(a)){if(x==="class")e.className=v;else if(x==="text")e.textContent=v;else if(x.startsWith("on"))e.addEventListener(x.slice(2),v);else if(v!==false&&v!=null)e.setAttribute(x,v===true?"":v)}for(const c of k.flat())if(c!=null)e.append(c.nodeType?c:document.createTextNode(c));return e};
const LET="ABCD";
/* ---------- progress state ---------- */
function blank(){const m={};for(const x of C)m[x.id]={slides:[],concepts:[],cards:[],kc:{},mcq:{answers:{},score:null,at:null},watchF:0,watchU:0,sf:{},cp:null,away:0};return{v:1,started:new Date().toISOString(),updated:null,timeSec:0,sessions:1,mods:m,events:[]}}
let P=blank();
function uniq(a){return[...new Set(a)]}
function merge(a,b){const o=JSON.parse(JSON.stringify(a));o.started=[a.started,b.started].filter(Boolean).sort()[0];o.timeSec=Math.max(a.timeSec||0,b.timeSec||0);o.sessions=Math.max(a.sessions||1,b.sessions||1);
 for(const x of C){const A=o.mods[x.id],B=(b.mods||{})[x.id];if(!B)continue;A.slides=uniq([...A.slides,...(B.slides||[])]);A.concepts=uniq([...A.concepts,...(B.concepts||[])]);A.cards=uniq([...A.cards,...(B.cards||[])]);
  for(const[k,v]of Object.entries(B.kc||{})){const c=A.kc[k];A.kc[k]=!c?v:{tries:Math.max(c.tries,v.tries),correct:c.correct||v.correct,first:c.first!=null?c.first:v.first}}
  if(B.mcq&&B.mcq.at&&!A.mcq.at)A.mcq=B.mcq;A.watchF=Math.max(A.watchF||0,B.watchF||0);A.watchU=Math.max(A.watchU||0,B.watchU||0);A.away=Math.max(A.away||0,B.away||0);A.sf=A.sf||{};for(const[k,v]of Object.entries(B.sf||{}))A.sf[k]=Math.max(A.sf[k]||0,v);if(B.cp&&!A.cp)A.cp=B.cp}
 o.events=[...(a.events||[]),...(b.events||[])].sort((x,y)=>x.t<y.t?-1:1).filter((e,i,r)=>!i||e.t!==r[i-1].t||e.e!==r[i-1].e).slice(-80);return o}
let SRV={quiz:{},warm:{},slides:new Set()};
function slidesDone(x){return(sb&&uid)?x.slides.filter(n=>SRV.slides.has(n)).length:P.mods[x.id].slides.length}
function verifiedIn(x){return x.slides.filter(n=>SRV.slides.has(n)).length}
function srvQuiz(mid){return SRV.quiz[mid]||{attempts:0,best:null,passed:false}}
function modTotals(x){const M=P.mods[x.id],i=C.indexOf(x);const tot=x.slides.length+x.concepts.length+x.cards.length+x.kc.length+2+(i>0?1:0);
 const kcDone=x.kc.filter(q=>M.kc[q.id]&&M.kc[q.id].correct).length;const Q=srvQuiz(x.id);
 const done=slidesDone(x)+M.concepts.length+M.cards.length+kcDone+(M.cp?1:0)+(Q.passed?1:0)+(i>0&&SRV.warm[x.id]?1:0);
 return{tot,done,pct:Math.round(100*done/tot),slides:M.slides.length,concepts:M.concepts.length,cards:M.cards.length,kc:kcDone,quiz:Q.best,passed:Q.passed}}
function overall(){let t=0,d=0;for(const x of C){const m=modTotals(x);t+=m.tot;d+=m.done}return Math.round(100*d/t)}
function log(e){P.events.push({t:new Date().toISOString(),e});if(P.events.length>80)P.events=P.events.slice(-80)}
/* ---------- persistence ---------- */
let sb=null,session=null,uid=null,userEmail=null,userName="",remoteOK=false,writing=false,pending=false,timer=null,localOnly=false;
function saveLocal(){P.updated=new Date().toISOString();try{localStorage.setItem(LS,JSON.stringify(P))}catch(e){}}
function changed(evt){if(evt)log(evt);saveLocal();renderProgress();if(remoteOK){clearTimeout(timer);timer=setTimeout(flush,2500)}}
async function flush(){if(!remoteOK||!sb||!uid)return;if(writing){pending=true;return}writing=true;
 try{const{error}=await sb.from("mg628_progress").upsert({user_id:uid,lab:LAB,email:userEmail,full_name:userName,student_id:studentId,data:JSON.parse(JSON.stringify(P)),updated_at:new Date().toISOString()});if(error)throw error;setNotice(null)}catch(e){console.warn(e);setNotice("offline")}
 writing=false;if(pending){pending=false;flush()}}
function setNotice(kind){const n=$("#notice"),t=$("#noticeText"),b=$("#dlBtn");if(!kind){n.hidden=true;return}n.hidden=false;
 if(kind==="local"){t.textContent="You're not signed in, so your progress is saved in this browser only and your instructor can't see it. Sign in with your Monroe Student ID to have it recorded, or download your progress and submit it.";b.hidden=false}
 if(kind==="offline"){t.textContent="Can't reach the progress server right now. Your work is kept in this browser and will sync the next time a save goes through.";b.hidden=true}}
/* time on task */
let lastInput=Date.now();["pointerdown","keydown","scroll","touchstart"].forEach(e=>addEventListener(e,()=>lastInput=Date.now(),{passive:true}));
setInterval(()=>{if(document.visibilityState==="visible"&&(Date.now()-lastInput<120000||!aud.paused)){P.timeSec+=15;saveLocal()}},15000);
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden"){if(PL&&PL.playing){pause();PL.awayPaused=true;const M=P.mods[PL.x.id];M.away=(M.away||0)+1;log(`${PL.x.id} left the lab during slide ${PL.x.slides[PL.i]}; narration paused`)}saveLocal();if(remoteOK)flush()}
 else if(PL&&PL.awayPaused){PL.awayPaused=false;log(`${PL.x.id} returned; narration resumed`);play()}});
let focusTick=0;setInterval(()=>{if(!PL)return;const vis=document.visibilityState==="visible",foc=vis&&document.hasFocus();const M=P.mods[PL.x.id],n=PL.x.slides[PL.i];
 if(foc&&PL.cpov.hidden){M.sf[n]=(M.sf[n]||0)+1;checkWatched(n)}
 if(PL.playing&&Date.now()-lastInput>600000){pause();PL.pnote.hidden=false;PL.pnote.textContent="Paused after 10 minutes without any activity. Press Play to continue.";log(`${PL.x.id} narration paused for inactivity`)}
 if(PL.playing){if(foc)M.watchF=(M.watchF||0)+1;else M.watchU=(M.watchU||0)+1}
 if(++focusTick%5===0){renderPStat();renderProgress()}if(focusTick%15===0)saveLocal()},1000);
/* ---------- rail + routing ---------- */
function renderRail(cur){const r=$("#rail");r.textContent="";C.forEach((x,i)=>{const m=modTotals(x);
 r.append(el("a",{class:"mlink",href:"#"+x.id,"aria-current":cur===x.id?"page":false},el("div",{class:"t"},el("i",{text:String(i+1)}),x.title),el("div",{class:"bar"},el("span",{style:`width:${m.pct}%`})),el("small",{text:m.pct===100?"Complete":m.pct+"% done"})))})}
function renderProgress(){const o=overall();const g=$("#ring");g.style.setProperty("--p",o);g.dataset.v=o+"%";g.setAttribute("aria-label","Overall progress "+o+"%");renderRail(curMod);
 document.querySelectorAll("[data-stage-done]").forEach(a=>{const[mid,st]=a.dataset.stageDone.split(":");a.classList.toggle("done",stageDone(mid,st))});
 document.querySelectorAll("[data-meta]").forEach(s=>s.textContent=metaText(s.dataset.meta))}
function stageDone(mid,st){const x=C.find(c=>c.id===mid),M=P.mods[mid];
 return st==="s"?slidesDone(x)>=x.slides.length:st==="c"?M.concepts.length>=x.concepts.length:st==="f"?M.cards.length>=x.cards.length:st==="k"?x.kc.every(q=>M.kc[q.id]&&M.kc[q.id].correct):st==="w"?!!SRV.warm[mid]:srvQuiz(mid).passed}
function metaText(k){const[mid,st]=k.split(":"),x=C.find(c=>c.id===mid),M=P.mods[mid];const fw=(M.watchF||0)+(M.watchU||0);const Q=srvQuiz(mid),W=SRV.warm[mid];
 if(st==="s")return`${slidesDone(x)} of ${x.slides.length} slides ${(sb&&uid)?"verified":"watched"}`+(fw>=30?` · ${Math.round(100*(M.watchF||0)/fw)}% in focus`:"");
 if(st==="c")return`${M.concepts.length} of ${x.concepts.length} read`;if(st==="f")return`${M.cards.length} of ${x.cards.length} reviewed`;
 if(st==="k")return`${x.kc.filter(q=>M.kc[q.id]&&M.kc[q.id].correct).length} of ${x.kc.length} correct`;
 if(st==="w")return W?`Score ${W.score} of ${W.n}`:"Not done";
 return Q.passed?`Mastered · best ${Q.best} of 5 · ${Q.attempts} attempt${Q.attempts===1?"":"s"}`:Q.attempts?`Best ${Q.best} of 5 · ${Q.attempts} attempt${Q.attempts===1?"":"s"}`:"Pass mark 4 of 5"}
let curMod="m1";
function route(){const h=location.hash.slice(1);stopPlayer();if(h==="class"&&isInstructor){curMod=null;renderRail(null);renderDash();return}
 curMod=C.some(c=>c.id===h)?h:"m1";renderRail(curMod);renderModule(C.find(c=>c.id===curMod));$("#main").focus({preventScroll:true});scrollTo(0,0)}
addEventListener("hashchange",route);
/* ---------- module view ---------- */
function stageHead(n,title,mid,st,lede){return[el("h2",{},el("span",{class:"n",text:String(n)}),title,el("span",{class:"meta","data-meta":mid+":"+st,text:metaText(mid+":"+st)})),el("p",{class:"lede",text:lede})]}
function renderModule(x){const M=P.mods[x.id],i=C.indexOf(x),main=$("#main");main.textContent="";
 const stages=[...(i>0?[["w","Warm-up"]]:[]),["s","Watch the slides"],["c","Read the concepts"],["f","Flip the cards"],["k","Knowledge check"],["q","Mastery quiz"]];
 const num=st=>stages.findIndex(s=>s[0]===st)+1;
 main.append(el("div",{class:"mhead"},el("div",{class:"k",text:"Module "+(i+1)+" of "+C.length}),el("h1",{text:x.title}),el("p",{text:x.blurb}),
  el("ol",{class:"stepper","aria-label":"Module stages"},stages.map(([s,t],j)=>el("li",{},el("a",{href:"#"+x.id,"data-stage-done":x.id+":"+s,class:stageDone(x.id,s)?"done":"",onclick:(e)=>{e.preventDefault();$("#st-"+s).scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"})}},el("b",{text:String(j+1)}),t))))));
 if(i>0){const sw=el("section",{class:"stage",id:"st-w"},...stageHead(num("w"),"Warm-up",x.id,"w","Two questions from earlier modules, drawn for you with fresh numbers. One attempt, graded."));sw.append(warmUp(x));main.append(sw)}
 const s1=el("section",{class:"stage",id:"st-s"},...stageHead(num("s"),"Watch the slides",x.id,"s","Each slide builds in step with its narration. A slide counts as watched once you reach its last build with the lab in focus for most of its length. Narration pauses if you switch away, and a checkpoint question stops playback partway through."));
 s1.append(buildPlayer(x));main.append(s1);
 const s2=el("section",{class:"stage",id:"st-c"},...stageHead(num("c"),"Read the concepts",x.id,"c","The ideas from the slides in writing. Each is marked as read once you've had it on screen for a few seconds."));
 x.concepts.forEach(([h,b],j)=>{const d=el("div",{class:"concept"+(M.concepts.includes(j)?" read":""),"data-ci":j},el("h3",{text:h}),el("p",{text:b}));s2.append(d);watchConcept(x,j,d)});main.append(s2);
 const s3=el("section",{class:"stage",id:"st-f"},...stageHead(num("f"),"Flip the cards",x.id,"f","Say the definition to yourself, then flip to check."));
 const grid=el("div",{class:"cards"});x.cards.forEach(([f,b],j)=>{const seen=M.cards.includes(j);
  const card=el("button",{class:"flip"+(seen?" seen":""),"aria-pressed":"false","aria-label":f+". Select to flip."},el("div",{class:"inner"},el("div",{class:"face front"},el("b",{text:f}),el("small",{text:"Select to flip"})),el("div",{class:"face back"},el("span",{text:b}),el("small",{text:"Select to flip back"}))));
  card.addEventListener("click",()=>{const on=card.getAttribute("aria-pressed")!=="true";card.setAttribute("aria-pressed",String(on));card.setAttribute("aria-label",on?b:f+". Select to flip.");if(on&&!M.cards.includes(j)){M.cards.push(j);card.classList.add("seen");changed(`${x.id} card ${j+1} flipped`)}});grid.append(card)});
 s3.append(grid);main.append(s3);
 const s4=el("section",{class:"stage",id:"st-k"},...stageHead(num("k"),"Knowledge check",x.id,"k","Practice questions with instant feedback. Try again until you get each one right. These aren't graded."));
 x.kc.forEach(q=>s4.append(kcQ(x,q)));main.append(s4);
 const s5=el("section",{class:"stage",id:"st-q"},...stageHead(num("q"),"Mastery quiz",x.id,"q","Five questions drawn for you, several with your own numbers, and graded on the server. Get 4 of 5 to master the module. If you don't, review and try a fresh set after 3 minutes."));
 s5.append(quizSrv(x));main.append(s5);
 if(i<C.length-1)main.append(el("div",{class:"nextmod"},el("a",{class:"btn primary",href:"#"+C[i+1].id,text:"Go to module "+(i+2)+": "+C[i+1].title})));
 log(`${x.id} opened`);saveLocal()}
const conceptTimers=new Map();let io=null;
function watchConcept(x,j,d){if(P.mods[x.id].concepts.includes(j))return;if(!io)io=new IntersectionObserver(es=>{for(const e of es){const t=e.target;if(e.isIntersecting&&e.intersectionRatio>=.6){if(!conceptTimers.has(t))conceptTimers.set(t,setTimeout(()=>{const mid=t.dataset.mid,k=+t.dataset.ci,M=P.mods[mid];if(!M.concepts.includes(k)){M.concepts.push(k);t.classList.add("read");changed(`${mid} concept ${k+1} read`)}io.unobserve(t)},4000))}else{clearTimeout(conceptTimers.get(t));conceptTimers.delete(t)}}},{threshold:[0,.6,1]});d.dataset.mid=x.id;io.observe(d)}
function kcQ(x,q){const M=P.mods[x.id];const st=M.kc[q.id];const box=el("div",{class:"q"},el("p",{class:"stem",text:q.stem}));const opts=el("div",{class:"opts"});const fb=el("div",{class:"fb",hidden:true,"aria-live":"polite"});
 const buttons=q.opts.map((o,k)=>el("button",{class:"opt",onclick:()=>{const R=M.kc[q.id]||{tries:0,correct:false,first:null};R.tries++;const ok=k===q.ans;if(R.first==null)R.first=ok;R.correct=R.correct||ok;M.kc[q.id]=R;
  buttons.forEach((b,m)=>{b.classList.remove("right","wrong");if(m===k)b.classList.add(ok?"right":"wrong");if(ok)b.disabled=true});
  fb.hidden=false;fb.className="fb "+(ok?"good":"bad");fb.textContent=ok?"Correct. "+q.why:"Not quite. Try another option.";changed(`${q.id} answered ${LET[k]} (${ok?"correct":"incorrect"})`)}},el("span",{class:"L",text:LET[k]}),el("span",{text:o})));
 if(st&&st.correct){buttons.forEach((b,m)=>{b.disabled=true;if(m===q.ans)b.classList.add("right")});fb.hidden=false;fb.className="fb good";fb.textContent="Correct. "+q.why}
 opts.append(...buttons);box.append(opts,fb);return box}
/* ---------- server-graded questions ---------- */
function signInLock(what){return el("div",{class:"lock"},el("b",{text:"Sign in required. "}),`${what} are drawn for you and graded on the server, so you need to be signed in. `,el("button",{class:"linkbtn",style:"margin:0",text:"Sign in",onclick:()=>{if(sb)authPanel()}}))}
function itemSet(items,prev){const sel=Array.isArray(prev)?[...prev]:Array(items.length).fill(null);const groups=[];const node=el("div");let onchange=()=>{};
 items.forEach((q,qi)=>{const box=el("div",{class:"q"},el("p",{class:"stem",text:(qi+1)+". "+q.stem}));const opts=el("div",{class:"opts",role:"radiogroup","aria-label":"Question "+(qi+1)});
  const bs=q.opts.map((o,k)=>el("button",{class:"opt"+(sel[qi]===k?" sel":""),role:"radio","aria-checked":String(sel[qi]===k),onclick:()=>{sel[qi]=k;bs.forEach((b,m)=>{b.classList.toggle("sel",m===k);b.setAttribute("aria-checked",String(m===k))});onchange()}},el("span",{class:"L",text:LET[k]}),el("span",{text:o})));
  opts.append(...bs);const fb=el("div",{class:"fb",hidden:true});box.append(opts,fb);groups.push({bs,fb});node.append(box)});
 return{node,sel,complete:()=>sel.every(v=>v!=null),set onchange(f){onchange=f},show(results,answers){results.forEach((r,qi)=>{const g=groups[qi];if(!g)return;const ch=answers?answers[qi]:r.chosen;
  g.bs.forEach((b,m)=>{b.disabled=true;b.classList.remove("sel");if(m===r.ans)b.classList.add("right");else if(m===ch)b.classList.add("wrong")});g.fb.hidden=false;g.fb.className="fb "+(r.correct?"good":"bad");g.fb.textContent=(r.correct?"Correct. ":"The answer is "+LET[r.ans]+". ")+r.why})}}}
function countdown(btn,secs,label){btn.disabled=true;const t0=Date.now();const iv=setInterval(()=>{const left=Math.max(0,secs-Math.floor((Date.now()-t0)/1000));btn.textContent=left?`${label} in ${Math.floor(left/60)}:${String(left%60).padStart(2,"0")}`:label;if(!left){clearInterval(iv);btn.disabled=false}},500)}
function runAttempt(x,kind,area,msg,data,done){const set=itemSet(data.items);area.textContent="";area.append(set.node);const quiz=kind==="quiz";
 const sub=el("button",{class:"btn primary",text:quiz?"Submit quiz":"Submit warm-up",disabled:true});const res=el("span",{class:"score","aria-live":"polite"});set.onchange=()=>sub.disabled=!set.complete();
 let sent=false;const submit=async auto=>{if(sent)return;if(!auto&&!confirm("Submit your answers?"))return;sent=true;sub.disabled=true;
  const r=await sb.rpc("mg628_submit_quiz",{p_attempt:data.attempt_id,p_answers:set.sel});if(r.error){res.textContent="Couldn't submit: "+r.error.message;sent=false;sub.disabled=false;return}
  set.show(r.data.results);sub.hidden=true;done(r.data,res,auto)};
 sub.addEventListener("click",()=>submit(false));
 area.append(el("div",{class:"quizbar"},sub,res))}
function quizSrv(x){const wrap=el("div",{id:"quizwrap"});
 if(!sb||!uid){wrap.append(signInLock("Quiz questions"));return wrap}
 const Q=srvQuiz(x.id);
 if(Q.passed){wrap.append(el("div",{class:"fb good"},el("b",{text:"Module mastered. "}),`Best score ${Q.best} of 5 after ${Q.attempts} attempt${Q.attempts===1?"":"s"}.`));return wrap}
 const v=verifiedIn(x);
 if(v<x.slides.length){wrap.append(el("div",{class:"lock"},el("b",{text:"The quiz is locked. "}),`Watch all ${x.slides.length} slides in this module to open it. ${v} ${v===1?"has":"have"} been verified so far. A slide is verified when you stay on it for most of its narration and reach its last build.`));return wrap}
 const area=el("div");const msg=el("p",{class:"lede","aria-live":"polite"});const go=el("button",{class:"btn primary",text:Q.attempts?"Try a fresh set":"Start quiz"});
 go.addEventListener("click",async()=>{go.disabled=true;msg.textContent="Drawing your questions…";
  const{data,error}=await sb.rpc("mg628_start_quiz",{p_lab:LAB,p_module:x.id,p_kind:"quiz"});go.disabled=false;
  if(error){msg.textContent="Couldn't start the quiz: "+error.message;return}
  if(data.status==="passed"){await loadMine();refreshQuiz(x);return}
  if(data.status==="locked"){msg.textContent=`The server has verified ${data.watched} of ${data.required} slides. Rewatch any slide without a check mark.`;return}
  if(data.status==="cooldown"){msg.textContent="Review the concepts and slides above before your next try.";countdown(go,data.wait_seconds,"Try a fresh set");return}
  if(data.status!=="open"){msg.textContent="No questions are available yet.";return}
  msg.textContent="";go.hidden=true;log(`${x.id} quiz started`);
  runAttempt(x,"quiz",area,msg,data,(o,res,auto)=>{const prev=srvQuiz(x.id);SRV.quiz[x.id]={attempts:prev.attempts+1,best:Math.max(prev.best||0,o.score),passed:prev.passed||!!o.passed};
   changed(`${x.id} quiz ${o.score}/${o.n}${o.passed?" (mastered)":""}`);
   if(o.passed){res.textContent=`You scored ${o.score} of ${o.n}. Module mastered.`;msg.textContent=""}
   else{res.textContent=`You scored ${o.score} of ${o.n}. You need 4 to master the module.`;go.hidden=false;msg.textContent="Review the explanations and the concepts above. A fresh set of questions opens in 3 minutes.";countdown(go,180,"Try a fresh set")}})});
 wrap.append(area,el("div",{class:"quizbar",style:"border:0;padding:0"},go),msg);return wrap}
function refreshQuiz(x){const old=$("#quizwrap");if(old)old.replaceWith(quizSrv(x))}
function warmUp(x){const wrap=el("div");if(!sb||!uid){wrap.append(signInLock("Warm-up questions"));return wrap}
 const area=el("div");const msg=el("p",{class:"lede","aria-live":"polite"});const go=el("button",{class:"btn primary",text:"Start warm-up"});
 const run=async()=>{go.disabled=true;const{data,error}=await sb.rpc("mg628_start_quiz",{p_lab:LAB,p_module:x.id,p_kind:"retrieval"});go.disabled=false;
  if(error){msg.textContent="Couldn't load the warm-up: "+error.message;return}
  if(data.status==="done"){go.hidden=true;const set=itemSet(data.items,data.answers);area.textContent="";area.append(set.node);set.show(data.results,data.answers);msg.textContent=`Warm-up complete: ${data.score} of ${data.n}.`;SRV.warm[x.id]={score:data.score,n:data.n};renderProgress();return}
  if(data.status!=="open")return;go.hidden=true;msg.textContent="";
  runAttempt(x,"retrieval",area,msg,data,(o)=>{msg.textContent=`Warm-up complete: ${o.score} of ${o.n}.`;SRV.warm[x.id]={score:o.score,n:o.n};changed(`${x.id} warm-up ${o.score}/${o.n}`)})};
 go.addEventListener("click",run);if(SRV.warm[x.id])setTimeout(run,0);wrap.append(area,go,msg);return wrap}
async function loadMine(){if(!sb||!uid)return;const[a,v]=await Promise.all([sb.from("mg628_attempts").select("module,kind,score,n,passed,submitted_at").eq("user_id",uid).eq("lab",LAB).not("submitted_at","is",null),sb.from("mg628_slide_views").select("slide").eq("user_id",uid).eq("lab",LAB)]);
 SRV={quiz:{},warm:{},slides:new Set((v.data||[]).map(r=>r.slide))};for(const r of a.data||[]){if(r.kind==="quiz"){const q=SRV.quiz[r.module]||{attempts:0,best:0,passed:false};q.attempts++;q.best=Math.max(q.best,r.score);q.passed=q.passed||!!r.passed;SRV.quiz[r.module]=q}else SRV.warm[r.module]={score:r.score,n:r.n}}}
/* ---------- slide player ---------- */
const aud=$("#aud");if(NARRATION_URL&&NARRATION_URL.indexOf("__")!==0)aud.src=NARRATION_URL;const hasAudio=!!aud.getAttribute("src");
let PL=null,raf=0;
function buildPlayer(x){const M=P.mods[x.id];PL={x,i:0,step:0,playing:false,auto:true};
 const top=el("img",{class:"top",alt:""}),bot=el("img",{alt:""});const cpov=el("div",{class:"cpov",hidden:true,role:"dialog","aria-modal":"true","aria-label":"Checkpoint question"});const box=el("div",{class:"stagebox"},bot,top,cpov);
 const playB=el("button",{class:"play",text:"Play",onclick:()=>PL.playing?pause():play()});
 const prevB=el("button",{text:"Previous slide",onclick:()=>goSlide(PL.i-1)});const nextB=el("button",{text:"Next",onclick:nextStep});
 const pos=el("span",{class:"pos"});const autoC=el("input",{type:"checkbox",checked:true,onchange:e=>PL.auto=e.target.checked});
 const scrub=el("div",{class:"scrub"},el("span"));
 const ctr=el("div",{class:"controls"},hasAudio?playB:null,prevB,nextB,hasAudio?el("label",{},autoC,"Continue to next slide"):null,pos);
 const thumbs=el("div",{class:"thumbs",role:"list"},x.slides.map((n,j)=>el("button",{role:"listitem","aria-label":"Slide "+n,class:M.slides.includes(n)?"seen":"",onclick:()=>{goSlide(j)}},el("img",{src:FR[n][FR[n].length-1],alt:"",loading:"lazy"}),el("span",{class:"ok",text:"✓"}))));
 const tr=el("p");const det=el("details",{class:"transcript"},el("summary",{text:"Transcript"}),tr);
 const pstat=el("div",{class:"pstat","aria-live":"polite"});const pnote=el("div",{class:"pnote",hidden:true});
 Object.assign(PL,{top,bot,playB,prevB,nextB,pos,scrub,thumbs,tr,cpov,pstat,pnote,ctrBox:ctr});
 const wrap=el("div",{},el("div",{class:"player"},box,scrub,ctr),pnote,pstat,thumbs,det);setTimeout(renderPStat,0);setTimeout(()=>show(true),0);return wrap}
function show(fresh){const n=PL.x.slides[PL.i],f=FR[n],k=Math.min(PL.step,f.length-1);if(fresh){if(PL.srvActive!==n)srvStart(n);paintThumbs()}
 if(fresh){PL.bot.src=f[k];PL.top.src=f[k];PL.top.style.animation="none";PL.top.offsetWidth;PL.top.style.animation=""}else if(PL.top.getAttribute("src")!==f[k]){PL.bot.src=PL.top.getAttribute("src")||f[k];PL.top.style.animation="none";PL.top.offsetWidth;PL.top.style.animation="";PL.top.src=f[k]}
 PL.top.alt=PL.bot.alt="Slide "+n;PL.pos.textContent=`Slide ${PL.i+1} of ${PL.x.slides.length}`;PL.prevB.disabled=PL.i===0;
 const last=PL.i===PL.x.slides.length-1&&PL.step>=f.length-1;PL.nextB.disabled=last;PL.nextB.textContent=PL.step<f.length-1?"Next build":"Next slide";
 [...PL.thumbs.children].forEach((b,j)=>b.setAttribute("aria-current",String(j===PL.i)));
 const segs=SEG[n];PL.tr.textContent="";segs.forEach((s,j)=>PL.tr.append(el("span",{class:j<k?"past":j===k?"now":"",text:s+" "})));
 checkWatched(n)}
function markSeen(n){const M=P.mods[PL.x.id];if(!M.slides.includes(n)){M.slides.push(n);PL.pnote.hidden=true;changed(`${PL.x.id} slide ${n} watched`)}paintThumbs();srvFinish(n)}
function paintThumbs(){if(!PL)return;const M=P.mods[PL.x.id];PL.x.slides.forEach((n,j)=>{const b=PL.thumbs.children[j];if(b)b.classList.toggle("seen",signedIn()?SRV.slides.has(n):M.slides.includes(n))})}
function signedIn(){return !!(sb&&uid)}
function srvStart(n){if(!signedIn()||SRV.slides.has(n))return;PL.srvActive=n;sb.rpc("mg628_start_slide",{p_lab:LAB,p_slide:n}).then(({error})=>{if(error)console.warn(error)})}
const finishing=new Set();
function srvFinish(n){if(!signedIn()||SRV.slides.has(n)||finishing.has(n))return;finishing.add(n);
 sb.rpc("mg628_finish_slide",{p_lab:LAB,p_slide:n}).then(({data,error})=>{finishing.delete(n);if(error||!data)return;
  if(data.counted){SRV.slides.add(n);paintThumbs();renderPStat();const x=PL&&PL.x;if(x&&verifiedIn(x)>=x.slides.length)refreshQuiz(x);return}
  if(!PL||PL.x.slides[PL.i]!==n)return;
  if(data.reason==="not_started"){srvStart(n);setTimeout(()=>{if(PL&&PL.x.slides[PL.i]===n)srvFinish(n)},Math.ceil(0.7*TM[n].dur+1)*1000);return}
  if(data.reason==="too_soon"){PL.pnote.hidden=false;PL.pnote.textContent=`Stay on this slide a little longer for it to count (about ${data.seconds_left} s).`;setTimeout(()=>{if(PL&&PL.x.slides[PL.i]===n){srvFinish(n);PL.pnote.hidden=true}},(data.seconds_left+1)*1000)}})}
function checkWatched(n){if(!PL)return;const M=P.mods[PL.x.id],f=FR[n];if(M.slides.includes(n)&&(!signedIn()||SRV.slides.has(n)))return;if(PL.x.slides[PL.i]!==n||PL.step<f.length-1)return;if((M.sf[n]||0)>=FOCUS_SHARE*TM[n].dur)markSeen(n)}
function renderPStat(){if(!PL)return;const M=P.mods[PL.x.id],fw=(M.watchF||0)+(M.watchU||0);PL.pstat.textContent="";PL.pstat.append(el("span",{},"Slides watched ",el("b",{text:signedIn()?`${verifiedIn(PL.x)} of ${PL.x.slides.length} verified`:`${M.slides.length} of ${PL.x.slides.length}`})),el("span",{},"Narration in focus ",el("b",{text:fw>=10?Math.round(100*(M.watchF||0)/fw)+"%":"—"})),el("span",{},"Checkpoint ",el("b",{text:M.cp?(M.cp.correct?"answered correctly":"answered"):"not reached"})))}
function cpIndex(x){const c=CP[x.id];return c?x.slides.indexOf(c.slide):-1}
function needCP(j){const c=CP[PL.x.id],M=P.mods[PL.x.id];return c&&!M.cp&&j>cpIndex(PL.x)}
function showCP(then){const x=PL.x,c=CP[x.id],M=P.mods[x.id];if(PL.playing)pause();const shown=Date.now();const ov=PL.cpov;ov.textContent="";
 const fb=el("div",{class:"fb",hidden:true,"aria-live":"polite"});const go=el("button",{class:"btn primary",hidden:true,text:"Continue",onclick:()=>{ov.hidden=true;renderPStat();then&&then()}});
 const bs=c.opts.map((o,k)=>el("button",{class:"opt",onclick:()=>{if(M.cp)return;const ok=k===c.ans;M.cp={a:k,correct:ok,ms:Date.now()-shown,at:new Date().toISOString()};
  bs.forEach((b,m)=>{b.disabled=true;if(m===c.ans)b.classList.add("right");else if(m===k)b.classList.add("wrong")});fb.hidden=false;fb.className="fb "+(ok?"good":"bad");fb.textContent=(ok?"Correct. ":"The answer is "+LET[c.ans]+". ")+c.why;go.hidden=false;go.focus();
  changed(`${x.id} checkpoint answered ${LET[k]} (${ok?"correct":"incorrect"}) in ${Math.round((Date.now()-shown)/1000)} s`)}},el("span",{class:"L",text:LET[k]}),el("span",{text:o})));
 ov.append(el("div",{class:"cpcard"},el("h3",{text:"Checkpoint"}),el("p",{class:"sub",text:"Answer to continue. Your first answer is recorded."}),el("p",{class:"stem",style:"font-weight:600;margin:0 0 10px",text:c.stem}),el("div",{class:"opts"},bs),fb,el("div",{style:"margin-top:12px;text-align:right"},go)));
 ov.hidden=false;log(`${x.id} checkpoint shown`);setTimeout(()=>bs[0].focus(),50)}
function goSlide(j){if(j<0||j>=PL.x.slides.length)return;if(needCP(j)){const wasPlaying=PL.playing;showCP(()=>{goSlide(j);if(wasPlaying)play()});return}PL.i=j;PL.step=0;if(PL.playing){aud.currentTime=TM[PL.x.slides[j]].start}show(true)}
function nextStep(){const n=PL.x.slides[PL.i],f=FR[n];if(PL.step<f.length-1){PL.step++;if(hasAudio){const c=TM[n].cues[PL.step-1];aud.currentTime=TM[n].start+c+0.12}show(false);if(PL.step>=f.length-1&&!hasAudio)markSeen(n)}else goSlide(PL.i+1)}
async function play(){const n=PL.x.slides[PL.i],T=TM[n];const rel=PL.step?T.cues[PL.step-1]+0.12:0;try{aud.currentTime=T.start+rel;await aud.play();PL.playing=true;PL.playB.textContent="Pause";log(`${PL.x.id} slide ${n} played`);tick()}catch(e){PL.playB.textContent="Play"}}
function pause(){aud.pause();if(PL){PL.playing=false;PL.playB.textContent="Play"}cancelAnimationFrame(raf);saveLocal();if(remoteOK){clearTimeout(timer);timer=setTimeout(flush,2500)}}
function stopPlayer(){if(PL){pause()}PL=null}
function tick(){if(!PL||!PL.playing)return;const n=PL.x.slides[PL.i],T=TM[n];const rel=aud.currentTime-T.start;
 let k=0;for(const c of T.cues)if(rel>=c)k++;if(k!==PL.step){PL.step=k;show(false)}
 PL.scrub.firstChild.style.width=Math.min(100,100*rel/T.dur)+"%";
 if(rel>=T.dur-0.05){checkWatched(n);const M=P.mods[PL.x.id];if(!M.slides.includes(n)){PL.pnote.hidden=false;PL.pnote.textContent="This slide didn't count as watched because the lab wasn't in focus for most of it. Replay it to count it."}
  if(PL.auto&&PL.i<PL.x.slides.length-1){if(needCP(PL.i+1)){showCP(()=>{PL.i++;PL.step=0;show(true);play()});return}PL.i++;PL.step=0;aud.currentTime=TM[PL.x.slides[PL.i]].start;show(true)}else{pause();return}}
 raf=requestAnimationFrame(tick)}
aud.addEventListener("ended",()=>{if(PL)pause()});
function saveFile(name,text,type){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)}
/* ---------- instructor dashboard ---------- */
let isInstructor=false,classDocs=[],openRow=null,dashTimer=null,dashNote="";
function fmtT(s){s=s||0;const h=Math.floor(s/3600),m=Math.round((s%3600)/60);return h?`${h} h ${m} min`:`${m} min`}
function ago(t){if(!t)return"—";const d=(Date.now()-new Date(t))/60000;return d<1?"just now":d<60?Math.round(d)+" min ago":d<1440?Math.round(d/60)+" h ago":Math.round(d/1440)+" d ago"}
let classAtt=[],classViews=[];const slideMod={};for(const x of C)for(const n of x.slides)slideMod[n]=x.id;
function srvFor(id){const S={quiz:{},warm:{},att:[],views:{},fast:0,late:0};for(const v of classViews)if(v.user_id===id){const m=slideMod[v.slide];S.views[m]=(S.views[m]||0)+1}for(const r of classAtt)if(r.user_id===id){S.att.push(r);if(r.kind==="quiz"){const q=S.quiz[r.module]||{attempts:0,best:0,passed:false,mins:[]};q.attempts++;q.best=Math.max(q.best,r.score);q.passed=q.passed||!!r.passed;const mins=r.created_at&&r.submitted_at?(new Date(r.submitted_at)-new Date(r.created_at))/60000:null;if(mins!=null)q.mins.push(mins);if(r.score>=4&&mins!=null&&mins<1)S.fast++;S.quiz[r.module]=q}else S.warm[r.module]={score:r.score,n:r.n};if(r.late)S.late++};return S}
function totalsFor(D,S){S=S||{quiz:{},warm:{},views:{},fast:0,late:0};const out={mods:[],done:0,tot:0,kcFirst:0,kcN:0,F:0,U:0,away:0,sw:0,st:0,cpN:0,cpOK:0,cpMs:0,mastered:0,quizAttempts:0,warmOK:0,warmN:0,ver:0,fast:S.fast||0,late:S.late||0};
 C.forEach((x,i)=>{const M=(D.mods||{})[x.id]||{slides:[],concepts:[],cards:[],kc:{}};const Q=S.quiz[x.id],W=S.warm[x.id];
  const tot=x.slides.length+x.concepts.length+x.cards.length+x.kc.length+2+(i>0?1:0);const kcDone=x.kc.filter(q=>M.kc&&M.kc[q.id]&&M.kc[q.id].correct).length;
  const vs=(S.views||{})[x.id]||0;out.ver+=vs;const done=vs+(M.concepts||[]).length+(M.cards||[]).length+kcDone+(M.cp?1:0)+(Q&&Q.passed?1:0)+(i>0&&W?1:0);
  out.done+=done;out.tot+=tot;out.F+=M.watchF||0;out.U+=M.watchU||0;out.away+=M.away||0;out.sw+=(M.slides||[]).length;out.st+=x.slides.length;if(M.cp){out.cpN++;if(M.cp.correct)out.cpOK++;out.cpMs+=M.cp.ms||0}
  for(const q of x.kc){const r=M.kc&&M.kc[q.id];if(r&&r.first!=null){out.kcN++;if(r.first)out.kcFirst++}}
  if(Q){out.quizAttempts+=Q.attempts;if(Q.passed)out.mastered++}if(W){out.warmOK+=W.score;out.warmN+=W.n}
  out.mods.push({pct:Math.round(100*done/tot),M,x,Q,W,vs})});
 out.pct=Math.round(100*out.done/out.tot);const fw=out.F+out.U;out.focus=fw>=60?out.F/fw:null;out.cpAcc=out.cpN?out.cpOK/out.cpN:null;out.slidePct=out.ver/out.st;
 out.eng=out.focus==null?null:Math.round(100*(0.5*out.focus+0.3*(out.cpAcc||0)+0.2*out.slidePct));return out}
function renderDash(){const main=$("#main");main.textContent="";
 main.append(el("div",{class:"dash"},el("h1",{text:"Class progress: "+LABINFO.title}),el("p",{class:"lede",style:"color:var(--muted);margin:0",text:"Every student who has signed in. Quiz and warm-up results come from the server; engagement comes from each student's browser. Refreshes every minute."+(dashNote?" "+dashNote:"")})));
 if(!sb){main.append(el("div",{class:"stage empty",text:"Class progress needs the Supabase connection, which isn't configured or reachable."}));return}
 const ids=new Set([...classDocs.map(r=>r.user_id),...classAtt.map(r=>r.user_id),...classViews.map(r=>r.user_id)]);const byId=Object.fromEntries(classDocs.map(r=>[r.user_id,r]));
 const T=[...ids].map(id=>{const r=byId[id]||{};const S=srvFor(id);return{id,D:r.data&&r.data.mods?r.data:{mods:{}},name:r.full_name||r.student_id||r.email||"Student",email:r.student_id?("ID "+r.student_id):(r.email||""),S,t:totalsFor(r.data&&r.data.mods?r.data:{mods:{}},S)}});
 const n=T.length,avg=n?Math.round(T.reduce((a,b)=>a+b.t.pct,0)/n):0;const E=T.filter(r=>r.t.eng!=null);const avgE=E.length?Math.round(E.reduce((a,b)=>a+b.t.eng,0)/E.length)+"%":"—";
 const mast=n?(T.reduce((a,b)=>a+b.t.mastered,0)/n).toFixed(1):"—";
 main.append(el("div",{class:"stats"},el("div",{class:"stat"},el("b",{text:String(n)}),el("span",{text:"Students started"})),el("div",{class:"stat"},el("b",{text:avg+"%"}),el("span",{text:"Average completion"})),el("div",{class:"stat"},el("b",{text:mast+(n?" / 6":"")}),el("span",{text:"Modules mastered, average"})),el("div",{class:"stat"},el("b",{text:avgE}),el("span",{text:"Average engagement"}))));
 main.append(el("p",{style:"font-size:.85rem;color:var(--muted);margin:-6px 0 14px;max-width:80ch",text:"Engagement = 50% narration played with the lab in focus + 30% checkpoints right on the first try + 20% slides verified. No camera is used. A slide is verified on the server when the student stays on it for at least 70% of its narration. Mastery = 4 of 5 on a server-graded quiz drawn for that student. Fast = 4 or 5 correct in under a minute."}));
 main.append(el("div",{style:"display:flex;gap:10px;margin:0 0 12px;flex-wrap:wrap"},el("button",{class:"btn",text:"Refresh",onclick:()=>loadClass(true)}),el("button",{class:"btn",text:"Download CSV",onclick:()=>exportCSV(T)})));
 if(!n){main.append(el("div",{class:"stage empty",text:"No students yet. Each student appears here the first time they sign in and start the lab."}));return}
 const heads=["Student","Overall","Modules 1–6","Slides verified","Mastered","Quiz attempts","Flags","Warm-ups","Engagement","Narration in focus","Checkpoints","Time","Last active"];
 const tb=el("tbody");main.append(el("div",{class:"tablewrap"},el("table",{},el("thead",{},el("tr",{},heads.map(h=>el("th",{scope:"col",text:h})))),tb)));
 T.sort((a,b)=>b.t.pct-a.t.pct);
 for(const r of T){const t=r.t;
  const tr=el("tr",{class:"row",tabindex:"0","aria-expanded":String(openRow===r.id)},el("td",{},el("div",{class:"who"},el("span",{},el("span",{text:r.name}),r.email&&r.email!==r.name?el("small",{style:"display:block;color:var(--muted)",text:r.email}):null))),el("td",{text:t.pct+"%"}),
   el("td",{},el("div",{class:"mini"},t.mods.map((m,i)=>el("i",{title:`Module ${i+1}: ${m.pct}%${m.Q&&m.Q.passed?" · mastered":""}`,class:m.Q&&m.Q.passed?"mast":""},el("span",{style:`width:${m.pct}%`}))))),
   el("td",{text:`${t.ver} of ${t.st}`}),el("td",{text:`${t.mastered} of 6`}),el("td",{text:String(t.quizAttempts)}),el("td",{class:t.fast?"flagcell":"",text:t.fast?`${t.fast} fast high score${t.fast>1?"s":""}`:"—",title:"4 or 5 correct in under a minute"}),el("td",{text:t.warmN?`${t.warmOK} of ${t.warmN}`:"—"}),
   el("td",{text:t.eng==null?"—":t.eng+"%"}),el("td",{text:t.focus==null?"—":Math.round(100*t.focus)+"%"+(t.away?` · left ${t.away}×`:"")}),el("td",{text:t.cpN?`${t.cpOK} of ${t.cpN} right`:"—"}),el("td",{text:fmtT(r.D.timeSec)}),el("td",{text:ago(r.D.updated)}));
  const toggle=()=>{openRow=openRow===r.id?null:r.id;renderDash()};tr.addEventListener("click",toggle);tr.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();toggle()}});tb.append(tr);
  if(openRow===r.id){const g=el("div",{class:"detailgrid"},t.mods.map((m,i)=>{const fw=(m.M.watchF||0)+(m.M.watchU||0);const avgMin=m.Q&&m.Q.mins.length?(m.Q.mins.reduce((a,b)=>a+b,0)/m.Q.mins.length):null;
    return el("div",{},el("b",{text:`${i+1}. ${m.x.title}`}),el("br"),`Slides verified ${m.vs}/${m.x.slides.length} · Concepts ${(m.M.concepts||[]).length}/${m.x.concepts.length} · Cards ${(m.M.cards||[]).length}/${m.x.cards.length}`,el("br"),
     m.Q?`Quiz best ${m.Q.best}/5 in ${m.Q.attempts} attempt${m.Q.attempts===1?"":"s"}${m.Q.passed?" · mastered":""}${avgMin!=null?` · avg ${avgMin.toFixed(1)} min`:""}`:"Quiz not taken",el("br"),
     i>0?(m.W?`Warm-up ${m.W.score}/${m.W.n}`:"Warm-up not done"):"",i>0?el("br"):null,
     
     fw>=30?`In focus ${Math.round(100*(m.M.watchF||0)/fw)}% of ${fmtT(fw)}`:"Narration not played",el("br"),m.M.cp?`Checkpoint ${m.M.cp.correct?"right":"wrong"} in ${Math.round((m.M.cp.ms||0)/1000)} s`:"Checkpoint not reached")}));
   const ev=el("div",{class:"events"},...((r.D.events)||[]).slice(-25).reverse().map(e=>el("div",{text:new Date(e.t).toLocaleString()+" — "+e.e})));
   tb.append(el("tr",{},el("td",{class:"detail",colspan:String(heads.length)},g,el("div",{style:"margin-top:8px;font-size:.82rem;color:var(--muted)",text:r.D.started?`Started ${new Date(r.D.started).toLocaleDateString()} · ${r.D.sessions||1} sessions`:""}),ev)))}}
 // item analysis from server results
 const agg={};for(const a of classAtt)for(const it of (a.results||[])){const k=it.qid;agg[k]=agg[k]||{n:0,ok:0,stem:it.stem,mod:a.module};agg[k].n++;if(it.correct)agg[k].ok++}
 const list=Object.entries(agg).sort((a,b)=>a[1].ok/a[1].n-b[1].ok/b[1].n);
 const items=el("div",{class:"items"},list.map(([k,v])=>el("div",{title:v.stem},el("b",{text:Math.round(100*v.ok/v.n)+"%"}),el("br"),`${k} · ${v.n} answered`,el("br"),el("small",{style:"color:var(--muted)",text:v.stem.replace(/\$[\d,]+|\d+(\.\d+)?/g,"#").slice(0,70)+"…"}))));
 main.append(el("section",{class:"stage"},el("h2",{text:"Question analysis"}),el("p",{class:"lede",text:"Share answered correctly across all quiz and warm-up attempts, hardest first. Generated questions are grouped by template, since each student saw different numbers."}),list.length?items:el("p",{class:"lede",text:"No attempts yet."})))}
async function exportCSV(T){const head=["Student","Student ID or email","Overall %","Slides verified","Modules mastered","Quiz attempts","Fast high scores",...C.map((x,i)=>`M${i+1} best quiz`),"Warm-up correct","Warm-up answered","Engagement %","Narration in focus %","Times left during narration","Checkpoints right","Minutes","Last active"];
 const rows=T.map(r=>{const t=r.t;return[r.name,r.email,t.pct,t.ver,t.mastered,t.quizAttempts,t.fast,...t.mods.map(m=>m.Q?m.Q.best:""),t.warmOK,t.warmN,t.eng==null?"":t.eng,t.focus==null?"":Math.round(100*t.focus),t.away,t.cpOK,Math.round((r.D.timeSec||0)/60),r.D.updated||""]});
 const csv=[head,...rows].map(a=>a.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
 saveFile(`MG628_${LAB}_lab_progress.csv`,csv,"text/csv")}
/* ---------- student download ---------- */
$("#dlBtn").addEventListener("click",async()=>{const lines=["MG628 Regression Lab — progress report","Generated "+new Date().toLocaleString(),"Overall "+overall()+"%","Time on task "+fmtT(P.timeSec),""];
 C.forEach((x,i)=>{const m=modTotals(x);lines.push(`Module ${i+1} ${x.title}: ${m.pct}% | slides ${m.slides}/${x.slides.length}, concepts ${m.concepts}/${x.concepts.length}, cards ${m.cards}/${x.cards.length}, checks ${m.kc}/${x.kc.length}, quiz ${m.quiz==null?"not taken":m.quiz+"/5"}`)});
 saveFile(`MG628_${LAB}_lab_my_progress.txt`,lines.join("\n"),"text/plain")});
/* ---------- boot ---------- */
function loadLocalFor(key){try{const s=JSON.parse(localStorage.getItem(key)||"null");return s&&s.mods?s:null}catch(e){return null}}
(function initLocal(){const s=loadLocalFor(LS);if(s){P=merge(P,s);P.sessions=(s.sessions||0)+1}})();
route();renderProgress();
let classTimer=null;
async function loadClass(force){if(!sb||!isInstructor)return;const[p,a,v]=await Promise.all([sb.from("mg628_progress").select("user_id,email,full_name,student_id,data,updated_at").eq("lab",LAB).order("updated_at",{ascending:false}),
 sb.from("mg628_attempts").select("user_id,module,kind,score,n,passed,late,results,created_at,submitted_at").eq("lab",LAB).not("submitted_at","is",null),sb.from("mg628_slide_views").select("user_id,slide").eq("lab",LAB)]);
 const err=p.error||a.error||v.error;if(err){dashNote="Some class data couldn't be loaded ("+err.message+").";}else dashNote="";
 classDocs=p.data||[];classAtt=a.data||[];classViews=v.data||[];
 if(location.hash==="#class")renderDash()}
addEventListener("hashchange",()=>{clearInterval(classTimer);if(location.hash==="#class"&&isInstructor){loadClass();classTimer=setInterval(loadClass,60000)}});
function PRIVACY_TEXT(){return `What the lab records: your Student ID, name and roster section, which slides and activities you complete, your checkpoint, warm-up and quiz answers and scores, and activity such as time in the lab and when you switch away from it. Only you and ${CFG.instructorName||"your instructor"} can see your records. They are stored in the course's Supabase database, are not shared or sold, and are used only to support your learning in this course. No camera or microphone is used.`+(CFG.privacyContact?` Questions: ${CFG.privacyContact}.`:"")}
function privacyDialog(){const ov=el("div",{class:"auth",role:"dialog","aria-modal":"true","aria-labelledby":"privh"});const close=()=>ov.remove();ov.addEventListener("click",e=>{if(e.target===ov)close()});
 ov.append(el("div",{class:"authcard"},el("h2",{id:"privh",text:"Privacy"}),el("p",{text:PRIVACY_TEXT()}),el("button",{class:"btn primary",text:"Close",onclick:close})));document.body.append(ov)}
const PORTAL="https://monroeu.github.io/student/";
async function studentAuth(action,student_id,password){
 const r=await fetch(CFG.supabaseUrl+"/functions/v1/student-auth-api",{method:"POST",headers:{"Content-Type":"application/json",apikey:CFG.supabaseAnonKey,Authorization:"Bearer "+CFG.supabaseAnonKey},body:JSON.stringify({action,student_id,password})});
 let d=null;try{d=await r.json()}catch(e){}
 if(!r.ok||(d&&d.error))throw new Error((d&&d.error)||"Student account service error ("+r.status+")");
 if(d&&d.must_change_password){location.href=PORTAL;throw new Error("Your temporary password must be changed in the Student Portal first.")}
 if(d&&d.session&&d.session.access_token&&d.session.refresh_token){const{error}=await sb.auth.setSession({access_token:d.session.access_token,refresh_token:d.session.refresh_token});if(error)throw error}
 return d}
function authPanel(message){document.querySelectorAll(".auth").forEach(n=>n.remove());const ov=el("div",{class:"auth",role:"dialog","aria-modal":"true","aria-labelledby":"authh"});
 const sid=el("input",{type:"text",id:"authSid",required:true,autocomplete:"username",inputmode:"text"});const pw=el("input",{type:"password",id:"authPw",required:true,autocomplete:"current-password",minlength:"8"});
 const msg=el("p",{class:"authmsg","aria-live":"polite",text:message||""});
 const signin=el("button",{class:"btn primary",type:"submit",text:"Sign in"});const reg=el("button",{class:"btn",type:"button",text:"First time? Create account"});
 const go=async action=>{const id=sid.value.trim(),p=pw.value;if(!id){msg.textContent="Enter your Student ID.";return}if(p.length<8){msg.textContent="Password must be at least 8 characters.";return}
  signin.disabled=reg.disabled=true;msg.textContent=action==="login"?"Signing in…":"Checking the roster and creating your account…";
  try{if(id.includes("@")){if(action!=="login"){msg.textContent="Instructor accounts sign in with email and password; there is nothing to create here.";return}const{error}=await sb.auth.signInWithPassword({email:id.toLowerCase(),password:p});if(error)throw error;pw.value="";const{data:{session:s2}}=await sb.auth.getSession();if(s2)await onSignedIn(s2);return}
   const d=await studentAuth(action,id,p);pw.value="";if(action==="register"&&d&&d.needs_sign_in){msg.textContent=d.message||"Account created. Sign in with your Student ID and password.";return}
   const{data:{session:s}}=await sb.auth.getSession();if(s)await onSignedIn(s);else msg.textContent="Signed in, but no session was returned. Try again."}
  catch(e){msg.textContent=e.message||String(e)}finally{signin.disabled=reg.disabled=false}};
 const form=el("form",{},el("label",{for:"authSid",text:"Student ID (instructors: email)"}),sid,el("label",{for:"authPw",text:"Password"}),pw,signin,reg,msg);
 form.addEventListener("submit",e=>{e.preventDefault();go("login")});reg.addEventListener("click",()=>go("register"));
 ov.append(el("div",{class:"authcard"},el("h2",{id:"authh",text:"Student Login"}),el("p",{text:"Use your Monroe University Student ID. This is the same account used across Professor Kassoh's course labs; your name and section come from the class roster."}),form,
  el("p",{class:"wc",style:"margin:10px 0 0"},el("a",{href:PORTAL,target:"_blank",rel:"noopener noreferrer",text:"Forgot password? Open the Student Portal"})),
  el("details",{class:"privacy"},el("summary",{text:"What the lab records and who sees it"}),el("p",{text:PRIVACY_TEXT()})),
  el("button",{class:"linkbtn",text:"Continue without signing in",onclick:()=>{ov.remove();setNotice("local")}})));document.body.append(ov);setTimeout(()=>sid.focus(),50)}
let studentId="",onRoster=false,offering=null,pSession=null;
async function papi(action,body){const{data,error}=await sb.functions.invoke("participation-api",{body:Object.assign({action},body||{})});if(error)throw new Error(error.message||"Participation service error");if(data&&data.error)throw new Error(data.error);return data}
async function startParticipation(){try{let res=await papi("resume_session",{offering_id:offering.id});pSession=res&&res.session||null;
 if(!pSession){const st=await papi("start_session",{offering_id:offering.id,track:"all"});pSession=st&&st.session||null}
 if(pSession&&window.MonroeActiveTime&&window.MonroeActiveTime.init)window.MonroeActiveTime.init({session:()=>pSession?pSession.id:null,token:async()=>{const{data:{session:x}}=await sb.auth.getSession();return x?x.access_token:null},engaged:()=>!aud.paused&&document.visibilityState==="visible"});
 log("participation session "+(pSession?"active":"unavailable"))}catch(e){console.warn("Participation session:",e)}}
async function rosterLookup(){try{const{data,error}=await sb.functions.invoke("participation-api",{body:{action:"bootstrap"}});if(error||!data||data.error)return null;return data}catch(e){return null}}
let signingIn=false;
async function onSignedIn(s){if(signingIn)return;signingIn=true;try{session=s;uid=s.user.id;userEmail=s.user.email||"";
 document.querySelectorAll(".auth").forEach(n=>n.remove());
 try{const{data:inst}=await sb.rpc("mg628_is_instructor");isInstructor=!!inst}catch(e){}
 const r=await rosterLookup();
 userName=(r&&r.user&&r.user.full_name)||(s.user.user_metadata&&s.user.user_metadata.full_name)||"";studentId=(r&&r.user&&r.user.institutional_id)||"";
 const aid=CFG.participationAssignmentId;
 if(aid&&r){offering=(r.offerings||[]).find(o=>o.assignment&&o.assignment.id===aid&&(r.enrollments||[]).some(e=>e.section_id===o.section_id))||null;onRoster=!!offering}
 else onRoster=!!(r&&(r.enrollments||[]).some(e=>/MG\s*-?\s*628/i.test((e.section&&e.section.course&&e.section.course.code)||"")));
 $("#whoami").textContent=userName||studentId||userEmail;$("#signOut").hidden=false;
 if(!onRoster&&!isInstructor){remoteOK=false;setNotice(null);const n=$("#notice"),t=$("#noticeText");n.hidden=false;
  t.textContent=r?(CFG.participationAssignmentId?"You're signed in, but "+(LABINFO.week||"this lab")+" hasn't been published for your MG628 section yet, so your work here is saved in this browser only. Check back later or contact Professor Kassoh.":"You're signed in, but this Student ID isn't on an MG628 roster, so your work here is saved in this browser only. Contact Professor Kassoh if you think this is a mistake."):"You're signed in, but the class roster couldn't be checked right now. Your work is saved in this browser; reload the page later to record it.";$("#dlBtn").hidden=false;route();renderProgress();return}
 const guest=loadLocalFor(LS);LS=LS_BASE+":"+uid;const mine=loadLocalFor(LS);P=blank();if(mine)P=merge(P,mine);if(guest){P=merge(P,guest);try{localStorage.removeItem(LS_BASE+":guest")}catch(e){}}
 const{data,error}=await sb.from("mg628_progress").select("data").eq("user_id",uid).eq("lab",LAB).maybeSingle();
 if(!error&&data&&data.data&&data.data.mods)P=merge(P,data.data);P.sessions=(P.sessions||1)+1;
 saveLocal();remoteOK=true;await flush();await loadMine();if(offering)startParticipation();
 $("#classBtn").hidden=!isInstructor;if(isInstructor){loadClass();if(location.hash==="#class")classTimer=setInterval(loadClass,60000)}
 route();renderProgress()}finally{signingIn=false}}
(async()=>{if(!window.supabase||!CFG.supabaseUrl||!CFG.supabaseAnonKey||CFG.supabaseUrl.includes("YOUR-")){setNotice("local");return}
 sb=window.supabase.createClient(CFG.supabaseUrl,CFG.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 $("#signOut").addEventListener("click",async()=>{await flush();await sb.auth.signOut();location.replace(location.pathname+location.search)});
 const{data:{session:s}}=await sb.auth.getSession();
 if(s)await onSignedIn(s);else authPanel();
 sb.auth.onAuthStateChange((ev,s2)=>{if(ev==="SIGNED_OUT"){uid=null;remoteOK=false}})})();
$("#privacyBtn").addEventListener("click",privacyDialog);
addEventListener("pagehide",()=>{saveLocal();if(remoteOK)flush()});
