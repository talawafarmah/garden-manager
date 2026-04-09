import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { InventorySeed, SeedCategory } from '../types';
import { fetchWithRetry, getBestModel } from '../lib/utils';
import ImageSearch from './ImageSearch';

const base64ToBlob = (base64: string, mimeType: string): Blob => {
  const byteString = atob(base64.split(',')[1]);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeType });
};

// --- ROBUST LOCAL PROXY DOWNLOADER ---
const fetchImageAsDataURL = async (url: string): Promise<string> => {
  if (!url) return "";
  if (url.startsWith('data:')) return url;
  
  const localProxy = `/api/proxy-image?url=${encodeURIComponent(url)}`;

  try {
    const res = await fetch(localProxy);
    if (res.ok) {
      const blob = await res.blob();
      if (!blob.type.includes('image')) return "";
      return await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    }
  } catch (e: any) {
     console.warn(`Local Proxy Fetch failed: ${e.message}`);
  }
  return "";
};

const resizeImage = async (source: string, maxSize: number, quality: number): Promise<string> => {
  let safeSource = source;
  if (source.startsWith('http') && !source.includes('supabase.co')) {
     safeSource = await fetchImageAsDataURL(source);
     if (!safeSource) return ""; 
  }

  return new Promise((resolve) => {
    const img = new Image();
    if (safeSource.startsWith('http')) img.crossOrigin = "anonymous"; 
    
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
    img.src = safeSource;
  });
};

