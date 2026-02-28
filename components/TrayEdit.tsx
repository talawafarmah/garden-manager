import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { SeedlingTray, InventorySeed, TraySeedRecord, SeedCategory } from '../types';

/**
 * Universal Resizer: Downscales large images to an optimal size/quality.
 * This saves bucket space and ensures faster loading times for the gallery and list views.
 */
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

export default function TrayEdit({ tray, trays, setTrays, inventory, categories, navigateTo, handleGoBack }: any) {
  const [trayFormData, setTrayFormData] = useState<SeedlingTray>(tray);
  const [isSaving, setIsSaving] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const trayPhotoInputRef = useRef<HTMLInputElement>(null);

  // --- Picker Logic States ---
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerFilter, setPickerFilter] = useState("All");

  // Load temporary signed URLs for private storage images
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
      reader.onloadend = () => { 
        setTrayFormData({ ...trayFormData, images: [...(trayFormData.images || []), reader.result as string] }); 
      };
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
      const trayId = trayFormData.id || crypto.randomUUID();
      const folderName = `trays/${trayId}`;
      const uploadedImagePaths = [];

      // Process and upload images to bucket
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
             uploadedImagePaths.push(img);
          }
        } else {
          uploadedImagePaths.push(img);
        }
      }

      // Generate thumbnail for the first image
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

      const savedTray: SeedlingTray = {
        ...trayFormData,
        ...payloadToSave,
        first_germination_date: payloadToSave.first_germination_date === null ? "" : payloadToSave.first_germination_date,
        first_planted_date: payloadToSave.first_planted_date === null ? "" : payloadToSave.first_planted_date,
      };

      if (isNew) setTrays([savedTray, ...trays]);
      else setTrays(trays.map((t: SeedlingTray) => t.id === savedTray.id ? savedTray : t));
      
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

  // --- Searchable Picker Logic ---
  const openSeedPicker = (index: number) => {
    setPickerIndex(index);
    setPickerSearch("");
    setPickerFilter("All");
    setIsPickerOpen(true);
  };

  const selectSeedForTray = (seed: InventorySeed) => {
    if (pickerIndex === null) return;
    const newContents = [...trayFormData.contents];
    newContents[pickerIndex] = { 
      ...newContents[pickerIndex], 
      seed_id: seed.id, 
      variety_name: seed.variety_name 
    };
    setTrayFormData({ ...trayFormData, contents: newContents });
    setIsPickerOpen(false);
    setPickerIndex(null);
  };

  const filteredInventory = inventory.filter((s: InventorySeed) => {
    const matchesSearch = s.variety_name.toLowerCase().includes(pickerSearch.toLowerCase()) || 
                          s.id.toLowerCase().includes(pickerSearch.toLowerCase());
    const matchesFilter = pickerFilter === "All" || s.category === pickerFilter;
    return matchesSearch && matchesFilter;
  });

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900 pb-20">
      
      {/* --- MODAL: Searchable Seed Picker --- */}
      {isPickerOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md h-[90vh] sm:h-auto sm:max-h-[80vh] rounded-t-3xl sm:rounded-2xl flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300">
            <header className="p-4 border-b border-stone-100 flex justify-between items-center bg-stone-50 rounded-t-2xl">
              <div>
                <h3 className="font-bold text-stone-800">Select Seed Variety</h3>
                <p className="text-[10px] text-stone-500 uppercase tracking-widest font-bold">Slot {pickerIndex !== null ? pickerIndex + 1 : ''}</p>
              </div>
              <button onClick={() => setIsPickerOpen(false)} className="p-2 text-stone-400 hover:bg-stone-200 rounded-full transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </header>
            
            <div className="p-4 space-y-3">
              <div className="relative">
                <input 
                  type="text" 
                  autoFocus
                  placeholder="Search name or ID (e.g. TM1)..." 
                  value={pickerSearch} 
                  onChange={(e) => setPickerSearch(e.target.value)}
                  className="w-full bg-stone-100 border border-stone-200 rounded-xl py-3 pl-10 pr-4 outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-sm font-medium"
                />
                <svg className="w-5 h-5 text-stone-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
              
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                <button onClick={() => setPickerFilter("All")} className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-colors ${pickerFilter === 'All' ? 'bg-emerald-600 text-white shadow-md' : 'bg-stone-100 text-stone-500 border border-stone-200'}`}>All</button>
                {categories.map((cat: SeedCategory) => (
                  <button key={cat.name} onClick={() => setPickerFilter(cat.name)} className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase whitespace-nowrap transition-colors ${pickerFilter === cat.name ? 'bg-emerald-600 text-white shadow-md' : 'bg-stone-100 text-stone-500 border border-stone-200'}`}>{cat.name}</button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 pt-0 space-y-2">
               {filteredInventory.length > 0 ? (
                 filteredInventory.map((s: InventorySeed) => (
                   <button 
                     key={s.id} 
                     onClick={() => selectSeedForTray(s)}
                     className="w-full bg-white p-2.5 rounded-xl border border-stone-100 flex items-center gap-4 hover:border-emerald-500 hover:bg-emerald-50/30 transition-all text-left group active:scale-[0.98]"
                   >
                     <div className="w-12 h-12 rounded-lg bg-stone-100 border border-stone-200 overflow-hidden flex-shrink-0">
                        {s.thumbnail ? <img src={s.thumbnail} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-stone-300"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" /></svg></div>}
                     </div>
                     <div className="flex-1 min-w-0">
                       <div className="flex justify-between items-baseline gap-2">
                         <h4 className="font-bold text-stone-800 truncate text-sm">{s.variety_name}</h4>
                         <span className="font-mono text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 rounded">{s.id}</span>
                       </div>
                       <p className="text-[10px] text-stone-500 font-medium">{s.category} • {s.vendor || 'Unknown Vendor'}</p>
                     </div>
                     <div className="opacity-0 group-hover:opacity-100 text-emerald-500 transition-opacity"><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg></div>
                   </button>
                 ))
               ) : (
                 <div className="py-12 text-center text-stone-400">
                    <p className="text-sm">No seeds found matching your search.</p>
                 </div>
               )}
            </div>
            <div className="p-4 bg-stone-50 border-t border-stone-100 text-center text-[10px] text-stone-400 font-bold uppercase tracking-widest">
              Seed Vault ({filteredInventory.length} varieties)
            </div>
          </div>
        </div>
      )}

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
        
        {/* --- Image Gallery Section --- */}
        <section className="bg-white p-5 rounded-2xl shadow-sm border border-stone-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-stone-800">Gallery</h3>
            <button onClick={() => trayPhotoInputRef.current?.click()} className="text-emerald-600 text-sm font-bold flex items-center gap-1 hover:text-emerald-500 bg-emerald-50 px-3 py-1.5 rounded-lg">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add Photo
            </button>
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

        {/* --- Tray Metadata Section --- */}
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

        {/* --- Tray Contents Section with Improved Picker --- */}
        <section className="bg-white p-5 rounded-2xl shadow-sm border border-stone-200">
           <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-stone-800">Seeds Sown in Tray</h3></div>
           <div className="space-y-4 mb-4">
              {trayFormData.contents.map((record: any, idx: number) => {
                 const seedObj = inventory.find((s: InventorySeed) => s.id === record.seed_id);
                 return (
                   <div key={idx} className="bg-stone-50 p-3 rounded-xl border border-stone-200 relative group">
                      <button onClick={() => {
                          const newContents = trayFormData.contents.filter((_, i) => i !== idx);
                          setTrayFormData({ ...trayFormData, contents: newContents });
                      }} className="absolute -top-2 -right-2 bg-red-100 text-red-600 p-1 rounded-full border border-red-200 hover:bg-red-200 opacity-0 group-hover:opacity-100 transition-opacity z-10"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                      
                      <div className="mb-3">
                        <label className="block text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-1">Variety Selection</label>
                        <button 
                          onClick={() => openSeedPicker(idx)}
                          className="w-full bg-white border border-stone-300 rounded-xl p-3 flex items-center gap-3 text-left hover:border-emerald-500 transition-all shadow-sm"
                        >
                          <div className="w-10 h-10 rounded-lg bg-stone-50 border border-stone-200 overflow-hidden flex-shrink-0">
                            {seedObj?.thumbnail ? <img src={seedObj.thumbnail} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-stone-200"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" /></svg></div>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-stone-800 text-sm truncate">{record.variety_name || "Tap to select seed..."}</div>
                            {record.seed_id && <div className="font-mono text-[10px] text-stone-500">{record.seed_id}</div>}
                          </div>
                          <svg className="w-5 h-5 text-stone-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" /></svg>
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-2 bg-white p-2 rounded-lg border border-stone-200">
                        <div><label className="block text-[10px] text-stone-500 text-center mb-1">Sown</label><input type="number" min="0" value={record.sown_count || ''} onChange={(e) => {
                          const newContents = [...trayFormData.contents];
                          newContents[idx] = { ...newContents[idx], sown_count: parseInt(e.target.value)||0 };
                          setTrayFormData({ ...trayFormData, contents: newContents });
                        }} className="w-full text-center bg-stone-50 border border-stone-200 rounded p-1.5 font-bold outline-none focus:border-emerald-500" /></div>
                        <div><label className="block text-[10px] text-emerald-600 font-bold text-center mb-1">Sprouted</label><input type="number" min="0" value={record.germinated_count || ''} onChange={(e) => {
                          const newContents = [...trayFormData.contents];
                          newContents[idx] = { ...newContents[idx], germinated_count: parseInt(e.target.value)||0 };
                          setTrayFormData({ ...trayFormData, contents: newContents });
                        }} className="w-full text-center bg-emerald-50 border border-emerald-200 rounded p-1.5 font-bold text-emerald-800 outline-none focus:border-emerald-500" /></div>
                        <div><label className="block text-[10px] text-blue-600 font-bold text-center mb-1">Planted</label><input type="number" min="0" value={record.planted_count || ''} onChange={(e) => {
                          const newContents = [...trayFormData.contents];
                          newContents[idx] = { ...newContents[idx], planted_count: parseInt(e.target.value)||0 };
                          setTrayFormData({ ...trayFormData, contents: newContents });
                        }} className="w-full text-center bg-blue-50 border border-blue-200 rounded p-1.5 font-bold text-blue-800 outline-none focus:border-blue-500" /></div>
                      </div>
                   </div>
                 );
              })}
              {trayFormData.contents.length === 0 && <div className="text-center py-6 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl flex flex-col items-center gap-2">
                 <svg className="w-8 h-8 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                 No seeds added to this tray yet.
              </div>}
           </div>
           <button onClick={() => {
             setTrayFormData({ ...trayFormData, contents: [...trayFormData.contents, { seed_id: "", variety_name: "", sown_count: 0, germinated_count: 0, planted_count: 0, germination_date: "" }] });
           }} className="w-full py-4 bg-emerald-50 text-emerald-700 font-bold rounded-xl border border-emerald-200 hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2 shadow-sm"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>Add Seed Variety to Tray</button>
        </section>

        {trayFormData.id && <button onClick={handleDeleteTray} disabled={isSaving} className="w-full py-4 mt-4 bg-red-50 text-red-600 font-bold rounded-xl border border-red-200 hover:bg-red-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>Delete Tray</button>}
      </div>
    </main>
  );
}