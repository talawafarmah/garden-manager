"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { InventorySeed, WishlistSession, SeedCategory } from '../../../types';

const getHeatProfile = (shu: number) => {
  if (shu === 0) return { label: 'Sweet', color: 'bg-green-500 text-white' };
  if (shu <= 2500) return { label: 'Mild', color: 'bg-yellow-400 text-yellow-900' };
  if (shu <= 30000) return { label: 'Medium', color: 'bg-orange-500 text-white' };
  if (shu <= 100000) return { label: 'Hot', color: 'bg-red-500 text-white' };
  if (shu <= 300000) return { label: 'Super Hot', color: 'bg-rose-700 text-white' };
  return { label: 'Extreme', color: 'bg-purple-900 text-white' };
};

const getSeedStatus = (seed: InventorySeed, season: any, categories: SeedCategory[], activeSeedIds: Set<string>) => {
  if (!season?.seedling_target_date) return { canSelect: true, badge: null, modalWarning: null };

  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const targetDate = new Date(season.seedling_target_date + 'T12:00:00');
  const lastPickupDate = season.last_pickup_date ? new Date(season.last_pickup_date + 'T12:00:00') : new Date(targetDate.getTime() + (14 * 24 * 60 * 60 * 1000)); 
  
  const daysToTarget = Math.round((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const daysToLastPickup = Math.round((lastPickupDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  let maxGerm = 7;
  if (seed.germination_days) {
      const nums = seed.germination_days.match(/\d+/g);
      if (nums) maxGerm = Math.max(...nums.map(Number));
  }

  let nurseryWeeks = 4;
  if (seed.custom_nursery_weeks !== null && seed.custom_nursery_weeks !== undefined) {
      nurseryWeeks = seed.custom_nursery_weeks;
  } else {
      const cat = categories.find(c => c.name === seed.category);
      if (cat && cat.default_nursery_weeks) nurseryWeeks = cat.default_nursery_weeks;
  }

  const shippingPenalty = seed.out_of_stock ? 14 : 0;
  const totalNurseryDays = nurseryWeeks * 7;
  const minPct = season.min_nursery_percentage ?? 25;
  const minNurseryDays = totalNurseryDays * (minPct / 100);

  const idealDaysRequired = shippingPenalty + maxGerm + totalNurseryDays;
  const minDaysRequired = shippingPenalty + maxGerm + minNurseryDays;

  if (minDaysRequired > daysToLastPickup) {
      if (activeSeedIds.has(seed.id)) {
          return {
              canSelect: false,
              badge: { text: 'Growing (Check at Pickup)', color: 'bg-blue-100 text-blue-800 border-blue-200' },
              modalWarning: "It's too late to start a new batch of these, but we are already growing some! They may be available at pickup."
          };
      } else {
          return {
              canSelect: false,
              badge: { text: 'Too Late to Start', color: 'bg-red-100 text-red-800 border-red-200' },
              modalWarning: "Given the germination and growing time required, it is unfortunately too late to start these from seed for this season."
          };
      }
  } else if (idealDaysRequired > daysToTarget) {
      return {
          canSelect: true,
          badge: { text: seed.out_of_stock ? 'Small at pickup (OOS)' : 'Smaller at pickup', color: 'bg-amber-100 text-amber-800 border-amber-300' },
          modalWarning: `Because of growing times${seed.out_of_stock ? ' and shipping delays' : ''}, this variety will be slightly smaller than usual at the target pickup date.`
      };
  } else if (seed.out_of_stock) {
      return {
          canSelect: true,
          badge: { text: 'Needs Ordering', color: 'bg-stone-100 text-stone-600 border-stone-200' },
          modalWarning: null
      }
  }

  return { canSelect: true, badge: null, modalWarning: null };
};

const SeedModal = ({ seed, isSelected, onClose, onToggle, signedUrls, status, allSeeds, onView }: any) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const rawImages = useMemo(() => { const imgs = (seed.images || []).filter((img: string) => img && typeof img === 'string' && img.trim() !== ''); if (seed.thumbnail && seed.thumbnail.trim() !== '' && !imgs.includes(seed.thumbnail)) { imgs.unshift(seed.thumbnail); } return imgs; }, [seed]);
  const showCarousel = rawImages.length > 1;
  const rawDisplayImage = rawImages.length > 0 ? rawImages[currentIdx] : null;
  const isPepper = seed.category.toLowerCase().includes('pepper');
  const heatProfile = isPepper && seed.scoville_rating != null ? getHeatProfile(seed.scoville_rating) : null;
  const resolvedSrc = rawDisplayImage && (rawDisplayImage.startsWith('http') || rawDisplayImage.startsWith('data:')) ? rawDisplayImage : (rawDisplayImage ? signedUrls[rawDisplayImage] : null);
  
  // SWIPE LOGIC
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    if ((e.target as Element).closest('button')) return;
    setTouchStart(e.targetTouches[0].clientX);
  };
  const handleTouchMove = (e: React.TouchEvent) => { 
    if (touchStart) setTouchEnd(e.targetTouches[0].clientX); 
  };
  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd || !allSeeds || allSeeds.length === 0) return;
    const distance = touchStart - touchEnd;
    const currentIndex = allSeeds.findIndex((s: InventorySeed) => s.id === seed.id);
    
    if (distance > 75 && currentIndex < allSeeds.length - 1) { 
        onView(allSeeds[currentIndex + 1]);
    } else if (distance < -75 && currentIndex > 0) { 
        onView(allSeeds[currentIndex - 1]);
    }
    setTouchStart(0); setTouchEnd(0);
  };

  useEffect(() => { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = 'unset'; }; }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6" onClick={onClose}>
      <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm transition-opacity"></div>
      <div 
        className="relative bg-white rounded-3xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 select-none" 
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart} 
        onTouchMove={handleTouchMove} 
        onTouchEnd={handleTouchEnd}
      >
        <button onClick={onClose} className="absolute top-4 right-4 z-50 w-8 h-8 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center backdrop-blur-md transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        <div className="aspect-[4/3] sm:aspect-[16/10] w-full bg-stone-100 relative shrink-0 group">
          {resolvedSrc ? <img src={resolvedSrc} alt={seed.variety_name} className={`w-full h-full object-contain bg-stone-200 ${(!status.canSelect || seed.out_of_stock) ? 'grayscale opacity-70' : ''}`} /> : <div className="w-full h-full flex items-center justify-center text-stone-300"><svg className="w-16 h-16 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></div>}
          {showCarousel && (
            <>
              <button onClick={() => setCurrentIdx((prev) => (prev - 1 + rawImages.length) % rawImages.length)} className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-black/40 hover:bg-black/60 text-white rounded-full transition-all backdrop-blur-sm z-10"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg></button>
              <button onClick={() => setCurrentIdx((prev) => (prev + 1) % rawImages.length)} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-black/40 hover:bg-black/60 text-white rounded-full transition-all backdrop-blur-sm z-10"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg></button>
              <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-10">{rawImages.map((_: any, i: number) => (<div key={i} className={`w-2 h-2 rounded-full transition-all duration-300 shadow-sm ${i === currentIdx ? 'bg-white scale-110' : 'bg-white/50'}`} />))}</div>
            </>
          )}
          {seed.out_of_stock && <div className="absolute inset-x-0 bottom-0 bg-stone-900/80 text-stone-200 text-xs font-black uppercase tracking-widest text-center py-2 backdrop-blur-sm z-20">Currently Out of Stock</div>}
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase px-2 py-1 rounded-lg border border-emerald-200">{seed.category}</span>
            {seed.days_to_maturity && <span className="bg-stone-100 text-stone-600 text-[10px] font-black uppercase px-2 py-1 rounded-lg border border-stone-200">{seed.days_to_maturity} Days</span>}
            {heatProfile && <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg border flex items-center gap-1 ${heatProfile.color.replace('text-white', 'border-transparent').replace('text-yellow-900', 'border-yellow-300')}`}><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M17.66 11.2C17.43 10.9 17.15 10.64 16.89 10.38C16.22 9.78 15.46 9.35 14.82 8.72C13.33 7.26 13 4.85 13.95 3C13 3.23 12.17 3.75 11.46 4.32C8.87 6.4 7.85 10.07 9.07 13.22C9.11 13.32 9.15 13.42 9.15 13.55C9.15 13.77 9 13.97 8.8 14.05C8.57 14.15 8.33 14.09 8.14 13.93C8.08 13.88 8.04 13.83 8 13.76C6.87 12.33 6.69 10.28 7.45 8.64C5.78 10 4.87 12.3 5 14.47C5.06 15.44 5.34 16.36 5.88 17.16C6.53 18.11 7.4 18.85 8.44 19.33C9.76 19.93 11.27 20 12.61 19.54C14.28 18.96 15.65 17.61 16.23 15.92C16.63 14.77 16.62 13.53 16.23 12.41C16.2 12.32 16.24 12.22 16.32 12.16C16.39 12.09 16.5 12.08 16.59 12.12C16.96 12.32 17.3 12.57 17.6 12.87C17.7 12.97 17.86 12.98 17.97 12.89C18.06 12.8 18.05 12.64 17.96 12.55C17.86 12.43 17.76 12.31 17.66 11.2Z"/></svg>{heatProfile.label}</span>}
          </div>
          <h2 className="text-2xl font-black text-stone-900 leading-tight mb-1">{seed.variety_name}</h2>
          <p className="text-sm font-medium text-stone-500 italic mb-6">{seed.species}</p>
          
          {status.modalWarning && (
            <div className={`p-4 rounded-xl mb-4 border text-sm flex gap-3 ${!status.canSelect ? 'bg-red-50 text-red-800 border-red-200' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>
              <span className="text-xl">⚠️</span>
              <p>{status.modalWarning}</p>
            </div>
          )}

          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-stone-400 mb-2">Notes</h3>
            {seed.notes ? <p className="text-sm text-stone-700 leading-relaxed bg-stone-50 p-4 rounded-2xl border border-stone-100">{seed.notes}</p> : <p className="text-sm text-stone-400 italic">No additional notes available for this variety.</p>}
          </div>
        </div>
        <div className="p-4 border-t border-stone-100 bg-stone-50 shrink-0">
          {!status.canSelect ? (
            <button disabled className="w-full py-4 rounded-2xl font-black uppercase tracking-widest bg-stone-200 text-stone-500 border border-stone-300 flex items-center justify-center gap-2 cursor-not-allowed">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              Unavailable
            </button>
          ) : (
            <button onClick={() => onToggle(seed.id)} className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${isSelected ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100' : 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20 hover:bg-emerald-500'}`}>
              {isSelected ? <><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>Remove from List</> : <><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>Add to Wishlist</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const SeedCard = ({ seed, isSelected, onToggle, onView, signedUrls, status }: any) => {
  const rawDisplayImage = seed.thumbnail || (seed.images && seed.images.length > 0 ? seed.images[0] : null);
  const isOutOfStock = seed.out_of_stock;
  const isPepper = seed.category.toLowerCase().includes('pepper');
  const heatProfile = isPepper && seed.scoville_rating != null ? getHeatProfile(seed.scoville_rating) : null;
  const resolvedSrc = rawDisplayImage && (rawDisplayImage.startsWith('http') || rawDisplayImage.startsWith('data:')) ? rawDisplayImage : (rawDisplayImage ? signedUrls[rawDisplayImage] : null);

  return (
    <div onClick={() => onView(seed)} className={`group relative bg-white rounded-xl sm:rounded-2xl overflow-hidden shadow-sm transition-all duration-200 cursor-pointer flex flex-col h-full border-2 ${isSelected ? 'border-emerald-500 shadow-emerald-500/20 shadow-md z-10' : 'border-transparent hover:border-emerald-200 hover:shadow-md'} ${!status.canSelect ? 'opacity-75' : ''}`}>
      {status.canSelect && (
        <button onClick={(e) => { e.stopPropagation(); onToggle(seed.id); }} className={`absolute top-1.5 right-1.5 sm:top-2 sm:right-2 z-30 w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all duration-200 shadow-sm border-2 ${isSelected ? 'bg-emerald-500 border-emerald-500 text-white scale-100' : 'bg-white/90 backdrop-blur-sm border-stone-200 text-stone-400 hover:border-emerald-400 hover:text-emerald-500 scale-95 hover:scale-105'}`} aria-label="Select Seed">
          {isSelected ? <svg className="w-3.5 h-3.5 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg> : <svg className="w-3.5 h-3.5 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>}
        </button>
      )}
      
      {isOutOfStock && <div className="absolute top-1.5 left-1.5 bg-stone-900/90 text-stone-200 text-[6px] sm:text-[9px] font-black uppercase tracking-widest px-1 sm:px-2 py-0.5 sm:py-1 rounded shadow-sm z-20 pointer-events-none">Out of Stock</div>}
      
      <div className="aspect-[4/3] w-full bg-stone-200 relative overflow-hidden border-b border-stone-100">
        {resolvedSrc ? <img src={resolvedSrc} alt={seed.variety_name} loading="lazy" className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 ${(!status.canSelect || isOutOfStock) ? 'grayscale opacity-70' : ''}`} /> : <div className="w-full h-full flex items-center justify-center text-stone-400"><svg className="w-6 h-6 sm:w-12 sm:h-12 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></div>}
        <div className="absolute inset-0 bg-gradient-to-t from-stone-900/90 via-stone-900/10 to-transparent opacity-80 z-0 pointer-events-none" />
        <div className="absolute bottom-1.5 left-1.5 flex flex-wrap gap-1 z-10 pr-1 pointer-events-none">
          <span className="bg-emerald-600 text-white text-[6px] sm:text-[9px] font-black uppercase px-1 sm:px-1.5 py-0.5 rounded-sm shadow-sm leading-none flex items-center">{seed.category}</span>
          {seed.days_to_maturity && <span className="bg-stone-800/90 backdrop-blur-sm text-stone-100 text-[6px] sm:text-[9px] font-black uppercase px-1 sm:px-1.5 py-0.5 rounded-sm shadow-sm leading-none flex items-center">{seed.days_to_maturity}d</span>}
          {heatProfile && <span className={`text-[6px] sm:text-[9px] font-black uppercase px-1 sm:px-1.5 py-0.5 rounded-sm shadow-sm flex items-center gap-0.5 leading-none ${heatProfile.color}`}><svg className="w-2 h-2 sm:w-2.5 sm:h-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.66 11.2C17.43 10.9 17.15 10.64 16.89 10.38C16.22 9.78 15.46 9.35 14.82 8.72C13.33 7.26 13 4.85 13.95 3C13 3.23 12.17 3.75 11.46 4.32C8.87 6.4 7.85 10.07 9.07 13.22C9.11 13.32 9.15 13.42 9.15 13.55C9.15 13.77 9 13.97 8.8 14.05C8.57 14.15 8.33 14.09 8.14 13.93C8.08 13.88 8.04 13.83 8 13.76C6.87 12.33 6.69 10.28 7.45 8.64C5.78 10 4.87 12.3 5 14.47C5.06 15.44 5.34 16.36 5.88 17.16C6.53 18.11 7.4 18.85 8.44 19.33C9.76 19.93 11.27 20 12.61 19.54C14.28 18.96 15.65 17.61 16.23 15.92C16.63 14.77 16.62 13.53 16.23 12.41C16.2 12.32 16.24 12.22 16.32 12.16C16.39 12.09 16.5 12.08 16.59 12.12C16.96 12.32 17.3 12.57 17.6 12.87C17.7 12.97 17.86 12.98 17.97 12.89C18.06 12.8 18.05 12.64 17.96 12.55C17.86 12.43 17.76 12.31 17.66 11.2Z"/></svg>{heatProfile.label}</span>}
        </div>
      </div>
      <div className="p-1.5 sm:p-3 flex flex-col flex-1 pointer-events-none">
        <h3 className="font-black text-[11px] sm:text-base text-stone-800 leading-tight sm:mb-0.5 line-clamp-2 sm:line-clamp-1">{seed.variety_name}</h3>
        {status.badge && (
          <span className={`inline-block mt-1 text-[8px] sm:text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border shadow-sm w-fit ${status.badge.color}`}>
            {status.badge.text}
          </span>
        )}
        {!status.badge && seed.species && <p className="text-stone-400 text-[8px] sm:text-[10px] italic mt-0.5 truncate">{seed.species}</p>}
      </div>
    </div>
  );
};

