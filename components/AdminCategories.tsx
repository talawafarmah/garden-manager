import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { SeedCategory, AppView } from '../types';

interface Props {
  categories: SeedCategory[];
  setCategories: React.Dispatch<React.SetStateAction<SeedCategory[]>>;
  navigateTo: (view: AppView) => void;
  handleGoBack: (view: AppView) => void;
  userRole?: string;
}

export default function AdminCategories({ categories, setCategories, handleGoBack, userRole }: Props) {
  const [localCategories, setLocalCategories] = useState<SeedCategory[]>([...categories]);
  const [isSaving, setIsSaving] = useState(false);

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
          // Upsert based on name (since names are unique in your setup)
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

  if (userRole !== 'admin') return <div className="p-10 text-center">Access Denied</div>;

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900 pb-20 font-sans">
      <header className="bg-stone-900 text-white p-4 shadow-md sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => handleGoBack('admin_hub')} className="p-2 bg-stone-800 rounded-full hover:bg-stone-700 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h1 className="text-xl font-bold">Category Config</h1>
        </div>
        <button onClick={handleSaveAll} disabled={isSaving} className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-emerald-500 active:scale-95 transition-all disabled:opacity-50 shadow-sm">
          {isSaving ? 'Saving...' : 'Save All'}
        </button>
      </header>

      <div className="max-w-xl mx-auto p-4 mt-4">
        <p className="text-sm text-stone-500 mb-6 bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
          Set the default number of weeks a plant category needs to spend in the nursery before your target plant-out date. (e.g. Set Peppers to 8 weeks).
        </p>

        <div className="space-y-3">
          {localCategories.map((cat, idx) => (
            <div key={idx} className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200 flex items-center justify-between gap-4">
              <div className="flex-1">
                <h3 className="font-black text-stone-800 text-lg">{cat.name}</h3>
                <p className="text-[10px] font-mono text-stone-400 uppercase tracking-widest">Prefix: {cat.prefix}</p>
              </div>
              <div className="bg-stone-50 p-2 rounded-xl border border-stone-200 flex items-center gap-2">
                <input 
                  type="number" 
                  min="0"
                  value={cat.default_nursery_weeks ?? 4} 
                  onChange={(e) => handleUpdate(idx, 'default_nursery_weeks', Number(e.target.value))}
                  className="w-16 text-center bg-white border border-stone-300 rounded-lg py-1.5 text-lg font-black text-purple-700 outline-none focus:border-purple-500 shadow-inner" 
                />
                <span className="text-[10px] font-black uppercase tracking-widest text-stone-400 mr-2">Weeks</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}