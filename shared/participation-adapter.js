/* Monroe University: shared, non-invasive participation report adapter v1.1. */
(function(){'use strict';
 const config=window.MONROE_PDF_CONFIG||{};
 const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
 const visible=el=>!!(el&&el.getClientRects().length);
 const clean=s=>String(s==null?'':s).replace(/\s+/g,' ').trim();
 const limit=(s,n=5000)=>clean(s).slice(0,n);
 const main=document.querySelector('main')||document.body;
 const findName=()=>{
  for(const id of ['studentName','student-name','student-name-display','displayName']){
   const e=document.getElementById(id);if(e&&clean(e.textContent||e.value))return limit(e.textContent||e.value,120);
  }
  const label=$('[data-student-name]');return label?limit(label.dataset.studentName,120):'Not available in this page';
 };
 const findId=()=>{
  for(const id of ['studentId','student-id','studentID','institutionalId']){
   const e=document.getElementById(id);if(e&&clean(e.value||e.textContent))return limit(e.value||e.textContent,50);
  }
  const e=$('[data-student-id]');return e?limit(e.dataset.studentId,50):'Not available';
 };
 const started=Date.now();let activeMs=0,lastTick=Date.now();
 const storageKey=()=>['monroe-pdf-active-v1',config.course,config.week,findId()].join(':');
 function foregroundTick(){const now=Date.now();if(!document.hidden){activeMs+=Math.min(now-lastTick,15000)}lastTick=now}
 document.addEventListener('visibilitychange',()=>{foregroundTick()});
 function readTime(){foregroundTick();let previous=0;try{previous=Number(localStorage.getItem(storageKey()))||0;localStorage.setItem(storageKey(),String(previous+activeMs));activeMs=0}catch(e){}return previous+activeMs}
 function cardData(){
  const nodes=$$('[data-card-key], .flip, .flashcard, .study-card, [data-flip-id]');
  const uniq=new Set();return nodes.filter(x=>{if(x.closest('.card-example'))return false;const k=x.dataset.cardKey||x.dataset.flipId||x.id||limit(x.textContent,50);if(uniq.has(k))return false;uniq.add(k);return true}).map((x,i)=>({key:x.dataset.cardKey||x.dataset.flipId||('card-'+(i+1)),title:limit($('h3,h4,.card-title,.front',x)?.textContent||x.textContent,95),visited:x.classList.contains('flipped')||x.classList.contains('is-flipped')||x.classList.contains('visited')||x.getAttribute('aria-pressed')==='true'}));
 }
 function questions(){return $$('[data-question-key],.mc-card,.mcq-card,.quiz-question,fieldset').filter(x=>!x.closest('[data-question-key] [data-question-key]')).map((x,i)=>{
  const selected=$('input[type=radio]:checked',x);const sel=selected?clean(selected.closest('label')?.textContent||selected.value):'';
  return {key:x.dataset.questionKey||x.id||('question-'+(i+1)),prompt:limit($('h3,h4,legend,.question-text',x)?.textContent||x.textContent,240),selected:sel||'Not answered'};
 });}
 function writings(){const arr=$$('textarea:not([type=password]), input[data-answer], [contenteditable=true]');return arr.filter(x=>!x.closest('[data-pdf-report-ui]')).map((x,i)=>({key:x.dataset.answer||x.id||('written-'+(i+1)),prompt:limit(x.closest('label')?.textContent||x.getAttribute('aria-label')||x.placeholder||'Written activity',150),response:limit(x.value||x.textContent||'',2500)}));}
 function exercises(){return $$('[data-live-key]').map(x=>({key:x.dataset.liveKey,title:limit($('h3,h4',x)?.textContent||x.dataset.liveKey,100),status:x.classList.contains('passed')?'Passed / recorded':'Not recorded'}));}
 const fmt=(a,b)=>`${a}/${b}`;
 function report(){const cards=cardData(),mcqs=questions(),written=writings(),extras=exercises(),active=readTime();
  const data={course:config.course||'Monroe University',lab:config.lab||document.title,student_name:findName(),student_id:findId(),section:'See server record',term:config.term||'Fall 2026',status:'Snapshot - may be incomplete',completion_percent:null,grade:null,cards_summary:cards.length?fmt(cards.filter(x=>x.visited).length,cards.length):'Not detected',mcq_summary:mcqs.length?fmt(mcqs.filter(x=>x.selected!=='Not answered').length,mcqs.length):'Not detected',written_summary:written.length?fmt(written.filter(x=>x.response).length,written.length):'Not detected',exercise_summary:extras.length?fmt(extras.filter(x=>x.status.startsWith('Passed')).length,extras.length):'Not detected',cards,mcqs,written,exercises:extras,time_note:'Foreground time since this reporting feature was installed: '+Math.round(active/60000)+' min (estimate; not verified active engagement)',notes:'Current-page snapshot only. Some saved historical answers may not be displayed in the page; use the existing lab submission and Supabase records as authoritative.'};
  return data;
 }
 function attach(){
  if(document.getElementById('monroe-shared-pdf-button'))return;
  const root=document.createElement('div');root.dataset.pdfReportUi='true';root.style.cssText='margin:18px auto;padding:12px;max-width:850px;border:1px solid #b5c9bf;background:#f4fbf7;color:#163f32;font-family:Arial,sans-serif;font-size:15px;';
  const btn=document.createElement('button');btn.type='button';btn.id='monroe-shared-pdf-button';btn.textContent='Download My Work (PDF) — Anytime';btn.style.cssText='background:#0b4f3c;color:#fff;border:0;border-radius:5px;padding:13px 16px;min-height:46px;font-weight:700;cursor:pointer;max-width:100%;white-space:normal;';
  const info=document.createElement('div');info.setAttribute('role','status');info.style.cssText='margin-top:8px;font-size:12px;line-height:1.45;';info.textContent='Downloads a snapshot of the activities currently visible in this lab. Your existing Supabase participation record is unchanged.';
  btn.addEventListener('click',()=>{try{if(!window.MonroeParticipationPDF)throw Error('The shared report engine could not be loaded.');window.MonroeParticipationPDF.download(report());info.textContent='PDF prepared. Check your browser downloads. This does not submit the assignment.';}catch(e){info.textContent='PDF generation failed: '+(e?.message||String(e));}});
  root.append(btn,info);(document.querySelector('main')||document.body).appendChild(root);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attach);else attach();
})();
