import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { InventorySeed, SeedCategory } from '../types';
import { fetchWithRetry, getBestModel } from '../lib/utils';
import ImageSearch from './ImageSearch';

// Fast, synchronous conversion of base64 to binary Blob
const base64ToBlob = (base64: string, mimeType: string): Blob => {
  const byteString = atob(base64.split(',')[1]);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeType });
};

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
  const [editFormData, setEditFormData] = useState<any>(seed);
  const [showNewCatForm, setShowNewCatForm] = useState(seed.category === '__NEW__' || !!seed.newCatName);
  const [newCatName, setNewCatName] = useState(seed.newCatName || "");
  const [newCatPrefix, setNewCatPrefix] = useState(seed.newCatPrefix || "");
  
  const [isAutoFilling, setIsAutoFilling] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isImageSearchOpen, setIsImageSearchOpen] = useState(false);
  
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const editPhotoInputRef = useRef<HTMLInputElement>(null);

  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";

  useEffect(() => {
    let isMounted = true;
    
    const loadUrls = async () => {
      try {
        if (!editFormData.images || !Array.isArray(editFormData.images) || editFormData.images.length === 0) return;
        
        const urlsToFetch = editFormData.images.filter((img: string) => 
          img && typeof img === 'string' && !img.startsWith('data:') && !img.startsWith('http')
        );
        
        if (urlsToFetch.length === 0) return;

        const fetchedUrls: Record<string, string> = {};
        const { data, error } = await supabase.storage.from('talawa_media').createSignedUrls(urlsToFetch, 3600);
        
        if (data && !error) {
          data.forEach((item: any) => { 
            if (item.signedUrl) fetchedUrls[item.path] = item.signedUrl; 
          });
        } else {
          for (const path of urlsToFetch) {
            const { data: d } = await supabase.storage.from('talawa_media').createSignedUrl(path, 3600);
            if (d?.signedUrl) fetchedUrls[path] = d.signedUrl;
          }
        }
        
        if (isMounted && Object.keys(fetchedUrls).length > 0) {
          setSignedUrls(prev => ({ ...prev, ...fetchedUrls }));
        }
      } catch (err) { 
        console.error("Error fetching signed URLs:", err); 
      }
    };
    
    loadUrls();
    
    return () => { isMounted = false; };
  }, [editFormData.images]);

  const handleEditPhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => { 
        setEditFormData({ 
          ...editFormData, 
          images: [...(editFormData.images || []), reader.result as string] 
        }); 
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAutoFill = async () => {
    setIsAutoFilling(true);
    try {
      if (!apiKey) throw new Error("Missing API Key!");
      
      const modelToUse = await getBestModel();
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${apiKey}`;
      
      const payload = {
        contents: [{ 
          role: "user", 
          parts: [{ 
            text: `Variety: "${editFormData.variety_name}". Current data: ${JSON.stringify(editFormData)}. Fill in ALL missing botanical details (Days to maturity, sunlight, spacing, etc.) accurately. If it is a tomato, determine if it is Determinate or Indeterminate.` 
          }] 
        }],
        systemInstruction: { 
          parts: [{ 
            text: `You are a master horticulturist AI. Extract accurate botanical data into structured JSON. Respond ONLY with a valid JSON object matching this structure exactly (use null for unknown numbers, "" for unknown strings):
            {
              "variety_name": "string",
              "vendor": "string",
              "days_to_maturity": number or null,
              "species": "string",
              "category": "string",
              "tomato_type": "string (Determinate, Indeterminate, Semi-Determinate, or Dwarf/Micro)",
              "notes": "string",
              "companion_plants": ["string"],
              "seed_depth": "string",
              "plant_spacing": "string",
              "row_spacing": "string",
              "germination_days": "string",
              "sunlight": "string",
              "lifecycle": "string",
              "cold_stratification": boolean,
              "stratification_days": number or null,
              "light_required": boolean,
              "scoville_rating": number or null
            }` 
          }] 
        },
        tools: [{ google_search: {} }]
      };

      const result = await fetchWithRetry(url, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(payload) 
      }, 3);

      const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (textResponse) {
        const parsedData = JSON.parse(textResponse.replace(/```json/g, '').replace(/```/g, '').trim());
        for (const key in parsedData) { 
          if (parsedData[key] === null) parsedData[key] = ""; 
        }
        setEditFormData((prev: any) => ({ ...prev, ...parsedData }));
      }
    } catch (e: any) { 
      alert("Auto-fill failed: " + e.message); 
    } finally { 
      setIsAutoFilling(false); 
    }
  };

  const handleSaveEdit = async () => {
    if (!editFormData.id.trim()) { alert("ID is required."); return; }
    setIsSaving(true);
    
    try {
      const isNewRecord = !inventory.some((s: InventorySeed) => s.id === seed.id);
      
      let finalCatName = editFormData.category;
      if (editFormData.category === '__NEW__' && newCatName.trim() !== '') {
        finalCatName = newCatName.trim();
        const finalPrefix = newCatPrefix.trim().toUpperCase() || finalCatName.substring(0, 2).toUpperCase();
        
        await supabase.from('seed_categories').insert([{ name: finalCatName, prefix: finalPrefix }]);
        setCategories([...categories, { name: finalCatName, prefix: finalPrefix }].sort((a: any, b: any) => a.name.localeCompare(b.name)));
      }

      const folderName = btoa(editFormData.id).replace(/=/g, ''); 
      
      // OPTIMIZATION 1: Process images in parallel and SKIP existing bucket paths
      const uploadPromises = (editFormData.images || []).map(async (img: string) => {
        if (img.startsWith('data:') || img.startsWith('http')) {
          const optimizedBase64 = await resizeImage(img, 1600, 0.8);
          if (optimizedBase64) {
             const blob = base64ToBlob(optimizedBase64, 'image/jpeg');
             const fileName = `${crypto.randomUUID()}.jpg`;
             const filePath = `${folderName}/${fileName}`;
             await supabase.storage.from('talawa_media').upload(filePath, blob, { contentType: 'image/jpeg' });
             return filePath;
          }
        }
        return img; // Return the original path if it's already safely in the bucket
      });

      const uploadedImagePaths = await Promise.all(uploadPromises);
      
      // OPTIMIZATION 2: Only generate thumbnail if it's missing or the primary image changed
      let newThumbnail = editFormData.thumbnail || "";
      const primaryIdx = editFormData.primaryImageIndex || 0;
      
      const currentPrimaryImgSource = editFormData.images?.[primaryIdx]; 
      const originalPrimaryImgSource = seed.images?.[seed.primaryImageIndex || 0];

      const needsNewThumbnail = !newThumbnail || currentPrimaryImgSource !== originalPrimaryImgSource;

      if (needsNewThumbnail && currentPrimaryImgSource) {
        let sourceToResize = currentPrimaryImgSource;
        
        // If it's a bucket path (not a raw base64 or external HTTP link), we need an accessible URL
        if (!sourceToResize.startsWith('data:') && !sourceToResize.startsWith('http')) {
           sourceToResize = signedUrls[sourceToResize];
           
           // Failsafe: If the state hasn't resolved the URL yet, fetch a temporary one instantly
           if (!sourceToResize) {
              const { data } = await supabase.storage.from('talawa_media').createSignedUrl(currentPrimaryImgSource, 60);
              if (data?.signedUrl) sourceToResize = data.signedUrl;
           }
        }

        if (sourceToResize) {
           newThumbnail = await resizeImage(sourceToResize, 150, 0.6);
        }
      }
      
      const payloadToSave: any = { 
        ...editFormData, 
        category: finalCatName,
        images: uploadedImagePaths, 
        thumbnail: newThumbnail,
        days_to_maturity: editFormData.days_to_maturity === "" ? null : Number(editFormData.days_to_maturity),
        stratification_days: editFormData.stratification_days === "" ? null : Number(editFormData.stratification_days),
        scoville_rating: editFormData.scoville_rating === "" ? null : Number(editFormData.scoville_rating),
        tomato_type: editFormData.tomato_type || null,
        parent_id_female: editFormData.parent_id_female || null,
        parent_id_male: editFormData.parent_id_male || null,
      };

      const { 
        newCatName: _newCatName, 
        newCatPrefix: _newCatPrefix, 
        returnTo: _returnTo, 
        returnPayload: _returnPayload, 
        ...cleanPayloadToSave 
      } = payloadToSave;
      
      if (isNewRecord) {
        const { error } = await supabase.from('seed_inventory').insert([cleanPayloadToSave]);
        if (error) throw new Error("Insert Error: " + error.message);
      } else {
        const { error } = await supabase.from('seed_inventory').update(cleanPayloadToSave).eq('id', seed.id);
        if (error) throw new Error("Update Error: " + error.message);
      }
      
      const updatedInventory = isNewRecord ? [cleanPayloadToSave, ...inventory] : inventory.map((s: InventorySeed) => s.id === seed.id ? cleanPayloadToSave : s);
      setInventory(updatedInventory);
      
      navigateTo('vault');
      
    } catch (e: any) { 
      alert(e.message); 
    } finally { 
      setIsSaving(false); 
    }
  };

  const handleDeleteSeed = async () => {
    if (confirm(`Are you sure you want to permanently delete ${seed.variety_name} (${seed.id})?`)) {
      const { error } = await supabase.from('seed_inventory').delete().eq('id', seed.id);
      if (!error) { 
        setInventory(inventory.filter((s: InventorySeed) => s.id !== seed.id)); 
        navigateTo('vault'); 
      }
    }
  };

  const handleCancel = () => { 
    handleGoBack('vault');
  };

  const isPepper = editFormData.category?.toLowerCase().includes('pepper') || newCatName.toLowerCase().includes('pepper');
  const isTomato = editFormData.category?.toLowerCase().includes('tomato') || newCatName.toLowerCase().includes('tomato');

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900 pb-20 font-sans">
      {isImageSearchOpen && (
        <ImageSearch 
          baseQuery={`${editFormData.vendor || ''} ${editFormData.variety_name || ''}`.trim()}
          species={editFormData.species}
          category={editFormData.category}
          onSelect={(url: string) => { 
            setEditFormData({ ...editFormData, images: [...(editFormData.images || []), url] }); 
            setIsImageSearchOpen(false); 
          }}
          onClose={() => setIsImageSearchOpen(false)}
        />
      )}
      
      <header className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center justify-between border-b border-stone-200">
        <div className="flex items-center gap-3">
          <button onClick={handleCancel} className="p-2 text-stone-500 hover:bg-stone-100 rounded-full transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-stone-800">
            {inventory.some((s: InventorySeed) => s.id === seed.id) ? 'Edit Seed' : 'New Seed'}
          </h1>
        </div>
        <button 
          onClick={handleSaveEdit} 
          disabled={isSaving} 
          className="px-5 py-2 bg-emerald-600 text-white font-black rounded-xl shadow-sm disabled:opacity-50 transition-colors hover:bg-emerald-700 tracking-wide"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </header>

      <div className="max-w-md mx-auto p-4 space-y-5">
        <div className="grid grid-cols-2 gap-3">
           <button onClick={() => setIsImageSearchOpen(true)} className="py-4 bg-blue-600 text-white font-black rounded-xl shadow-md text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all">
             🌐 Internet Search
           </button>
           <button onClick={handleAutoFill} disabled={isAutoFilling} className="py-4 bg-indigo-600 text-white font-black rounded-xl shadow-md text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50">
             ✨ Magic AutoFill
           </button>
        </div>

        <section className="bg-white p-5 rounded-3xl shadow-sm border border-stone-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-black text-stone-800 uppercase text-[10px] tracking-[0.2em]">Photos</h3>
            <button onClick={() => editPhotoInputRef.current?.click()} className="text-emerald-600 text-xs font-black uppercase tracking-widest flex items-center gap-1 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-100 shadow-sm active:scale-95 transition-transform">
              Add Photo
            </button>
            <input type="file" accept="image/*" capture="environment" ref={editPhotoInputRef} className="hidden" onChange={handleEditPhotoCapture} />
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            {(editFormData.images || []).map((img: string, idx: number) => {
              const displaySrc = img.startsWith('data:') || img.startsWith('http') ? img : signedUrls[img] || '';
              return (
                <div key={idx} className={`relative aspect-square rounded-2xl overflow-hidden border-2 shadow-sm ${idx === (editFormData.primaryImageIndex || 0) ? 'border-emerald-500' : 'border-stone-200 bg-stone-100'}`}>
                  {displaySrc ? (
                    <img src={displaySrc} alt="Seed" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-stone-300">
                      <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                  )}
                  <div className="absolute top-1 right-1 flex flex-col gap-1">
                     <button onClick={() => setEditFormData({...editFormData, primaryImageIndex: idx})} className={`p-1.5 rounded-full backdrop-blur-sm ${idx === (editFormData.primaryImageIndex || 0) ? 'bg-emerald-500 text-white shadow-md' : 'bg-stone-900/40 text-white shadow-sm'}`}>
                       <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                     </button>
                     <button onClick={() => setEditFormData({ ...editFormData, images: (editFormData.images || []).filter((_: string, i: number) => i !== idx) })} className="p-1.5 rounded-full bg-red-500/80 backdrop-blur-sm text-white shadow-sm">
                       <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                     </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="bg-white p-6 rounded-3xl shadow-sm border border-stone-200 space-y-4">
          <h3 className="font-black text-stone-800 border-b border-stone-100 pb-2 uppercase text-[10px] tracking-[0.2em] text-stone-400">Basic Info</h3>
          
          <div>
            <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Shortcode ID</label>
            <input type="text" value={editFormData.id} onChange={(e) => setEditFormData({ ...editFormData, id: e.target.value.toUpperCase() })} className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 font-mono uppercase font-bold outline-none focus:border-emerald-500 transition-colors shadow-sm" />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
             <div className="col-span-2">
               <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Variety Name</label>
               <input type="text" value={editFormData.variety_name} onChange={(e) => setEditFormData({ ...editFormData, variety_name: e.target.value })} className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 font-bold text-sm outline-none focus:border-emerald-500 transition-colors shadow-sm" />
             </div>
             <div>
               <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Species</label>
               <input type="text" value={editFormData.species || ''} onChange={(e) => setEditFormData({ ...editFormData, species: e.target.value })} className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm italic outline-none focus:border-emerald-500 transition-colors shadow-sm" />
             </div>
             <div>
               <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Vendor</label>
               <input type="text" value={editFormData.vendor || ''} onChange={(e) => setEditFormData({ ...editFormData, vendor: e.target.value })} className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-emerald-500 transition-colors shadow-sm" />
             </div>
          </div>
          
          <div>
            <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Category</label>
            <select 
              value={editFormData.category} 
              onChange={(e) => { 
                const val = e.target.value; 
                setShowNewCatForm(val === '__NEW__'); 
                setEditFormData({ ...editFormData, category: val }); 
              }} 
              className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-emerald-500 transition-colors shadow-sm appearance-none"
            >
              <option value="" disabled>Select...</option>
              {categories.map((c: any) => <option key={c.name} value={c.name}>{c.name}</option>)}
              <option value="__NEW__" className="text-emerald-600 font-bold">+ New Category</option>
            </select>
          </div>

          {showNewCatForm && (
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 grid grid-cols-2 gap-3 animate-in slide-in-from-top-2">
              <div className="col-span-2 text-[9px] font-black text-emerald-800 uppercase mb-1">Define New Category</div>
              <div>
                <input type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="Name" className="w-full bg-white border border-emerald-200 rounded-lg p-2 text-xs outline-none" />
              </div>
              <div>
                <input type="text" maxLength={2} value={newCatPrefix} onChange={(e) => setNewCatPrefix(e.target.value.toUpperCase())} placeholder="Prefix" className="w-full bg-white border border-emerald-200 rounded-lg p-2 text-xs outline-none uppercase" />
              </div>
            </div>
          )}

          {isPepper && (
             <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex items-center justify-between shadow-sm mt-3 animate-in fade-in zoom-in-95">
                <span className="text-[10px] font-black text-red-800 uppercase tracking-widest">Scoville Rating</span>
                <input type="number" value={editFormData.scoville_rating || ''} onChange={(e) => setEditFormData({ ...editFormData, scoville_rating: e.target.value })} className="w-24 bg-white border border-red-200 rounded-lg p-2 text-sm font-black text-red-600 text-right outline-none" placeholder="SHU" />
             </div>
          )}

          {isTomato && (
             <div className="bg-rose-50 p-4 rounded-xl border border-rose-100 flex items-center justify-between shadow-sm mt-3 animate-in fade-in zoom-in-95">
                <span className="text-[10px] font-black text-rose-800 uppercase tracking-widest">Tomato Type</span>
                <select 
                  value={editFormData.tomato_type || ''} 
                  onChange={(e) => setEditFormData({ ...editFormData, tomato_type: e.target.value })} 
                  className="bg-white border border-rose-200 rounded-lg p-2 text-sm font-black text-rose-700 outline-none cursor-pointer"
                >
                  <option value="">Select Type...</option>
                  <option value="Determinate">Determinate</option>
                  <option value="Indeterminate">Indeterminate</option>
                  <option value="Semi-Determinate">Semi-Determinate</option>
                  <option value="Dwarf/Micro">Dwarf/Micro</option>
                </select>
             </div>
          )}
        </section>

        {/* LINEAGE & GENETICS SECTION */}
        <section className="bg-purple-50 p-6 rounded-3xl shadow-sm border border-purple-200 space-y-4">
          <h3 className="font-black text-purple-800 border-b border-purple-200/50 pb-2 uppercase text-[10px] tracking-[0.2em] flex items-center gap-2">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            Lineage & Genetics
          </h3>
          <div>
            <label className="block text-[10px] font-black text-purple-500 uppercase tracking-widest mb-1.5 ml-1">Generation / Strain Info</label>
            <input 
              type="text" 
              placeholder="e.g., F1, F2, F3, Gen 4..." 
              value={editFormData.generation || ''} 
              onChange={(e) => setEditFormData({ ...editFormData, generation: e.target.value })} 
              className="w-full bg-white border border-purple-200 rounded-xl p-3 text-sm shadow-sm outline-none focus:border-purple-500" 
            />
          </div>
          <div className="grid grid-cols-1 gap-4 mt-2">
             <div>
                <label className="block text-[10px] font-black text-purple-500 uppercase tracking-widest mb-1.5 ml-1">Seed Parent (Mother ♀)</label>
                <select 
                  value={editFormData.parent_id_female || ''} 
                  onChange={(e) => setEditFormData({ ...editFormData, parent_id_female: e.target.value })} 
                  className="w-full bg-white border border-purple-200 rounded-xl p-3 text-sm shadow-sm outline-none focus:border-purple-500 appearance-none font-medium"
                >
                  <option value="">-- None / Unknown --</option>
                  {inventory.filter((s: InventorySeed) => s.id !== seed.id).map((s: InventorySeed) => (
                    <option key={s.id} value={s.id}>{s.id} - {s.variety_name}</option>
                  ))}
                </select>
             </div>
             <div>
                <label className="block text-[10px] font-black text-purple-500 uppercase tracking-widest mb-1.5 ml-1">Pollen Parent (Father ♂)</label>
                <select 
                  value={editFormData.parent_id_male || ''} 
                  onChange={(e) => setEditFormData({ ...editFormData, parent_id_male: e.target.value })} 
                  className="w-full bg-white border border-purple-200 rounded-xl p-3 text-sm shadow-sm outline-none focus:border-purple-500 appearance-none font-medium text-stone-600"
                >
                  <option value="">-- Self-Pollinated / Unknown --</option>
                  {inventory.filter((s: InventorySeed) => s.id !== seed.id).map((s: InventorySeed) => (
                    <option key={s.id} value={s.id}>{s.id} - {s.variety_name}</option>
                  ))}
                </select>
             </div>
          </div>
        </section>

        <section className="bg-white p-6 rounded-3xl shadow-sm border border-stone-200 space-y-4">
          <h3 className="font-black text-stone-800 border-b border-stone-100 pb-2 uppercase text-[10px] tracking-[0.2em] text-stone-400">Growth Specs</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Days to Maturity</label>
              <input type="number" value={editFormData.days_to_maturity || ''} onChange={(e) => setEditFormData({ ...editFormData, days_to_maturity: e.target.value })} className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm font-bold shadow-sm outline-none focus:border-emerald-500" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Lifecycle</label>
              <input type="text" value={editFormData.lifecycle || ''} onChange={(e) => setEditFormData({ ...editFormData, lifecycle: e.target.value })} className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm shadow-sm outline-none focus:border-emerald-500" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Sunlight</label>
              <input type="text" value={editFormData.sunlight || ''} onChange={(e) => setEditFormData({ ...editFormData, sunlight: e.target.value })} className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm shadow-sm outline-none focus:border-emerald-500" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Germination Days</label>
              <input type="text" value={editFormData.germination_days || ''} onChange={(e) => setEditFormData({ ...editFormData, germination_days: e.target.value })} className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm shadow-sm outline-none focus:border-emerald-500" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Seed Depth</label>
              <input type="text" value={editFormData.seed_depth || ''} onChange={(e) => setEditFormData({ ...editFormData, seed_depth: e.target.value })} className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2 text-xs shadow-sm outline-none focus:border-emerald-500" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Plant Space</label>
              <input type="text" value={editFormData.plant_spacing || ''} onChange={(e) => setEditFormData({ ...editFormData, plant_spacing: e.target.value })} className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2 text-xs shadow-sm outline-none focus:border-emerald-500" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Row Space</label>
              <input type="text" value={editFormData.row_spacing || ''} onChange={(e) => setEditFormData({ ...editFormData, row_spacing: e.target.value })} className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2 text-xs shadow-sm outline-none focus:border-emerald-500" />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <button 
              onClick={() => setEditFormData({...editFormData, light_required: !editFormData.light_required})}
              className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${editFormData.light_required ? 'bg-amber-100 border-amber-300 text-amber-700 shadow-sm' : 'bg-stone-100 border-stone-200 text-stone-400'}`}
            >
              Light Required
            </button>
            <button 
              onClick={() => setEditFormData({...editFormData, cold_stratification: !editFormData.cold_stratification})}
              className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${editFormData.cold_stratification ? 'bg-blue-100 border-blue-300 text-blue-700 shadow-sm' : 'bg-stone-100 border-stone-200 text-stone-400'}`}
            >
              Cold Strat
            </button>
          </div>

          {editFormData.cold_stratification && (
            <div className="animate-in slide-in-from-left-2 p-3 bg-blue-50/50 rounded-2xl border border-blue-100">
              <label className="block text-[9px] font-black text-blue-800 uppercase tracking-widest mb-1 ml-1">Stratification Days</label>
              <input type="number" value={editFormData.stratification_days || ''} onChange={(e) => setEditFormData({ ...editFormData, stratification_days: e.target.value })} className="w-full bg-white border border-blue-200 rounded-xl p-3 text-sm outline-none shadow-sm" />
            </div>
          )}
        </section>

        <section className="bg-white p-6 rounded-3xl shadow-sm border border-stone-200 space-y-4">
          <h3 className="font-black text-stone-800 border-b border-stone-100 pb-2 uppercase text-[10px] tracking-[0.2em] text-stone-400">Notes</h3>
          <div>
            <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Companion Plants (comma separated)</label>
            <input 
              type="text" 
              value={(editFormData.companion_plants || []).join(', ')} 
              onChange={(e) => setEditFormData({ 
                ...editFormData, 
                companion_plants: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean) 
              })} 
              className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm font-medium shadow-sm outline-none focus:border-emerald-500" 
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Growing Notes</label>
            <textarea 
              value={editFormData.notes || ''} 
              onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })} 
              rows={5} 
              className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm shadow-sm resize-none outline-none focus:border-emerald-500" 
              placeholder="Vendor tips, germination notes, past performance..." 
            />
          </div>
        </section>

        {inventory.some((s: InventorySeed) => s.id === seed.id) && (
          <button 
            onClick={handleDeleteSeed} 
            className="w-full py-4 mt-2 bg-red-50 text-red-600 font-bold rounded-2xl border border-red-200 hover:bg-red-100 transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete Seed Permanently
          </button>
        )}
      </div>
    </main>
  );
}