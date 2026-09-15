/**
 * MG628 multi-week participation receiver.
 * Supports Weeks 1–2 and Week 3 while keeping the same Web App /exec URL.
 */
const SHEET_ID='1k3G4uAxTxwERRUKVGoXPAX2dS2OE88IANoTqPKh9IRM';
const SHEET_NAME='Submissions';
const EXPECTED_COURSE='MG628';
const RECEIPT_SECRET_KEY='MG628_RECEIPT_SECRET';
const WEEK1_CODE='ORDER_QUANTITY_WEEKS_1_2';
const WEEK3_CODE='WEEK03_DATA_STRUCTURES_CASE_STUDY';

const W1_TRACKS={
 business:{F:40,c:1.2,p:3.5,v:1,candidates:[160,170,180,190,200],demand:[{d:150,p:.15},{d:170,p:.25},{d:180,p:.30},{d:190,p:.20},{d:200,p:.10}],frequencyDemand:[{d:145,p:.08},{d:155,p:.07},{d:165,p:.07},{d:175,p:.24},{d:185,p:.26},{d:195,p:.18},{d:205,p:.06},{d:215,p:.04}]},
 health:{F:500,c:12,p:45,v:3,candidates:[150,160,170,180,190,200,210],demand:[{d:145,p:.06},{d:155,p:.09},{d:165,p:.12},{d:175,p:.29},{d:185,p:.25},{d:195,p:.09},{d:205,p:.10}],frequencyDemand:[{d:145,p:.06},{d:155,p:.09},{d:165,p:.12},{d:175,p:.29},{d:185,p:.25},{d:195,p:.09},{d:205,p:.10}]}
};
const W1_EXCEL={
 business:{2:['B5:B10','B5','B9','B10'],3:['B13','B14'],4:['B17'],5:['A28:B35'],6:['A37:C41'],7:['B44:B46'],8:['B17','B10']},
 health:{2:['B5:B10','B5','B9','B10'],3:['B13','B14'],4:['B17'],5:['B28:C34'],6:['A47:B53'],7:['B56:B58'],8:['B17','B10']}
};

function setupReceiptSecret(){const p=PropertiesService.getScriptProperties();if(!p.getProperty(RECEIPT_SECRET_KEY))p.setProperty(RECEIPT_SECRET_KEY,Utilities.getUuid()+Utilities.getUuid())}

function doPost(e){
 try{
  if(!e||!e.postData||!e.postData.contents)return jsonResponse({ok:false,error:'Missing request body.'});
  const data=JSON.parse(e.postData.contents);
  if(data.course!==EXPECTED_COURSE)return jsonResponse({ok:false,error:'Invalid course.'});
  const assignment=String(data.assignment||'');
  if([WEEK1_CODE,WEEK3_CODE].indexOf(assignment)===-1)return jsonResponse({ok:false,error:'Unknown MG628 assignment.'});
  const name=String(data.student&&data.student.name||'').trim(),email=String(data.student&&data.student.email||'').trim().toLowerCase();
  if(!name||!email||!/^\S+@\S+\.\S+$/.test(email))return jsonResponse({ok:false,error:'Student name and valid email are required.'});
  const track=String(data.track_key||'');
  const validation=assignment===WEEK1_CODE?validateWeek1(data.answers||{},track):validateWeek3(data.answers||{},track);
  if(!validation.ok)return jsonResponse({ok:false,error:'Server validation failed. Complete or correct all required exercises before submitting.',failed_exercises:validation.failed,failed_details:validation.failed_details});

  const ss=SpreadsheetApp.openById(SHEET_ID);let sheet=ss.getSheetByName(SHEET_NAME);if(!sheet)sheet=ss.insertSheet(SHEET_NAME);ensureHeaders(sheet);
  const submissionId=String(data.submission_id||Utilities.getUuid()),existing=findSubmission(sheet,submissionId);
  if(existing)return jsonResponse({ok:true,receipt_id:submissionId,verification_code:existing.verificationCode,received_at_iso:existing.receivedAtIso,duplicate:true});

  const receivedAt=new Date(),receivedAtIso=receivedAt.toISOString(),canonical=canonicalizeAnswers(data.answers||{}),hash=sha256Hex(canonical),code=signReceipt(assignment,submissionId,email,track,hash,receivedAtIso);
  const row=[receivedAt,submissionId,code,hash,data.submitted_at_iso||'',name,email,track,data.track_label||'',data.scenario||'',data.exercises_total||validation.total,validation.score,
   answerText(data.answers&&data.answers.exercise_1),answerText(data.answers&&data.answers.exercise_2),answerText(data.answers&&data.answers.exercise_3),answerText(data.answers&&data.answers.exercise_4),
   answerText(data.answers&&data.answers.exercise_5),answerText(data.answers&&data.answers.exercise_6),answerText(data.answers&&data.answers.exercise_7),answerText(data.answers&&data.answers.exercise_8),
   answerText(data.answers&&data.answers.exercise_9),canonicalizeExcelRefs(data.answers||{}),data.page_url||'',data.user_agent||'',assignment,data.activity_week||''];
  sheet.appendRow(row);
  return jsonResponse({ok:true,receipt_id:submissionId,verification_code:code,received_at_iso:receivedAtIso});
 }catch(err){console.error(err);return jsonResponse({ok:false,error:'Submission could not be recorded.'})}
}

