/* NametagFlow print geometry. Units are millimetres; preview and PDF share paths. */
(function(root){
'use strict';
const C=root.NFCore,F=root.NFPrintFont,BUILD='13.8.3',MM=72/25.4;
const LEGACY_DEFAULTS={pageWidth:210,pageHeight:290,tagWidth:80.4,tagHeight:20.4,margin:8,gapX:3,gapY:2,nameHeight:7.5,nameNipHeight:5.4,nipHeight:3.1,shortSpacing:.8,condense:.62,cropMarks:true,layoutMode:'grid',designVersion:'13.6'};
const V13_7_DEFAULTS={pageWidth:210,pageHeight:290,tagWidth:80.4,tagHeight:20.4,margin:11.85,gapX:.85,gapY:.25,nameHeight:7.5,nameNipHeight:5.4,nipHeight:3.1,shortSpacing:2.4,condense:.86,cropMarks:false,layoutMode:'corel29',designVersion:'13.7'};
const DEFAULTS={pageWidth:210,pageHeight:290,tagWidth:80.4,tagHeight:20.4,margin:11.85,gapX:.85,gapY:.25,nameHeight:6.771,nameNipHeight:5.294,nipHeight:3.290,shortSpacing:2.734,condense:1,cropMarks:false,layoutMode:'corel29',designVersion:'13.8.2'};
const clone=v=>JSON.parse(JSON.stringify(v)),round=v=>Math.round(v*100000)/100000;
const ranges={pageWidth:[100,1000],pageHeight:[100,1000],tagWidth:[40,150],tagHeight:[16,40],margin:[0,50],gapX:[0,20],gapY:[0,20],nameHeight:[2,12],nameNipHeight:[2,9],nipHeight:[1.5,5],shortSpacing:[0,4],condense:[.4,1.2]};
function engineProfile(engine=BUILD){const v=String(engine||BUILD).split('.').map(Number),major=v[0]||0,minor=v[1]||0;if(major<13||(major===13&&minor<7))return 'legacy';if(major===13&&minor<8)return 'v13_7';return 'current';}
function legacyEngine(engine){return engineProfile(engine)==='legacy';}
function settings(input={},engine=BUILD){const profile=engineProfile(engine),base=profile==='legacy'?LEGACY_DEFAULTS:profile==='v13_7'?V13_7_DEFAULTS:DEFAULTS,s={...base,...input};s.layoutMode=profile==='legacy'?'grid':(s.layoutMode==='grid'?'grid':'corel29');s.designVersion=base.designVersion;for(const [key,[min,max]] of Object.entries(ranges)){s[key]=Number(s[key]);if(!Number.isFinite(s[key])||s[key]<min||s[key]>max)throw new Error('Ukuran '+key+' harus '+min+'–'+max+(key==='condense'?'':' mm')+'.');}s.cropMarks=!!s.cropMarks;grid(s);return s;}
function currentSettings(input={}){if(!input||!Object.keys(input).length)return settings(DEFAULTS);const migrated={...input,designVersion:DEFAULTS.designVersion},oldDesign=input.designVersion!==DEFAULTS.designVersion;for(const key of Object.keys(DEFAULTS)){if(key==='designVersion')continue;const value=input[key];if(value===undefined)continue;if(oldDesign&&(value===V13_7_DEFAULTS[key]||value===LEGACY_DEFAULTS[key]))migrated[key]=DEFAULTS[key];}/* Typography is reference-locked for new jobs: stale/custom values from older builds must not make names look larger than the Corel source. */if(oldDesign)Object.assign(migrated,{nameHeight:DEFAULTS.nameHeight,nameNipHeight:DEFAULTS.nameNipHeight,nipHeight:DEFAULTS.nipHeight,shortSpacing:DEFAULTS.shortSpacing,condense:DEFAULTS.condense});if(!Object.prototype.hasOwnProperty.call(input,'layoutMode'))Object.assign(migrated,{layoutMode:DEFAULTS.layoutMode,margin:DEFAULTS.margin,gapX:DEFAULTS.gapX,gapY:DEFAULTS.gapY});return settings(migrated);}
function grid(s){if(s.layoutMode==='corel29'){const cols=2,rows=Math.floor((s.pageHeight-s.margin+s.gapY+1e-8)/(s.tagHeight+s.gapY)),mainWidth=cols*s.tagWidth+s.gapX,center=(s.pageWidth-mainWidth)/2,shift=Math.max(0,s.tagHeight/2-.2),left=center+shift,sideLeft=left-s.tagHeight-.4,sideTop=s.margin+26.55,sideGap=.18,sideCount=sideLeft>=0?Math.max(0,Math.floor((s.pageHeight-sideTop+sideGap+1e-8)/(s.tagWidth+sideGap))):0;if(rows<1||left<0||left+mainWidth>s.pageWidth)throw new Error('Nametag tidak muat pada layout Corel. Periksa ukuran kertas dan nametag.');return{mode:'corel29',cols,rows,capacity:cols*rows+sideCount,left,top:s.margin,sideLeft,sideTop,sideGap,sideCount};}const cols=Math.floor((s.pageWidth-2*s.margin+s.gapX+1e-8)/(s.tagWidth+s.gapX)),rows=Math.floor((s.pageHeight-2*s.margin+s.gapY+1e-8)/(s.tagHeight+s.gapY));if(cols<1||rows<1)throw new Error('Nametag tidak muat. Periksa ukuran kertas, margin, dan jarak.');return{mode:'grid',cols,rows,capacity:cols*rows,left:(s.pageWidth-(cols*s.tagWidth+(cols-1)*s.gapX))/2,top:s.margin,sideCount:0};}
function logoKey(o){const name=C.text(o.logo).normalize('NFC').toUpperCase().replace(/\s+/g,' ');return name?'LOGO:'+name:'ORDER:'+o.id;}
function jobAssets(job){
 const assets={...(job.assets||{})},version=String(job.engine||'13.4').split('.');
 if(Number(version[0])===13&&Number(version[1])<6)for(const o of job.orders||[]){const key=logoKey(o),legacy=C.key(o.logo)||'MODEL_'+C.modelNumber(o.model);if(!assets[key]&&assets[legacy])assets[key]=assets[legacy];}
 return assets;
}
function logoImageInfo(asset){
 const match=typeof asset?.data==='string'&&asset.data.match(/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/);
 if(!match||asset.data.length>12*1024*1024)throw new Error('File logo tidak valid. Unggah ulang PNG/JPG.');
 let bytes;try{bytes=Uint8Array.from(atob(match[2]),c=>c.charCodeAt(0));}catch(e){throw new Error('Data logo rusak. Unggah ulang PNG/JPG.');}
 let width=0,height=0;
 if(match[1]==='png'){
  if(bytes.length>=33&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)&&String.fromCharCode(...bytes.slice(12,16))==='IHDR'){
   const view=new DataView(bytes.buffer);width=view.getUint32(16);height=view.getUint32(20);
  }
 }else if(bytes[0]===255&&bytes[1]===216){
  for(let i=2;i+3<bytes.length;){if(bytes[i++]!==255)break;while(bytes[i]===255)i++;const marker=bytes[i++];if(marker===217||marker===218)break;if(marker===1||marker>=208&&marker<=215)continue;
   const size=bytes[i]*256+bytes[i+1];if(size<2||i+size>bytes.length)break;
   if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)&&size>=8){height=bytes[i+3]*256+bytes[i+4];width=bytes[i+5]*256+bytes[i+6];break;}i+=size;
  }
 }
 if(!width||!height||width*height>40000000||asset.width!==width||asset.height!==height)throw new Error('Ukuran atau isi logo tidak sesuai. Unggah ulang gambar asli.');
 return{width,height};
}
function checkLogoPixels(pixels){
 let visible=false,contrast=false;for(let i=0;i<pixels.length;i+=4){const alpha=pixels[i+3]/255;if(alpha>.03)visible=true;if(Math.max(pixels[i],pixels[i+1],pixels[i+2])*alpha>12)contrast=true;}
 if(!visible)throw new Error('Logo seluruhnya transparan. Pilih gambar yang terlihat.');
 if(!contrast)throw new Error('Logo terlalu gelap pada latar hitam. Gunakan logo putih/berwarna atau berlatar terang.');
}
function signature(o){return JSON.stringify([...['name','nip','model','logo','notes','mp'].map(k=>C.text(o[k])),Number(o.printCount)||1,C.text(o.printCycleId)]);}
function sameCycle(a,b){return (Number(a.printCount)||1)===(Number(b.printCount)||1)&&C.text(a.printCycleId)===C.text(b.printCycleId);}
function printableText(value){return C.text(value).normalize('NFC');}
function fontFor(engine=BUILD){const profile=engineProfile(engine);return profile==='legacy'&&F.legacy?F.legacy:profile==='v13_7'&&F.v13_7?F.v13_7:F;}
function fitText(value,box,height,spacing=0,condense=.86,font=F){
 const str=printableText(value),chars=Array.from(str),glyphs=chars.map(c=>{const g=font.glyphs[c];if(!g)throw new Error('Karakter “'+c+'” belum didukung font cetak. Periksa isian sebelum mencetak.');return g;});
 if(!chars.length)return{paths:[],width:0,compression:1,spacing:0,text:str};
 const drawn=glyphs.filter(g=>g.d),minY=Math.min(0,...drawn.map(g=>g.b[1])),maxY=Math.max(0,...drawn.map(g=>g.b[3])),sy=Math.min(height,box.h/Math.max(.01,maxY-minY));
 let advance=0,minX=Infinity,maxX=-Infinity;const positions=[];
 glyphs.forEach((g,i)=>{positions.push(advance);if(g.d){minX=Math.min(minX,advance+g.b[0]*sy*condense);maxX=Math.max(maxX,advance+g.b[2]*sy*condense);}advance+=g.a*sy*condense+(i<chars.length-1?spacing:0);});
 if(!Number.isFinite(minX))return{paths:[],width:0,compression:1,spacing,text:str};
 const natural=maxX-minX,compression=Math.min(1,box.w/Math.max(.001,natural)),width=natural*compression,baseX=box.x+(box.w-width)/2-minX*compression,baseY=box.y+(box.h-(maxY-minY)*sy)/2-minY*sy;
 return{paths:glyphs.map((g,i)=>({d:g.d,x:baseX+positions[i]*compression,y:baseY,sx:sy*condense*compression,sy})).filter(g=>g.d),width,compression,spacing:spacing*compression,text:str};
}
function artwork(order,input=DEFAULTS,assets={},preview=false,engine=BUILD){
 const profile=engineProfile(engine),legacy=profile==='legacy',v137=profile==='v13_7',s=settings(input,engine),font=fontFor(engine),m=C.modelLayout(order.model);if(!m)throw new Error('Pilih model 1–10 untuk '+(order.name||'nametag')+'.');
 if(!C.text(order.name))throw new Error('Nama nametag belum diisi.');
 C.validateIdentifiers(order);
 const w=s.tagWidth,h=s.tagHeight,inset=m.border?2.075:0,b={x:inset,y:inset,w:w-2*inset,h:h-2*inset},shapes=[],warnings=[];
 if(m.border){if(legacy)shapes.push({type:'rect',x:.12,y:.12,w:w-.24,h:h-.24,fill:'#ffffff',stroke:'#000000',line:.24});else if(v137)shapes.push({type:'rect',x:.15,y:.15,w:w-.3,h:h-.3,fill:'#ffffff',stroke:'#000000',line:.35});else shapes.push({type:'rect',x:.05,y:.05,w:w-.1,h:h-.1,fill:'#ffffff',stroke:'#000000',line:.1});}
 shapes.push(profile==='current'&&m.border?{type:'rect',...b,fill:'#000000',stroke:'#000000',line:.2}:{type:'rect',...b,fill:'#000000'});
 const pad=m.border?1.3:2.4,logoW=15.5,textLeft=m.logo?b.x+logoW+2:b.x+pad,right=b.x+b.w-pad,available=right-textLeft,maxName=m.logo?55:73,nameW=Math.min(available,maxName),textX=textLeft+(available-nameW)/2;
 if(available<12)throw new Error('Area nama terlalu sempit untuk model berlogo.');
 if(m.logo){const key=logoKey(order),asset=assets[key];let rect;
  if(legacy)rect={x:b.x+1.6,y:b.y+1.1,w:logoW-2.8,h:b.h-2.2};
  else{const maxW=m.divider?11.2:12.4,maxH=Math.min(b.h-2.8,m.divider?14.2:13.2);rect={x:b.x+1.8,y:b.y+(b.h-maxH)/2,w:maxW,h:maxH};}
  if(asset?.data){const info=logoImageInfo(asset),scale=Math.min(rect.w/info.width,rect.h/info.height),dpi=25.4/scale;
   if(dpi<150&&!preview)throw new Error('Resolusi logo '+(C.text(order.logo)||order.name)+' hanya '+Math.round(dpi)+' dpi. Gunakan gambar lebih besar (minimal 150 dpi, disarankan 300 dpi).');
   if(dpi<300)warnings.push('Resolusi logo '+Math.round(dpi)+' dpi; disarankan minimal 300 dpi pada ukuran cetak.');
   shapes.push({type:'image',key,data:asset.data,x:rect.x+(rect.w-info.width*scale)/2,y:rect.y+(rect.h-info.height*scale)/2,w:info.width*scale,h:info.height*scale});}
  else if(asset?.omit){warnings.push('Area logo sengaja dikosongkan.');}
  else if(preview){shapes.push({type:'rect',...rect,fill:'#233e50',stroke:'#aac5d6',line:.15});const t=fitText('LOGO',rect,2.1,0,legacy ? .8 : .9,font);shapes.push(...t.paths.map(p=>({type:'path',...p,fill:'#ffffff'})));warnings.push('Unggah logo atau pilih area logo kosong.');}
  else throw new Error('Logo '+(C.text(order.logo)||'Model '+m.number)+' belum diunggah.');
  if(m.divider)shapes.push({type:'line',x:b.x+logoW+1,y:b.y,x2:b.x+logoW+1,y2:b.y+b.h,line:legacy ? .32 : .75,stroke:'#ffffff'});
 }
 const rawName=printableText(order.name),letters=Array.from(rawName).filter(c=>/\p{L}/u.test(c)).length,tracking=letters>0&&letters<8&&(profile!=='current'||!/(?:\s)/u.test(rawName.trim()))?s.shortSpacing:0,lineY=b.y+b.h*(profile==='current'?.56:.58);
 const nameBox={x:textX,y:b.y+.85,w:nameW,h:m.nip?lineY-b.y-1.65:b.h-1.7},nameFont=profile==='current'&&m.nip&&F.swis?F.swis:font,nameCondense=s.condense*(profile==='current'&&m.nip?.8:1);
 const name=fitText(order.name,nameBox,m.nip?s.nameNipHeight:s.nameHeight,tracking,nameCondense,nameFont);
 shapes.push(...name.paths.map(p=>({type:'path',...p,fill:'#ffffff'})));
 if(name.compression<.55)warnings.push('Nama sangat panjang; periksa keterbacaan.');
 if(m.nip){shapes.push({type:'line',x:textLeft,y:lineY,x2:right,y2:lineY,line:legacy ? .3 : .75,stroke:'#ffffff'});let raw=printableText(order.nip);if(/^\d[\d .-]*$/.test(raw))raw='NIP. '+raw;
  const nipFont=profile==='current'&&F.swis?F.swis:font,nipCondense=s.condense*(profile==='current'?.8:1),nip=fitText(raw,{x:textLeft,y:lineY+.85,w:available,h:b.y+b.h-lineY-1.55},s.nipHeight,0,nipCondense,nipFont);
  shapes.push(...nip.paths.map(p=>({type:'path',...p,fill:'#ffffff'})));if(!raw)warnings.push('Baris NIP / jabatan kosong.');if(nip.compression<.55)warnings.push('NIP / jabatan sangat panjang; periksa keterbacaan.');
 }else if(C.text(order.nip))warnings.push('Model ini tidak menampilkan NIP / jabatan.');
 if(C.text(order.notes))warnings.push('Catatan custom: '+order.notes);
 return{width:w,height:h,shapes,warnings,nameWidth:name.width,nameCompression:name.compression,nameSpacing:name.spacing,model:m,font:nameFont.name,nipFont:m.nip?(profile==='current'&&F.swis?F.swis.name:font.name):''};
}
function svgShapes(shapes){return shapes.map(p=>{
 if(p.type==='rect')return`<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="${p.fill}"${p.stroke?` stroke="${p.stroke}" stroke-width="${p.line}"`:''}/>`;
 if(p.type==='line')return`<path d="M${p.x},${p.y}L${p.x2},${p.y2}" fill="none" stroke="${p.stroke}" stroke-width="${p.line}"/>`;
 if(p.type==='image')return`<image href="${p.data}" xlink:href="${p.data}" x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}"/>`;
 return`<path d="${p.d}" fill="${p.fill}" transform="translate(${round(p.x)} ${round(p.y)}) scale(${round(p.sx)} ${round(p.sy)})"/>`;
 }).join('');}
