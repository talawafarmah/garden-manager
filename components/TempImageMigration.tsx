import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// --- HELPERS ---
const base64ToBlob = (base64: string, mimeType: string): Blob => {
  const byteString = atob(base64.split(',')[1]);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
  return new Blob([ab], { type: mimeType });
};

const fetchImageAsDataURL = async (url: string, log: (msg: string) => void): Promise<string> => {
  if (!url) return "";
  if (url.startsWith('data:')) return url;
  
  const localProxy = `/api/proxy-image?url=${encodeURIComponent(url)}`;

  try {
    const res = await fetch(localProxy);
    if (res.ok) {
      const blob = await res.blob();
      if (!blob.type.includes('image')) {
          log(`❌ Proxy returned non-image data: ${blob.type}`);
          return "";
      }
      return await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } else {
      log(`❌ Proxy failed with status: ${res.status}`);
    }
  } catch (e: any) {
     log(`❌ Fetch failed: ${e.message}`);
  }
  return "";
};

const resizeImage = (source: string, maxSize: number, quality: number): Promise<string> => {
  return new Promise((resolve) => {
    if (!source) return resolve("");
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width, height = img.height;
      if (width > height) { if (width > maxSize) { height *= maxSize / width; width = maxSize; } } 
      else { if (height > maxSize) { width *= maxSize / height; height = maxSize; } }
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      try { resolve(canvas.toDataURL('image/jpeg', quality)); } catch (e) { resolve(""); }
    };
    img.onerror = () => resolve("");
    img.src = source;
  });
};

