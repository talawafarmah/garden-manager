import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { SeedlingTray, InventorySeed, TraySeedRecord, Season } from '../types';

const base64ToBlob = (base64: string, mimeType: string): Blob => {
  const byteString = atob(base64.split(',')[1]);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) { ia[i] = byteString.charCodeAt(i); }
  return new Blob([ab], { type: mimeType });
};

const resizeImage = (source: string, maxSize: number, quality: number): Promise<string> => {
  return new Promise((resolve) => {
    if (!source) return resolve("");
    const img = new Image();
    img.crossOrigin = "anonymous"; 
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width; let height = img.height;
      if (width > height) { if (width > maxSize) { height *= maxSize / width; width = maxSize; } } 
      else { if (height > maxSize) { width *= maxSize / height; height = maxSize; } }
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      try { resolve(canvas.toDataURL('image/jpeg', quality)); } catch (e) { resolve(""); }
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

export default function TrayEdit({ tray, trays = [], setTrays, inventory, navigateTo, handleGoBack }: any) {
  const [trayFormData, setTrayFormData] = useState<SeedlingTray | null>(null);
  
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const editPhotoInputRef = useRef<HTMLInputElement>(null);

  const [seedSearchRow, setSeedSearchRow] = useState<number | null>(null);
  const [seedSearchQuery, setSeedSearchQuery] = useState("");

  useEffect(() => {
    const todayObj = new Date();
    const localToday = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;

    // Check if this is a fully formed existing tray vs a partial payload from the Planner
    if (tray && tray.id) {
      setTrayFormData(tray);
    } else {
      setTrayFormData({
        id: window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).substring(2),
        name: tray?.name || `Tray ${Math.floor(Math.random() * 10000)}`,
        sown_date: localToday,
        cell_count: 72,
        contents: tray?.contents || [],
        images: [],
        notes: '',
        humidity_dome: true,
        grow_light: true,
        potting_mix: '',
        location: '',
        season_id: tray?.season_id || '',
        returnTo: tray?.returnTo // Preserve returnTo instruction
      } as any);
    }

    const fetchSeasons = async () => {
      const { data } = await supabase.from('seasons').select('*').order('created_at', { ascending: false });
      if (data) setSeasons(data as Season[]);
    };
    fetchSeasons();
  }, [tray]);

  useEffect(() => {
    if (!trayFormData) return;
    let isMounted = true;
    const loadUrls = async () => {
      try {
        const currentImages = trayFormData.images || [];
        if (currentImages.length === 0) return;
        const urlsToFetch = currentImages.filter((img: string) => img && typeof img === 'string' && !img.startsWith('data:') && !img.startsWith('http'));
        if (urlsToFetch.length === 0) return;
        const fetchedUrls: Record<string, string> = {};
        const { data, error } = await supabase.storage.from('talawa_media').createSignedUrls(urlsToFetch, 3600);
        if (data && !error) {
          data.forEach((item: any) => { if (item.signedUrl) fetchedUrls[item.path] = item.signedUrl; });
        }
        if (isMounted && Object.keys(fetchedUrls).length > 0) setSignedUrls(prev => ({ ...prev, ...fetchedUrls }));
      } catch (err) { console.error("Error fetching signed URLs:", err); }
    };
    loadUrls();
    return () => { isMounted = false; };
  }, [trayFormData?.images]);

  if (!trayFormData) return <div className="min-h-screen bg-stone-50 flex items-center justify-center text-stone-400">Loading editor...</div>;

  const handleEditPhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => { setTrayFormData({ ...trayFormData, images: [...(trayFormData.images || []), reader.result as string] }); };
      reader.readAsDataURL(file);
    }
  };

  const handleAddCellContent = () => {
    const newIdx = (trayFormData.contents || []).length;
    const todayObj = new Date();
    const localToday = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
    
    setTrayFormData({ 
      ...trayFormData, 
      contents: [
        ...(trayFormData.contents || []), 
        { seed_id: '', sown_count: 1, sown_date: localToday }
      ] 
    });
    setSeedSearchRow(newIdx);
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
    setIsSaving(true);
    
    try {
      const isNewRecord = !trays.some((t: SeedlingTray) => t.id === tray?.id);
      const folderName = trayFormData.id; 
      
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
      
      const cleanedContents = (trayFormData.contents || [])
        .filter((c: any) => c.seed_id && c.seed_id.trim() !== '')
        .map((c: any) => ({
          ...c,
          sown_date: c.sown_date || null,
          germination_date: c.germination_date || null,
          planted_date: c.planted_date || null
        }));

      const payloadToSave: any = { 
        ...trayFormData, 
        contents: cleanedContents,
        images: uploadedImagePaths,
        season_id: trayFormData.season_id || null,
        sown_date: trayFormData.sown_date ? trayFormData.sown_date : null,
        first_germination_date: trayFormData.first_germination_date ? trayFormData.first_germination_date : null,
        first_planted_date: trayFormData.first_planted_date ? trayFormData.first_planted_date : null,
      };

      // Ensure 'returnTo' is NOT passed to Supabase (causes DB rejection)
      delete payloadToSave.returnTo;

      let finalSavedRecord = payloadToSave;

      if (isNewRecord) {
        const { data, error } = await supabase.from('seedling_trays').insert([payloadToSave]).select().single();
        if (error) throw new Error("Insert Error: " + error.message);
        if (data) finalSavedRecord = data;
      } else {
        const { data, error } = await supabase.from('seedling_trays').update(payloadToSave).eq('id', trayFormData.id).select().single();
        if (error) throw new Error("Update Error: " + error.message);
        if (data) finalSavedRecord = data;
      }
      
      setTimeout(() => {
        try {
          if (typeof setTrays === 'function') {
            const updatedTrays = isNewRecord ? [finalSavedRecord, ...trays] : trays.map((t: SeedlingTray) => t.id === finalSavedRecord.id ? finalSavedRecord : t);
            setTrays(updatedTrays);
          }
          
          if ((trayFormData as any).returnTo) {
             navigateTo((trayFormData as any).returnTo);
          } else {
             navigateTo('trays', null, true);
          }
        } catch (innerErr: any) {
          console.error("[TRAY SAVE] CRASH IN TIMEOUT:", innerErr);
        }
      }, 50);
      
    } catch (e: any) { 
      alert(e.message); 
      setIsSaving(false); 
    } 
  };

  const handleDeleteTray = async () => {
    if (confirm(`Are you sure you want to delete this tray?`)) {
      const { error } = await supabase.from('seedling_trays').delete().eq('id', trayFormData.id);
      if (!error) { 
        if (typeof setTrays === 'function') setTrays(trays.filter((t: SeedlingTray) => t.id !== trayFormData.id)); 
        navigateTo('trays', null, true); 
      } else {
        alert("Failed to delete tray: " + error.message);
      }
    }
  };

  const filteredInventory = inventory.filter((s: InventorySeed) => {
    if (!seedSearchQuery.trim()) return true;
    const q = seedSearchQuery.toLowerCase();
    return s.variety_name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q) || s.id.toLowerCase().includes(q);
  });

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900 pb-20 font-sans">
      
      {seedSearchRow !== null && (
        <div className="fixed inset-0 z-[100] bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md h-[80vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-stone-200 flex gap-3 items-center bg-stone-50 rounded-t-3xl shrink-0">
              <div className="relative flex-1">
                <input type="text" autoFocus placeholder="Search 300+ seeds..." value={seedSearchQuery} onChange={e => setSeedSearchQuery(e.target.value)} className="w-full bg-white border border-stone-200 rounded-xl py-3 pl-10 pr-4 outline-none focus:border-emerald-500 shadow-inner text-sm font-bold" />
                <svg className="w-5 h-5 text-stone-400 absolute left-3 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
              <button onClick={() => { setSeedSearchRow(null); setSeedSearchQuery(""); }} className="p-2 bg-stone-200 hover:bg-stone-300 rounded-full text-stone-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredInventory.length === 0 ? (
                <div className="text-center py-10 text-stone-400 text-sm">No seeds found matching "{seedSearchQuery}"</div>
              ) : (
                filteredInventory.map((s: InventorySeed) => (
                  <button 
                    key={s.id} 
                    onClick={() => { handleUpdateCellContent(seedSearchRow, 'seed_id', s.id); setSeedSearchRow(null); setSeedSearchQuery(""); }} 
                    className="w-full text-left p-3 rounded-xl hover:bg-emerald-50 transition-colors flex items-center gap-3 group border border-transparent hover:border-emerald-100"
                  >
                    <div className="w-10 h-10 rounded-lg bg-stone-100 overflow-hidden flex-shrink-0 border border-stone-200 group-hover:border-emerald-300">
                      {s.thumbnail ? <img src={s.thumbnail} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-stone-300"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" /></svg></div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-stone-800 text-sm truncate flex items-center gap-2">
                        {s.variety_name}
                        <span className="text-[9px] font-mono text-stone-400 bg-stone-100 px-1 py-0.5 rounded border border-stone-200">{s.id}</span>
                      </h4>
                      <p className="text-[10px] text-stone-500 uppercase tracking-widest truncate mt-0.5">{s.category}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <header className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center justify-between border-b border-stone-200">
        <div className="flex items-center gap-2">
          <button onClick={() => (trayFormData as any)?.returnTo ? navigateTo((trayFormData as any).returnTo) : handleGoBack('trays')} className="p-2 text-stone-500 hover:bg-stone-100 rounded-full transition-colors" title="Cancel">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <h1 className="text-xl font-bold text-stone-800 ml-1">
            {trays.some((t: SeedlingTray) => t.id === tray?.id) ? 'Edit Tray' : 'New Tray'}
          </h1>
        </div>
        <button onClick={handleSaveEdit} disabled={isSaving} className="px-5 py-2 bg-emerald-600 text-white font-black rounded-xl shadow-sm disabled:opacity-50 transition-colors hover:bg-emerald-700 tracking-wide">
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </header>

      <div className="max-w-md mx-auto p-4 space-y-5">
        
        <section className="bg-white p-5 rounded-3xl shadow-sm border border-stone-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-black text-stone-800 uppercase text-[10px] tracking-[0.2em]">Tray Photos</h3>
            <button onClick={() => editPhotoInputRef.current?.click()} className="text-emerald-600 text-xs font-black uppercase tracking-widest flex items-center gap-1 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-100 shadow-sm active:scale-95 transition-transform">
              Add Photo
            </button>
            <input type="file" accept="image/*" capture="environment" ref={editPhotoInputRef} className="hidden" onChange={handleEditPhotoCapture} />
          </div>
          
          <div className="grid grid-cols-3 gap-3">
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
                  <button onClick={() => setTrayFormData({ ...trayFormData, images: (trayFormData.images || []).filter((_: string, i: number) => i !== idx) })} className="absolute top-1 right-1 p-1.5 rounded-full bg-red-500/80 backdrop-blur-sm text-white shadow-sm">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <section className="bg-white p-6 rounded-3xl shadow-sm border border-stone-200 space-y-4">
          <h3 className="font-black text-stone-800 border-b border-stone-100 pb-2 uppercase text-[10px] tracking-[0.2em] text-stone-400">Tray Setup</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Tray Name</label>
              <input type="text" value={trayFormData.name || ''} onChange={(e) => setTrayFormData({ ...trayFormData, name: e.target.value })} placeholder="e.g., Spring Tomatoes" className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 font-bold outline-none focus:border-emerald-500 shadow-sm" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Global Sown Date</label>
              <input type="date" value={trayFormData.sown_date || ''} onChange={(e) => setTrayFormData({ ...trayFormData, sown_date: e.target.value })} className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-emerald-500 shadow-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Cell Count</label>
              <div className="relative">
                <input type="number" list="cell-counts" value={trayFormData.cell_count || ''} onChange={(e) => setTrayFormData({ ...trayFormData, cell_count: Number(e.target.value) })} className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-emerald-500 shadow-sm" placeholder="e.g., 72" />
                <datalist id="cell-counts"><option value={6} /><option value={50} /><option value={72} /><option value={128} /><option value={200} /></datalist>
                <span className="absolute right-4 top-3.5 text-sm font-bold text-stone-400 pointer-events-none">Cells</span>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Season</label>
              <select value={trayFormData.season_id || ''} onChange={(e) => setTrayFormData({ ...trayFormData, season_id: e.target.value })} className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-emerald-500 shadow-sm appearance-none">
                <option value="">-- None --</option>
                {seasons.map((s: Season) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Potting Mix / Soil</label>
            <input type="text" value={trayFormData.potting_mix || ''} onChange={(e) => setTrayFormData({ ...trayFormData, potting_mix: e.target.value })} placeholder="e.g., ProMix BX, Coco Coir..." className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm shadow-sm outline-none focus:border-emerald-500" />
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <button onClick={() => setTrayFormData({...trayFormData, humidity_dome: !trayFormData.humidity_dome})} className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${trayFormData.humidity_dome ? 'bg-blue-100 border-blue-300 text-blue-700 shadow-sm' : 'bg-stone-100 border-stone-200 text-stone-400'}`}>Humidity Dome ON</button>
            <button onClick={() => setTrayFormData({...trayFormData, grow_light: !trayFormData. grow_light})} className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${trayFormData.grow_light ? 'bg-amber-100 border-amber-300 text-amber-700 shadow-sm' : 'bg-stone-100 border-stone-200 text-stone-400'}`}>Grow Lights ON</button>
          </div>
        </section>

        <section className="bg-white p-6 rounded-3xl shadow-sm border border-stone-200 space-y-4">
          <div className="flex items-center justify-between border-b border-stone-100 pb-2">
            <h3 className="font-black text-stone-800 uppercase text-[10px] tracking-[0.2em] text-stone-400">Tray Contents</h3>
            <button onClick={handleAddCellContent} className="text-emerald-600 text-xs font-black uppercase tracking-widest flex items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 shadow-sm active:scale-95 transition-transform">
              + Add Row
            </button>
          </div>
          
          <div className="space-y-3">
            {(trayFormData.contents || []).length === 0 ? (
               <div className="text-center py-6 text-stone-400 text-sm italic">No seeds mapped to this tray yet.</div>
            ) : (
              (trayFormData.contents || []).map((content, idx) => {
                const seedName = inventory.find((s: InventorySeed) => s.id === content.seed_id)?.variety_name;
                return (
                  <div key={idx} className="bg-stone-50 p-2 rounded-xl border border-stone-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-16">
                        <input type="number" min="0" placeholder="Qty" value={content.sown_count ?? ''} onChange={(e) => handleUpdateCellContent(idx, 'sown_count', Number(e.target.value))} className="w-full bg-white border border-stone-200 rounded-lg p-2 text-xs font-bold outline-none focus:border-emerald-500 text-center" title="Number of seeds sown" />
                      </div>
                      <div className="flex-1">
                        <button 
                          onClick={() => setSeedSearchRow(idx)}
                          className={`w-full text-left bg-white border border-stone-200 rounded-lg p-2 text-xs outline-none hover:border-emerald-400 transition-colors shadow-sm flex flex-col justify-center min-h-[42px] ${content.seed_id ? 'text-stone-800' : 'text-stone-400 font-bold'}`}
                        >
                          {seedName ? (
                            <>
                              <span className="font-bold truncate w-full block">{seedName}</span>
                              <span className="text-[9px] font-mono text-stone-500 bg-stone-50 px-1 rounded mt-0.5 inline-block border border-stone-100">ID: {content.seed_id}</span>
                            </>
                          ) : "Tap to search seeds..."}
                        </button>
                      </div>
                      <button onClick={() => handleRemoveCellContent(idx)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                    </div>

                    <div className="w-full mt-2 pt-2 border-t border-stone-100 grid grid-cols-3 gap-2">
                       <div>
                         <label className="block text-[8px] font-black uppercase text-stone-400 mb-0.5 text-center">Sown</label>
                         <input type="date" value={content.sown_date || ''} onChange={(e) => handleUpdateCellContent(idx, 'sown_date', e.target.value)} className="w-full text-[10px] p-1.5 border border-stone-200 rounded-md outline-none focus:border-emerald-500 bg-white" />
                       </div>
                       <div>
                         <label className="block text-[8px] font-black uppercase text-stone-400 mb-0.5 text-center">Sprouted</label>
                         <input type="date" value={content.germination_date || ''} onChange={(e) => handleUpdateCellContent(idx, 'germination_date', e.target.value)} className="w-full text-[10px] p-1.5 border border-stone-200 rounded-md outline-none focus:border-emerald-500 bg-white" />
                       </div>
                       <div>
                         <label className="block text-[8px] font-black uppercase text-stone-400 mb-0.5 text-center">Potted</label>
                         <input type="date" value={content.planted_date || ''} onChange={(e) => handleUpdateCellContent(idx, 'planted_date', e.target.value)} className="w-full text-[10px] p-1.5 border border-stone-200 rounded-md outline-none focus:border-emerald-500 bg-white" />
                       </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="bg-white p-6 rounded-3xl shadow-sm border border-stone-200 space-y-4">
          <h3 className="font-black text-stone-800 border-b border-stone-100 pb-2 uppercase text-[10px] tracking-[0.2em] text-stone-400">Milestones & Notes</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">1st Germination</label>
              <input type="date" value={trayFormData.first_germination_date || ''} onChange={(e) => setTrayFormData({ ...trayFormData, first_germination_date: e.target.value })} className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-emerald-500 shadow-sm" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">1st Potted Up</label>
              <input type="date" value={trayFormData.first_planted_date || ''} onChange={(e) => setTrayFormData({ ...trayFormData, first_planted_date: e.target.value })} className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-emerald-500 shadow-sm" />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Location</label>
            <input type="text" value={trayFormData.location || ''} onChange={(e) => setTrayFormData({ ...trayFormData, location: e.target.value })} placeholder="e.g., Garage Rack 2, Greenhouse..." className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm shadow-sm outline-none focus:border-emerald-500" />
          </div>
          <div>
            <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">General Notes</label>
            <textarea value={trayFormData.notes || ''} onChange={(e) => setTrayFormData({ ...trayFormData, notes: e.target.value })} rows={4} className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm shadow-sm resize-none outline-none focus:border-emerald-500" placeholder="Issues with damping off, watering schedule, etc..." />
          </div>
        </section>

        {trays.some((t: SeedlingTray) => t.id === tray?.id) && (
          <button onClick={handleDeleteTray} className="w-full py-4 mt-2 bg-red-50 text-red-600 font-bold rounded-2xl border border-red-200 hover:bg-red-100 transition-colors flex items-center justify-center gap-2 shadow-sm">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            Delete Tray Permanently
          </button>
        )}
      </div>
    </main>
  );
}