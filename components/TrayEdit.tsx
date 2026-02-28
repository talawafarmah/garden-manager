import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { SeedlingTray, InventorySeed, TraySeedRecord } from '../types';

// Universal Resizer: Downscales huge files to an optimal size/quality to save bucket space
const resizeImage = (source: string, maxSize: number, quality: number): Promise<string> => {
  return new Promise((resolve) => {
    if (!source) return resolve("");
    
    const img = new Image();
    img.crossOrigin = "anonymous"; 
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      
      if (width > height) {
        if (width > maxSize) { height *= maxSize / width; width = maxSize; }
      } else {
        if (height > maxSize) { width *= maxSize / height; height = maxSize; }
      }
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      try {
        resolve(canvas.toDataURL('image/jpeg', quality)); 
      } catch (e) {
        resolve(""); 
      }
    };
    img.onerror = () => resolve("");
    
    let finalSrc = source;
    if (source.startsWith('http') && !source.includes('supabase.co') && !source.includes('allorigins')) {
       finalSrc = `https://api.allorigins.win/raw?url=${encodeURIComponent(source)}`;
    } else if (!source.startsWith('http') && !source.startsWith('data:')) {
       finalSrc = `data:image/jpeg;base64,${source}`;
    }
    
    img.src = finalSrc;
  });
};

