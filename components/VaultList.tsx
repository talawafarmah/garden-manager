import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { InventorySeed, SeedCategory, AppView } from '../types';

export default function VaultList({ inventory, setInventory, categories, isLoadingDB, navigateTo, handleGoBack, vaultState = { searchQuery: '', activeFilter: 'All', page: 0, scrollY: 0, sortBy: 'created_at_desc' }, setVaultState }: any) {
  const [seeds, setSeeds] = useState<InventorySeed[]>([]);
  
  const searchQuery = vaultState.searchQuery || "";
  const activeFilter = vaultState.activeFilter || "All";
  const page = vaultState.page || 0;
  const viewMode = vaultState.viewMode || "list";
  const sortBy = vaultState.sortBy || "created_at_desc";

  const updateVaultState = (updates: any) => {
     if (setVaultState) {
       setVaultState((prev: any) => ({ ...prev, ...updates }));
     }
  };

  const handleSetSearchQuery = (val: string) => updateVaultState({ searchQuery: val });
  const handleSetActiveFilter = (val: string) => updateVaultState({ activeFilter: val, page: 0 }); 
  const handleSetPage = (val: number) => updateVaultState({ page: val });
  const handleSetViewMode = (val: 'list' | 'gallery') => updateVaultState({ viewMode: val });
  const handleSetSortBy = (val: string) => updateVaultState({ sortBy: val, page: 0 });
  
  const [hasMore, setHasMore] = useState(true);
  const [isPagingDB, setIsPagingDB] = useState(false);
  const PAGE_SIZE = 24;
  const [isInitialMount, setIsInitialMount] = useState(true);

  const [companionModalSeed, setCompanionModalSeed] = useState<InventorySeed | null>(null);
  const [companionInStockOnly, setCompanionInStockOnly] = useState(false);
  const [companionMatches, setCompanionMatches] = useState<InventorySeed[]>([]);
  const [isLoadingCompanions, setIsLoadingCompanions] = useState(false);

  const applySort = (query: any, sortOption: string) => {
    switch (sortOption) {
      case 'variety_name_asc':
        return query.order('variety_name', { ascending: true });
      case 'variety_name_desc':
        return query.order('variety_name', { ascending: false });
      case 'id_asc':
        return query.order('id', { ascending: true });
      case 'id_desc':
        return query.order('id', { ascending: false });
      case 'vendor_asc':
        // Primary sort by vendor, secondary sort by variety name
        return query.order('vendor', { ascending: true, nullsFirst: false }).order('variety_name', { ascending: true });
      case 'created_at_asc':
        return query.order('created_at', { ascending: true });
      case 'created_at_desc':
      default:
        return query.order('created_at', { ascending: false });
    }
  };

  useEffect(() => {
    if (isInitialMount) {
        const restoreVaultData = async () => {
            setIsPagingDB(true);
            let query = supabase.from('seed_inventory').select('id, category, variety_name, vendor, days_to_maturity, species, plant_spacing, out_of_stock, thumbnail, companion_plants, scoville_rating, tomato_type', { count: 'exact' });

            if (activeFilter !== "All") query = query.eq('category', activeFilter);
            if (searchQuery.trim() !== "") query = query.or(`variety_name.ilike.%${searchQuery}%,category.ilike.%${searchQuery}%,id.ilike.%${searchQuery}%`);

            query = applySort(query, sortBy);

            const to = ((page + 1) * PAGE_SIZE) - 1;
            const { data, count, error } = await query.range(0, to);

            if (!error && data) {
                setSeeds(data.map(s => ({ ...s, companion_plants: s.companion_plants || [] })) as InventorySeed[]);
                setHasMore(count !== null && data.length < count);
                setTimeout(() => { window.scrollTo({ top: vaultState.scrollY || 0, behavior: 'instant' }); }, 50);
            }
            setIsPagingDB(false);
            setIsInitialMount(false);
        };
        restoreVaultData();
    }
  }, [isInitialMount]);

  useEffect(() => {
    if (isInitialMount) return;
    const timeoutId = setTimeout(() => { handleSetPage(0); fetchSeeds(0, true); }, 300); 
    return () => clearTimeout(timeoutId);
  }, [searchQuery, activeFilter, sortBy]);

  const fetchSeeds = async (pageNumber: number, reset: boolean = false) => {
    setIsPagingDB(true);
    let query = supabase.from('seed_inventory').select('id, category, variety_name, vendor, days_to_maturity, species, plant_spacing, out_of_stock, thumbnail, companion_plants, scoville_rating, tomato_type', { count: 'exact' });

    if (activeFilter !== "All") query = query.eq('category', activeFilter);
    if (searchQuery.trim() !== "") query = query.or(`variety_name.ilike.%${searchQuery}%,category.ilike.%${searchQuery}%,id.ilike.%${searchQuery}%`);

    query = applySort(query, sortBy);

    const from = pageNumber * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    
    const { data, error, count } = await query.range(from, to);

    if (error) {
      alert("Failed to load inventory: " + error.message);
    } else if (data) {
      const sanitizedData = data.map(s => ({ ...s, companion_plants: s.companion_plants || [] })) as InventorySeed[];
      if (reset) setSeeds(sanitizedData);
      else setSeeds(prev => [...prev, ...sanitizedData]);
      setHasMore(count !== null && from + data.length < count);
    }
    setIsPagingDB(false);
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    handleSetPage(nextPage);
    fetchSeeds(nextPage);
  };

  const handleSeedClick = (seed: InventorySeed) => {
    updateVaultState({ scrollY: window.scrollY });
    navigateTo('seed_detail', seed);
  };

  const toggleOutOfStock = async (seed: InventorySeed, e: React.MouseEvent) => {
    e.stopPropagation(); 
    const newStatus = !seed.out_of_stock;
    setSeeds(seeds.map((s: InventorySeed) => s.id === seed.id ? { ...s, out_of_stock: newStatus } : s));
    const { error } = await supabase.from('seed_inventory').update({ out_of_stock: newStatus }).eq('id', seed.id);
    if (error) {
      alert("Failed to update stock status: " + error.message);
      setSeeds(seeds.map((s: InventorySeed) => s.id === seed.id ? { ...s, out_of_stock: !newStatus } : s));
    }
  };

  const openCompanionModal = async (seed: InventorySeed, e: React.MouseEvent) => {
    e.stopPropagation();
    setCompanionModalSeed(seed);
    setCompanionInStockOnly(false);
    
    if (seed.companion_plants && seed.companion_plants.length > 0) {
      setIsLoadingCompanions(true);
      const orQuery = seed.companion_plants.map((c: string) => `category.ilike.%${c}%,variety_name.ilike.%${c}%`).join(',');
      const { data, error } = await supabase.from('seed_inventory').select('id, variety_name, category, out_of_stock').neq('id', seed.id).or(orQuery);
      if (!error && data) setCompanionMatches(data as InventorySeed[]);
      setIsLoadingCompanions(false);
    } else {
      setCompanionMatches([]);
    }
  };

  const handleManualNew = () => {
    const newSeed: any = {
      id: '', category: '', variety_name: '', vendor: '', days_to_maturity: '',
      species: '', notes: '', images: [], primaryImageIndex: 0, companion_plants: [],
      cold_stratification: false, stratification_days: '', light_required: false,
      germination_days: '', seed_depth: '', plant_spacing: '', row_spacing: '',
      out_of_stock: false, sunlight: '', lifecycle: '', thumbnail: '', scoville_rating: '', tomato_type: ''
    };
    navigateTo('seed_edit', newSeed);
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

      {/* HEADER WITH NEW ADD/SCAN BUTTONS */}
      <header className="bg-emerald-700 text-white p-4 shadow-md sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => handleGoBack('dashboard')} className="p-2 bg-emerald-800 rounded-full hover:bg-emerald-600 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold truncate pr-2">Seed Vault</h1>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => navigateTo('scanner')} className="p-2 bg-emerald-800 rounded-full hover:bg-emerald-600 transition-colors shadow-sm" title="Scan Packet">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </button>
          <button onClick={() => navigateTo('importer')} className="p-2 bg-emerald-800 rounded-full hover:bg-emerald-600 transition-colors shadow-sm" title="Import Link">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
          </button>
          <button onClick={handleManualNew} className="p-2 bg-emerald-800 rounded-full hover:bg-emerald-600 transition-colors shadow-sm" title="Manual Entry">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          </button>
        </div>
      </header>

      <div className="max-w-md mx-auto p-4 space-y-4">
        {/* Search Bar, Sort & View Toggle */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <input 
              type="text" 
              placeholder="Search by name, category, or code..." 
              value={searchQuery} 
              onChange={(e) => handleSetSearchQuery(e.target.value)} 
              className="w-full bg-white border border-stone-200 rounded-xl py-3 pl-10 pr-4 shadow-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all" 
            />
            <svg className="w-5 h-5 text-stone-400 absolute left-3 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          
          <div className="flex gap-2">
            <div className="relative flex-1 sm:flex-none">
              <select
                value={sortBy}
                onChange={(e) => handleSetSortBy(e.target.value)}
                className="w-full h-full appearance-none bg-white border border-stone-200 rounded-xl py-3 pl-3 pr-8 shadow-sm focus:border-emerald-500 outline-none text-sm text-stone-600 cursor-pointer font-medium"
              >
                <option value="created_at_desc">Newest First</option>
                <option value="created_at_asc">Oldest First</option>
                <option value="variety_name_asc">Name (A-Z)</option>
                <option value="variety_name_desc">Name (Z-A)</option>
                <option value="vendor_asc">Vendor</option>
                <option value="id_asc">Shortcode</option>
              </select>
              <svg className="w-4 h-4 text-stone-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>

            <div className="flex bg-white rounded-xl border border-stone-200 p-1 shadow-sm shrink-0">
              <button 
                onClick={() => handleSetViewMode('list')}
                className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-emerald-100 text-emerald-700' : 'text-stone-400 hover:text-stone-600'}`}
                title="List View"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
              </button>
              <button 
                onClick={() => handleSetViewMode('gallery')}
                className={`p-2 rounded-lg transition-all ${viewMode === 'gallery' ? 'bg-emerald-100 text-emerald-700' : 'text-stone-400 hover:text-stone-600'}`}
                title="Gallery View"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Filter Chips */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button onClick={() => handleSetActiveFilter("All")} className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${activeFilter === 'All' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'}`}>All</button>
          {categories.map((cat: SeedCategory) => (
            <button key={cat.name} onClick={() => handleSetActiveFilter(cat.name)} className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${activeFilter === cat.name ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'}`}>{cat.name}</button>
          ))}
        </div>

        {/* Seed List */}
        <div className={viewMode === 'gallery' ? "grid grid-cols-4 gap-3" : "space-y-3"}>
          {isPagingDB && page === 0 ? (
            <div className="flex justify-center items-center py-10 text-emerald-600 col-span-full"><svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>
          ) : seeds.length > 0 ? (
            <>
              {seeds.map((seed: InventorySeed) => {
                const thumb = seed.thumbnail || null;
                const isOutOfStock = seed.out_of_stock;
                
                // Pepper & Scoville Indicator Logic
                const isPepper = seed.category?.toLowerCase().includes('pepper');
                const shu = seed.scoville_rating !== undefined && seed.scoville_rating !== null ? Number(seed.scoville_rating) : null;
                
                let spiceColor = "bg-stone-100 text-stone-500 border-stone-200";
                let spiceLabel = "SHU ?";
                if (shu !== null && !isNaN(shu)) {
                  if (shu === 0) { spiceColor = "bg-stone-100 text-stone-600 border-stone-200"; spiceLabel = "Sweet"; }
                  else if (shu < 2500) { spiceColor = "bg-green-100 text-green-700 border-green-200"; spiceLabel = "Mild"; }
                  else if (shu < 30000) { spiceColor = "bg-amber-100 text-amber-700 border-amber-200"; spiceLabel = "Medium"; }
                  else if (shu < 100000) { spiceColor = "bg-orange-100 text-orange-700 border-orange-200"; spiceLabel = "Hot"; }
                  else if (shu < 300000) { spiceColor = "bg-red-100 text-red-700 border-red-200"; spiceLabel = "X-Hot"; }
                  else { spiceColor = "bg-red-900 text-red-100 border-red-800"; spiceLabel = "Superhot"; }
                }

                // Tomato Indicator Logic
                const isTomato = seed.category?.toLowerCase().includes('tomato');

                if (viewMode === 'gallery') {
                  return (
                    <div key={seed.id} onClick={() => handleSeedClick(seed)} className={`aspect-square rounded-xl border ${isOutOfStock ? 'border-red-100 opacity-75 grayscale' : 'border-stone-200'} shadow-sm hover:border-emerald-400 hover:shadow-md transition-all active:scale-95 cursor-pointer overflow-hidden bg-stone-100 relative`}>
                      {thumb ? (
                        <img src={thumb} alt={seed.variety_name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-stone-300"><svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></div>
                      )}
                    </div>
                  );
                }

                return (
                  <div key={seed.id} onClick={() => handleSeedClick(seed)} className={`bg-white p-3 rounded-xl border ${isOutOfStock ? 'border-red-100 bg-stone-50/50 opacity-75' : 'border-stone-100'} shadow-sm flex flex-col gap-3 hover:border-emerald-400 hover:shadow-md transition-all active:scale-95 cursor-pointer`}>
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
                        <div className="flex justify-between items-center text-[11px] mt-1">
                          <div className="flex flex-wrap gap-1.5">
                            <span className="font-medium text-stone-600 flex items-center gap-1 bg-stone-100 px-1.5 py-0.5 rounded border border-stone-200">
                              <svg className="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                              {seed.plant_spacing || '--'}
                            </span>
                            {isPepper && (
                              <span className={`font-bold flex items-center gap-0.5 px-1.5 py-0.5 rounded border ${spiceColor}`} title={shu !== null && !isNaN(shu) ? `${shu.toLocaleString()} SHU` : 'Unknown Scoville'}>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" /></svg>
                                {spiceLabel}
                              </span>
                            )}
                            {isTomato && seed.tomato_type && (
                              <span className="font-bold flex items-center gap-0.5 px-1.5 py-0.5 rounded border bg-rose-50 text-rose-700 border-rose-200" title="Tomato Type">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 21a7 7 0 100-14 7 7 0 000 14z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 7v3m-2-2.5a2.5 2.5 0 014 0" /></svg>
                                {seed.tomato_type}
                              </span>
                            )}
                          </div>
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
                <div className="col-span-full">
                  <button 
                    onClick={handleLoadMore} 
                    disabled={isPagingDB}
                    className="w-full py-4 mt-2 bg-white text-emerald-600 font-bold rounded-xl border border-stone-200 hover:border-emerald-300 hover:bg-emerald-50 transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isPagingDB ? (
                       <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    ) : "Load More"}
                  </button>
                </div>
              )}
            </>
          ) : !isPagingDB ? (
            <div className="text-center py-10 text-stone-500 bg-white rounded-xl border border-stone-100 shadow-sm col-span-full">
              <svg className="w-12 h-12 mx-auto text-stone-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p>No seeds found matching your filters.</p>
            </div>
          ) : null}
          
          {isPagingDB && page > 0 && (
             <div className="flex justify-center items-center py-4 text-emerald-600 col-span-full"><svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>
          )}
        </div>
      </div>
    </main>
  );
}