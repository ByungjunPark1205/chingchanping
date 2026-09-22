import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";

// Remove ONLY the exact disposable accounts recorded by the local test runner.
const state=JSON.parse(readFileSync('.sites-runtime/qa-state.json','utf8'));
const root='.wrangler/state/v3/d1/miniflare-D1DatabaseObject';
const files=readdirSync(root).filter(n=>n.endsWith('.sqlite')&&n!=='metadata.sqlite');
assert.equal(files.length,1);
const db=new DatabaseSync(root+'/'+files[0]);
const accounts=state.accounts;
for(const a of accounts){assert.match(a.id,/^[a-f0-9-]{36}$/);assert.match(a.name,/^핑검증[ABC]/);const row=db.prepare('SELECT chat_nickname FROM users WHERE id=?').get(a.id);assert.equal(row?.chat_nickname,a.name);}
const placeholders=accounts.map(()=>'?').join(',');const ids=accounts.map(a=>a.id);
db.exec('BEGIN');
try{
  db.prepare(`DELETE FROM reports WHERE reporter_id IN (${placeholders}) OR compliment_id IN (SELECT id FROM compliments WHERE sender_id IN (${placeholders}) OR receiver_id IN (${placeholders}))`).run(...ids,...ids,...ids);
  db.prepare(`DELETE FROM compliments WHERE sender_id IN (${placeholders}) OR receiver_id IN (${placeholders})`).run(...ids,...ids);
  db.prepare(`DELETE FROM sessions WHERE user_id IN (${placeholders})`).run(...ids);
  db.prepare(`DELETE FROM admin_bootstrap WHERE user_id IN (${placeholders})`).run(...ids);
  db.prepare(`DELETE FROM users WHERE id IN (${placeholders})`).run(...ids);
  const hash=s=>createHash('sha256').update(s).digest('hex');
  for(const a of accounts){db.prepare('DELETE FROM rate_limits WHERE key LIKE ? OR key=?').run('%'+a.id+'%', 'login-name:'+hash(a.name.toLocaleLowerCase('ko-KR')));}
  db.prepare('DELETE FROM rate_limits WHERE key IN (?,?)').run('register:'+hash('local-preview'),'login-ip:'+hash('local-preview'));
  db.exec('COMMIT');
}catch(error){db.exec('ROLLBACK');throw error;}finally{db.close();}
console.log(`Removed ${accounts.length} recorded local QA accounts and their test records. Production was not touched.`);