function doGet(e){
 try{
  const receipt=String(e&&e.parameter&&e.parameter.receipt||'').trim(),code=String(e&&e.parameter&&e.parameter.code||'').trim();
  if(!receipt||!code)return jsonResponse({ok:false,valid:false});
  const ss=SpreadsheetApp.openById(SHEET_ID),sheet=ss.getSheetByName(SHEET_NAME);if(!sheet)return jsonResponse({ok:true,valid:false});
  const found=findSubmission(sheet,receipt);if(!found)return jsonResponse({ok:true,valid:false});
  const valid=timingSafeEqual(code,found.verificationCode);
  return jsonResponse({ok:true,valid:valid,course:valid?EXPECTED_COURSE:undefined,assignment:valid?(found.assignment||WEEK1_CODE):undefined,student_email:valid?found.email:undefined,received_at_iso:valid?found.receivedAtIso:undefined});
 }catch(err){console.error(err);return jsonResponse({ok:false,valid:false})}
}

function validateWeek1(answers,track){
 const failed=[],details=[],t=W1_TRACKS[track];const fail=(n,r)=>{if(failed.indexOf(n)<0)failed.push(n);details.push({exercise:n,reason:r})};
 if(!t)return{ok:false,failed:[0],failed_details:[{exercise:0,reason:'Invalid track.'}],score:0,total:9};
 if(rawText(answers.exercise_1).length<20)fail(1,'Written response too short.');if(rawText(answers.exercise_2).length<20)fail(2,'Written response too short.');if(rawText(answers.exercise_9).length<40)fail(9,'Written response too short.');
 if(!arrayNear(rawArray(answers.exercise_3),[150,50],[.5,.5]))fail(3,'Numeric answer incorrect.');
 if(!arrayNear(rawArray(answers.exercise_4),[profitOf(t,180,140),profitOf(t,180,220)],[2,2]))fail(4,'Numeric answer incorrect.');
 if(!arrayNear(rawArray(answers.exercise_5),[frequencyBelow(180,t)*100],[1.2]))fail(5,'Numeric answer incorrect.');
 const rows=t.candidates.map(q=>({q:q,ep:expectedProfit(q,t)})),best=rows.reduce((a,b)=>b.ep>a.ep?b:a,rows[0]);
 if(!arrayNear(rawArray(answers.exercise_6),[best.q,best.ep],[5,15]))fail(6,'Numeric answer incorrect.');
 const Cu=t.p-t.c,Co=t.c-.5;if(!arrayNear(rawArray(answers.exercise_7),[Cu/(Cu+Co)*100],[.6]))fail(7,'Numeric answer incorrect.');
 if(!arrayNear(rawArray(answers.exercise_8),[(t.F+200*(t.c-t.v))/(t.p-t.v)],[2]))fail(8,'Numeric answer incorrect.');
 const refs=W1_EXCEL[track];Object.keys(refs).forEach(k=>{const n=Number(k);if(!excelRefsMatch(rawExcelRefs(answers['exercise_'+n]),refs[n]))fail(n,'Excel cell/range reference incorrect.')});
 return{ok:failed.length===0,failed:failed.sort((a,b)=>a-b),failed_details:details,score:9-failed.length,total:9};
}

