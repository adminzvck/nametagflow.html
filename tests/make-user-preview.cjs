'use strict';
// Usage: node tests/make-user-preview.cjs Arial-Regular.ttf Swis721-Regular.ttf [output.pdf]
// Or: node tests/make-user-preview.cjs --legacy [output.pdf]
// Browser COBA-CETAK.html is the production reference: Node has no canvas kerning.
const fs=require('fs'),path=require('path');const root=path.resolve(__dirname,'..');global.crypto??=require('crypto').webcrypto;require(root+'/core.js');require(root+'/print-font.js');const L=require(root+'/local-font.js'),P=require(root+'/print-engine.js');global.PDFLib=require(root+'/vendor/pdf-lib.min.js');
const names=['SAFIK','Abdul Munhari','DIAR WAHYU P','Abdul Munhari','BUNGAULI BR TURNIP','PREMI SEPTI LESTARI','JULINA','SUMALI','RISA','RAHMAWATI','ASNI PARRANG','MEGA','ZUKHAYRAH','Kauslin Dede.K','Fegita Priantami','TIA','YANUAR NUGROHO','FARID NUGROHO','SETIYA CAHYA NINGRUM','NABILLA PUTERI YELSA','ANISATUL AZIMAH','Meliana Agustina','Enny Bogy Apriliani, S.Pd.','MARLIYAWANTI','SITI KHOTIMAH','JANUARITA, S.Pd.','Linda Ayu Maharani, S.Pd','DINA','NURUL ANNISA S'];
const rows=names.map((name,i)=>({id:'PREVIEW-'+i,revision:'r'+i,name,nip:'',model:'Model 1 (Lis + Nama)',mp:'PREVIEW',hook:'Magnet',logo:'',resi:'',sku:'',notes:'',currentStep:1,printCount:1,isReject:false,rejectReason:'',createdAt:'2026-10-02T00:00:00Z',productionDate:'2026-10-02'}));
(async()=>{
 const args=process.argv.slice(2),legacy=args[0]==='--legacy';
 if(!legacy&&args.length<2)throw new Error('Pilih dua file TTF asli: node tests/make-user-preview.cjs Arial-Regular.ttf Swis721-Regular.ttf [output.pdf]. Untuk arsip font lama: --legacy [output.pdf].');
 let job;
 if(legacy)job={version:1,engine:'13.8.5',id:'PREVIEW-LEGACY-13.8.5',createdAt:new Date().toISOString(),operator:'Contoh arsip',orders:rows,settings:P.settings({},'13.8.5'),assets:{}};
 else{
  const chars=L.charsFromOrders(rows);
  for(const [key,filePath]of [['arial',args[0]],['swis',args[1]]]){const bytes=fs.readFileSync(filePath);await L.loadFile(key,{name:path.basename(filePath),size:bytes.length,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)},chars);}
  console.warn('Preview Node menggunakan outline asli tanpa pengukuran kerning canvas. Untuk pemeriksaan akhir, gunakan COBA-CETAK.html pada browser produksi.');job=P.createJob(rows);
 }
 const output=path.resolve(legacy?(args[1]||path.join(root,'Preview-Referensi-v13.8.5.pdf')):(args[2]||path.join(root,'Preview-Hasil-v13.8.8.pdf')));
 if(!output.toLowerCase().endsWith('.pdf'))throw new Error('Output harus berupa .pdf.');
 if(!legacy&&args.slice(0,2).some(p=>path.resolve(p)===output))throw new Error('Output tidak boleh menimpa file font.');
 fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,await P.pdf(job));console.log('PDF dibuat: '+output);
})().catch(e=>{console.error(e.message);process.exitCode=1;});
