
const SUPABASE_URL='https://irnrjzeejalbbqdrbzmj.supabase.co';
const SUPABASE_KEY='sb_publishable_aj2vpjfJrSMvjTxcKuC0pQ_pf7JbDo2';
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:false,autoRefreshToken:true,detectSessionInUrl:false}});
const API=SUPABASE_URL+'/functions/v1/instructor-api';
let session=null, bootstrap=null, csvRows=[], csvFileName='';
const $=id=>document.getElementById(id);
function formatErr(e){
  if(e==null)return 'Unknown error';
  if(typeof e==='string')return e;
  if(e instanceof Error)return formatErr(e.message);
  if(typeof e==='object'){
    if(e.error!==undefined)return formatErr(e.error);
    if(e.message!==undefined)return formatErr(e.message);
    if(e.context!==undefined)return formatErr(e.context);
    try{return JSON.stringify(e)}catch{return String(e)}
  }
  return String(e)
}
function msg(id,text,type=''){const e=$(id);e.textContent=formatErr(text);e.className='notice '+type;e.classList.remove('hidden')}
function clearMsg(id){$(id).classList.add('hidden')}
async function api(action,payload={}){
  if(!session)throw new Error('Sign in required');
  const r=await fetch(API,{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token},body:JSON.stringify({action,...payload})});
  const raw=await r.text();
  let j={};
  if(raw){try{j=JSON.parse(raw)}catch{j={error:raw}}}
  if(!r.ok){const detail=j&&j.error!==undefined?formatErr(j.error):formatErr(j);throw new Error(`Instructor API ${r.status}: ${detail}`)}
  return j
}
function showLogin(message=''){
  $('authCheck').classList.add('hidden');
  $('app').classList.add('hidden');
  $('loginPanel').classList.remove('hidden');
  if(message)msg('loginMsg',message,'error');
}
async function init(){
  // Instructor access is intentionally non-persistent. Every fresh page visit
  // requires an explicit sign-in, even if another page on this site has a
  // Supabase session. This avoids silently reopening the admin dashboard.
  session=null;
  $('authCheck').classList.add('hidden');
  $('app').classList.add('hidden');
  $('loginPanel').classList.remove('hidden');
  clearMsg('loginMsg');
}
async function loadApp(){
  try{
    bootstrap=await api('bootstrap');
    $('authCheck').classList.add('hidden');
    $('loginPanel').classList.add('hidden');
    $('app').classList.remove('hidden');
    $('signOut').classList.remove('hidden');
    $('who').textContent=(bootstrap.profile.full_name||bootstrap.profile.email)+' · '+bootstrap.profile.app_role.toUpperCase();
    renderAcademic();
    if(!bootstrap.sections.length)throw new Error('No sections are assigned to this instructor account.');
    await refreshAll();
  }catch(e){
    await sb.auth.signOut();session=null;showLogin(formatErr(e));
  }
}
function sectionLabel(s){return `${s.term.name} · ${s.course.code}-${s.section_code}`}
function selectedSection(){return (bootstrap?.sections||[]).find(s=>s.id===$('sectionSelect').value)||null}
function renderAcademic(){const sel=$('sectionSelect'),keep=sel.value||localStorage.getItem('mg628InstructorSection')||'';sel.innerHTML='';const rows=(bootstrap.sections||[]).slice().sort((a,b)=>{const ad=a.term.start_date||'',bd=b.term.start_date||'';return bd.localeCompare(ad)||a.course.code.localeCompare(b.course.code)||a.section_code.localeCompare(b.section_code)});rows.forEach(s=>{const o=document.createElement('option');o.value=s.id;o.textContent=sectionLabel(s);sel.appendChild(o)});if(keep&&[...sel.options].some(o=>o.value===keep))sel.value=keep;else{const preferred=rows.find(s=>s.course.code==='MG628'&&s.section_code==='159W'&&s.term.code==='2026FA');if(preferred)sel.value=preferred.id}const cs=$('newSectionCourse'),ts=$('newSectionTerm');cs.innerHTML='';ts.innerHTML='';(bootstrap.courses||[]).forEach(c=>{const o=document.createElement('option');o.value=c.id;o.textContent=`${c.code} · ${c.title||''}`;cs.appendChild(o)});(bootstrap.terms||[]).forEach(t=>{const o=document.createElement('option');o.value=t.id;o.textContent=t.name;ts.appendChild(o)});renderExistingSections();updateRosterTarget()}