function tagSvg(o,s,assets={},preview=true,engine=BUILD){const a=artwork(o,s,assets,preview,engine);return`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${a.width} ${a.height}" role="img" aria-label="${C.esc(o.name)}" class="print-tag"><title>${C.esc(o.name)}</title>${svgShapes(a.shapes)}</svg>`;}
function plan(orders,input,assets={},preview=false,engine=BUILD){
 const s=settings(input,engine),g=grid(s);if(!Array.isArray(orders)||!orders.length)throw new Error('Pilih minimal satu nametag.');if(orders.length>1000)throw new Error('Maksimal 1.000 nametag per lembar kerja cetak.');
 const pages=[],mainCount=g.cols*g.rows;orders.forEach((o,i)=>{const pi=Math.floor(i/g.capacity),slot=i%g.capacity;pages[pi]??=[];let x,y,rotation=0;if(g.mode==='corel29'&&slot>=mainCount){const side=slot-mainCount;x=g.sideLeft;y=g.sideTop+side*(s.tagWidth+g.sideGap);rotation=90;}else{x=g.left+(slot%g.cols)*(s.tagWidth+s.gapX);y=g.top+Math.floor(slot/g.cols)*(s.tagHeight+s.gapY);}pages[pi].push({index:i,order:o,x,y,rotation,art:artwork(o,s,assets,preview,engine)});});return{settings:s,grid:g,pages,engine};
}
function crops(x,y,w,h){const gap=.4,len=1;return[[x-gap-len,y,x-gap,y],[x,y-gap-len,x,y-gap],[x+w+gap,y,x+w+gap+len,y],[x+w,y-gap-len,x+w,y-gap],[x-gap-len,y+h,x-gap,y+h],[x,y+h+gap,x,y+h+gap+len],[x+w+gap,y+h,x+w+gap+len,y+h],[x+w,y+h+gap,x+w,y+h+gap+len]];}
function sheetSvg(layout,pageIndex=0){const s=layout.settings,items=layout.pages[pageIndex];return`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${s.pageWidth} ${s.pageHeight}" class="print-sheet" role="img" aria-label="Lembar ${pageIndex+1}"><rect width="${s.pageWidth}" height="${s.pageHeight}" fill="white"/>${items.map(v=>{const group=v.rotation===90?`<g transform="matrix(0 1 -1 0 ${v.x+s.tagHeight} ${v.y})">${svgShapes(v.art.shapes)}</g>`:`<g transform="translate(${v.x} ${v.y})">${svgShapes(v.art.shapes)}</g>`,cw=v.rotation===90?s.tagHeight:s.tagWidth,ch=v.rotation===90?s.tagWidth:s.tagHeight;return group+(s.cropMarks?crops(v.x,v.y,cw,ch).map(([x,y,x2,y2])=>`<path d="M${x},${y}L${x2},${y2}" stroke="#666" stroke-width=".1"/>`).join(''):'');}).join('')}</svg>`;}
async function pdf(job){
 const lib=root.PDFLib;if(!lib)throw new Error('Mesin PDF belum termuat. Muat ulang halaman.');const layout=plan(job.orders,job.settings,jobAssets(job),false,job.engine||BUILD),doc=await lib.PDFDocument.create();
 doc.setTitle('NametagFlow '+job.id);doc.setSubject('Cetak ukuran asli 100%. '+layout.settings.tagWidth+' x '+layout.settings.tagHeight+' mm. Layout '+layout.settings.layoutMode+'.');doc.setCreator('NametagFlow '+(job.engine||BUILD));doc.setCreationDate(new Date(job.createdAt));doc.setModificationDate(new Date(job.createdAt));
 const color=hex=>hex==='#000000'?lib.grayscale(0):hex==='#ffffff'?lib.grayscale(1):lib.rgb(parseInt(hex.slice(1,3),16)/255,parseInt(hex.slice(3,5),16)/255,parseInt(hex.slice(5,7),16)/255),images=new Map();
 for(const items of layout.pages){const s=layout.settings,page=doc.addPage([s.pageWidth*MM,s.pageHeight*MM]),point=(item,x,y)=>item.rotation===90?{x:(item.x+s.tagHeight-y)*MM,y:(s.pageHeight-item.y-x)*MM}:{x:(item.x+x)*MM,y:(s.pageHeight-item.y-y)*MM};
  for(const item of items){for(const p of item.art.shapes){
   if(p.type==='rect'){if(item.rotation===90){const x=(item.x+s.tagHeight-p.y-p.h)*MM,y=(s.pageHeight-item.y-p.x-p.w)*MM;page.drawRectangle({x,y,width:p.h*MM,height:p.w*MM,color:color(p.fill),...(p.stroke?{borderColor:color(p.stroke),borderWidth:p.line*MM}:{})});}else{const x=(item.x+p.x)*MM,y=(s.pageHeight-item.y-p.y)*MM;page.drawRectangle({x,y:y-p.h*MM,width:p.w*MM,height:p.h*MM,color:color(p.fill),...(p.stroke?{borderColor:color(p.stroke),borderWidth:p.line*MM}:{})});}}
   else if(p.type==='line'){const a=point(item,p.x,p.y),b=point(item,p.x2,p.y2);page.drawLine({start:a,end:b,thickness:p.line*MM,color:color(p.stroke)});}
   else if(p.type==='image'){if(!images.has(p.data))images.set(p.data,p.data.startsWith('data:image/png')?await doc.embedPng(p.data):await doc.embedJpg(p.data));if(item.rotation===90){const x=(item.x+s.tagHeight-p.y-p.h)*MM,y=(s.pageHeight-item.y-p.x)*MM;page.drawImage(images.get(p.data),{x,y,width:p.w*MM,height:p.h*MM,rotate:lib.degrees(-90)});}else{const x=(item.x+p.x)*MM,y=(s.pageHeight-item.y-p.y)*MM;page.drawImage(images.get(p.data),{x,y:y-p.h*MM,width:p.w*MM,height:p.h*MM});}}
   else{const a=point(item,p.x,p.y);page.pushOperators(lib.pushGraphicsState(),item.rotation===90?lib.concatTransformationMatrix(0,-p.sx*MM,p.sy*MM,0,a.x,a.y):lib.concatTransformationMatrix(p.sx*MM,0,0,p.sy*MM,a.x,a.y));page.drawSvgPath(p.d,{x:0,y:0,scale:1,color:color(p.fill)});page.pushOperators(lib.popGraphicsState());}
  }
  if(s.cropMarks){const cw=item.rotation===90?s.tagHeight:s.tagWidth,ch=item.rotation===90?s.tagWidth:s.tagHeight;for(const [x,y,x2,y2] of crops(item.x,item.y,cw,ch))page.drawLine({start:{x:x*MM,y:(s.pageHeight-y)*MM},end:{x:x2*MM,y:(s.pageHeight-y2)*MM},color:lib.grayscale(.45),thickness:.1*MM});}
  }
 }
 return doc.save({useObjectStreams:false});
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
  if(signature(live)!==signature(printed))throw new Error('Detail atau nomor cetakan '+printed.name+' berubah sejak PDF dibuat. Buat lembar cetak baru dari data terbaru.');
  if(Number(live.currentStep)===1)ops.push({kind:'upsert',id:live.id,expectedRevision:live.revision,printJobId:job.id,printSignature:signature(printed),data:{...C.fields(live),currentStep:2,isReject:false}});
 }
 C.queueOperations(state,ops,operator);job.moves=ops.map(op=>({id:op.id,opId:state.pending.find(p=>p.operation.id===op.id).operation.opId,confirmed:false}));job.finishSubmittedAt=new Date().toISOString();job.finishedBy=operator;
 state.printReceipts??={};for(const move of job.moves)state.printReceipts[move.opId]={jobId:job.id,confirmed:false};
 if(!ops.length)job.completedAt=job.finishSubmittedAt;return job;
}
function relinkOperation(state,oldId,newId){state.printReceipts??={};const receipt=state.printReceipts[oldId];if(!receipt?.jobId)return;state.printReceipts[oldId]={...receipt,activeOpId:newId,confirmed:false,cancelled:false};state.printReceipts[newId]={jobId:receipt.jobId,confirmed:false};}
function rebaseData(state,op,remote){
 if(!sameCycle(op.data,remote))throw new Error('Detail atau nomor cetakan pusat berbeda dari draf/PDF. Gunakan versi pusat lalu buat lembar cetak terbaru.');
 const jobId=op.printJobId||state.printReceipts?.[op.opId]?.jobId;
 if(!jobId)return op.data;
 if(signature(op.data)!==signature(remote)||(op.printSignature&&op.printSignature!==signature(remote)))throw new Error('Detail atau nomor cetakan pusat berbeda dari PDF. Gunakan versi pusat lalu buat lembar cetak terbaru.');
 return{...C.fields(remote),currentStep:Number(remote.currentStep)===1?2:remote.currentStep,isReject:Number(remote.currentStep)===1?false:remote.isReject};
}
function cancelOperations(state,ids){state.printReceipts??={};for(const id of ids)state.printReceipts[id]={...state.printReceipts[id],cancelled:true};}
function moveState(move,state){
 let id=move.activeOpId||move.opId,confirmed=!!move.confirmed,cancelled=!!move.cancelled;const seen=new Set();
 while(!seen.has(id)){seen.add(id);const r=state.printReceipts?.[id];confirmed=confirmed||!!r?.confirmed;cancelled=cancelled||!!r?.cancelled;if(!r?.activeOpId||r.activeOpId===id)break;id=r.activeOpId;}
 const receipt=state.operationReceipts?.[id];confirmed=confirmed||!!(receipt&&receipt.id===move.id);return{...move,activeOpId:id,confirmed,cancelled};
}
function exportMoves(job,state){return job.moves?.map(m=>moveState(m,state));}
function restoreBackup(main,prints,backup,includePending=false){
 const data=backup.print||backup,pending=includePending?(backup.pending||[]):[],jobs=data.jobs||[];
 if(!Array.isArray(pending)||!Array.isArray(jobs))throw new Error('Format antrean atau riwayat cetak tidak valid.');
 const opPattern=/^op_[a-zA-Z0-9_-]{8,100}$/,incomingReceipts=data.receipts||{},incomingOperations=backup.operationReceipts||data.operationReceipts||{};
 for(const job of jobs){
  if(typeof job.id!=='string'||!job.id.startsWith('CT-')||!Array.isArray(job.orders)||!Number.isFinite(Date.parse(job.createdAt)))throw new Error('Format lembar cetak tidak valid.');
  if(new Set(job.orders.map(o=>o.id)).size!==job.orders.length)throw new Error('ID nametag berulang dalam lembar backup.');
  plan(job.orders,job.settings,jobAssets(job),false,job.engine||'13.6.0');
  for(const move of job.moves||[])if(!opPattern.test(move.opId)||move.activeOpId&&!opPattern.test(move.activeOpId)||!job.orders.some(o=>o.id===move.id))throw new Error('Hubungan konfirmasi cetak dalam backup tidak valid.');
 }
 for(const p of pending){
  if(!p?.operation||!opPattern.test(p.operation.opId)||!C.text(p.operation.id))throw new Error('Format antrean backup tidak valid.');
  const existing=(main.pending||[]).find(x=>x.operation.opId===p.operation.opId);
  if(existing&&JSON.stringify(existing.operation)!==JSON.stringify(p.operation))throw new Error('ID pengiriman backup memiliki isi berbeda. Antrean belum dipulihkan.');
 }
 if(data.settings)currentSettings(data.settings);
 main.pending??=[];main.printReceipts??={};main.operationReceipts??={};prints.printJobs??=[];
 for(const [id,receipt] of Object.entries(incomingOperations))if(opPattern.test(id)&&receipt&&C.text(receipt.id)&&!main.operationReceipts[id])main.operationReceipts[id]=clone(receipt);
 for(const [id,receipt] of Object.entries(incomingReceipts))if(opPattern.test(id)&&receipt&&C.text(receipt.jobId)&&(!receipt.activeOpId||opPattern.test(receipt.activeOpId))&&!main.printReceipts[id])main.printReceipts[id]=clone(receipt);
 const ids=new Set(main.pending.map(p=>p.operation.opId));
 for(const p of pending)if(!ids.has(p.operation.opId)){main.pending.push({...clone(p),status:p.status==='blocked'?'blocked':'queued'});ids.add(p.operation.opId);}
 for(const saved of jobs){
  const existing=prints.printJobs.find(j=>j.id===saved.id);
  if(existing&&JSON.stringify([existing.orders,existing.settings,existing.assets])!==JSON.stringify([saved.orders,saved.settings,saved.assets]))throw new Error('ID lembar cetak backup memiliki desain berbeda. Pemulihan dibatalkan.');
  if(!existing)prints.printJobs.push(clone(saved));
  else if(!existing.finishSubmittedAt&&saved.finishSubmittedAt)Object.assign(existing,{moves:clone(saved.moves||[]),finishSubmittedAt:saved.finishSubmittedAt,finishedBy:saved.finishedBy,completedAt:saved.completedAt});
  const job=existing||prints.printJobs.at(-1);
  for(const move of job.moves||[]){
   const resolved=moveState(move,{printReceipts:incomingReceipts,operationReceipts:incomingOperations}),leaf=resolved.activeOpId;
   // Rebuild missing links even for v13.6 print backups that stored only resolved moves.
   main.printReceipts[move.opId]??={jobId:job.id,activeOpId:leaf,confirmed:resolved.confirmed,cancelled:resolved.cancelled};
   main.printReceipts[leaf]??={jobId:job.id,confirmed:resolved.confirmed,cancelled:resolved.cancelled};
  }
 }
 for(const p of main.pending)if(p.operation.printJobId)main.printReceipts[p.operation.opId]??={jobId:p.operation.printJobId,confirmed:false};
 if(data.settings)prints.printSettings=currentSettings(data.settings);
 if(data.assets)prints.printAssets={...(prints.printAssets||{}),...clone(data.assets)};
 C.repairPendingDependencies(main);
}
function acknowledge(state,op,result){if(!result?.committed)return;state.printReceipts??={};if(state.printReceipts[op.opId]||op.printJobId)state.printReceipts[op.opId]={jobId:op.printJobId,...state.printReceipts[op.opId],confirmed:true,confirmedAt:new Date().toISOString()};}
function jobStatus(j,state){if(j.completedAt)return 'Cetak dikonfirmasi';if(j.finishSubmittedAt){const moves=(j.moves||[]).map(m=>moveState(m,state)),left=moves.filter(m=>!m.confirmed&&!m.cancelled);if(!left.length)return moves.some(m=>m.cancelled&&!m.confirmed)?'Cetak dikonfirmasi · perpindahan dibatalkan':'Cetak dikonfirmasi';return left.some(m=>!state.pending.some(p=>p.operation.opId===m.activeOpId&&p.status!=='blocked'))?'Periksa perpindahan di antrean simpan':'Cetak dikonfirmasi · menunggu '+left.length+' penyimpanan';}return j.downloadedAt?'PDF diunduh · belum dikonfirmasi cetak':'Siap diunduh';}
root.NFPrint={BUILD,DEFAULTS,V13_7_DEFAULTS,LEGACY_DEFAULTS,settings,currentSettings,grid,engineProfile,legacyEngine,fontFor,logoKey,jobAssets,logoImageInfo,checkLogoPixels,signature,sameCycle,fitText,artwork,tagSvg,plan,sheetSvg,pdf,createJob,finishJob,acknowledge,relinkOperation,rebaseData,cancelOperations,moveState,exportMoves,restoreBackup,jobStatus};
if(typeof module!=='undefined')module.exports=root.NFPrint;
})(globalThis);
