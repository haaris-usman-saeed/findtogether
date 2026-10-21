import {DEMO_SHELTERS} from '../src/domain/shelters';
import {ApiError,type Session} from '../src/services/contracts';
import {createServerEngine} from './engine';
import {encode,decode,fresh,hash} from './storage';
import * as v from './validation';
import {z} from 'zod';
const TTL=7*86400;
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const json=(data:unknown,status=200,extra:Record<string,string>={})=>Response.json(data,{status,headers:{...headers,...extra}});
const sessionView=(role:string,shelterId:string):Session=>({role:role as Session['role'],staffName:role==='coordinator'?'Demo coordinator':'Demo volunteer',shelterId,shelterName:DEMO_SHELTERS.find(s=>s.id===shelterId)!.name});
export async function handle(request:Request,db:D1Database):Promise<Response>{
 try{
  const url=new URL(request.url),path=url.pathname.replace(/^\/api\/?/,'').split('/').map(decodeURIComponent),now=Math.floor(Date.now()/1000);
  if(!['GET','POST'].includes(request.method))return json({error:{code:'validation',message:'Method not allowed'}},405);
  if(request.method==='POST'){
   const origin=request.headers.get('Origin');
   if((origin&&origin!==url.origin)||request.headers.get('Sec-Fetch-Site')==='cross-site')throw new ApiError('forbidden','Cross-site request rejected.');
   if(!request.headers.get('Content-Type')?.includes('application/json'))throw new ApiError('validation','JSON is required.');
  }
  const raw=request.method==='POST'?await request.text():'';
  if(raw.length>16000)throw new ApiError('validation','Request is too large.');
  let body:unknown={};try{if(raw)body=JSON.parse(raw);}catch{throw new ApiError('validation','Invalid JSON.');}
  const token=request.headers.get('X-Findtogether-Session') || /\bft_session=([^;]+)/.exec(request.headers.get('Cookie')??'')?.[1];
  const tokenHash=token?await hash(token):'';
  const current=tokenHash?await db.prepare('SELECT * FROM sessions WHERE token=? AND expires>?').bind(tokenHash,now).first<{token:string;workspace:string;role:string;shelter_id:string;expires:number}>():null;
  if(path[0]==='health'&&request.method==='GET'){await db.prepare('SELECT 1 FROM workspaces LIMIT 1').first();return json({ok:true,storage:'sql'});}
  // Fixed windows survive worker restarts; never store raw IP addresses.
  const ip=await hash(request.headers.get('CF-Connecting-IP')??'local');
  const bucket=Math.floor(now/60),keys=[`ip:${ip}:${bucket}`,...(current?[`session:${tokenHash}:${bucket}`]:[])];
  for(const key of keys){const row=await db.prepare('INSERT INTO limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key,now+120).first<{count:number}>();if((row?.count??0)>240)return json({error:{code:'conflict',message:'Too many requests. Wait one minute and retry.'}},429,{'Retry-After':'60'});}
  if(path[0]==='session'){
   if(request.method==='GET'){if(!current)throw new ApiError('unauthenticated','Choose a demo role to begin.');return json(sessionView(current.role,current.shelter_id));}
   const {role,shelterId}=z.object({role:z.enum(['volunteer','coordinator']),shelterId:z.enum(['lincoln','westside','fairgrounds','riverside']).default(current?.shelter_id as 'lincoln' ?? 'lincoln')}).parse(body);
   const workspace=current?.workspace??crypto.randomUUID(),newToken=crypto.randomUUID()+crypto.randomUUID(),digest=await hash(newToken);
   const statements=[];
   if(!current)statements.push(db.prepare('INSERT INTO workspaces(id,data,revision,expires) VALUES(?,?,0,?)').bind(workspace,encode(fresh()),now+TTL));
   if(current)statements.push(db.prepare('DELETE FROM sessions WHERE token=?').bind(current.token));
   statements.push(db.prepare('INSERT INTO sessions(token,workspace,role,shelter_id,expires) VALUES(?,?,?,?,?)').bind(digest,workspace,role,shelterId,current?.expires??now+TTL));
   statements.push(db.prepare('DELETE FROM limits WHERE expires<?').bind(now));
   statements.push(db.prepare('DELETE FROM sessions WHERE expires<?').bind(now));
   statements.push(db.prepare('DELETE FROM workspaces WHERE expires<?').bind(now));
   await db.batch(statements);
   return json({...sessionView(role,shelterId),demoToken:newToken},200,{'Set-Cookie':`ft_session=${newToken}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${Math.max(0,(current?.expires??now+TTL)-now)}${url.protocol==='https:'?'; Secure':''}`});
  }
  if(!current)throw new ApiError('unauthenticated','Choose a demo role to begin.');
  const session=sessionView(current.role,current.shelter_id),write=request.method==='POST';
  for(let attempt=0;attempt<5;attempt++){
   const row=await db.prepare('SELECT data,revision FROM workspaces WHERE id=? AND expires>?').bind(current.workspace,now).first<{data:string;revision:number}>();
   if(!row)throw new ApiError('unauthenticated','This demo has expired. Start a new session.');
   const state=decode(row.data),api=createServerEngine(state);
   let result:unknown,status=200;
   const creation=write&&path.length===1&&['registrations','search-requests'].includes(path[0]);
   const idempotency=request.headers.get('Idempotency-Key');
   let receiptKey='',payloadHash='';
   if(creation){
    if(!idempotency||idempotency.length>150)throw new ApiError('validation','A valid Idempotency-Key is required.');
    receiptKey=`${path[0]}:${idempotency}`;payloadHash=await hash(raw);
    const saved=state.receipts.get('http:'+receiptKey) as {hash:string;result:unknown}|undefined;
    if(saved){if(saved.hash!==payloadHash)throw new ApiError('conflict','This submission key was already used for different details.');return json(saved.result,201);}
    if(state.registrations.length+state.requests.length>500)throw new ApiError('conflict','This demo has reached its 500-record limit.');
   }
   if(!write&&path.join('/')==='shelters')result=await api.getShelters(session);
   else if(!write&&path.join('/')==='dashboard')result=await api.getDashboard(session);
   else if(creation&&path[0]==='registrations'){
    const input=v.registration.parse(body);if(session.role==='volunteer'&&input.shelterId!==session.shelterId)throw new ApiError('forbidden','Volunteers can register only at their assigned shelter.');
    result=await api.createRegistration({...input,clientRequestId:receiptKey},session);status=201;
   }else if(creation&&path[0]==='search-requests'){
    const input=v.search.parse(body);if(session.role==='volunteer'&&input.requester.shelterId!==session.shelterId)throw new ApiError('forbidden','Volunteers can submit only at their assigned shelter.');
    result=await api.createSearchRequest({...input,clientRequestId:receiptKey},session);status=201;
   }else if(write&&path[0]==='registrations'&&path.length===3&&path[2]==='consent'){await api.recordConsent(path[1],v.consent.parse(body),session);status=204;}
   else if(!write&&path[0]==='search-requests'&&path.length===3&&path[2]==='status')result=await api.getRequesterStatus(path[1],session);
   else if(path[0]==='cases'){
    if(!write&&path.length===1)result=await api.listCases(session);
    else if(!write&&path.length===2){const {candidates,...detail}=await api.getCase(path[1],session);result=detail;}
    else if(!write&&path.length===3&&path[2]==='matches')result=(await api.getCase(path[1],session)).candidates;
    else if(write&&path.length===3&&path[2]==='decisions')result=await api.submitReviewDecision(path[1],v.decision.parse(body),session);
    else if(write&&path.length===5&&path[2]==='matches'&&path[4]==='verification')result=await api.recordVerificationStep(path[1],path[3],v.verification.parse(body),session);
    else if(write&&path.length===5&&path[2]==='matches'&&path[4]==='contact-coordination')result=await api.requestContactCoordination(path[1],path[3],v.coordination.parse(body).method,session);
    else throw new ApiError('not_found','Endpoint not found.');
   }else throw new ApiError('not_found','Endpoint not found.');
   if(!write)return json(result);
   if(creation)state.receipts.set('http:'+receiptKey,{hash:payloadHash,result});
   // Atomic compare-and-swap: concurrent requests cannot overwrite one another.
   const saved=await db.prepare('UPDATE workspaces SET data=?,revision=revision+1 WHERE id=? AND revision=?').bind(encode(state),current.workspace,row.revision).run();
   if(saved.meta.changes)return status===204?new Response(null,{status,headers}):json(result,status);
  }
  throw new ApiError('conflict','Another update happened at the same time. Please retry.');
 }catch(error){
  if(error instanceof z.ZodError)return json({error:{code:'validation',message:'Check the supplied details.',fieldErrors:Object.fromEntries(error.issues.map(i=>[i.path.join('.'),i.message]))}},422);
  if(error instanceof ApiError)return json({error:{code:error.code,message:error.message,fieldErrors:error.fieldErrors}},({validation:422,unauthenticated:401,forbidden:403,not_found:404,conflict:409,consent_required:409} as Record<string,number>)[error.code]??500);
  console.error('API request failed',error instanceof Error?error.name:'Unknown');
  return json({error:{code:'server_unavailable',message:'The server could not complete the request. Retry with the same submission.'}},500);
 }
}
