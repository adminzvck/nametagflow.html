'use strict';
// Run with Node 18+ (no installation, no network, no production data).
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');global.crypto??=crypto.webcrypto;
const C=require(root+'/core.js');const PF=require(root+'/print-font.js');const LFModule=require(root+'/local-font.js');function emFont(src,name,ratio){const glyphs={};for(const [ch,g] of Object.entries(src.glyphs))glyphs[ch]={...g,a:g.a*ratio,b:g.b.map(v=>v*ratio),d:g.d.replace(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi,m=>String(Number(m)*ratio))};return{name,_local:true,glyphs};}const localBold=emFont(PF.v13_7,'Arial Bold (lokal asli)',.6880118682);const localArial=emFont(PF,'Arial Regular (lokal asli)',.6880118682),localSwis=emFont(PF.swis,'Swis721 BT Regular (lokal asli)',.7172275511);const localSwisBold={...localSwis,name:'Swis721 BT Bold (lokal asli)'};global.NFLocalFonts={get:k=>k==='swisBold'?localSwisBold:k==='swis'?localSwis:k==='arialBold'?localBold:localArial,status:()=>({ready:true,arial:true,swis:true}),requireReady:()=>true,prepare:()=>({ready:true}),charsFromOrders:()=>''};const P=require(root+'/print-engine.js');global.PDFLib=require(root+'/vendor/pdf-lib.min.js');
const clone=structuredClone,models=['Lis + Nama','Lis + Nama + NIP','Lis + Logo + Nama','Lis + Logo + Nama + NIP','Lis + Logo + Nama + Line + NIP','Polos + Nama','Polos + Nama + NIP','Polos + Logo + Nama','Polos + Logo + Nama + NIP','Polos + Logo + Nama + Line + NIP'].map((s,i)=>`Model ${i+1} (${s})`);
const order=(id='NT-TEST')=>({id,revision:'rev0',name:'SUPRIYADI',nip:'00198912022024210023',model:models[0],mp:'000123456789123456789',hook:'Magnet',logo:'',resi:'',sku:'',notes:'',currentStep:6,printCount:1,isReject:false,rejectReason:'',createdAt:'2026-09-29T05:00:00.000Z',productionDate:''});
const snapshot=rows=>({orders:rows,archives:[],recycle:[],settings:{models,hooks:['Magnet','Peniti'],skus:[]}});
const state=rows=>({snapshot:snapshot(rows),pending:[]});
const upsert=o=>({kind:'upsert',id:o.id,expectedRevision:o.revision,opId:C.uid(),data:C.fields(o)});
const ack=(op,o)=>({committed:true,opId:op.opId,id:op.id,kind:op.kind,order:{...o,revision:C.uid('rev-')}});
const cases=[];function test(name,fn){cases.push([name,fn]);}
test('All browser print modules carry the same v13.8.14 build number',()=>{assert.equal(C.WEB_BUILD,'13.8.14');assert.equal(PF.version,C.WEB_BUILD);assert.equal(LFModule.BUILD,C.WEB_BUILD);assert.equal(P.BUILD,C.WEB_BUILD);});
function printing(){const o={...order(),currentStep:1},j=P.createJob([o]);j.downloadedAt=j.createdAt;const s={...state([o]),printJobs:[j]};return{o,j,s};}
function backend(){
 const tables=new Map();let crashFlush=0,flushes=0;
 function sheet(name,width){
  let columns=width;const data=[Array(width).fill('HEADER')];const s={data,getLastRow:()=>data.length,getMaxColumns:()=>columns,insertColumnsAfter:(_at,n)=>{columns+=n;},setFrozenRows:()=>{},
   getRange:(row,col,nr=1,nc=1)=>({getValues:()=>Array.from({length:nr},(_,i)=>Array.from({length:nc},(_,j)=>clone(data[row+i-1]?.[col+j-1]??''))),getValue:()=>clone(data[row-1]?.[col-1]??''),getDisplayValues:()=>Array.from({length:nr},(_,i)=>Array.from({length:nc},(_,j)=>String(data[row+i-1]?.[col+j-1]??''))),setValue:v=>{data[row-1]??=[];data[row-1][col-1]=clone(v);},setValues:rows=>{assert.equal(rows.length,nr);for(const r of rows)assert.equal(r.length,nc,'Sheets range width must match values');rows.forEach((r,i)=>{data[row+i-1]??=[];r.forEach((v,j)=>data[row+i-1][col+j-1]=clone(v));});}}),
   getRangeList:()=>({setNumberFormat:()=>{}}),appendRow:r=>data.push(clone(r)),deleteRow:r=>data.splice(r-1,1)};tables.set(name,s);return s;
 }
 sheet('Antrean Produksi',16);sheet('Arsip Produksi',14);sheet('_NF_Operations',7);sheet('_NF_Recycle',6);sheet('Log Perubahan',8);
 const settings=sheet('Pengaturan',12);models.forEach((m,i)=>{const r=Array(12).fill('');r[0]=m;r[2]=i===0?'Magnet':i===1?'Peniti':'';settings.data.push(r);});
 const ctx=vm.createContext({console,Date,Map,Set,Utilities:{getUuid:()=>crypto.randomUUID(),DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(_alg,v)=>[...crypto.createHash('sha256').update(v).digest()],formatDate:(v)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(v)},SpreadsheetApp:{openById:()=>({getSheetByName:n=>tables.get(n)||null}),flush:()=>{flushes++;if(crashFlush===flushes){crashFlush=0;throw new Error('TEST_INTERRUPTION');}}}});
 vm.runInContext(fs.readFileSync(root+'/backend/Code.gs','utf8'),ctx);
 const active=tables.get('Antrean Produksi'),archives=tables.get('Arsip Produksi');
 function seed(o=order()){const row=[o.id,o.name,o.nip,o.model,o.hook,o.logo||'-',o.mp,o.resi,o.sku,o.printCount,o.currentStep,o.isReject?'YA':'TIDAK',o.rejectReason,new Date(o.createdAt),new Date(o.createdAt),o.notes];if(o.productionDate)row.push(o.productionDate);active.data.push(row);return ctx.nfOrder_(row);}
 function seedArchive(o=order()){const row=[new Date('2026-09-29T10:00:00Z'),o.id,o.name,o.nip,o.model,o.hook,o.logo||'-',o.mp,o.resi,o.sku,o.printCount,'Selesai Transaksi',new Date(o.createdAt),o.notes];archives.data.push(row);return ctx.nfArchive_(row);}
 function mutate(op,role='operator'){return ctx.nfMutate_(op,role,'TESTER');}
 function batch(ops,role='operator'){return ctx.nfMutateBatch_(ops.map(operation=>({operation,operator:'TESTER'})),role);}
 function reprint(o){return{kind:'reprint',id:o.id,opId:C.uid(),expectedRevision:o.revision,reason:'Kotor / bernoda',productionDate:'2026-09-30',data:C.fields(o)};}
 return{ctx,tables,active,archives,seed,seedArchive,mutate,batch,reprint,stats:()=>({flushes}),crashAfter:n=>{crashFlush=flushes+n;}};
}

test('Legacy pending form saved after acknowledgment becomes ready',()=>{const o=order(),s=state([o]);C.queueOperations(s,[upsert(o)],'Test');const first=s.pending[0].operation,captured=C.overlay(s.snapshot,s.pending)[0];C.applyAcknowledgment(s,first,ack(first,{...o,...first.data}));C.queueOperations(s,[{...upsert(captured),data:{...C.fields(captured),name:'UPDATED'}}],'Test');assert.equal(C.readyOperations(s.pending).length,1);assert.equal(s.pending[0].operation.expectedRevision,s.snapshot.orders[0].revision);});
test('Unknown orphan pending revision becomes inspectable instead of waiting',()=>{const o=order(),s=state([o]);C.queueOperations(s,[{...upsert(o),expectedRevision:'pending:op_missing123'}],'Test');assert.equal(s.pending[0].status,'blocked');assert.equal(s.pending[0].code,'STALE_DRAFT');});
test('Changed remote version is not silently overwritten during dependency repair',()=>{const o=order(),s=state([o]);s.operationReceipts={op_old:{id:o.id,revision:'prior'}};C.queueOperations(s,[{...upsert(o),expectedRevision:'pending:op_old'}],'Test');assert.equal(s.pending[0].status,'blocked');});
test('Queued dependencies release after predecessor acknowledgment',()=>{const o=order(),s=state([o]);C.queueOperations(s,[upsert(o)],'A');const first=s.pending[0].operation;s.pending[0].attempted=true;C.queueOperations(s,[{...upsert(o),expectedRevision:'pending:'+first.opId}],'B');assert.equal(C.readyOperations(s.pending).length,1);C.applyAcknowledgment(s,first,ack(first,o));assert.equal(C.readyOperations(s.pending).length,1);});
test('Unsaved edits to the same draft still coalesce',()=>{const o=order(),s=state([o]);C.queueOperations(s,[upsert(o)],'A');const first=s.pending[0].operation;C.queueOperations(s,[{...upsert(o),expectedRevision:'pending:'+first.opId,data:{...C.fields(o),name:'NEW'}}],'A');assert.equal(s.pending.length,1);assert.equal(s.pending[0].operation.data.name,'NEW');});
test('All 10 models retain 55/73 mm name limits',()=>{for(let i=0;i<10;i++){const o={...order(),model:models[i]},a=P.artwork(o,{}, {[P.logoKey(o)]:{omit:true}});assert(a.nameWidth<=([2,3,4,7,8,9].includes(i)?55:73));}});
test('Current long-name fitting matches Corel horizontal compression while v13.8.4 archives stay proportional',()=>{const long={...order(),name:'SETIYA CAHYA NINGRUM'},fresh=P.artwork(long,{}, {},false,'13.8.6'),v1384=P.artwork(long,{}, {},false,'13.8.4'),fp=fresh.shapes.find(x=>x.type==='path'),pp=v1384.shapes.find(x=>x.type==='path');assert(fresh.nameCompression<1);assert(fp.sx<fp.sy);assert(Math.abs(pp.sx-pp.sy)<.00001);assert(fresh.nameWidth<=73);});
test('Corel layout fits 29 tags and paginates the 30th; PDF keeps actual paper size',async()=>{const rows=Array.from({length:30},(_,i)=>order('NT-'+i)),layout=P.plan(rows);assert.equal(layout.grid.capacity,29);assert(Math.abs(layout.grid.left-34.175)<.001);assert(Math.abs(layout.grid.top-11.85)<.001);assert(Math.abs(layout.grid.sideLeft-13.375)<.001);assert.equal(layout.pages[0].length,29);assert.equal(layout.pages[0].filter(x=>x.rotation===90).length,3);const doc=await PDFLib.PDFDocument.load(await P.pdf(P.createJob(rows)));assert.equal(doc.getPageCount(),2);assert(Math.abs(doc.getPage(0).getWidth()*25.4/72-210)<.001);assert(Math.abs(doc.getPage(0).getHeight()*25.4/72-290)<.001);});

