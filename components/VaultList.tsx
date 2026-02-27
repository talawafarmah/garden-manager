import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { InventorySeed, SeedCategory, AppView } from '../types';

export default function VaultList({ inventory, setInventory, categories, isLoadingDB, navigateTo, handleGoBack }: any) {
  const [seeds, setSeeds] = useState<InventorySeed[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  
  // Pagination States
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isPagingDB, setIsPagingDB] = useState(false);
  const PAGE_SIZE = 20;

  // Companion Modal States
  const [companionModalSeed, setCompanionModalSeed] = useState<InventorySeed | null>(null);
  const [companionInStockOnly, setCompanionInStockOnly] = useState(false);
  const [companionMatches, setCompanionMatches] = useState<InventorySeed[]>([]);
  const [isLoadingCompanions, setIsLoadingCompanions] = useState(false);

  // Debounced Search & Filter Effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setPage(0);
      fetchSeeds(0, true);
    }, 300); // Wait 300ms after typing stops to query DB
    return () => clearTimeout(timeoutId);
  }, [searchQuery, activeFilter]);

  const fetchSeeds = async (pageNumber: number, reset: boolean = false) => {
    setIsPagingDB(true);
    let query = supabase.from('seed_inventory').select('*', { count: 'exact' });

    // Apply Category Filter
    if (activeFilter !== "All") {
      query = query.eq('category', activeFilter);
    }
    
    // Apply Search Query via DB
    if (searchQuery.trim() !== "") {
      query = query.or(`variety_name.ilike.%${searchQuery}%,category.ilike.%${searchQuery}%,id.ilike.%${searchQuery}%`);
    }

    // Apply Pagination Range
    const from = pageNumber * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    
    const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, to);

    if (error) {
      console.error("Error fetching inventory:", error);
      alert("Failed to load inventory: " + error.message);
    } else if (data) {
      const sanitizedData = data.map(s => ({ ...s, companion_plants: s.companion_plants || [] }));
      
      if (reset) {
        setSeeds(sanitizedData);
      } else {
        setSeeds(prev => [...prev, ...sanitizedData]);
      }
      
      // Determine if there are more records to load
      setHasMore(count !== null && from + data.length < count);
    }
    setIsPagingDB(false);
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchSeeds(nextPage);
  };

  const toggleOutOfStock = async (seed: InventorySeed, e: React.MouseEvent) => {
    e.stopPropagation(); 
    const newStatus = !seed.out_of_stock;
    
    // Optimistic UI update
    setSeeds(seeds.map((s: InventorySeed) => s.id === seed.id ? { ...s, out_of_stock: newStatus } : s));
    
    const { error } = await supabase.from('seed_inventory').update({ out_of_stock: newStatus }).eq('id', seed.id);
    if (error) {
      alert("Failed to update stock status: " + error.message);
      // Revert on error
      setSeeds(seeds.map((s: InventorySeed) => s.id === seed.id ? { ...s, out_of_stock: !newStatus } : s));
    }
  };

  const openCompanionModal = async (seed: InventorySeed, e: React.MouseEvent) => {
    e.stopPropagation();
    setCompanionModalSeed(seed);
    setCompanionInStockOnly(false);
    
    // Fetch companion matches dynamically so we don't need the whole DB loaded
    if (seed.companion_plants && seed.companion_plants.length > 0) {
      setIsLoadingCompanions(true);
      const orQuery = seed.companion_plants.map((c: string) => `category.ilike.%${c}%,variety_name.ilike.%${c}%`).join(',');
      
      const { data, error } = await supabase
        .from('seed_inventory')
        .select('id, variety_name, category, out_of_stock')
        .neq('id', seed.id)
        .or(orQuery);
        
      if (!error && data) {
        setCompanionMatches(data as InventorySeed[]);
      }
      setIsLoadingCompanions(false);
    } else {
      setCompanionMatches([]);
    }
  };

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900 pb-20">
      
      {/* COMPANION PLANT MODAL */}
      {companionModalSeed && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm max-h-[80vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
             <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-stone-800 text-lg leading-tight">Companion Plants</h3>
                  <p className="text-xs text-stone-500 mt-0.5">for {companionModalSeed.variety_name}</p>
                </div>
                <button onClick={() => setCompanionModalSeed(null)} className="p-1.5 rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
             </div>

             <div className="flex items-center gap-2 mb-4 bg-stone-50 p-2.5 rounded-xl border border-stone-200">
                <input type="checkbox" id="inStockToggle" checked={companionInStockOnly} onChange={e => setCompanionInStockOnly(e.target.checked)} className="w-4 h-4 accent-emerald-600 rounded" />
                <label htmlFor="inStockToggle" className="text-sm font-medium text-stone-700 cursor-pointer select-none">Only show seeds I own</label>
             </div>

             <div className="overflow-y-auto flex-1 space-y-3 pr-1 scrollbar-hide">
               {(!companionModalSeed.companion_plants || companionModalSeed.companion_plants.length === 0) && (
                  <div className="text-center py-6 text-stone-400">
                    <svg className="w-10 h-10 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    <p className="text-sm">No companions recorded.</p>
                  </div>
               )}
               
               {isLoadingCompanions ? (
                 <div className="flex justify-center py-6 text-emerald-600"><svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>
               ) : (
                 (companionModalSeed.companion_plants || []).map((comp: string) => {
                   const matches = companionMatches.filter((s: InventorySeed) =>
                     (!companionInStockOnly || !s.out_of_stock) &&
                     (s.category.toLowerCase().includes(comp.toLowerCase()) || s.variety_name.toLowerCase().includes(comp.toLowerCase()) || comp.toLowerCase().includes(s.category.toLowerCase()) || comp.toLowerCase().includes(s.variety_name.toLowerCase()))
                   );

                   if (companionInStockOnly && matches.length === 0) return null;

                   return (
                     <div key={comp} className="border border-stone-200 rounded-xl p-3.5 bg-white shadow-sm">
                       <h4 className="font-bold text-stone-800 text-sm flex items-center gap-2">
                         {matches.length > 0 && <span className="w-2 h-2 rounded-full bg-emerald-500"></span>}
                         {comp}
                       </h4>
                       {matches.length > 0 ? (
                         <div className="mt-2.5 space-y-1.5">
                           {matches.map((m: InventorySeed) => (
                             <div key={m.id} className={`text-xs px-2.5 py-1.5 rounded-lg flex items-center justify-between border ${m.out_of_stock ? 'bg-stone-50 border-stone-200 text-stone-500' : 'bg-emerald-50 border-emerald-100 text-emerald-800'}`}>
                               <span className="truncate font-medium">{m.variety_name}</span>
                               <span className="font-mono text-[9px] opacity-70 ml-2 bg-emerald-100 px-1 rounded">{m.id}</span>
                             </div>
                           ))}
                         </div>
                       ) : (
                         <p className="text-xs text-stone-400 mt-1.5 italic">Not currently in your inventory</p>
                       )}
                     </div>
                   );
                 })
               )}
             </div>
          </div>
        </div>
      )}

      <header className="bg-emerald-700 text-white p-4 shadow-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => handleGoBack('dashboard')} className="p-2 bg-emerald-800 rounded-full hover:bg-emerald-600 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Seed Vault</h1>
          </div>
        </div>
      </header>

      <div className="max-w-md mx-auto p-4 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <input 
            type="text" 
            placeholder="Search by name, category, or code..." 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            className="w-full bg-white border border-stone-200 rounded-xl py-3 pl-10 pr-4 shadow-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all" 
          />
          <svg className="w-5 h-5 text-stone-400 absolute left-3 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>

        {/* Dynamic Filter Chips */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button onClick={() => setActiveFilter("All")} className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${activeFilter === 'All' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'}`}>All</button>
          {categories.map((cat: SeedCategory) => (
            <button key={cat.name} onClick={() => setActiveFilter(cat.name)} className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${activeFilter === cat.name ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'}`}>{cat.name}</button>
          ))}
        </div>

        {/* Seed List */}
        <div className="space-y-3">
          {isPagingDB && page === 0 ? (
            <div className="flex justify-center items-center py-10 text-emerald-600"><svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>
          ) : seeds.length > 0 ? (
            <>
              {seeds.map((seed: InventorySeed) => {
                const thumb = seed.images && seed.images.length > 0 ? seed.images[seed.primaryImageIndex || 0] : null;
                const isOutOfStock = seed.out_of_stock;

                return (
                  <div key={seed.id} onClick={() => navigateTo('seed_detail', seed)} className={`bg-white p-3 rounded-xl border ${isOutOfStock ? 'border-red-100 bg-stone-50/50 opacity-75' : 'border-stone-100'} shadow-sm flex flex-col gap-3 hover:border-emerald-400 hover:shadow-md transition-all active:scale-95 cursor-pointer`}>
                    <div className="flex items-start gap-4">
                      <div className={`w-16 h-16 rounded-lg bg-stone-100 overflow-hidden flex-shrink-0 border border-stone-200 ${isOutOfStock ? 'grayscale' : ''}`}>
                        {thumb ? (
                          <img src={thumb} alt={seed.variety_name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-stone-300"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 py-1">
                        <div className="flex justify-between items-start mb-0.5">
                          <h3 className={`font-bold text-base leading-tight truncate pr-2 ${isOutOfStock ? 'text-stone-500 line-through decoration-stone-300' : 'text-stone-800'}`}>{seed.variety_name}</h3>
                          <div className="bg-stone-100 text-stone-600 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border border-stone-200 shadow-inner whitespace-nowrap">{seed.id}</div>
                        </div>
                        <div className="text-xs text-emerald-600 font-semibold mb-2 truncate">{seed.category} <span className="text-stone-400 font-normal italic">({seed.species})</span></div>
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="font-medium text-stone-600 flex items-center gap-1 bg-stone-100 px-1.5 py-0.5 rounded border border-stone-200"><svg className="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>{seed.plant_spacing || '--'}</span>
                          <span className="font-bold text-stone-700 bg-stone-100 px-1.5 py-0.5 rounded flex-shrink-0 border border-stone-200">{seed.days_to_maturity} DTM</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center border-t border-stone-100 pt-2">
                      <button onClick={(e) => openCompanionModal(seed, e)} className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-md transition-colors border bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 flex items-center gap-1.5"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>Companions</button>
                      <button onClick={(e) => toggleOutOfStock(seed, e)} className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-md transition-colors border ${isOutOfStock ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' : 'bg-stone-50 text-stone-500 border-stone-200 hover:bg-stone-100 hover:text-stone-800'}`}>{isOutOfStock ? 'Mark In Stock' : 'Mark Out of Stock'}</button>
                    </div>
                  </div>
                );
              })}

              {/* Load More Button */}
              {hasMore && (
                <button 
                  onClick={handleLoadMore} 
                  disabled={isPagingDB}
                  className="w-full py-4 mt-2 bg-white text-emerald-600 font-bold rounded-xl border border-stone-200 hover:border-emerald-300 hover:bg-emerald-50 transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isPagingDB ? (
                     <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  ) : "Load More"}
                </button>
              )}
            </>
          ) : !isPagingDB ? (
            <div className="text-center py-10 text-stone-500 bg-white rounded-xl border border-stone-100 shadow-sm">
              <svg className="w-12 h-12 mx-auto text-stone-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p>No seeds found matching your filters.</p>
            </div>
          ) : null}
          
          {isPagingDB && page > 0 && (
             <div className="flex justify-center items-center py-4 text-emerald-600"><svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>
          )}
        </div>
      </div>
    </main>
  );
}