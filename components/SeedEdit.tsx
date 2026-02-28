import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { InventorySeed, SeedCategory } from '../types';
import { fetchWithRetry, getBestModel } from '../lib/utils';
import ImageSearch from './ImageSearch';

/**
 * Universal Resizer: Downscales huge files to an optimal size/quality to save bucket space.
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

export default function SeedEdit({ seed, inventory, setInventory, categories, setCategories, navigateTo, handleGoBack }: any) {
  const [editFormData, setEditFormData] = useState<InventorySeed>(seed);
  const [showNewCatForm, setShowNewCatForm] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatPrefix, setNewCatPrefix] = useState("");
  
  const [isAutoFilling, setIsAutoFilling] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isImageSearchOpen, setIsImageSearchOpen] = useState(false);
  
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const editPhotoInputRef = useRef<HTMLInputElement>(null);

  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";

  // Auto-generate secure signed URLs for any storage paths
  useEffect(() => {
    const loadUrls = async () => {
      const newUrls: Record<string, string> = { ...signedUrls };
      let changed = false;

      for (const img of (editFormData.images || [])) {
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
  }, [editFormData.images]);

  const handleEditPhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && editFormData) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditFormData({ ...editFormData, images: [...(editFormData.images || []), reader.result as string] });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    if (!editFormData) return;
    const newImages = editFormData.images.filter((_, idx) => idx !== indexToRemove);
    let newPrimary = editFormData.primaryImageIndex || 0;
    if (indexToRemove === editFormData.primaryImageIndex) newPrimary = 0; 
    else if (indexToRemove < (editFormData.primaryImageIndex || 0)) newPrimary -= 1;
    setEditFormData({ ...editFormData, images: newImages, primaryImageIndex: newPrimary });
  };

  const handleAutoFill = async () => {
    setIsAutoFilling(true);
    try {
      if (!apiKey) throw new Error("Missing API Key!");

      const modelToUse = await getBestModel();
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${apiKey}`;
      
      const { images, thumbnail, ...cleanFormData } = editFormData;

      const payload = {
        contents: [{
          role: "user",
          parts: [{ text: `You are an expert horticulturist. Here is the current data for a seed named "${editFormData.variety_name}" (Vendor: ${editFormData.vendor || 'unknown'}, Category: ${editFormData.category}, Species: ${editFormData.species || 'unknown'}). \n\n${JSON.stringify(cleanFormData)}\n\nPlease fill in any missing or empty fields with accurate botanical data. Use the Google Search tool if you are unsure. Keep existing populated data intact.\n\nIMPORTANT: Respond ONLY with a valid JSON object. The JSON must exactly match this structure:\n{"variety_name":"","vendor":"","days_to_maturity":0,"species":"","category":"","notes":"","companion_plants":[],"seed_depth":"","plant_spacing":"","row_spacing":"","germination_days":"","sunlight":"","lifecycle":"","cold_stratification":false,"stratification_days":0,"light_required":false,"scoville_rating":null}` }]
        }],
        tools: [{ google_search: {} }]
      };

      const result = await fetchWithRetry(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }, 3);
      const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (textResponse) {
        const parsedData = JSON.parse(textResponse.replace(/```json/g, '').replace(/```/g, '').trim());
        setEditFormData(prev => ({
          ...prev, ...parsedData, id: prev.id, images: prev.images, primaryImageIndex: prev.primaryImageIndex
        }));
      }
    } catch (e: any) { alert("Auto-fill failed: " + e.message); } 
    finally { setIsAutoFilling(false); }
  };

  const handleSaveEdit = async () => {
    if (!editFormData.id.trim()) { alert("Shortcode ID is required."); return; }
    setIsSaving(true);
    
    try {
      const isNewRecord = !inventory.some((s: InventorySeed) => s.id === seed.id);

      if (editFormData.id !== seed.id) {
        const { data: duplicates } = await supabase.from('seed_inventory').select('id').eq('id', editFormData.id);
        if (duplicates && duplicates.length > 0) { alert(`Error: The shortcode '${editFormData.id}' is already assigned.`); return; }
      }
      
      let finalCatName = editFormData.category;
      if (editFormData.category === '__NEW__' && newCatName.trim() !== '') {
        finalCatName = newCatName.trim();
        const finalPrefix = newCatPrefix.trim().toUpperCase() || finalCatName.substring(0, 2).toUpperCase();
        await supabase.from('seed_categories').insert([{ name: finalCatName, prefix: finalPrefix }]);
        setCategories([...categories, { name: finalCatName, prefix: finalPrefix }].sort((a: any, b: any) => a.name.localeCompare(b.name)));
      }

      const uploadedImagePaths = [];
      const folderName = btoa(editFormData.id).replace(/=/g, ''); 

      for (const img of (editFormData.images || [])) {
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

      let newThumbnail = editFormData.thumbnail || "";
      if (uploadedImagePaths.length > 0) {
        const primaryIdx = editFormData.primaryImageIndex || 0;
        const primaryImgSource = editFormData.images[primaryIdx];
        let sourceToResize = primaryImgSource;
        if (!primaryImgSource.startsWith('data:image') && !primaryImgSource.startsWith('http')) {
           sourceToResize = signedUrls[primaryImgSource]; 
        }
        if (sourceToResize) {
           newThumbnail = await resizeImage(sourceToResize, 150, 0.6);
        }
      }

      const payloadToSave: any = { 
        ...editFormData,
        id: editFormData.id,
        category: finalCatName,
        images: uploadedImagePaths,
        thumbnail: newThumbnail,
        days_to_maturity: editFormData.days_to_maturity === "" ? null : Number(editFormData.days_to_maturity),
        stratification_days: editFormData.stratification_days === "" ? null : Number(editFormData.stratification_days),
        scoville_rating: editFormData.scoville_rating === "" ? null : Number(editFormData.scoville_rating),
      };

      if (isNewRecord) {
        const { error } = await supabase.from('seed_inventory').insert([payloadToSave]);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from('seed_inventory').update(payloadToSave).eq('id', seed.id);
        if (error) throw new Error(error.message);
      }
      
      const savedSeed: InventorySeed = {
         ...payloadToSave,
         returnTo: seed.returnTo,
         returnPayload: seed.returnPayload
      };

      if (isNewRecord) setInventory([savedSeed, ...inventory]);
      else setInventory(inventory.map((s: InventorySeed) => s.id === seed.id ? savedSeed : s));

      navigateTo('seed_detail', savedSeed, true); 
    } catch (error: any) { alert(error.message); } 
    finally { setIsSaving(false); }
  };

  const handleDeleteSeed = async () => {
    if (confirm(`Are you sure you want to permanently delete ${seed.variety_name} (${seed.id})?`)) {
      const { error } = await supabase.from('seed_inventory').delete().eq('id', seed.id);
      if (error) alert("Failed to delete from database: " + error.message);
      else {
        setInventory(inventory.filter((s: InventorySeed) => s.id !== seed.id));
        navigateTo('vault');
      }
    }
  };

  const handleCancel = () => {
    if (seed.id) {
       navigateTo('seed_detail', seed, true); 
    } else {
       handleGoBack('vault');
    }
  };

  const isPepper = editFormData.category?.toLowerCase().includes('pepper') || newCatName.toLowerCase().includes('pepper');

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900 pb-20">
      {isImageSearchOpen && (
        <ImageSearch 
          query={`${editFormData.variety_name} ${editFormData.species || ''} plant`}
          onSelect={(url) => { 
            setEditFormData({ ...editFormData, images: [...(editFormData.images || []), url] }); 
            setIsImageSearchOpen(false); 
          }}
          onClose={() => setIsImageSearchOpen(false)}
        />
      )}

      <header className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center justify-between border-b border-stone-200">
        <div className="flex items-center gap-3">
          <button onClick={handleCancel} className="p-2 text-stone-500 hover:bg-stone-100 rounded-full transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <h1 className="text-xl font-bold text-stone-800">{seed.id ? 'Edit Seed' : 'New Seed'}</h1>
        </div>
        <button onClick={handleSaveEdit} disabled={isSaving} className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-500 transition-colors shadow-sm disabled:opacity-50">
          {isSaving ? "Saving..." : "Save"}
        </button>
      </header>

      <div className="max-w-md mx-auto p-4 space-y-5">
        
        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={handleAutoFill}
            disabled={isAutoFilling || isSaving}
            className="py-4 bg-indigo-600 text-white font-bold rounded-xl shadow-md hover:bg-indigo-500 transition-all flex items-center justify-center gap-2 disabled:opacity-75 text-xs"
          >
            {isAutoFilling ? 'Gathering...' : '✨ Magic Fill'}
          </button>
          <button 
            onClick={() => setIsImageSearchOpen(true)}
            className="py-4 bg-blue-600 text-white font-bold rounded-xl shadow-md hover:bg-blue-500 transition-all flex items-center justify-center gap-2 text-xs"
          >
            🌐 Internet Search
          </button>
        </div>

        <section className="bg-white p-5 rounded-2xl shadow-sm border border-stone-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-stone-800 uppercase text-[10px] tracking-widest">Photos</h3>
            <button onClick={() => editPhotoInputRef.current?.click()} className="text-emerald-600 text-sm font-bold flex items-center gap-1 hover:text-emerald-500 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>Add</button>
            <input type="file" accept="image/*" capture="environment" ref={editPhotoInputRef} className="hidden" onChange={handleEditPhotoCapture} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {(editFormData.images || []).map((img: string, idx: number) => {
              const displaySrc = img.startsWith('data:image') || img.startsWith('http') ? img : signedUrls[img] || '';
              return (
                <div key={idx} className={`relative aspect-square rounded-xl overflow-hidden border-2 shadow-sm ${idx === (editFormData.primaryImageIndex || 0) ? 'border-emerald-500' : 'border-stone-200 bg-stone-100'}`}>
                  {displaySrc && <img src={displaySrc} alt="Seed" className="w-full h-full object-cover" />}
                  <div className="absolute top-1 right-1 flex flex-col gap-1">
                     <button onClick={() => setEditFormData({...editFormData, primaryImageIndex: idx})} className={`p-1.5 rounded-full backdrop-blur-sm ${idx === (editFormData.primaryImageIndex || 0) ? 'bg-emerald-500 text-white shadow-md' : 'bg-stone-900/40 text-white'}`}>
                       <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                     </button>
                     <button onClick={() => handleRemoveImage(idx)} className="p-1.5 rounded-full bg-red-500/80 backdrop-blur-sm text-white hover:bg-red-500 shadow-sm">
                       <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                     </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="bg-white p-5 rounded-2xl shadow-sm border border-stone-200 space-y-4">
          <h3 className="font-bold text-stone-800 border-b border-stone-100 pb-2 uppercase text-[10px] tracking-widest">Basic Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><label className="block text-xs font-medium text-stone-500 mb-1">Shortcode ID <span className="text-red-400">*</span></label><input type="text" value={editFormData.id} onChange={(e) => setEditFormData({ ...editFormData, id: e.target.value.toUpperCase() })} className="w-full bg-stone-50 border border-stone-300 rounded-lg p-2.5 text-stone-800 font-mono outline-none focus:border-emerald-500 uppercase" /></div>
            <div className="col-span-2"><label className="block text-xs font-medium text-stone-500 mb-1">Variety Name</label><input type="text" value={editFormData.variety_name} onChange={(e) => setEditFormData({ ...editFormData, variety_name: e.target.value })} className="w-full bg-stone-50 border border-stone-300 rounded-lg p-2.5 text-stone-800 font-bold outline-none focus:border-emerald-500" /></div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-stone-500 mb-1">Category</label>
              <select value={editFormData.category} onChange={(e) => {
                  const val = e.target.value;
                  if (val === '__NEW__') { setShowNewCatForm(true); setNewCatName(""); setNewCatPrefix(""); } else setShowNewCatForm(false);
                  setEditFormData({ ...editFormData, category: val });
                }} className="w-full bg-stone-50 border border-stone-300 rounded-lg p-2.5 text-stone-800 outline-none focus:border-emerald-500 appearance-none">
                <option value="" disabled>Select...</option>
                {categories.map((c: SeedCategory) => <option key={c.name} value={c.name}>{c.name}</option>)}
                <option value="__NEW__" className="font-bold text-emerald-600">+ Add New Category</option>
              </select>
            </div>
            {showNewCatForm && (
              <div className="col-span-2 p-3 bg-emerald-50 rounded-lg border border-emerald-200 grid grid-cols-2 gap-3">
                <div><label className="block text-[10px] font-medium text-emerald-800 mb-1">New Cat Name</label><input type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} className="w-full bg-white border border-emerald-300 rounded-md p-2 text-sm outline-none" /></div>
                <div><label className="block text-[10px] font-medium text-emerald-800 mb-1">Prefix (1-2 char)</label><input type="text" maxLength={2} value={newCatPrefix} onChange={(e) => setNewCatPrefix(e.target.value.toUpperCase())} className="w-full bg-white border border-emerald-300 rounded-md p-2 text-sm uppercase outline-none" /></div>
              </div>
            )}
            {isPepper && (
               <div className="col-span-2 bg-red-50 p-3 rounded-lg border border-red-100 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-red-800">
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" /></svg>
                     <label className="block text-xs font-bold mb-0">Scoville Rating (SHU)</label>
                  </div>
                  <input type="number" value={editFormData.scoville_rating || ''} onChange={(e) => setEditFormData({ ...editFormData, scoville_rating: e.target.value })} placeholder="e.g. 50000" className="w-1/2 bg-white border border-red-200 rounded-md p-2 text-stone-800 font-bold outline-none focus:border-red-500" />
               </div>
            )}
            <div className="col-span-2"><label className="block text-xs font-medium text-stone-500 mb-1">Botanical Species</label><input type="text" value={editFormData.species} onChange={(e) => setEditFormData({ ...editFormData, species: e.target.value })} className="w-full bg-stone-50 border border-stone-300 rounded-lg p-2.5 text-stone-800 italic outline-none focus:border-emerald-500" /></div>
            <div><label className="block text-xs font-medium text-stone-500 mb-1">Vendor / Source</label><input type="text" value={editFormData.vendor} onChange={(e) => setEditFormData({ ...editFormData, vendor: e.target.value })} className="w-full bg-stone-50 border border-stone-300 rounded-lg p-2.5 text-stone-800 outline-none focus:border-emerald-500" /></div>
            <div><label className="block text-xs font-medium text-stone-500 mb-1">Life Cycle</label><input type="text" value={editFormData.lifecycle} onChange={(e) => setEditFormData({ ...editFormData, lifecycle: e.target.value })} className="w-full bg-stone-50 border border-stone-300 rounded-lg p-2.5 text-stone-800 outline-none focus:border-emerald-500" /></div>
          </div>
        </section>

        <section className="bg-white p-5 rounded-2xl shadow-sm border border-stone-200 space-y-4">
          <h3 className="font-bold text-stone-800 border-b border-stone-100 pb-2 uppercase text-[10px] tracking-widest">Planting Specs</h3>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium text-stone-500 mb-1">Days to Maturity</label><input type="number" value={editFormData.days_to_maturity} onChange={(e) => setEditFormData({ ...editFormData, days_to_maturity: e.target.value })} className="w-full bg-stone-50 border border-stone-300 rounded-lg p-2.5 text-stone-800 outline-none focus:border-emerald-500" /></div>
            <div><label className="block text-xs font-medium text-stone-500 mb-1">Sunlight</label><input type="text" value={editFormData.sunlight} onChange={(e) => setEditFormData({ ...editFormData, sunlight: e.target.value })} className="w-full bg-stone-50 border border-stone-300 rounded-lg p-2.5 text-stone-800 outline-none focus:border-emerald-500" /></div>
            <div><label className="block text-xs font-medium text-stone-500 mb-1">Plant Spacing</label><input type="text" value={editFormData.plant_spacing} onChange={(e) => setEditFormData({ ...editFormData, plant_spacing: e.target.value })} className="w-full bg-stone-50 border border-stone-300 rounded-lg p-2.5 text-stone-800 outline-none focus:border-emerald-500" /></div>
            <div><label className="block text-xs font-medium text-stone-500 mb-1">Row Spacing</label><input type="text" value={editFormData.row_spacing} onChange={(e) => setEditFormData({ ...editFormData, row_spacing: e.target.value })} className="w-full bg-stone-50 border border-stone-300 rounded-lg p-2.5 text-stone-800 outline-none focus:border-emerald-500" /></div>
            <div className="col-span-2"><label className="block text-xs font-medium text-stone-500 mb-1">Seed Depth</label><input type="text" value={editFormData.seed_depth} onChange={(e) => setEditFormData({ ...editFormData, seed_depth: e.target.value })} className="w-full bg-stone-50 border border-stone-300 rounded-lg p-2.5 text-stone-800 outline-none focus:border-emerald-500" /></div>
          </div>
        </section>

        <section className="bg-white p-5 rounded-2xl shadow-sm border border-stone-200 space-y-4">
          <h3 className="font-bold text-stone-800 border-b border-stone-100 pb-2 uppercase text-[10px] tracking-widest">Germination Needs</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><label className="block text-xs font-medium text-stone-500 mb-1">Days to Germination</label><input type="text" value={editFormData.germination_days} onChange={(e) => setEditFormData({ ...editFormData, germination_days: e.target.value })} className="w-full bg-stone-50 border border-stone-300 rounded-lg p-2.5 text-stone-800 outline-none focus:border-emerald-500" /></div>
            <div className="flex items-center gap-2 p-2 bg-stone-50 rounded-lg border border-stone-200"><input type="checkbox" checked={editFormData.light_required} onChange={(e) => setEditFormData({ ...editFormData, light_required: e.target.checked })} className="w-4 h-4 accent-emerald-600" /><label className="text-sm font-medium text-stone-700">Needs Light</label></div>
            <div className="flex items-center gap-2 p-2 bg-stone-50 rounded-lg border border-stone-200"><input type="checkbox" checked={editFormData.cold_stratification} onChange={(e) => setEditFormData({ ...editFormData, cold_stratification: e.target.checked })} className="w-4 h-4 accent-emerald-600" /><label className="text-sm font-medium text-stone-700">Cold Strat.</label></div>
            {editFormData.cold_stratification && (<div className="col-span-2"><label className="block text-xs font-medium text-stone-500 mb-1">Stratification Days</label><input type="number" value={editFormData.stratification_days} onChange={(e) => setEditFormData({ ...editFormData, stratification_days: e.target.value })} className="w-full bg-stone-50 border border-stone-300 rounded-lg p-2.5 text-stone-800 outline-none focus:border-emerald-500" /></div>)}
          </div>
        </section>

        <section className="bg-white p-5 rounded-2xl shadow-sm border border-stone-200 space-y-4">
          <div><label className="block text-xs font-medium text-stone-500 mb-1">Companion Plants (comma separated)</label><input type="text" value={(editFormData.companion_plants || []).join(', ')} onChange={(e) => setEditFormData({ ...editFormData, companion_plants: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} className="w-full bg-stone-50 border border-stone-300 rounded-lg p-2.5 text-stone-800 outline-none focus:border-emerald-500" /></div>
          <div><label className="block text-xs font-bold text-stone-800 mb-2 uppercase text-[10px] tracking-widest">Growing Notes</label><textarea value={editFormData.notes} onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })} rows={5} className="w-full bg-stone-50 border border-stone-300 rounded-lg p-3 text-stone-800 outline-none focus:border-emerald-500 resize-none leading-relaxed text-sm" /></div>
        </section>

        {seed.id && <button onClick={handleDeleteSeed} className="w-full py-4 mt-4 bg-red-50 text-red-600 font-bold rounded-xl border border-red-200 hover:bg-red-100 transition-colors flex items-center justify-center gap-2"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>Delete Seed Permanently</button>}
      </div>
    </main>
  );
}