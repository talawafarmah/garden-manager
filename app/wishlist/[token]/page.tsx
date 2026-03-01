"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { InventorySeed, WishlistSession } from '../../../types';

// --- SUB-COMPONENT: Seed Card with Image Carousel & SHU Indicator ---
const SeedCard = ({ 
  seed, 
  isSelected, 
  onToggle 
}: { 
  seed: InventorySeed; 
  isSelected: boolean; 
  onToggle: (id: string) => void;
}) => {
  const [currentImageIdx, setCurrentImageIdx] = useState(0);
  
  const images = seed.images || [];
  const showCarousel = images.length > 1;
  const displayImage = images.length > 0 ? images[currentImageIdx] : seed.thumbnail;
  const isOutOfStock = seed.out_of_stock;

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation(); 
    setCurrentImageIdx((prev) => (prev + 1) % images.length);
  };

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation(); 
    setCurrentImageIdx((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <div 
      onClick={() => onToggle(seed.id)}
      className={`group relative bg-white rounded-3xl overflow-hidden shadow-sm transition-all duration-300 cursor-pointer flex flex-col h-full border-2 
        ${isSelected ? 'border-emerald-500 shadow-emerald-500/20 shadow-xl scale-[1.02]' : 'border-transparent hover:border-emerald-200 hover:shadow-md'}`
      }
    >
      {/* Selection Checkmark */}
      <div className={`absolute top-4 right-4 z-20 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 shadow-md ${isSelected ? 'bg-emerald-500 text-white scale-100' : 'bg-white/80 text-stone-300 scale-90 opacity-0 group-hover:opacity-100'}`}>
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
      </div>

      {/* Image Container */}
      <div className="aspect-[4/3] w-full bg-stone-200 relative overflow-hidden border-b border-stone-100 group/img">
        {displayImage ? (
          <img 
            src={displayImage} 
            alt={seed.variety_name} 
            className={`w-full h-full object-cover transition-transform duration-700 ${!showCarousel ? 'group-hover:scale-105' : ''} ${isOutOfStock ? 'grayscale opacity-70' : ''}`} 
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-400">
            <svg className="w-12 h-12 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </div>
        )}

        {/* Carousel Controls */}
        {showCarousel && (
          <>
            <button 
              onClick={prevImage} 
              className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/40 text-white rounded-full opacity-100 lg:opacity-0 group-hover/img:opacity-100 hover:bg-black/60 transition-all backdrop-blur-sm z-10"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button 
              onClick={nextImage} 
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/40 text-white rounded-full opacity-100 lg:opacity-0 group-hover/img:opacity-100 hover:bg-black/60 transition-all backdrop-blur-sm z-10"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
            </button>
            
            {/* Dot Indicators */}
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-10">
              {images.map((_, i) => (
                <div 
                  key={i} 
                  className={`w-1.5 h-1.5 rounded-full shadow-sm transition-all duration-300 ${i === currentImageIdx ? 'bg-white scale-125' : 'bg-white/50'}`} 
                />
              ))}
            </div>
          </>
        )}

        {isOutOfStock && (
           <div className="absolute inset-x-0 bottom-0 bg-stone-900/80 text-stone-200 text-[10px] font-black uppercase tracking-widest text-center py-1.5 backdrop-blur-sm z-20">
             Currently Out of Stock - Will try to source
           </div>
        )}
      </div>

      {/* Card Info */}
      <div className="p-5 flex flex-col flex-1">
        <div className="flex justify-between items-start mb-2 gap-2">
          <p className="text-emerald-600 text-[10px] font-black uppercase tracking-widest mt-1">{seed.category}</p>
          
          <div className="flex flex-wrap justify-end gap-1.5">
            {/* NEW: SHU Indicator */}
            {seed.scoville_rating != null && (
              <span className="text-[10px] font-black text-red-600 bg-red-50 px-2 py-0.5 rounded-md border border-red-100 flex items-center gap-1 whitespace-nowrap">
                <svg className="w-3 h-3 text-red-500" fill="currentColor" viewBox="0 0 24 24"><path d="M17.66 11.2C17.43 10.9 17.15 10.64 16.89 10.38C16.22 9.78 15.46 9.35 14.82 8.72C13.33 7.26 13 4.85 13.95 3C13 3.23 12.17 3.75 11.46 4.32C8.87 6.4 7.85 10.07 9.07 13.22C9.11 13.32 9.15 13.42 9.15 13.55C9.15 13.77 9 13.97 8.8 14.05C8.57 14.15 8.33 14.09 8.14 13.93C8.08 13.88 8.04 13.83 8 13.76C6.87 12.33 6.69 10.28 7.45 8.64C5.78 10 4.87 12.3 5 14.47C5.06 15.44 5.34 16.36 5.88 17.16C6.53 18.11 7.4 18.85 8.44 19.33C9.76 19.93 11.27 20 12.61 19.54C14.28 18.96 15.65 17.61 16.23 15.92C16.63 14.77 16.62 13.53 16.23 12.41C16.2 12.32 16.24 12.22 16.32 12.16C16.39 12.09 16.5 12.08 16.59 12.12C16.96 12.32 17.3 12.57 17.6 12.87C17.7 12.97 17.86 12.98 17.97 12.89C18.06 12.8 18.05 12.64 17.96 12.55C17.86 12.43 17.76 12.31 17.66 11.2Z"/></svg>
                {seed.scoville_rating.toLocaleString()} SHU
              </span>
            )}
            
            {seed.days_to_maturity && (
              <span className="text-[10px] font-black text-stone-500 bg-stone-100 px-2 py-0.5 rounded-md border border-stone-200 whitespace-nowrap">
                {seed.days_to_maturity} Days
              </span>
            )}
          </div>
        </div>
        
        <h3 className="font-black text-lg text-stone-800 leading-tight mb-1">{seed.variety_name}</h3>
        <p className="text-stone-400 text-xs italic mb-4">{seed.species}</p>
        
        <div className="mt-auto">
          {seed.notes ? (
             <p className="text-sm text-stone-600 line-clamp-3 leading-relaxed border-t border-stone-100 pt-3">{seed.notes}</p>
          ) : (
             <p className="text-sm text-stone-400 italic border-t border-stone-100 pt-3">A fantastic {seed.category.toLowerCase()} variety.</p>
          )}
        </div>
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
  
  // Selection State
  const [selectedSeedIds, setSelectedSeedIds] = useState<string[]>([]);
  const [customRequest, setCustomRequest] = useState("");
  
  // Filter & Sort State
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [sortBy, setSortBy] = useState("name_asc");

  // Loading State
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

    if (activeCategory !== 'All') {
      result = result.filter(s => s.category === activeCategory);
    }

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
      
      if (sortBy === 'dtm_asc') {
        const dtmA = a.days_to_maturity ?? 9999;
        const dtmB = b.days_to_maturity ?? 9999;
        return dtmA - dtmB;
      }
      if (sortBy === 'dtm_desc') {
        const dtmA = a.days_to_maturity ?? -1;
        const dtmB = b.days_to_maturity ?? -1;
        return dtmB - dtmA;
      }
      return 0;
    });

    return result;
  }, [seeds, searchQuery, activeCategory, sortBy]);

  const toggleSeedSelection = (seedId: string) => {
    setSelectedSeedIds(prev => 
      prev.includes(seedId) ? prev.filter(id => id !== seedId) : [...prev, seedId]
    );
  };

  const handleSubmit = async () => {
    if (!session) return;
    setIsSubmitting(true);

    try {
      const inserts = selectedSeedIds.map(seedId => ({
        session_id: session.id,
        seed_id: seedId,
      }));

      if (customRequest.trim() !== "") {
        inserts.push({
          session_id: session.id,
          seed_id: undefined as any, 
          custom_request: customRequest.trim()
        } as any); 
      }

      if (inserts.length === 0) {
        setIsSuccess(true);
        return;
      }

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
          <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
             <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <h1 className="text-xl font-black text-stone-800 mb-2">Link Unavailable</h1>
          <p className="text-stone-500 text-sm leading-relaxed">{error}</p>
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
          <p className="text-stone-500 text-sm leading-relaxed mb-6">
            Thank you, {session.list_name}! Your garden requests for {seasonName} have been locked in. We will review your list and start planning the nursery trays.
          </p>
          <div className="bg-stone-50 p-4 rounded-xl border border-stone-100 text-xs font-bold text-stone-400 uppercase tracking-widest">
            You selected {selectedSeedIds.length} items
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-stone-100 text-stone-900 pb-32 font-sans selection:bg-emerald-200">
      
      <header className="bg-emerald-800 text-white pt-12 pb-24 px-6 rounded-b-[3rem] shadow-xl relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-emerald-100 via-transparent to-transparent"></div>
        <div className="max-w-3xl mx-auto relative z-10 text-center">
          <span className="inline-block py-1 px-3 rounded-full bg-emerald-900/50 border border-emerald-700/50 text-emerald-200 text-[10px] font-black uppercase tracking-[0.2em] mb-4 shadow-sm backdrop-blur-sm">
            {seasonName} Catalog
          </span>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-tight mb-4">
            Welcome, {session.list_name}!
          </h1>
          <p className="text-emerald-100 text-sm md:text-base max-w-xl mx-auto leading-relaxed">
            Browse the seed vault and select the varieties you'd like us to grow for you this season. 
          </p>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 -mt-16 relative z-20 space-y-6">
        
        <div className="bg-white/90 backdrop-blur-md p-4 rounded-3xl shadow-lg border border-stone-200 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <input 
                type="text" 
                placeholder="Search varieties, notes, or species..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-2xl py-3 pl-10 pr-4 text-sm shadow-inner focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all" 
              />
              <svg className="w-5 h-5 text-stone-400 absolute left-3 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <div className="relative sm:w-48">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-2xl py-3 pl-4 pr-10 text-sm font-bold shadow-inner focus:border-emerald-500 outline-none appearance-none cursor-pointer text-stone-700"
              >
                <option value="name_asc">Name (A-Z)</option>
                <option value="name_desc">Name (Z-A)</option>
                <option value="category">Category</option>
                <option value="dtm_asc">Fastest Growing</option>
                <option value="dtm_desc">Longest Growing</option>
              </select>
              <svg className="w-4 h-4 text-stone-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2 pt-1 pb-1">
            {availableCategories.map(cat => (
              <button 
                key={cat} 
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all shadow-sm ${activeCategory === cat ? 'bg-emerald-600 text-white' : 'bg-stone-100 text-stone-600 border border-stone-200 hover:bg-stone-200'}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="text-right px-2">
          <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">
            Showing {filteredAndSortedSeeds.length} varieties
          </p>
        </div>

        {filteredAndSortedSeeds.length === 0 ? (
          <div className="bg-white p-10 rounded-3xl text-center border border-stone-200 shadow-sm">
             <svg className="w-16 h-16 mx-auto text-stone-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
             <h3 className="text-lg font-black text-stone-800">No seeds found</h3>
             <p className="text-stone-500 text-sm mt-1">Try adjusting your search or category filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredAndSortedSeeds.map((seed) => (
              <SeedCard 
                key={seed.id} 
                seed={seed} 
                isSelected={selectedSeedIds.includes(seed.id)} 
                onToggle={toggleSeedSelection} 
              />
            ))}
          </div>
        )}

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-stone-200 mt-8">
          <h3 className="font-black text-stone-800 mb-2 flex items-center gap-2">
            <span className="text-emerald-500">✨</span> Custom Requests
          </h3>
          <p className="text-sm text-stone-500 mb-4">Don't see what you're looking for? Leave a note and we'll see if we can source it for you.</p>
          <textarea 
            value={customRequest}
            onChange={(e) => setCustomRequest(e.target.value)}
            placeholder="e.g., I'd love a really hot yellow pepper, or maybe some marigolds!"
            rows={4}
            className="w-full bg-stone-50 border border-stone-200 rounded-xl p-4 text-sm outline-none focus:border-emerald-500 transition-colors resize-none shadow-inner"
          />
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-stone-200 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Your List</span>
            <span className="font-black text-emerald-700">{selectedSeedIds.length} Items Selected</span>
          </div>
          <button 
            onClick={handleSubmit}
            disabled={isSubmitting || (selectedSeedIds.length === 0 && customRequest.trim() === "")}
            className="px-8 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-emerald-900/20 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
          >
            {isSubmitting ? 'Sending...' : 'Submit Wishlist'}
          </button>
        </div>
      </div>

    </main>
  );
}