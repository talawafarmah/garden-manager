import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { SeedlingTray, InventorySeed, TraySeedRecord, Season } from '../types';

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
    if (source.startsWith('http') && !source.includes('supabase.co') && !source.includes('corsproxy')) {
       finalSrc = `https://corsproxy.io/?${encodeURIComponent(source)}`;
    } else if (!source.startsWith('http') && !source.startsWith('data:')) {
       finalSrc = `data:image/jpeg;base64,${source}`;
    }
    img.src = finalSrc;
  });
};

export default function TrayEdit({ tray, trays, setTrays, inventory, navigateTo, handleGoBack }: any) {
  // If no tray is passed, initialize a default empty tray
  const defaultTray: SeedlingTray = {
    id: `TRAY-${Math.floor(Math.random() * 10000)}`,
    sown_date: new Date().toISOString().split('T')[0],
    cell_count: 72,
    contents: [],
    images: [],
    notes: '',
    humidity_dome: true,
    grow_light: true,
    potting_mix: '',
    location: '',
    season_id: ''
  };

  const [trayFormData, setTrayFormData] = useState<SeedlingTray>(tray || defaultTray);
  const [seasons, setSeasons] = useState<Season[]>([]);
  
  const [isSaving, setIsSaving] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const editPhotoInputRef = useRef<HTMLInputElement>(null);

  // Load Seasons for the dropdown
  useEffect(() => {
    const fetchSeasons = async () => {
      const { data } = await supabase.from('seasons').select('*').order('created_at', { ascending: false });
      if (data) setSeasons(data as Season[]);
    };
    fetchSeasons();
  }, []);

  // Resolve Signed URLs for existing bucket images
  useEffect(() => {
    let isMounted = true;
    
    const loadUrls = async () => {
      try {
        // FIX: Added || [] fallback
        const currentImages = trayFormData.images || [];
        if (currentImages.length === 0) return;
        
        const urlsToFetch = currentImages.filter((img: string) => 
          img && typeof img === 'string' && !img.startsWith('data:') && !img.startsWith('http')
        );
        
        if (urlsToFetch.length === 0) return;

        const fetchedUrls: Record<string, string> = {};
        const { data, error } = await supabase.storage.from('talawa_media').createSignedUrls(urlsToFetch, 3600);
        
        if (data && !error) {
          data.forEach((item: any) => { 
            if (item.signedUrl) fetchedUrls[item.path] = item.signedUrl; 
          });
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
  }, [trayFormData.images]);

  const handleEditPhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => { 
        setTrayFormData({ 
          ...trayFormData, 
          // FIX: Added || [] fallback
          images: [...(trayFormData.images || []), reader.result as string] 
        }); 
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddCellContent = () => {
    const newContent: TraySeedRecord = { cell: 1, seed_id: '' };
    setTrayFormData({
      ...trayFormData,
      contents: [...(trayFormData.contents || []), newContent]
    });
  };

  const handleUpdateCellContent = (index: number, field: keyof TraySeedRecord, value: any) => {
    const updatedContents = [...(trayFormData.contents || [])];
    updatedContents[index] = { ...updatedContents[index], [field]: value };
    setTrayFormData({ ...trayFormData, contents: updatedContents });
  };

  const handleRemoveCellContent = (index: number) => {
    const updatedContents = [...(trayFormData.contents || [])];
    updatedContents.splice(index, 1);
    setTrayFormData({ ...trayFormData, contents: updatedContents });
  };

  const handleSaveEdit = async () => {
    if (!trayFormData.id.trim()) { alert("Tray ID is required."); return; }
    setIsSaving(true);
    
    try {
      const isNewRecord = !trays.some((t: SeedlingTray) => t.id === tray?.id);
      const folderName = btoa(trayFormData.id).replace(/=/g, ''); 
      
      // FIX: Added || [] fallback
      const uploadPromises = (trayFormData.images || []).map(async (img: string) => {
        if (img.startsWith('data:') || img.startsWith('http')) {
          const optimizedBase64 = await resizeImage(img, 1600, 0.8);
          if (optimizedBase64) {
             const blob = base64ToBlob(optimizedBase64, 'image/jpeg');
             const fileName = `tray_${crypto.randomUUID()}.jpg`;
             const filePath = `${folderName}/${fileName}`;
             await supabase.storage.from('talawa_media').upload(filePath, blob, { contentType: 'image/jpeg' });
             return filePath;
          }
        }
        return img; 
      });

      const uploadedImagePaths = await Promise.all(uploadPromises);
      
      const payloadToSave: any = { 
        ...trayFormData, 
        images: uploadedImagePaths,
        season_id: trayFormData.season_id || null // Ensure empty string becomes null for foreign key
      };
      
      if (isNewRecord) {
        const { error } = await supabase.from('seedling_trays').insert([payloadToSave]);
        if (error) throw new Error("Insert Error: " + error.message);
      } else {
        const { error } = await supabase.from('seedling_trays').update(payloadToSave).eq('id', tray.id);
        if (error) throw new Error("Update Error: " + error.message);
      }
      
      const updatedTrays = isNewRecord ? [payloadToSave, ...trays] : trays.map((t: SeedlingTray) => t.id === tray.id ? payloadToSave : t);
      setTrays(updatedTrays);
      
      navigateTo('trays');
      
    } catch (e: any) { 
      alert(e.message); 
    } finally { 
      setIsSaving(false); 
    }
  };

  const handleDeleteTray = async () => {
    if (confirm(`Are you sure you want to delete Tray ${trayFormData.id}?`)) {
      const { error } = await supabase.from('seedling_trays').delete().eq('id', trayFormData.id);
      if (!error) { 
        setTrays(trays.filter((t: SeedlingTray) => t.id !== trayFormData.id)); 
        navigateTo('trays'); 
      } else {
        alert("Failed to delete tray: " + error.message);
      }
    }
  };

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900 pb-20 font-sans">
      <header className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center justify-between border-b border-stone-200">
        <div className="flex items-center gap-3">
          <button onClick={() => handleGoBack('trays')} className="p-2 text-stone-500 hover:bg-stone-100 rounded-full transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-stone-800">
            {trays.some((t: SeedlingTray) => t.id === tray?.id) ? 'Edit Tray' : 'New Tray'}
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
        
        {/* Images Section */}
        <section className="bg-white p-5 rounded-3xl shadow-sm border border-stone-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-black text-stone-800 uppercase text-[10px] tracking-[0.2em]">Tray Photos</h3>
            <button onClick={() => editPhotoInputRef.current?.click()} className="text-emerald-600 text-xs font-black uppercase tracking-widest flex items-center gap-1 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-100 shadow-sm active:scale-95 transition-transform">
              Add Photo
            </button>
            <input type="file" accept="image/*" capture="environment" ref={editPhotoInputRef} className="hidden" onChange={handleEditPhotoCapture} />
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            {/* FIX: Added || [] fallback */}
            {(trayFormData.images || []).map((img: string, idx: number) => {
              const displaySrc = img.startsWith('data:') || img.startsWith('http') ? img : signedUrls[img] || '';
              return (
                <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden border-2 border-stone-200 bg-stone-100 shadow-sm">
                  {displaySrc ? (
                    <img src={displaySrc} alt="Tray" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-stone-300">
                       <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    </div>
                  )}
                  <button 
                    // FIX: Added || [] fallback
                    onClick={() => setTrayFormData({ ...trayFormData, images: (trayFormData.images || []).filter((_: string, i: number) => i !== idx) })} 
                    className="absolute top-1 right-1 p-1.5 rounded-full bg-red-500/80 backdrop-blur-sm text-white shadow-sm"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Basic Info */}
        <section className="bg-white p-6 rounded-3xl shadow-sm border border-stone-200 space-y-4">
          <h3 className="font-black text-stone-800 border-b border-stone-100 pb-2 uppercase text-[10px] tracking-[0.2em] text-stone-400">Tray Setup</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Tray ID</label>
              <input type="text" value={trayFormData.id} onChange={(e) => setTrayFormData({ ...trayFormData, id: e.target.value.toUpperCase() })} className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 font-mono uppercase font-bold outline-none focus:border-emerald-500 shadow-sm" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Sown Date</label>
              <input type="date" value={trayFormData.sown_date} onChange={(e) => setTrayFormData({ ...trayFormData, sown_date: e.target.value })} className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-emerald-500 shadow-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Cell Count</label>
              <select value={trayFormData.cell_count} onChange={(e) => setTrayFormData({ ...trayFormData, cell_count: Number(e.target.value) })} className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-emerald-500 shadow-sm appearance-none">
                <option value={6}>6 Cells</option>
                <option value={50}>50 Cells</option>
                <option value={72}>72 Cells</option>
                <option value={128}>128 Cells</option>
                <option value={200}>200 Cells</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Season</label>
              <select value={trayFormData.season_id || ''} onChange={(e) => setTrayFormData({ ...trayFormData, season_id: e.target.value })} className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-emerald-500 shadow-sm appearance-none">
                <option value="">-- None --</option>
                {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Potting Mix / Soil</label>
            <input type="text" value={trayFormData.potting_mix || ''} onChange={(e) => setTrayFormData({ ...trayFormData, potting_mix: e.target.value })} placeholder="e.g., ProMix BX, Coco Coir..." className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm shadow-sm outline-none focus:border-emerald-500" />
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <button 
              onClick={() => setTrayFormData({...trayFormData, humidity_dome: !trayFormData.humidity_dome})}
              className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${trayFormData.humidity_dome ? 'bg-blue-100 border-blue-300 text-blue-700 shadow-sm' : 'bg-stone-100 border-stone-200 text-stone-400'}`}
            >
              Humidity Dome ON
            </button>
            <button 
              onClick={() => setTrayFormData({...trayFormData, grow_light: !trayFormData. grow_light})}
              className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${trayFormData.grow_light ? 'bg-amber-100 border-amber-300 text-amber-700 shadow-sm' : 'bg-stone-100 border-stone-200 text-stone-400'}`}
            >
              Grow Lights ON
            </button>
          </div>
        </section>

        {/* Tray Contents (The Grid) */}
        <section className="bg-white p-6 rounded-3xl shadow-sm border border-stone-200 space-y-4">
          <div className="flex items-center justify-between border-b border-stone-100 pb-2">
            <h3 className="font-black text-stone-800 uppercase text-[10px] tracking-[0.2em] text-stone-400">Tray Contents</h3>
            <button onClick={handleAddCellContent} className="text-emerald-600 text-xs font-black uppercase tracking-widest flex items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 shadow-sm active:scale-95 transition-transform">
              + Add Row
            </button>
          </div>
          
          <div className="space-y-3">
            {/* FIX: Added || [] fallback */}
            {(trayFormData.contents || []).length === 0 ? (
               <div className="text-center py-6 text-stone-400 text-sm italic">No seeds mapped to this tray yet.</div>
            ) : (
              (trayFormData.contents || []).map((content, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-stone-50 p-2 rounded-xl border border-stone-200 shadow-sm">
                  <div className="w-16">
                    <input 
                      type="number" 
                      placeholder="Cell #" 
                      value={content.cell || ''} 
                      onChange={(e) => handleUpdateCellContent(idx, 'cell', Number(e.target.value))}
                      className="w-full bg-white border border-stone-200 rounded-lg p-2 text-xs font-bold outline-none focus:border-emerald-500 text-center"
                    />
                  </div>
                  <div className="flex-1">
                    <select 
                      value={content.seed_id} 
                      onChange={(e) => handleUpdateCellContent(idx, 'seed_id', e.target.value)}
                      className="w-full bg-white border border-stone-200 rounded-lg p-2 text-xs font-bold outline-none focus:border-emerald-500 appearance-none text-stone-700"
                    >
                      <option value="">Select Seed...</option>
                      {inventory.map((s: InventorySeed) => (
                        <option key={s.id} value={s.id}>{s.id} - {s.variety_name}</option>
                      ))}
                    </select>
                  </div>
                  <button onClick={() => handleRemoveCellContent(idx)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Milestones & Notes */}
        <section className="bg-white p-6 rounded-3xl shadow-sm border border-stone-200 space-y-4">
          <h3 className="font-black text-stone-800 border-b border-stone-100 pb-2 uppercase text-[10px] tracking-[0.2em] text-stone-400">Milestones & Notes</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">1st Germination</label>
              <input type="date" value={trayFormData.first_germination_date || ''} onChange={(e) => setTrayFormData({ ...trayFormData, first_germination_date: e.target.value })} className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-emerald-500 shadow-sm" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">1st Planted Out</label>
              <input type="date" value={trayFormData.first_planted_date || ''} onChange={(e) => setTrayFormData({ ...trayFormData, first_planted_date: e.target.value })} className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-emerald-500 shadow-sm" />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Location</label>
            <input type="text" value={trayFormData.location || ''} onChange={(e) => setTrayFormData({ ...trayFormData, location: e.target.value })} placeholder="e.g., Garage Rack 2, Greenhouse..." className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm shadow-sm outline-none focus:border-emerald-500" />
          </div>

          <div>
            <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">General Notes</label>
            <textarea 
              value={trayFormData.notes || ''} 
              onChange={(e) => setTrayFormData({ ...trayFormData, notes: e.target.value })} 
              rows={4} 
              className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm shadow-sm resize-none outline-none focus:border-emerald-500" 
              placeholder="Issues with damping off, watering schedule, etc..." 
            />
          </div>
        </section>

        {trays.some((t: SeedlingTray) => t.id === tray?.id) && (
          <button 
            onClick={handleDeleteTray} 
            className="w-full py-4 mt-2 bg-red-50 text-red-600 font-bold rounded-2xl border border-red-200 hover:bg-red-100 transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete Tray Permanently
          </button>
        )}
      </div>
    </main>
  );
}