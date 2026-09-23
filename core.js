/* Shared by website and extension. No access code is bundled here. */
(function(root){
'use strict';
const ENDPOINT='https://script.google.com/macros/s/AKfycbyUrQmRMUK2yYCLAaG5XM5BjepCRMwNymIxzxX4Op0xaQjv9snLGCZpa415VXP1V5i-AQ/exec';
const key=v=>String(v??'').trim().toUpperCase().replace(/^[-#:\s]+/,'').replace(/\s+/g,'');
const text=v=>String(v??'').trim();
const uid=prefix=>(prefix||'op_')+crypto.randomUUID().replace(/-/g,'');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const retryable=e=>!e.code||['BUSY','SERVER_ERROR','NETWORK','TIMEOUT'].includes(e.code);
function validEndpoint(v){return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(v);}
async function request(endpoint,token,action,payload={},timeout=30000){
 if(!validEndpoint(endpoint))throw Object.assign(new Error('URL harus berupa deployment Apps Script /macros/s/.../exec.'),{code:'ENDPOINT'});
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
 try{const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({...payload,action,token}),redirect:'follow',cache:'no-store',signal:controller.signal});
 let result;try{result=JSON.parse(await response.text());}catch{throw Object.assign(new Error('Pusat belum mengirim respons JSON. Periksa URL deployment dan aksesnya.'),{code:'NETWORK'});}
 if(!response.ok||result.ok!==true){const e=new Error(result.error||'Pusat belum mengonfirmasi permintaan.');e.code=result.code||'SERVER_ERROR';e.details=result.details;throw e;}
 if(!/^13\./.test(result.version||''))throw Object.assign(new Error('Backend belum versi 13. Perbarui deployment dahulu.'),{code:'VERSION'});
 return result.data;
 }catch(e){if(e.name==='AbortError')throw Object.assign(new Error('Koneksi melewati batas waktu. Status simpan belum pasti; antrean tetap disimpan.'),{code:'TIMEOUT'});throw e;}finally{clearTimeout(timer);}
}
function fields(o){const d={};['name','nip','model','hook','logo','mp','resi','sku','notes','rejectReason','currentStep','printCount','isReject','createdAt'].forEach(k=>{d[k]=o[k]??({currentStep:1,printCount:1,isReject:false}[k]??'');});return d;}
function overlay(snapshot,pending){const map=new Map((snapshot?.orders||[]).map(x=>[x.id,{...x}]));for(const p of pending){const op=p.operation;if(op.kind==='upsert'){map.set(op.id,{...map.get(op.id),...op.data,id:op.id,revision:'pending:'+op.opId,_pending:p.status||'queued',_error:p.error||''});}else if(['delete','archive','restore'].includes(op.kind)&&map.has(op.id)){map.get(op.id)._pending=p.status||'queued';map.get(op.id)._action=op.kind;}}return [...map.values()];}
function orderMatch(snapshot,d){
 const active=snapshot.orders||[],archives=snapshot.archives||[],mp=key(d.mp),resi=key(d.resi);
 const byMp=mp?active.filter(x=>key(x.mp)===mp):[],byResi=resi?active.filter(x=>key(x.resi)===resi):[];
 if(byResi.some(x=>mp&&key(x.mp)!==mp))throw new Error('Resi dipakai oleh MP lain. Periksa nomor pesanan.');
 const archived=archives.filter(x=>(mp&&key(x.mp)===mp)||(resi&&key(x.resi)===resi));
 if(archived.length)throw new Error('Pesanan ditemukan di arsip. Pulihkan lewat web sebelum mengubahnya.');
 return byMp.length?byMp:(!mp?byResi:[]);
}
function inferModel(x){const n=text(x.notes).toLowerCase(),logo=!!text(x.logo),nip=!!text(x.nip),plain=/polos|tanpa lis/.test(n),line=/line|garis/.test(n);
 const names={1:'Lis + Nama',2:'Lis + Nama + NIP',3:'Lis + Logo + Nama',4:'Lis + Logo + Nama + NIP',5:'Lis + Logo + Nama + Line + NIP',6:'Polos + Nama',7:'Polos + Nama + NIP',8:'Polos + Logo + Nama',9:'Polos + Logo + Nama + NIP',10:'Polos + Logo + Nama + Line + NIP'};
 const i=plain?(logo?(nip?(line?10:9):8):(nip?7:6)):(logo?(nip?(line?5:4):3):(nip?2:1));return `Model ${i} (${names[i]})`;}
function parsePayload(raw){
 let str=text(raw).replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');const obj=JSON.parse(str);
 if(!obj||Array.isArray(obj))throw new Error('JSON harus berupa objek pesanan.');
 const mp=text(obj.orderId??obj.mp??obj.order_id),resi=text(obj.resi??obj.trackingNumber??obj.awb),sku=text(obj.sku??obj.skuToko);
 if(!mp&&!resi)throw new Error('MP atau resi wajib ada.');
 let items=obj.items;if(!items&&Array.isArray(obj.names))items=obj.names.map((n,i)=>({name:n,...(Array.isArray(obj.nips)?{nip:obj.nips[i]}:{}),...(Array.isArray(obj.logos)?{logo:obj.logos[i]}:{})}));
 if(!items&&(obj.name||obj.nama))items=[obj];if(!Array.isArray(items)||!items.length||items.length>50)throw new Error('Isi 1 sampai 50 item.');
 const qty=Number(obj.qty??obj.quantity??items.length);if(!Number.isInteger(qty)||qty!==items.length)throw new Error('Qty harus sama dengan jumlah item.');
 const aliases={name:['name','nama'],nip:['nip','position','jabatan','jurusan'],logo:['logo'],notes:['notes','note','customNote','catatan'],model:['model'],hook:['hook','pengait']};
 items=items.map(x=>{if(!x||typeof x!=='object')throw new Error('Item harus berupa objek.');const y={provided:[]};Object.entries(aliases).forEach(([k,a])=>{const found=a.find(f=>Object.hasOwn(x,f));if(found){y[k]=text(x[found]);y.provided.push(k);}});if(!y.name)throw new Error('Ada item tanpa nama.');return y;});
 return{mp,resi,sku,model:text(obj.model),hook:text(obj.hook??obj.pengait),qty,items};
}
function normalizeModel(v){
 const s=text(v).toLowerCase().replace(/[^0-9]/g,'');
 return s&&Number(s)>=1&&Number(s)<=10?`Model ${Number(s)}`:text(v);
}
function normalizeHook(v){
 const s=text(v).toLowerCase();
 if(['m','mag','magnet'].includes(s))return 'Magnet';
 if(['p','pen','peniti'].includes(s))return 'Peniti';
 return text(v);
}
function parseBulkLine(line){
 const a=String(line||'').split(/[|\t;]/).map(x=>text(x));
 return {mp:a[0]||'',name:a[1]||'',nip:a[2]||'',model:normalizeModel(a[3]),hook:normalizeHook(a[4]),logo:a[5]||'',resi:a[6]||'',sku:a[7]||'',notes:a[8]||''};
}
function inferHook(sku){const s=text(sku).toUpperCase();return /(?:^|[_-])PEN$/.test(s)?'Peniti':/(?:^|[_-])MAG$/.test(s)?'Magnet':/(?:^|[_-])PIN$/.test(s)?'Paku / Pin':'';}
root.NFCore={ENDPOINT,key,text,uid,esc,request,retryable,validEndpoint,fields,overlay,orderMatch,inferModel,parsePayload,inferHook,normalizeModel,normalizeHook,parseBulkLine};
if(typeof module!=='undefined')module.exports=root.NFCore;
})(typeof globalThis!=='undefined'?globalThis:this);