test('Archived Regular typography retains its prior metrics and short-name tracking',()=>{const sup=P.artwork({...order(),name:'SUPRIYADI'}, {}, {},false,'13.8.9'),short=P.artwork({...order(),name:'SAHREL',model:models[5]}, {}, {},false,'13.8.9'),spaced=P.artwork({...order(),name:'S A H R E L',model:models[5]}, {}, {},false,'13.8.9');assert.equal(sup.font,'Arial Regular (lokal asli)');assert(sup.nameWidth>51&&sup.nameWidth<53);assert(short.nameWidth>51&&short.nameWidth<54);assert.equal(short.nameSpacing,2.734);assert.equal(spaced.nameSpacing,0);});
test('v13.8.5 archive still uses bundled substitute while v13.8.6 new jobs use local original fonts',()=>{const o=order(),old=P.artwork(o,{}, {},false,'13.8.5'),fresh=P.artwork(o,{}, {},false,'13.8.6');assert.equal(old.font,'Arial-compatible Regular (Arimo)');assert.equal(fresh.font,'Arial Regular (lokal asli)');});
test('Current sizes are 28/21/13 pt while historical defaults remain unchanged',()=>{assert(Math.abs(P.DEFAULTS.nameHeight-28*25.4/72)<.0001);assert(Math.abs(P.DEFAULTS.nameNipHeight-21*25.4/72)<.0001);assert(Math.abs(P.DEFAULTS.nipHeight-13*25.4/72)<.0001);assert(Math.abs(P.DEFAULTS.shortSpacing-2.734)<.0001);assert.equal(P.V13_8_DEFAULTS.nameHeight,6.771);});
test('Swis721 substitute keeps native horizontal metrics until it actually needs fitting',()=>{const o={...order(),name:'PATRIAH, S.Pd.I',nip:'19891202 202421 2 023',model:models[1]},a=P.artwork(o,{}, {},false,'13.8.6');assert.equal(a.font,'Swis721 BT Regular (lokal asli)');assert(a.nameCompression>.99);const paths=a.shapes.filter(x=>x.type==='path');assert(paths.length>0);assert(Math.abs(paths[0].sx-paths[0].sy)<.00001);});
test('Reference border, NIP and divider strokes match measured CDR geometry',()=>{const bordered=P.artwork(order()),outer=bordered.shapes[0],inner=bordered.shapes[1];assert.equal(outer.line,.1);assert.equal(inner.line,.2);for(const i of [1,3,4,6,8,9]){const o={...order(),model:models[i],logo:'DEMO'},a=P.artwork(o,{}, {[P.logoKey(o)]:{omit:true}}),lines=a.shapes.filter(x=>x.type==='line');assert(lines.some(x=>x.line===(i===8?.5:.75)));}});
test('Reference logo boxes are smaller and remain inside the reserved logo column',()=>{for(const i of [2,3,4,7,8,9]){const o={...order(),model:models[i],logo:'DEMO'},a=P.artwork(o,{}, {[P.logoKey(o)]:fixtureLogo()}),image=a.shapes.find(x=>x.type==='image');assert(image.w<=(i===3?15.4:i===8?15:12.4)+.001);assert(image.h<=14.5+.001);assert(image.x+image.w<20);}});
test('Legacy v13.6 jobs retain the old font and geometry when redownloaded',()=>{const old=P.LEGACY_DEFAULTS,o={...order(),model:models[1]},a=P.artwork(o,old,{},false,'13.6.0');assert.equal(a.font,'DejaVu Sans Bold');assert.equal(a.shapes.find(x=>x.type==='line').line,.3);assert.equal(P.plan(Array.from({length:25},(_,i)=>order('L-'+i)),old,{},false,'13.6.0').grid.capacity,24);});
test('Saved v13.7 jobs retain Arimo Bold and v13.7 border geometry',()=>{const o={...order(),model:models[0]},a=P.artwork(o,P.V13_7_DEFAULTS,{},false,'13.7.0');assert.equal(a.font,'Arial-compatible Bold (Arimo)');assert.equal(a.shapes[0].line,.35);assert.equal(a.nameSpacing,0);});
test('Old saved print settings migrate to the v13.8 Corel reference defaults for new jobs',()=>{const oldSaved={...P.V13_7_DEFAULTS};delete oldSaved.designVersion;const migrated=P.currentSettings(oldSaved);assert.equal(migrated.layoutMode,'corel29');assert.equal(migrated.condense,1);assert.equal(migrated.shortSpacing,2.734);assert.equal(migrated.nameHeight,28*25.4/72);assert.equal(migrated.nameNipHeight,21*25.4/72);assert.equal(migrated.nipHeight,13*25.4/72);assert.equal(migrated.designVersion,'13.8.14');});
test('Missing logo and unsupported font glyph block production PDF',()=>{assert.throws(()=>P.createJob([{...order(),model:models[2]}]),/belum diunggah/);assert.throws(()=>P.artwork({...order(),name:'测试'}),/belum didukung/);});
test('Gemini prompt prioritizes newest chat name, capitalization exceptions and Model 1 default',()=>{const prompt=C.bulkPrompt(snapshot([]).settings);assert.match(prompt,/nama di Catatan Pesanan.*chat.*lebih baru/i);assert.match(prompt,/huruf kecil semua.*HURUF KAPITAL/i);assert.match(prompt,/jangan diubah/i);assert.match(prompt,/HANYA mengirim nama.*Model 1/i);assert.match(prompt,/Model 10 = POLOS/i);assert(prompt.includes('NP\tNama\tNIP\tModel\tPengait\tLogo\tResi\tSKU\tCatatan'));});
test('Optional SKU, leading zero identifiers and identical names survive import',()=>{const r=C.parseBulk('NP\tNama\tNIP\tModel\tPengait\tSKU\n0000123456789123456789\tADI\t00198912022024210023\t2\tM\tNEW\n0000123456789123456789\tADI\t00198912022024210023\t2\tM\tNEW',snapshot([]));assert.equal(r.rows.length,2);assert.equal(r.duplicateCount,1);assert.equal(r.rows[0].errors.length,0);assert.equal(r.rows[0].data.nip,'00198912022024210023');assert.equal(r.rows[0].data.mp,'0000123456789123456789');assert.equal(r.rows[0].data.sku,'NEW');});
test('Scientific NIP is rejected by import, order validation and print engine',()=>{for(const nip of ['1.98912E+17','1,98912e17','NIP. 1.98912e+17']){const o={...order(),nip};assert.throws(()=>C.validateIdentifiers(o),/notasi ilmiah/);assert.throws(()=>P.artwork(o),/notasi ilmiah/);const r=C.parseBulk('NP\tNama\tNIP\tModel\tPengait\n123\tADI\t'+nip+'\t2\tM',snapshot([]));assert(r.rows[0].errors.some(e=>e.includes('notasi ilmiah')));}});
test('Backend independently rejects scientific NIP',()=>{const b=backend(),o={...order(),nip:'1.98912E+17',revision:null};assert.throws(()=>b.mutate(upsert(o)),/notasi ilmiah/);});
test('Finish print is idempotent and clears reprint flag after successful print',()=>{const {o,j,s}=printing();o.isReject=true;s.snapshot.orders[0].isReject=true;P.finishJob(s,j.id,'Test');P.finishJob(s,j.id,'Test');assert.equal(s.pending.length,1);assert.equal(s.pending[0].operation.data.currentStep,2);assert.equal(s.pending[0].operation.data.isReject,false);assert.equal(s.pending[0].operation.data.printCount,1);});
test('Old PDF cannot complete a later print cycle',()=>{const {j,s}=printing();s.snapshot.orders[0].printCount=2;assert.throws(()=>P.finishJob(s,j.id,'Test'),/nomor cetakan/);assert.equal(s.pending.length,0);});
test('Changed printed name blocks completion',()=>{const {j,s}=printing();s.snapshot.orders[0].name='DIFFERENT';assert.throws(()=>P.finishJob(s,j.id,'Test'),/berubah/);});
test('Print status follows a rebased operation and its acknowledgment',()=>{const {o,j,s}=printing();P.finishJob(s,j.id,'Test');const old=s.pending[0].operation,replacement={...old,opId:C.uid()};NFPrint.relinkOperation(s,old.opId,replacement.opId);s.pending=[{operation:replacement,status:'queued'}];assert.match(P.jobStatus(j,s),/menunggu 1/);C.applyAcknowledgment(s,replacement,ack(replacement,{...o,...replacement.data}));assert.equal(P.jobStatus(j,s),'Cetak dikonfirmasi');});
test('Repeated rebases and exported print backups preserve operation linkage',()=>{const {o,j,s}=printing();P.finishJob(s,j.id,'Test');const old=s.pending[0].operation,a=C.uid(),b=C.uid();P.relinkOperation(s,old.opId,a);P.relinkOperation(s,a,b);const op={...old,opId:b};s.pending=[{operation:op,status:'queued'}];const saved={...j,moves:P.exportMoves(j,s)};assert.equal(saved.moves[0].activeOpId,b);C.applyAcknowledgment(s,op,ack(op,{...o,...op.data}));assert.equal(P.jobStatus(j,s),'Cetak dikonfirmasi');assert.equal(P.jobStatus(saved,{pending:[],operationReceipts:s.operationReceipts}),'Cetak dikonfirmasi');});
test('Discarded print move is clearly cancelled without a phantom pending item',()=>{const {j,s}=printing();P.finishJob(s,j.id,'Test');P.cancelOperations(s,s.pending.map(p=>p.operation.opId));s.pending=[];assert.equal(P.jobStatus(j,s),'Cetak dikonfirmasi · perpindahan dibatalkan');});
test('Print conflict resolution cannot overwrite a new cycle or move a later stage backwards',()=>{const {o,j,s}=printing();P.finishJob(s,j.id,'Test');const op=s.pending[0].operation;assert.throws(()=>P.rebaseData(s,op,{...o,printCount:2}),/nomor cetakan/);const d=P.rebaseData(s,op,{...o,currentStep:4,resi:'LATEST'});assert.equal(d.currentStep,4);assert.equal(d.resi,'LATEST');});
test('Production day uses original date before scheduling and new date afterwards',()=>{assert.equal(C.productionDay(order()),'2026-09-29');assert.equal(C.productionDay({...order(),productionDate:'2026-09-30'}),'2026-09-30');});
test('Pending reprint overlay appears today without changing original date or ID',()=>{const o=order(),s=state([o]);C.queueOperations(s,[{kind:'reprint',id:o.id,expectedRevision:o.revision,productionDate:'2026-09-30',reason:'Kotor',data:C.fields(o)}],'Test');const shown=C.overlay(s.snapshot,s.pending);assert.equal(shown.length,1);assert.equal(shown[0].id,o.id);assert.equal(shown[0].createdAt,o.createdAt);assert.equal(shown[0].printCount,2);assert.equal(shown[0].currentStep,1);assert.equal(C.productionDay(shown[0]),'2026-09-30');});
test('Schema upgrade appends metadata and preserves legacy 16-column revisions',()=>{const b=backend(),o=b.seed(),before=clone(b.active.data[1]),oldHash=b.ctx.nfDigest_(before);b.ctx.nfSnapshot_('operator');assert.equal(b.active.data[0][16],'Tanggal Produksi');assert.deepEqual(b.active.data[1],before);assert.equal(b.ctx.nfRevision_([...before,'']),oldHash);const res=b.mutate({...upsert(o),data:{...C.fields(o),name:'UPDATED'}});assert.equal(res.order.name,'UPDATED');});
test('Schema refuses to overwrite a custom Q header or existing Q contents',()=>{for(const customHeader of [true,false]){const b=backend();b.seed();b.active.insertColumnsAfter(16,1);if(customHeader)b.active.data[0][16]='CUSTOM';else b.active.data[1][16]='KEEP';assert.throws(()=>b.ctx.nfSnapshot_('operator'),/Kolom Q/);assert.equal(customHeader?b.active.data[0][16]:b.active.data[1][16],customHeader?'CUSTOM':'KEEP');}});
test('Active reprint keeps ID and original date, increments count once, schedules today',()=>{const b=backend(),o=b.seed(),op=b.reprint(o),result=b.mutate(op);assert.equal(result.order.id,o.id);assert.equal(result.order.createdAt,o.createdAt);assert.equal(result.order.printCount,2);assert.equal(result.order.currentStep,1);assert.equal(result.order.productionDate,'2026-09-30');assert.equal(result.order.isReject,true);assert.equal(result.order.rejectReason,'Kotor / bernoda');assert.equal(b.active.data.length,2);const retry=b.mutate(op);assert.equal(retry.order.printCount,2);assert.equal(b.active.data.length,2);});
test('A second request using the old revision cannot double-increment reprint',()=>{const b=backend(),o=b.seed();b.mutate(b.reprint(o));assert.throws(()=>b.mutate(b.reprint(o)),/Data pusat telah berubah/);assert.equal(b.ctx.nfSnapshot_('operator').orders[0].printCount,2);});
test('Reprint requires a reason and valid date and enforces maximum count',()=>{const b=backend(),o=b.seed();assert.throws(()=>b.mutate({...b.reprint(o),reason:''}),/Alasan/);assert.throws(()=>b.mutate({...b.reprint(o),productionDate:'2026-02-30'}),/Tanggal produksi/);const b2=backend(),o2=b2.seed({...order(),printCount:999});assert.throws(()=>b2.mutate(b2.reprint(o2)),/999/);});
test('Editing and advancing a reprint preserves its production date and original date',()=>{const b=backend(),o=b.seed(),r=b.mutate(b.reprint(o)).order;const result=b.mutate({...upsert(r),data:{...C.fields(r),name:'UPDATED',productionDate:'2027-01-01',currentStep:2,isReject:false}}).order;assert.equal(result.productionDate,'2026-09-30');assert.equal(result.createdAt,o.createdAt);assert.equal(result.printCount,2);});
test('Owner can reprint from archive without duplicating active or archived orders',()=>{const b=backend(),o=b.seedArchive();const op=b.reprint(o);assert.throws(()=>b.mutate(op,'operator'),/pemilik/);const r=b.mutate(op,'admin').order;assert.equal(r.id,o.id);assert.equal(r.createdAt,o.createdAt);assert.equal(r.printCount,2);assert.equal(r.currentStep,1);assert.equal(b.active.data.length,2);assert.equal(b.archives.data.length,1);assert.equal(b.mutate(op,'admin').order.printCount,2);});
test('Reprint acknowledgment removes source archive in the frontend',()=>{const o=order(),s=state([]);s.snapshot.archives=[{...o,archiveStatus:'Selesai Transaksi'}];const op={...upsert(o),kind:'reprint'};s.pending=[{operation:op,status:'queued'}];C.applyAcknowledgment(s,op,ack(op,{...o,currentStep:1,printCount:2,productionDate:'2026-09-30'}));assert.equal(s.snapshot.archives.length,0);assert.equal(s.snapshot.orders.length,1);});
test('Interrupted reprint resumes safely at every durable phase',()=>{for(const phase of [1,2,3]){const b=backend(),o=b.seed(),op=b.reprint(o);b.crashAfter(phase);assert.throws(()=>b.mutate(op),/TEST_INTERRUPTION/);const r=b.mutate(op);assert.equal(r.order.printCount,2);assert.equal(b.active.data.length,2);assert.equal(r.order.productionDate,'2026-09-30');}});
test('Interrupted archive reprint resumes safely without losing the order',()=>{for(const phase of [1,2,3,4]){const b=backend(),o=b.seedArchive(),op=b.reprint(o);b.crashAfter(phase);assert.throws(()=>b.mutate(op,'admin'),/TEST_INTERRUPTION/);const r=b.mutate(op,'admin');assert.equal(r.order.printCount,2);assert.equal(b.active.data.length,2);assert.equal(b.archives.data.length,1);}});
test('Pending journal reserves tracking number and blocks a different NP',()=>{const b=backend(),a={...upsert({...order('NT-A'),mp:'NP-A',resi:'TRACKING',revision:null})},other={...upsert({...order('NT-B'),mp:'NP-B',resi:'TRACKING',revision:null})};b.crashAfter(1);assert.throws(()=>b.batch([a]),/TEST_INTERRUPTION/);const rejected=b.batch([other]);assert.equal(rejected.results[0].ok,false);assert.equal(rejected.results[0].code,'IDENTITY_CONFLICT');assert.equal(b.batch([a]).results[0].ok,true);assert.equal(b.active.data.length,2);});
test('Recovery rechecks tracking identity even after an external Sheet edit',()=>{const b=backend(),a=upsert({...order('NT-A'),mp:'NP-A',resi:'TRACKING',revision:null});b.crashAfter(1);assert.throws(()=>b.batch([a]),/TEST_INTERRUPTION/);b.seed({...order('NT-B'),mp:'NP-B',resi:'TRACKING'});const result=b.batch([a]);assert.equal(result.results[0].ok,false);assert.equal(result.results[0].code,'IDENTITY_CONFLICT');assert.equal(b.active.data.length,2);});
test('25-item fast batch remains idempotent with the new column',()=>{const b=backend(),ops=Array.from({length:25},(_,i)=>upsert({...order('NT-'+i),mp:'NP-'+i,revision:null}));const res=b.batch(ops);assert.equal(res.results.filter(r=>r.ok).length,25);assert.equal(b.active.data.length,26);assert.equal(b.batch(ops).results.filter(r=>r.ok).length,25);assert.equal(b.active.data.length,26);});
test('Legacy 16-column PENDING operation recovers after upgrade',()=>{const b=backend(),o=b.seed(),op=upsert(o),before=clone(b.active.data[1]),after=clone(before);after[1]='LEGACY UPDATE';after[13]=new Date('2026-09-30T02:00:00Z');const plan={opId:op.opId,id:op.id,kind:'upsert',actor:'Test',time:'2026-09-30T02:00:00Z',before,after};b.tables.get('_NF_Operations').data.push([op.opId,b.ctx.nfDigest_(op),'PENDING',JSON.stringify(plan),'',new Date(),'Test']);const r=b.mutate(op);assert.equal(r.order.name,'LEGACY UPDATE');assert.equal(b.active.data[1].length,18);});
test('Nonadjacent batch edits preserve intervening rows and original dates',()=>{const b=backend(),rows=[b.seed(order('NT-1')),b.seed(order('NT-2')),b.seed(order('NT-3'))],middle=clone(b.active.data[2]);const ops=[rows[0],rows[2]].map(o=>({...upsert(o),data:{...C.fields(o),currentStep:7}}));assert.equal(b.batch(ops).results.filter(r=>r.ok).length,2);assert.deepEqual(b.active.data[2],middle);});


