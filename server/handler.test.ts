import {createHttpApi} from '../src/services/http/httpApi';
import {setDemoToken,getDemoToken} from '../src/services/demoSession';
import {describe,it,expect,beforeEach,afterEach,vi} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import {handle} from './handler';
import {readFileSync,readdirSync} from 'node:fs';
// Execute actual generated migration SQL using SQLite; adapt only the D1 transport API.
let sql:DatabaseSync,db:D1Database;
function prepared(query:string,params:unknown[]=[]):any{return {bind:(...values:unknown[])=>prepared(query,values),first:async()=>sql.prepare(query).get(...params as any[])??null,run:async()=>({meta:{changes:Number(sql.prepare(query).run(...params as any[]).changes)}})};}
beforeEach(()=>{sql=new DatabaseSync(':memory:');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')))sql.exec(readFileSync('drizzle/'+f,'utf8'));db={prepare:prepared,batch:async(statements:any[])=>{sql.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}}} as unknown as D1Database;});
afterEach(()=>{vi.unstubAllGlobals();setDemoToken(null);sql.close();});
async function call(path:string,body?:unknown,cookie='',extra:Record<string,string>={}){return handle(new Request('https://test.local/api/'+path,{method:body===undefined?'GET':'POST',headers:{Cookie:cookie,'Content-Type':'application/json',Origin:'https://test.local',...extra},body:body===undefined?undefined:JSON.stringify(body)}),db)}
async function login(role='coordinator',cookie=''){const r=await call('session',{role},cookie);expect(r.status).toBe(200);return r.headers.get('Set-Cookie')!.split(';')[0];}
const registration={names:{preferred:'Test Person',others:[]},age:{kind:'exact',years:32},shelterId:'lincoln',contact:{channel:'shelter_desk'},consent:{matching:'granted',contact:'unknown'},safetyConcern:false};
describe('persistent HTTP backend',()=>{
 it('requires sessions and enforces server role, regardless of client headers',async()=>{expect((await call('cases')).status).toBe(401);const c=await login('volunteer');expect((await call('cases',undefined,c,{'X-Role':'coordinator'})).status).toBe(403);expect((await call('dashboard',undefined,c)).status).toBe(200);});
 it('persists writes, safely retries, rejects changed idempotency payloads, and isolates reviewers',async()=>{const c=await login();const headers={'Idempotency-Key':'abc'};const r=await call('registrations',registration,c,headers);expect(r.status).toBe(201);const receipt=await r.json() as {reference:string};expect(await (await call('registrations',registration,c,headers)).json()).toEqual(receipt);expect((await call('registrations',{...registration,safetyConcern:true},c,headers)).status).toBe(409);const c2=await login();expect((await call(`registrations/${receipt.reference}/consent`,{matching:'granted',contact:'granted'},c2)).status).toBe(404);expect((await call(`registrations/${receipt.reference}/consent`,{matching:'granted',contact:'granted'},c)).status).toBe(204);});
 it('validates input, origin, and shelter ownership',async()=>{const c=await login('volunteer');expect((await call('registrations',{...registration,age:{kind:'exact',years:-1}},c,{'Idempotency-Key':'x'})).status).toBe(422);expect((await call('registrations',{...registration,shelterId:'westside'},c,{'Idempotency-Key':'x'})).status).toBe(403);expect((await call('session',{role:'coordinator'},c,{Origin:'https://evil.test'})).status).toBe(403);});
 it('withholds location/contact, gates authorization, and removes release after withdrawal',async()=>{const c=await login();const path='cases/S-1041/matches/R-2210';let matches:any=await (await call('cases/S-1041/matches',undefined,c)).json();expect(matches[0].shelterName).toContain('Withheld');expect(matches[0].contact).toBeUndefined();expect((await call(path+'/contact-coordination',{method:'supervised_call'},c)).status).toBe(409);await call('cases/S-1041/decisions',{type:'begin_verification',registrationReference:'R-2210'},c);expect((await call(path+'/verification',{step:'registered_consent',result:'agrees',method:'in_person'},c)).status).toBe(409);for(const step of ['relationship','registered_consent','requester_consent'])expect((await call(path+'/verification',{step,result:step==='relationship'?'confirmed':'agrees',method:'in_person'},c)).status).toBe(200);expect((await call(path+'/contact-coordination',{method:'supervised_call'},c)).status).toBe(200);matches=await (await call('cases/S-1041/matches',undefined,c)).json();expect(matches[0].contact.detail).toBe('555-0119');await call('registrations/R-2210/consent',{matching:'granted',contact:'declined'},c);matches=await (await call('cases/S-1041/matches',undefined,c)).json();expect(matches[0].contact).toBeUndefined();expect(await (await call('search-requests/S-1041/status',undefined,c)).json()).toEqual({reference:'S-1041',stage:'active'});});
 it('protects children and does not expose protected registrations',async()=>{const c=await login();expect(await (await call('cases/S-1043/matches',undefined,c)).json()).toEqual([]);const s={requester:{name:'Someone',shelterId:'lincoln',contact:{channel:'shelter_desk'}},sought:{name:'Ana Ruiz',otherNames:[],age:{kind:'exact',years:34},relationship:'spouse_partner'}};const r=await (await call('search-requests',s,c,{'Idempotency-Key':'protected'})).json() as {reference:string};expect(await (await call(`cases/${r.reference}/matches`,undefined,c)).json()).toEqual([]);expect(await (await call(`search-requests/${r.reference}/status`,undefined,c)).json()).toEqual({reference:r.reference,stage:'active'});expect((await call('registrations/R-4102/consent',{matching:'granted',contact:'granted'},c)).status).toBe(404);});
 it('rotates cookies when demo role changes without losing the workspace',async()=>{const c=await login('volunteer');const c2=await login('coordinator',c);expect((await call('cases',undefined,c)).status).toBe(401);expect((await call('cases',undefined,c2)).status).toBe(200);});
 it('keeps both concurrent writes and deduplicates concurrent retries',async()=>{const c=await login();const responses=await Promise.all(['one','two','one'].map(key=>call('registrations',registration,c,{'Idempotency-Key':key})));for(const r of responses)expect(r.status).toBe(201);const receipts=await Promise.all(responses.map(r=>r.json())) as {reference:string}[];expect(receipts[0].reference).toBe(receipts[2].reference);expect(receipts[0].reference).not.toBe(receipts[1].reference);});

 it('uses the real HTTP client without any cookies, across navigation and role changes',async()=>{
  const opened=await call('session',{role:'volunteer'});const first=await opened.json() as {demoToken:string};setDemoToken(first.demoToken);
  vi.stubGlobal('fetch',async(input:string,init:RequestInit)=>handle(new Request('https://test.local'+input,init),db));
  const api=createHttpApi({baseUrl:'/api',getAuthToken:()=>null});const session={role:'volunteer' as const,staffName:'ignored',shelterId:'lincoln',shelterName:'Lincoln'};
  expect((await api.getShelters(session)).length).toBe(4);expect((await api.getDashboard(session)).shelterName).toBe('Lincoln High School');
  const receipt=await api.createRegistration({...registration,clientRequestId:'cookie-free'} as any,session);
  const switched=await call('session',{role:'coordinator'},'',{'X-Findtogether-Session':first.demoToken});expect(switched.status).toBe(200);const second=await switched.json() as {demoToken:string};setDemoToken(second.demoToken);
  expect((await api.listCases(session)).length).toBe(4);
  expect((await call(`registrations/${receipt.reference}/consent`,{matching:'granted',contact:'granted'},'',{'X-Findtogether-Session':second.demoToken})).status).toBe(204);
  expect((await call('session',undefined,'',{'X-Findtogether-Session':second.demoToken})).status).toBe(200);
  expect((await call('dashboard',undefined,'',{'X-Findtogether-Session':first.demoToken})).status).toBe(401);
  setDemoToken('invalid');await expect(api.getDashboard(session)).rejects.toMatchObject({code:'unauthenticated'});expect(getDemoToken()).toBeNull();
 });

 it('switches demo shelters while retaining records and enforcing the new assignment',async()=>{
 const c=await login('volunteer');const switched=await call('session',{role:'volunteer',shelterId:'westside'},c);expect(switched.status).toBe(200);const data=await switched.json() as {demoToken:string;shelterId:string};expect(data.shelterId).toBe('westside');const headers={'X-Findtogether-Session':data.demoToken,'Idempotency-Key':'shelter-change'};
 expect((await call('registrations',{...registration,shelterId:'westside'},'',headers)).status).toBe(201);
 expect((await call('registrations',registration,'',{...headers,'Idempotency-Key':'wrong-shelter'})).status).toBe(403);
 expect(await (await call('search-requests/S-1041/status',undefined,'',headers)).json()).toEqual({reference:'S-1041',stage:'active'});
 const dashboard=await (await call('dashboard',undefined,'',headers)).json() as {shelterName:string};expect(dashboard.shelterName).toBe('Westside Community Center');
 expect((await call('session',{role:'volunteer',shelterId:'invalid'},'',headers)).status).toBe(422);
 });

});