const generateGeneticsCollage = async (motherSrc: string, fatherSrc: string): Promise<string> => {
  const safeMotherSrc = motherSrc.startsWith('http') ? await fetchImageAsDataURL(motherSrc) : motherSrc;
  const safeFatherSrc = fatherSrc.startsWith('http') ? await fetchImageAsDataURL(fatherSrc) : fatherSrc;

  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 800; canvas.height = 800;
    const ctx = canvas.getContext('2d');
    if (!ctx) return resolve("");

    ctx.fillStyle = '#e7e5e4'; 
    ctx.fillRect(0, 0, 800, 800);

    const drawSide = (src: string, isLeft: boolean) => {
      return new Promise<void>((res) => {
        if (!src) return res();
        const img = new Image();
        img.onload = () => {
          const scale = Math.max(400 / img.width, 800 / img.height);
          const w = img.width * scale;
          const h = img.height * scale;
          const x = isLeft ? (400 - w) / 2 : 400 + (400 - w) / 2;
          const y = (800 - h) / 2;
          
          ctx.save();
          ctx.beginPath();
          ctx.rect(isLeft ? 0 : 400, 0, 400, 800);
          ctx.clip();
          ctx.drawImage(img, x, y, w, h);
          ctx.restore();
          res();
        };
        img.onerror = () => res();
        img.src = src;
      });
    };

    Promise.all([drawSide(safeMotherSrc, true), drawSide(safeFatherSrc, false)]).then(() => {
      ctx.fillStyle = '#1c1917'; 
      ctx.fillRect(396, 0, 8, 800);

      ctx.font = '900 24px sans-serif';
      
      if (safeMotherSrc) {
        ctx.fillStyle = 'rgba(244, 63, 94, 0.9)'; 
        ctx.fillRect(20, 20, 140, 40);
        ctx.fillStyle = 'white';
        ctx.fillText('♀ Mother', 35, 48);
      }

      if (safeFatherSrc) {
        ctx.fillStyle = 'rgba(59, 130, 246, 0.9)'; 
        ctx.fillRect(420, 20, 140, 40);
        ctx.fillStyle = 'white';
        ctx.fillText('♂ Father', 435, 48);
      }

      ctx.beginPath();
      ctx.arc(400, 400, 40, 0, 2 * Math.PI);
      ctx.fillStyle = '#1c1917';
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#f5f5f4';
      ctx.stroke();

      ctx.fillStyle = 'white';
      ctx.font = '900 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('X', 400, 400);

      resolve(canvas.toDataURL('image/jpeg', 0.85));
    });
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
  
  const [parentSearchType, setParentSearchType] = useState<'mother' | 'father' | null>(null);
  const [parentSearchQuery, setParentSearchQuery] = useState("");
  
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
    setIsSaving(true);
    
    try {
      const isNewRecord = !inventory.some((s: InventorySeed) => s.id === seed.id);
      
      let finalCatName = editFormData.category;
      let finalCatPrefix = "";

      if (editFormData.category === '__NEW__' && newCatName.trim() !== '') {
        finalCatName = newCatName.trim();
        finalCatPrefix = newCatPrefix.trim().toUpperCase() || finalCatName.substring(0, 2).toUpperCase();
        
        await supabase.from('seed_categories').insert([{ name: finalCatName, prefix: finalCatPrefix }]);
        setCategories([...categories, { name: finalCatName, prefix: finalCatPrefix }].sort((a: any, b: any) => a.name.localeCompare(b.name)));
      }

      let finalId = editFormData.id?.trim();
      
      // --- NEW SEQUENTIAL ID GENERATOR (NO HYPHEN) ---
      if (!finalId) {
         let prefix = "SD";
         if (editFormData.category === '__NEW__' && finalCatPrefix) {
            prefix = finalCatPrefix;
         } else if (editFormData.category) {
            const cat = categories.find((c: any) => c.name === editFormData.category);
            if (cat && cat.prefix) prefix = cat.prefix;
            else prefix = editFormData.category.substring(0, 3).toUpperCase();
         }

         // Scan existing inventory to find the highest number for this prefix
         const existingIds = inventory
            .map((s: InventorySeed) => s.id)
            .filter((id: string) => id.startsWith(prefix));
            
         let maxNum = 0;
         for (const existingId of existingIds) {
            // Strip the prefix off the start of the ID
            const remainder = existingId.substring(prefix.length);
            // Extract the leading numbers from the remainder (ignoring -COPY etc)
            const match = remainder.match(/^(\d+)/);
            if (match) {
               const num = parseInt(match[1], 10);
               if (num > maxNum) {
                  maxNum = num;
               }
            }
         }
         
         // Start at 1000, or increment by 1
         const nextNum = maxNum === 0 ? 1000 : maxNum + 1;
         
         // Combine prefix and number with NO HYPHEN
         finalId = `${prefix}${nextNum}`.replace(/[^A-Z0-9]/g, '');
      }

      const folderName = btoa(finalId).replace(/=/g, ''); 
      let imagesToUpload = [...(editFormData.images || [])];

      if (imagesToUpload.length === 0 && (editFormData.parent_id_female || editFormData.parent_id_male)) {
         const mother = inventory.find((s: any) => s.id === editFormData.parent_id_female);
         const father = inventory.find((s: any) => s.id === editFormData.parent_id_male);
         
         let mSrc = mother?.thumbnail || '';
         let fSrc = father?.thumbnail || '';

         const pathsToSign = [];
         if (mSrc && !mSrc.startsWith('http') && !mSrc.startsWith('data:')) pathsToSign.push(mSrc);
         if (fSrc && !fSrc.startsWith('http') && !fSrc.startsWith('data:')) pathsToSign.push(fSrc);

         if (pathsToSign.length > 0) {
           const { data } = await supabase.storage.from('talawa_media').createSignedUrls(pathsToSign, 3600);
           if (data) {
             data.forEach((item: any) => {
               if (item.path === mSrc) mSrc = item.signedUrl;
               if (item.path === fSrc) fSrc = item.signedUrl;
             });
           }
         }

         if (mSrc || fSrc) {
            const collageBase64 = await generateGeneticsCollage(mSrc, fSrc);
            if (collageBase64) imagesToUpload.push(collageBase64);
         }
      }
      
      const uploadPromises = imagesToUpload.map(async (img: string) => {
        if (!img.startsWith('data:') && !img.startsWith('http')) return img;
        
        if (img.startsWith('data:') || (img.startsWith('http') && !img.includes('supabase.co'))) {
          const optimizedBase64 = await resizeImage(img, 1600, 0.8);
          
          if (optimizedBase64) {
             const blob = base64ToBlob(optimizedBase64, 'image/jpeg');
             const fileName = `${crypto.randomUUID()}.jpg`;
             const filePath = `${folderName}/${fileName}`;
             await supabase.storage.from('talawa_media').upload(filePath, blob, { contentType: 'image/jpeg' });
             return filePath;
          } else {
             throw new Error("One of the images could not be securely downloaded. Please delete the broken image and try selecting a different one.");
          }
        }
        
        return img; 
      });

      const uploadedImagePaths = await Promise.all(uploadPromises);
      
      let newThumbnail = editFormData.thumbnail || "";
      const primaryIdx = editFormData.primaryImageIndex || 0;
      
      const currentPrimaryImgSource = imagesToUpload?.[primaryIdx]; 
      const originalPrimaryImgSource = seed.images?.[seed.primaryImageIndex || 0];

      const needsNewThumbnail = !newThumbnail || currentPrimaryImgSource !== originalPrimaryImgSource;

      if (needsNewThumbnail && currentPrimaryImgSource) {
        let sourceToResize = currentPrimaryImgSource;
        
        if (!sourceToResize.startsWith('data:') && !sourceToResize.startsWith('http')) {
           sourceToResize = signedUrls[sourceToResize];
           if (!sourceToResize) {
              const { data } = await supabase.storage.from('talawa_media').createSignedUrl(currentPrimaryImgSource, 60);
              if (data?.signedUrl) sourceToResize = data.signedUrl;
           }
        }

        if (sourceToResize) {
           const generatedThumb = await resizeImage(sourceToResize, 150, 0.6);
           if (generatedThumb) {
               newThumbnail = generatedThumb;
           } else {
               throw new Error("Failed to generate a secure thumbnail. Please select a different image.");
           }
        }
      }

      if (newThumbnail && newThumbnail.startsWith('http') && !newThumbnail.includes('supabase.co')) {
          throw new Error("Security Block: Attempted to save an external thumbnail.");
      }
      
      const payloadToSave: any = { 
        ...editFormData, 
        id: finalId,
        category: finalCatName,
        images: uploadedImagePaths, 
        thumbnail: newThumbnail,
        days_to_maturity: editFormData.days_to_maturity === "" ? null : Number(editFormData.days_to_maturity),
        stratification_days: editFormData.stratification_days === "" ? null : Number(editFormData.stratification_days),
        scoville_rating: editFormData.scoville_rating === "" ? null : Number(editFormData.scoville_rating),
        custom_nursery_weeks: editFormData.custom_nursery_weeks === "" || editFormData.custom_nursery_weeks == null ? null : Number(editFormData.custom_nursery_weeks),
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
      
      navigateTo('vault', null, true);
      
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
        navigateTo('vault', null, true); 
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

      {parentSearchType && (
        <div className="fixed inset-0 z-[100] bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md h-[80vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-purple-200 flex gap-3 items-center bg-purple-50 rounded-t-3xl shrink-0">
              <div className="relative flex-1">
                <input 
                  type="text" 
                  autoFocus 
                  placeholder={`Search for ${parentSearchType === 'mother' ? 'Mother' : 'Father'} seed...`} 
                  value={parentSearchQuery} 
                  onChange={e => setParentSearchQuery(e.target.value)} 
                  className="w-full bg-white border border-purple-200 rounded-xl py-3 pl-10 pr-4 outline-none focus:border-purple-500 shadow-inner text-sm font-bold" 
                />
                <svg className="w-5 h-5 text-purple-400 absolute left-3 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <button onClick={() => { setParentSearchType(null); setParentSearchQuery(""); }} className="p-2 bg-purple-200 hover:bg-purple-300 rounded-full text-purple-700 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              <button 
                onClick={() => { 
                  setEditFormData({...editFormData, [parentSearchType === 'mother' ? 'parent_id_female' : 'parent_id_male']: null}); 
                  setParentSearchType(null); 
                  setParentSearchQuery(""); 
                }} 
                className="w-full text-left p-3 rounded-xl hover:bg-stone-50 text-stone-500 font-bold text-sm italic"
              >
                -- Clear / Unknown {parentSearchType === 'mother' ? 'Mother' : 'Father'} --
              </button>

              {inventory
                .filter((s: InventorySeed) => s.id !== seed.id && (s.variety_name.toLowerCase().includes(parentSearchQuery.toLowerCase()) || s.id.toLowerCase().includes(parentSearchQuery.toLowerCase())))
                .map((s: InventorySeed) => (
                <button key={s.id} onClick={() => {
                   setEditFormData({...editFormData, [parentSearchType === 'mother' ? 'parent_id_female' : 'parent_id_male']: s.id});
                   setParentSearchType(null); 
                   setParentSearchQuery("");
                }} className="w-full text-left p-3 rounded-xl hover:bg-purple-50 transition-colors flex items-center gap-3 group border border-transparent hover:border-purple-100">
                  <div className="w-10 h-10 rounded-lg bg-stone-100 overflow-hidden flex-shrink-0 border border-stone-200">
                    {s.thumbnail ? <img src={s.thumbnail} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-stone-300">🌱</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-stone-800 text-sm truncate group-hover:text-purple-700">{s.variety_name}</h4>
                    <p className="text-[10px] font-mono text-stone-500 bg-stone-100 px-1 py-0.5 rounded border border-stone-200 inline-block mt-0.5">{s.id}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      
      <header className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center justify-between border-b border-stone-200">
        <div className="flex items-center gap-2">
          <button onClick={handleCancel} className="p-2 text-stone-500 hover:bg-stone-100 rounded-full transition-colors" title="Cancel">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <button onClick={() => navigateTo('dashboard')} className="p-2 text-stone-500 hover:bg-stone-100 rounded-full transition-colors" title="Dashboard">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-stone-800 ml-1">
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
           <button type="button" onClick={() => setIsImageSearchOpen(true)} className="py-4 bg-blue-600 text-white font-black rounded-xl shadow-md text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all">
             🌐 Internet Search
           </button>
           <button type="button" onClick={handleAutoFill} disabled={isAutoFilling} className="py-4 bg-indigo-600 text-white font-black rounded-xl shadow-md text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50">
             ✨ Magic AutoFill
           </button>
        </div>

        <section className="bg-white p-5 rounded-3xl shadow-sm border border-stone-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-black text-stone-800 uppercase text-[10px] tracking-[0.2em]">Photos</h3>
            <button type="button" onClick={() => editPhotoInputRef.current?.click()} className="text-emerald-600 text-xs font-black uppercase tracking-widest flex items-center gap-1 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-100 shadow-sm active:scale-95 transition-transform">
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
                     <button type="button" onClick={() => setEditFormData({...editFormData, primaryImageIndex: idx})} className={`p-1.5 rounded-full backdrop-blur-sm ${idx === (editFormData.primaryImageIndex || 0) ? 'bg-emerald-500 text-white shadow-md' : 'bg-stone-900/40 text-white shadow-sm'}`}>
                       <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                     </button>
                     <button type="button" onClick={() => setEditFormData({ ...editFormData, images: (editFormData.images || []).filter((_: string, i: number) => i !== idx) })} className="p-1.5 rounded-full bg-red-500/80 backdrop-blur-sm text-white shadow-sm">
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
            <div className="flex justify-between items-end mb-1.5 ml-1">
              <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest">Shortcode ID</label>
              <span className="text-[9px] text-stone-400 font-bold italic">Leave blank to auto-generate</span>
            </div>
            <input 
              type="text" 
              value={editFormData.id || ''} 
              onChange={(e) => setEditFormData({ ...editFormData, id: e.target.value.toUpperCase() })} 
              placeholder="e.g. TOM-01" 
              className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 font-mono uppercase font-bold outline-none focus:border-emerald-500 transition-colors shadow-sm" 
            />
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
                <button 
                  type="button" 
                  onClick={() => setParentSearchType('mother')} 
                  className="w-full bg-white border border-purple-200 rounded-xl p-3 text-sm shadow-sm outline-none hover:border-purple-500 flex justify-between items-center font-medium"
                >
                  <span className={editFormData.parent_id_female ? "text-stone-800" : "text-stone-400"}>
                    {editFormData.parent_id_female 
                      ? `${inventory.find((s:any) => s.id === editFormData.parent_id_female)?.variety_name} (${editFormData.parent_id_female})` 
                      : "-- None / Unknown --"}
                  </span>
                  <svg className="w-4 h-4 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
             </div>
             <div>
                <label className="block text-[10px] font-black text-purple-500 uppercase tracking-widest mb-1.5 ml-1">Pollen Parent (Father ♂)</label>
                <button 
                  type="button" 
                  onClick={() => setParentSearchType('father')} 
                  className="w-full bg-white border border-purple-200 rounded-xl p-3 text-sm shadow-sm outline-none hover:border-purple-500 flex justify-between items-center font-medium"
                >
                  <span className={editFormData.parent_id_male ? "text-stone-800" : "text-stone-400"}>
                    {editFormData.parent_id_male 
                      ? `${inventory.find((s:any) => s.id === editFormData.parent_id_male)?.variety_name} (${editFormData.parent_id_male})` 
                      : "-- Self-Pollinated / Unknown --"}
                  </span>
                  <svg className="w-4 h-4 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
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

          <div className="mt-4 p-4 bg-stone-100 rounded-2xl border border-stone-200">
            <label className="block text-[10px] font-black text-stone-500 uppercase tracking-widest mb-1">Nursery Weeks Override</label>
            <p className="text-[10px] text-stone-400 mb-2 leading-tight">Leave blank to use the default time for this seed's category.</p>
            <input 
              type="number" 
              min="0"
              value={editFormData.custom_nursery_weeks ?? ''} 
              onChange={(e) => setEditFormData({ ...editFormData, custom_nursery_weeks: e.target.value })} 
              className="w-full bg-white border border-stone-300 rounded-xl p-3 text-sm font-bold shadow-inner outline-none focus:border-emerald-500" 
              placeholder={`e.g., 9 (Default: ${editFormData.category || 'Unknown'})`} 
            />
          </div>
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