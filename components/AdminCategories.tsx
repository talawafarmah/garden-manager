import React, { useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { SeedCategory, AppView, InventorySeed } from '../types';

interface Props {
  categories: SeedCategory[];
  setCategories: React.Dispatch<React.SetStateAction<SeedCategory[]>>;
  inventory: InventorySeed[];
  setInventory: React.Dispatch<React.SetStateAction<InventorySeed[]>>;
  navigateTo: (view: AppView) => void;
  handleGoBack: (view: AppView) => void;
  userRole?: string;
}

export default function AdminCategories({ categories, setCategories, inventory, setInventory, handleGoBack, userRole }: Props) {
  const [localCategories, setLocalCategories] = useState<SeedCategory[]>([...categories]);
  const [isSaving, setIsSaving] = useState(false);

  // Bulk Move State
  const [filterCat, setFilterCat] = useState<string>("ALL");
  const [targetCat, setTargetCat] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isMoving, setIsMoving] = useState(false);

  // --- 1. Category Setup Logic ---
  const handleUpdate = (index: number, field: keyof SeedCategory, value: any) => {
    const updated = [...localCategories];
    updated[index] = { ...updated[index], [field]: value };
    setLocalCategories(updated);
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      for (const cat of localCategories) {
        if (cat.name) {
          await supabase.from('seed_categories').upsert({
            name: cat.name,
            prefix: cat.prefix,
            default_nursery_weeks: cat.default_nursery_weeks || 4
          }, { onConflict: 'name' });
        }
      }
      setCategories(localCategories);
      alert("Category settings saved!");
    } catch (e: any) {
      alert("Error saving: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  // --- 2. Bulk Re-Categorize Logic ---
  const filteredSeeds = useMemo(() => {
    let result = [...inventory];
    if (filterCat !== "ALL") {
      result = result.filter(s => s.category === filterCat);
    }
    return result.sort((a, b) => a.variety_name.localeCompare(b.variety_name));
  }, [inventory, filterCat]);

  const toggleSeed = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    if (selectedIds.length === filteredSeeds.length) {
      setSelectedIds([]); // Deselect all
    } else {
      setSelectedIds(filteredSeeds.map(s => s.id)); // Select all
    }
  };

  const handleBulkMove = async () => {
    if (!targetCat || selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to move ${selectedIds.length} seeds to the "${targetCat}" category?`)) return;

    setIsMoving(true);
    try {
      const { error } = await supabase
        .from('seed_inventory')
        .update({ category: targetCat })
        .in('id', selectedIds);

      if (error) throw error;

      // Update local state
      const updatedInventory = inventory.map(s => 
        selectedIds.includes(s.id) ? { ...s, category: targetCat } : s
      );
      setInventory(updatedInventory);
      setSelectedIds([]);
      
      alert("Seeds successfully re-categorized!");
    } catch (e: any) {
      alert("Error moving seeds: " + e.message);
    } finally {
      setIsMoving(false);
    }
  };

  if (userRole !== 'admin') return <div className="p-10 text-center">Access Denied</div>;

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900 pb-24 font-sans">
      <header className="bg-stone-900 text-white p-4 shadow-md sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => handleGoBack('admin_hub')} className="p-2 bg-stone-800 rounded-full hover:bg-stone-700 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h1 className="text-xl font-bold">Category Config</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-4 mt-4 space-y-8">
        
        {/* SECTION 1: GLOBAL NURSERY WEEKS */}
        <section className="bg-white p-6 rounded-3xl shadow-sm border border-stone-200">
          <div className="flex justify-between items-center mb-4 border-b border-stone-100 pb-3">
            <div>
              <h2 className="font-black text-stone-800 text-lg">1. Nursery Times</h2>
              <p className="text-xs text-stone-500 mt-0.5">Set the default number of weeks each category spends indoors.</p>
            </div>
            <button onClick={handleSaveAll} disabled={isSaving} className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-emerald-500 active:scale-95 transition-all disabled:opacity-50 shadow-sm flex-shrink-0">
              {isSaving ? 'Saving...' : 'Save All'}
            </button>
          </div>

          <div className="space-y-3">
            {localCategories.map((cat, idx) => (
              <div key={idx} className="bg-stone-50 p-3 rounded-2xl border border-stone-200 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-stone-800 text-base truncate">{cat.name}</h3>
                  <p className="text-[10px] font-mono text-stone-400 uppercase tracking-widest">Prefix: {cat.prefix}</p>
                </div>
                <div className="bg-white p-1.5 rounded-xl border border-stone-200 flex items-center gap-2 shadow-sm flex-shrink-0">
                  <input 
                    type="number" 
                    min="0"
                    value={cat.default_nursery_weeks ?? 4} 
                    onChange={(e) => handleUpdate(idx, 'default_nursery_weeks', Number(e.target.value))}
                    className="w-12 sm:w-16 text-center bg-stone-50 border border-stone-300 rounded-lg py-1.5 text-sm sm:text-lg font-black text-purple-700 outline-none focus:border-purple-500 shadow-inner" 
                  />
                  <span className="text-[10px] font-black uppercase tracking-widest text-stone-400 mr-2">Weeks</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 2: BULK RE-CATEGORIZE */}
        <section className="bg-white p-6 rounded-3xl shadow-sm border border-stone-200">
          <div className="mb-4 border-b border-stone-100 pb-3">
            <h2 className="font-black text-stone-800 text-lg">2. Bulk Re-Categorize</h2>
            <p className="text-xs text-stone-500 mt-0.5">Quickly move multiple seeds into the correct category.</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mb-4">
             <div className="flex-1">
                <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Show me seeds in:</label>
                <div className="relative">
                  <select value={filterCat} onChange={e => { setFilterCat(e.target.value); setSelectedIds([]); }} className="w-full bg-stone-50 border border-stone-200 rounded-xl py-3 pl-4 pr-8 text-sm font-bold outline-none focus:border-emerald-500 appearance-none">
                     <option value="ALL">-- All Categories --</option>
                     {categories.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                  <svg className="w-4 h-4 text-stone-400 absolute right-3 top-3.5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
             </div>
             <div className="flex-1">
                <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Target Category:</label>
                <div className="relative">
                  <select value={targetCat} onChange={e => setTargetCat(e.target.value)} className="w-full bg-purple-50 border border-purple-200 rounded-xl py-3 pl-4 pr-8 text-sm font-bold outline-none focus:border-purple-500 text-purple-800 appearance-none">
                     <option value="">-- Select Destination --</option>
                     {categories.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                  <svg className="w-4 h-4 text-purple-400 absolute right-3 top-3.5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
             </div>
          </div>

          <div className="flex justify-between items-end mb-2 px-1">
            <button onClick={toggleAll} className="text-[10px] font-black uppercase tracking-widest text-stone-400 hover:text-stone-800 transition-colors">
              {selectedIds.length === filteredSeeds.length && filteredSeeds.length > 0 ? "Deselect All" : "Select All"}
            </button>
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">{filteredSeeds.length} Total</span>
          </div>

          <div className="border border-stone-200 rounded-2xl max-h-[350px] overflow-y-auto mb-4 bg-stone-50/50 shadow-inner">
             {filteredSeeds.length === 0 ? (
               <div className="p-8 text-center text-sm text-stone-400 italic">No seeds found in this category.</div>
             ) : (
               <div className="divide-y divide-stone-200">
                 {filteredSeeds.map(seed => (
                   <label key={seed.id} className="flex items-center gap-3 p-3 hover:bg-white cursor-pointer transition-colors group">
                      <input 
                        type="checkbox" 
                        checked={selectedIds.includes(seed.id)} 
                        onChange={() => toggleSeed(seed.id)} 
                        className="w-5 h-5 text-purple-600 rounded border-stone-300 focus:ring-purple-500 bg-white" 
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm text-stone-800 truncate group-hover:text-emerald-700 transition-colors">{seed.variety_name}</div>
                        <div className="text-[10px] text-stone-400 uppercase tracking-widest truncate">{seed.category} • {seed.id}</div>
                      </div>
                   </label>
                 ))}
               </div>
             )}
          </div>

          <button 
            onClick={handleBulkMove} 
            disabled={selectedIds.length === 0 || !targetCat || isMoving} 
            className="w-full py-4 bg-purple-600 text-white rounded-xl font-black text-sm uppercase tracking-widest shadow-lg shadow-purple-900/20 active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
          >
            {isMoving ? 'Moving...' : `Move ${selectedIds.length} Seeds`}
            {!isMoving && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>}
          </button>
        </section>

      </div>
    </main>
  );
}