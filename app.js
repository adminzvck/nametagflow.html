'use strict';
const C=NFCore,$=id=>document.getElementById(id),STAGES=['Cetak vinyl','Laminasi','Akrilik','Resin','Pengait','Packing','Pengiriman'],COLORS=['#adc788','#c5c797','#90b9c3','#9cafd4','#bda8cc','#d8bf93','#90c5af'];
let endpoint=localStorage.getItem('nf13_endpoint')||C.ENDPOINT,token=sessionStorage.getItem('nf13_token')||'',operator=localStorage.getItem('nf13_operator')||'',S={snapshot:null,pending:[],lastSync:''},db,page='active',pageNo=1,selected=new Set(),running=false,scanner=null,modalDirty=false,authGeneration=0;
const PAGE_SIZE=25,channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('nf13-state'):null;
function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open('nametagflow-v13',1);r.onupgradeneeded=()=>r.result.createObjectStore('workspaces');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
function storage(change){return new Promise((resolve,reject)=>{const tx=db.transaction('workspaces',change?'readwrite':'readonly'),store=tx.objectStore('workspaces'),req=store.get(endpoint);let value;req.onsuccess=()=>{try{value=req.result||{snapshot:null,pending:[],lastSync:''};if(change){change(value);store.put(value,endpoint);}}catch(e){tx.abort();reject(e);}};tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Penyimpanan lokal gagal. Jangan tutup draf ini.'));});}
async function editState(fn){S=await storage(fn);channel?.postMessage({endpoint});render();return S;}
function toast(msg){$('toast').textContent=msg;$('toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').classList.remove('show'),4200);}
function errorMessage(e){return e?.message||String(e);}
function dateKey(v){if(!v)return '';const d=new Date(v);if(isNaN(d))return '';return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);}
function fmtDate(v,time=false){const d=new Date(v);return !v||isNaN(d)?'Tanggal belum tercatat':new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',day:'2-digit',month:'short',year:'numeric',...(time?{hour:'2-digit',minute:'2-digit'}:{})}).format(d);}
function today(){return dateKey(new Date());}
function download(name,data){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function viewOrders(){return C.overlay(S.snapshot,S.pending);}
function viewArchives(){const map=new Map((S.snapshot?.archives||[]).map(x=>[x.id,{...x}]));for(const p of S.pending){const op=p.operation;if(op.kind==='archiveStatus'&&map.has(op.id))map.set(op.id,{...map.get(op.id),archiveStatus:op.status,revision:'pending:'+op.opId,_pending:p.status||'queued',_action:op.kind});else if(op.kind==='restore'&&map.has(op.id)){map.get(op.id)._pending=p.status||'queued';map.get(op.id)._action=op.kind;}}return [...map.values()];}
function eligibleOrders(){return viewOrders().filter(o=>!o._action);}
function currentData(){if(page==='archives')return viewArchives();if(page==='history')return [...viewOrders().map(o=>({...o,_source:'Aktif'})),...viewArchives().map(o=>({...o,_source:'Arsip'}))];return viewOrders();}
function filterRows(rows){const q=$('search').value.toLowerCase().trim(),stage=$('stageFilter').value,date=$('dateFilter').value;return rows.filter(o=>(!q||[o.name,o.nip,o.mp,o.resi,o.sku,o.notes,o.logo].some(v=>String(v||'').toLowerCase().includes(q)))&&(!date||dateKey(o.createdAt)===date)&&(!stage||page!=='active'||(stage==='reject'?o.isReject:Number(o.currentStep)===Number(stage))));}
function updateConnection(text,state=''){ $('connectionText').textContent=text;$('connection').className='connection '+state;}
function render(){
 document.body.classList.toggle('locked',!token);const snap=S.snapshot,orders=viewOrders(),pending=S.pending,role=snap?.role||'operator';document.querySelectorAll('.admin-only').forEach(e=>e.classList.toggle('hidden',role!=='admin'));
 $('navActive').textContent=orders.length;$('navQueue').textContent=pending.length;$('operatorBadge').textContent=operator||'Operator';
 const names={active:'Antrean produksi',archives:'Arsip pesanan',history:'Cari data lama',queue:'Antrean simpan',recycle:'Pemulihan',logs:'Log perubahan'};
 $('breadcrumb').textContent=names[page];$('pageTitle').textContent=page==='active'?'Alur rapi. Pesanan selesai.':names[page];$('eyebrow').textContent=page==='active'?'PRODUCTION OVERVIEW':'JOHN STORE / WORKSPACE';
 $('pageSub').textContent={active:'Pantau setiap nametag, dari cetak hingga pengiriman.',archives:'Pesanan selesai diproduksi, lengkap dengan riwayatnya.',history:'Temukan data aktif dan arsip tanpa menebak nama atau nomor pesanan.',queue:'Draf tersimpan di perangkat ini sampai pusat mengonfirmasi.',recycle:'Pesanan yang dihapus dapat dipulihkan oleh pemilik.',logs:'Jejak perubahan untuk membantu pemeriksaan produksi.'}[page];
 document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('selected',b.dataset.page===page));
 ['activeActions','metrics','productionPanel'].forEach(id=>$(id).classList.toggle('hidden',page!=='active'));
 $('filters').classList.toggle('hidden',['queue','recycle','logs'].includes(page));$('batchBtn').classList.toggle('hidden',page!=='active');$('stageFilter').classList.toggle('hidden',page!=='active');$('listTitle').textContent=page==='active'?'Semua pesanan aktif':names[page];
 const scoped=orders.filter(o=>!$('dateFilter').value||dateKey(o.createdAt)===$('dateFilter').value),inProcess=scoped.filter(o=>o.currentStep<7),shipped=scoped.filter(o=>o.currentStep===7),issues=scoped.filter(o=>o.isReject);
 $('metrics').innerHTML=[['Total nametag',scoped.length,'Dalam cakupan tanggal ini','▦'],['Sedang diproduksi',inProcess.length,'Tahap cetak sampai packing','◷'],['Dalam pengiriman',shipped.length,'Siap dipindahkan ke arsip','↗'],['Perlu cetak ulang',issues.length,'Periksa alasan cacat','↻']].map((m,i)=>`<div class="metric ${i===0?'highlight':''}"><span class="metric-label">${m[0]}</span><span class="metric-icon">${m[3]}</span><strong>${m[1]}</strong><small>${m[2]}</small></div>`).join('');
 $('stages').innerHTML=STAGES.map((n,i)=>`<button class="stage ${$('stageFilter').value==i+1?'active':''}" data-stage="${i+1}"><span class="stage-number">0${i+1}</span><strong>${scoped.filter(o=>o.currentStep===i+1).length}</strong><span class="stage-name">${n}</span><div class="stage-bar" style="--stage-color:${COLORS[i]}"></div></button>`).join('');
 $('scopeLabel').textContent=$('dateFilter').value?'Input '+fmtDate($('dateFilter').value):'Semua tanggal';$('lastSync').textContent=S.lastSync?'Pusat diperiksa '+fmtDate(S.lastSync,true):'Belum disinkronkan';
 const blocked=pending.filter(p=>p.status==='blocked'),waiting=pending.filter(p=>p.status!=='blocked');
 if(blocked.length){$('notice').className='notice error';$('notice').textContent=`${blocked.length} perubahan perlu diperiksa. Draf tetap disimpan. Buka Antrean simpan untuk membandingkan dengan data pusat.`;}
 else if(pending.length){$('notice').className='notice';$('notice').textContent=`${waiting.length} perubahan menunggu konfirmasi pusat. Kamu boleh melanjutkan pekerjaan; jangan hapus data browser sebelum antrean selesai.`;}
 else if(!snap){$('notice').className='notice';$('notice').textContent='Masuk dengan kode akses untuk memuat data pusat. Belum ada data yang ditampilkan.';}
 else $('notice').className='notice hidden';
 if(page==='queue')renderQueue();else if(page==='recycle')renderRecycle();else if(page==='logs')renderLogs();else renderTable(filterRows(currentData()));
 selected=new Set([...selected].filter(id=>orders.some(o=>o.id===id)));$('selectionBar').classList.toggle('hidden',page!=='active'||!selected.size);$('selectedCount').textContent=selected.size+' nametag dipilih';
 $('footerInfo').textContent=page==='queue'?pending.length+' perubahan tersimpan di perangkat ini':page==='logs'?'300 perubahan terakhir':`Zona waktu Jakarta · ${pending.length} perubahan menunggu`;
}
function pill(o){if(o._pending)return `<span class="pill ${o._pending==='blocked'?'error':'warn'}"><span class="dot"></span>${o._pending==='blocked'?'Perlu diperiksa':'Menunggu simpan'}</span>`;if(o.archiveStatus)return `<span class="pill finished">${C.esc(o.archiveStatus)}</span>`;return `<span class="pill ${o.isReject?'warn':o.currentStep===7?'finished':'progress'}"><span class="dot"></span>${o.isReject?'Cetak ulang':C.esc(STAGES[o.currentStep-1]||'Belum ada tahap')}</span>`;}
function renderTable(rows){
 $('resultCount').textContent=rows.length;const total=Math.max(1,Math.ceil(rows.length/PAGE_SIZE));pageNo=Math.min(pageNo,total);const slice=rows.slice((pageNo-1)*PAGE_SIZE,pageNo*PAGE_SIZE);
 $('pagination').innerHTML=`<button data-paging="-1" ${pageNo<=1?'disabled':''} aria-label="Halaman sebelumnya">‹</button> ${pageNo} / ${total} <button data-paging="1" ${pageNo>=total?'disabled':''} aria-label="Halaman selanjutnya">›</button>`;
 if(!rows.length){$('content').innerHTML=`<div class="empty"><strong>${S.snapshot?'Belum ada pesanan yang cocok.':'Ruang produksi siap digunakan.'}</strong><span>${S.snapshot?'Coba semua tanggal atau ubah pencarian.':'Masuk untuk melihat antrean John Store.'}</span></div>`;return;}
 $('content').innerHTML=`<div class="table-wrap"><table><thead><tr><th>${page==='active'?'<input type="checkbox" id="selectPage" aria-label="Pilih halaman ini">':'NO.'}</th><th>NAMA & IDENTITAS</th><th>DETAIL NAMETAG</th><th>NOMOR PESANAN</th><th>STATUS</th><th>TANGGAL INPUT</th><th>AKSI</th></tr></thead><tbody>${slice.map((o,i)=>`<tr><td>${page==='active'?`<input type="checkbox" data-select="${C.esc(o.id)}" ${selected.has(o.id)?'checked':''} aria-label="Pilih ${C.esc(o.name)}">`:(pageNo-1)*PAGE_SIZE+i+1}</td><td><span class="name">${C.esc(o.name)}</span><small>${C.esc(o.nip||'Tanpa NIP / jabatan')}</small>${o.notes?`<small title="${C.esc(o.notes)}">${C.esc(o.notes.slice(0,65))}${o.notes.length>65?'…':''}</small>`:''}</td><td><span class="tag">${C.esc((o.model||'').replace(/ \(.*/,''))}</span><small>${C.esc(o.hook)}${o.logo?' · '+C.esc(o.logo):''}</small></td><td><span class="mp">${C.esc(o.mp||'MP belum ada')}</span><small>${C.esc(o.resi||'Resi belum diisi')}</small></td><td>${pill(o)}<small>${page==='history'?C.esc(o._source):'Cetak ke-'+(o.printCount||1)}</small></td><td>${fmtDate(o.createdAt)}<small>${C.esc(o.id)}</small></td><td><div class="row-actions">${page==='active'?`<button data-edit="${C.esc(o.id)}" aria-label="Edit ${C.esc(o.name)}">Edit</button><button data-next="${C.esc(o.id)}" ${o._action||o.currentStep>=7?'disabled':''} aria-label="Lanjutkan tahap ${C.esc(o.name)}">→</button>`:page==='archives'?`<button data-archive-status="${C.esc(o.id)}" ${o._pending?'disabled':''}>Status</button>${S.snapshot.role==='admin'?`<button data-restore="${C.esc(o.id)}" ${o._pending?'disabled':''}>Pulihkan</button>`:''}`:`<button data-reuse="${C.esc(o.id)}">Pakai data</button>`}</div></td></tr>`).join('')}</tbody></table></div>`;
 if($('selectPage'))$('selectPage').onchange=e=>{slice.forEach(o=>e.target.checked?selected.add(o.id):selected.delete(o.id));render();};
}
function renderQueue(){
 $('pagination').innerHTML='';$('resultCount').textContent=S.pending.length;
 $('content').innerHTML=S.pending.length?S.pending.map(p=>`<article class="queue-card"><h3>${C.esc(p.operation.data?.name||p.operation.id)} <span class="pill ${p.status==='blocked'?'error':'warn'}">${p.status==='blocked'?'Perlu diperiksa':'Menunggu pusat'}</span></h3><p>${C.esc(p.operation.kind)} · ${fmtDate(p.createdAt,true)}${p.error?' · '+C.esc(p.error):''}</p><div class="row-actions"><button data-check-op="${C.esc(p.operation.opId)}">Periksa draf</button><button data-export-op="${C.esc(p.operation.opId)}">Ekspor draf</button></div></article>`).join(''):'<div class="empty"><strong>Semua perubahan sudah beres.</strong>Tidak ada antrean simpan di perangkat ini.</div>';
}
function renderRecycle(){
 const rows=S.snapshot?.recycle||[];$('resultCount').textContent=rows.length;$('pagination').innerHTML='';$('content').innerHTML=rows.length?rows.map(x=>`<article class="queue-card"><h3>${C.esc(x.order.name)}</h3><p>${C.esc(x.order.mp)} · Dihapus ${fmtDate(x.deletedAt,true)}</p><button class="btn small" data-restore="${C.esc(x.id)}">Pulihkan pesanan</button></article>`).join(''):'<div class="empty"><strong>Tidak ada pesanan terhapus.</strong>Pesanan yang dihapus akan tersedia di sini.</div>';
}
function renderLogs(){const logs=S.logs||[];$('pagination').innerHTML='';$('resultCount').textContent=logs.length;$('content').innerHTML=logs.length?`<div class="table-wrap"><table><thead><tr><th>WAKTU</th><th>AKSI</th><th>PESANAN</th><th>OPERATOR</th></tr></thead><tbody>${logs.map(l=>`<tr><td>${fmtDate(l.time,true)}</td><td>${C.esc(l.field)}</td><td>${C.esc(l.newValue)}<small>${C.esc(l.id)}</small></td><td>${C.esc(l.operator)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty"><strong>Belum ada log yang dimuat.</strong>Gunakan Muat ulang untuk mengambil log terbaru.</div>';}
function go(p){page=p;pageNo=1;selected.clear();$('stageFilter').value='';$('search').value='';$('dateFilter').value='';render();if(p==='logs')loadLogs();}
async function loadLogs(){try{const logs=await C.request(endpoint,token,'logs');await editState(s=>s.logs=logs);}catch(e){toast(errorMessage(e));}}
function modal(title,html){$('modalTitle').textContent=title;$('modalBody').innerHTML=html;modalDirty=false;if(!$('modal').open)$('modal').showModal();}
async function closeModal(){if(!token){toast('Masukkan kode akses untuk membuka ruang produksi.');return;}if(modalDirty&&!confirm('Tutup tanpa menyimpan isian formulir ini?'))return;if(scanner){try{await scanner.stop();await scanner.clear();}catch{}scanner=null;}$('modal').close();modalDirty=false;}
$('closeModal').onclick=closeModal;$('modal').addEventListener('cancel',e=>{e.preventDefault();closeModal();});$('modalBody').addEventListener('input',()=>modalDirty=true);
function authModal(){
 modal('Hubungkan ruang produksi',`<p class="form-help">Masukkan nama operator dan kode akses yang diberikan pemilik. Kode hanya disimpan selama sesi browser ini.</p><form id="authForm"><div class="form-grid"><label class="field full">Nama operator<input id="authName" required value="${C.esc(operator)}" autocomplete="name"></label><label class="field full">Kode akses<input id="authToken" type="password" required autocomplete="off" value="${C.esc(token)}"></label></div><details><summary>Alamat backend</summary><input id="authEndpoint" type="url" value="${C.esc(endpoint)}" aria-label="URL backend"><p>Gunakan URL deployment /exec yang diberikan pemilik.</p></details><p id="authError" class="form-error"></p><div class="form-actions"><button type="button" class="btn" id="logoutBtn">Keluar</button><button class="btn primary" id="loginBtn">Hubungkan</button></div></form>`);
 $('logoutBtn').onclick=()=>{token='';authGeneration++;sessionStorage.removeItem('nf13_token');updateConnection('Belum terhubung');modalDirty=false;render();authModal();};
 $('authForm').onsubmit=async e=>{e.preventDefault();const btn=$('loginBtn');btn.disabled=true;$('authError').textContent='';const ep=$('authEndpoint').value.trim(),tk=$('authToken').value.trim(),name=$('authName').value.trim();try{const snapshot=await C.request(ep,tk,'snapshot');endpoint=ep;token=tk;operator=name;authGeneration++;sessionStorage.setItem('nf13_token',token);localStorage.setItem('nf13_endpoint',endpoint);localStorage.setItem('nf13_operator',operator);await editState(s=>{s.snapshot=snapshot;s.lastSync=new Date().toISOString();if(snapshot.role!=='admin')s.logs=[];});if(snapshot.role!=='admin'&&['logs','recycle'].includes(page))go('active');modalDirty=false;closeModal();updateConnection('Terhubung pusat','ok');sync();}catch(err){$('authError').textContent=errorMessage(err);}finally{btn.disabled=false;}};
}
function options(values,value){const list=[...values];if(value&&!list.includes(value))list.unshift(value);return '<option value="">Pilih…</option>'+list.map(v=>`<option ${v===value?'selected':''} value="${C.esc(v)}">${C.esc(v)}</option>`).join('');}
function openOrder(id,seed){
 if(!S.snapshot){authModal();return;}const existing=id?viewOrders().find(x=>x.id===id):null;if(id&&!existing)return;if(existing?._action){toast('Tunggu pemindahan pesanan ini selesai.');return;}
 const d=existing||seed||{},settings=S.snapshot.settings;
 modal(existing?'Edit nametag':'Pesanan baru',`<p class="form-help">${existing?'Perubahan akan dibandingkan dengan versi pusat sebelum disimpan.':'Satu MP dapat memiliki beberapa nametag. Nama yang sama tetap dihitung sebagai item terpisah.'}</p><form id="orderForm"><div class="form-grid"><label class="field">No. MP / Order ID<input name="mp" required value="${C.esc(d.mp||'')}"></label><label class="field">No. resi<input name="resi" value="${C.esc(d.resi||'')}"></label><label class="field full">SKU toko<select name="sku" required>${options(settings.skus,d.sku)}</select><small>SKU harus terdaftar di tab Pengaturan, kolom K.</small></label><label class="field">Model<select name="model" required>${options(settings.models,d.model)}</select></label><label class="field">Pengait<select name="hook" required>${options(settings.hooks,d.hook)}</select></label>${!existing?'<label class="field full">Tanggal input<input name="createdAt" type="date" value="'+today()+'" required></label>':''}</div><div class="mini-items" id="itemForms"></div>${!existing?'<button type="button" class="text-btn" id="extraItemBtn">＋ Tambah nama dalam pesanan ini</button>':''}${existing?`<div class="form-grid" style="margin-top:18px"><label class="field">Tahap produksi<select name="currentStep">${STAGES.map((s,i)=>`<option value="${i+1}" ${d.currentStep===i+1?'selected':''}>${i+1} · ${s}</option>`).join('')}</select></label><label class="field">Cetak ke-<input type="number" min="1" max="999" required name="printCount" value="${d.printCount}"></label><label class="field full">Alasan cetak ulang / cacat<input name="rejectReason" value="${C.esc(d.rejectReason||'')}"></label><label class="field full"><span><input type="checkbox" name="isReject" ${d.isReject?'checked':''}> Tandai perlu cetak ulang</span></label></div>`:''}<p id="orderError" class="form-error"></p><div class="form-actions">${existing&&S.snapshot.role==='admin'?'<button type="button" class="btn danger" id="deleteBtn">Hapus ke pemulihan</button>':''}<button class="btn primary" id="saveOrderBtn">Simpan perubahan</button></div></form>`);
 const itemTemplate=(v,i)=>`<div class="item-form"><div class="item-head"><span>Nametag ${i+1}</span>${i?'<button type="button" class="text-btn remove-item">Hapus item</button>':''}</div><div class="form-grid"><label class="field">Nama<input data-field="name" required value="${C.esc(v.name||'')}"></label><label class="field">NIP / jabatan<input data-field="nip" value="${C.esc(v.nip||'')}"></label><label class="field full">Logo<input data-field="logo" value="${C.esc(v.logo||'')}" list="logoList"></label><label class="field full">Catatan / custom<textarea data-field="notes" rows="2">${C.esc(v.notes||'')}</textarea></label></div></div>`;
 $('itemForms').innerHTML=itemTemplate(d,0)+`<datalist id="logoList">${(S.snapshot.logos||[]).map(v=>'<option value="'+C.esc(v)+'">').join('')}</datalist>`;
 if($('extraItemBtn'))$('extraItemBtn').onclick=()=>{const n=$('itemForms').querySelectorAll('.item-form').length;if(n>=50){toast('Maksimal 50 nametag sekali input.');return;}$('itemForms').insertAdjacentHTML('beforeend',itemTemplate({},n));modalDirty=true;};
 $('itemForms').onclick=e=>{if(e.target.classList.contains('remove-item')){e.target.closest('.item-form').remove();modalDirty=true;}};
 if($('deleteBtn'))$('deleteBtn').onclick=async()=>{if(!confirm('Pindahkan '+existing.name+' ke Pemulihan?'))return;try{await enqueue([{kind:'delete',id:existing.id,expectedRevision:existing.revision}]);modalDirty=false;closeModal();}catch(e){$('orderError').textContent=errorMessage(e);}};
 $('orderForm').onsubmit=async e=>{e.preventDefault();$('saveOrderBtn').disabled=true;try{const f=new FormData(e.target),common=Object.fromEntries(f),items=[...$('itemForms').querySelectorAll('.item-form')].map(box=>Object.fromEntries([...box.querySelectorAll('[data-field]')].map(x=>[x.dataset.field,x.value.trim()])));
 const ops=items.map(item=>{const data={...C.fields(d),...common,...item,currentStep:existing?Number(f.get('currentStep')):1,printCount:existing?Number(f.get('printCount')):1,isReject:existing?f.get('isReject')==='on':false,createdAt:existing?d.createdAt:new Date(common.createdAt+'T12:00:00+07:00').toISOString()};return{kind:'upsert',id:existing?existing.id:C.uid('NT-'),expectedRevision:existing?existing.revision:null,data};});
 await enqueue(ops);modalDirty=false;closeModal();}catch(err){$('orderError').textContent=errorMessage(err);}finally{if($('saveOrderBtn'))$('saveOrderBtn').disabled=false;}};
}
async function enqueue(ops){
 if(!ops.length)return;
 await editState(s=>{for(const input of ops){const op={...input,opId:C.uid()};s.pending.push({operation:op,status:'queued',createdAt:new Date().toISOString(),operator});}});
 toast(ops.length+' perubahan masuk antrean simpan.');sync();
}
async function advance(id){const o=viewOrders().find(x=>x.id===id);if(!o||o.currentStep>=7||o._action)return;await enqueue([{kind:'upsert',id:o.id,expectedRevision:o.revision,data:{...C.fields(o),currentStep:o.currentStep+1,isReject:false}}]);}
async function acknowledge(p,result){await editState(s=>{if(!result?.committed||result.opId!==p.operation.opId)throw new Error('Pusat belum mengonfirmasi ID pengiriman ini.');s.pending=s.pending.filter(x=>x.operation.opId!==result.opId);if(s.snapshot){s.snapshot.orders=s.snapshot.orders.filter(o=>o.id!==result.id);if(result.order)s.snapshot.orders.push(result.order);if(result.archive){s.snapshot.archives=s.snapshot.archives.filter(o=>o.id!==result.id);s.snapshot.archives.push(result.archive);}if(result.kind==='restore')s.snapshot.archives=s.snapshot.archives.filter(o=>o.id!==result.id);s.pending.forEach(x=>{if(x.operation.expectedRevision==='pending:'+result.opId)x.operation.expectedRevision=result.order?.revision||result.archive?.revision;});}});}
async function sync(){
 if(!db||!token||running)return;running=true;const generation=authGeneration,ep=endpoint;
 const task=async()=>{updateConnection('Memeriksa pusat…');try{
  S=await storage();let n=0;
  while(n++<100&&generation===authGeneration){const p=S.pending.find(x=>x.status!=='blocked'&&!String(x.operation.expectedRevision||'').startsWith('pending:'));if(!p)break;
   await editState(s=>{const row=s.pending.find(x=>x.operation.opId===p.operation.opId);if(row)row.attempted=true;});
   try{const result=await C.request(ep,token,'mutate',{operation:p.operation,operator:p.operator});if(generation!==authGeneration)return;await acknowledge(p,result);}
   catch(e){await editState(s=>{const row=s.pending.find(x=>x.operation.opId===p.operation.opId);if(row){row.error=errorMessage(e);if(!C.retryable(e)&&e.code!=='AUTH_REQUIRED')row.status='blocked';row.code=e.code||'NETWORK';}});if(C.retryable(e)||e.code==='AUTH_REQUIRED')throw e;}
  }
  const snapshot=await C.request(ep,token,'snapshot');if(generation!==authGeneration)return;await editState(s=>{s.snapshot=snapshot;s.lastSync=new Date().toISOString();});updateConnection(S.pending.length?'Ada perubahan menunggu':'Terhubung pusat',S.pending.length?'warn':'ok');
 }catch(e){updateConnection(e.code==='AUTH_REQUIRED'?'Kode akses diperlukan':'Koneksi terputus','warn');toast(errorMessage(e));}finally{render();}};
 try{if(navigator.locks)await navigator.locks.request('nf13-sync:'+endpoint,{ifAvailable:true},lock=>lock?task():null);else await task();}finally{running=false;}
}
async function checkOp(opId){
 const p=S.pending.find(x=>x.operation.opId===opId);if(!p)return;const op=p.operation,current=S.snapshot?.orders.find(x=>x.id===op.id);
 modal('Periksa perubahan',`<p class="form-help">${C.esc(p.error||'Perubahan ini belum mendapat konfirmasi pusat. Jika koneksi terputus, kirim ulang dengan ID yang sama agar tidak membuat duplikat.')}</p><div class="compare"><div><h3>Draf perangkat ini</h3><pre>${C.esc(JSON.stringify(op.data||{aksi:op.kind,id:op.id},null,2))}</pre></div><div><h3>Versi pusat terakhir dimuat</h3><pre>${C.esc(JSON.stringify(current?C.fields(current):{status:'Tidak ada di antrean aktif'},null,2))}</pre></div></div><p class="form-help">Untuk mengambil versi pusat terbaru, tutup dialog lalu klik Muat ulang.</p><div class="form-actions"><button class="btn" id="retryOp">Coba kirim lagi</button>${p.status==='blocked'?'<button class="btn danger" id="discardOp">Gunakan versi pusat</button>':''}${p.status==='blocked'&&op.kind==='upsert'&&current?'<button class="btn primary" id="rebaseOp">Terapkan draf setelah diperiksa</button>':''}</div><p id="opError" class="form-error"></p>`);
 $('retryOp').onclick=async()=>{await editState(s=>{const x=s.pending.find(x=>x.operation.opId===opId);if(x){x.status='queued';x.error='';}});closeModal();sync();};
 if($('discardOp'))$('discardOp').onclick=async()=>{if(!confirm('Ekspor draf lalu batalkan SEMUA perubahan tertunda untuk pesanan ini?'))return;download('draf-dibatalkan-'+op.id+'.json',S.pending.filter(x=>x.operation.id===op.id));await editState(s=>s.pending=s.pending.filter(x=>x.operation.id!==op.id));closeModal();};
 if($('rebaseOp'))$('rebaseOp').onclick=async()=>{try{const fresh=await C.request(endpoint,token,'snapshot'),remote=fresh.orders.find(x=>x.id===op.id);if(!remote)throw new Error('Pesanan tidak lagi aktif. Gunakan pemulihan jika diperlukan.');if(remote.revision!==current.revision){await editState(s=>s.snapshot=fresh);checkOp(opId);toast('Versi pusat berubah lagi. Periksa perbandingan terbaru.');return;}if(!confirm('Terapkan draf ini di atas versi pusat yang telah ditampilkan?'))return;
 const dependent=S.pending.filter(x=>x.operation.id===op.id);if(dependent.length>1)throw new Error('Ada beberapa perubahan untuk ID ini. Ekspor draf dan gunakan versi pusat dahulu, lalu edit ulang.');
 await editState(s=>{s.pending=s.pending.filter(x=>x.operation.opId!==opId);s.snapshot=fresh;s.pending.push({operation:{...op,opId:C.uid(),expectedRevision:remote.revision},status:'queued',createdAt:new Date().toISOString(),operator});});closeModal();sync();}catch(e){$('opError').textContent=errorMessage(e);}};
}
function batchModal(){
 if(!S.snapshot)return authModal();
 modal('Impor massal',`
 <p class="form-help">
 Template cepat: <b>MP | Nama | NIP | Model | Pengait | Logo | Resi | SKU | Catatan</b><br>
 Bisa pakai model angka (contoh: 10) dan pengait M/P. Sistem akan menyesuaikan otomatis.
 <br><button type="button" class="text-btn" id="copyImportTemplate">Salin template harian</button>
 </p>
 <form id="batchForm">
 <label class="field">Data pesanan<textarea id="batchText" rows="10" required placeholder="586207583104304159 | IIS NURAISYAH | - | 10 | M | - | - | SKU_MAG |"></textarea></label>
 <p id="batchError" class="form-error"></p>
 <div class="form-actions"><button class="btn primary">Periksa dan masukkan antrean</button></div>
 </form>`);

 const template=`MP | NAMA | NIP | MODEL | PENGAIT | LOGO | RESI | SKU | CATATAN`;
 $('copyImportTemplate').onclick=async()=>{
   try{
    await navigator.clipboard.writeText(template);
    $('batchError').textContent='Template tersalin. Tempel setiap hari lalu isi data.';
   }catch(e){}
 };

 $('batchForm').onsubmit=async e=>{
  e.preventDefault();
  try{
   const lines=$('batchText').value.split(/\r?\n/).filter(x=>x.trim());
   if(lines.length>100)throw new Error('Maksimal 100 baris sekali impor.');
   const settings=S.snapshot.settings;

   function normalizeHook(v){
    const x=String(v||'').trim().toLowerCase();
    if(x==='m'||x.includes('mag')) return settings.hooks.find(h=>h.toLowerCase().includes('mag'))||'Magnet';
    if(x==='p'||x.includes('pen')) return settings.hooks.find(h=>h.toLowerCase().includes('pen'))||'Peniti';
    return v;
   }

   function normalizeModel(v){
    const raw=String(v||'').trim();
    const m=raw.match(/(\d{1,2})/);
    if(m){
      return settings.models.find(x=>new RegExp('\\b'+m[1]+'\\b|Model\\s+'+m[1],'i').test(x))||raw;
    }
    return raw;
   }

   const ops=lines.map((line,i)=>{
    let p=line.split(line.includes('\t')?'\t':'|').map(x=>x.trim());

    // format baru: MP | Nama | NIP | Model | Pengait | Logo | Resi | SKU | Catatan
    // format lama tetap diterima: MP | Resi | SKU | Nama | NIP | Logo | Pengait | Model | Catatan
    let mp,resi,sku,name,nip,logo,hook,model,notes;

    if(p.length>=8 && p[2] && p[3] && settings.skus.includes(p[2])){
      mp=p[0]; resi=p[1]; sku=p[2]; name=p[3]; nip=p[4]; logo=p[5]; hook=p[6]; model=p[7]; notes=p.slice(8).join(' | ');
    }else{
      mp=p[0]; name=p[1]; nip=p[2]; model=p[3]; hook=p[4]; logo=p[5]; resi=p[6]; sku=p[7]; notes=p.slice(8).join(' | ');
    }

    hook=normalizeHook(hook);
    model=normalizeModel(model);

    if(!mp||!name)throw new Error('Baris '+(i+1)+' MP/Nama kosong.');

    if(sku && !settings.skus.includes(sku)) throw new Error('SKU baris '+(i+1)+' belum terdaftar.');
    if(hook && !settings.hooks.includes(hook)) throw new Error('Pengait baris '+(i+1)+' tidak sesuai Pengaturan.');
    if(model && !settings.models.includes(model)) throw new Error('Model baris '+(i+1)+' tidak sesuai Pengaturan.');

    C.orderMatch(S.snapshot,{mp,resi});
    return {
      kind:'upsert',
      id:C.uid('NT-'),
      expectedRevision:null,
      data:{
        mp,resi,sku,name,nip,logo,
        hook:model?hook:hook,
        model,
        notes,
        currentStep:1,
        printCount:1,
        isReject:false,
        createdAt:new Date().toISOString()
      }
    };
   });

   if(!confirm('Tambahkan '+ops.length+' nametag ke antrean?'))return;
   await enqueue(ops);
   modalDirty=false;
   closeModal();
  }catch(err){$('batchError').textContent=errorMessage(err);}
 };
}
async function restore(id){const r=S.snapshot?.recycle.find(x=>x.id===id)||S.snapshot?.archives.find(x=>x.id===id);if(!r||!confirm('Pulihkan pesanan ini ke antrean aktif?'))return;await enqueue([{kind:'restore',id,expectedRevision:r.revision}]);}
function archiveStatus(id){const o=viewArchives().find(x=>x.id===id);if(!o||o._pending)return;modal('Status arsip',`<form id="archiveForm"><p class="form-help">${C.esc(o.name)} · ${C.esc(o.mp)}</p><label class="field">Status<select id="archiveValue">${options(['Dalam Pengiriman','Selesai Transaksi','Kendala / Retur'],o.archiveStatus)}</select></label><div class="form-actions"><button class="btn primary">Simpan status</button></div></form>`);$('archiveForm').onsubmit=async e=>{e.preventDefault();await enqueue([{kind:'archiveStatus',id,expectedRevision:o.revision,status:$('archiveValue').value}]);modalDirty=false;closeModal();};}
async function scanModal(){
 modal('Scan resi pengiriman',`<p class="form-help">Scanner USB dapat langsung mengetik resi. Hasil scan hanya menampilkan pesanan; periksa dahulu sebelum memindahkan tahap.</p><form id="scanForm"><label class="field">Nomor resi<input id="scanInput" autofocus autocomplete="off" required></label><div class="form-actions"><button type="button" class="btn" id="cameraBtn">Buka kamera</button><button class="btn primary">Temukan pesanan</button></div></form><div id="cameraArea"></div><div id="scanResults" style="margin-top:20px"></div>`);
 function find(){const key=C.key($('scanInput').value),rows=viewOrders().filter(o=>C.key(o.resi)===key);$('scanResults').innerHTML=rows.length?`<p class="form-help">${rows.length} nametag ditemukan.</p>${rows.map(o=>`<div class="card"><h3>${C.esc(o.name)}</h3><p>${C.esc(o.mp)} · ${C.esc(STAGES[o.currentStep-1])}</p></div>`).join('')}<button class="btn primary" id="shipScan">Pindahkan yang tahap 6 ke Pengiriman</button>`:'<p class="form-error">Resi tidak ditemukan di antrean aktif.</p>';if($('shipScan'))$('shipScan').onclick=async()=>{const targets=rows.filter(o=>o.currentStep===6&&!o._action);if(!targets.length){toast('Tidak ada item tahap Packing untuk resi ini.');return;}await enqueue(targets.map(o=>({kind:'upsert',id:o.id,expectedRevision:o.revision,data:{...C.fields(o),currentStep:7}})));modalDirty=false;closeModal();};}
 $('scanForm').onsubmit=e=>{e.preventDefault();find();};$('cameraBtn').onclick=async()=>{try{if(!window.Html5Qrcode)await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';s.onload=resolve;s.onerror=()=>reject(new Error('Pustaka kamera gagal dimuat. Gunakan input resi atau scanner USB.'));document.head.appendChild(s);});scanner=new Html5Qrcode('cameraArea');await scanner.start({facingMode:'environment'},{fps:8,qrbox:{width:250,height:150}},text=>{$('scanInput').value=text;find();scanner.stop().catch(()=>{});},()=>{});}catch(e){toast(errorMessage(e));}};
}
$('nav').onclick=e=>{const b=e.target.closest('[data-page]');if(b)go(b.dataset.page);};$('stages').onclick=e=>{const b=e.target.closest('[data-stage]');if(b){$('stageFilter').value=$('stageFilter').value===b.dataset.stage?'':b.dataset.stage;pageNo=1;render();}};
['search','stageFilter','dateFilter'].forEach(id=>$(id).addEventListener('input',()=>{pageNo=1;selected.clear();render();}));$('allDatesBtn').onclick=()=>{$('dateFilter').value='';selected.clear();render();};$('todayBtn').onclick=()=>{$('dateFilter').value=today();selected.clear();render();};
$('content').addEventListener('change',e=>{if(e.target.dataset.select){e.target.checked?selected.add(e.target.dataset.select):selected.delete(e.target.dataset.select);render();}});
$('content').onclick=async e=>{const b=e.target.closest('button');if(!b)return;try{if(b.dataset.edit)openOrder(b.dataset.edit);if(b.dataset.next)await advance(b.dataset.next);if(b.dataset.checkOp)checkOp(b.dataset.checkOp);if(b.dataset.exportOp)download('nametag-draf.json',S.pending.find(p=>p.operation.opId===b.dataset.exportOp));if(b.dataset.restore)await restore(b.dataset.restore);if(b.dataset.archiveStatus)archiveStatus(b.dataset.archiveStatus);if(b.dataset.reuse){const d=currentData().find(x=>x.id===b.dataset.reuse);openOrder(null,{...C.fields(d),mp:'',resi:'',createdAt:''});}}catch(err){toast(errorMessage(err));}};
$('pagination').onclick=e=>{const b=e.target.closest('[data-paging]');if(b){pageNo+=Number(b.dataset.paging);render();}};
$('clearSelection').onclick=()=>{selected.clear();render();};$('advanceSelected').onclick=async()=>{const rows=filterRows(viewOrders()).filter(o=>selected.has(o.id)&&o.currentStep<7&&!o._action);if(!rows.length)return;if(!confirm('Lanjutkan tahap '+rows.length+' nametag yang dipilih?'))return;await enqueue(rows.map(o=>({kind:'upsert',id:o.id,expectedRevision:o.revision,data:{...C.fields(o),currentStep:o.currentStep+1,isReject:false}})));selected.clear();render();};$('archiveSelected').onclick=async()=>{const rows=filterRows(viewOrders()).filter(o=>selected.has(o.id)&&o.currentStep===7&&!o._action);if(!rows.length){toast('Pilih pesanan tahap Pengiriman terlebih dahulu.');return;}if(!confirm('Arsipkan '+rows.length+' nametag yang dipilih?'))return;await enqueue(rows.map(o=>({kind:'archive',id:o.id,expectedRevision:o.revision})));selected.clear();render();};
$('addBtn').onclick=()=>openOrder();$('batchBtn').onclick=batchModal;$('scanBtn').onclick=scanModal;$('settingsBtn').onclick=authModal;$('connection').onclick=()=>token?sync():authModal();$('refreshBtn').onclick=()=>page==='logs'?loadLogs():sync();$('exportBtn').onclick=()=>download('nametagflow-backup-'+today()+'.json',{version:13,exportedAt:new Date().toISOString(),snapshot:S.snapshot,pending:S.pending,legacy:{orders:JSON.parse(localStorage.getItem('nametag_orders')||'[]'),archives:JSON.parse(localStorage.getItem('nametag_archives')||'[]')}});
window.addEventListener('online',sync);window.addEventListener('offline',()=>updateConnection('Koneksi terputus','warn'));channel?.addEventListener('message',async e=>{if(e.data.endpoint===endpoint&&db){S=await storage();render();}});
(async()=>{try{db=await openDB();S=await storage();render();if(token)sync();else authModal();setInterval(()=>{if(!document.hidden)sync();},20000);}catch(e){$('notice').className='notice error';$('notice').textContent='Penyimpanan perangkat tidak tersedia: '+errorMessage(e)+'. Jangan input pesanan sebelum masalah ini selesai.';}})();

function safeLegacy(key){try{const value=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(value)?value:[];}catch{return [];}}
function exportWorkspace(){download('nametagflow-backup-'+today()+'.json',{version:13,endpoint,exportedAt:new Date().toISOString(),snapshot:S.snapshot,pending:S.pending,legacy:{orders:safeLegacy('nametag_orders'),archives:safeLegacy('nametag_archives')}});}
function dataModal(){
 modal('Backup & pemulihan draf',`<p class="form-help">Backup ini berisi data dan draf perangkat, tanpa kode akses. Simpan sebelum pindah komputer atau membersihkan data browser.</p><div class="form-actions" style="justify-content:flex-start"><button class="btn primary" id="downloadBackup">Unduh backup perangkat</button><button class="btn" id="legacyPreview">Periksa draf web lama</button></div><label class="field" style="margin-top:20px">Baca file backup JSON<input id="backupInput" type="file" accept=".json,application/json"></label><p id="backupError" class="form-error"></p><div id="backupPreview"></div>`);
 $('downloadBackup').onclick=exportWorkspace;
 $('legacyPreview').onclick=()=>previewBackup({orders:safeLegacy('nametag_orders')});
 $('backupInput').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>15*1024*1024)throw new Error('Batas file backup 15 MB.');previewBackup(JSON.parse(await file.text()));}catch(err){$('backupError').textContent=errorMessage(err);}};
}
function previewBackup(backup){
 $('backupError').textContent='';if(!S.snapshot){$('backupError').textContent='Hubungkan ke pusat terlebih dahulu, lalu periksa backup.';return;}
 if(backup.endpoint&&backup.endpoint!==endpoint){$('backupError').textContent='Backup berasal dari alamat backend lain. Hubungkan ke backend asal sebelum memulihkan.';return;}
 const entries=Array.isArray(backup)?backup:backup.orders||backup.legacy?.orders||backup.snapshot?.orders||[];
 const pending=Array.isArray(backup.pending)?backup.pending:[];
 if(pending.length){$('backupPreview').innerHTML=`<div class="card"><h3>${pending.length} perubahan tertunda dalam backup</h3><p>ID pengiriman asli akan dipertahankan. Jika pusat sudah menerima perubahan, pengiriman ulang tidak membuat duplikat.</p><button class="btn primary" id="restorePending">Pulihkan antrean asli</button></div>`;
 $('restorePending').onclick=async()=>{try{const valid=pending.filter(p=>p?.operation&&/^op_[a-zA-Z0-9_-]{8,100}$/.test(p.operation.opId));if(valid.length!==pending.length)throw new Error('Format antrean backup tidak valid.');if(!confirm('Pulihkan '+pending.length+' perubahan ke antrean perangkat ini?'))return;await editState(s=>{const ids=new Set(s.pending.map(p=>p.operation.opId));valid.forEach(p=>{if(!ids.has(p.operation.opId)){s.pending.push({...p,status:p.status==='blocked'?'blocked':'queued'});ids.add(p.operation.opId);}});});modalDirty=false;closeModal();go('queue');sync();}catch(e){$('backupError').textContent=errorMessage(e);}};return;
 }
 if(!Array.isArray(entries)||!entries.length){$('backupPreview').innerHTML='<p class="form-help">Tidak ditemukan draf pesanan aktif dalam sumber ini. Arsip tidak diubah menjadi pesanan aktif secara otomatis.</p>';return;}
 const remote=new Map(S.snapshot.orders.map(o=>[o.id,o])),archived=new Set(S.snapshot.archives.map(o=>o.id)),recycled=new Set(S.snapshot.recycle.map(x=>x.id)),seen=new Set();
 const candidates=entries.filter(o=>{if(!o?.id||!o.name||seen.has(o.id))return false;seen.add(o.id);if(archived.has(o.id)||recycled.has(o.id))return false;const r=remote.get(o.id);return !r||['name','nip','model','hook','logo','mp','resi','sku','notes','currentStep','printCount','isReject'].some(k=>String(o[k]??'')!==String(r[k]??''));});
 $('backupPreview').innerHTML=`<p class="form-help">${candidates.length} draf berbeda atau belum ada di pusat. Pilih hanya draf yang memang ingin dipulihkan. Item yang sudah ada akan meminta pemeriksaan konflik jika berubah lagi.</p>${candidates.slice(0,100).map((o,i)=>`<div class="card"><label><input type="checkbox" class="restore-choice" value="${i}"> <b>${C.esc(o.name)}</b> · ${C.esc(o.mp)}</label><p>${remote.has(o.id)?'Ada di pusat: '+C.esc(remote.get(o.id).name)+' · '+C.esc(remote.get(o.id).notes||'tanpa catatan'):'Belum ada di daftar aktif yang dimuat'}<br>Draf: ${C.esc(o.notes||'tanpa catatan')}</p></div>`).join('')}${candidates.length?'<button class="btn primary" id="restoreChoices">Pulihkan pilihan ke antrean</button>':''}`;
 if($('restoreChoices'))$('restoreChoices').onclick=async()=>{try{const picks=[...document.querySelectorAll('.restore-choice:checked')].map(x=>candidates[Number(x.value)]);if(!picks.length)throw new Error('Pilih minimal satu draf.');if(!confirm('Terapkan '+picks.length+' draf pilihan? Versi lokal dapat mengganti detail pesanan pusat.'))return;await enqueue(picks.map(o=>({kind:'upsert',id:o.id,expectedRevision:remote.get(o.id)?.revision||null,data:{...C.fields(o),createdAt:C.fields(o).createdAt||new Date().toISOString()}})));modalDirty=false;closeModal();go('queue');}catch(e){$('backupError').textContent=errorMessage(e);}};
}
$('exportBtn').textContent='Backup & draf';$('exportBtn').onclick=dataModal;
