import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { InventorySeed, SeedlingTray } from '../types';

interface SeedDetailProps {
  seed: InventorySeed;
  trays: SeedlingTray[];
  categories: any[];
  navigateTo: (view: any, payload?: any) => void;
  handleGoBack: (view: any) => void;
  userRole?: string;
}

// Scheduling Helpers
const resolveNurseryWeeks = (seed: any, categories: any[]) => {
  if (seed.custom_nursery_weeks !== null && seed.custom_nursery_weeks !== undefined) return seed.custom_nursery_weeks;
  const cat = categories?.find(c => c.name === seed.category);
  if (cat && cat.default_nursery_weeks !== null && cat.default_nursery_weeks !== undefined) return cat.default_nursery_weeks;
  return 4; 
};

const parseGermDays = (str?: string) => {
  if (!str) return 7;
  const nums = str.match(/\d+/g);
  if (nums) return Math.max(...nums.map(Number));
  return 7;
};

const calculateStartDate = (target: string, weeks: number, germStr?: string) => {
  if (!target) return "";
  const targetDate = new Date(target + 'T12:00:00');
  const germDays = parseGermDays(germStr);
  targetDate.setDate(targetDate.getDate() - ((weeks * 7) + germDays));
  
  const y = targetDate.getFullYear();
  const m = String(targetDate.getMonth() + 1).padStart(2, '0');
  const d = String(targetDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export default function SeedDetail({ seed, trays, categories, navigateTo, handleGoBack, userRole }: SeedDetailProps) {
  const [viewingImageIndex, setViewingImageIndex] = useState(seed.primaryImageIndex || 0);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  
  const [parents, setParents] = useState<{mother?: string, father?: string}>({});

  // Planner Modal State
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [planForm, setPlanForm] = useState({
    seasonId: '',
    targetDate: '',
    qty: 1,
    weeks: 6
  });

  useEffect(() => {
    let isMounted = true;
    
    const loadSignedUrls = async () => {
      try {
        if (!seed.images || !Array.isArray(seed.images) || seed.images.length === 0) return;
        
        const urlsToFetch = seed.images.filter((img: string) => 
          img && typeof img === 'string' && !img.startsWith('http') && !img.startsWith('data:')
        );
        
        if (urlsToFetch.length === 0) return;

        const fetchedUrls: Record<string, string> = {};
        const { data, error } = await supabase.storage.from('talawa_media').createSignedUrls(urlsToFetch, 3600);

        if (data && !error) {
          data.forEach((item: any) => { 
            if (item.signedUrl) fetchedUrls[item.path] = item.signedUrl; 
          });
        } else {
          for (const imgPath of urlsToFetch) {
            const { data: d } = await supabase.storage.from('talawa_media').createSignedUrl(imgPath, 3600);
            if (d?.signedUrl) fetchedUrls[imgPath] = d.signedUrl;
          }
        }
        
        if (isMounted && Object.keys(fetchedUrls).length > 0) {
          setSignedUrls(prev => ({ ...prev, ...fetchedUrls }));
        }
      } catch (err) { 
        console.error("Error in signed URL resolver:", err); 
      }
    };

    const fetchParents = async () => {
       if (!seed.parent_id_female && !seed.parent_id_male) return;
       
       const idsToFetch = [seed.parent_id_female, seed.parent_id_male].filter(Boolean);
       const { data } = await supabase.from('seed_inventory').select('id, variety_name').in('id', idsToFetch);
       
       if (data && isMounted) {
          const parentMap: any = {};
          if (seed.parent_id_female) {
            parentMap.mother = data.find(d => d.id === seed.parent_id_female)?.variety_name || 'Unknown';
          }
          if (seed.parent_id_male) {
            parentMap.father = data.find(d => d.id === seed.parent_id_male)?.variety_name || 'Unknown';
          }
          setParents(parentMap);
       }
    };

    loadSignedUrls();
    fetchParents();
    
    return () => { isMounted = false; };
  }, [seed]);

  const onBack = () => { 
    if (seed?.returnTo) {
      navigateTo(seed.returnTo, seed.returnPayload);
    } else {
      handleGoBack('vault');
    }
  };

  const onEdit = () => { 
    navigateTo('seed_edit', { 
      ...seed, 
      returnTo: seed?.returnTo, 
      returnPayload: seed?.returnPayload 
    }); 
  };

  const handleDuplicateSeed = () => {
    const duplicatedSeed = {
      ...seed,
      id: '', 
      variety_name: `${seed.variety_name} (Copy)`,
      images: [], 
      thumbnail: '',
      out_of_stock: false 
    };
    navigateTo('seed_edit', duplicatedSeed);
  };

  const handleBreedSeed = () => {
    const nextGenSeed = {
      id: '', 
      category: seed.category, 
      variety_name: `${seed.variety_name} (Saved)`, 
      vendor: 'Homegrown', 
      days_to_maturity: seed.days_to_maturity, 
      species: seed.species, 
      notes: `Saved from ${seed.id}. `, 
      images: [], 
      primaryImageIndex: 0, 
      companion_plants: seed.companion_plants, 
      cold_stratification: seed.cold_stratification, 
      stratification_days: seed.stratification_days, 
      light_required: seed.light_required, 
      germination_days: seed.germination_days, 
      seed_depth: seed.seed_depth, 
      plant_spacing: seed.plant_spacing, 
      row_spacing: seed.row_spacing, 
      out_of_stock: false, 
      sunlight: seed.sunlight, 
      lifecycle: seed.lifecycle, 
      thumbnail: '', 
      scoville_rating: seed.scoville_rating, 
      tomato_type: seed.tomato_type,
      parent_id_female: seed.id, 
      generation: 'Gen 2'
    };
    navigateTo('seed_edit', nextGenSeed);
  };

  // Planner Functions
  const openPlanModal = async () => {
    const { data } = await supabase.from('seasons').select('*').order('created_at', { ascending: false });
    if (data && data.length > 0) {
      setSeasons(data);
      const active = data.find((s: any) => s.status === 'Active') || data[0];
      const todayObj = new Date();
      const localToday = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
      
      setPlanForm({
        seasonId: active.id,
        targetDate: active.seedling_target_date || localToday,
        qty: 1,
        weeks: resolveNurseryWeeks(seed, categories)
      });
      setIsPlanModalOpen(true);
    } else {
       alert("You need to create a Season in the Admin Settings before scheduling seeds.");
    }
  };

  const handleSavePlan = async () => {
    if (!planForm.seasonId || !planForm.targetDate) return;
    setIsSavingPlan(true);
    try {
      const startDate = calculateStartDate(planForm.targetDate, planForm.weeks, seed.germination_days);
      const payload = {
        season_id: planForm.seasonId,
        seed_id: seed.id,
        target_plant_date: planForm.targetDate,
        planned_qty: planForm.qty,
        sown_qty: 0,
        indoor_start_date: startDate
      };
      
      const { error } = await supabase.from('grow_plan').insert([payload]);
      if (error) throw new Error(error.message);
      
      alert(`Successfully added ${seed.variety_name} to the Grow Planner!`);
      setIsPlanModalOpen(false);
    } catch (err: any) {
      alert("Error saving plan: " + err.message);
    } finally {
      setIsSavingPlan(false);
    }
  };

  const rawImgPath = (seed.images && seed.images.length > 0) ? seed.images[viewingImageIndex] : null;
  const displayImg = rawImgPath 
    ? (rawImgPath.startsWith('http') || rawImgPath.startsWith('data:') ? rawImgPath : signedUrls[rawImgPath]) 
    : null;

  const isTomato = seed.category?.toLowerCase().includes('tomato');
  const isPepper = seed.category?.toLowerCase().includes('pepper');
  const shu = seed.scoville_rating !== undefined && seed.scoville_rating !== null ? Number(seed.scoville_rating) : null;

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900 pb-20 font-sans relative">
      
      {fullScreenImage && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 cursor-zoom-out" onClick={() => setFullScreenImage(null)}>
          <img src={fullScreenImage} className="max-w-full max-h-full object-contain rounded-lg" alt="Fullscreen" />
        </div>
      )}

      {/* SCHEDULE SEED MODAL */}
      {isPlanModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-stone-50 p-4 border-b border-stone-200 flex justify-between items-center">
              <div>
                <h2 className="font-black text-stone-800 tracking-tight">Schedule Seed</h2>
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mt-0.5">{seed.variety_name}</p>
              </div>
              <button onClick={() => setIsPlanModalOpen(false)} className="p-1 rounded-full text-stone-400 hover:bg-stone-200 hover:text-stone-800">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Target Season</label>
                <select 
                  value={planForm.seasonId} 
                  onChange={e => {
                    const newSeasonId = e.target.value;
                    const selectedSeason = seasons.find(s => s.id === newSeasonId);
                    setPlanForm({
                      ...planForm, 
                      seasonId: newSeasonId,
                      targetDate: selectedSeason?.seedling_target_date || planForm.targetDate
                    });
                  }} 
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-emerald-500 shadow-sm appearance-none cursor-pointer"
                >
                  {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                 <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 text-center">
                    <span className="block text-[9px] font-black uppercase tracking-widest text-stone-400 mb-1">Nursery Time</span>
                    <div className="flex items-center justify-center gap-1 text-sm font-black text-stone-800">
                      <input type="number" min="0" value={planForm.weeks} onChange={(e) => setPlanForm({...planForm, weeks: Number(e.target.value)})} className="w-10 text-center border-b border-stone-300 outline-none bg-transparent focus:border-emerald-500" /> Weeks
                    </div>
                 </div>
                 <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 text-center">
                    <span className="block text-[9px] font-black uppercase tracking-widest text-stone-400 mb-1">Planned Qty</span>
                    <input type="number" min="1" value={planForm.qty} onChange={(e) => setPlanForm({...planForm, qty: Number(e.target.value)})} className="w-full text-center bg-transparent text-lg font-black text-blue-600 outline-none border-b border-stone-300 focus:border-blue-500" />
                 </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Target Plant-Out Date</label>
                <input type="date" value={planForm.targetDate} onChange={(e) => setPlanForm({...planForm, targetDate: e.target.value})} className="w-full bg-white border border-stone-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-emerald-500 shadow-sm text-stone-800" />
              </div>
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex justify-between items-center mt-2 shadow-sm">
                <span className="text-xs font-black uppercase tracking-widest text-emerald-800">Start Date:</span>
                <span className="text-xl font-black text-emerald-600">
                  {planForm.targetDate ? new Date(calculateStartDate(planForm.targetDate, planForm.weeks, seed.germination_days) + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '--'}
                </span>
              </div>
              <button onClick={handleSavePlan} disabled={isSavingPlan} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black uppercase tracking-widest shadow-xl shadow-emerald-900/20 active:scale-95 transition-all mt-2 hover:bg-emerald-500 disabled:opacity-50">
                {isSavingPlan ? 'Saving...' : 'Confirm & Add to Calendar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="bg-emerald-700 text-white p-4 shadow-md sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="p-2 bg-emerald-800 rounded-full active:scale-90 transition-transform" title="Go Back">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <button onClick={() => navigateTo('dashboard')} className="p-2 bg-emerald-800 rounded-full active:scale-90 transition-transform" title="Dashboard">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </button>
        </div>

        <h1 className="text-lg font-bold truncate px-2">Seed Details</h1>
        
        <div className="flex gap-2 min-w-[80px] justify-end">
          {userRole === 'admin' && (
            <>
               <button onClick={openPlanModal} className="p-2 bg-emerald-800 rounded-full active:scale-90 transition-transform" title="Add to Planner">
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                 </svg>
               </button>
               <button onClick={handleDuplicateSeed} className="p-2 bg-emerald-800 rounded-full active:scale-90 transition-transform" title="Duplicate Seed">
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                 </svg>
               </button>
               <button onClick={handleBreedSeed} className="p-2 bg-emerald-800 rounded-full active:scale-90 transition-transform" title="Record Next Gen / Cross">
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                 </svg>
               </button>
               <button onClick={onEdit} className="p-2 bg-emerald-800 rounded-full active:scale-90 transition-transform" title="Edit Seed">
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                 </svg>
               </button>
            </>
          )}
        </div>
      </header>

      <div className="max-w-md mx-auto">
        <div className="relative aspect-square bg-stone-200 overflow-hidden group">
          {displayImg ? (
            <img 
              src={displayImg} 
              onClick={() => setFullScreenImage(displayImg)} 
              className="w-full h-full object-cover cursor-zoom-in" 
              alt={seed.variety_name} 
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-stone-400 gap-2">
              <svg className="w-12 h-12 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-[10px] uppercase font-black tracking-widest">No Image Loaded</span>
            </div>
          )}
          
          <div className="absolute bottom-0 left-0 w-full p-6 bg-gradient-to-t from-stone-900 via-stone-900/40 to-transparent text-white">
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-emerald-500 text-[10px] font-black px-2 py-0.5 rounded shadow-sm">{seed.id}</span>
              {seed.generation && <span className="bg-purple-500 text-[10px] font-black px-2 py-0.5 rounded shadow-sm">{seed.generation}</span>}
              {seed.out_of_stock && <span className="bg-red-500 text-[10px] font-black px-2 py-0.5 rounded shadow-sm">OUT OF STOCK</span>}
            </div>
            <h2 className="text-2xl font-black tracking-tight leading-tight">{seed.variety_name}</h2>
            <p className="text-emerald-300 text-xs font-bold uppercase tracking-widest opacity-90">
              {seed.category} <span className="text-white/60 font-medium italic lowercase">({seed.species})</span>
            </p>
          </div>
        </div>

        {seed.images && seed.images.length > 1 && (
          <div className="flex gap-2 p-4 bg-white border-b border-stone-100 overflow-x-auto scrollbar-hide">
            {seed.images.map((path, idx) => {
              const tSrc = path.startsWith('http') || path.startsWith('data:') ? path : signedUrls[path];
              return (
                <button 
                  key={idx} 
                  onClick={() => setViewingImageIndex(idx)} 
                  className={`flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${idx === viewingImageIndex ? 'border-emerald-500 scale-105 shadow-md' : 'border-transparent opacity-50'}`}
                >
                  {tSrc ? (
                    <img src={tSrc} className="w-full h-full object-cover" alt="Thumb" />
                  ) : (
                    <div className="w-full h-full bg-stone-100 animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className="p-4 space-y-4">
          
          {(seed.parent_id_female || seed.parent_id_male || seed.generation) && (
             <section className="bg-purple-50 border border-purple-100 p-4 rounded-3xl shadow-sm">
                <h3 className="text-[10px] font-black text-purple-800 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                  <svg className="w-3 h-3 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                  Lineage & Genetics
                </h3>
                <div className="space-y-2">
                   {seed.generation && (
                     <div className="flex justify-between items-center text-sm">
                        <span className="text-purple-600/70 font-bold">Generation</span>
                        <span className="font-black text-purple-900">{seed.generation}</span>
                     </div>
                   )}
                   {seed.parent_id_female && (
                     <div className="flex justify-between items-center text-sm">
                        <span className="text-purple-600/70 font-bold">Seed Parent (♀)</span>
                        <div className="text-right">
                          <span className="font-black text-purple-900 block">{parents.mother || 'Loading...'}</span>
                          <span className="text-[10px] font-mono text-purple-500">{seed.parent_id_female}</span>
                        </div>
                     </div>
                   )}
                   {seed.parent_id_male && (
                     <div className="flex justify-between items-center text-sm pt-1 border-t border-purple-200/50">
                        <span className="text-purple-600/70 font-bold">Pollen Parent (♂)</span>
                        <div className="text-right">
                          <span className="font-black text-purple-900 block">{parents.father || 'Loading...'}</span>
                          <span className="text-[10px] font-mono text-purple-500">{seed.parent_id_male}</span>
                        </div>
                     </div>
                   )}
                </div>
             </section>
          )}

          {(isTomato || isPepper) && (
            <div className="grid grid-cols-1 gap-2">
              {isTomato && seed.tomato_type && (
                <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex items-center gap-3">
                  <div className="bg-rose-500 text-white p-2 rounded-xl shadow-sm">🍅</div>
                  <div>
                    <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest leading-none mb-1">Tomato Growth Habit</p>
                    <p className="font-black text-rose-900">{seed.tomato_type}</p>
                  </div>
                </div>
              )}
              {isPepper && shu !== null && !isNaN(shu) && (
                <div className="bg-orange-50 border border-orange-100 p-4 rounded-2xl flex items-center gap-3">
                   <div className="bg-orange-500 text-white p-2 rounded-xl shadow-sm">🌶️</div>
                   <div>
                     <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest leading-none mb-1">Scoville Heat Units</p>
                     <p className="font-black text-orange-900">{shu.toLocaleString()} SHU</p>
                   </div>
                </div>
              )}
            </div>
          )}

          {(seed.vendor || seed.lifecycle) && (
            <section className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex justify-between items-center shadow-sm">
              {seed.vendor && (
                <div>
                  <p className="text-[9px] font-black text-blue-400 uppercase tracking-[0.2em] mb-0.5">Source / Vendor</p>
                  <p className="font-bold text-blue-900">{seed.vendor}</p>
                </div>
              )}
              {seed.lifecycle && (
                <div className="text-right">
                  <p className="text-[9px] font-black text-blue-400 uppercase tracking-[0.2em] mb-0.5">Lifecycle</p>
                  <p className="font-bold text-blue-900">{seed.lifecycle}</p>
                </div>
              )}
            </section>
          )}

          <section className="bg-white p-5 rounded-3xl shadow-sm border border-stone-200">
            <h3 className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-4 border-b border-stone-100 pb-2">Germination Protocol</h3>
            
            {seed.cold_stratification && (
              <div className="mb-4 bg-sky-50 border border-sky-100 p-3 rounded-xl flex items-start gap-3">
                <div className="text-sky-500 mt-0.5">❄️</div>
                <div>
                  <p className="font-black text-sky-800 text-sm">Cold Stratification Required</p>
                  <p className="text-xs text-sky-600 mt-1">This seed must be kept cold and moist for <strong>{seed.stratification_days || '--'} days</strong> before sowing.</p>
                </div>
              </div>
            )}

            {seed.light_required && (
              <div className="mb-4 bg-amber-50 border border-amber-100 p-3 rounded-xl flex items-start gap-3">
                <div className="text-amber-500 mt-0.5">☀️</div>
                <div>
                  <p className="font-black text-amber-800 text-sm">Light Required for Germination</p>
                  <p className="text-xs text-amber-600 mt-1">Do not bury this seed deeply. Surface sow and press lightly into soil.</p>
                </div>
              </div>
            )}

            {seed.custom_nursery_weeks != null && seed.custom_nursery_weeks !== undefined && (
              <div className="mb-4 bg-purple-50 border border-purple-100 p-3 rounded-xl flex items-start gap-3">
                <div className="text-purple-500 mt-0.5">🌱</div>
                <div>
                  <p className="font-black text-purple-800 text-sm">Nursery Override</p>
                  <p className="text-xs text-purple-600 mt-1">Requires <strong>{seed.custom_nursery_weeks} weeks</strong> indoors before plant-out.</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-y-4 gap-x-4">
              <div>
                <label className="block text-[9px] font-black text-stone-400 uppercase tracking-[0.2em] mb-1">Seed Depth</label>
                <p className="font-bold text-stone-800">{seed.seed_depth || '--'}</p>
              </div>
              <div>
                <label className="block text-[9px] font-black text-stone-400 uppercase tracking-[0.2em] mb-1">Germination Time</label>
                <p className="font-bold text-stone-800">{seed.germination_days || '--'} Days</p>
              </div>
            </div>
          </section>

          <section className="bg-white p-5 rounded-3xl shadow-sm border border-stone-200 grid grid-cols-2 gap-y-5 gap-x-4">
            <div className="col-span-2 border-b border-stone-100 pb-2 mb-1">
              <h3 className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em]">Growing Requirements</h3>
            </div>
            <div>
              <label className="block text-[9px] font-black text-stone-400 uppercase tracking-[0.2em] mb-1">Maturity</label>
              <p className="font-bold text-stone-800">{seed.days_to_maturity || '--'} Days</p>
            </div>
            <div>
              <label className="block text-[9px] font-black text-stone-400 uppercase tracking-[0.2em] mb-1">Sunlight</label>
              <p className="font-bold text-stone-800">{seed.sunlight || 'Full Sun'}</p>
            </div>
            <div>
              <label className="block text-[9px] font-black text-stone-400 uppercase tracking-[0.2em] mb-1">Plant Spacing</label>
              <p className="font-bold text-stone-800">{seed.plant_spacing || '--'}</p>
            </div>
            <div>
              <label className="block text-[9px] font-black text-stone-400 uppercase tracking-[0.2em] mb-1">Row Spacing</label>
              <p className="font-bold text-stone-800">{seed.row_spacing || '--'}</p>
            </div>
          </section>

          {seed.companion_plants && seed.companion_plants.length > 0 && (
            <section className="bg-white p-5 rounded-3xl shadow-sm border border-stone-200">
              <h3 className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2 border-b border-stone-100 pb-2">
                <svg className="w-3 h-3 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                Companion Plants
              </h3>
              <div className="flex flex-wrap gap-2">
                {seed.companion_plants.map((plant, i) => (
                  <span key={i} className="bg-stone-100 text-stone-600 px-3 py-1 rounded-lg text-xs font-bold border border-stone-200">
                    {plant}
                  </span>
                ))}
              </div>
            </section>
          )}

          <section className="bg-white p-6 rounded-3xl shadow-sm border border-stone-200">
            <h3 className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2 border-b border-stone-100 pb-2">
              <svg className="w-3 h-3 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Master Notes
            </h3>
            <p className="text-sm text-stone-600 leading-relaxed whitespace-pre-wrap italic">
              {seed.notes || "No cultivation notes recorded for this variety yet."}
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}