export default function WishlistCatalog() {
  const params = useParams();
  const token = params.token as string;

  const [session, setSession] = useState<any>(null);
  const [seasonName, setSeasonName] = useState("");
  const [seeds, setSeeds] = useState<InventorySeed[]>([]);
  const [categories, setCategories] = useState<SeedCategory[]>([]);
  const [activeGrowingIds, setActiveGrowingIds] = useState<Set<string>>(new Set());
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({}); 
  
  const [selectedSeedIds, setSelectedSeedIds] = useState<string[]>([]);
  const [viewedSeed, setViewedSeed] = useState<InventorySeed | null>(null);
  const [customRequest, setCustomRequest] = useState("");
  
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
          .select('*, seasons(name, status, seedling_target_date, last_pickup_date, min_nursery_percentage)')
          .eq('id', token)
          .single();

        if (sessionError || !sessionData) throw new Error("Invalid or expired link.");
        
        if (sessionData.expires_at) {
          const expDate = new Date(sessionData.expires_at);
          if (!isNaN(expDate.getTime()) && expDate < new Date()) {
            throw new Error("This wishlist link has expired.");
          }
        }

        setSession(sessionData);
        setSeasonName(sessionData.seasons?.name || "the upcoming season");

        const [ { data: seedData }, { data: catData }, { data: growData }, { data: seedlingData } ] = await Promise.all([
           supabase.from('seed_inventory').select('*'),
           supabase.from('seed_categories').select('*'),
           supabase.from('grow_plan').select('seed_id').eq('season_id', sessionData.season_id),
           supabase.from('season_seedlings').select('seed_id').eq('season_id', sessionData.season_id).gt('qty_growing', 0)
        ]);

        // FIX: Dynamic filtering using the 'is_internal' flag directly from the database
        if (catData && seedData) {
           const internalCatNames = new Set((catData as SeedCategory[]).filter(c => c.is_internal).map(c => c.name));
           
           const publicCats = (catData as SeedCategory[]).filter(c => !c.is_internal);
           setCategories(publicCats);

           const publicSeeds = (seedData as InventorySeed[]).filter(s => !internalCatNames.has(s.category));
           setSeeds(publicSeeds);
        }

        const growingSet = new Set<string>();
        growData?.forEach(g => growingSet.add(g.seed_id));
        seedlingData?.forEach(s => growingSet.add(s.seed_id));
        setActiveGrowingIds(growingSet);

        const { data: existingSelections } = await supabase.from('wishlist_selections').select('*').eq('session_id', sessionData.id);
        if (existingSelections && existingSelections.length > 0) {
           setSelectedSeedIds(existingSelections.filter(s => s.seed_id).map(s => s.seed_id as string));
           const custom = existingSelections.find(s => s.custom_request);
           if (custom) setCustomRequest(custom.custom_request);
        }

      } catch (err: any) { setError(err.message); } finally { setIsLoading(false); }
    };
    fetchCatalogData();
  }, [token]);

  useEffect(() => {
    let isMounted = true;
    const loadSignedUrls = async () => {
      if (seeds.length === 0) return;
      const urlsToFetch = seeds.flatMap(s => [s.thumbnail, ...(s.images || [])]).filter(img => img && typeof img === 'string' && img.trim() !== '' && !img.startsWith('data:') && !img.startsWith('http')) as string[]; 
      if (urlsToFetch.length === 0) return;

      const uniqueUrls = Array.from(new Set(urlsToFetch));
      try {
        const chunkSize = 100;
        const fetchedUrls: Record<string, string> = {};
        for (let i = 0; i < uniqueUrls.length; i += chunkSize) {
          const chunk = uniqueUrls.slice(i, i + chunkSize);
          const { data, error } = await supabase.storage.from('talawa_media').createSignedUrls(chunk, 3600);
          if (data && !error) { data.forEach((item: any) => { if (item.signedUrl) fetchedUrls[item.path] = item.signedUrl; }); }
        }
        if (isMounted && Object.keys(fetchedUrls).length > 0) setSignedUrls(prev => ({ ...prev, ...fetchedUrls }));
      } catch (err) { console.error("Failed to load signed URLs", err); }
    };
    loadSignedUrls();
    return () => { isMounted = false; };
  }, [seeds]);

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
      result = result.filter(s => s.variety_name.toLowerCase().includes(q) || (s.species && s.species.toLowerCase().includes(q)) || (s.notes && s.notes.toLowerCase().includes(q)));
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

  const toggleSeedSelection = async (seedId: string) => {
    if (!session) return;
    const isCurrentlySelected = selectedSeedIds.includes(seedId);
    if (isCurrentlySelected) {
      setSelectedSeedIds(prev => prev.filter(id => id !== seedId));
      await supabase.from('wishlist_selections').delete().match({ session_id: session.id, seed_id: seedId });
    } else {
      setSelectedSeedIds(prev => [...prev, seedId]);
      await supabase.from('wishlist_selections').insert([{ session_id: session.id, seed_id: seedId }]);
    }
  };

  const handleSubmit = async () => {
    if (!session) return;
    setIsSubmitting(true);
    try {
      if (customRequest.trim() !== "") {
        await supabase.from('wishlist_selections').delete().is('seed_id', null).eq('session_id', session.id);
        await supabase.from('wishlist_selections').insert([{ session_id: session.id, custom_request: customRequest.trim() }]);
      }
      await supabase.from('wishlist_sessions').update({ submitted_at: new Date().toISOString() }).eq('id', session.id);
      setIsSuccess(true);
    } catch (err: any) { alert("Failed to submit wishlist: " + err.message); } 
    finally { setIsSubmitting(false); }
  };

  if (isLoading) return <div className="min-h-screen bg-stone-50 flex items-center justify-center"><div className="flex flex-col items-center gap-4 text-emerald-600"><svg className="w-10 h-10 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span className="font-bold tracking-widest uppercase text-xs">Loading Catalog...</span></div></div>;
  if (error || !session) return <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4 text-center"><div className="bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full border border-stone-200"><h1 className="text-xl font-black text-stone-800 mb-2">Link Unavailable</h1><p className="text-stone-500 text-sm">{error}</p></div></div>;

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4 text-center">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full border border-stone-200 animate-in zoom-in-95 duration-500">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6"><svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg></div>
          <h1 className="text-2xl font-black text-stone-800 mb-3">Wishlist Submitted!</h1>
          <p className="text-stone-500 text-sm mb-6">
            Thank you, {session.list_name}! Your garden requests for {seasonName} have been recorded. 
            {session.seasons?.seedling_target_date && ` Your seedlings should be ready around ${new Date(session.seasons.seedling_target_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric'})}.`}
          </p>
          <button onClick={() => setIsSuccess(false)} className="px-6 py-3 bg-stone-100 text-stone-700 font-bold rounded-xl hover:bg-stone-200 active:scale-95 transition-all shadow-sm">Make Changes</button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-stone-100 text-stone-900 pb-32 font-sans selection:bg-emerald-200">
      {/* We pass allSeeds into SeedModal here so the modal knows exactly which list it should swipe through */}
      {viewedSeed && (
        <SeedModal 
          seed={viewedSeed} 
          isSelected={selectedSeedIds.includes(viewedSeed.id)} 
          onClose={() => setViewedSeed(null)} 
          onToggle={toggleSeedSelection} 
          signedUrls={signedUrls} 
          status={getSeedStatus(viewedSeed, session.seasons, categories, activeGrowingIds)} 
          allSeeds={filteredAndSortedSeeds} 
          onView={setViewedSeed} 
        />
      )}

      <header className="bg-emerald-800 text-white pt-10 pb-20 px-4 sm:px-6 rounded-b-[2rem] sm:rounded-b-[3rem] shadow-xl relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-emerald-100 via-transparent to-transparent"></div>
        <div className="max-w-4xl mx-auto relative z-10 text-center">
          <span className="inline-block py-1 px-3 rounded-full bg-emerald-900/50 border border-emerald-700/50 text-emerald-200 text-[10px] font-black uppercase tracking-[0.2em] mb-3 shadow-sm backdrop-blur-sm">{seasonName} Catalog</span>
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight mb-3">Welcome, {session.list_name}!</h1>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6 text-emerald-200/90 text-xs sm:text-sm font-medium mb-4">
            {session.expires_at && (
              <div className="flex items-center gap-1.5 bg-emerald-900/40 px-3 py-1.5 rounded-lg border border-emerald-700/50">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span>Access expires: <strong>{new Date(session.expires_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</strong></span>
              </div>
            )}
            {session.seasons?.seedling_target_date && (
              <div className="flex items-center gap-1.5 bg-emerald-900/40 px-3 py-1.5 rounded-lg border border-emerald-700/50">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                <span>Target Availability: <strong>{new Date(session.seasons.seedling_target_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong></span>
              </div>
            )}
          </div>

          <p className="text-emerald-100 text-xs sm:text-sm md:text-base max-w-xl mx-auto leading-relaxed px-2">Browse the seed vault. Tap any card for photos and details, or tap the (+) to instantly save it to your list.</p>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-2 sm:px-6 -mt-12 sm:-mt-16 relative z-20 space-y-6">
        <div className="bg-white/90 backdrop-blur-md p-3 sm:p-4 rounded-2xl sm:rounded-3xl shadow-lg border border-stone-200 flex flex-col sm:flex-row gap-2 sm:gap-4 items-center">
          <div className="relative w-full sm:flex-1">
            <input type="text" placeholder="Search varieties, notes..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-stone-50 border border-stone-200 rounded-xl sm:rounded-2xl py-2.5 sm:py-3 pl-9 sm:pl-10 pr-4 text-xs sm:text-sm shadow-inner focus:border-emerald-500 outline-none" />
            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-stone-400 absolute left-3 top-3 sm:top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          <div className="flex w-full sm:w-auto gap-2">
            <div className="relative flex-1 sm:w-40">
              <select value={activeCategory} onChange={(e) => setActiveCategory(e.target.value)} className="w-full bg-stone-50 border border-stone-200 rounded-xl sm:rounded-2xl py-2.5 sm:py-3 pl-3 sm:pl-4 pr-7 sm:pr-8 text-xs sm:text-sm font-bold shadow-inner focus:border-emerald-500 outline-none appearance-none">
                {availableCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <svg className="w-4 h-4 text-stone-400 absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>
            <div className="relative flex-1 sm:w-40">
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="w-full bg-stone-50 border border-stone-200 rounded-xl sm:rounded-2xl py-2.5 sm:py-3 pl-3 sm:pl-4 pr-7 sm:pr-8 text-xs sm:text-sm font-bold shadow-inner focus:border-emerald-500 outline-none appearance-none">
                <option value="name_asc">Name (A-Z)</option><option value="name_desc">Name (Z-A)</option><option value="category">Category</option><option value="dtm_asc">Fastest</option><option value="dtm_desc">Longest</option>
              </select>
              <svg className="w-4 h-4 text-stone-400 absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center px-2">
          <button onClick={() => setShowSelectedOnly(!showSelectedOnly)} className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold whitespace-nowrap transition-all shadow-sm flex items-center gap-1.5 border ${showSelectedOnly ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'}`}>
            <span className={`w-2 h-2 rounded-full ${selectedSeedIds.length > 0 ? 'bg-emerald-500' : 'bg-stone-300'}`}></span>Show Selected ({selectedSeedIds.length})
          </button>
          <p className="text-[9px] sm:text-[10px] font-black text-stone-400 uppercase tracking-widest">{filteredAndSortedSeeds.length} Results</p>
        </div>

        {filteredAndSortedSeeds.length === 0 ? (
          <div className="bg-white p-10 rounded-3xl text-center border border-stone-200 shadow-sm"><h3 className="text-lg font-black text-stone-800">No seeds found</h3></div>
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-4">
            {filteredAndSortedSeeds.map((seed) => (
              <SeedCard key={seed.id} seed={seed} isSelected={selectedSeedIds.includes(seed.id)} onToggle={toggleSeedSelection} onView={setViewedSeed} signedUrls={signedUrls} status={getSeedStatus(seed, session.seasons, categories, activeGrowingIds)} />
            ))}
          </div>
        )}

        <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-sm border border-stone-200 mt-8">
          <h3 className="font-black text-sm sm:text-base text-stone-800 mb-1 sm:mb-2 flex items-center gap-2"><span className="text-emerald-500">✨</span> Custom Requests</h3>
          <p className="text-[10px] sm:text-sm text-stone-500 mb-3 sm:mb-4">Don't see what you're looking for? Leave a note.</p>
          <textarea value={customRequest} onChange={(e) => setCustomRequest(e.target.value)} placeholder="e.g., I'd love a really hot yellow pepper..." rows={3} className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 sm:p-4 text-xs sm:text-sm outline-none focus:border-emerald-500 resize-none shadow-inner" />
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-3 sm:p-4 bg-white/90 backdrop-blur-md border-t border-stone-200 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-40">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 px-2 sm:px-6">
          <div className="flex flex-col">
            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-stone-400">Ready?</span>
            <span className="font-black text-sm sm:text-base text-emerald-700">{selectedSeedIds.length} Items Selected</span>
          </div>
          <button onClick={handleSubmit} disabled={isSubmitting || (selectedSeedIds.length === 0 && customRequest.trim() === "")} className="px-6 py-3 sm:px-8 sm:py-4 bg-emerald-600 text-white rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm uppercase tracking-widest shadow-xl shadow-emerald-900/20 active:scale-95 transition-all disabled:opacity-50">
            {isSubmitting ? 'Sending...' : 'Submit Final List'}
          </button>
        </div>
      </div>
    </main>
  );
}