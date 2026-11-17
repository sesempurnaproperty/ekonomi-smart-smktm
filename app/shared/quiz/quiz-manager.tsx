"use client";
import Link from "next/link";
import {Fragment,FormEvent,useCallback,useEffect,useMemo,useRef,useState,type ReactNode} from "react";
import {createClient} from "../../../lib/supabase/client";
import styles from "./quiz.module.css";
type Quiz={id:string;title:string;description:string|null;target_form_level:number|null;chapter_id:string|null;attempt_limit:number;status:string};
type Chapter={id:string;form_level:number;chapter_number:number;title:string};
type Question={id:string;quiz_id:string;question_order:number;question_type:"objective"|"structured";prompt:string;marks:number;image_path:string|null;image_url?:string|null};
type Option={id:string;question_id:string;option_code:string;option_text:string;option_order:number};
type MarkType="right"|"wrong"|"tr"|"repeat";
type MarkAnnotation={id:string;start:number;end:number;text:string;type:MarkType;comment?:string};
type R={id:string;question_id:string;selected_option_id:string|null;response_text:string|null;auto_score:number|null;teacher_score:number|null;feedback:string|null;marking_annotations?:MarkAnnotation[]|null;selected_option:{option_code:string;option_text:string}|null;question:{question_type:string;prompt:string;marks:number;question_order:number;marking_guide?:string|null;image_path:string|null;image_url?:string|null}|null};
const MARK_TYPES:{type:MarkType;symbol:string;label:string}[]=[
 {type:"right",symbol:"✓",label:"Mengandungi markah"},
 {type:"wrong",symbol:"✗",label:"Jawapan salah"},
 {type:"tr",symbol:"TR",label:"Tidak relevan"},
 {type:"repeat",symbol:"U",label:"Ulangan jawapan"}
];
function renderMarkedAnswer(text:string,annotations:MarkAnnotation[]|null|undefined,showSymbols:boolean):ReactNode[]{
 const valid=(annotations??[]).filter(a=>Number.isInteger(a.start)&&Number.isInteger(a.end)&&a.start>=0&&a.end<=text.length&&a.end>a.start&&text.slice(a.start,a.end)===a.text).slice().sort((a,b)=>a.start-b.start);
 const nodes:ReactNode[]=[];let cursor=0;
 valid.forEach((a)=>{
  if(a.start<cursor)return;
  if(a.start>cursor)nodes.push(<Fragment key={"plain-"+cursor}>{text.slice(cursor,a.start)}</Fragment>);
  const cls=a.type==="right"?styles.annotationRight:a.type==="wrong"?styles.annotationWrong:a.type==="tr"?styles.annotationTR:styles.annotationRepeat;
  nodes.push(<mark key={a.id} className={cls} title={MARK_TYPES.find(x=>x.type===a.type)?.label}>{a.text}</mark>);
  if(showSymbols)nodes.push(<span key={"symbol-"+a.id} className={"annotationSymbol "+cls}>{MARK_TYPES.find(x=>x.type===a.type)?.symbol}</span>);
  cursor=a.end;
 });
  if(cursor<text.length)nodes.push(<Fragment key={"plain-end-"+cursor}>{text.slice(cursor)}</Fragment>);
  return nodes;
}
type A={id:string;student_id:string;attempt_number:number;status:string;total_score:number;max_score:number;student:{full_name:string;form_level:number;class_name:string}|null;responses:R[]};
type StudentRoster={user_id:string;full_name:string;form_level:number;class_name:string;academic_class_id:string};
const fresh={kind:"objective" as "objective"|"structured",prompt:"",marks:"1",options:["","","",""],correct:"A",guide:"",imageFile:null as File|null,imagePreviewUrl:""};
export default function QuizManager({dashboardHref,roleLabel}:{dashboardHref:string;roleLabel:string}){
 const s=useMemo(()=>createClient(),[]);const [uid,setUid]=useState("");const [quizzes,setQuizzes]=useState<Quiz[]>([]);const [chapters,setChapters]=useState<Chapter[]>([]);
 const [quizId,setQuizId]=useState("");const [questions,setQuestions]=useState<Question[]>([]);const [options,setOptions]=useState<Option[]>([]);const [attempts,setAttempts]=useState<A[]>([]);const [attemptId,setAttemptId]=useState("");const [roster,setRoster]=useState<StudentRoster[]>([]);
 const [qf,setQf]=useState({title:"",description:"",target:"all",chapter_id:"",limit:"1"});const [form,setForm]=useState(fresh);
 const [grades,setGrades]=useState<Record<string,{score:string;feedback:string}>>({});
 const [annotationDrafts,setAnnotationDrafts]=useState<Record<string,MarkAnnotation[]>>({});
 const [selectedRanges,setSelectedRanges]=useState<Record<string,{start:number;end:number;text:string}>>({});
 const answerRefs=useRef<Record<string,HTMLDivElement|null>>({});
 const imageInputRef=useRef<HTMLInputElement|null>(null);
 const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [notice,setNotice]=useState("");
 const refresh=useCallback(async()=>{setLoading(true);const [u,q,c]=await Promise.all([s.auth.getUser(),s.from("learning_quizzes").select("*").order("created_at",{ascending:false}),s.from("learning_chapters").select("id,form_level,chapter_number,title").order("form_level").order("chapter_number")]);if(u.error||!u.data.user){setError("Sesi tidak sah.");setLoading(false);return;}if(q.error||c.error){setError(q.error?.message??c.error?.message??"Gagal memuatkan data.");setLoading(false);return;}setUid(u.data.user.id);const rows=(q.data??[]) as Quiz[];setQuizzes(rows);setChapters((c.data??[]) as Chapter[]);setQuizId(x=>x&&rows.some(q=>q.id===x)?x:rows[0]?.id??"");setLoading(false);},[s]);
 useEffect(()=>{void refresh();},[refresh]);
 useEffect(()=>()=>{if(form.imagePreviewUrl)URL.revokeObjectURL(form.imagePreviewUrl);},[form.imagePreviewUrl]);
 const detail=useCallback(async()=>{
  if(!quizId){setQuestions([]);setOptions([]);setAttempts([]);setRoster([]);return;}
  const [q,o,a]=await Promise.all([
   s.from("quiz_questions").select("*").eq("quiz_id",quizId).order("question_order"),
   s.from("quiz_options").select("*").order("option_order"),
   s.functions.invoke("quiz-engine",{body:{action:"list_attempts",quiz_id:quizId}})
  ]);
  if(q.error||o.error||a.error||a.data?.error){
   setError(q.error?.message??o.error?.message??a.error?.message??a.data?.error??"Gagal memuatkan kuiz.");
   return;
  }
  const qs=(q.data??[]) as Question[];
  const arsRaw=(a.data?.attempts??[]) as A[];
  const imagePaths=[...new Set([
   ...qs.map(item=>item.image_path),
   ...arsRaw.flatMap(attempt=>attempt.responses.map(response=>response.question?.image_path??null))
  ].filter((path):path is string=>typeof path==="string"&&path.length>0))];
  const signedResult=imagePaths.length
   ? await s.functions.invoke("quiz-engine",{body:{action:"sign_question_images",quiz_id:quizId,image_paths:imagePaths}})
   : {data:{image_urls:[]},error:null};
  if(signedResult.error||signedResult.data?.error){
   setError(signedResult.error?.message??signedResult.data?.error??"Pautan imej soalan gagal dijana.");
   return;
  }
  const signedMap=new Map<string,string>((signedResult.data?.image_urls??[]).map((entry:{path:string;url:string})=>[entry.path,entry.url]));
  const withImage=(question:Question):Question=>({
   ...question,
   image_url:question.image_path?signedMap.get(question.image_path)??null:null
  });
  setQuestions(qs.map(withImage));
  const ids=new Set(qs.map(question=>question.id));
  setOptions(((o.data??[]) as Option[]).filter(option=>ids.has(option.question_id)));
  const ars=arsRaw.map(attempt=>({
   ...attempt,
   responses:attempt.responses.map(response=>({
    ...response,
    question:response.question?{
     ...response.question,
     image_url:response.question.image_path?signedMap.get(response.question.image_path)??null:null
    }:null
   }))
  }));
  setAttempts(ars);
  setRoster((a.data?.students??[]) as StudentRoster[]);
  setAttemptId(current=>current&&ars.some(attempt=>attempt.id===current)?current:ars[0]?.id??"");
  const drafts:Record<string,{score:string;feedback:string}>={};
  ars.forEach(attempt=>attempt.responses?.forEach(response=>{
   if(response.question?.question_type==="structured"){
    drafts[response.id]={score:response.teacher_score==null?"":String(response.teacher_score),feedback:response.feedback??""};
   }
  }));
  setGrades(drafts);
  const marks:Record<string,MarkAnnotation[]>={};
  ars.forEach(attempt=>attempt.responses?.forEach(response=>{
   marks[response.id]=Array.isArray(response.marking_annotations)?response.marking_annotations:[];
  }));
  setAnnotationDrafts(marks);
  setSelectedRanges({});
 },[quizId,s]);
 useEffect(()=>{void detail();},[detail]);
 const selected=quizzes.find(q=>q.id===quizId)??null;const selectedAttempt=attempts.find(a=>a.id===attemptId)??null;const chapterMap=new Map(chapters.map(c=>[c.id,c]));
 const studentSummaries=useMemo(()=>roster.map(student=>{
  const rows=attempts.filter(a=>a.student_id===student.user_id).slice().sort((a,b)=>b.attempt_number-a.attempt_number);
  const graded=rows.filter(a=>a.status==="graded");
  const best=graded.reduce<A|null>((current,candidate)=>{
   if(!current)return candidate;
   const currentRate=current.max_score>0?current.total_score/current.max_score:0;
   const candidateRate=candidate.max_score>0?candidate.total_score/candidate.max_score:0;
   return candidateRate>currentRate?candidate:current;
  },null);
  const latest=rows[0]??null;
  const reviewTarget=latest&&latest.status!=="in_progress"?latest:best;
  return {student,rows,best,latest,reviewTarget};
 }),[roster,attempts]);
 const studentsAttempted=studentSummaries.filter(x=>x.rows.some(a=>a.status!=="in_progress")).length;
 const studentsGraded=studentSummaries.filter(x=>x.rows.some(a=>a.status==="graded")).length;
 const pendingReviews=attempts.filter(a=>a.status==="pending_review").length;
 const bestCollected=studentSummaries.reduce((sum,x)=>sum+Number(x.best?.total_score??0),0);
 const bestMaximum=studentSummaries.reduce((sum,x)=>sum+Number(x.best?.max_score??0),0);
 const quizStatusLabel=(status:string)=>status==="graded"?"SELESAI DINILAI":status==="pending_review"?"MENUNGGU SEMAKAN":"SEDANG MENJAWAB";
 async function createQuiz(e:FormEvent){e.preventDefault();setBusy(true);setError("");const {data,error:err}=await s.from("learning_quizzes").insert({title:qf.title.trim(),description:qf.description.trim()||null,target_form_level:qf.target==="all"?null:Number(qf.target),chapter_id:qf.chapter_id||null,attempt_limit:Number(qf.limit),created_by:uid,status:"draft"}).select("*").single();setBusy(false);if(err||!data){setError(err?.message??"Kuiz gagal dicipta.");return;}setQf({title:"",description:"",target:"all",chapter_id:"",limit:"1"});setQuizId(data.id);setNotice("Kuiz dicipta sebagai draf.");await refresh();}
 function chooseQuestionImage(file:File|null){
  if(!file)return;
  const allowed=["image/jpeg","image/png","image/webp"];
  if(!allowed.includes(file.type)){
   setError("Format gambar tidak disokong. Gunakan JPG, PNG atau WebP.");
   if(imageInputRef.current)imageInputRef.current.value="";
   return;
  }
  if(file.size>5*1024*1024){
   setError("Saiz gambar melebihi 5 MB. Kecilkan gambar sebelum dimuat naik.");
   if(imageInputRef.current)imageInputRef.current.value="";
   return;
  }
  setForm(current=>({...current,imageFile:file,imagePreviewUrl:URL.createObjectURL(file)}));
  setError("");
 }

 function clearQuestionImage(){
  setForm(current=>({...current,imageFile:null,imagePreviewUrl:""}));
  if(imageInputRef.current)imageInputRef.current.value="";
 }

 async function addQuestion(e:FormEvent){
  e.preventDefault();
  if(!form.prompt.trim()&&!form.imageFile){
   setError("Taip pernyataan soalan atau muat naik gambar soalan.");
   return;
  }
  if(form.kind==="objective"&&form.options.some(value=>!value.trim())){
   setError("Lengkapkan empat pilihan jawapan.");
   return;
  }
  setBusy(true);setError("");setNotice("");
  let imagePath:string|null=null;
  let createdQuestionId:string|null=null;
  try{
   if(form.imageFile){
    const extension=form.imageFile.type==="image/jpeg"?"jpg":form.imageFile.type==="image/png"?"png":"webp";
    imagePath=quizId+"/"+crypto.randomUUID()+"."+extension;
    const {data:signedUpload,error:signError}=await s.storage.from("quiz-question-images").createSignedUploadUrl(imagePath);
    if(signError||!signedUpload)throw new Error(signError?.message??"Pautan muat naik gambar gagal dijana.");
    const {error:uploadError}=await s.storage.from("quiz-question-images").uploadToSignedUrl(
     imagePath,signedUpload.token,form.imageFile,{contentType:form.imageFile.type,cacheControl:"3600"}
    );
    if(uploadError)throw new Error(uploadError.message);
   }

   const {data:q,error:qErr}=await s.from("quiz_questions").insert({
    quiz_id:quizId,
    question_order:questions.length+1,
    question_type:form.kind,
    prompt:form.prompt.trim()||(imagePath?"Lihat gambar soalan":""),
    marks:Number(form.marks),
    image_path:imagePath
   }).select("*").single();
   if(qErr||!q)throw new Error(qErr?.message??"Soalan gagal disimpan.");
   createdQuestionId=q.id;

   let correctId:string|null=null;
   if(form.kind==="objective"){
    const {data:o,error:oErr}=await s.from("quiz_options").insert(
     form.options.map((value,index)=>({
      question_id:q.id,
      option_code:["A","B","C","D"][index],
      option_text:value.trim(),
      option_order:index+1
     }))
    ).select("*");
    if(oErr||!o)throw new Error(oErr?.message??"Pilihan jawapan gagal disimpan.");
    correctId=(o as Option[]).find(option=>option.option_code===form.correct)?.id??null;
   }

   const {data:k,error:kErr}=await s.functions.invoke("quiz-engine",{body:{
    action:"save_answer_key",
    question_id:q.id,
    correct_option_id:correctId,
    marking_guide:form.kind==="structured"?form.guide.trim():null
   }});
   if(kErr||k?.error)throw new Error(kErr?.message??k?.error??"Kunci jawapan gagal disimpan.");

   setForm({...fresh});
   if(imageInputRef.current)imageInputRef.current.value="";
   setNotice(imagePath?"Soalan dan gambar berjaya dimuat naik.":"Soalan berjaya ditambah.");
   await detail();
  }catch(cause){
   if(createdQuestionId){
    await s.from("quiz_questions").delete().eq("id",createdQuestionId);
   }
   if(imagePath){
    await s.storage.from("quiz-question-images").remove([imagePath]);
   }
   setError(cause instanceof Error?cause.message:"Soalan gagal disimpan.");
  }finally{
   setBusy(false);
  }
 }
 async function publish(){if(!selected)return;setBusy(true);const {data,error:err}=await s.functions.invoke("quiz-engine",{body:{action:"publish_quiz",quiz_id:selected.id}});setBusy(false);if(err||data?.error){setError(err?.message??data?.error??"Gagal menerbitkan kuiz.");return;}setNotice("Kuiz berjaya diterbitkan.");await refresh();}
 async function unpublish(){if(!selected)return;setBusy(true);const {error:err}=await s.from("learning_quizzes").update({status:"draft"}).eq("id",selected.id);setBusy(false);if(err)setError(err.message);else{setNotice("Kuiz ditarik balik.");await refresh();}}
 async function resetAttempts(){
  if(!selected)return;
  const scopeText=roleLabel==="GURU"?"percubaan murid daripada kelas yang ditugaskan kepada akaun anda":"semua percubaan murid";
  const ok=window.confirm(
   "RESET PERCOBAAN KUIZ?\n\nTindakan ini akan memadam "+scopeText+", termasuk jawapan, markah dan ulasan guru. Kuiz akan ditarik balik dan perlu diterbitkan semula. Tindakan ini tidak boleh dibatalkan. Teruskan?"
  );
  if(!ok)return;
  setBusy(true);setError("");setNotice("");
  const {data,error:err}=await s.functions.invoke("quiz-engine",{body:{action:"reset_quiz_attempts",quiz_id:selected.id}});
  setBusy(false);
  if(err||data?.error){setError(err?.message??data?.error??"Reset percubaan gagal.");return;}
  setNotice(data.message??"Percubaan berjaya direset.");
  await refresh();
  await detail();
 }

 async function removeQuiz(){
  if(!selected)return;
  const ok=window.confirm(
   "PADAM KESELURUHAN KUIZ?\n\nKuiz '"+selected.title+"' akan dipadam bersama semua soalan, pilihan jawapan, kunci jawapan, jawapan murid, markah dan sejarah percubaan yang berkaitan. Tindakan ini kekal dan tidak boleh dibatalkan. Teruskan?"
  );
  if(!ok)return;
  setBusy(true);setError("");setNotice("");
  const {data,error:err}=await s.functions.invoke("quiz-engine",{body:{action:"delete_quiz",quiz_id:selected.id}});
  setBusy(false);
  if(err||data?.error){setError(err?.message??data?.error??"Kuiz gagal dipadam.");return;}
  setNotice(data.message??"Kuiz berjaya dipadam.");
  setQuizId("");
  await refresh();
 }

 async function removeQuestion(question:Question){
  const ok=window.confirm(
   "PADAM SOALAN "+question.question_order+"?\n\nSoalan ini serta pilihan jawapan dan kunci jawapannya akan dipadam. Kuiz mesti berstatus draf dan semua percubaan murid mesti direset terlebih dahulu. Teruskan?"
  );
  if(!ok)return;
  setBusy(true);setError("");setNotice("");
  const {data,error:err}=await s.functions.invoke("quiz-engine",{body:{
   action:"delete_question",quiz_id:quizId,question_id:question.id
  }});
  setBusy(false);
  if(err||data?.error){setError(err?.message??data?.error??"Soalan gagal dipadam.");return;}
  setNotice(data.message??"Soalan berjaya dipadam.");
  await detail();
 }

 function captureSelection(responseId:string){
  const root=answerRefs.current[responseId];
  const selection=window.getSelection();
  if(!root||!selection||selection.rangeCount===0)return;
  const range=selection.getRangeAt(0);
  if(!root.contains(range.startContainer)||!root.contains(range.endContainer))return;
  const text=selection.toString();
  if(!text.trim())return;
  const prefix=range.cloneRange();
  prefix.selectNodeContents(root);
  prefix.setEnd(range.startContainer,range.startOffset);
  const start=prefix.toString().length;
  setSelectedRanges(current=>({...current,[responseId]:{start,end:start+text.length,text}}));
 }

 function addAnnotation(responseId:string,type:MarkType){
  const selected=selectedRanges[responseId];
  if(!selected)return;
  const existing=annotationDrafts[responseId]??[];
  const overlap=existing.some(a=>selected.start<a.end&&selected.end>a.start);
  if(overlap){setError("Frasa ini sudah mempunyai tanda. Buang tanda lama dahulu jika mahu menukarnya.");return;}
  const annotation:MarkAnnotation={id:crypto.randomUUID(),...selected,type};
  setAnnotationDrafts(current=>({...current,[responseId]:[...(current[responseId]??[]),annotation].sort((a,b)=>a.start-b.start)}));
  setSelectedRanges(current=>{const next={...current};delete next[responseId];return next;});
  window.getSelection()?.removeAllRanges();
  setError("");
 }

 function removeAnnotation(responseId:string,annotationId:string){
  setAnnotationDrafts(current=>({...current,[responseId]:(current[responseId]??[]).filter(a=>a.id!==annotationId)}));
 }

 async function grade(r:R){
  const d=grades[r.id];
  if(!d?.score.trim()){setError("Masukkan markah.");return;}
  setBusy(true);setError("");setNotice("");
  const {data,error:err}=await s.functions.invoke("quiz-engine",{body:{
   action:"grade_response",
   response_id:r.id,
   teacher_score:Number(d.score),
   feedback:d.feedback,
   marking_annotations:annotationDrafts[r.id]??[]
  }});
  setBusy(false);
  if(err||data?.error){setError(err?.message??data?.error??"Pemarkahan gagal disimpan.");return;}
  setNotice("Markah, ulasan dan tanda pada jawapan berjaya disimpan bersama. Murid boleh melihat tanda selepas memuat semula rekod.");
  await detail();
 }
 return <main className={styles.pageShell}><header className={styles.topBar}><Link className={styles.brand} href={dashboardHref}><span className={styles.brandMark}>ES</span><span><strong>EKONOMI SMART</strong><small>PENTAKSIRAN DAN KUIZ</small></span></Link><div className={styles.topActions}><span className={styles.roleBadge}>{roleLabel}</span><Link className={styles.backLink} href={dashboardHref}>Dashboard</Link></div></header>
 <section className={styles.pageContent}><div className={styles.hero}><span className={styles.eyebrow}>PUSAT PENTAKSIRAN DIGITAL</span><h1>Pengurusan latihan dan kuiz</h1><p>Bina soalan objektif dan struktur, terbitkan kuiz serta semak jawapan murid. {roleLabel === "GURU" ? "Senarai skrip dan pemarkahan dihadkan kepada kelas yang dipautkan kepada akaun guru anda." : "Pentadbir boleh melihat dan menyemak semua percubaan murid."}</p></div>{error?<div className={styles.errorBox}>{error}</div>:null}{notice?<div className={styles.noticeBox}>{notice}</div>:null}
 <div className={styles.managerGrid}><section className={styles.panel}><span className={styles.eyebrow}>LANGKAH 1</span><h2>Cipta kuiz</h2><form className={styles.form} onSubmit={createQuiz}>
 <label className={styles.fullWidth}>Tajuk kuiz<input required value={qf.title} onChange={e=>setQf({...qf,title:e.target.value})} placeholder="Contoh: Latihan Bab 1"/></label><label className={styles.fullWidth}>Penerangan<textarea rows={2} value={qf.description} onChange={e=>setQf({...qf,description:e.target.value})}/></label>
 <label>Sasaran<select value={qf.target} onChange={e=>setQf({...qf,target:e.target.value})}><option value="all">Tingkatan 4 dan 5</option><option value="4">Tingkatan 4</option><option value="5">Tingkatan 5</option></select></label>
 <label>Had percubaan<select value={qf.limit} onChange={e=>setQf({...qf,limit:e.target.value})}>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n} kali</option>)}</select></label>
 <label className={styles.fullWidth}>Bab berkaitan<select value={qf.chapter_id} onChange={e=>setQf({...qf,chapter_id:e.target.value})}><option value="">Tidak dipautkan</option>{chapters.map(c=><option key={c.id} value={c.id}>T{c.form_level} · Bab {c.chapter_number}: {c.title}</option>)}</select></label><button className={styles.primaryButton} disabled={busy||loading}>Cipta kuiz draf</button></form></section>
 <section className={styles.panel}><div className={styles.panelHeading}><div><span className={styles.eyebrow}>SENARAI KUIZ</span><h2>Kuiz berdaftar</h2></div><button className={styles.textButton} type="button" onClick={()=>void refresh()}>Muat semula</button></div>{loading?<p className={styles.emptyText}>Memuatkan...</p>:quizzes.length===0?<p className={styles.emptyText}>Belum ada kuiz.</p>:<div className={styles.quizList}>{quizzes.map(q=><button key={q.id} type="button" className={q.id===quizId?styles.quizListItemActive:styles.quizListItem} onClick={()=>setQuizId(q.id)}><span><strong>{q.title}</strong><small>{q.target_form_level?"Tingkatan "+q.target_form_level:"Tingkatan 4 dan 5"} · {q.attempt_limit} percubaan</small></span><span className={q.status==="published"?styles.publishedTag:styles.draftTag}>{q.status==="published"?"DITERBITKAN":"DRAF"}</span></button>)}</div>}</section></div>
 {selected?<><section className={styles.panel+" "+styles.questionPanel}><div className={styles.panelHeading}><div><span className={styles.eyebrow}>LANGKAH 2</span><h2>{selected.title}</h2><p className={styles.panelSub}>{selected.target_form_level?"Tingkatan "+selected.target_form_level:"Tingkatan 4 dan 5"}{selected.chapter_id&&chapterMap.get(selected.chapter_id)?" · Bab "+chapterMap.get(selected.chapter_id)?.chapter_number+": "+chapterMap.get(selected.chapter_id)?.title:""}</p></div><div className={styles.quizAdminActions}>
 {selected.status==="published"
  ? <button className={styles.secondaryButton} type="button" disabled={busy} onClick={()=>void unpublish()}>Tarik balik</button>
  : <button className={styles.primaryButton} type="button" disabled={busy||!questions.length} onClick={()=>void publish()}>Terbitkan kuiz</button>}
 {attempts.length>0
  ? <button className={styles.resetButton} type="button" disabled={busy} onClick={()=>void resetAttempts()}>{roleLabel==="GURU"?"Reset percubaan kelas saya":"Reset semua percubaan"}</button>
  : null}
 <button className={styles.deleteButton} type="button" disabled={busy} onClick={()=>void removeQuiz()}>Padam kuiz</button>
</div></div>
 <div className={styles.questionLayout}><div><h3>Soalan ({questions.length})</h3>{questions.length===0?<p className={styles.emptyText}>Tambahkan soalan untuk membina kuiz.</p>:questions.map(q=><article className={styles.questionCard} key={q.id}><div className={styles.questionMeta}><span>SOALAN {q.question_order}</span><span>{q.question_type==="objective"?"OBJEKTIF":"STRUKTUR"}</span><span>{q.marks} markah</span></div>{q.image_url?<img className={styles.questionImagePreview} src={q.image_url} alt={"Gambar soalan "+q.question_order}/>:null}{q.prompt!=="Lihat gambar soalan"?<p>{q.prompt}</p>:null}{q.question_type==="objective"?<ol className={styles.optionList} type="A">{options.filter(o=>o.question_id===q.id).map(o=><li key={o.id}>{o.option_text}</li>)}</ol>:<small>Jawapan struktur — ditanda secara manual.</small>}
 <div className={styles.questionCardActions}>
  <span>{selected.status==="published"?"Tarik balik kuiz untuk mengubah soalan.":attempts.length>0?"Reset percubaan sebelum memadam soalan.":"Soalan boleh dipadam."}</span>
  <button className={styles.questionDeleteButton} type="button" disabled={busy||selected.status==="published"} onClick={()=>void removeQuestion(q)}>Padam soalan</button>
 </div>
</article>)}</div>
 <div className={styles.addQuestionBox}><h3>Tambah soalan</h3><form className={styles.form} onSubmit={addQuestion}><label>Jenis<select value={form.kind} onChange={e=>setForm({...form,kind:e.target.value as "objective"|"structured"})}><option value="objective">Objektif automatik</option><option value="structured">Struktur manual</option></select></label><label>Markah<input type="number" min="0.5" step="0.5" value={form.marks} onChange={e=>setForm({...form,marks:e.target.value})}/></label><label className={styles.fullWidth}>Pernyataan / arahan soalan (pilihan jika menggunakan gambar)<textarea rows={3} required={!form.imageFile} value={form.prompt} onChange={e=>setForm({...form,prompt:e.target.value})} placeholder="Taip soalan di sini, atau muat naik gambar soalan di bawah..."/></label>
 <div className={styles.questionImageUploader}>
  <div className={styles.questionImageUploadCopy}>
   <strong>Gambar soalan (pilihan)</strong>
   <span>Muat naik foto, rajah, graf, jadual atau imej soalan. Boleh digunakan bersama teks atau sebagai soalan bergambar sahaja.</span>
   <small>JPG, PNG atau WebP · Maksimum 5 MB</small>
  </div>
  <label className={styles.imageUploadButton}>
   {form.imageFile?"Tukar gambar":"Pilih gambar soalan"}
   <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>chooseQuestionImage(event.currentTarget.files?.[0]??null)} disabled={busy||selected?.status==="published"}/>
  </label>
  {form.imagePreviewUrl?<div className={styles.questionImageLocalPreview}>
   <img src={form.imagePreviewUrl} alt="Pratonton gambar soalan yang dipilih"/>
   <button type="button" className={styles.removeQuestionImageButton} disabled={busy} onClick={clearQuestionImage}>Buang gambar</button>
  </div>:null}
 </div>{form.kind==="objective"?<>{form.options.map((v,i)=><label key={i}>Pilihan {["A","B","C","D"][i]}<input required value={v} onChange={e=>setForm(x=>({...x,options:x.options.map((o,j)=>i===j?e.target.value:o)}))}/></label>)}<label className={styles.fullWidth}>Jawapan betul<select value={form.correct} onChange={e=>setForm({...form,correct:e.target.value})}>{["A","B","C","D"].map(x=><option key={x}>{x}</option>)}</select></label></>:<label className={styles.fullWidth}>Panduan pemarkahan guru<textarea rows={3} value={form.guide} onChange={e=>setForm({...form,guide:e.target.value})}/><small>Tidak dipaparkan kepada murid.</small></label>}<button className={styles.primaryButton} disabled={busy||selected?.status==="published"}>{busy?"Menyimpan...":"Tambah soalan"}</button></form></div></div></section>
 <section className={styles.panel+" "+styles.reviewPanel}><div className={styles.panelHeading}><div><span className={styles.eyebrow}>LANGKAH 3</span><h2>Keputusan dan semakan</h2></div><button className={styles.textButton} type="button" onClick={()=>void detail()}>Muat semula</button></div>{roster.length>0?<section className={styles.markCollectionPanel}>
 <div className={styles.markCollectionHeading}><div><span className={styles.eyebrow}>RUMUSAN KELAS</span><h3>Kutipan markah setiap murid</h3><p>Senarai ini hanya memaparkan murid dalam kelas yang berada di bawah penugasan akaun guru. Markah terbaik dikira sekali bagi setiap murid.</p></div><span className={styles.markCollectionCount}>{studentSummaries.length} MURID</span></div>
 <div className={styles.markCollectionStats}>
  <div><strong>{studentsAttempted}</strong><span>SUDAH MENJAWAB</span></div>
  <div><strong>{studentsGraded}</strong><span>ADA MARKAH AKHIR</span></div>
  <div><strong>{pendingReviews}</strong><span>MENUNGGU SEMAKAN</span></div>
  <div><strong>{bestCollected}/{bestMaximum}</strong><span>KUTIPAN MARKAH TERBAIK</span></div>
 </div>
 <div className={styles.markCollectionTableWrap}><table className={styles.markCollectionTable}>
  <thead><tr><th>NAMA MURID</th><th>KELAS</th><th>PERCUBAAN</th><th>MARKAH TERBAIK</th><th>STATUS TERKINI</th><th></th></tr></thead>
  <tbody>{studentSummaries.map(item=><tr key={item.student.user_id}>
   <td><strong>{item.student.full_name}</strong></td>
   <td>T{item.student.form_level} · {item.student.class_name}</td>
   <td>{item.rows.length}/{selected?.attempt_limit??"—"}</td>
   <td><strong className={styles.markCollectionScore}>{item.best?Number(item.best.total_score)+"/"+Number(item.best.max_score):"—"}</strong></td>
   <td><span className={item.latest?.status==="graded"?styles.scoreStatusDone:item.latest?.status==="pending_review"?styles.scoreStatusPending:item.latest?.status==="in_progress"?styles.scoreStatusProgress:styles.scoreStatusEmpty}>{item.latest?quizStatusLabel(item.latest.status):"BELUM MENJAWAB"}</span></td>
   <td>{item.reviewTarget?<button type="button" className={styles.markReviewButton} onClick={()=>setAttemptId(item.reviewTarget!.id)}>SEMAK</button>:<span className={styles.markNoAttempt}>—</span>}</td>
  </tr>)}</tbody>
 </table></div>
 <p className={styles.markCollectionFootnote}>Murid tanpa percubaan turut disenaraikan. Percubaan belum dihantar dan jawapan yang menunggu semakan tidak dikira sebagai markah akhir.</p>
</section>:<div className={styles.emptyText}>Tiada murid dalam kelas yang ditugaskan kepada akaun ini untuk kuiz berkenaan.</div>}
{attempts.length===0?<p className={styles.emptyText}>Belum ada percubaan murid.</p>:<div className={styles.reviewLayout}><div className={styles.attemptList}>{attempts.map(a=><button type="button" key={a.id} className={a.id===attemptId?styles.attemptItemActive:styles.attemptItem} onClick={()=>setAttemptId(a.id)}><strong>{a.student?.full_name??"Murid"}</strong><small>{a.student?"T"+a.student.form_level+" · "+a.student.class_name:""} · Percubaan {a.attempt_number}</small><span className={a.status==="graded"?styles.publishedTag:styles.draftTag}>{quizStatusLabel(a.status)}</span><small>{a.total_score}/{a.max_score} markah</small></button>)}</div><div className={styles.responseReview}>{selectedAttempt?<><div className={styles.resultSummary}><strong>{selectedAttempt.student?.full_name??"Murid"}</strong><strong>{selectedAttempt.total_score}/{selectedAttempt.max_score}</strong></div>{selectedAttempt.responses.map((r,i)=><article className={styles.responseCard} key={r.id}><div className={styles.questionMeta}><span>SOALAN {r.question?.question_order??i+1}</span><span>{r.question?.marks??0} markah</span></div>{r.question?.image_url?<img className={styles.questionImagePreview} src={r.question.image_url} alt={"Gambar soalan "+(r.question.question_order??i+1)}/>:null}{r.question?.prompt!=="Lihat gambar soalan"?<p>{r.question?.prompt}</p>:null}{r.question?.question_type==="structured"&&r.question?.marking_guide?<div className={styles.responseInfo}>Panduan pemarkahan guru: {r.question.marking_guide}</div>:null}{r.question?.question_type==="objective"?<div className={styles.responseInfo}>Jawapan {r.selected_option?.option_code??"—"} {r.selected_option?.option_text??"Tidak dijawab"} · Markah automatik {r.auto_score??0}</div>:<><div
 ref={node=>{answerRefs.current[r.id]=node;}}
 className={styles.studentAnswer+" "+styles.teacherSelectableAnswer}
 onMouseUp={()=>captureSelection(r.id)}
 onKeyUp={()=>captureSelection(r.id)}
 tabIndex={0}
 aria-label="Pilih perkataan dalam jawapan murid untuk menanda pemarkahan"
>{renderMarkedAnswer(r.response_text||"Tiada jawapan.",annotationDrafts[r.id],false)}</div>
 <div className={styles.markingToolbar}>
  <div className={styles.markingToolbarHeading}>
   <strong>Tanda pemarkahan pada jawapan</strong>
   <span>Pilih perkataan atau frasa di atas, kemudian pilih simbol.</span>
  </div>
  {selectedRanges[r.id]?<div className={styles.selectedPhrase}>Dipilih: “{selectedRanges[r.id].text}”</div>:<div className={styles.selectionHint}>Tiada teks dipilih. Seret tetikus pada perkataan yang membawa markah atau kesalahan.</div>}
  <div className={styles.markingToolButtons}>
   {MARK_TYPES.map(mark=><button key={mark.type} type="button" className={styles.markingToolButton+" "+styles["markingTool"+mark.type]} disabled={!selectedRanges[r.id]||busy} title={mark.label} onClick={()=>addAnnotation(r.id,mark.type)}>
    <strong>{mark.symbol}</strong><span>{mark.label}</span>
   </button>)}
  </div>
  {(annotationDrafts[r.id]??[]).length>0?<div className={styles.markingAnnotationList}>
   {(annotationDrafts[r.id]??[]).map(mark=><span className={styles.markingAnnotationChip+" "+styles["markingChip"+mark.type]} key={mark.id}>
    <strong>{MARK_TYPES.find(x=>x.type===mark.type)?.symbol}</strong> {mark.text}
    <button type="button" aria-label={"Buang tanda "+mark.text} disabled={busy} onClick={()=>removeAnnotation(r.id,mark.id)}>×</button>
   </span>)}
  </div>:null}
  <p className={styles.saveAnnotationsHint}>Semua tanda di atas akan disimpan bersama markah dan ulasan apabila guru menekan <strong>Simpan pemarkahan</strong>.</p>
 </div>
 <div className={styles.gradeForm}><label>Markah<input type="number" min="0" max={r.question?.marks??0} step="0.5" value={grades[r.id]?.score??""} onChange={e=>setGrades(x=>({...x,[r.id]:{score:e.target.value,feedback:x[r.id]?.feedback??""}}))}/></label><label>Ulasan guru<input value={grades[r.id]?.feedback??""} onChange={e=>setGrades(x=>({...x,[r.id]:{score:x[r.id]?.score??"",feedback:e.target.value}}))}/></label><button className={styles.secondaryButton} type="button" disabled={busy} onClick={()=>void grade(r)}>{busy?"Menyimpan...":"Simpan pemarkahan"}</button></div></>}</article>)}</>:<p className={styles.emptyText}>Pilih percubaan murid.</p>}</div></div>}</section></>:null}
 </section></main>;
}
