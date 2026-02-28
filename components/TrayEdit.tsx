import React, { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { SeedlingTray, InventorySeed, TraySeedRecord } from '../types';

export default function TrayEdit({ tray, trays, setTrays, inventory, navigateTo, handleGoBack }: any) {
  const [trayFormData, setTrayFormData] = useState<SeedlingTray>(tray);
  const trayPhotoInputRef = useRef<HTMLInputElement>(null);

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
    const isNew = !trayFormData.id;
    let error;
    
    // Clean up empty strings to be actual nulls so Supabase date columns don't crash
    const payloadToSave = {
      ...trayFormData,
      first_germination_date: trayFormData.first_germination_date || null,
      first_planted_date: trayFormData.first_planted_date || null,
    };
    
    // Explicitly type this as SeedlingTray so TypeScript doesn't lock it to the nulls above
    let savedTray: SeedlingTray = { ...trayFormData };

    if (isNew) {
      const { data, error: insertErr } = await supabase.from('seedling_trays').insert([payloadToSave]).select();
      error = insertErr; if (data) savedTray = data[0] as SeedlingTray;
    } else {
      const { error: updateErr } = await supabase.from('seedling_trays').update(payloadToSave).eq('id', trayFormData.id);
      error = updateErr;
    }

    if (error) alert("Failed to save tray: " + error.message);
    else {
      if (isNew) setTrays([savedTray, ...trays]); else setTrays(trays.map((t: SeedlingTray) => t.id === savedTray.id ? savedTray : t));
      navigateTo('tray_detail', savedTray);
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
        <button onClick={handleSaveTray} className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-500 transition-colors shadow-sm">Save</button>
      </header>

      <div className="max-w-md mx-auto p-4 space-y-5">
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

        {trayFormData.id && <button onClick={handleDeleteTray} className="w-full py-4 mt-4 bg-red-50 text-red-600 font-bold rounded-xl border border-red-200 hover:bg-red-100 transition-colors flex items-center justify-center gap-2"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>Delete Tray</button>}
      </div>
    </main>
  );
}