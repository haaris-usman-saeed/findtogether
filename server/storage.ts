import {createDatabase,type Database} from '../src/services/mock/seed';
export function encode(db:Database){return JSON.stringify({...db,cases:[...db.cases],receipts:[...db.receipts]});}
export function decode(raw:string):Database{const d=JSON.parse(raw);return {...d,cases:new Map(d.cases),receipts:new Map(d.receipts)};}
export function fresh(){const db=createDatabase();db.activity=db.activity.filter(a=>!db.registrations.some(r=>(r.safetyConcern||r.consent.matching!=='granted')&&a.text.includes(r.reference)));return db;}
export async function hash(s:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(v=>v.toString(16).padStart(2,'0')).join('');}