export default function TrayEdit({ tray, trays, setTrays, inventory, navigateTo, handleGoBack }: any) {
  const [trayFormData, setTrayFormData] = useState<SeedlingTray>(tray);
  const [isSaving, setIsSaving] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const trayPhotoInputRef = useRef<HTMLInputElement>(null);

  // Auto-generate secure signed URLs for any storage paths
  useEffect(() => {
    const loadUrls = async () => {
      const newUrls: Record<string, string> = { ...signedUrls };
      let changed = false;

      for (const img of (trayFormData.images || [])) {
        if (!img.startsWith('data:image') && !img.startsWith('http') && !newUrls[img]) {
          const { data } = await supabase.storage.from('talawa_media').createSignedUrl(img, 3600);
          if (data) {
            newUrls[img] = data.signedUrl;
            changed = true;
          }
        }
      }
      if (changed) setSignedUrls(newUrls);
    };
    loadUrls();
  }, [trayFormData.images]);

  const handleTrayPhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && trayFormData) {
      const reader = new FileReader();
      reader.onloadend = () => { setTrayFormData({ ...trayFormData, images: [...(trayFormData.images || []), reader.result as string] }); };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveTrayImage = (indexToRemove: number) => {
    if (!trayFormData) return;
    const newImages = trayFormData.images.filter((_, idx) => idx !== indexToRemove);
    setTrayFormData({ ...trayFormData, images: newImages });
  };

  const handleSaveTray = async () => {
    if (!trayFormData.name.trim()) { alert("Tray name is required."); return; }
    
    setIsSaving(true);
    
    try {
      const isNew = !trayFormData.id;
      
      // We need an ID for the folder name before we upload images. 
      // If it's a new tray, we generate a UUID for it early.
      const trayId = trayFormData.id || crypto.randomUUID();
      const folderName = `trays/${trayId}`;

      const uploadedImagePaths = [];

      for (const img of (trayFormData.images || [])) {
        if (img.startsWith('data:image') || img.startsWith('http')) {
          const optimizedBase64 = await resizeImage(img, 1600, 0.8);
          
          if (optimizedBase64) {
             const res = await fetch(optimizedBase64);
             const blob = await res.blob();
             const fileName = `${crypto.randomUUID()}.jpg`;
             const filePath = `${folderName}/${fileName}`;
             
             const { error: uploadErr } = await supabase.storage.from('talawa_media').upload(filePath, blob, { contentType: 'image/jpeg' });
             if (uploadErr) throw new Error("Upload failed: " + uploadErr.message);
             
             uploadedImagePaths.push(filePath);
          } else {
             uploadedImagePaths.push(img); // Fallback
          }
        } else {
          uploadedImagePaths.push(img); // Already a secure bucket path
        }
      }

      // Generate thumbnail from the first image
      let newThumbnail = trayFormData.thumbnail || "";
      if (uploadedImagePaths.length > 0) {
        const primaryImgSource = trayFormData.images[0];
        let sourceToResize = primaryImgSource;
        
        if (!primaryImgSource.startsWith('data:image') && !primaryImgSource.startsWith('http')) {
           sourceToResize = signedUrls[primaryImgSource]; 
        }
        
        if (sourceToResize) {
           newThumbnail = await resizeImage(sourceToResize, 150, 0.6);
        }
      }
      
      // Clean up empty strings to be actual nulls so Supabase date columns don't crash
      const payloadToSave: any = {
        ...trayFormData,
        id: trayId,
        images: uploadedImagePaths,
        thumbnail: newThumbnail,
        first_germination_date: trayFormData.first_germination_date || null,
        first_planted_date: trayFormData.first_planted_date || null,
      };

      if (isNew) {
        const { error: insertErr } = await supabase.from('seedling_trays').insert([payloadToSave]);
        if (insertErr) throw new Error(insertErr.message);
      } else {
        const { error: updateErr } = await supabase.from('seedling_trays').update(payloadToSave).eq('id', trayId);
        if (updateErr) throw new Error(updateErr.message);
      }

      // Restore safe local state
      const savedTray: SeedlingTray = {
        ...trayFormData,
        ...payloadToSave,
        first_germination_date: payloadToSave.first_germination_date === null ? "" : payloadToSave.first_germination_date,
        first_planted_date: payloadToSave.first_planted_date === null ? "" : payloadToSave.first_planted_date,
      };

      if (isNew) {
        setTrays([savedTray, ...trays]);
      } else {
        setTrays(trays.map((t: SeedlingTray) => t.id === savedTray.id ? savedTray : t));
      }
      
      navigateTo('tray_detail', savedTray);

    } catch (error: any) {
      alert("Failed to save tray: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTray = async () => {
    if (!tray.id) return;
    if (confirm(`Are you sure you want to delete ${tray.name}?`)) {
      const { error } = await supabase.from('seedling_trays').delete().eq('id', tray.id);
      if (error) alert("Failed to delete tray.");
      else { setTrays(trays.filter((t: SeedlingTray) => t.id !== tray.id)); navigateTo('trays'); }
    }
  };

  const handleAddSeedToTray = () => {
    setTrayFormData({ ...trayFormData, contents: [...trayFormData.contents, { seed_id: "", variety_name: "", sown_count: 0, germinated_count: 0, planted_count: 0, germination_date: "" }] });
  };

  const handleUpdateTraySeed = (index: number, field: keyof TraySeedRecord, value: any) => {
    const newContents = [...trayFormData.contents];
    if (field === 'seed_id') {
       const matchedSeed = inventory.find((s: InventorySeed) => s.id === value);
       newContents[index] = { ...newContents[index], seed_id: value, variety_name: matchedSeed ? matchedSeed.variety_name : "Unknown" };
    } else { newContents[index] = { ...newContents[index], [field]: value }; }
    setTrayFormData({ ...trayFormData, contents: newContents });
  };

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900 pb-20">
      <header className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center justify-between border-b border-stone-200">
        <div className="flex items-center gap-3">
          <button onClick={() => handleGoBack('trays')} className="p-2 text-stone-500 hover:bg-stone-100 rounded-full transition-colors"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
          <h1 className="text-xl font-bold text-stone-800">{trayFormData.id ? 'Edit Tray' : 'New Tray'}</h1>
        </div>
        <button onClick={handleSaveTray} disabled={isSaving} className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-500 transition-colors shadow-sm disabled:opacity-50">
          {isSaving ? "Saving..." : "Save"}
        </button>
      </header>

      <div className="max-w-md mx-auto p-4 space-y-5">
        
        <section className="bg-white p-5 rounded-2xl shadow-sm border border-stone-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-stone-800">Gallery</h3>
            <button onClick={() => trayPhotoInputRef.current?.click()} className="text-emerald-600 text-sm font-bold flex items-center gap-1 hover:text-emerald-500 bg-emerald-50 px-3 py-1.5 rounded-lg"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>Add Photo</button>
            <input type="file" accept="image/*" capture="environment" ref={trayPhotoInputRef} className="hidden" onChange={handleTrayPhotoCapture} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {(!trayFormData.images || trayFormData.images.length === 0) && <p className="text-xs text-stone-400 col-span-3 text-center py-4 border-2 border-dashed border-stone-200 rounded-xl">No photos attached.</p>}
            {(trayFormData.images || []).map((img: string, idx: number) => {
              const displaySrc = img.startsWith('data:image') || img.startsWith('http') ? img : signedUrls[img] || '';

              return (
                <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-stone-200 shadow-sm bg-stone-100">
                  {displaySrc && <img src={displaySrc} alt="Tray" className="w-full h-full object-cover" />}
                  {!displaySrc && <div className="absolute inset-0 flex items-center justify-center"><svg className="w-5 h-5 text-stone-400 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>}
                  
                  <div className="absolute top-1 right-1 flex flex-col gap-1">
                     <button onClick={() => handleRemoveTrayImage(idx)} className="p-1.5 rounded-full bg-red-500/80 backdrop-blur-sm text-white hover:bg-red-500 shadow-sm"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="bg-white p-5 rounded-2xl shadow-sm border border-stone-200 space-y-4">
           <h3 className="font-bold text-stone-800 border-b border-stone-100 pb-2">Tray Details</h3>
           <div><label className="block text-xs font-medium text-stone-500 mb-1">Tray Name / Label <span className="text-red-400">*</span></label><input type="text" value={trayFormData.name} onChange={(e) => setTrayFormData({ ...trayFormData, name: e.target.value })} className="w-full bg-stone-50 border border-stone-300 rounded-lg p-2.5 text-stone-800 font-bold outline-none focus:border-emerald-500" /></div>
           <div className="grid grid-cols-2 gap-4">
             <div><label className="block text-xs font-medium text-stone-500 mb-1">Sown Date</label><input type="date" value={trayFormData.sown_date} onChange={(e) => setTrayFormData({ ...trayFormData, sown_date: e.target.value })} className="w-full bg-stone-50 border border-stone-300 rounded-lg p-2.5 text-stone-800 outline-none focus:border-emerald-500" /></div>
             <div><label className="block text-xs font-medium text-stone-500 mb-1">1st Germination</label><input type="date" value={trayFormData.first_germination_date || ''} onChange={(e) => setTrayFormData({ ...trayFormData, first_germination_date: e.target.value })} className="w-full bg-stone-50 border border-stone-300 rounded-lg p-2.5 text-stone-800 outline-none focus:border-emerald-500" /></div>
           </div>
           <div className="grid grid-cols-2 gap-4">
             <div><label className="block text-xs font-medium text-stone-500 mb-1">1st Planted Date</label><input type="date" value={trayFormData.first_planted_date || ''} onChange={(e) => setTrayFormData({ ...trayFormData, first_planted_date: e.target.value })} className="w-full bg-stone-50 border border-stone-300 rounded-lg p-2.5 text-stone-800 outline-none focus:border-emerald-500" /></div>
             <div><label className="block text-xs font-medium text-stone-500 mb-1">Location</label><input type="text" placeholder="Indoors, Greenhouse..." value={trayFormData.location || ''} onChange={(e) => setTrayFormData({ ...trayFormData, location: e.target.value })} className="w-full bg-stone-50 border border-stone-300 rounded-lg p-2.5 text-stone-800 outline-none focus:border-emerald-500" /></div>
           </div>
           <div className="grid grid-cols-2 gap-4">
             <div><label className="block text-xs font-medium text-stone-500 mb-1">Tray Type</label><input type="text" placeholder="e.g., 72-cell" value={trayFormData.tray_type} onChange={(e) => setTrayFormData({ ...trayFormData, tray_type: e.target.value })} className="w-full bg-stone-50 border border-stone-300 rounded-lg p-2.5 text-stone-800 outline-none focus:border-emerald-500" /></div>
             <div><label className="block text-xs font-medium text-stone-500 mb-1">Potting Mix</label><input type="text" placeholder="e.g., Pro-Mix" value={trayFormData.potting_mix || ''} onChange={(e) => setTrayFormData({ ...trayFormData, potting_mix: e.target.value })} className="w-full bg-stone-50 border border-stone-300 rounded-lg p-2.5 text-stone-800 outline-none focus:border-emerald-500" /></div>
           </div>
           <div className="grid grid-cols-1 gap-2 pt-2">
             <label className="block text-xs font-medium text-stone-500 mb-1">Environment Setup</label>
             <div className="flex items-center gap-3 p-3 bg-stone-50 rounded-xl border border-stone-200"><input type="checkbox" id="heatmat" checked={trayFormData.heat_mat} onChange={(e) => setTrayFormData({ ...trayFormData, heat_mat: e.target.checked })} className="w-5 h-5 accent-emerald-600 rounded" /><label htmlFor="heatmat" className="text-sm font-bold text-stone-700 cursor-pointer flex-1">Using Heat Mat</label></div>
             <div className="flex items-center gap-3 p-3 bg-stone-50 rounded-xl border border-stone-200"><input type="checkbox" id="humdome" checked={trayFormData.humidity_dome} onChange={(e) => setTrayFormData({ ...trayFormData, humidity_dome: e.target.checked })} className="w-5 h-5 accent-emerald-600 rounded" /><label htmlFor="humdome" className="text-sm font-bold text-stone-700 cursor-pointer flex-1">Using Humidity Dome</label></div>
             <div className="flex items-center gap-3 p-3 bg-stone-50 rounded-xl border border-stone-200"><input type="checkbox" id="growlight" checked={trayFormData.grow_light} onChange={(e) => setTrayFormData({ ...trayFormData, grow_light: e.target.checked })} className="w-5 h-5 accent-emerald-600 rounded" /><label htmlFor="growlight" className="text-sm font-bold text-stone-700 cursor-pointer flex-1">Using Grow Lights</label></div>
           </div>
           <div className="pt-2"><label className="block text-xs font-medium text-stone-500 mb-1">Tray Notes</label><textarea value={trayFormData.notes} onChange={(e) => setTrayFormData({ ...trayFormData, notes: e.target.value })} rows={3} placeholder="Fertilizer schedule, pest issues, etc." className="w-full bg-stone-50 border border-stone-300 rounded-lg p-2.5 text-stone-800 outline-none focus:border-emerald-500 resize-none" /></div>
        </section>

        <section className="bg-white p-5 rounded-2xl shadow-sm border border-stone-200">
           <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-stone-800">Seeds Sown in Tray</h3></div>
           <div className="space-y-4 mb-4">
              {trayFormData.contents.map((record: any, idx: number) => (
                 <div key={idx} className="bg-stone-50 p-3 rounded-xl border border-stone-200 relative">
                    <button onClick={() => {
                        const newContents = trayFormData.contents.filter((_, i) => i !== idx);
                        setTrayFormData({ ...trayFormData, contents: newContents });
                    }} className="absolute -top-2 -right-2 bg-red-100 text-red-600 p-1 rounded-full border border-red-200 hover:bg-red-200"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                    
                    <div className="mb-3">
                      <label className="block text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-1">Select Seed</label>
                      <select value={record.seed_id} onChange={(e) => handleUpdateTraySeed(idx, 'seed_id', e.target.value)} className="w-full bg-white border border-stone-300 rounded-lg p-2 text-stone-800 outline-none focus:border-emerald-500 font-medium">
                        <option value="" disabled>Choose from Vault...</option>
                        {inventory.map((s: InventorySeed) => <option key={s.id} value={s.id}>{s.id} - {s.variety_name}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-3 gap-2 bg-white p-2 rounded-lg border border-stone-200">
                      <div><label className="block text-[10px] text-stone-500 text-center mb-1">Sown</label><input type="number" min="0" value={record.sown_count || ''} onChange={(e) => handleUpdateTraySeed(idx, 'sown_count', parseInt(e.target.value)||0)} className="w-full text-center bg-stone-50 border border-stone-200 rounded p-1.5 font-bold outline-none focus:border-emerald-500" /></div>
                      <div><label className="block text-[10px] text-emerald-600 font-bold text-center mb-1">Sprouted</label><input type="number" min="0" value={record.germinated_count || ''} onChange={(e) => handleUpdateTraySeed(idx, 'germinated_count', parseInt(e.target.value)||0)} className="w-full text-center bg-emerald-50 border border-emerald-200 rounded p-1.5 font-bold text-emerald-800 outline-none focus:border-emerald-500" /></div>
                      <div><label className="block text-[10px] text-blue-600 font-bold text-center mb-1">Planted</label><input type="number" min="0" value={record.planted_count || ''} onChange={(e) => handleUpdateTraySeed(idx, 'planted_count', parseInt(e.target.value)||0)} className="w-full text-center bg-blue-50 border border-blue-200 rounded p-1.5 font-bold text-blue-800 outline-none focus:border-blue-500" /></div>
                    </div>
                 </div>
              ))}
              {trayFormData.contents.length === 0 && <div className="text-center py-4 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-xl">No seeds added to this tray yet.</div>}
           </div>
           <button onClick={handleAddSeedToTray} className="w-full py-3 bg-emerald-50 text-emerald-700 font-bold rounded-xl border border-emerald-200 hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>Add Seed Variety to Tray</button>
        </section>

        {trayFormData.id && <button onClick={handleDeleteTray} disabled={isSaving} className="w-full py-4 mt-4 bg-red-50 text-red-600 font-bold rounded-xl border border-red-200 hover:bg-red-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>Delete Tray</button>}
      </div>
    </main>
  );
}