async function reloadBootstrap(){bootstrap=await api('bootstrap');renderAcademic();await refreshAll()}
async function refreshAll(){await Promise.all([loadRoster(),loadResults()])}
$('signIn').onclick=async()=>{clearMsg('loginMsg');const {data,error}=await sb.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});if(error)return msg('loginMsg',error.message,'error');session=data.session;await loadApp()};
$('signOut').onclick=async()=>{await sb.auth.signOut();location.reload()};
$('forgot').onclick=async()=>{const email=$('email').value.trim();if(!email)return msg('loginMsg','Enter your email first.','error');const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.href});msg('loginMsg',error?error.message:'Password reset email requested.',error?'error':'ok')};

document.querySelectorAll('.setup-step').forEach(btn=>btn.onclick=()=>{document.querySelectorAll('.setup-step').forEach(x=>x.classList.toggle('active',x===btn));['course','term','section'].forEach(k=>$('setup-'+k).classList.toggle('hidden',k!==btn.dataset.setup));});
function renderExistingSections(){const host=$('existingSections');if(!host)return;host.innerHTML='';const rows=(bootstrap.sections||[]).slice().sort((a,b)=>(a.term.name+a.course.code+a.section_code).localeCompare(b.term.name+b.course.code+b.section_code));if(!rows.length){host.innerHTML='<div class="muted">No sections configured yet.</div>';return}for(const s of rows){const d=document.createElement('div');d.className='section-chip';const code=s.course.code+'-'+s.section_code;const when=[s.campus,s.meeting_day,s.start_time&&s.end_time?String(s.start_time).slice(0,5)+'–'+String(s.end_time).slice(0,5):''].filter(Boolean).join(' · ');d.innerHTML=`<div><strong>${esc(s.term.name)} · ${esc(code)}</strong><small>${esc(s.title||s.course.title||'')}${when?' · '+esc(when):''}</small></div><span class="badge ${s.status==='active'?'ok':'warn'}">${esc(s.status)}</span>`;host.appendChild(d)}}
$('createCourse').onclick=async()=>{try{await api('create_course',{code:$('newCourseCode').value,title:$('newCourseTitle').value});msg('setupMsg','Course saved.','ok');await reloadBootstrap()}catch(e){msg('setupMsg',formatErr(e),'error')}};
$('createTerm').onclick=async()=>{try{await api('create_term',{code:$('newTermCode').value,name:$('newTermName').value,start_date:$('newTermStart').value,end_date:$('newTermEnd').value});msg('setupMsg','Academic term saved.','ok');await reloadBootstrap()}catch(e){msg('setupMsg',formatErr(e),'error')}};
$('createSection').onclick=async()=>{try{await api('create_section',{course_id:$('newSectionCourse').value,term_id:$('newSectionTerm').value,section_code:$('newSectionCode').value,display_code:$('newSectionDisplay').value,title:$('newSectionTitle').value,campus:$('newSectionCampus').value,meeting_day:$('newSectionDay').value,start_time:$('newSectionStartTime').value,end_time:$('newSectionEndTime').value,section_start_date:$('newSectionStartDate').value,section_end_date:$('newSectionEndDate').value,location:$('newSectionLocation').value,seat_capacity:$('newSectionCapacity').value,seats_available:$('newSectionAvailable').value,waitlist_count:$('newSectionWaitlist').value,status:$('newSectionStatus').value});msg('setupMsg','Section saved and added to the section selector.','ok');await reloadBootstrap()}catch(e){msg('setupMsg',formatErr(e),'error')}};