function appHarness(rows,role='operator'){
 const elements=new Map();
 function parse(html){for(const match of html.matchAll(/<(\w+)\b([^>]*\bid="([^"]+)"[^>]*)>/g)){const el=element(match[3]);const value=match[2].match(/\bvalue="([^"]*)"/);if(value)el.value=value[1];if(match[1]==='select'){const rest=html.slice(match.index+match[0].length);const first=rest.match(/<option(?:\s[^>]*)?>([^<]*)<\/option>/);if(first)el.value=first[1];}}}
 function element(id){if(elements.has(id))return elements.get(id);let html='';const e={id,value:'',textContent:'',disabled:false,open:false,className:'',dataset:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},querySelectorAll:()=>[],showModal(){this.open=true;},close(){this.open=false;},get innerHTML(){return html;},set innerHTML(v){html=v;parse(v);}};elements.set(id,e);return e;}
 parse(fs.readFileSync(root+'/index.html','utf8'));
 const document={getElementById:id=>elements.get(id)||null,documentElement:{style:{setProperty(){}}},body:{classList:{toggle(){}}},querySelectorAll:()=>[],hidden:false};
 const ctx=vm.createContext({console,NFCore:{...C},NFPrint:P,NFPrintUI:{init(){},cancel(){}},document,localStorage:{getItem:()=>null,setItem(){}},sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},navigator:{onLine:true},indexedDB:{open:()=>({})},setInterval:()=>0,setTimeout:()=>0,clearTimeout(){},confirm:()=>true,FormData:class{},URL,Blob,Date});
 ctx.window=ctx;ctx.addEventListener=()=>{};ctx.seed=clone(rows);ctx.seedRole=role;ctx.settings=snapshot([]).settings;
 vm.runInContext(fs.readFileSync(root+'/app.js','utf8'),ctx);
 ctx.originalSync=vm.runInContext('sync',ctx);ctx.originalEditState=vm.runInContext('editState',ctx);ctx.originalEditPrintState=vm.runInContext('editPrintState',ctx);
 vm.runInContext("S={snapshot:{orders:seed,archives:[],recycle:[],role:seedRole,settings,capabilities:{reprint:true,printCycle:true}},pending:[]};token='TEST';operator='TEST';render=()=>{};sync=()=>{};editState=async fn=>{fn(S);return S;};",ctx);
 return{ctx,e:id=>elements.get(id),run:code=>vm.runInContext(code,ctx),getState:()=>vm.runInContext('S',ctx)};
}
test('Actual reprint form enqueues once on double-submit and opens today filter',async()=>{const h=appHarness([order()]);h.run("reprintModal(['NT-TEST'])");assert(h.e('reprintForm'));const submit=()=>h.e('reprintForm').onsubmit({preventDefault(){}});await Promise.all([submit(),submit()]);const s=h.getState();assert.equal(s.pending.length,1);assert.equal(s.pending[0].operation.kind,'reprint');assert.equal(s.pending[0].operation.data.createdAt,order().createdAt);assert.equal(s.pending[0].operation.productionDate,h.run('today()'));assert.equal(h.e('dateFilter').value,h.run('today()'));assert.equal(h.run('page'),'active');});
test('Actual reprint form refuses changed data and pending orders',async()=>{const h=appHarness([order()]);h.run("reprintModal(['NT-TEST']);S.snapshot.orders[0].revision='changed'");await h.e('reprintForm').onsubmit({preventDefault(){}});assert.equal(h.getState().pending.length,0);assert.match(h.e('reprintError').textContent,/berubah/);const h2=appHarness([order()]);h2.run("S.pending=[{operation:{kind:'upsert',id:'NT-TEST',opId:'op_test123',data:NFCore.fields(S.snapshot.orders[0])},status:'queued'}];reprintModal(['NT-TEST'])");assert.equal(h2.e('reprintForm'),undefined);assert.match(h2.e('toast').textContent,/antrean simpan/);});
test('Actual archive reprint UI respects owner permission',()=>{const h=appHarness([]);h.ctx.archived={...order(),archiveStatus:'Selesai Transaksi'};h.run("S.snapshot.archives=[archived];reprintModal(['NT-TEST'])");assert.equal(h.e('reprintForm'),undefined);assert.match(h.e('toast').textContent,/pemilik/);const owner=appHarness([],'admin');owner.ctx.archived={...order(),archiveStatus:'Selesai Transaksi'};owner.run("S.snapshot.archives=[archived];reprintModal(['NT-TEST'])");assert(owner.e('reprintForm'));});
test('v13.8.2 print-cycle-only blocked upserts are safely requeued for the fixed backend',()=>{const h=appHarness([order()]);h.run("S.pending=[{operation:{kind:'upsert',id:'NT-TEST',opId:'op_test123',expectedRevision:'rev0',data:NFCore.fields(S.snapshot.orders[0])},status:'blocked',code:'PRINT_CYCLE_CHANGED',error:'old'}];repairPrintCycleBlocks(S)");const p=h.getState().pending[0];assert.equal(p.status,'queued');assert.equal(p.code,undefined);assert.equal(p.error,'');});

