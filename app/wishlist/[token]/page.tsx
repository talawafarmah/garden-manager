"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { InventorySeed, WishlistSession } from '../../../types';

// Helper to convert SHU to a categorized profile
const getHeatProfile = (shu: number) => {
  if (shu === 0) return { label: 'Sweet', color: 'bg-green-500 text-white' };
  if (shu <= 2500) return { label: 'Mild', color: 'bg-yellow-400 text-yellow-900' };
  if (shu <= 30000) return { label: 'Medium', color: 'bg-orange-500 text-white' };
  if (shu <= 100000) return { label: 'Hot', color: 'bg-red-500 text-white' };
  if (shu <= 300000) return { label: 'Super Hot', color: 'bg-rose-700 text-white' };
  return { label: 'Extreme', color: 'bg-purple-900 text-white' };
};

// --- SUB-COMPONENT: Quick View Modal ---
const SeedModal = ({ 
  seed, 
  isSelected, 
  onClose, 
  onToggle 
}: { 
  seed: InventorySeed; 
  isSelected: boolean; 
  onClose: () => void;
  onToggle: (id: string) => void;
}) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  
  // Consolidate images for the carousel
  const images = useMemo(() => {
    const imgs = seed.images && seed.images.length > 0 ? [...seed.images] : [];
    if (seed.thumbnail && !imgs.includes(seed.thumbnail)) imgs.unshift(seed.thumbnail);
    return imgs;
  }, [seed]);

  const showCarousel = images.length > 1;
  const displayImage = images.length > 0 ? images[currentIdx] : null;
  const heatProfile = seed.scoville_rating != null ? getHeatProfile(seed.scoville_rating) : null;

  // Lock body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm transition-opacity"></div>
      
      {/* Modal Content */}
      <div 
        className="relative bg-white rounded-3xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()} // Prevent clicks inside from closing modal
      >
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-50 w-8 h-8 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center backdrop-blur-md transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        {/* Carousel Area */}
        <div className="aspect-[4/3] sm:aspect-[16/10] w-full bg-stone-100 relative shrink-0 group">
          {displayImage ? (
            <img src={displayImage} alt={seed.variety_name} className={`w-full h-full object-cover ${seed.out_of_stock ? 'grayscale opacity-70' : ''}`} />
          ) : (
             <div className="w-full h-full flex items-center justify-center text-stone-300">
                <svg className="w-16 h-16 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
             </div>
          )}

          {showCarousel && (
            <>
              <button 
                onClick={() => setCurrentIdx((prev) => (prev - 1 + images.length) % images.length)} 
                className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-black/40 hover:bg-black/60 text-white rounded-full transition-all backdrop-blur-sm z-10"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <button 
                onClick={() => setCurrentIdx((prev) => (prev + 1) % images.length)} 
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-black/40 hover:bg-black/60 text-white rounded-full transition-all backdrop-blur-sm z-10"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
              </button>
              <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-10">
                {images.map((_, i) => (
                  <div key={i} className={`w-2 h-2 rounded-full transition-all duration-300 shadow-sm ${i === currentIdx ? 'bg-white scale-110' : 'bg-white/50'}`} />
                ))}
              </div>
            </>
          )}
          {seed.out_of_stock && (
             <div className="absolute inset-x-0 bottom-0 bg-stone-900/80 text-stone-200 text-xs font-black uppercase tracking-widest text-center py-2 backdrop-blur-sm z-20">
               Currently Out of Stock
             </div>
          )}
        </div>

        {/* Scrollable Details */}
        <div className="p-6 overflow-y-auto flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase px-2 py-1 rounded-lg border border-emerald-200">
              {seed.category}
            </span>
            {seed.days_to_maturity && (
              <span className="bg-stone-100 text-stone-600 text-[10px] font-black uppercase px-2 py-1 rounded-lg border border-stone-200">
                {seed.days_to_maturity} Days
              </span>
            )}
            {heatProfile && (
              <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg border flex items-center gap-1 ${heatProfile.color.replace('text-white', 'border-transparent').replace('text-yellow-900', 'border-yellow-300')}`}>
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M17.66 11.2C17.43 10.9 17.15 10.64 16.89 10.38C16.22 9.78 15.46 9.35 14.82 8.72C13.33 7.26 13 4.85 13.95 3C13 3.23 12.17 3.75 11.46 4.32C8.87 6.4 7.85 10.07 9.07 13.22C9.11 13.32 9.15 13.42 9.15 13.55C9.15 13.77 9 13.97 8.8 14.05C8.57 14.15 8.33 14.09 8.14 13.93C8.08 13.88 8.04 13.83 8 13.76C6.87 12.33 6.69 10.28 7.45 8.64C5.78 10 4.87 12.3 5 14.47C5.06 15.44 5.34 16.36 5.88 17.16C6.53 18.11 7.4 18.85 8.44 19.33C9.76 19.93 11.27 20 12.61 19.54C14.28 18.96 15.65 17.61 16.23 15.92C16.63 14.77 16.62 13.53 16.23 12.41C16.2 12.32 16.24 12.22 16.32 12.16C16.39 12.09 16.5 12.08 16.59 12.12C16.96 12.32 17.3 12.57 17.6 12.87C17.7 12.97 17.86 12.98 17.97 12.89C18.06 12.8 18.05 12.64 17.96 12.55C17.86 12.43 17.76 12.31 17.66 11.2Z"/></svg>
                {heatProfile.label}
              </span>
            )}
          </div>

          <h2 className="text-2xl font-black text-stone-900 leading-tight mb-1">{seed.variety_name}</h2>
          <p className="text-sm font-medium text-stone-500 italic mb-6">{seed.species}</p>

          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-stone-400 mb-2">Notes</h3>
            {seed.notes ? (
              <p className="text-sm text-stone-700 leading-relaxed bg-stone-50 p-4 rounded-2xl border border-stone-100">
                {seed.notes}
              </p>
            ) : (
              <p className="text-sm text-stone-400 italic">No additional notes available for this variety.</p>
            )}
          </div>
        </div>

        {/* Modal Footer (Action) */}
        <div className="p-4 border-t border-stone-100 bg-stone-50 shrink-0">
          <button
            onClick={() => onToggle(seed.id)}
            className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 
              ${isSelected ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100' : 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20 hover:bg-emerald-500'}`}
          >
            {isSelected ? (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                Remove from List
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                Add to Wishlist
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};


// --- SUB-COMPONENT: Ultra-Density Seed Card (Grid Item) ---
const SeedCard = ({ 
  seed, 
  isSelected, 
  onToggle,
  onView
}: { 
  seed: InventorySeed; 
  isSelected: boolean; 
  onToggle: (id: string) => void;
  onView: (seed: InventorySeed) => void;
}) => {
  const displayImage = seed.thumbnail || (seed.images && seed.images.length > 0 ? seed.images[0] : null);
  const isOutOfStock = seed.out_of_stock;
  const heatProfile = seed.scoville_rating != null ? getHeatProfile(seed.scoville_rating) : null;

  return (
    <div 
      onClick={() => onView(seed)}
      className={`group relative bg-white rounded-xl sm:rounded-2xl overflow-hidden shadow-sm transition-all duration-200 cursor-pointer flex flex-col h-full border-2 
        ${isSelected ? 'border-emerald-500 shadow-emerald-500/20 shadow-md z-10' : 'border-transparent hover:border-emerald-200 hover:shadow-md'}`
      }
    >
      {/* EXPLICIT SELECTION BUTTON */}
      <button 
        onClick={(e) => { e.stopPropagation(); onToggle(seed.id); }}
        className={`absolute top-1.5 right-1.5 sm:top-2 sm:right-2 z-30 w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all duration-200 shadow-sm border-2
          ${isSelected 
            ? 'bg-emerald-500 border-emerald-500 text-white scale-100' 
            : 'bg-white/90 backdrop-blur-sm border-stone-200 text-stone-400 hover:border-emerald-400 hover:text-emerald-500 scale-95 hover:scale-105'
          }`}
        aria-label="Select Seed"
      >
        {isSelected ? (
           <svg className="w-3.5 h-3.5 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>
        ) : (
           <svg className="w-3.5 h-3.5 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
        )}
      </button>

      {isOutOfStock && (
        <div className="absolute top-1.5 left-1.5 bg-stone-900/90 text-stone-200 text-[6px] sm:text-[9px] font-black uppercase tracking-widest px-1 sm:px-2 py-0.5 sm:py-1 rounded shadow-sm z-20 pointer-events-none">
          Out of Stock
        </div>
      )}

      {/* Image Container with Data Overlay */}
      <div className="aspect-[4/3] w-full bg-stone-200 relative overflow-hidden border-b border-stone-100">
        {displayImage ? (
          <img src={displayImage} alt={seed.variety_name} loading="lazy" className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 ${isOutOfStock ? 'grayscale opacity-70' : ''}`} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-400">
            <svg className="w-6 h-6 sm:w-12 sm:h-12 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-stone-900/90 via-stone-900/10 to-transparent opacity-80 z-0 pointer-events-none" />

        <div className="absolute bottom-1.5 left-1.5 flex flex-wrap gap-1 z-10 pr-1 pointer-events-none">
          <span className="bg-emerald-600 text-white text-[6px] sm:text-[9px] font-black uppercase px-1 sm:px-1.5 py-0.5 rounded-sm shadow-sm leading-none flex items-center">
            {seed.category}
          </span>
          {seed.days_to_maturity && (
            <span className="bg-stone-800/90 backdrop-blur-sm text-stone-100 text-[6px] sm:text-[9px] font-black uppercase px-1 sm:px-1.5 py-0.5 rounded-sm shadow-sm leading-none flex items-center">
              {seed.days_to_maturity}d
            </span>
          )}
          {heatProfile && (
            <span className={`text-[6px] sm:text-[9px] font-black uppercase px-1 sm:px-1.5 py-0.5 rounded-sm shadow-sm flex items-center gap-0.5 leading-none ${heatProfile.color}`}>
              <svg className="w-2 h-2 sm:w-2.5 sm:h-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.66 11.2C17.43 10.9 17.15 10.64 16.89 10.38C16.22 9.78 15.46 9.35 14.82 8.72C13.33 7.26 13 4.85 13.95 3C13 3.23 12.17 3.75 11.46 4.32C8.87 6.4 7.85 10.07 9.07 13.22C9.11 13.32 9.15 13.42 9.15 13.55C9.15 13.77 9 13.97 8.8 14.05C8.57 14.15 8.33 14.09 8.14 13.93C8.08 13.88 8.04 13.83 8 13.76C6.87 12.33 6.69 10.28 7.45 8.64C5.78 10 4.87 12.3 5 14.47C5.06 15.44 5.34 16.36 5.88 17.16C6.53 18.11 7.4 18.85 8.44 19.33C9.76 19.93 11.27 20 12.61 19.54C14.28 18.96 15.65 17.61 16.23 15.92C16.63 14.77 16.62 13.53 16.23 12.41C16.2 12.32 16.24 12.22 16.32 12.16C16.39 12.09 16.5 12.08 16.59 12.12C16.96 12.32 17.3 12.57 17.6 12.87C17.7 12.97 17.86 12.98 17.97 12.89C18.06 12.8 18.05 12.64 17.96 12.55C17.86 12.43 17.76 12.31 17.66 11.2Z"/></svg>
              {heatProfile.label}
            </span>
          )}
        </div>
      </div>

      <div className="p-1.5 sm:p-3 flex flex-col flex-1 pointer-events-none">
        <h3 className="font-black text-[11px] sm:text-base text-stone-800 leading-tight sm:mb-0.5 line-clamp-2 sm:line-clamp-1">{seed.variety_name}</h3>
        {seed.species && <p className="text-stone-400 text-[8px] sm:text-[10px] italic mb-1 sm:mb-1.5 truncate">{seed.species}</p>}
      </div>
    </div>
  );
};
// --------------------------------------------------------

export default function WishlistCatalog() {
  const params = useParams();
  const token = params.token as string;

  const [session, setSession] = useState<WishlistSession | null>(null);
  const [seasonName, setSeasonName] = useState("");
  const [seeds, setSeeds] = useState<InventorySeed[]>([]);
  
  // Selection & Modal State
  const [selectedSeedIds, setSelectedSeedIds] = useState<string[]>([]);
  const [viewedSeed, setViewedSeed] = useState<InventorySeed | null>(null); // NEW: Controls the Modal
  const [customRequest, setCustomRequest] = useState("");
  
  // Filter & Sort State
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [sortBy, setSortBy] = useState("name_asc");
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCatalogData = async () => {
      if (!token) return;
      setIsLoading(true);

      try {
        const { data: sessionData, error: sessionError } = await supabase
          .from('wishlist_sessions')
          .select('*, seasons(name, status)')
          .eq('id', token)
          .single();

        if (sessionError || !sessionData) throw new Error("Invalid or expired link.");
        
        if (sessionData.expires_at && new Date(sessionData.expires_at) < new Date()) {
          throw new Error("This wishlist link has expired.");
        }

        setSession(sessionData);
        setSeasonName(sessionData.seasons?.name || "the upcoming season");

        const { data: seedData, error: seedError } = await supabase
          .from('seed_inventory')
          .select('*');

        if (seedError) throw seedError;
        setSeeds(seedData as InventorySeed[]);

      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCatalogData();
  }, [token]);

  const availableCategories = useMemo(() => {
    const cats = new Set(seeds.map(s => s.category));
    return ['All', ...Array.from(cats)].sort();
  }, [seeds]);

  const filteredAndSortedSeeds = useMemo(() => {
    let result = [...seeds];

    if (showSelectedOnly) result = result.filter(s => selectedSeedIds.includes(s.id));
    if (activeCategory !== 'All') result = result.filter(s => s.category === activeCategory);
    
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      result = result.filter(s => 
        s.variety_name.toLowerCase().includes(q) || 
        (s.species && s.species.toLowerCase().includes(q)) ||
        (s.notes && s.notes.toLowerCase().includes(q))
      );
    }

    result.sort((a, b) => {
      if (sortBy === 'name_asc') return a.variety_name.localeCompare(b.variety_name);
      if (sortBy === 'name_desc') return b.variety_name.localeCompare(a.variety_name);
      if (sortBy === 'category') return a.category.localeCompare(b.category) || a.variety_name.localeCompare(b.variety_name);
      
      if (sortBy === 'dtm_asc') return (a.days_to_maturity ?? 9999) - (b.days_to_maturity ?? 9999);
      if (sortBy === 'dtm_desc') return (b.days_to_maturity ?? -1) - (a.days_to_maturity ?? -1);
      return 0;
    });

    return result;
  }, [seeds, searchQuery, activeCategory, sortBy, showSelectedOnly, selectedSeedIds]);

  const toggleSeedSelection = (seedId: string) => {
    setSelectedSeedIds(prev => prev.includes(seedId) ? prev.filter(id => id !== seedId) : [...prev, seedId]);
  };

  const handleSubmit = async () => {
    if (!session) return;
    setIsSubmitting(true);

    try {
      const inserts = selectedSeedIds.map(seedId => ({ session_id: session.id, seed_id: seedId }));
      if (customRequest.trim() !== "") {
        inserts.push({ session_id: session.id, seed_id: undefined as any, custom_request: customRequest.trim() } as any); 
      }

      if (inserts.length === 0) { setIsSuccess(true); return; }

      const finalInserts = inserts.map(item => {
         const row: any = { session_id: item.session_id };
         if (item.seed_id) row.seed_id = item.seed_id;
         if ((item as any).custom_request) row.custom_request = (item as any).custom_request;
         return row;
      });

      const { error } = await supabase.from('wishlist_selections').insert(finalInserts);
      if (error) throw error;
      setIsSuccess(true);
    } catch (err: any) {
      alert("Failed to save wishlist: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-emerald-600">
           <svg className="w-10 h-10 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
           <span className="font-bold tracking-widest uppercase text-xs">Loading Catalog...</span>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4 text-center">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full border border-stone-200">
          <h1 className="text-xl font-black text-stone-800 mb-2">Link Unavailable</h1>
          <p className="text-stone-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4 text-center">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full border border-stone-200 animate-in zoom-in-95 duration-500">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
             <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
          </div>
          <h1 className="text-2xl font-black text-stone-800 mb-3">Wishlist Sent!</h1>
          <p className="text-stone-500 text-sm mb-6">Thank you, {session.list_name}! Your garden requests for {seasonName} have been locked in.</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-stone-100 text-stone-900 pb-32 font-sans selection:bg-emerald-200">
      
      {/* View Modal overlay */}
      {viewedSeed && (
        <SeedModal 
          seed={viewedSeed} 
          isSelected={selectedSeedIds.includes(viewedSeed.id)} 
          onClose={() => setViewedSeed(null)} 
          onToggle={toggleSeedSelection} 
        />
      )}

      <header className="bg-emerald-800 text-white pt-10 pb-20 px-4 sm:px-6 rounded-b-[2rem] sm:rounded-b-[3rem] shadow-xl relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-emerald-100 via-transparent to-transparent"></div>
        <div className="max-w-4xl mx-auto relative z-10 text-center">
          <span className="inline-block py-1 px-3 rounded-full bg-emerald-900/50 border border-emerald-700/50 text-emerald-200 text-[10px] font-black uppercase tracking-[0.2em] mb-3 shadow-sm backdrop-blur-sm">
            {seasonName} Catalog
          </span>
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight mb-3">
            Welcome, {session.list_name}!
          </h1>
          <p className="text-emerald-100 text-xs sm:text-sm md:text-base max-w-xl mx-auto leading-relaxed px-2">
            Browse the seed vault. Tap any card for photos and details, or tap the (+) to quickly add it to your list. 
          </p>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-2 sm:px-6 -mt-12 sm:-mt-16 relative z-20 space-y-6">
        
        <div className="bg-white/90 backdrop-blur-md p-3 sm:p-4 rounded-2xl sm:rounded-3xl shadow-lg border border-stone-200 flex flex-col sm:flex-row gap-2 sm:gap-4 items-center">
          <div className="relative w-full sm:flex-1">
            <input 
              type="text" 
              placeholder="Search varieties, notes..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl sm:rounded-2xl py-2.5 sm:py-3 pl-9 sm:pl-10 pr-4 text-xs sm:text-sm shadow-inner focus:border-emerald-500 outline-none" 
            />
            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-stone-400 absolute left-3 top-3 sm:top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>

          <div className="flex w-full sm:w-auto gap-2">
            <div className="relative flex-1 sm:w-40">
              <select
                value={activeCategory}
                onChange={(e) => setActiveCategory(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl sm:rounded-2xl py-2.5 sm:py-3 pl-3 sm:pl-4 pr-7 sm:pr-8 text-xs sm:text-sm font-bold shadow-inner focus:border-emerald-500 outline-none appearance-none"
              >
                {availableCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <svg className="w-4 h-4 text-stone-400 absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>

            <div className="relative flex-1 sm:w-40">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl sm:rounded-2xl py-2.5 sm:py-3 pl-3 sm:pl-4 pr-7 sm:pr-8 text-xs sm:text-sm font-bold shadow-inner focus:border-emerald-500 outline-none appearance-none"
              >
                <option value="name_asc">Name (A-Z)</option>
                <option value="name_desc">Name (Z-A)</option>
                <option value="category">Category</option>
                <option value="dtm_asc">Fastest</option>
                <option value="dtm_desc">Longest</option>
              </select>
              <svg className="w-4 h-4 text-stone-400 absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center px-2">
          <button 
            onClick={() => setShowSelectedOnly(!showSelectedOnly)}
            className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold whitespace-nowrap transition-all shadow-sm flex items-center gap-1.5 border ${showSelectedOnly ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'}`}
          >
            <span className={`w-2 h-2 rounded-full ${selectedSeedIds.length > 0 ? 'bg-emerald-500' : 'bg-stone-300'}`}></span>
            Show Selected ({selectedSeedIds.length})
          </button>

          <p className="text-[9px] sm:text-[10px] font-black text-stone-400 uppercase tracking-widest">
            {filteredAndSortedSeeds.length} Results
          </p>
        </div>

        {filteredAndSortedSeeds.length === 0 ? (
          <div className="bg-white p-10 rounded-3xl text-center border border-stone-200 shadow-sm">
             <h3 className="text-lg font-black text-stone-800">No seeds found</h3>
          </div>
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-4">
            {filteredAndSortedSeeds.map((seed) => (
              <SeedCard 
                key={seed.id} 
                seed={seed} 
                isSelected={selectedSeedIds.includes(seed.id)} 
                onToggle={toggleSeedSelection} 
                onView={setViewedSeed} // NEW: Trigger Modal
              />
            ))}
          </div>
        )}

        <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-sm border border-stone-200 mt-8">
          <h3 className="font-black text-sm sm:text-base text-stone-800 mb-1 sm:mb-2 flex items-center gap-2">
            <span className="text-emerald-500">✨</span> Custom Requests
          </h3>
          <p className="text-[10px] sm:text-sm text-stone-500 mb-3 sm:mb-4">Don't see what you're looking for? Leave a note.</p>
          <textarea 
            value={customRequest}
            onChange={(e) => setCustomRequest(e.target.value)}
            placeholder="e.g., I'd love a really hot yellow pepper..."
            rows={3}
            className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 sm:p-4 text-xs sm:text-sm outline-none focus:border-emerald-500 resize-none shadow-inner"
          />
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-3 sm:p-4 bg-white/90 backdrop-blur-md border-t border-stone-200 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-40">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 px-2 sm:px-6">
          <div className="flex flex-col">
            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-stone-400">Your List</span>
            <span className="font-black text-sm sm:text-base text-emerald-700">{selectedSeedIds.length} Items Selected</span>
          </div>
          <button 
            onClick={handleSubmit}
            disabled={isSubmitting || (selectedSeedIds.length === 0 && customRequest.trim() === "")}
            className="px-6 py-3 sm:px-8 sm:py-4 bg-emerald-600 text-white rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm uppercase tracking-widest shadow-xl shadow-emerald-900/20 active:scale-95 transition-all disabled:opacity-50"
          >
            {isSubmitting ? 'Sending...' : 'Submit List'}
          </button>
        </div>
      </div>

    </main>
  );
}