export default function CollageTester({ handleGoBack }: any) {
  const [logs, setLogs] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stats, setStats] = useState({ total: 0, current: 0, updated: 0 });

  const addLog = (msg: string) => setLogs(prev => [...prev, msg]);

  const runMigration = async () => {
    if (!confirm("Are you sure you want to run the database image migration? This may take a few minutes.")) return;
    
    setIsProcessing(true);
    setLogs(["🚀 STARTING DATABASE MIGRATION..."]);

    const { data: seeds, error } = await supabase.from('seed_inventory').select('*');
    
    if (error || !seeds) {
       addLog(`🚨 Failed to fetch seeds: ${error?.message}`);
       setIsProcessing(false);
       return;
    }

    setStats({ total: seeds.length, current: 0, updated: 0 });
    addLog(`Found ${seeds.length} total seeds in inventory.`);

    let updatedCount = 0;

    for (let i = 0; i < seeds.length; i++) {
      const seed = seeds[i];
      setStats(s => ({ ...s, current: i + 1 }));
      
      let needsUpdate = false;
      let newThumbnail = seed.thumbnail || "";
      let newImages = [...(seed.images || [])];

      addLog(`\n[${i+1}/${seeds.length}] Checking ${seed.variety_name} (${seed.id})...`);

      // 1. Process Thumbnail
      if (newThumbnail && newThumbnail.startsWith('http')) {
         addLog(`  -> Downloading external thumbnail...`);
         const base64 = await fetchImageAsDataURL(newThumbnail, addLog);
         if (base64) {
            const resized = await resizeImage(base64, 150, 0.6);
            if (resized) {
               newThumbnail = resized;
               needsUpdate = true;
               addLog(`  ✅ Thumbnail converted to Base64 encoding.`);
            }
         } else {
            addLog(`  ❌ Failed to process thumbnail.`);
         }
      }

      // 2. Process Full Images array
      for (let j = 0; j < newImages.length; j++) {
         const imgUrl = newImages[j];
         if (imgUrl.startsWith('http') && !imgUrl.includes('supabase.co')) {
            addLog(`  -> Downloading external gallery image [${j+1}]...`);
            const base64 = await fetchImageAsDataURL(imgUrl, addLog);
            if (base64) {
               const resized = await resizeImage(base64, 1600, 0.8);
               if (resized) {
                  const blob = base64ToBlob(resized, 'image/jpeg');
                  const folderName = btoa(seed.id).replace(/=/g, '');
                  const fileName = `${folderName}/migrated_${crypto.randomUUID()}.jpg`;
                  
                  addLog(`  -> Uploading to Supabase bucket...`);
                  const { error: uploadError } = await supabase.storage.from('talawa_media').upload(fileName, blob, { contentType: 'image/jpeg' });
                  
                  if (!uploadError) {
                     newImages[j] = fileName; // Replace external URL with secure bucket path
                     needsUpdate = true;
                     addLog(`  ✅ Image safely uploaded to bucket.`);
                  } else {
                     addLog(`  ❌ Bucket upload failed: ${uploadError.message}`);
                  }
               }
            }
         }
      }

      // 3. Save Updates to Supabase Database
      if (needsUpdate) {
         addLog(`  -> Saving updates to database...`);
         const { error: updateError } = await supabase.from('seed_inventory').update({ thumbnail: newThumbnail, images: newImages }).eq('id', seed.id);
         if (updateError) {
             addLog(`  ❌ Database update failed: ${updateError.message}`);
         } else {
             updatedCount++;
             setStats(s => ({ ...s, updated: updatedCount }));
             addLog(`  🎉 Database row updated successfully!`);
         }
      } else {
         addLog(`  -> No external images found. Skipping.`);
      }
    }

    addLog(`\n✅ MIGRATION COMPLETE! Successfully localized ${updatedCount} seeds.`);
    setIsProcessing(false);
  };

  // Auto-scroll logs to bottom
  const logsEndRef = React.useRef<HTMLDivElement>(null);
  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logs]);

  return (
    <div className="min-h-screen bg-stone-50 p-6 text-stone-900 font-sans max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4 border-b border-stone-200 pb-4">
         <button onClick={() => handleGoBack('dashboard')} className="p-2 bg-stone-200 hover:bg-stone-300 rounded-full transition-colors">←</button>
         <h1 className="text-2xl font-black">Data Migration Tool</h1>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
        <h2 className="font-bold text-lg text-stone-800">Localize External Images</h2>
        <p className="text-sm text-stone-500 leading-relaxed">
          This script will scan your entire seed vault. Any thumbnails pointing to external websites will be downloaded and encoded as Base64. Any gallery images will be downloaded, compressed, and permanently uploaded to your secure Supabase storage bucket.
        </p>
        
        <div className="flex gap-4 items-center bg-stone-50 p-4 rounded-xl border border-stone-100">
           <div className="flex-1 text-center">
             <span className="block text-[10px] font-black uppercase tracking-widest text-stone-400">Total Seeds</span>
             <span className="text-2xl font-black text-stone-800">{stats.total}</span>
           </div>
           <div className="flex-1 text-center border-l border-r border-stone-200">
             <span className="block text-[10px] font-black uppercase tracking-widest text-stone-400">Scanned</span>
             <span className="text-2xl font-black text-blue-600">{stats.current}</span>
           </div>
           <div className="flex-1 text-center">
             <span className="block text-[10px] font-black uppercase tracking-widest text-stone-400">Fixed</span>
             <span className="text-2xl font-black text-emerald-600">{stats.updated}</span>
           </div>
        </div>

        <button onClick={runMigration} disabled={isProcessing} className="w-full py-4 bg-emerald-600 text-white font-black uppercase tracking-widest rounded-xl shadow-md disabled:opacity-50 hover:bg-emerald-500 transition-colors">
           {isProcessing ? "Migration in Progress..." : "Run Migration"}
        </button>
      </div>

      <div className="bg-stone-900 text-emerald-400 p-4 rounded-2xl text-xs font-mono h-96 overflow-y-auto shadow-inner">
        {logs.map((log, i) => (
          <div key={i} className="whitespace-pre-wrap mb-1 leading-relaxed">
             {log.includes('❌') ? <span className="text-red-400">{log}</span> : 
              log.includes('✅') || log.includes('🎉') ? <span className="text-white font-bold">{log}</span> : 
              log}
          </div>
        ))}
        <div ref={logsEndRef} />
        {logs.length === 0 && <div className="text-stone-600">Waiting to start...</div>}
      </div>
    </div>
  );
}