const fixtureLogo=(name='logo-demo.png')=>({data:'data:image/'+(name.endsWith('jpg')?'jpeg':'png')+';base64,'+fs.readFileSync(root+'/tests/fixtures/'+name).toString('base64'),width:name.includes('wide')?640:name.includes('lowres')?24:320,height:name.includes('wide')?240:name.includes('lowres')?24:320});
test('Print count is server-owned and cannot be reduced or raised through single or batch edits',()=>{for(const batch of [false,true]){for(const count of [1,3]){const b=backend(),o=b.mutate(b.reprint(b.seed())).order,op={...upsert(o),data:{...C.fields(o),printCount:count}};const saved=batch?b.batch([op]).results[0].data.order:b.mutate(op).order;assert.equal(saved.printCount,2);} }});
test('Server creates immutable cycles and ordinary edits adopt current server cycle metadata',()=>{for(const staleMode of ['missing','old']){const b=backend(),o=b.mutate(upsert({...order(),revision:null})).order;assert.match(o.printCycleId,/^PC-/);const updated=b.mutate({...upsert(o),data:{...C.fields(o),name:'ADI'}}).order;assert.equal(updated.printCycleId,o.printCycleId);const next=b.mutate(b.reprint(updated)).order;assert.notEqual(next.printCycleId,o.printCycleId);const printCycleId=staleMode==='missing'?'':o.printCycleId,saved=b.mutate({...upsert(next),data:{...C.fields(next),printCycleId,currentStep:2}}).order;assert.equal(saved.printCycleId,next.printCycleId);assert.equal(saved.printCount,next.printCount);}});
test('Immutable cycle rejects an old PDF even if Sheet print count was changed back',()=>{const b=backend(),o=b.seed({...order(),currentStep:1}),j=P.createJob([o]);j.downloadedAt=j.createdAt;b.mutate(b.reprint(o));b.active.data[1][9]=1;const live=b.ctx.nfSnapshot_('operator').orders[0];assert.throws(()=>P.finishJob({...state([live]),printJobs:[j]},j.id,'Test'),/nomor cetakan/);});
test('Backend checks print artwork signature independently of client receipts',()=>{const b=backend(),o=b.seed({...order(),currentStep:1}),j=P.createJob([o]),s={...state([o]),printJobs:[j]};j.downloadedAt=j.createdAt;P.finishJob(s,j.id,'Test');const print=s.pending[0].operation,changed=b.mutate({...upsert(o),data:{...C.fields(o),name:'NEW NAME'}}).order;assert.throws(()=>b.mutate({...print,expectedRevision:changed.revision}),e=>e.code==='PRINT_CYCLE_CHANGED');});
test('A dependent draft adopts only its confirmed creation cycle',()=>{const b=backend(),draft={...order(),revision:null},s=state([]);C.queueOperations(s,[upsert(draft)],'Test');const first=s.pending[0].operation,shown=C.overlay(s.snapshot,s.pending)[0];s.pending[0].attempted=true;C.queueOperations(s,[{...upsert(shown),data:{...C.fields(shown),name:'EDIT AFTER CREATE'}}],'Test');const result=b.mutate(first);C.applyAcknowledgment(s,first,result);assert.equal(s.pending[0].operation.data.printCycleId,result.order.printCycleId);assert.equal(b.mutate(s.pending[0].operation).order.name,'EDIT AFTER CREATE');});
test('Midnight form submission uses the new local production day',async()=>{const h=appHarness([order()]);h.run("today=()=> '2026-09-30';reprintModal(['NT-TEST']);today=()=> '2026-10-01'");await h.e('reprintForm').onsubmit({preventDefault(){}});assert.equal(h.getState().pending[0].operation.productionDate,'2026-10-01');assert.equal(h.e('dateFilter').value,'2026-10-01');});
test('Archive and restore preserve production day, original date and print cycle',()=>{const b=backend(),old=b.seed(),r=b.mutate(b.reprint(old)).order,ready=b.mutate({...upsert(r),data:{...C.fields(r),currentStep:7}}).order,a=b.mutate({kind:'archive',id:r.id,opId:C.uid(),expectedRevision:ready.revision}).archive;assert.equal(a.productionDate,r.productionDate);assert.equal(a.createdAt,old.createdAt);assert.equal(a.printCycleId,r.printCycleId);assert.equal(C.productionDay(a),'2026-09-30');const restored=b.mutate({kind:'restore',id:r.id,opId:C.uid(),expectedRevision:a.revision},'admin').order;assert.equal(restored.productionDate,r.productionDate);assert.equal(restored.printCycleId,r.printCycleId);});
test('Legacy v13.5 archive recovers production metadata from its matching recycle snapshot',()=>{const b=backend(),r=b.mutate(b.reprint(b.seed())).order,ready=b.mutate({...upsert(r),data:{...C.fields(r),currentStep:7}}).order;b.mutate({kind:'archive',id:r.id,opId:C.uid(),expectedRevision:ready.revision});b.archives.data[1]=b.archives.data[1].slice(0,14);const a=b.ctx.nfSnapshot_('operator').archives[0];assert.equal(a.productionDate,r.productionDate);assert.equal(a.printCycleId,r.printCycleId);});
test('New schema columns reject collisions in active R and archive O/P',()=>{for(const [name,index] of [['Antrean Produksi',17],['Arsip Produksi',14],['Arsip Produksi',15]]){const b=backend(),table=b.tables.get(name);table.data[0][index]='CUSTOM KEEP';assert.throws(()=>b.ctx.nfSnapshot_('operator'),e=>e.code==='SCHEMA_CONFLICT');assert.equal(table.data[0][index],'CUSTOM KEEP');}});
test('Restoring legacy print moves reconstructs receipts and protects a new cycle',()=>{const {o,j,s}=printing();P.finishJob(s,j.id,'Test');const original=s.pending[0].operation,newId=C.uid();P.relinkOperation(s,original.opId,newId);const op={...original,opId:newId};delete op.printJobId;delete op.printSignature;s.pending=[{operation:op,status:'blocked'}];const saved={...j,moves:P.exportMoves(j,s)},main=state([{...o,printCount:2,printCycleId:'PC-NEXT'}]),prints={};P.restoreBackup(main,prints,{pending:s.pending,print:{jobs:[saved]}},true);assert.equal(main.printReceipts[newId].jobId,j.id);assert.equal(main.pending[0].operation.opId,newId);assert.throws(()=>P.rebaseData(main,op,main.snapshot.orders[0]),/nomor cetakan/);});
test('Cycle guard still blocks backup rebase when all print receipts are missing',()=>{const {o,j,s}=printing();P.finishJob(s,j.id,'Test');const op=s.pending[0].operation;delete op.printJobId;delete op.printSignature;assert.throws(()=>P.rebaseData(state([o]),op,{...o,printCount:2}),/nomor cetakan/);});
test('Print-only backups restore links without adding operations to the save queue',()=>{const {o,j,s}=printing();P.finishJob(s,j.id,'Test');const op=s.pending[0].operation,main=state([o]),prints={};P.restoreBackup(main,prints,{format:'nametagflow-print-v1',jobs:[{...j,moves:P.exportMoves(j,s)}]},false);assert.equal(main.pending.length,0);assert.equal(main.printReceipts[op.opId].jobId,j.id);assert.match(P.jobStatus(prints.printJobs[0],main),/Periksa/);P.restoreBackup(main,prints,{pending:s.pending,print:{jobs:[j]}},true);assert.equal(main.pending.length,1);assert.match(P.jobStatus(prints.printJobs[0],main),/menunggu/);});
test('Restoring backup twice preserves operation IDs and later local acknowledgments',()=>{const {o,j,s}=printing();P.finishJob(s,j.id,'Test');const backup={pending:clone(s.pending),print:{jobs:[clone(j)],receipts:clone(s.printReceipts)}},main=state([o]),prints={};P.restoreBackup(main,prints,backup,true);P.restoreBackup(main,prints,backup,true);assert.equal(main.pending.length,1);const op=main.pending[0].operation;C.applyAcknowledgment(main,op,ack(op,{...o,...op.data}));P.restoreBackup(main,prints,backup,false);assert.equal(main.printReceipts[op.opId].confirmed,true);assert.equal(P.jobStatus(prints.printJobs[0],main),'Cetak dikonfirmasi');});
test('Logo keys distinguish spacing and separate unnamed logos by order',()=>{assert.notEqual(P.logoKey({...order(),logo:'AB'}),P.logoKey({...order(),logo:'A B'}));assert.notEqual(P.logoKey(order('NT-A')),P.logoKey(order('NT-B')));});
test('PNG and JPEG logos retain aspect ratio, fit the tag and embed in PDFs',async()=>{for(const file of ['logo-demo.png','logo-wide.jpg']){const logo=fixtureLogo(file);assert.equal(P.logoImageInfo(logo).width,logo.width);const rows=[2,3,4,7,8,9].map(i=>({...order('NT-'+i),model:models[i],logo:'DEMO'})),assets={[P.logoKey(rows[0])]:logo},job=P.createJob(rows,{},assets);for(const o of rows){const image=P.artwork(o,{},assets).shapes.find(s=>s.type==='image');assert(Math.abs(image.w/image.h-logo.width/logo.height)<.0001);assert(image.x>=0&&image.x+image.w<=80.4);assert(image.y>=0&&image.y+image.h<=20.4);}const bytes=await P.pdf(job),doc=await PDFLib.PDFDocument.load(bytes);assert.equal(doc.getPageCount(),1);assert(!Buffer.from(bytes).includes(Buffer.from('/ObjStm')));}});
test('Low-resolution and falsified logo dimensions block production',()=>{const o={...order(),model:models[2],logo:'DEMO'};assert.throws(()=>P.createJob([o],{}, {[P.logoKey(o)]:fixtureLogo('logo-lowres.png')}),/150 dpi/);assert.throws(()=>P.createJob([o],{}, {[P.logoKey(o)]:{...fixtureLogo(),width:999}}),/Ukuran/);assert.throws(()=>P.logoImageInfo({data:'data:image/png;base64,ZmFrZQ==',width:300,height:300}),/Ukuran/);});
test('Transparent or invisible dark upload is rejected; white/color pixels accepted',()=>{assert.throws(()=>P.checkLogoPixels(new Uint8ClampedArray([255,255,255,0])),/transparan/);assert.throws(()=>P.checkLogoPixels(new Uint8ClampedArray([0,0,0,255])),/gelap/);P.checkLogoPixels(new Uint8ClampedArray([255,255,255,255]));});
test('Legacy jobs keep their embedded logo despite the new cache keys',async()=>{const o={...order(),model:models[2],logo:'A B'},legacy={id:'CT-LEGACY',engine:'13.5.0',createdAt:order().createdAt,orders:[o],settings:P.settings(),assets:{AB:fixtureLogo()}};assert(P.jobAssets(legacy)[P.logoKey(o)]);assert.equal((await PDFLib.PDFDocument.load(await P.pdf(legacy))).getPageCount(),1);});

