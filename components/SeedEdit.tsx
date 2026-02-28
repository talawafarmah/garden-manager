import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { InventorySeed, SeedCategory } from '../types';
import { fetchWithRetry, getBestModel } from '../lib/utils';
import ImageSearch from './ImageSearch';

const resizeImage = (source: string, maxSize: number, quality: number): Promise<string> => {
  return new Promise((resolve) => {
    if (!source) return resolve("");
    const img = new Image();
    img.crossOrigin = "anonymous"; 
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      if (width > height) { if (width > maxSize) { height *= maxSize / width; width = maxSize; } }
      else { if (height > maxSize) { width *= maxSize / height; height = maxSize; } }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      try { resolve(canvas.toDataURL('image/jpeg', quality)); } catch (e) { resolve(""); }
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
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [isImageSearchOpen, setIsImageSearchOpen] = useState(false);
  const editPhotoInputRef = useRef<HTMLInputElement>(null);

  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";

  useEffect(() => {
    const loadUrls = async () => {
      const newUrls: Record<string, string> = { ...signedUrls };
      let changed = false;
      for (const img of (editFormData.images || [])) {
        if (!img.startsWith('data:image') && !img.startsWith('http') && !newUrls[img]) {
          const { data } = await supabase.storage.from('talawa_media').createSignedUrl(img, 3600);
          if (data) { newUrls[img] = data.signedUrl; changed = true; }
        }
      }
      if (changed) setSignedUrls(newUrls);
    };
    loadUrls();
  }, [editFormData.images]);

  const handleEditPhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditFormData({ ...editFormData, images: [...(editFormData.images || []), reader.result as string] });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveEdit = async () => {
    if (!editFormData.id.trim()) { alert("ID is required."); return; }
    setIsSaving(true);
    try {
      const isNewRecord = !inventory.some((s: InventorySeed) => s.id === seed.id);
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
             await supabase.storage.from('talawa_media').upload(filePath, blob, { contentType: 'image/jpeg' });
             uploadedImagePaths.push(filePath);
          } else { uploadedImagePaths.push(img); }
        } else { uploadedImagePaths.push(img); }
      }
      let newThumbnail = editFormData.thumbnail || "";
      if (uploadedImagePaths.length > 0) {
        const primaryIdx = editFormData.primaryImageIndex || 0;
        const primaryImgSource = editFormData.images[primaryIdx];
        let sourceToResize = primaryImgSource.startsWith('data:image') || primaryImgSource.startsWith('http') ? primaryImgSource : signedUrls[primaryImgSource];
        if (sourceToResize) newThumbnail = await resizeImage(sourceToResize, 150, 0.6);
      }
      const payloadToSave: any = { ...editFormData, images: uploadedImagePaths, thumbnail: newThumbnail };
      if (isNewRecord) await supabase.from('seed_inventory').insert([payloadToSave]);
      else await supabase.from('seed_inventory').update(payloadToSave).eq('id', seed.id);
      if (isNewRecord) setInventory([payloadToSave, ...inventory]);
      else setInventory(inventory.map((s: InventorySeed) => s.id === seed.id ? payloadToSave : s));
      navigateTo('seed_detail', payloadToSave, true);
    } catch (e: any) { alert(e.message); } finally { setIsSaving(false); }
  };

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900 pb-20">
      {isImageSearchOpen && (
        <ImageSearch 
          query={`${editFormData.variety_name} plant`}
          onSelect={(url) => { setEditFormData({ ...editFormData, images: [...(editFormData.images || []), url] }); setIsImageSearchOpen(false); }}
          onClose={() => setIsImageSearchOpen(false)}
        />
      )}
      <header className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center justify-between border-b border-stone-200">
        <div className="flex items-center gap-3">
          <button onClick={() => seed.id ? navigateTo('seed_detail', seed, true) : handleGoBack('vault')} className="p-2 text-stone-500 hover:bg-stone-100 rounded-full transition-colors"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
          <h1 className="text-xl font-bold text-stone-800">{seed.id ? 'Edit Seed' : 'New Seed'}</h1>
        </div>
        <button onClick={handleSaveEdit} disabled={isSaving} className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg shadow-sm disabled:opacity-50">Save</button>
      </header>

      <div className="max-w-md mx-auto p-4 space-y-5">
        <div className="grid grid-cols-1 gap-3">
          <button onClick={() => setIsImageSearchOpen(true)} className="py-4 bg-blue-600 text-white font-bold rounded-xl shadow-md text-xs flex items-center justify-center gap-2 transition-all active:scale-95"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>🌐 Internet Image Search</button>
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
                     <button onClick={() => setEditFormData({...editFormData, primaryImageIndex: idx})} className={`p-1 rounded-full ${idx === (editFormData.primaryImageIndex || 0) ? 'bg-emerald-500 text-white' : 'bg-stone-900/40 text-white'}`}><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg></button>
                     <button onClick={() => {
                        const newImages = editFormData.images.filter((_, i) => i !== idx);
                        setEditFormData({ ...editFormData, images: newImages });
                     }} className="p-1 rounded-full bg-red-500/80 text-white"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="bg-white p-5 rounded-2xl shadow-sm border border-stone-200 space-y-4">
          <div><label className="block text-xs font-medium text-stone-500 mb-1">Variety Name</label><input type="text" value={editFormData.variety_name} onChange={(e) => setEditFormData({ ...editFormData, variety_name: e.target.value })} className="w-full bg-stone-50 border border-stone-300 rounded-lg p-2.5 font-bold" /></div>
          <div><label className="block text-xs font-medium text-stone-500 mb-1">Shortcode ID</label><input type="text" value={editFormData.id} onChange={(e) => setEditFormData({ ...editFormData, id: e.target.value.toUpperCase() })} className="w-full bg-stone-50 border border-stone-300 rounded-lg p-2.5 font-mono uppercase" /></div>
        </section>
      </div>
    </main>
  );
}