function validateWeek3(answers,track){
 const failed=[],details=[];const fail=(n,r)=>{if(failed.indexOf(n)<0)failed.push(n);details.push({exercise:n,reason:r})};
 if(['business','health'].indexOf(track)<0)return{ok:false,failed:[0],failed_details:[{exercise:0,reason:'Invalid track.'}],score:0,total:7};
 if(!arrayExact(rawArrayText(answers.exercise_1),['unstructured','semi-structured','structured','semi-structured']))fail(1,'Data structure classifications incorrect.');
 if(!arrayExact(rawArrayText(answers.exercise_2),['database','spreadsheet','api']))fail(2,'Data source selections incorrect.');
 if(track==='business'){
  const e3=rawArray(answers.exercise_3).map(Number);if(e3.length!==3||[1,6,8,10].indexOf(e3[0])<0||[2,7].indexOf(e3[1])<0||[4,9].indexOf(e3[2])<0)fail(3,'Theme examples incorrect.');
  if(!arrayExact(rawArrayText(answers.exercise_4),['mixed','negative','positive']))fail(4,'Sentiment classifications incorrect.');
  const e5=rawArrayMixed(answers.exercise_5),rate=Number(e5[0]),service=norm(e5[1]),status=norm(e5[2]),serviceKey=norm(e5[3]);
  if(!(Math.abs(rate-58.3)<=.2&&['electricity','phone'].indexOf(service)>=0&&status==='status'&&serviceKey==='service'))fail(5,'Transaction-log analysis incorrect.');
  if(rawText(answers.exercise_6).length<90)fail(6,'Integrated evidence response too short.');
  if(rawText(answers.exercise_7).length<140)fail(7,'Managerial recommendation too short.');
 }else{
  if(!arrayNear(rawArray(answers.exercise_3),[16,21],[0,0]))fail(3,'Cycle-time calculations incorrect.');
  if(!arrayExact(rawArrayText(answers.exercise_4),['high','low','high','low']))fail(4,'Supplier efficiency ratings incorrect.');
  if(!arrayExact(rawArrayText(answers.exercise_5),['internal_sync_status','failed','error_log','his_handshake_timeout']))fail(5,'JSON evidence incorrect.');
  if(!arrayExact(rawArrayText(answers.exercise_6),['reliable','unreliable','reliable','unreliable']))fail(6,'Supplier reliability ratings incorrect.');
  if(rawText(answers.exercise_7).length<140)fail(7,'Operational recommendation too short.');
 }
 return{ok:failed.length===0,failed:failed.sort((a,b)=>a-b),failed_details:details,score:7-failed.length,total:7};
}