function fakeDatabase(records,failSecondPut=false){return{transaction(){let remaining=0,aborted=false,puts=0;const staged=new Map([...records].map(([k,v])=>[k,clone(v)])),tx={abort(){aborted=true;queueMicrotask(()=>tx.onabort?.());},objectStore(){return{get(key){remaining++;const req={};queueMicrotask(()=>{req.result=clone(staged.get(key));req.onsuccess?.();if(--remaining===0&&!aborted)queueMicrotask(()=>{if(aborted)return;records.clear();for(const [k,v] of staged)records.set(k,clone(v));tx.oncomplete?.();});});return req;},put(value,key){if(failSecondPut&&++puts===2)throw new Error('TEST_QUOTA');staged.set(key,clone(value));}};}};return tx;}};}
test('Actual app restores main queue and print records in one transaction, including rollback',async()=>{for(const fail of [false,true]){const {o,j,s}=printing();P.finishJob(s,j.id,'Test');const h=appHarness([o]),ep=h.run('endpoint'),records=new Map([[ep,state([o])],[ep+'::print',{}]]);h.ctx.database=fakeDatabase(records,fail);h.ctx.backup={endpoint:ep,pending:s.pending,print:{jobs:[j],receipts:s.printReceipts}};h.run('db=database');if(fail){await assert.rejects(h.run('restoreWorkspace(backup,true)'),/TEST_QUOTA/);assert.equal(records.get(ep).pending.length,0);assert.equal(records.get(ep+'::print').printJobs,undefined);}else{await h.run('restoreWorkspace(backup,true)');assert.equal(records.get(ep).pending.length,1);assert.equal(records.get(ep+'::print').printJobs.length,1);assert.equal(records.get(ep).printReceipts[s.pending[0].operation.opId].jobId,j.id);}}});
function printUIHarness(rows,assets,localFonts=global.NFLocalFonts){const elements=new Map(),uploads=[],omits=[];let modalHTML='',saved=null;const s={...state(rows),printAssets:clone(assets)};s.snapshot.capabilities={printCycle:true};function element(id){if(!elements.has(id))elements.set(id,{id,value:'',checked:false,disabled:false,classList:{add(){}},dataset:{},innerHTML:'',textContent:''});return elements.get(id);}const body=element('modalBody');body.querySelectorAll=selector=>selector==='[data-logo-upload]'?uploads:selector==='[data-logo-omit]'?omits:[];body.querySelector=selector=>omits[Number(selector.match(/"(\d+)"/)[1])];const ctx=vm.createContext({NFCore:C,NFPrint:{...P,pdf:async()=>new Uint8Array([1])},NFLocalFonts:localFonts,document:{getElementById:id=>elements.get(id)||null,createElement:()=>({click(){},remove(){}}),body:{append(){}}},URL:{createObjectURL:()=>'',revokeObjectURL(){}},Blob,setTimeout:()=>0,confirm:()=>true,Date,Map,Set,console});const adapter={state:()=>s,context:()=> 'test',endpoint:()=> 'test',operator:()=> 'test',toast(){},dirty(){},isDirty:()=>false,save:async fn=>{fn(s);saved=s.printJobs?.[0];},modal(title,html){modalHTML=html;for(const m of html.matchAll(/\bid="([^"]+)"([^>]*)/g)){const el=element(m[1]),value=m[2].match(/value="([^"]+)"/);if(value)el.value=value[1];el.checked=/\bchecked\b/.test(m[2]);}element('modal');for(const m of html.matchAll(/data-logo-upload="(\d+)"/g))uploads[+m[1]]={dataset:{logoUpload:m[1]},files:[]};for(const m of html.matchAll(/data-logo-omit="(\d+)"/g))omits[+m[1]]={dataset:{logoOmit:m[1]},checked:false};}};vm.runInContext(fs.readFileSync(root+'/print-ui.js','utf8'),ctx);element('printSelected');element('printJobsBtn');ctx.NFPrintUI.init(adapter);return{ctx,s,adapter,uploads,omits,e:element,open:()=>ctx.NFPrintUI.openBuilder(rows),saved:()=>saved,html:()=>modalHTML};}
test('Actual print builder does not carry an omitted logo into a new sheet',async()=>{const o={...order(),model:models[2],logo:'DEMO'},h=printUIHarness([o],{[P.logoKey(o)]:{omit:true}});await h.open();h.e('pcReviewed').checked=true;await h.e('pcExport').onclick();assert.match(h.e('pcError').textContent,/belum diunggah/);assert.equal(h.saved(),null);});
test('Failed logo replacement clears old asset and keeps export disabled',async()=>{const o={...order(),model:models[2],logo:'DEMO'},h=printUIHarness([o],{[P.logoKey(o)]:fixtureLogo()});await h.open();h.uploads[0].files=[{type:'image/gif',size:123}];await h.uploads[0].onchange();assert.equal(h.e('pcExport').disabled,true);assert.match(h.e('pcError').textContent,/PNG atau JPG/);h.e('pcReviewed').checked=true;await h.e('pcExport').onclick();assert.equal(h.saved(),null);});

test('Recovery refuses a legacy journal plan that rolls back print count',()=>{const b=backend(),o=b.seed({...order(),printCount:2}),op=upsert(o),before=clone(b.active.data[1]),after=clone(before);after[9]=1;const plan={opId:op.opId,id:op.id,kind:'upsert',actor:'Test',time:order().createdAt,before,after};b.tables.get('_NF_Operations').data.push([op.opId,b.ctx.nfDigest_(op),'PENDING',JSON.stringify(plan),'',new Date(),'Test']);assert.throws(()=>b.mutate(op),e=>e.code==='PRINT_CYCLE_CHANGED');assert.equal(b.active.data[1][9],2);});


test('Native history restores cached fonts before rendering after reload',async()=>{const o={...order(),currentStep:1},job=P.createJob([o]);let ready=false,restores=0;const fonts={...global.NFLocalFonts,status:()=>({ready,arial:ready,swis:ready}),restore:async()=>{restores++;ready=true;},detect:async()=>{throw new Error('should restore without detection');}};const h=printUIHarness([o],{},fonts);h.s.printJobs=[job];await h.ctx.NFPrintUI.showJob(job.id);assert.equal(restores,1);assert.match(h.html(),/print-saved-preview/);assert.match(h.e('pcSheet').innerHTML,/<svg/);});
test('Native history asks for missing fonts before drawing a substitute',async()=>{const o={...order(),currentStep:1},job=P.createJob([o]);const fonts={...global.NFLocalFonts,status:()=>({ready:false,arial:false,swis:false}),restore:async()=>{},detect:async()=>{}};const h=printUIHarness([o],{},fonts);h.s.printJobs=[job];await h.ctx.NFPrintUI.showJob(job.id);assert.match(h.html(),/pcArialFile/);assert.equal(h.e('pcFontContinue').disabled,true);assert.doesNotMatch(h.html(),/print-saved-preview/);});
test('Legacy history remains accessible without connecting new local fonts',async()=>{const o={...order(),currentStep:1},job={...P.createJob([o]),engine:'13.8.5',settings:P.settings({},'13.8.5')};const fonts={...global.NFLocalFonts,restore:async()=>{throw new Error('legacy must not restore');}};const h=printUIHarness([o],{},fonts);h.s.printJobs=[job];await h.ctx.NFPrintUI.showJob(job.id);assert.match(h.html(),/print-saved-preview/);assert.match(h.e('pcSheet').innerHTML,/<svg/);});
test('Demo loads the real font bridge before print modules and uses current settings',()=>{const html=fs.readFileSync(root+'/COBA-CETAK.html','utf8'),scripts=[...html.matchAll(/<script src="([^"?]+)(?:\?[^"\s]+)?"/g)].map(m=>m[1]);assert(scripts.indexOf('local-font.js')>=0);assert(scripts.indexOf('local-font.js')<scripts.indexOf('print-engine.js'));assert(scripts.indexOf('local-font.js')<scripts.indexOf('print-ui.js'));for(const file of scripts)assert(fs.existsSync(root+'/'+file),file);assert(html.includes('printSettings:NFPrint.currentSettings()'));assert(!html.includes('Font awal menggunakan DejaVu'));});

test('Builder displays actual Arial and Swis font names above the sheet',async()=>{const rows=[{...order('A'),currentStep:1},{...order('B'),model:models[1],currentStep:1}],h=printUIHarness(rows,{});await h.open();assert.match(h.e('pcFontsUsed').innerHTML,/Arial Bold \(lokal asli\)/);assert.match(h.e('pcFontsUsed').innerHTML,/Swis721 BT Bold \(lokal asli\)/);assert.match(h.html(),/Kelola font/);});
test('Saved sheet displays its actual font and old sheets retain substitute labels',async()=>{const o={...order(),currentStep:1},job=P.createJob([o]),h=printUIHarness([o],{});h.s.printJobs=[job];await h.ctx.NFPrintUI.showJob(job.id);assert.match(h.html(),/Font pada lembar ini/);assert.match(h.html(),/Arial Bold \(lokal asli\)/);h.s.printJobs=[{...job,engine:'13.8.5',settings:P.settings({},'13.8.5')}];await h.ctx.NFPrintUI.showJob(job.id);assert.match(h.html(),/Arimo/);assert.doesNotMatch(h.html(),/Arial Bold \(lokal asli\)/);});
test('Font manager opens when fonts are ready and preserves draft settings and logo choice',async()=>{const o={...order(),model:models[2],logo:'DEMO',currentStep:1},h=printUIHarness([o],{},{...global.NFLocalFonts,restore:async()=>{}});await h.open();h.e('pc_tagWidth').value=81;h.omits[0].checked=true;h.omits[0].onchange();h.e('pcReviewed').checked=true;await h.e('pcManageFonts').onclick();assert.match(h.html(),/pcArialFile/);assert.match(h.html(),/pcFontBack/);await h.e('pcFontContinue').onclick();assert.equal(Number(h.e('pc_tagWidth').value),81);assert.match(h.html(),/data-logo-omit="0" checked/);assert.equal(h.e('pcReviewed').checked,false);h.e('pcReviewed').checked=true;await h.e('pcExport').onclick();assert(h.saved());assert.equal(h.saved().settings.tagWidth,81);assert.equal(h.saved().assets[P.logoKey(o)].omit,true);});
test('Returning from font manager preserves a failed-logo block',async()=>{const o={...order(),model:models[2],logo:'DEMO'},h=printUIHarness([o],{[P.logoKey(o)]:fixtureLogo()},{...global.NFLocalFonts,restore:async()=>{}});await h.open();h.uploads[0].files=[{type:'image/gif',size:123}];await h.uploads[0].onchange();await h.e('pcManageFonts').onclick();await h.e('pcFontBack').onclick();assert.equal(h.e('pcExport').disabled,true);assert.match(h.e('pcError').textContent,/PNG atau JPG/);});
test('Font manager is accessible from empty history without selecting an order',async()=>{const h=printUIHarness([],{}, {...global.NFLocalFonts,restore:async()=>{}});h.ctx.NFPrintUI.history();assert.match(h.html(),/Kelola font/);await h.e('pcManageFonts').onclick();assert.match(h.html(),/pcArialFile/);await h.e('pcFontBack').onclick();assert.match(h.html(),/Belum ada lembar cetak/);});
test('All ten new-job models use the required original font for each line',()=>{for(const model of models){const o={...order(),model},m=C.modelLayout(model),a=P.artwork(o,P.DEFAULTS,{},true);assert.equal(a.font,m.nip?'Swis721 BT Bold (lokal asli)':'Arial Bold (lokal asli)',model);assert.equal(a.nipFont,m.nip?'Swis721 BT Bold (lokal asli)':'',model);}});

