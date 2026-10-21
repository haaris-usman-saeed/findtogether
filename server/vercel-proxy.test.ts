import {describe,it,expect,vi} from 'vitest';
import {proxy} from '../api/proxy';
const endpoint='https://findtogether.vercel.app/api/proxy?path=session';
describe('Vercel API proxy',()=>{
 it('forwards session tokens and exact JSON without forwarding browser cookies',async()=>{
  const upstream=vi.fn<typeof fetch>().mockResolvedValue(Response.json({demoToken:'new-token'},{headers:{'Set-Cookie':'private=secret'}}));
  const body='{"role":"volunteer"}';
  const result=await proxy(new Request(endpoint,{method:'POST',headers:{Origin:'https://findtogether.vercel.app','Content-Type':'application/json','X-Findtogether-Session':'token','Idempotency-Key':'retry','Cookie':'other=secret'},body}),upstream);
  expect(await result.json()).toEqual({demoToken:'new-token'});
  const [url,options]=upstream.mock.calls[0];
  expect(url).toBe('https://findtogether-haaris.quietyak18.chatgpt.site/api/session');
  expect(options?.body).toBe(body);
  const headers=new Headers(options?.headers);
  expect(headers.get('X-Findtogether-Session')).toBe('token');
  expect(headers.get('Idempotency-Key')).toBe('retry');
  expect(headers.get('Origin')).toBe('https://findtogether-haaris.quietyak18.chatgpt.site');
  expect(headers.has('Cookie')).toBe(false);
  expect(result.headers.has('Set-Cookie')).toBe(false);
  expect(result.headers.get('Cache-Control')).toBe('no-store');
 });
 it('rejects cross-origin writes and path traversal before forwarding',async()=>{
  const upstream=vi.fn<typeof fetch>();
  expect((await proxy(new Request(endpoint,{method:'POST',headers:{Origin:'https://attacker.example'}}),upstream)).status).toBe(403);
  expect((await proxy(new Request(endpoint.replace('path=session','path=..%2Fsecret')),upstream)).status).toBe(404);
  expect(upstream).not.toHaveBeenCalled();
 });
 it('preserves backend authentication failures and empty success responses',async()=>{
  const upstream=vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({error:{code:'unauthenticated'}},{status:401})).mockResolvedValueOnce(new Response(null,{status:204}));
  expect((await proxy(new Request(endpoint),upstream)).status).toBe(401);
  const result=await proxy(new Request(endpoint),upstream);
  expect(result.status).toBe(204);
  expect(await result.text()).toBe('');
 });
 it('turns upstream HTML failures and network failures into retryable JSON errors',async()=>{
  const upstream=vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('blocked',{status:403})).mockRejectedValueOnce(new Error('network'));
  for(let i=0;i<2;i++){
   const result=await proxy(new Request(endpoint),upstream);
   expect(result.status).toBe(502);
   expect(((await result.json()) as {error:{code:string}}).error.code).toBe('server_unavailable');
  }
 });
});
