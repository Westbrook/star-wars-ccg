import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
// Execute production SQL in real SQLite. This adapter supplies D1's async
// statement/result shapes; batch uses one actual SQLite transaction.
export class SqliteD1 {
 constructor(filename=':memory:',migrate=true){this.sqlite=new DatabaseSync(filename);this.failBatch=false;if(migrate)this.sqlite.exec(fs.readFileSync(new URL('../../drizzle/0002_native_match_sessions.sql',import.meta.url),'utf8'));}
 prepare(sql){return new Statement(this,sql)}
 async batch(statements){this.sqlite.exec('BEGIN IMMEDIATE');try{const result=statements.map((s,i)=>{if(this.failBatch&&i===1){this.failBatch=false;throw Error('Injected storage failure')}return s.execute()});this.sqlite.exec('COMMIT');return result}catch(e){this.sqlite.exec('ROLLBACK');throw e}}
 close(){this.sqlite.close()}
}
class Statement {
 constructor(db,sql,values=[]){this.db=db;this.sql=sql;this.values=values}
 bind(...values){return new Statement(this.db,this.sql,values)}
 async first(){const row=this.db.sqlite.prepare(this.sql).get(...this.values);return row?JSON.parse(JSON.stringify(row)):null}
 execute(){const r=this.db.sqlite.prepare(this.sql).run(...this.values);return{success:true,meta:{changes:Number(r.changes)}}}
 async run(){return this.execute()}
 async all(){return {success:true,results:JSON.parse(JSON.stringify(this.db.sqlite.prepare(this.sql).all(...this.values))),meta:{changes:0}}}
}