test('Bold names preserve 28 pt height and only compress above either width cap',()=>{for(const model of [models[0],models[2],models[5],models[7]]){const o={...order(),model},assets={[P.logoKey(o)]:{omit:true}},cap=C.modelLayout(model).logo?55:73,short=P.artwork({...o,name:'BRIAN P.P'}, {},assets),long=P.artwork({...o,name:'MUHAMMAD NAMA PANJANG SEKALI'}, {},assets);assert.equal(short.font,'Arial Bold (lokal asli)');assert(short.nameWidth<cap);assert.equal(short.nameCompression,1);assert(Math.abs(long.nameWidth-cap)<1e-8);assert(long.nameCompression<1);for(const a of [short,long]){assert(Math.abs(a.nameSizePt-28)<1e-10);const glyph=a.shapes.find(x=>x.type==='path');assert(Math.abs(glyph.sy*72/25.4-28)<1e-8);}}});
test('Old saved settings migrate to 28 pt only for new jobs; old records stay Regular',()=>{const old={...P.V13_8_6_DEFAULTS,tagWidth:81},before=JSON.stringify(old),fresh=P.currentSettings(old);assert.equal(fresh.nameHeight,28*25.4/72);assert.equal(fresh.tagWidth,81);assert.equal(JSON.stringify(old),before);for(const engine of ['13.8.6','13.8.7','13.8.8','13.8.9']){assert.equal(P.artwork(order(),{}, {},false,engine).font,'Arial Regular (lokal asli)');assert.equal(P.settings({},engine).nameHeight,9.8414);}});
test('Builder displays 28 pt and saves the correct millimetre geometry',async()=>{const h=printUIHarness([{...order(),currentStep:1}],{});await h.open();assert.equal(Number(h.e('pc_nameHeight').value),28);assert.match(h.e('pcFontsUsed').innerHTML,/Arial Bold.*28 pt/);h.e('pcReviewed').checked=true;await h.e('pcExport').onclick();assert(h.saved());assert(Math.abs(h.saved().settings.nameHeight*72/25.4-28)<1e-8);});
test('Archived font setup requests Regular while new setup requests Bold',async()=>{const fonts={...global.NFLocalFonts,status:()=>({ready:false}),restore:async()=>{},detect:async()=>{}},o={...order(),currentStep:1},h=printUIHarness([o],{},fonts);await h.open();assert.match(h.html(),/Arial Bold/);assert.match(h.html(),/arialbd\.ttf/);assert.doesNotMatch(h.html(),/Jangan pilih Bold/);h.s.printJobs=[{...P.createJob([o]),id:'OLD',engine:'13.8.9',settings:P.V13_8_6_DEFAULTS}];await h.ctx.NFPrintUI.showJob('OLD');assert.match(h.html(),/Arial Regular/);assert.doesNotMatch(h.html(),/Arial Bold/);});

// CDR width calibration and backward-compatibility regressions.
test('New sheets use 70 percent name width while preserving the real 28 pt height',()=>{
 for(const model of [models[0],models[2],models[5],models[7]])for(const name of ['JAMARUDIN.','UMURIDAH','AMING','A M I N G']){
  const o={...order(),name,model},assets={[P.logoKey(o)]:{omit:true}},old=P.artwork(o,{},assets,false,'13.8.10'),now=P.artwork(o,{},assets);
  assert.equal(now.nameWidthScale,.7);assert.equal(now.nameSizePt,28);
  if(old.nameCompression===1){assert(Math.abs(now.nameWidth/old.nameWidth-.7)<1e-9);assert(Math.abs(now.nameSpacing-old.nameSpacing*.7)<1e-9);}
  assert.equal(now.shapes.find(x=>x.type==='path').sy,old.shapes.find(x=>x.type==='path').sy);
 }
});
test('Long names still respect both physical width caps after Corel calibration',()=>{
 for(const model of [models[0],models[2],models[5],models[7]]){
  const o={...order(),model,name:'MUHAMMAD NAMA YANG SANGAT PANJANG SEKALI UNTUK NAMETAG'},cap=C.modelLayout(model).logo?55:73,a=P.artwork(o,{}, {[P.logoKey(o)]:{omit:true}});
  assert(Math.abs(a.nameWidth-cap)<1e-8);assert.equal(a.nameSizePt,28);assert(a.nameCompression<1);
 }
});
test('Archived v13.8.11 NIP models keep all original artwork and line geometry',()=>{
 for(const model of models.filter(x=>C.modelLayout(x).nip)){
  const o={...order(),model},assets={[P.logoKey(o)]:{omit:true}},old=P.artwork(o,{},assets,false,'13.8.10'),now=P.artwork(o,{},assets,false,'13.8.11');
  assert.deepEqual(now.shapes,old.shapes);assert.equal(now.nameWidth,old.nameWidth);assert.equal(now.nameWidthScale,1);
 }
});
test('Old preferences migrate once; a chosen new width survives later opening',()=>{
 const old=P.settings({tagWidth:81},'13.8.10'),before=JSON.stringify(old),fresh=P.currentSettings(old);
 assert.equal(old.nameWidthScale,1);assert.equal(fresh.nameWidthScale,.7);assert.equal(fresh.tagWidth,81);assert.equal(JSON.stringify(old),before);
 assert.equal(P.currentSettings({...fresh,nameWidthScale:.65}).nameWidthScale,.65);
 assert.throws(()=>P.settings({nameWidthScale:.39}),/40–100/);assert.throws(()=>P.settings({nameWidthScale:1.01}),/40–100/);
});
test('Width percentage is visible, saved and restored after opening the font manager',async()=>{
 const h=printUIHarness([{...order(),currentStep:1}],{}, {...global.NFLocalFonts,restore:async()=>{}});await h.open();
 assert.equal(Number(h.e('pc_nameWidthScale').value),70);assert.match(h.e('pcFontsUsed').innerHTML,/lebar 70%/);
 h.e('pc_nameWidthScale').value=65;await h.e('pcManageFonts').onclick();await h.e('pcFontContinue').onclick();
 assert.equal(Number(h.e('pc_nameWidthScale').value),65);h.e('pcReviewed').checked=true;await h.e('pcExport').onclick();
 assert.equal(h.saved().settings.nameWidthScale,.65);assert.equal(h.saved().engine,'13.8.14');
});
test('Historical artwork matches saved v13.8.10 reference hashes for every supported profile',()=>{
 const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/legacy-geometry-v13.8.10.json'),'utf8'));
 for(const row of fixture){const o={...order(),name:row.name,model:models[row.model-1]},a=P.artwork(o,{}, {[P.logoKey(o)]:{omit:true}},false,row.engine);
  const digest=crypto.createHash('sha256').update(JSON.stringify({shapes:a.shapes,font:a.font,nipFont:a.nipFont,nameWidth:a.nameWidth,nameSpacing:a.nameSpacing})).digest('hex');
  assert.equal(digest,row.sha256,row.engine+' model '+row.model);
 }
});


test('New NIP models use Swiss Bold with separate 70/79 percent widths and fixed heights',()=>{
 for(const model of models.filter(x=>C.modelLayout(x).nip)){
  const o={...order(),name:'PATRIAH, S.Pd.I',model},assets={[P.logoKey(o)]:{omit:true}},a=P.artwork(o,{},assets);
  assert.equal(a.font,'Swis721 BT Bold (lokal asli)');assert.equal(a.nipFont,a.font);assert.equal(a.nameWidthScale,.7);assert.equal(a.nipWidthScale,.79);assert(Math.abs(a.nameSizePt-21)<1e-10);
  const before=P.artwork(o,{},assets,false,'13.8.11');assert.equal(before.font,'Swis721 BT Regular (lokal asli)');
  assert.deepEqual(a.shapes.filter(x=>x.type==='rect'),before.shapes.filter(x=>x.type==='rect'));
 }
});
test('Upgrading v13.8.11 retains calibrated Arial preferences and non-NIP typography',()=>{
 const old=P.settings({nameWidthScale:.65,nameHeight:9,condense:.9},'13.8.11'),fresh=P.currentSettings(old);
 assert.equal(fresh.nameWidthScale,.65);assert.equal(fresh.nameHeight,9);assert.equal(fresh.condense,.9);assert.equal(fresh.nameNipWidthScale,.7);assert.equal(fresh.nipWidthScale,.79);
 for(const model of models.filter(x=>!C.modelLayout(x).nip)){
  const o={...order(),model,name:'ISABELLA PUTRI R.'},assets={[P.logoKey(o)]:{omit:true}};
  const paths=a=>a.shapes.filter(x=>x.type==='path').map(({d,sx,sy})=>({d,sx,sy}));assert.deepEqual(paths(P.artwork(o,old,assets,false,'13.8.11')),paths(P.artwork(o,fresh,assets)));
 }
});
test('NIP width controls display percentages and preserve values through font management and export',async()=>{
 const h=printUIHarness([{...order(),model:models[1],currentStep:1}],{}, {...global.NFLocalFonts,restore:async()=>{}});await h.open();
 assert.equal(Number(h.e('pc_nameNipWidthScale').value),70);assert.equal(Number(h.e('pc_nipWidthScale').value),79);assert.match(h.e('pcFontsUsed').innerHTML,/Swis721 BT Bold/);
 h.e('pc_nameNipWidthScale').value=68;h.e('pc_nipWidthScale').value=78;
 await h.e('pcManageFonts').onclick();assert.match(h.html(),/Swis721 BT Bold/);await h.e('pcFontContinue').onclick();
 assert.equal(Number(h.e('pc_nameNipWidthScale').value),68);assert.equal(Number(h.e('pc_nipWidthScale').value),78);
 h.e('pcReviewed').checked=true;await h.e('pcExport').onclick();assert.equal(h.saved().settings.nameNipWidthScale,.68);assert.equal(h.saved().settings.nipWidthScale,.78);
});
test('100 changes commit in three durable phases and retries do not duplicate data',()=>{
 const b=backend(),ops=Array.from({length:100},(_,i)=>upsert({...order('NT-'+i),mp:'NP-'+i,revision:null}));
 const result=b.batch(ops);assert.equal(result.results.filter(r=>r.ok).length,100);assert.equal(b.stats().flushes,3);assert.equal(b.active.data.length,101);
 assert.equal(b.batch(ops).results.filter(r=>r.ok).length,100);assert.equal(b.stats().flushes,3);assert.equal(b.active.data.length,101);
 assert.equal(b.ctx.nfSnapshot_('operator').capabilities.mutateBatch,100);
 assert.throws(()=>b.batch([...ops,{...upsert({...order('NT-101'),revision:null})}]),/100/);
});
test('A lost batch response recovers 25 or 100 operations together at every durable phase',()=>{
 for(const count of [25,100])for(const phase of [1,2,3]){
  const b=backend(),ops=Array.from({length:count},(_,i)=>upsert({...order('NT-'+i),mp:'NP-'+i,revision:null}));
  b.crashAfter(phase);assert.throws(()=>b.batch(ops),/TEST_INTERRUPTION/);const before=b.stats().flushes,result=b.batch(ops);
  assert.equal(result.results.filter(r=>r.ok).length,count);assert.equal(b.active.data.length,count+1);
  assert(b.stats().flushes-before<=2,'Recovery must remain grouped');assert.equal(b.tables.get('_NF_Operations').data.length,count+1);
  assert(b.tables.get('_NF_Operations').data.slice(1).every(r=>r[2]==='DONE'));
 }
});
test('Grouped retry preserves manual edits and only confirms rows actually committed',()=>{
 const b=backend(),a=b.seed(order('NT-A')),c=b.seed(order('NT-C')),ops=[a,c].map(o=>({...upsert(o),data:{...C.fields(o),currentStep:7}}));
 b.crashAfter(1);assert.throws(()=>b.batch(ops),/TEST_INTERRUPTION/);b.active.data[1][1]='MANUAL EDIT';
 const result=b.batch(ops);assert.equal(result.results.find(r=>r.id==='NT-A').ok,false);assert.equal(result.results.find(r=>r.id==='NT-C').ok,true);
 assert.equal(b.active.data[1][1],'MANUAL EDIT');assert.equal(b.active.data[1][10],6);assert.equal(b.active.data[2][10],7);
});
test('Grouped retry rejects changed payloads and invalid legacy print-cycle plans',()=>{
 const b=backend(),o=b.seed(),op=upsert(o);b.crashAfter(1);assert.throws(()=>b.batch([op]),/TEST_INTERRUPTION/);
 const changed={...op,data:{...op.data,name:'CHANGED'}};assert.equal(b.batch([changed]).results[0].code,'IDEMPOTENCY_CONFLICT');
 const row=b.tables.get('_NF_Operations').data[1],plan=JSON.parse(row[3]);plan.after[9]=2;row[3]=JSON.stringify(plan);
 assert.equal(b.batch([op]).results[0].code,'PRINT_CYCLE_CHANGED');assert.equal(b.active.data[1][9],1);
});
test('Mixed pending/new batches preserve journal rows and keep new identities checked',()=>{
 const b=backend(),a=upsert({...order('NT-A'),mp:'A',revision:null}),c=upsert({...order('NT-C'),mp:'C',revision:null});
 b.crashAfter(1);assert.throws(()=>b.batch([a]),/TEST_INTERRUPTION/);
 const res=b.batch([a,c]);assert.equal(res.results.filter(r=>r.ok).length,2);assert.equal(b.active.data.length,3);assert.equal(b.tables.get('_NF_Operations').data.length,3);
 assert.equal(b.batch([a,c]).results.filter(r=>r.ok).length,2);assert.equal(b.active.data.length,3);
});
test('Request transport errors retain uncertain-save semantics and a retryable code',async()=>{
 const saved=global.fetch;global.fetch=async()=>{throw new TypeError('Failed to fetch');};
 try{await assert.rejects(C.request(C.ENDPOINT,'TEST','snapshot'),e=>e.code==='NETWORK'&&C.retryable(e)&&/Status simpan belum pasti/.test(e.message));}finally{global.fetch=saved;}
});


