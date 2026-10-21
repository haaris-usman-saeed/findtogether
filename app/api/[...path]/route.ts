import {env} from 'cloudflare:workers';
import {handle} from '../../../server/handler';
export function GET(request:Request){return handle(request,env.DB!);}
export function POST(request:Request){return handle(request,env.DB!);}
