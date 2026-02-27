import React, { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { InventorySeed, SeedCategory } from '../types';
import { fetchWithRetry, getBestModel } from '../lib/utils';

export default function SeedEdit({ seed, inventory, setInventory, categories, setCategories, navigateTo, handleGoBack }: any) {
  const [editFormData, setEditFormData] = useState<InventorySeed>(seed);
  const [showNewCatForm, setShowNewCatForm] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatPrefix, setNewCatPrefix] = useState("");
  const [isAutoFilling, setIsAutoFilling] = useState(false);
  const editPhotoInputRef = useRef<HTMLInputElement>(null);

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
    if (editFormData.id !== seed.id) {
      const isDuplicate = inventory.some((s: InventorySeed) => s.id.toLowerCase() === editFormData.id.toLowerCase());
      if (isDuplicate) { alert(`Error: The shortcode '${editFormData.id}' is already assigned to another seed.`); return; }
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
    const payload = { ...editFormData, category: finalCatName };
    const { error } = await supabase.from('seed_inventory').update(payload).eq('id', seed.id);

    if (error) alert("Failed to update database: " + error.message);
    else {
      setInventory(inventory.map((s: InventorySeed) => s.id === seed.id ? payload : s));
      navigateTo('seed_detail', payload); 
    }
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

  const handleAutoFill = async () => {
    setIsAutoFilling(true);
    try {
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
      if (!apiKey) throw new Error("Missing API Key! Please set NEXT_PUBLIC_GEMINI_API_KEY in your .env.local file.");

      // 1. Gather missing text details using Web Grounding
      const modelToUse = await getBestModel();
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${apiKey}`;
      
      const payload = {
        contents: [{
          role: "user",
          parts: [{ text: `You are an expert horticulturist. Here is the current data for a seed named "${editFormData.variety_name}" (Category: ${editFormData.category}, Species: ${editFormData.species || 'unknown'}). \n\n${JSON.stringify(editFormData)}\n\nPlease fill in any missing or empty fields with accurate botanical data. Use the Google Search tool if you are unsure. Keep existing populated data intact. Ensure companion_plants is an array. Return the complete updated JSON.` }]
        }],
        tools: [{ google_search: {} }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              variety_name: { type: "STRING" }, vendor: { type: "STRING" }, days_to_maturity: { type: "INTEGER" }, species: { type: "STRING" }, category: { type: "STRING" }, notes: { type: "STRING" }, companion_plants: { type: "ARRAY", items: { type: "STRING" } }, seed_depth: { type: "STRING" }, plant_spacing: { type: "STRING" }, row_spacing: { type: "STRING" }, germination_days: { type: "STRING" }, sunlight: { type: "STRING" }, lifecycle: { type: "STRING" }, cold_stratification: { type: "BOOLEAN" }, stratification_days: { type: "INTEGER" }, light_required: { type: "BOOLEAN" }
            }
          }
        }
      };

      const result = await fetchWithRetry(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }, 3);
      const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (textResponse) {
        const parsedData = JSON.parse(textResponse.replace(/```json/g, '').replace(/```/g, '').trim());
        
        // Update form data safely, protecting original IDs and Images
        setEditFormData(prev => ({
          ...prev,
          ...parsedData,
          id: prev.id,
          images: prev.images,
          primaryImageIndex: prev.primaryImageIndex
        }));
      }

      // 2. Fetch a new image if there are less than 2
      const currentImages = editFormData.images || [];
      if (currentImages.length < 2) {
         const imgUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`;
         const imgPayload = {
             instances: { prompt: `A highly detailed, realistic macro photograph of a ${editFormData.variety_name} ${editFormData.category} plant or crop, growing naturally in a lush garden. Natural sunlight, high resolution, no text, no people.` },
             parameters: { sampleCount: 1 }
         };
         
         const imgResult = await fetchWithRetry(imgUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(imgPayload) }, 2);
         
         if (imgResult.predictions?.[0]?.bytesBase64Encoded) {
            const base64Img = `data:image/png;base64,${imgResult.predictions[0].bytesBase64Encoded}`;
            setEditFormData(prev => ({
               ...prev,
               images: [...(prev.images || []), base64Img]
            }));
         }
      }
      
    } catch (e: any) {
      alert("Auto-fill failed: " + e.message);
    } finally {
      setIsAutoFilling(false);
    }
  };

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900 pb-20">
      <header className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center justify-between border-b border-stone-200">
        <div className="flex items-center gap-3">
          <button onClick={() => handleGoBack('seed_detail')} className="p-2 text-stone-500 hover:bg-stone-100 rounded-full transition-colors"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
          <h1 className="text-xl font-bold text-stone-800">Edit Seed</h1>
        </div>
        <button onClick={handleSaveEdit} className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-500 transition-colors shadow-sm">Save</button>
      </header>

      <div className="max-w-md mx-auto p-4 space-y-5">
        
        {/* MAGIC AUTO-FILL BUTTON */}
        <button 
          onClick={handleAutoFill}
          disabled={isAutoFilling}
          className="w-full py-4 bg-indigo-600 text-white font-bold rounded-xl shadow-md hover:bg-indigo-500 transition-all flex items-center justify-center gap-2 disabled:opacity-75 disabled:cursor-not-allowed"
        >
          {isAutoFilling ? (
            <>
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              Gathering Data & Images...
            </>
          ) : (
            <>
              <svg className="w-5 h-5 text-indigo-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              ✨ Auto-Fill Missing Data (AI)
            </>
          )}
        </button>

        <section className="bg-white p-5 rounded-2xl shadow-sm border border-stone-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-stone-800">Photos</h3>
            <button onClick={() => editPhotoInputRef.current?.click()} className="text-emerald-600 text-sm font-bold flex items-center gap-1 hover:text-emerald-500 bg-emerald-50 px-3 py-1.5 rounded-lg"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>Add Photo</button>
            <input type="file" accept="image/*" capture="environment" ref={editPhotoInputRef} className="hidden" onChange={handleEditPhotoCapture} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {(!editFormData.images || editFormData.images.length === 0) && <p className="text-xs text-stone-400 col-span-3 text-center py-4">No photos attached.</p>}
            {(editFormData.images || []).map((img: string, idx: number) => (
              <div key={idx} className={`relative aspect-square rounded-xl overflow-hidden border-2 shadow-sm ${idx === (editFormData.primaryImageIndex || 0) ? 'border-emerald-500' : 'border-stone-200'}`}>
                <img src={img} alt="Seed" className="w-full h-full object-cover" />
                <div className="absolute top-1 right-1 flex flex-col gap-1">
                   <button onClick={() => setEditFormData({...editFormData, primaryImageIndex: idx})} className={`p-1.5 rounded-full backdrop-blur-sm ${idx === (editFormData.primaryImageIndex || 0) ? 'bg-emerald-500 text-white shadow-md' : 'bg-stone-900/40 text-stone-100 hover:bg-stone-900/60'}`}><svg className="w-3.5 h-3.5" fill={idx === (editFormData.primaryImageIndex || 0) ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg></button>
                   <button onClick={() => handleRemoveImage(idx)} className="p-1.5 rounded-full bg-red-500/80 backdrop-blur-sm text-white hover:bg-red-500 shadow-sm"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                </div>
              </div>
            ))}
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

        <button onClick={handleDeleteSeed} className="w-full py-4 mt-4 bg-red-50 text-red-600 font-bold rounded-xl border border-red-200 hover:bg-red-100 transition-colors flex items-center justify-center gap-2"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>Delete Seed Permanently</button>
      </div>
    </main>
  );
}