import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { InventorySeed, SeedCategory } from '../types';
import { fetchWithRetry, getBestModel } from '../lib/utils';

// Universal Resizer: Downscales huge files to an optimal size/quality to save bucket space
const resizeImage = (source: string, maxSize: number, quality: number): Promise<string> => {
  return new Promise((resolve) => {
    if (!source) return resolve("");
    
    const img = new Image();
    img.crossOrigin = "anonymous"; // Required to prevent tainted canvas when reading signed URLs
    
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
        resolve(""); // Tainted canvas fallback
      }
    };
    img.onerror = () => resolve("");
    
    // If it's a random internet URL, proxy it to grab the bytes securely without CORS blocking the canvas
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
  
  // Stores temporary signed URLs for viewing private bucket images in the UI
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const editPhotoInputRef = useRef<HTMLInputElement>(null);

  // Auto-generate secure signed URLs for any storage paths
  useEffect(() => {
    const loadUrls = async () => {
      const newUrls: Record<string, string> = { ...signedUrls };
      let changed = false;

      for (const img of (editFormData.images || [])) {
        if (!img.startsWith('data:image') && !img.startsWith('http') && !newUrls[img]) {
          const { data } = await supabase.storage.from('talawa_media').createSignedUrl(img, 3600); // 1-hour expiry
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

  const handleSaveEdit = async () => {
    if (!editFormData.id.trim()) { alert("Shortcode ID is required."); return; }
    
    // Disable the button INSTANTLY before any async network requests happen
    setIsSaving(true);
    
    try {
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
      } else if (editFormData.category === '__NEW__') {
        alert("Please provide a name for the new category."); return;
      }

      const uploadedImagePaths = [];
      // Obfuscate the folder name using Base64 encoding of the Seed ID
      const folderName = btoa(editFormData.id).replace(/=/g, ''); 

      for (const img of (editFormData.images || [])) {
        if (img.startsWith('data:image') || img.startsWith('http')) {
          // 1. Resize large image, base64, or external web link to max 1600px
          const optimizedBase64 = await resizeImage(img, 1600, 0.8);
          
          if (optimizedBase64) {
             const res = await fetch(optimizedBase64);
             const blob = await res.blob();
             
             // 2. Generate obfuscated UUID filename
             const fileName = `${crypto.randomUUID()}.jpg`;
             const filePath = `${folderName}/${fileName}`;
             
             // 3. Upload to private Supabase bucket
             const { error: uploadErr } = await supabase.storage.from('talawa_media').upload(filePath, blob, { contentType: 'image/jpeg' });
             if (uploadErr) throw new Error("Upload failed: " + uploadErr.message);
             
             uploadedImagePaths.push(filePath);
          } else {
             // Fallback if cross-origin completely blocked the canvas optimization
             uploadedImagePaths.push(img);
          }
        } else {
          // It's already a secure path from a previous save
          uploadedImagePaths.push(img);
        }
      }

      // Handle the ultra-fast inline thumbnail for the List View
      let newThumbnail = editFormData.thumbnail || "";
      if (uploadedImagePaths.length > 0) {
        const primaryIdx = editFormData.primaryImageIndex || 0;
        const primaryImgSource = editFormData.images[primaryIdx];
        
        // Use the base64, web url, or dynamically fetched signed URL to generate the thumbnail
        let sourceToResize = primaryImgSource;
        if (!primaryImgSource.startsWith('data:image') && !primaryImgSource.startsWith('http')) {
           sourceToResize = signedUrls[primaryImgSource]; 
        }
        
        if (sourceToResize) {
           newThumbnail = await resizeImage(sourceToResize, 150, 0.6);
        }
      }

      // Explicitly construct the database payload, converting empty strings to actual nulls for numeric columns to prevent DB crashes
      const payloadToSave: any = { 
        id: editFormData.id,
        category: finalCatName, 
        variety_name: editFormData.variety_name,
        vendor: editFormData.vendor,
        days_to_maturity: editFormData.days_to_maturity === "" ? null : Number(editFormData.days_to_maturity),
        species: editFormData.species,
        notes: editFormData.notes,
        images: uploadedImagePaths, 
        primaryImageIndex: editFormData.primaryImageIndex,
        companion_plants: editFormData.companion_plants,
        cold_stratification: editFormData.cold_stratification,
        stratification_days: editFormData.stratification_days === "" ? null : Number(editFormData.stratification_days),
        light_required: editFormData.light_required,
        germination_days: editFormData.germination_days,
        seed_depth: editFormData.seed_depth,
        plant_spacing: editFormData.plant_spacing,
        row_spacing: editFormData.row_spacing,
        sunlight: editFormData.sunlight,
        lifecycle: editFormData.lifecycle,
        scoville_rating: editFormData.scoville_rating === "" ? null : Number(editFormData.scoville_rating),
        thumbnail: newThumbnail 
      };
      
      // Check if this record already exists in the database (e.g., if it's a fresh Duplicate vs an Edit)
      const { data: existingRecords } = await supabase.from('seed_inventory').select('id').eq('id', seed.id);
      const isNewDuplicate = !existingRecords || existingRecords.length === 0;

      if (isNewDuplicate) {
        // It's a newly duplicated seed that doesn't exist yet, insert it!
        const { error } = await supabase.from('seed_inventory').insert([payloadToSave]);
        if (error) throw new Error("Failed to insert new duplicated seed: " + error.message);
      } else {
        // It's a standard edit, update the existing row!
        const { error } = await supabase.from('seed_inventory').update(payloadToSave).eq('id', seed.id);
        if (error) throw new Error("Failed to update database: " + error.message);
      }
      
      // Reconstruct local state with valid TS types to pass back to the UI seamlessly
      const savedSeed: InventorySeed = {
         ...editFormData,
         ...payloadToSave,
         days_to_maturity: payloadToSave.days_to_maturity === null ? "" : payloadToSave.days_to_maturity,
         stratification_days: payloadToSave.stratification_days === null ? "" : payloadToSave.stratification_days,
         scoville_rating: payloadToSave.scoville_rating === null ? "" : payloadToSave.scoville_rating,
      };

      navigateTo('seed_detail', savedSeed); 
      
    } catch (error: any) {
      alert(error.message);
    } finally {
      // Always re-enable the button when done, even if it failed
      setIsSaving(false);
    }
  };

  const handleDeleteSeed = async () => {
    if (confirm(`Are you sure you want to permanently delete ${seed.variety_name} (${seed.id})?`)) {
      const { error } = await supabase.from('seed_inventory').delete().eq('id', seed.id);
      if (error) alert("Failed to delete from database: " + error.message);
      else {
        navigateTo('vault');
      }
    }
  };

  const handleAutoFill = async () => {
    setIsAutoFilling(true);
    try {
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
      if (!apiKey) throw new Error("Missing API Key!");

      const modelToUse = await getBestModel();
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${apiKey}`;
      
      // Remove massive base64 images from the payload to prevent token limits
      const { images, thumbnail, ...cleanFormData } = editFormData;

      const payload = {
        contents: [{
          role: "user",
          parts: [{ text: `You are an expert horticulturist. Here is the current data for a seed named "${editFormData.variety_name}" (Vendor: ${editFormData.vendor || 'unknown'}, Category: ${editFormData.category}, Species: ${editFormData.species || 'unknown'}). \n\n${JSON.stringify(cleanFormData)}\n\nPlease fill in any missing or empty fields with accurate botanical data. Use the Google Search tool if you are unsure. Keep existing populated data intact.\n\nIMPORTANT: You must respond ONLY with a valid JSON object. Do not wrap it in markdown block quotes. The JSON must exactly match this structure (use null or defaults if unknown). If it is a pepper, try to find the Scoville Heat Unit (SHU) rating and include it as a number in scoville_rating. \n\nIMAGE SEARCH INSTRUCTIONS:\nUse the Google Search tool to find a direct image file URL (.jpg, .png, .webp). To find the best image, search exactly for: "images of the ${editFormData.variety_name} ${editFormData.category} sold by ${editFormData.vendor || 'seed vendors'}". Extract the direct raw image URL and put it in the "image_url" field. DO NOT put an HTML webpage URL. If you cannot find a direct image file, set it to null:\n{"variety_name":"","vendor":"","days_to_maturity":0,"species":"","category":"","notes":"","companion_plants":[],"seed_depth":"","plant_spacing":"","row_spacing":"","germination_days":"","sunlight":"","lifecycle":"","cold_stratification":false,"stratification_days":0,"light_required":false,"scoville_rating":null,"image_url":null}` }]
        }],
        tools: [{ google_search: {} }]
      };

      const result = await fetchWithRetry(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }, 3);
      const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (textResponse) {
        const parsedData = JSON.parse(textResponse.replace(/```json/g, '').replace(/```/g, '').trim());
        const { image_url, ...restData } = parsedData; // Separate out the temporary image_url field
        
        setEditFormData(prev => ({
          ...prev, ...restData, id: prev.id, images: prev.images, primaryImageIndex: prev.primaryImageIndex
        }));

        // Try to load the found image URL from the web to verify it isn't a dead link or HTML page
        if (image_url && image_url.startsWith('http') && (image_url.includes('.jpg') || image_url.includes('.png') || image_url.includes('.jpeg') || image_url.includes('.webp'))) {
            try {
               await new Promise((resolve, reject) => {
                   const img = new Image();
                   // Set a strict 5 second timeout so it doesn't hang forever
                   const timer = setTimeout(() => reject(new Error("Timeout")), 5000);
                   img.onload = () => { clearTimeout(timer); resolve(true); };
                   img.onerror = () => { clearTimeout(timer); reject(new Error("Image load failed")); };
                   // Proxy it to ensure it's not a CORS blocked resource for the UI
                   img.src = `https://api.allorigins.win/raw?url=${encodeURIComponent(image_url)}`;
               });
               
               // It successfully loaded! Attach it to the form
               setEditFormData(prev => ({ ...prev, images: [...(prev.images || []), image_url] }));
            } catch (e) {
               console.warn("Failed to load external image found by AI. It may have been a dead link or a webpage.");
            }
        }
      }
      
    } catch (e: any) { alert("Auto-fill failed: " + e.message); } 
    finally { setIsAutoFilling(false); }
  };

  const isPepper = editFormData.category?.toLowerCase().includes('pepper') || newCatName.toLowerCase().includes('pepper');

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900 pb-20">
      <header className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center justify-between border-b border-stone-200">
        <div className="flex items-center gap-3">
          <button onClick={() => handleGoBack('seed_detail')} className="p-2 text-stone-500 hover:bg-stone-100 rounded-full transition-colors"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
          <h1 className="text-xl font-bold text-stone-800">Edit Seed</h1>
        </div>
        <button onClick={handleSaveEdit} disabled={isSaving} className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-500 transition-colors shadow-sm disabled:opacity-50">
          {isSaving ? "Saving..." : "Save"}
        </button>
      </header>

      <div className="max-w-md mx-auto p-4 space-y-5">
        
        {/* MAGIC AUTO-FILL BUTTON */}
        <div className="space-y-3">
          <button 
            onClick={handleAutoFill}
            disabled={isAutoFilling || isSaving}
            className="w-full py-4 bg-indigo-600 text-white font-bold rounded-xl shadow-md hover:bg-indigo-500 transition-all flex items-center justify-center gap-2 disabled:opacity-75 disabled:cursor-not-allowed"
          >
            {isAutoFilling ? (
              <>
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                Gathering Data...
              </>
            ) : (
              <>
                <svg className="w-5 h-5 text-indigo-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                ✨ Auto-Fill Missing Data (AI)
              </>
            )}
          </button>
        </div>

        <section className="bg-white p-5 rounded-2xl shadow-sm border border-stone-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-stone-800">Photos</h3>
            <button onClick={() => editPhotoInputRef.current?.click()} className="text-emerald-600 text-sm font-bold flex items-center gap-1 hover:text-emerald-500 bg-emerald-50 px-3 py-1.5 rounded-lg"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>Add Photo</button>
            <input type="file" accept="image/*" capture="environment" ref={editPhotoInputRef} className="hidden" onChange={handleEditPhotoCapture} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {(!editFormData.images || editFormData.images.length === 0) && <p className="text-xs text-stone-400 col-span-3 text-center py-4">No photos attached.</p>}
            {(editFormData.images || []).map((img: string, idx: number) => {
              // Resolve display source: raw base64, URL, or secure signed URL
              const displaySrc = img.startsWith('data:image') || img.startsWith('http') ? img : signedUrls[img] || '';

              return (
                <div key={idx} className={`relative aspect-square rounded-xl overflow-hidden border-2 shadow-sm ${idx === (editFormData.primaryImageIndex || 0) ? 'border-emerald-500' : 'border-stone-200 bg-stone-100'}`}>
                  {displaySrc && <img src={displaySrc} alt="Seed" className="w-full h-full object-cover" />}
                  {!displaySrc && <div className="absolute inset-0 flex items-center justify-center"><svg className="w-5 h-5 text-stone-400 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>}
                  
                  <div className="absolute top-1 right-1 flex flex-col gap-1">
                     <button onClick={() => setEditFormData({...editFormData, primaryImageIndex: idx})} className={`p-1.5 rounded-full backdrop-blur-sm ${idx === (editFormData.primaryImageIndex || 0) ? 'bg-emerald-500 text-white shadow-md' : 'bg-stone-900/40 text-stone-100 hover:bg-stone-900/60'}`}><svg className="w-3.5 h-3.5" fill={idx === (editFormData.primaryImageIndex || 0) ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg></button>
                     <button onClick={() => handleRemoveImage(idx)} className="p-1.5 rounded-full bg-red-500/80 backdrop-blur-sm text-white hover:bg-red-500 shadow-sm"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="bg-white p-5 rounded-2xl shadow-sm border border-stone-200 space-y-4">
          <h3 className="font-bold text-stone-800 border-b border-stone-100 pb-2">Basic Info</h3>
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
            
            {/* Conditional Pepper Field */}
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
          <h3 className="font-bold text-stone-800 border-b border-stone-100 pb-2">Planting Specs</h3>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium text-stone-500 mb-1">Days to Maturity</label><input type="number" value={editFormData.days_to_maturity} onChange={(e) => setEditFormData({ ...editFormData, days_to_maturity: e.target.value })} className="w-full bg-stone-50 border border-stone-300 rounded-lg p-2.5 text-stone-800 outline-none focus:border-emerald-500" /></div>
            <div><label className="block text-xs font-medium text-stone-500 mb-1">Sunlight</label><input type="text" value={editFormData.sunlight} onChange={(e) => setEditFormData({ ...editFormData, sunlight: e.target.value })} className="w-full bg-stone-50 border border-stone-300 rounded-lg p-2.5 text-stone-800 outline-none focus:border-emerald-500" /></div>
            <div><label className="block text-xs font-medium text-stone-500 mb-1">Plant Spacing</label><input type="text" value={editFormData.plant_spacing} onChange={(e) => setEditFormData({ ...editFormData, plant_spacing: e.target.value })} className="w-full bg-stone-50 border border-stone-300 rounded-lg p-2.5 text-stone-800 outline-none focus:border-emerald-500" /></div>
            <div><label className="block text-xs font-medium text-stone-500 mb-1">Row Spacing</label><input type="text" value={editFormData.row_spacing} onChange={(e) => setEditFormData({ ...editFormData, row_spacing: e.target.value })} className="w-full bg-stone-50 border border-stone-300 rounded-lg p-2.5 text-stone-800 outline-none focus:border-emerald-500" /></div>
            <div className="col-span-2"><label className="block text-xs font-medium text-stone-500 mb-1">Seed Depth</label><input type="text" value={editFormData.seed_depth} onChange={(e) => setEditFormData({ ...editFormData, seed_depth: e.target.value })} className="w-full bg-stone-50 border border-stone-300 rounded-lg p-2.5 text-stone-800 outline-none focus:border-emerald-500" /></div>
          </div>
        </section>

        <section className="bg-white p-5 rounded-2xl shadow-sm border border-stone-200 space-y-4">
          <h3 className="font-bold text-stone-800 border-b border-stone-100 pb-2">Germination Needs</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><label className="block text-xs font-medium text-stone-500 mb-1">Days to Germination</label><input type="text" value={editFormData.germination_days} onChange={(e) => setEditFormData({ ...editFormData, germination_days: e.target.value })} className="w-full bg-stone-50 border border-stone-300 rounded-lg p-2.5 text-stone-800 outline-none focus:border-emerald-500" /></div>
            <div className="flex items-center gap-2 p-2 bg-stone-50 rounded-lg border border-stone-200"><input type="checkbox" checked={editFormData.light_required} onChange={(e) => setEditFormData({ ...editFormData, light_required: e.target.checked })} className="w-4 h-4 accent-emerald-600" /><label className="text-sm font-medium text-stone-700">Needs Light</label></div>
            <div className="flex items-center gap-2 p-2 bg-stone-50 rounded-lg border border-stone-200"><input type="checkbox" checked={editFormData.cold_stratification} onChange={(e) => setEditFormData({ ...editFormData, cold_stratification: e.target.checked })} className="w-4 h-4 accent-emerald-600" /><label className="text-sm font-medium text-stone-700">Cold Strat.</label></div>
            {editFormData.cold_stratification && (<div className="col-span-2"><label className="block text-xs font-medium text-stone-500 mb-1">Stratification Days</label><input type="number" value={editFormData.stratification_days} onChange={(e) => setEditFormData({ ...editFormData, stratification_days: e.target.value })} className="w-full bg-stone-50 border border-stone-300 rounded-lg p-2.5 text-stone-800 outline-none focus:border-emerald-500" /></div>)}
          </div>
        </section>

        <section className="bg-white p-5 rounded-2xl shadow-sm border border-stone-200 space-y-4">
          <div><label className="block text-xs font-medium text-stone-500 mb-1">Companion Plants (comma separated)</label><input type="text" value={(editFormData.companion_plants || []).join(', ')} onChange={(e) => setEditFormData({ ...editFormData, companion_plants: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} className="w-full bg-stone-50 border border-stone-300 rounded-lg p-2.5 text-stone-800 outline-none focus:border-emerald-500" /></div>
          <div><label className="block text-xs font-bold text-stone-800 mb-2">Growing Notes</label><textarea value={editFormData.notes} onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })} rows={5} className="w-full bg-stone-50 border border-stone-300 rounded-lg p-3 text-stone-800 outline-none focus:border-emerald-500 resize-none leading-relaxed" /></div>
        </section>

        <button onClick={handleDeleteSeed} disabled={isSaving} className="w-full py-4 mt-4 bg-red-50 text-red-600 font-bold rounded-xl border border-red-200 hover:bg-red-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>Delete Seed Permanently</button>
      </div>
    </main>
  );
}