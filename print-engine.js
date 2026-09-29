/* NametagFlow print geometry. Units are millimetres; preview and PDF share paths. */
(function(root){
'use strict';
const C=root.NFCore,F=root.NFPrintFont,BUILD='13.4.0',MM=72/25.4;
const DEFAULTS={pageWidth:210,pageHeight:290,tagWidth:80.4,tagHeight:20.4,margin:8,gapX:3,gapY:2,nameHeight:7.5,nameNipHeight:5.4,nipHeight:3.1,shortSpacing:.8,condense:.62,cropMarks:true};
const clone=v=>JSON.parse(JSON.stringify(v)),round=v=>Math.round(v*100000)/100000;
const ranges={pageWidth:[100,1000],pageHeight:[100,1000],tagWidth:[40,150],tagHeight:[16,40],margin:[5,50],gapX:[0,20],gapY:[0,20],nameHeight:[2,12],nameNipHeight:[2,9],nipHeight:[1.5,5],shortSpacing:[0,2],condense:[.4,1]};
function settings(input={}){const s={...DEFAULTS,...input};for(const [key,[min,max]] of Object.entries(ranges)){s[key]=Number(s[key]);if(!Number.isFinite(s[key])||s[key]<min||s[key]>max)throw new Error('Ukuran '+key+' harus '+min+'–'+max+' mm (proporsi: 0,4–1).');}s.cropMarks=!!s.cropMarks;grid(s);return s;}
function grid(s){const cols=Math.floor((s.pageWidth-2*s.margin+s.gapX+1e-8)/(s.tagWidth+s.gapX)),rows=Math.floor((s.pageHeight-2*s.margin+s.gapY+1e-8)/(s.tagHeight+s.gapY));if(cols<1||rows<1)throw new Error('Nametag tidak muat. Periksa ukuran kertas, margin, dan jarak.');return{cols,rows,capacity:cols*rows,left:(s.pageWidth-(cols*s.tagWidth+(cols-1)*s.gapX))/2,top:s.margin};}
function logoKey(o){return C.key(o.logo)||'MODEL_'+C.modelNumber(o.model);}
function signature(o){return JSON.stringify(['name','nip','model','logo','notes','mp'].map(k=>C.text(o[k])));}
function printableText(value){return C.text(value).normalize('NFC');}
function fitText(value,box,height,spacing=0,condense=.62){
 const str=printableText(value),chars=Array.from(str),glyphs=chars.map(c=>{const g=F.glyphs[c];if(!g)throw new Error('Karakter “'+c+'” belum didukung font cetak. Periksa isian sebelum mencetak.');return g;});
 if(!chars.length)return{paths:[],width:0,compression:1,spacing:0,text:str};
 const drawn=glyphs.filter(g=>g.d),minY=Math.min(0,...drawn.map(g=>g.b[1])),maxY=Math.max(0,...drawn.map(g=>g.b[3])),sy=Math.min(height,box.h/Math.max(.01,maxY-minY));
 let advance=0,minX=Infinity,maxX=-Infinity;const positions=[];
 glyphs.forEach((g,i)=>{positions.push(advance);if(g.d){minX=Math.min(minX,advance+g.b[0]*sy*condense);maxX=Math.max(maxX,advance+g.b[2]*sy*condense);}advance+=g.a*sy*condense+(i<chars.length-1?spacing:0);});
 if(!Number.isFinite(minX))return{paths:[],width:0,compression:1,spacing,text:str};
 const natural=maxX-minX,compression=Math.min(1,box.w/Math.max(.001,natural)),width=natural*compression,baseX=box.x+(box.w-width)/2-minX*compression,baseY=box.y+(box.h-(maxY-minY)*sy)/2-minY*sy;
 return{paths:glyphs.map((g,i)=>({d:g.d,x:baseX+positions[i]*compression,y:baseY,sx:sy*condense*compression,sy})).filter(g=>g.d),width,compression,spacing:spacing*compression,text:str};
}
function artwork(order,input=DEFAULTS,assets={},preview=false){
 const s=settings(input),m=C.modelLayout(order.model);if(!m)throw new Error('Pilih model 1–10 untuk '+(order.name||'nametag')+'.');
 if(!C.text(order.name))throw new Error('Nama nametag belum diisi.');
 const w=s.tagWidth,h=s.tagHeight,inset=m.border?2.075:0,b={x:inset,y:inset,w:w-2*inset,h:h-2*inset},shapes=[],warnings=[];
 if(m.border)shapes.push({type:'rect',x:.12,y:.12,w:w-.24,h:h-.24,fill:'#ffffff',stroke:'#000000',line:.24});
 shapes.push({type:'rect',...b,fill:'#000000'});
 const pad=m.border?1.3:2.4,logoW=15.5,textLeft=m.logo?b.x+logoW+2:b.x+pad,right=b.x+b.w-pad,available=right-textLeft,maxName=m.logo?55:73,nameW=Math.min(available,maxName),textX=textLeft+(available-nameW)/2;
 if(available<12)throw new Error('Area nama terlalu sempit untuk model berlogo.');
 if(m.logo){const key=logoKey(order),asset=assets[key],rect={x:b.x+1.6,y:b.y+1.1,w:logoW-2.8,h:b.h-2.2};
  if(asset?.data){if(!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(asset.data)||!Number.isFinite(asset.width)||!Number.isFinite(asset.height)||asset.width<=0||asset.height<=0)throw new Error('File logo tidak valid. Unggah ulang PNG/JPG.');const scale=Math.min(rect.w/asset.width,rect.h/asset.height);shapes.push({type:'image',key,data:asset.data,x:rect.x+(rect.w-asset.width*scale)/2,y:rect.y+(rect.h-asset.height*scale)/2,w:asset.width*scale,h:asset.height*scale});}
  else if(asset?.omit){warnings.push('Area logo sengaja dikosongkan.');}
  else if(preview){shapes.push({type:'rect',...rect,fill:'#233e50',stroke:'#aac5d6',line:.15});const t=fitText('LOGO',rect,2.1,0,.8);shapes.push(...t.paths.map(p=>({type:'path',...p,fill:'#ffffff'})));warnings.push('Unggah logo atau pilih area logo kosong.');}
  else throw new Error('Logo '+(C.text(order.logo)||'Model '+m.number)+' belum diunggah.');
  if(m.divider)shapes.push({type:'line',x:b.x+logoW+1,y:b.y,x2:b.x+logoW+1,y2:b.y+b.h,line:.32,stroke:'#ffffff'});
 }
 const letters=Array.from(printableText(order.name)).filter(c=>/\p{L}/u.test(c)).length,tracking=letters>0&&letters<8?s.shortSpacing:0,lineY=b.y+b.h*.58;
 const nameBox={x:textX,y:b.y+.85,w:nameW,h:m.nip?lineY-b.y-1.65:b.h-1.7};
 const name=fitText(order.name,nameBox,m.nip?s.nameNipHeight:s.nameHeight,tracking,s.condense);
 shapes.push(...name.paths.map(p=>({type:'path',...p,fill:'#ffffff'})));
 if(name.compression<.55)warnings.push('Nama sangat panjang; periksa keterbacaan.');
 if(m.nip){shapes.push({type:'line',x:textLeft,y:lineY,x2:right,y2:lineY,line:.3,stroke:'#ffffff'});let raw=printableText(order.nip);if(/^\d[\d .-]*$/.test(raw))raw='NIP. '+raw;
  const nip=fitText(raw,{x:textLeft,y:lineY+.85,w:available,h:b.y+b.h-lineY-1.55},s.nipHeight,0,s.condense);
  shapes.push(...nip.paths.map(p=>({type:'path',...p,fill:'#ffffff'})));if(!raw)warnings.push('Baris NIP / jabatan kosong.');if(nip.compression<.55)warnings.push('NIP / jabatan sangat panjang; periksa keterbacaan.');
 }else if(C.text(order.nip))warnings.push('Model ini tidak menampilkan NIP / jabatan.');
 if(C.text(order.notes))warnings.push('Catatan custom: '+order.notes);
 return{width:w,height:h,shapes,warnings,nameWidth:name.width,nameCompression:name.compression,nameSpacing:name.spacing,model:m};
}
function svgShapes(shapes){return shapes.map(p=>{
 if(p.type==='rect')return`<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="${p.fill}"${p.stroke?` stroke="${p.stroke}" stroke-width="${p.line}"`:''}/>`;
 if(p.type==='line')return`<path d="M${p.x},${p.y}L${p.x2},${p.y2}" fill="none" stroke="${p.stroke}" stroke-width="${p.line}"/>`;
 if(p.type==='image')return`<image href="${p.data}" xlink:href="${p.data}" x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}"/>`;
 return`<path d="${p.d}" fill="${p.fill}" transform="translate(${round(p.x)} ${round(p.y)}) scale(${round(p.sx)} ${round(p.sy)})"/>`;
 }).join('');}
function tagSvg(o,s,assets={},preview=true){const a=artwork(o,s,assets,preview);return`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${a.width} ${a.height}" role="img" aria-label="${C.esc(o.name)}" class="print-tag"><title>${C.esc(o.name)}</title>${svgShapes(a.shapes)}</svg>`;}
function plan(orders,input,assets={},preview=false){
 const s=settings(input),g=grid(s);if(!Array.isArray(orders)||!orders.length)throw new Error('Pilih minimal satu nametag.');if(orders.length>1000)throw new Error('Maksimal 1.000 nametag per lembar kerja cetak.');
 const pages=[];orders.forEach((o,i)=>{const pi=Math.floor(i/g.capacity),slot=i%g.capacity;pages[pi]??=[];pages[pi].push({index:i,order:o,x:g.left+(slot%g.cols)*(s.tagWidth+s.gapX),y:g.top+Math.floor(slot/g.cols)*(s.tagHeight+s.gapY),art:artwork(o,s,assets,preview)});});return{settings:s,grid:g,pages};
}
function crops(x,y,w,h){const gap=.4,len=1;return[[x-gap-len,y,x-gap,y],[x,y-gap-len,x,y-gap],[x+w+gap,y,x+w+gap+len,y],[x+w,y-gap-len,x+w,y-gap],[x-gap-len,y+h,x-gap,y+h],[x,y+h+gap,x,y+h+gap+len],[x+w+gap,y+h,x+w+gap+len,y+h],[x+w,y+h+gap,x+w,y+h+gap+len]];}
function sheetSvg(layout,pageIndex=0){const s=layout.settings,items=layout.pages[pageIndex];return`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${s.pageWidth} ${s.pageHeight}" class="print-sheet" role="img" aria-label="Lembar ${pageIndex+1}"><rect width="${s.pageWidth}" height="${s.pageHeight}" fill="white"/>${items.map(v=>`<g transform="translate(${v.x} ${v.y})">${svgShapes(v.art.shapes)}</g>${s.cropMarks?crops(v.x,v.y,s.tagWidth,s.tagHeight).map(([x,y,x2,y2])=>`<path d="M${x},${y}L${x2},${y2}" stroke="#666" stroke-width=".1"/>`).join(''):''}`).join('')}</svg>`;}
async function pdf(job){
 const lib=root.PDFLib;if(!lib)throw new Error('Mesin PDF belum termuat. Muat ulang halaman.');const layout=plan(job.orders,job.settings,job.assets),doc=await lib.PDFDocument.create();
 doc.setTitle('NametagFlow '+job.id);doc.setSubject('Cetak ukuran asli 100%. '+layout.settings.tagWidth+' x '+layout.settings.tagHeight+' mm.');doc.setCreator('NametagFlow '+BUILD);doc.setCreationDate(new Date(job.createdAt));doc.setModificationDate(new Date(job.createdAt));
 const color=hex=>lib.rgb(parseInt(hex.slice(1,3),16)/255,parseInt(hex.slice(3,5),16)/255,parseInt(hex.slice(5,7),16)/255),images=new Map();
 for(const items of layout.pages){const s=layout.settings,page=doc.addPage([s.pageWidth*MM,s.pageHeight*MM]);
  for(const item of items){for(const p of item.art.shapes){const x=(item.x+p.x)*MM,y=(s.pageHeight-item.y-p.y)*MM;
   if(p.type==='rect')page.drawRectangle({x,y:y-p.h*MM,width:p.w*MM,height:p.h*MM,color:color(p.fill),...(p.stroke?{borderColor:color(p.stroke),borderWidth:p.line*MM}:{})});
   else if(p.type==='line')page.drawLine({start:{x,y},end:{x:(item.x+p.x2)*MM,y:(s.pageHeight-item.y-p.y2)*MM},thickness:p.line*MM,color:color(p.stroke)});
   else if(p.type==='image'){if(!images.has(p.data))images.set(p.data,p.data.startsWith('data:image/png')?await doc.embedPng(p.data):await doc.embedJpg(p.data));page.drawImage(images.get(p.data),{x,y:y-p.h*MM,width:p.w*MM,height:p.h*MM});}
   else{page.pushOperators(lib.pushGraphicsState(),lib.concatTransformationMatrix(p.sx*MM,0,0,p.sy*MM,x,y));page.drawSvgPath(p.d,{x:0,y:0,scale:1,color:color(p.fill)});page.pushOperators(lib.popGraphicsState());}
  }
  if(s.cropMarks)for(const [x,y,x2,y2] of crops(item.x,item.y,s.tagWidth,s.tagHeight))page.drawLine({start:{x:x*MM,y:(s.pageHeight-y)*MM},end:{x:x2*MM,y:(s.pageHeight-y2)*MM},color:lib.grayscale(.45),thickness:.1*MM});
  }
 }
 return doc.save();
}
function createJob(orders,input,assets={},operator=''){
 if(new Set(orders.map(o=>o.id)).size!==orders.length||orders.some(o=>!C.text(o.id)))throw new Error('ID nametag harus unik dan terisi. Nama yang sama tetap boleh memakai ID berbeda.');
 const used={};for(const o of orders)if(C.modelLayout(o.model)?.logo&&assets[logoKey(o)])used[logoKey(o)]=clone(assets[logoKey(o)]);
 const job={version:1,engine:BUILD,id:C.uid('CT-'),createdAt:new Date().toISOString(),operator,orders:orders.map(o=>({id:o.id,revision:o.revision,...C.fields(o)})),settings:settings(input),assets:used};plan(job.orders,job.settings,job.assets);return job;
}
function finishJob(state,id,operator){
 const job=(state.printJobs||[]).find(j=>j.id===id);if(!job)throw new Error('Lembar cetak tidak ditemukan.');if(job.finishSubmittedAt)return job;
 if(!job.downloadedAt)throw new Error('Unduh dan cetak PDF terlebih dahulu.');
 const current=new Map((state.snapshot?.orders||[]).map(o=>[o.id,o])),ops=[];
 for(const printed of job.orders){const live=current.get(printed.id);if(!live)throw new Error(printed.name+' tidak ada di antrean aktif. Periksa data pusat.');
  if(state.pending.some(p=>p.operation.id===printed.id))throw new Error('Tunggu antrean simpan '+printed.name+' selesai sebelum konfirmasi cetak.');
  if(signature(live)!==signature(printed))throw new Error('Detail '+printed.name+' berubah sejak PDF dibuat. Buat lembar cetak baru dari data terbaru.');
  if(Number(live.currentStep)===1)ops.push({kind:'upsert',id:live.id,expectedRevision:live.revision,data:{...C.fields(live),currentStep:2}});
 }
 C.queueOperations(state,ops,operator);job.moves=ops.map(op=>({id:op.id,opId:state.pending.find(p=>p.operation.id===op.id).operation.opId,confirmed:false}));job.finishSubmittedAt=new Date().toISOString();job.finishedBy=operator;
 state.printReceipts??={};for(const move of job.moves)state.printReceipts[move.opId]={jobId:job.id,confirmed:false};
 if(!ops.length)job.completedAt=job.finishSubmittedAt;return job;
}
function acknowledge(state,op,result){if(state.printReceipts?.[op.opId]&&result?.committed)state.printReceipts[op.opId]={...state.printReceipts[op.opId],confirmed:true,confirmedAt:new Date().toISOString()};}
function jobStatus(j,state){if(j.completedAt)return 'Cetak dikonfirmasi';if(j.finishSubmittedAt){const left=(j.moves||[]).filter(m=>!m.confirmed&&!state.printReceipts?.[m.opId]?.confirmed);if(!left.length)return 'Cetak dikonfirmasi';return left.some(m=>!state.pending.some(p=>p.operation.opId===m.opId&&p.status!=='blocked'))?'Periksa perpindahan di antrean simpan':'Cetak dikonfirmasi · menunggu '+left.length+' penyimpanan';}return j.downloadedAt?'PDF diunduh · belum dikonfirmasi cetak':'Siap diunduh';}
root.NFPrint={BUILD,DEFAULTS,settings,grid,logoKey,signature,fitText,artwork,tagSvg,plan,sheetSvg,pdf,createJob,finishJob,acknowledge,jobStatus};
if(typeof module!=='undefined')module.exports=root.NFPrint;
})(globalThis);
