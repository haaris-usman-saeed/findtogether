const BACKEND = 'https://findtogether-haaris.quietyak18.chatgpt.site';
const responseHeaders = {'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const failure = (status:number, message:string) => Response.json(
  {error:{code:status===403?'forbidden':'server_unavailable',message}},
  {status,headers:responseHeaders},
);

// Same-origin browser API; the database and all authorization stay on the backend.
export async function proxy(request:Request, upstream:typeof fetch = fetch):Promise<Response> {
  const url = new URL(request.url);
  const path = url.searchParams.get('path') ?? url.pathname.replace(/^\/api\//,'');
  if (!/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(path) || path==='proxy') {
    return failure(404,'Endpoint not found.');
  }
  if (!['GET','POST'].includes(request.method)) return failure(405,'Method not allowed.');
  const origin = request.headers.get('Origin');
  if ((origin && origin !== url.origin) || request.headers.get('Sec-Fetch-Site')==='cross-site') {
    return failure(403,'Cross-site request rejected.');
  }
  const headers = new Headers({'Accept':'application/json'});
  for (const name of ['X-Findtogether-Session','Idempotency-Key']) {
    const value = request.headers.get(name);
    if (value) headers.set(name,value);
  }
  let body:string|undefined;
  if (request.method==='POST') {
    if (!request.headers.get('Content-Type')?.includes('application/json')) return failure(415,'JSON is required.');
    body = await request.text();
    if (body.length > 16000) return failure(413,'Request is too large.');
    headers.set('Content-Type','application/json');
    // The incoming frontend origin was checked above. No browser cookies are forwarded.
    headers.set('Origin',BACKEND);
  }
  try {
    const result = await upstream(`${BACKEND}/api/${path}`, {
      method:request.method,headers,body,redirect:'error',signal:AbortSignal.timeout(12000),
    });
    if (result.status!==204 && !result.headers.get('Content-Type')?.includes('application/json')) {
      return failure(502,'Could not reach the backend. Please retry with the same submission.');
    }
    const outgoing = new Headers(responseHeaders);
    if (result.status!==204) outgoing.set('Content-Type','application/json');
    const retry = result.headers.get('Retry-After');
    if (retry) outgoing.set('Retry-After',retry);
    return new Response(result.status===204?null:await result.text(),{status:result.status,headers:outgoing});
  } catch {
    return failure(502,'Could not reach the backend. Please retry with the same submission.');
  }
}

export default {fetch:(request:Request)=>proxy(request)};
