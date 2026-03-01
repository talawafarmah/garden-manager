import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { InventorySeed, SeedlingTray } from '../types';

interface SeedDetailProps {
  seed: InventorySeed;
  trays: SeedlingTray[];
  categories: any[];
  navigateTo: (view: any, payload?: any) => void;
  handleGoBack: (view: any) => void;
  userRole?: string; // Passed from page.tsx to determine Admin/Viewer
}

export default function SeedDetail({ seed, trays, navigateTo, handleGoBack, userRole }: SeedDetailProps) {
  const [viewingImageIndex, setViewingImageIndex] = useState(seed.primaryImageIndex || 0);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  
  const [parents, setParents] = useState<{mother?: string, father?: string}>({});

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

  const rawImgPath = (seed.images && seed.images.length > 0) ? seed.images[viewingImageIndex] : null;
  const displayImg = rawImgPath 
    ? (rawImgPath.startsWith('http') || rawImgPath.startsWith('data:') ? rawImgPath : signedUrls[rawImgPath]) 
    : null;

  const isTomato = seed.category?.toLowerCase().includes('tomato');
  const isPepper = seed.category?.toLowerCase().includes('pepper');
  const shu = seed.scoville_rating !== undefined && seed.scoville_rating !== null ? Number(seed.scoville_rating) : null;

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900 pb-20 font-sans">
      {fullScreenImage && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4" onClick={() => setFullScreenImage(null)}>
          <img src={fullScreenImage} className="max-w-full max-h-full object-contain rounded-lg" alt="Fullscreen" />
        </div>
      )}

      <header className="bg-emerald-700 text-white p-4 shadow-md sticky top-0 z-10 flex items-center justify-between">
        <button onClick={onBack} className="p-2 bg-emerald-800 rounded-full active:scale-90 transition-transform">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-bold truncate px-2">Seed Details</h1>
        
        {/* ROLE CHECK: Only Admins can edit or breed */}
        {userRole === 'admin' && (
          <div className="flex gap-2">
             <button onClick={handleBreedSeed} className="p-2 bg-emerald-800 rounded-full active:scale-90 transition-transform" title="Record Next Gen / Cross">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
               </svg>
             </button>
             <button onClick={onEdit} className="p-2 bg-emerald-800 rounded-full active:scale-90 transition-transform">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
               </svg>
             </button>
          </div>
        )}
      </header>

      <div className="max-w-md mx-auto">
        {/* Hero Image Section */}
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

        {/* Gallery Thumbnails */}
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
          
          {/* GENETICS & LINEAGE CARD */}
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

          {/* Key Indicators */}
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

          {/* Core Botanical Data */}
          <section className="bg-white p-5 rounded-3xl shadow-sm border border-stone-200 grid grid-cols-2 gap-y-5 gap-x-4">
            <div>
              <label className="block text-[9px] font-black text-stone-400 uppercase tracking-[0.2em] mb-1">Maturity</label>
              <p className="font-bold text-stone-800">{seed.days_to_maturity || '--'} Days</p>
            </div>
            <div>
              <label className="block text-[9px] font-black text-stone-400 uppercase tracking-[0.2em] mb-1">Sunlight</label>
              <p className="font-bold text-stone-800">{seed.sunlight || 'Full Sun'}</p>
            </div>
            <div>
              <label className="block text-[9px] font-black text-stone-400 uppercase tracking-[0.2em] mb-1">Seed Depth</label>
              <p className="font-bold text-stone-800">{seed.seed_depth || '--'}</p>
            </div>
            <div>
              <label className="block text-[9px] font-black text-stone-400 uppercase tracking-[0.2em] mb-1">Spacing</label>
              <p className="font-bold text-stone-800">{seed.plant_spacing || '--'}</p>
            </div>
          </section>

          {/* Growing Notes */}
          <section className="bg-white p-6 rounded-3xl shadow-sm border border-stone-200">
            <h3 className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
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