function profitOf(t,Q,D){const full=Math.min(D,Q),left=Math.max(0,Q-D);return full*t.p+left*t.v-(t.F+Q*t.c)}
function expectedProfit(Q,t){return t.demand.reduce((s,r)=>s+r.p*profitOf(t,Q,r.d),0)}
function frequencyBelow(x,t){const rows=t.frequencyDemand||t.demand;return rows.reduce((s,r)=>s+(r.d<x?r.p:0),0)}
function rawText(e){if(!e)return'';if(typeof e.raw==='string')return e.raw.trim();return String(e.answer||'').trim()}
function rawArray(e){return e&&Array.isArray(e.raw)?e.raw.map(Number):[]}
function rawArrayText(e){return e&&Array.isArray(e.raw)?e.raw.map(v=>String(v||'').trim().toLowerCase()):[]}
function rawArrayMixed(e){return e&&Array.isArray(e.raw)?e.raw:[]}
function norm(v){return String(v||'').trim().toLowerCase()}
function arrayExact(a,b){if(!a||a.length!==b.length)return false;for(let i=0;i<b.length;i++)if(norm(a[i])!==norm(b[i]))return false;return true}
function arrayNear(a,b,tol){if(!a||a.length!==b.length)return false;for(let i=0;i<b.length;i++)if(!isFinite(a[i])||Math.abs(a[i]-b[i])>tol[i])return false;return true}
function rawExcelRefs(e){return e&&Array.isArray(e.excel_refs)?e.excel_refs.map(v=>String(v||'')):[]}
function normalizeExcelRef(v){let r=String(v||'').trim().toUpperCase().replace(/\s+/g,'').replace(/\$/g,'');if(r.indexOf('!')>=0)r=r.split('!').pop();return r}
function excelRefsMatch(a,b){if(!Array.isArray(a)||a.length!==b.length)return false;for(let i=0;i<b.length;i++)if(normalizeExcelRef(a[i])!==normalizeExcelRef(b[i]))return false;return true}

function ensureHeaders(sheet){
 const base=['Received At','Submission ID','Verification Code','Answer Hash','Student Submitted At (ISO)','Student Name','Student Email','Track Key','Track Label','Scenario','Exercises Completed','Server Validated Score','Exercise 1','Exercise 2','Exercise 3','Exercise 4','Exercise 5','Exercise 6','Exercise 7','Exercise 8','Exercise 9','Excel References (JSON)','Page URL','Browser User Agent'];
 if(sheet.getLastRow()===0){sheet.appendRow(base.concat(['Assignment Code','Week / Activity']));sheet.setFrozenRows(1);return}
 const last=Math.max(sheet.getLastColumn(),1),h=sheet.getRange(1,1,1,last).getValues()[0].map(String);
 ['Assignment Code','Week / Activity'].forEach(name=>{if(h.indexOf(name)<0){sheet.getRange(1,sheet.getLastColumn()+1).setValue(name);h.push(name)}});
 sheet.setFrozenRows(1);
}
function findSubmission(sheet,id){
 const last=sheet.getLastRow();if(last<2)return null;const headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String),ai=headers.indexOf('Assignment Code'),vals=sheet.getRange(2,1,last-1,sheet.getLastColumn()).getValues();
 for(let i=0;i<vals.length;i++)if(String(vals[i][1])===id)return{receivedAtIso:new Date(vals[i][0]).toISOString(),verificationCode:String(vals[i][2]),email:String(vals[i][6]),assignment:ai>=0?String(vals[i][ai]):''};return null
}
function answerText(e){return e?String(e.answer||''):''}
function canonicalizeAnswers(answers){const out={};for(let i=1;i<=9;i++){const e=answers['exercise_'+i]||{};out['exercise_'+i]={raw:e.raw===undefined?null:e.raw,answer:String(e.answer||''),excel_refs:rawExcelRefs(e).map(normalizeExcelRef)}}return JSON.stringify(out)}
function canonicalizeExcelRefs(answers){const out={};for(let i=1;i<=9;i++){const r=rawExcelRefs(answers['exercise_'+i]);if(r.length)out['exercise_'+i]=r.map(normalizeExcelRef)}return JSON.stringify(out)}
function sha256Hex(text){return bytesToHex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,text,Utilities.Charset.UTF_8))}
function signReceipt(assignment,id,email,track,hash,time){const secret=PropertiesService.getScriptProperties().getProperty(RECEIPT_SECRET_KEY);if(!secret)throw new Error('Receipt secret is not configured. Run setupReceiptSecret() once.');const msg=[EXPECTED_COURSE,assignment,id,email,track,hash,time].join('|');return bytesToHex(Utilities.computeHmacSha256Signature(msg,secret,Utilities.Charset.UTF_8)).substring(0,32).toUpperCase()}
function bytesToHex(bytes){return bytes.map(b=>{const v=b<0?b+256:b;return('0'+v.toString(16)).slice(-2)}).join('')}
function timingSafeEqual(a,b){a=String(a);b=String(b);if(a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0}
function jsonResponse(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)}
