/* Monroe University centralized participation PDF renderer, v1.1.
   Client-side formatting only: never changes grades, authentication, or Supabase data.
   Trust status and active time provenance must come from the authenticated adapter. */
(function(global){
 'use strict';
 const clean=x=>String(x==null?'':x).replace(/\r/g,'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,' ').trim();
 const array=x=>Array.isArray(x)?x:[];
 function formatDuration(seconds){
  if(!Number.isFinite(Number(seconds)) || Number(seconds)<0)return null;
  const n=Math.floor(Number(seconds));
  return [Math.floor(n/3600)+'h',Math.floor(n%3600/60)+'m',n%60+'s'].join(' ');
 }
 function timeLabel(data){
  // The adapter's time_note is the authoritative presentation string. It must
  // originate from an authenticated server read, not the browser-open duration.
  if(clean(data.time_note))return clean(data.time_note);
  const seconds=data.active_time_seconds??data.active_seconds;
  const trusted=data.active_time_verified===true || data.active_time_source==='supabase';
  const formatted=trusted&&seconds!=null?formatDuration(seconds):null;
  return formatted===null?'Not centrally measured yet (not zero)':'Recorded cumulative active time (Supabase): '+formatted;
 }
 function render(data){
  data=data||{};
  if(!global.jspdf?.jsPDF)throw new Error('PDF library did not load. Please reconnect and retry.');
  const doc=new global.jspdf.jsPDF({unit:'pt',format:'letter'});
  const W=612,H=792,M=46,R=W-M,WIDTH=W-M*2;
  let y=48,page=1;
  const brand=[11,79,60],ink=[25,37,32],muted=[82,101,91];
  const footer=()=>{doc.setDrawColor(210,222,215);doc.line(M,H-42,R,H-42);doc.setTextColor(...muted);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text('Monroe University | Student participation record | Generated '+new Date().toLocaleString(),M,H-28);doc.text(String(page),R,H-28,{align:'right'});};
  const newPage=()=>{footer();doc.addPage();page++;y=48;};
  const room=n=>{if(y+n>H-64)newPage();};
  const text=(s,{size=10,bold=false,color=ink,indent=0,gap=6}={})=>{
   doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(...color);
   const lines=doc.splitTextToSize(clean(s)||'—',WIDTH-indent),lh=size*1.45;
   for(const line of lines){room(lh+2);doc.text(line,M+indent,y);y+=lh;}
   y+=gap;
  };
  const title=s=>{room(39);y+=10;doc.setDrawColor(...brand);doc.line(M,y,R,y);y+=22;text(s,{size:13,bold:true,color:brand,gap:4});};
  doc.setFillColor(...brand);doc.rect(0,0,W,9,'F');
  text('MONROE UNIVERSITY',{size:10,bold:true,color:brand,gap:3});
  text('Participation activity report',{size:19,bold:true,gap:4});
  text(clean(data.course)+'  |  '+clean(data.lab),{size:11,color:muted,gap:10});
  const fields=[
   ['Student',data.student_name],['Student ID',data.student_id],
   ['Section / Term',[data.section,data.term].filter(Boolean).join(' / ')],
   ['Status',data.status||'In progress'],
   ['Completion',data.completion_percent==null?'Not reported':String(data.completion_percent)+'%'],
   ['Participation grade',data.grade==null?'Not reported':String(data.grade)],
   ['Recorded active time',timeLabel(data)],['Generated',new Date().toLocaleString()]
  ];
  for(const [k,v] of fields)text(k+': '+clean(v),{size:10,gap:1});
  title('Activity summary');
  text('Flip cards visited: '+clean(data.cards_summary||'Not available'));
  text('MCQs answered: '+clean(data.mcq_summary||'Not available'));
  text('Written responses: '+clean(data.written_summary||'Not available'));
  text('Required exercises: '+clean(data.exercise_summary||'Not available'));
  if(data.verification_code)text('Verification code: '+clean(data.verification_code));
  if(data.notes)text(clean(data.notes),{color:muted,size:9});
  title('Flip-card activity');
  const cards=array(data.cards);
  if(!cards.length)text('No card activity available in this snapshot.');
  for(const [i,c] of cards.entries())text((i+1)+'. '+clean(c.title||c.key||'Card')+' — '+clean(c.visited?'Visited':'Not visited'),{size:9,gap:2});
  title('Multiple-choice responses');
  const mcqs=array(data.mcqs);
  if(!mcqs.length)text('No MCQ responses available in this snapshot.');
  for(const [i,q] of mcqs.entries()){
   text((i+1)+'. '+clean(q.prompt||q.key||'Question'),{bold:true,size:9,gap:2});
   text('Selected: '+clean(q.selected||'Not answered')+(q.correctness===true?' (Correct)':q.correctness===false?' (Incorrect)':''),{size:9,indent:9,gap:4});
  }
  title('Written responses');
  const writes=array(data.written);
  if(!writes.length)text('No written response available in this snapshot.');
  for(const [i,a] of writes.entries()){
   text((i+1)+'. '+clean(a.prompt||a.key||'Written activity'),{size:9,bold:true,gap:2});
   text(clean(a.response)||'Not answered',{size:9,indent:9,gap:6});
  }
  title('Other exercises');
  const extra=array(data.exercises);
  if(!extra.length)text('No additional exercise details available.');
  for(const [i,a] of extra.entries())text((i+1)+'. '+clean(a.title||a.key||'Exercise')+': '+clean(a.status||'Not recorded'),{size:9,gap:3});
  /* The authoritative-record and non-submission caveats are already shown in the summary.
     Do not repeat them here: the duplicate block could create an orphan fourth page. */
  footer();
  const safe=clean([data.course,data.lab,data.student_id].filter(Boolean).join('_')).replace(/[^a-zA-Z0-9_-]+/g,'_').slice(0,110)||'Monroe_Participation';
  doc.save(safe+'_Participation.pdf');
 }
 global.MonroeParticipationPDF={version:'1.2',download:render};
})(window);