$('sectionSelect').onchange=()=>{
  localStorage.setItem('mg628InstructorSection',$('sectionSelect').value);
  updateRosterTarget();

  // Revalidate any CSV that is already loaded whenever the target section changes.
  if(csvRows.length){
    const mismatch=csvTargetMismatch();
    $('importCsv').disabled=!csvRows.length||!!mismatch;
    if(mismatch){
      msg('rosterMsg',mismatch,'error');
    }else{
      msg('rosterMsg',`Ready to import ${csvRows.length} students into ${sectionLabel(selectedSection())}.`,'ok');
    }
  }else{
    $('importCsv').disabled=true;
  }

  refreshAll();
};
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tabs button').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('.tabpage').forEach(p=>p.classList.add('hidden'));$('tab-'+b.dataset.tab).classList.remove('hidden')});
function updateRosterTarget(){const sec=selectedSection();const el=$('rosterTarget');if(!el||!sec)return;el.textContent=`Managing roster for ${sectionLabel(sec)}${sec.campus?' · '+sec.campus:''}. Upload only the roster for this exact section.`}
function csvTargetMismatch(){const sec=selectedSection();if(!sec||!csvFileName)return null;const n=csvFileName.toUpperCase();const m=n.match(/([A-Z]{2,})[-_ ]?(\d{3})[-_ ]?([0-9]{3}[A-Z])/);if(!m)return null;const fileCourse=(m[1]+m[2]).replace(/[^A-Z0-9]/g,'');const fileSection=m[3];const selectedCourse=String(sec.course.code||'').toUpperCase().replace(/[^A-Z0-9]/g,'');const selectedSection=String(sec.section_code||'').toUpperCase();if(fileCourse!==selectedCourse||fileSection!==selectedSection)return `This CSV appears to be for ${m[1]}-${m[2]}-${fileSection}, but you selected ${sectionLabel(sec)}. Choose the matching section before importing.`;return null}
async function loadRoster(){const sid=$('sectionSelect').value;if(!sid)return;clearMsg('rosterMsg');msg('rosterMsg','Loading roster…','');try{const r=await api('roster_list',{section_id:sid});if(!r||!Array.isArray(r.rows))throw new Error('Roster API returned an unexpected response.');$('statRoster').textContent=r.rows.length;$('statLinked').textContent=r.rows.filter(x=>x.linked_user_id).length;const tb=$('rosterBody');tb.innerHTML='';for(const x of r.rows){const tr=document.createElement('tr');const account=x.linked_user_id?'<span class="badge ok">linked</span>':'<span class="badge warn">not registered</span>';const test=x.is_test_account?' <span class="badge test">TEST</span>':'';tr.innerHTML=`<td>${esc(x.expected_full_name||'')}${test}</td><td class="small">${esc(x.email)}</td><td>${esc(x.institutional_id||'')}</td><td><span class="badge">${esc(x.roster_status)}</span></td><td>${account}</td><td>${x.enrollment?'<span class="badge '+(x.enrollment.status==='active'?'ok':'warn')+'">'+esc(x.enrollment.status)+'</span>':'—'}</td><td><button data-status="active" data-id="${x.id}">Activate</button> <button data-status="dropped" data-id="${x.id}">Drop</button></td>`;tb.appendChild(tr)}tb.querySelectorAll('button[data-status]').forEach(b=>b.onclick=async()=>{await api('roster_status',{section_id:sid,roster_id:b.dataset.id,roster_status:b.dataset.status});await loadRoster()});msg('rosterMsg',`Loaded ${r.rows.length} roster records for ${sectionLabel(selectedSection())}.`,'ok')}catch(e){$('statRoster').textContent='—';$('statLinked').textContent='—';msg('rosterMsg',formatErr(e),'error')}}
$('addStudent').onclick=async()=>{try{await api('roster_upsert',{section_id:$('sectionSelect').value,email:$('studentEmail').value,expected_full_name:$('studentName').value,institutional_id:$('studentId').value,roster_status:$('studentStatus').value});msg('rosterMsg','Student saved.','ok');$('studentName').value='';$('studentEmail').value='';$('studentId').value='';await loadRoster()}catch(e){msg('rosterMsg',formatErr(e),'error')}};
$('refreshRoster').onclick=loadRoster;
$('csvFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;csvFileName=f.name;const text=await f.text();csvRows=parseCsv(text);$('csvPreview').value=csvRows.slice(0,5).map(x=>JSON.stringify(x)).join('\n');const mismatch=csvTargetMismatch();$('importCsv').disabled=!csvRows.length||!!mismatch;if(mismatch)msg('rosterMsg',mismatch,'error');else if(csvRows.length)msg('rosterMsg',`Ready to import ${csvRows.length} students into ${sectionLabel(selectedSection())}.`,'ok')};
$('importCsv').onclick=async()=>{try{const mismatch=csvTargetMismatch();if(mismatch)throw new Error(mismatch);const sec=selectedSection();if(!sec)throw new Error('Choose a section first.');const r=await api('roster_bulk',{section_id:sec.id,rows:csvRows});msg('rosterMsg',`Imported ${r.count} roster rows into ${sectionLabel(sec)}.`,'ok');await loadRoster()}catch(e){msg('rosterMsg',formatErr(e),'error')}};
function parseCsv(text){const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(x=>x.trim());if(lines.length<2)return[];const split=line=>{const out=[];let cur='',q=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(q&&line[i+1]==='"'){cur+='"';i++}else q=!q}else if(c===','&&!q){out.push(cur.trim());cur=''}else cur+=c}out.push(cur.trim());return out};const h=split(lines[0]).map(x=>x.toLowerCase().trim().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,''));return lines.slice(1).map(line=>{const v=split(line),o={};h.forEach((k,i)=>o[k]=v[i]??'');o.expected_full_name=o.expected_full_name||o.full_name||o.name||o.student_name||'';o.institutional_id=o.institutional_id||o.student_id||o.id||'';o.email=o.email||o.preferred_email||o.school_email||o.student_email||'';o.class_level=o.class_level||'';return o}).filter(x=>x.email)}
let lastResults=[];
async function loadResults(){const sid=$('sectionSelect').value;if(!sid)return;try{const r=await api('results',{section_id:sid});renderOfferings(r.offerings||[],sid);const offerMap=new Map((r.offerings||[]).map(o=>[o.id,o]));const enrMap=new Map((r.enrollments||[]).map(e=>[e.id,e]));const rows=[];for(const s of r.sessions||[]){const e=enrMap.get(s.enrollment_id),o=offerMap.get(s.assignment_offering_id),c=Array.isArray(s.completion)?s.completion[0]:s.completion;if(!e||!o)continue;rows.push({student:e.profile.full_name||e.profile.email,email:e.profile.email,assignment:o.assignment.title,version:o.assignment.version,track:s.track||'',progress:c?c.completion_percentage:0,status:c?c.status:s.status,score:c?.score_percentage??'',verified:c?.verification_code||'',last:s.last_activity_at||''})}lastResults=rows;$('statComplete').textContent=rows.filter(x=>x.status==='complete'||x.status==='overridden').length;const tb=$('resultsBody');tb.innerHTML='';for(const x of rows){const tr=document.createElement('tr');tr.innerHTML=`<td>${esc(x.student)}<div class="muted small">${esc(x.email)}</div></td><td>${esc(x.assignment)} <span class="badge">v${x.version}</span></td><td>${esc(x.track)}</td><td>${x.progress}%</td><td><span class="badge ${x.status==='complete'?'ok':'warn'}">${esc(x.status)}</span></td><td>${x.score===''?'—':x.score+'%'}</td><td>${x.verified?'<span class="badge ok">yes</span>':'—'}</td><td class="small">${x.last?new Date(x.last).toLocaleString():'—'}</td>`;tb.appendChild(tr)}clearMsg('resultsMsg')}catch(e){msg('resultsMsg',formatErr(e),'error')}}
function fmtDate(v){return v?new Date(v).toLocaleString():'—'}
function renderOfferings(offerings,sid){const tb=$('offeringsBody');tb.innerHTML='';for(const o of offerings){const tr=document.createElement('tr');const published=o.published===true;tr.innerHTML=`<td><strong>${esc(o.assignment.title)}</strong><div class="muted small">${esc(o.assignment.slug)} · v${esc(o.assignment.version)}</div></td><td class="small">${esc(o.assignment.page_path||'—')}</td><td><span class="badge ${published?'ok':'warn'}">${published?'PUBLISHED':'UNPUBLISHED'}</span></td><td class="small">${fmtDate(o.opens_at)}</td><td class="small">${fmtDate(o.due_at)}</td><td class="small">${fmtDate(o.closes_at)}</td><td><button class="${published?'danger':'accent'}" data-offering="${esc(o.id)}" data-published="${published?'true':'false'}">${published?'Unpublish':'Publish'}</button></td>`;tb.appendChild(tr)}tb.querySelectorAll('button[data-offering]').forEach(b=>b.onclick=async()=>{const next=b.dataset.published!=='true';b.disabled=true;try{await api('offering_publish',{section_id:sid,offering_id:b.dataset.offering,published:next});msg('offeringMsg',next?'Participation published. The course homepage will show it as available when the weekly HTML file exists.':'Participation unpublished. The course homepage will automatically show PARTICIPATION CLOSED when no section offering remains published.','ok');await loadResults()}catch(e){msg('offeringMsg',formatErr(e),'error');b.disabled=false}})}
$('refreshResults').onclick=loadResults;
$('exportResults').onclick=()=>{const cols=['student','email','assignment','version','track','progress','status','score','verified','last'];const csv=[cols.join(','),...lastResults.map(r=>cols.map(k=>'"'+String(r[k]??'').replace(/"/g,'""')+'"').join(','))].join('\n');download('participation-results.csv',csv)};
$('enableTest').onclick=async()=>{try{await api('test_enroll',{section_id:$('sectionSelect').value});msg('testMsg','Your account is now enrolled as a TEST student in this section. Open the student activity to test the full flow.','ok');await loadRoster()}catch(e){msg('testMsg',formatErr(e),'error')}};
$('disableTest').onclick=async()=>{try{await api('test_remove',{section_id:$('sectionSelect').value});msg('testMsg','Your test enrollment has been dropped. Historical test activity was preserved.','ok');await loadRoster()}catch(e){msg('testMsg',formatErr(e),'error')}};
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function download(name,text){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'text/csv'}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},100)}
init();
