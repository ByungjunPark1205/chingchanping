import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Additional isolated-local checks using the disposable accounts from verify-api.mjs.
const state=JSON.parse(readFileSync('.sites-runtime/qa-state.json','utf8'));
const [a,b,c]=state.accounts;
const root='.wrangler/state/v3/d1/miniflare-D1DatabaseObject';
const files=readdirSync(root).filter(n=>n.endsWith('.sqlite')&&n!=='metadata.sqlite');
assert.equal(files.length,1);
const db=new DatabaseSync(root+'/'+files[0]);
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM users WHERE id IN (?,?,?) AND password_hash LIKE ?').get(a.id,b.id,c.id,'$2b$12$%').n,3);
const plan=db.prepare('EXPLAIN QUERY PLAN SELECT id FROM compliments WHERE receiver_id=? AND created_at>?').all(b.id,0);
assert.ok(plan.some(p=>p.detail.includes('idx_compliments_receiver_created')));
const origin='http://localhost:5173';
const post=(path,data,account=a)=>fetch(origin+'/api'+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:account.cookie},body:JSON.stringify(data)});
const old=Date.now()-120000;
db.prepare('UPDATE compliments SET created_at=? WHERE sender_id=?').run(old,a.id);
const msg={receiverId:b.id,message:'하루 횟수 제한을 확인하는 로컬 테스트입니다.',category:'함께해서 즐거워요'};
for(let i=0;i<2;i++){assert.equal((await post('/compliments',msg)).status,201);db.prepare('UPDATE compliments SET created_at=? WHERE sender_id=?').run(old,a.id);}
assert.equal((await post('/compliments',msg)).status,429);
let total=db.prepare('SELECT COUNT(*) AS n FROM compliments WHERE sender_id=?').get(a.id).n;
while(total++<10)db.prepare("INSERT INTO compliments (id,sender_id,receiver_id,message,category,created_at,is_hidden) VALUES (?,?,?,?,?,?,0)").run(randomUUID(),a.id,b.id,'전송 한도 검증용 로컬 데이터','함께해서 즐거워요',old);
assert.equal((await post('/compliments',{...msg,receiverId:c.id})).status,429);
// Reading a stale page must not mark messages arriving afterwards as read.
const newest=Date.now();const incoming=randomUUID();
db.prepare("INSERT INTO compliments (id,sender_id,receiver_id,message,category,created_at,is_hidden) VALUES (?,?,?,?,?,?,0)").run(incoming,b.id,a.id,'읽음 처리 사이에 새로 도착한 테스트 메시지','힘이 되어줘요',newest);
assert.equal((await post('/received/read',{lastSeenAt:newest-1000})).status,200);
let home=await (await fetch(origin+'/api/home',{headers:{Cookie:a.cookie}})).json();assert.equal(home.viewer.unread,1);
assert.equal((await post('/received/read',{lastSeenAt:newest+3600000})).status,400);
assert.equal((await post('/received/read',{lastSeenAt:newest})).status,200);
home=await (await fetch(origin+'/api/home',{headers:{Cookie:a.cookie}})).json();assert.equal(home.viewer.unread,0);
db.close();
console.log('PASS: bcrypt cost 12, receiver query index, 3-per-recipient/day, 10-total/day, and unread watermark race checks.');