test('Actual sync negotiates 25/100 batches and retains identical operation IDs after a lost response',async()=>{
 for(const capacity of [25,100]){
  const b=backend(),rows=Array.from({length:60},(_,i)=>b.seed({...order('SYNC-'+i),mp:'MP-'+i})),h=appHarness(rows),sizes=[],sentIds=[];let lose=true;
  h.ctx.NFCore.request=async(_ep,_tk,action,payload)=>{
   assert.equal(action,'mutateBatch');sizes.push(payload.operations.length);sentIds.push(payload.operations.map(x=>x.operation.opId));
   const result=b.ctx.nfMutateBatch_(payload.operations,'operator');if(lose){lose=false;throw Object.assign(new Error('lost response'),{code:'NETWORK'});}return result;
  };
  h.ctx.capacity=capacity;
  h.run("db={};sync=originalSync;S.lastSync=new Date().toISOString();S.snapshot.capabilities={writeBatch:true,mutateBatch:capacity};storage=async fn=>{if(fn)fn(S);return S;};NFCore.queueOperations(S,S.snapshot.orders.map(o=>({kind:'upsert',id:o.id,expectedRevision:o.revision,data:{...NFCore.fields(o),currentStep:7}})),'TEST');");
  await h.run('sync()');assert.equal(h.getState().pending.length,60);assert(h.getState().pending.slice(0,Math.min(60,capacity)).every(p=>p.attempted&&p.code==='NETWORK'));
  await h.run('sync()');assert.equal(h.getState().pending.length,0);assert.deepEqual(sentIds[0],sentIds[1]);
  assert(sizes.every(n=>n<=capacity));assert.equal(sizes.length,capacity===25?4:2);assert.equal(b.active.data.length,61);assert(b.active.data.slice(1).every(r=>r[10]===7));
 }
});

test('Quadratic font curves preserve their exact locus in PDF cubic form',()=>{
 const curves=[[0,0,.5,-1,1,0],[-.2,.3,-.8,-.9,.6,-.1],[1,2,1,2,1,2]];
 for(const [x,y,qx,qy,ex,ey] of curves){
  const converted=P.pdfFontPath(`M${x} ${y}Q${qx} ${qy} ${ex} ${ey}Z`);
  assert(!converted.includes('Q'));
  const c=converted.split('C')[1].replace('Z','').split(' ').map(Number);
  for(const t of [0,.1,.25,.5,.75,.9,1])for(const axis of [0,1]){
   const start=[x,y][axis],q=[qx,qy][axis],end=[ex,ey][axis],u=1-t;
   const quadratic=u*u*start+2*u*t*q+t*t*end,cubic=u*u*u*start+3*u*u*t*c[axis]+3*u*t*t*c[axis+2]+t*t*t*c[axis+4];
   assert(Math.abs(quadratic-cubic)<1e-12);
  }
 }
});
test('Font conversion tracks closed contours, lines, cubics and scientific notation',()=>{
 const d='M1 2L3 4Q4 6 5 4ZQ2 4 3 2M-1e-3 .4C0 0 1 1 2 2Q3 4 4 2Z',s=P.pdfFontPath(d);
 assert(!s.includes('Q'));assert.match(s,/M-0\.001/);assert(s.includes('C0 0 1 1 2 2'));
 const afterClose=s.split('ZC')[1].split('M')[0].split(' ').map(Number);
 assert(Math.abs(afterClose[0]-5/3)<1e-12);assert(Math.abs(afterClose[1]-10/3)<1e-12);
 const simple='M0 0C1 2 3 4 5 6Z';assert.equal(P.pdfFontPath(simple),simple);
 assert.equal(P.pdfFontPath('M0 0H3V6Q6 9 9 6z'),'M0 0H3V6C5 8 7 8 9 6Z');
 assert.equal(P.pdfFontPath('M0 0 3 6Q6 9 9 6 12 9 15 6Z'),'M0 0L3 6C5 8 7 8 9 6C11 8 13 8 15 6Z');
 assert.throws(()=>P.pdfFontPath('M0 0Q1 2Z'),/Kurva font tidak valid/);
 assert.throws(()=>P.pdfFontPath('M0 0q1 2 3 4Z'),/Kurva font tidak didukung/);
});
test('v13.8.12 settings and non-logo models keep identical geometry after the update',()=>{
 const old=P.settings({nameWidthScale:.65,nameNipWidthScale:.68,nipWidthScale:.78},'13.8.12'),fresh=P.currentSettings(old);
 assert.equal(old.designVersion,'13.8.12');assert.equal(fresh.designVersion,'13.8.14');
 assert.deepEqual({...fresh,designVersion:old.designVersion},old);
 for(const model of models.filter(x=>!C.modelLayout(x).logo)){const o={...order(),model},assets={};assert.deepEqual(P.artwork(o,old,assets,false,'13.8.12').shapes,P.artwork(o,fresh,assets).shapes);}
});
test('PDF exports cubic font outlines for new sheets including rotated tags; old sheets retain their original operators',async()=>{
 const fonts=global.NFLocalFonts,originalGet=fonts.get;
 const glyph={d:'M0 0Q.5 -1 1 0L0 0Z',a:1,b:[0,-.5,1,0]};
 fonts.get=()=>({name:'Synthetic curved test glyph',glyphs:{O:glyph},kernPairs:{}});
 try{
  const rows=Array.from({length:29},(_,i)=>({...order('CURVE-'+i),name:'O',nip:''}));
  const job={id:'CURVE',engine:P.BUILD,createdAt:'2026-10-16T00:00:00Z',orders:rows,settings:P.settings(),assets:{}};
  async function contents(bytes){const lib=global.PDFLib,doc=await lib.PDFDocument.load(bytes),items=doc.getPages()[0].node.Contents();return Array.from({length:items.size()},(_,i)=>Buffer.from(lib.decodePDFRawStream(doc.context.lookup(items.get(i))).decode()).toString()).join('\n');}
  const fresh=await contents(await P.pdf(job)),old=await contents(await P.pdf({...job,engine:'13.8.12',settings:P.settings({},'13.8.12')}));
  assert.equal((fresh.match(/ c\n/g)||[]).length,29);assert.equal((fresh.match(/ v\n/g)||[]).length,0);
  assert.equal((old.match(/ v\n/g)||[]).length,29);assert.equal((old.match(/ c\n/g)||[]).length,0);
  const rotated=[...fresh.matchAll(/0 (-[\d.]+) ([\d.]+) 0 [\d.]+ [\d.]+ cm/g)];
  assert.equal(rotated.length,3);for(const r of rotated){assert(Math.abs(Number(r[1])+19.6)<1e-10);assert(Math.abs(Number(r[2])-28)<1e-10);}
 }finally{fonts.get=originalGet;}
});

