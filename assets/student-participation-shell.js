(function(){
  'use strict';
  const STYLE_ID='mg628-participation-shell-style';
  const PANEL_ID='academic-identity';

  function injectStyle(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      .academic-identity{margin-top:12px;border:1px solid #97b9ad;background:#f4fbf8;padding:14px 15px;border-radius:8px;box-shadow:2px 2px 0 rgba(24,60,45,.08)}
      .academic-identity[hidden]{display:none!important}
      .academic-identity-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px}
      .academic-identity-head strong{font-family:inherit;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#155f4a}
      .academic-identity-badge{font-family:inherit;font-size:10px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;border:1px solid #5e8f7e;background:#fff;padding:4px 7px;border-radius:999px;white-space:nowrap}
      .academic-identity-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:8px}
      .academic-identity-item{min-width:0}
      .academic-identity-item span{display:block;font-family:inherit;font-size:10px;letter-spacing:.04em;text-transform:uppercase;color:#61736b;margin-bottom:2px}
      .academic-identity-item b{display:block;font-size:14px;overflow-wrap:anywhere}
      .academic-identity-note{margin:10px 0 0;font-size:12px;color:#61736b}
      @media(min-width:700px){.academic-identity-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.academic-identity-item.assignment{grid-column:1/-1}}
    `;
    document.head.appendChild(style);
  }

  function identityMarkup(){
    return `<div class="academic-identity" hidden id="${PANEL_ID}" aria-live="polite">
      <div class="academic-identity-head"><strong>Your academic record</strong><span class="academic-identity-badge">Roster verified</span></div>
      <div class="academic-identity-grid">
        <div class="academic-identity-item"><span>Student</span><b id="ai-student">—</b></div>
        <div class="academic-identity-item"><span>School email</span><b id="ai-email">—</b></div>
        <div class="academic-identity-item"><span>Course</span><b id="ai-course">—</b></div>
        <div class="academic-identity-item"><span>Term</span><b id="ai-term">—</b></div>
        <div class="academic-identity-item"><span>Section</span><b id="ai-section">—</b></div>
        <div class="academic-identity-item"><span>Student ID</span><b id="ai-student-id">—</b></div>
        <div class="academic-identity-item assignment"><span>Participation</span><b id="ai-assignment">—</b></div>
      </div>
      <p class="academic-identity-note">Course and section are resolved from the instructor-controlled roster. Students cannot change this assignment from this page.</p>
    </div>`;
  }

  function mountIdentity(anchorId){
    injectStyle();
    if(document.getElementById(PANEL_ID))return document.getElementById(PANEL_ID);
    const anchor=document.getElementById(anchorId||'auth-status');
    if(!anchor)return null;
    anchor.insertAdjacentHTML('afterend',identityMarkup());
    return document.getElementById(PANEL_ID);
  }

  function clearIdentity(){const el=document.getElementById(PANEL_ID);if(el)el.hidden=true;}
  function put(id,v){const n=document.getElementById(id);if(n)n.textContent=(v&&String(v).trim())?String(v):'—';}
  function renderIdentity(r,offering,section,courseCode){
    const el=mountIdentity('auth-status'); if(!el)return;
    put('ai-student',r?.user?.full_name||'');
    put('ai-email',r?.user?.email||'');
    put('ai-course',[section?.course?.code||courseCode||'MG628',section?.course?.title].filter(Boolean).join(' — '));
    put('ai-term',[section?.term?.name,section?.term?.code].filter(Boolean).join(' · '));
    put('ai-section',[(section?.course?.code&&section?.section_code)?section.course.code+'-'+section.section_code:section?.section_code,section?.title].filter(Boolean).join(' — '));
    put('ai-student-id',r?.user?.institutional_id||'Not listed');
    put('ai-assignment',offering?.assignment?.title||'Participation');
    el.hidden=false;
  }

  function create(config){
    if(!config?.client)throw new Error('MG628ParticipationShell requires a Supabase client.');
    if(typeof config.api!=='function')throw new Error('MG628ParticipationShell requires an API function.');
    mountIdentity(config.identityAnchorId||'auth-status');
    let inFlight=null;
    let lastContext=null;

    const ids=Object.assign({
      name:'auth-name',email:'auth-email',password:'auth-password',signin:'auth-signin',signup:'auth-signup',signout:'auth-signout',fields:'authFields',summary:'auth-summary'
    },config.ids||{});
    const $=id=>document.getElementById(id);
    const status=(m,k='')=>config.setStatus?.(m,k);
    const reset=()=>{lastContext=null;clearIdentity();config.setUser?.(null);config.setOffering?.(null);config.onSignedOut?.();};

    async function bootstrap(){
      if(inFlight)return inFlight;
      inFlight=(async()=>{
        const {data:{user}}=await config.client.auth.getUser();
        config.setUser?.(user||null);
        const signout=$(ids.signout),fields=$(ids.fields);
        if(signout)signout.hidden=!user;
        if(fields)fields.hidden=!!user;
        if(!user){
          reset();
          if(fields)fields.hidden=false;
          const summary=$(ids.summary); if(summary)summary.textContent=config.signedOutSummary||'Sign in below with the same email listed on the instructor roster.';
          status(config.signedOutMessage||'Sign in before completing required participation items so your work is recorded.');
          return null;
        }
        const submitEmail=document.getElementById('submit-email'); if(submitEmail){submitEmail.value=user.email||'';submitEmail.readOnly=true;}
        const submitName=document.getElementById('submit-name'); if(submitName&&!submitName.value)submitName.value=user.user_metadata?.full_name||'';
        status('Signed in. Matching your school email to the instructor roster…');
        try{
          const r=await config.api({action:'bootstrap'});
          const offering=(r.offerings||[]).find(o=>o.assignment?.slug===config.assignmentSlug&&Number(o.assignment?.version)===Number(config.assignmentVersion));
          if(!offering){
            config.setOffering?.(null); clearIdentity();
            const msg=config.notRosteredMessage||'Signed in, but this email is not rostered for a section that has this participation. Contact your instructor if this is unexpected.';
            status(msg,'err');
            return null;
          }
          config.setOffering?.(offering);
          const enrollment=(r.enrollments||[]).find(e=>e.section_id===offering.section_id);
          const section=enrollment?.section||null;
          renderIdentity(r,offering,section,config.courseCode);
          const summary=$(ids.summary);
          if(summary)summary.textContent=`${r?.user?.email||user.email||''} · ${section?.term?.name||''} · ${section?.course?.code||config.courseCode||'MG628'}-${section?.section_code||''}`;
          status(`Roster verified: ${section?.course?.code||config.courseCode||'MG628'} ${section?.section_code||''} · ${section?.term?.name||''}.`,'ok');
          lastContext={response:r,user,offering,enrollment,section};
          await config.onResolved?.(lastContext);
          return lastContext;
        }catch(e){
          clearIdentity();
          status(e?.message||'Could not initialize participation recording.','err');
          console.error(e);
          return null;
        }
      })().finally(()=>{inFlight=null;});
      return inFlight;
    }

    async function signIn(){
      try{
        status('Signing in…');
        const email=($(ids.email)?.value||'').trim().toLowerCase(),password=$(ids.password)?.value||'';
        const {error}=await config.client.auth.signInWithPassword({email,password});
        if(error)throw error;
        return await bootstrap();
      }catch(e){status(e?.message||String(e),'err');return null;}
    }
    async function signUp(){
      try{
        const name=($(ids.name)?.value||'').trim(),email=($(ids.email)?.value||'').trim().toLowerCase(),password=$(ids.password)?.value||'';
        if(!name)throw new Error('Enter your full name first.');
        if(password.length<8)throw new Error('Use a password of at least 8 characters.');
        status('Creating your account…');
        const {data,error}=await config.client.auth.signUp({email,password,options:{data:{full_name:name},emailRedirectTo:location.href.split('#')[0]}});
        if(error)throw error;
        if(data.session)return await bootstrap();
        status('Account created. Check your school email to confirm the account, then return here and sign in.','ok');
      }catch(e){status(e?.message||String(e),'err');}
    }
    async function signOut(){await config.client.auth.signOut();reset();await bootstrap();}

    const signin=$(ids.signin),signup=$(ids.signup),signout=$(ids.signout);
    if(signin)signin.addEventListener('click',signIn);
    if(signup)signup.addEventListener('click',signUp);
    if(signout)signout.addEventListener('click',signOut);
    config.client.auth.onAuthStateChange((event,session)=>{
      config.setUser?.(session?.user||null);
      if(event==='SIGNED_IN'||event==='TOKEN_REFRESHED'||event==='USER_UPDATED')setTimeout(()=>bootstrap(),0);
      if(event==='SIGNED_OUT')setTimeout(()=>bootstrap(),0);
    });
    config.client.auth.getSession().then(({data})=>{config.setUser?.(data.session?.user||null);bootstrap();});

    return {bootstrap,signIn,signUp,signOut,getContext:()=>lastContext,renderIdentity,clearIdentity};
  }

  window.MG628ParticipationShell={create,mountIdentity,renderIdentity,clearIdentity};
})();
