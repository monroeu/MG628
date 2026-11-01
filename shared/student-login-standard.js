/* Monroe login visual standardizer. Does not call APIs, alter identity or set grades. */
(function(){'use strict';
function init(){
 const week=(window.MONROE_LOGIN_WEEK||'');
 const lookup={week01:'#authPanel',week03:'#authPanel',week04:'#authBox',week05:'.auth-panel',week06:'.auth-panel',week07:'#auth'};
 const root=document.querySelector(lookup[week]);if(!root||root.dataset.monroeStandard==='1')return;
 const uid=root.querySelector('#auth-student-id,#studentId');const pwd=root.querySelector('#auth-password,#password');
 if(!uid||!pwd){return;}
 root.dataset.monroeStandard='1';root.classList.add('monroe-login-standard');
 const title=root.querySelector('h3,h2');if(title)title.textContent='Student Login';
 const info=root.querySelector('p');if(info&&/student|account|sign.in|roster|password/i.test(info.textContent||'')){
  info.classList.add('monroe-login-explainer');info.textContent='Use your Monroe University Student ID. This is the same centralized account used across Professor Kassoh participation courses. Your name, school email, course, term, and section are resolved from the instructor roster.';
 }
 const fields=uid.closest('#authFields,.auth-grid,.identity,.two')||pwd.parentElement.parentElement;
 if(fields&&root.contains(fields)){fields.classList.add('monroe-login-fields');
  if(!uid.labels?.length){const wrap=document.createElement('div');const l=document.createElement('label');l.textContent='Student ID';l.htmlFor=uid.id;uid.before(wrap);wrap.append(l,uid)}
  if(!pwd.labels?.length){const wrap=document.createElement('div');const l=document.createElement('label');l.textContent='Password';l.htmlFor=pwd.id;pwd.before(wrap);wrap.append(l,pwd)}
 }
 const existing=root.querySelector('a[href*="monroeu.github.io/student/"]');
 if(!existing){const a=document.createElement('div');a.className='monroe-login-recovery';a.innerHTML='<a href="https://monroeu.github.io/student/" target="_blank" rel="noopener noreferrer">Forgot password? Open the Student Portal</a><small>Use automatic email recovery if eligible, or request an instructor-assisted reset.</small>'; (fields||pwd).insertAdjacentElement('afterend',a)}
 else {existing.textContent='Forgot password? Open the Student Portal';existing.setAttribute('target','_blank');existing.setAttribute('rel','noopener noreferrer');}
 const report=document.createElement('div');report.className='monroe-login-roster';report.hidden=true;report.setAttribute('aria-live','polite');
 report.innerHTML='<span class="monroe-login-verified">Roster verified</span><div class="monroe-login-roster-grid"></div>';
 root.appendChild(report);
 const progress=document.createElement('div');progress.className='monroe-login-progress';progress.hidden=true;root.appendChild(progress);
 function setField(box,label,value){if(value==null||!String(value).trim())return;const span=document.createElement('div');const cap=document.createElement('span');cap.className='monroe-login-roster-label';cap.textContent=label;const strong=document.createElement('strong');strong.className='monroe-login-roster-value';strong.textContent=String(value);span.append(cap,strong);box.appendChild(span)}
 let last='';function render(){
 const source=(document.querySelector('#auth-summary')?.textContent||'')+' '+(document.querySelector('#userInfo')?.textContent||'')+' '+(document.querySelector('#authMessage')?.textContent||'')+' '+(document.querySelector('#auth-status')?.textContent||'')+' '+(document.querySelector('#auth-status')?.textContent||'');
 const server=(document.querySelector('#server-progress')?.textContent||'')+' '+(document.querySelector('#finishStatus')?.textContent||'')+' '+(document.querySelector('#progressText')?.textContent||'');
 const active= /roster verified|signed in|saved work restored|saved week|participation started|week \d+ available|week \d+ participation recording started/i.test(source) && !/sign in before|sign in to record|sign in with your|no published/i.test(source.slice(-120));
 const status=(window.MONROE_LOGIN_VERIFIED===true||active)&&!(/not roster-verified/i.test(source));
 const key=source+'|'+server+'|'+status;if(key===last)return;last=key;
 if(status){const grid=report.querySelector('.monroe-login-roster-grid');grid.replaceChildren();
  const name=source.match(/(?:signed in:|student:|roster verified\.\s*)([^·\n]+?)(?:\s*·|$)/i)?.[1];
  const sid=source.match(/student id:?\s*([0-9]{5,12})/i)?.[1];
  const section=source.match(/MG628\s*[-–]\s*([0-9]{3}[A-Z])/i)?.[1];
  if(name)setField(grid,'Student',name.trim());if(sid)setField(grid,'Student ID',sid);setField(grid,'Course','MG628');if(section)setField(grid,'Section',section);setField(grid,'Term','Fall 2026');
  report.hidden=false;
 }else report.hidden=true;
 const line=server.trim();if(status&&line){progress.hidden=false;progress.textContent='Server participation: '+line.slice(0,350)}else progress.hidden=true;
 }
 // Existing labs handle authorization and restore. This observer only mirrors their visible status.
 let scheduled=false;const observer=new MutationObserver(()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;render()})});
 for(const id of ['auth-summary','auth-status','authMessage','userInfo','server-progress','finishStatus','progressText']){const el=document.getElementById(id);if(el)observer.observe(el,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden','class']})}
 render();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