test('All six logo layouts fit portrait, square and wide images without changing aspect or touching text',()=>{
 const square=fixtureLogo(),wide=fixtureLogo('logo-wide.jpg'),portrait={data:'data:image/png;base64,'+fs.readFileSync(root+'/tests/fixtures/logo-portrait.png').toString('base64'),width:240,height:640};
 for(const model of models.filter(x=>C.modelLayout(x).logo))for(const logo of [square,wide,portrait])for(const size of [{},{tagWidth:40,tagHeight:16},{pageWidth:400,tagWidth:150,tagHeight:40}]){
  const o={...order(),model,name:'NAMA PANJANG YANG MENCAPAI BATAS',logo:'TEST'},a=P.artwork(o,size,{[P.logoKey(o)]:logo}),im=a.shapes.find(s=>s.type==='image'),text=a.shapes.filter(s=>s.type==='path');
  assert(Math.abs(im.w/im.h-logo.width/logo.height)<1e-10);assert(Math.abs(im.y+im.h/2-a.height/2)<1e-10);
  assert(im.x>=0&&im.y>=0&&im.x+im.w<20.7&&im.y+im.h<=a.height);
  assert(text.every(t=>t.x>im.x+im.w));assert(a.nameWidth<=55+1e-10);
  if(C.modelLayout(model).divider)assert(im.x+im.w<17.8-.375);
 }
});
test('Models 5 and 10 form a continuous T reaching the right black edge in SVG and PDF geometry',()=>{
 for(const i of [4,9])for(const size of [{},{tagWidth:90,tagHeight:24}]){
  const o={...order(),model:models[i]},a=P.artwork(o,size,{[P.logoKey(o)]:{omit:true}}),lines=a.shapes.filter(s=>s.type==='line'),v=lines.find(s=>s.x===s.x2),h=lines.find(s=>s.y===s.y2),inset=i===4?2.075:0;
  assert.equal(h.x,v.x);assert.equal(v.x,17.8);assert.equal(h.x2,a.width-inset);assert.equal(v.y,inset);assert.equal(v.y2,a.height-inset);
  assert(h.y>v.y&&h.y<v.y2);assert.equal(h.line,v.line);
  const svg=P.tagSvg(o,size,{[P.logoKey(o)]:{omit:true}});assert(svg.includes(`M${h.x},${h.y}L${h.x2},${h.y2}`));
 }
});
test('Plain variants preserve reference logo anchors and model 4 has room for a wide gold emblem',()=>{
 for(const [left,right] of [[2,7],[4,9]]){
  const a={...order(),model:models[left]},b={...order(),model:models[right]},asset=fixtureLogo();
  const x=P.artwork(a,{}, {[P.logoKey(a)]:asset}).shapes.find(p=>p.type==='image'),y=P.artwork(b,{}, {[P.logoKey(b)]:asset}).shapes.find(p=>p.type==='image');
  assert.deepEqual(x,y);
 }
 const o={...order(),model:models[3]},asset=fixtureLogo('logo-wide.jpg'),im=P.artwork(o,{}, {[P.logoKey(o)]:asset}).shapes.find(p=>p.type==='image');assert.equal(im.w,15.4);
});
test('All archived v13.8.11 and v13.8.12 models retain the original geometry',()=>{
 for(const f of JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/legacy-logo-geometry-v13.8.12.json'),'utf8'))){
  const o={...order(),name:'PATRIAH, S.Pd.I',model:models[f.model-1]},a=P.artwork(o,{}, {[P.logoKey(o)]:{omit:true}},false,f.engine);
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(a.shapes)).digest('hex'),f.sha256,f.engine+' model '+f.model);
 }
});


function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}
test('Updating current print settings preserves intentional values matching older defaults',()=>{
 for(const designVersion of ['13.8.11','13.8.12','13.8.13']){
  const input={...P.DEFAULTS,designVersion,layoutMode:'grid',margin:8,gapX:3,gapY:2,nameHeight:7.5,condense:.62,shortSpacing:.8,cropMarks:true};
  const migrated=P.currentSettings(input);
  for(const key of ['layoutMode','margin','gapX','gapY','nameHeight','condense','shortSpacing','cropMarks'])assert.equal(migrated[key],input[key],designVersion+' '+key);
 }
});
test('Late admin log response is ignored after logout or workspace change',async()=>{
 for(const change of ["token='';authGeneration++", "endpoint='https://script.google.com/macros/s/NEW/exec';authGeneration++"]){
  const h=appHarness([order()],'admin'),d=deferred();h.ctx.NFCore.request=()=>d.promise;
  const request=h.run('loadLogs()');h.run(change);d.resolve([{id:'OLD-PRIVATE-LOG'}]);await request;
  assert.equal(h.getState().logs,undefined);
 }
});
test('Logout cancels an in-progress login response',async()=>{
 const h=appHarness([order()]),d=deferred();h.ctx.NFCore.request=()=>d.promise;
 h.run("storage=async()=>({});authModal()");h.e('authToken').value='NEW_TOKEN';
 const request=h.e('authForm').onsubmit({preventDefault(){}});h.e('logoutBtn').onclick();
 d.resolve({...snapshot([order('OTHER')]),role:'admin'});await request;
 assert.equal(h.run('token'),'');assert.equal(h.getState().snapshot.orders[0].id,'NT-TEST');
});
test('Closing print while font loading is pending does not reopen a builder or font dialog',async()=>{
 for(const ready of [true,false]){
  const d=deferred(),fonts={...global.NFLocalFonts,status:()=>({ready}),restore:()=>d.promise,detect:async()=>{}};
  const h=printUIHarness([order()],{},fonts),request=h.open();h.ctx.NFPrintUI.cancel();d.resolve();await request;
  assert.equal(h.html(),'');
 }
});
test('A print request cannot carry orders into a different access context',async()=>{
 const d=deferred(),fonts={...global.NFLocalFonts,restore:()=>d.promise};
 const h=printUIHarness([order()],{},fonts),request=h.open();h.adapter.context=()=> 'different workspace';d.resolve();await request;
 assert.equal(h.html(),'');assert.equal(h.saved(),null);
});
test('Opening print history cancels an earlier pending builder',async()=>{
 const d=deferred(),fonts={...global.NFLocalFonts,restore:()=>d.promise};
 const h=printUIHarness([order()],{},fonts),request=h.open();h.ctx.NFPrintUI.history();const html=h.html();d.resolve();await request;
 assert.equal(h.html(),html);assert.match(html,/Belum ada lembar cetak/);
});


test('Normal owner log loading and login still commit the correct session',async()=>{
 const h=appHarness([order()],'admin');h.ctx.NFCore.request=async()=>[{id:'LOG'}];await h.run('loadLogs()');assert.equal(h.getState().logs[0].id,'LOG');
 h.ctx.NFCore.request=async()=>({...snapshot([order('NEW')]),role:'operator'});h.run("storage=async()=>({});authModal()");h.e('authToken').value='NEW_TOKEN';
 await h.e('authForm').onsubmit({preventDefault(){}});assert.equal(h.run('token'),'NEW_TOKEN');assert.equal(h.getState().snapshot.orders[0].id,'NEW');assert.equal(h.getState().logs.length,0);assert.equal(h.e('modal').open,false);
});
test('Closing access settings cancels a pending replacement login',async()=>{
 const h=appHarness([order()]),d=deferred();h.ctx.NFCore.request=()=>d.promise;h.run("storage=async()=>({});authModal()");h.e('authToken').value='REPLACEMENT';
 const request=h.e('authForm').onsubmit({preventDefault(){}});await h.run('closeModal()');d.resolve({...snapshot([order('OTHER')]),role:'admin'});await request;
 assert.equal(h.run('token'),'TEST');assert.equal(h.getState().snapshot.orders[0].id,'NT-TEST');
});
test('Delayed local transactions cannot overwrite a different current workspace',async()=>{
 for(const name of ['State','PrintState']){
  const h=appHarness([order()]),d=deferred();h.ctx.delayed=d.promise;h.run('storage=()=>delayed');
  const request=h.run('originalEdit'+name+'(s=>{s.marker="OLD"})');h.run("endpoint='https://script.google.com/macros/s/OTHER/exec';authGeneration++");d.resolve({marker:'OLD',pending:[]});await request;
  assert.equal(h.run(name==='State'?'S.marker':'printCache.marker'),undefined);
 }
});
test('A local mutation waiting for its transaction aborts when access changes',async()=>{
 for(const name of ['State','PrintState']){
  const h=appHarness([order()]),d=deferred();h.ctx.delayed=d.promise;h.run('storage=async fn=>{await delayed;const value={};fn(value);return value;}');
  const request=h.run('originalEdit'+name+'(s=>{s.marker="OLD"})');h.run('authGeneration++');d.resolve();await assert.rejects(request,/Akses/);
 }
});
test('An obsolete sync lock callback never sends the new workspace queue to the old backend',async()=>{
 const h=appHarness([order()]),lock=deferred();let task,calls=0;
 h.ctx.navigator.locks={request:(_name,_opts,fn)=>{task=fn;return lock.promise;}};h.ctx.NFCore.request=async()=>{calls++;throw new Error('must not send');};
 h.run("db={};sync=originalSync;NFCore.queueOperations(S,[{kind:'upsert',id:'NT-TEST',expectedRevision:'rev0',data:NFCore.fields(S.snapshot.orders[0])}],'TEST')");
 const request=h.run('sync()');h.run("endpoint='https://script.google.com/macros/s/OTHER/exec';authGeneration++");await task({});lock.resolve();await request;
 assert.equal(calls,0);assert.equal(h.getState().pending[0].attempted,undefined);
});
test('Cancelled history does not show a late missing-font dialog',async()=>{
 const d=deferred(),fonts={...global.NFLocalFonts,status:()=>({ready:false}),restore:()=>d.promise,detect:async()=>{}};
 const h=printUIHarness([order()],{},fonts),job=P.createJob([order()]);h.s.printJobs=[job];const request=h.ctx.NFPrintUI.showJob(job.id);h.ctx.NFPrintUI.cancel();d.resolve();await request;assert.equal(h.html(),'');
});
test('Font preparation errors remain visible without an unhandled builder rejection',async()=>{
 const h=printUIHarness([order()],{},{...global.NFLocalFonts,restore:async()=>{},prepare:()=>{throw new Error('CHARACTER_UNAVAILABLE');}});let message='';h.adapter.toast=value=>message=value;await h.open();assert.equal(message,'CHARACTER_UNAVAILABLE');assert.equal(h.html(),'');
});
test('Default v13.8.14 artwork and archived v13.8.13 artwork retain all ten reference geometries',()=>{
 for(const f of JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/geometry-v13.8.13.json'),'utf8'))){
  const o={...order(),name:'PATRIAH, S.Pd.I',model:models[f.model-1]},asset=fixtureLogo();
  for(const engine of ['13.8.13',P.BUILD]){const a=P.artwork(o,{}, {[P.logoKey(o)]:asset},false,engine);assert.equal(crypto.createHash('sha256').update(JSON.stringify(a.shapes)).digest('hex'),f.sha256,engine+' model '+f.model);}
 }
 assert.equal(P.settings({},'13.8.13').designVersion,'13.8.13');
});


test('Conflict review cannot apply a delayed snapshot after changing workspace or closing its dialog',async()=>{
 for(const change of ["endpoint='https://script.google.com/macros/s/NEW/exec';authGeneration++",'closeModal()']){
  const h=appHarness([order()]),d=deferred();h.ctx.NFCore.request=()=>d.promise;
  h.run("NFCore.queueOperations(S,[{kind:'upsert',id:'NT-TEST',expectedRevision:'rev0',data:{...NFCore.fields(S.snapshot.orders[0]),name:'DRAFT'}}],'TEST');S.pending[0].status='blocked';checkOp(S.pending[0].operation.opId)");
  const oldId=h.getState().pending[0].operation.opId,request=h.e('rebaseOp').onclick();await h.run(change);d.resolve(snapshot([order()]));await request;
  assert.equal(h.getState().pending[0].operation.opId,oldId);assert.equal(h.getState().pending[0].status,'blocked');
 }
});
test('Print completion aborts if access changes before the local transaction reads its records',async()=>{
 const {o,j}=printing(),h=appHarness([o]),ep=h.run('endpoint'),records=new Map([[ep,state([o])],[ep+'::print',{printJobs:[j]}]]);
 h.ctx.database=fakeDatabase(records);h.ctx.fresh=snapshot([o]);h.ctx.jobId=j.id;h.run('db=database');
 const request=h.run('commitPrintJob(jobId,fresh)');h.run('authGeneration++');await assert.rejects(request,/Akses/);
 assert.equal(records.get(ep).pending.length,0);assert.equal(records.get(ep+'::print').printJobs[0].finishSubmittedAt,undefined);
});

(async()=>{let passed=0;for(const [name,fn] of cases){try{await fn();passed++;console.log('PASS '+name);}catch(e){console.error('FAIL '+name+'\n'+e.stack);process.exitCode=1;}}console.log(`${passed}/${cases.length} tests passed. No network or live data used.`);})();
