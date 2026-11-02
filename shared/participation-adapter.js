/* Monroe University: non-invasive participation report adapter v1.4.
   Server-verified active time only; no local foreground-time claims. */
(function(){'use strict';
 const config=window.MONROE_PDF_CONFIG||{};
 const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
 const clean=s=>String(s==null?'':s).replace(/\s+/g,' ').trim();
 const limit=(s,n=5000)=>clean(s).slice(0,n);
 const elText=id=>{const e=document.getElementById(id);return clean(e?.value||e?.textContent||'');};
 const hasVerifiedRoster=()=>!!document.querySelector('#academic-identity:not([hidden]) .server-badge')&&elText('ai-student')!=='—';
 const findName=()=>hasVerifiedRoster()?limit(elText('ai-student'),120):'Not available — sign in and verify roster';
 const findId=()=>hasVerifiedRoster()?limit(elText('ai-student-id'),50):'Not available — sign in';
 const findSection=()=>hasVerifiedRoster()?elText('ai-section'):'Not verified';
 const findTerm=()=>hasVerifiedRoster()?elText('ai-term'):(config.term||'Fall 2026');
 const findCompletion=()=>{if(!hasVerifiedRoster())return null;const m=elText('stdProgressText').match(/^([0-9]+(?:\.[0-9]+)?)%$/);return m?Number(m[1]):null;};
 const findStatus=()=>{if(!hasVerifiedRoster())return 'Snapshot — identity unverified';const text=elText('server-progress');const m=text.match(/status\s+(COMPLETE|INCOMPLETE|IN_PROGRESS|OVERRIDDEN)/i);return m?m[1]:'In progress — see server record';};
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
 let centralSeconds=null;
 document.addEventListener('monroe:active-time',ev=>{const x=Number(ev.detail?.seconds);if(Number.isSafeInteger(x)&&x>=0)centralSeconds=x;});
 function recordedSeconds(){
  const tracker=window.MonroeActiveTime?.current;
  const n=tracker&&typeof tracker.getSeconds==='function'?tracker.getSeconds():centralSeconds;
  return Number.isSafeInteger(n)&&n>=0?n:null;
 }
 function timeLabel(){const seconds=recordedSeconds();if(seconds===null)return 'Recorded active time: Not centrally measured yet (do not treat as zero).';
  return 'Recorded cumulative active time (Supabase): '+Math.floor(seconds/3600)+'h '+String(Math.floor(seconds%3600/60)).padStart(2,'0')+'m '+String(seconds%60).padStart(2,'0')+'s';}
 async function report(){const cards=cardData(),mcqs=questions(),written=writings(),extras=exercises();
  const data={course:config.course||'Monroe University',lab:config.lab||document.title,student_name:findName(),student_id:findId(),section:findSection(),term:findTerm(),status:findStatus(),completion_percent:findCompletion(),grade:null,cards_summary:cards.length?fmt(cards.filter(x=>x.visited).length,cards.length):'Not detected',mcq_summary:mcqs.length?fmt(mcqs.filter(x=>x.selected!=='Not answered').length,mcqs.length):'Not detected',written_summary:written.length?fmt(written.filter(x=>x.response).length,written.length):'Not detected',exercise_summary:extras.length?fmt(extras.filter(x=>x.status.startsWith('Passed')).length,extras.length):'Not detected',cards,mcqs,written,exercises:extras,time_note:timeLabel(),notes:'This is a current-page snapshot. Previously saved answers may not be shown in this page view; the server record is authoritative. The participation grade is not independently retrieved by this PDF adapter and is therefore not reported. Historical time not measured centrally is unavailable.'};
  if(typeof window.MonroeReportContext==='function'){
    const trusted=await window.MonroeReportContext();
    Object.assign(data,trusted);
    if(trusted.active_time_verified && trusted.active_time_seconds!=null){
      const seconds=trusted.active_time_seconds;
      data.time_note='Recorded cumulative active time (Supabase): '+Math.floor(seconds/3600)+'h '+String(Math.floor(seconds%3600/60)).padStart(2,'0')+'m '+String(seconds%60).padStart(2,'0')+'s';
    }else{
      data.time_note='Not centrally measured for this session (not zero)';
    }
  }
  return data;
 }
 function attach(){
  if(document.getElementById('monroe-shared-pdf-button'))return;
  const root=document.createElement('div');root.dataset.pdfReportUi='true';root.style.cssText='margin:18px auto;padding:12px;max-width:850px;border:1px solid #b5c9bf;background:#f4fbf7;color:#163f32;font-family:Arial,sans-serif;font-size:15px;';
  const btn=document.createElement('button');btn.type='button';btn.id='monroe-shared-pdf-button';btn.textContent='Download My Work (PDF) — Anytime';btn.style.cssText='background:#0b4f3c;color:#fff;border:0;border-radius:5px;padding:13px 16px;min-height:46px;font-weight:700;cursor:pointer;max-width:100%;white-space:normal;';
  const info=document.createElement('div');info.setAttribute('role','status');info.style.cssText='margin-top:8px;font-size:12px;line-height:1.45;';info.textContent='Downloads a snapshot of the activities currently visible in this lab. Your existing Supabase participation record is unchanged.';
  btn.addEventListener('click',async()=>{btn.disabled=true;info.textContent='Retrieving verified student participation and study time…';try{if(!window.MonroeParticipationPDF)throw Error('The shared report engine could not be loaded.');const data=await report();window.MonroeParticipationPDF.download(data);info.textContent='PDF prepared with the latest available authenticated server record. This does not submit the assignment.';}catch(e){info.textContent='PDF generation failed: '+(e?.message||String(e));}finally{btn.disabled=false;}});
  root.append(btn,info);(document.querySelector('main')||document.body).appendChild(root);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attach);else attach();
})();
