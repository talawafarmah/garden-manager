import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { InventorySeed, SeedlingTray } from '../types';
import { generateNextId } from '../lib/utils';

export default function SeedDetail({ seed, trays, categories, navigateTo, handleGoBack }: any) {
  const [fullSeed, setFullSeed] = useState<InventorySeed | null>(seed.images ? seed : null);
  const [isLoading, setIsLoading] = useState(!seed.images || !seed.variety_name);
  const [viewingImageIndex, setViewingImageIndex] = useState(seed.primaryImageIndex || 0);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  // 1. Fetch full details if only an ID was provided (e.g., direct navigation from a tray content list)
  useEffect(() => {
    const fetchFullDetails = async () => {
      if (!seed.images || !seed.variety_name) {
        setIsLoading(true);
        const { data } = await supabase.from('seed_inventory').select('*').eq('id', seed.id).single();
        if (data) { 
          setFullSeed(data); 
          setViewingImageIndex(data.primaryImageIndex || 0); 
        }
        setIsLoading(false);
      }
    };
    fetchFullDetails();
  }, [seed.id, seed.images, seed.variety_name]);

  // 2. Resolve Signed URLs for private bucket images in the inventory
  useEffect(() => {
    const loadUrls = async () => {
      if (!fullSeed || !fullSeed.images || fullSeed.images.length === 0) return;
      
      const newUrls: Record<string, string> = { ...signedUrls };
      let changed = false;

      for (const img of fullSeed.images) {
        if (!img.startsWith('data:image') && !img.startsWith('http') && !newUrls[img]) {
          const { data } = await supabase.storage.from('talawa_media').createSignedUrl(img, 3600);
          if (data) {
            newUrls[img] = data.signedUrl;
            changed = true;
          }
        }
      }
      if (changed) setSignedUrls(newUrls);
    };
    
    loadUrls();
  }, [fullSeed]);

  const handleDuplicateSeed = async () => {
    if (!fullSeed) return;
    setIsDuplicating(true);
    try {
      let prefix = 'U';
      const found = categories?.find((c: any) => c.name === fullSeed.category);
      if (found) prefix = found.prefix;
      
      const newId = await generateNextId(prefix);
      const duplicatedSeed: InventorySeed = { 
        ...fullSeed, 
        id: newId, 
        variety_name: `${fullSeed.variety_name} (Copy)`, 
        images: [], 
        primaryImageIndex: 0, 
        thumbnail: "" 
      };
      
      navigateTo('seed_edit', duplicatedSeed);
    } catch (error: any) { 
      alert("Failed to duplicate seed: " + error.message); 
    } finally { 
      setIsDuplicating(false); 
    }
  };

  /**
   * DYNAMIC BACK LOGIC:
   * Uses the 'returnTo' metadata passed during navigation.
   * We use explicit navigateTo for the fallback to 'vault' to ensure we never get stuck
   * in a history loop if the user navigated back and forth between screens.
   */
  const onBack = () => {
    if (seed.returnTo) {
      navigateTo(seed.returnTo, seed.returnPayload);
    } else {
      navigateTo('vault');
    }
  };

  /**
   * Preservation logic for Edit navigation:
   * We pass the return metadata forward so that after saving the edit, 
   * the user can still get back to their original context (e.g. the Tray).
   */
  const onEdit = () => {
    navigateTo('seed_edit', { 
      ...fullSeed, 
      returnTo: seed.returnTo, 
      returnPayload: seed.returnPayload 
    });
  };

  if (isLoading || !fullSeed) {
    return (
      <main className="min-h-screen bg-stone-50 flex flex-col items-center justify-center">
        <svg className="w-10 h-10 animate-spin text-emerald-600 mb-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        <span className="text-stone-500 font-bold">Loading Botanical Data...</span>
      </main>
    );
  }

  const rawMainImg = (fullSeed.images && fullSeed.images.length > 0) ? fullSeed.images[viewingImageIndex] : null;
  const displayImg = rawMainImg ? (rawMainImg.startsWith('data:image') || rawMainImg.startsWith('http') ? rawMainImg : signedUrls[rawMainImg]) : null;
  const seedHistory = trays.filter((t: SeedlingTray) => t.contents.some(c => c.seed_id === fullSeed.id));

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900 pb-20">
      {fullScreenImage && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center cursor-zoom-out" onClick={() => setFullScreenImage(null)}>
          <img src={fullScreenImage} className="max-w-full max-h-full object-contain" alt="Fullscreen View" />
        </div>
      )}
      
      <header className="bg-emerald-700 text-white p-4 shadow-md sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 bg-emerald-800 rounded-full hover:bg-emerald-600 transition-colors shadow-sm">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h1 className="text-xl font-bold truncate">Seed Details</h1>
        </div>
        <div className="flex items-center gap-2">
           <button onClick={handleDuplicateSeed} className="bg-emerald-800 hover:bg-emerald-600 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border border-emerald-600 shadow-sm flex items-center gap-1.5">
             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
             Copy
           </button>
           <button onClick={onEdit} className="bg-emerald-800 hover:bg-emerald-600 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border border-emerald-600 shadow-sm flex items-center gap-1.5">
             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
             Edit
           </button>
        </div>
      </header>

      <div className="max-w-md mx-auto">
        <div className="w-full aspect-[4/3] bg-stone-200 relative">
          {displayImg ? (
            <img src={displayImg} onClick={() => setFullScreenImage(displayImg)} className="w-full h-full object-cover cursor-zoom-in" alt={fullSeed.variety_name} />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-stone-400">
               <svg className="w-12 h-12 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
               <span>No image available</span>
            </div>
          )}
          <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-stone-900/90 via-stone-900/60 to-transparent p-4 pt-12">
            <div className="bg-emerald-500 text-white text-xs font-bold px-2 py-1 rounded inline-block mb-2 shadow-sm">{fullSeed.id}</div>
            <h2 className="text-2xl font-bold text-white leading-tight shadow-black">{fullSeed.variety_name}</h2>
            <p className="text-emerald-300 text-sm font-medium mt-1 uppercase tracking-wider">{fullSeed.category} <span className="text-stone-300/80 font-normal italic lowercase">({fullSeed.species})</span></p>
          </div>
        </div>

        {fullSeed.images && fullSeed.images.length > 1 && (
          <div className="p-4 bg-white border-b border-stone-200 flex gap-2 overflow-x-auto scrollbar-hide">
            {fullSeed.images.map((img: string, idx: number) => {
              const thumbSrc = img.startsWith('data:image') || img.startsWith('http') ? img : signedUrls[img] || '';
              return (
                <div key={idx} onClick={() => setViewingImageIndex(idx)} className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${idx === viewingImageIndex ? 'border-emerald-500 opacity-100 shadow-md' : 'border-transparent opacity-60 hover:opacity-100'}`}>
                  {thumbSrc ? <img src={thumbSrc} className="w-full h-full object-cover" alt="Thumbnail" /> : <div className="w-full h-full bg-stone-100 animate-pulse" />}
                </div>
              );
            })}
          </div>
        )}

        <div className="p-4 space-y-4">
           <section className="bg-white p-5 rounded-2xl shadow-sm border border-stone-200">
             <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-4 border-b border-stone-50 pb-2 flex items-center justify-between">
               Botanical Specs
               {fullSeed.out_of_stock && <span className="text-red-500 font-black">OUT OF STOCK</span>}
             </h3>
             <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                <div className="flex flex-col">
                  <span className="text-stone-400 font-bold uppercase text-[9px]">Maturity</span>
                  <span className="text-stone-800 font-bold text-sm">{fullSeed.days_to_maturity} Days</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-stone-400 font-bold uppercase text-[9px]">Sunlight</span>
                  <span className="text-stone-800 font-bold text-sm truncate">{fullSeed.sunlight || 'Full Sun'}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-stone-400 font-bold uppercase text-[9px]">Vendor</span>
                  <span className="text-stone-800 font-bold text-sm truncate">{fullSeed.vendor || '--'}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-stone-400 font-bold uppercase text-[9px]">Life Cycle</span>
                  <span className="text-stone-800 font-bold text-sm">{fullSeed.lifecycle || 'Annual'}</span>
                </div>
             </div>
           </section>

           {seedHistory.length > 0 && (
             <section className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-100">
                <h3 className="text-[10px] font-bold text-emerald-800 mb-3 flex items-center gap-2 uppercase tracking-widest">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10" /></svg>
                  Germination Performance
                </h3>
                <div className="space-y-2">
                   {seedHistory.map((t: SeedlingTray) => {
                     const data = t.contents.find(c => c.seed_id === fullSeed.id);
                     const rate = data?.sown_count ? Math.round((data.germinated_count / data.sown_count) * 100) : 0;
                     return (
                       <button 
                         key={t.id} 
                         onClick={() => navigateTo('tray_detail', t)}
                         className="w-full bg-stone-50 p-3 rounded-xl text-xs flex justify-between items-center border border-stone-100 hover:bg-stone-100 active:scale-95 transition-all text-left"
                       >
                         <div className="flex flex-col items-start min-w-0 pr-2">
                           <span className="font-bold text-stone-700 truncate w-full">{t.name}</span>
                           <span className="text-[10px] text-stone-400">{t.sown_date}</span>
                         </div>
                         <div className="text-right flex-shrink-0">
                           <span className={`font-bold text-sm block ${rate > 70 ? 'text-emerald-700' : 'text-stone-600'}`}>{rate}% Rate</span>
                           <span className="text-[9px] text-stone-500 font-medium">({data?.germinated_count}/{data?.sown_count} sprouted)</span>
                         </div>
                       </button>
                     );
                   })}
                </div>
             </section>
           )}

           <section className="bg-white p-5 rounded-2xl shadow-sm border border-stone-200">
             <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-4 border-b border-stone-50 pb-2">Requirements</h3>
             <div className="space-y-2.5 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-stone-500">Seed Depth</span>
                  <span className="font-bold text-stone-800">{fullSeed.seed_depth || '--'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-stone-500">Spacing</span>
                  <span className="font-bold text-stone-800">{fullSeed.plant_spacing || '--'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-stone-500">Germ. Time</span>
                  <span className="font-bold text-stone-800">{fullSeed.germination_days || '--'}</span>
                </div>
                {(fullSeed.light_required || fullSeed.cold_stratification) && (
                  <div className="pt-2 mt-2 border-t border-stone-50 flex flex-col gap-2">
                    {fullSeed.light_required && <div className="text-[10px] font-black text-amber-600 uppercase flex items-center gap-1.5"><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" /></svg> Light Required to Sprout</div>}
                    {fullSeed.cold_stratification && <div className="text-[10px] font-black text-blue-600 uppercase flex items-center gap-1.5"><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L12 22M4.92822 4.92822L19.0718 19.0718M2 12H22M4.92822 19.0718L19.0718 4.92822" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> Cold Stratify ({fullSeed.stratification_days} Days)</div>}
                  </div>
                )}
             </div>
           </section>

           <section className="bg-white p-5 rounded-2xl shadow-sm border border-stone-200 text-sm">
             <h3 className="text-stone-800 font-bold mb-3 flex items-center gap-2 uppercase text-[10px] tracking-widest"><svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>Growing Notes</h3>
             <p className="text-stone-600 leading-relaxed whitespace-pre-wrap">{fullSeed.notes || 'No specific growing notes recorded.'}</p>
           </section>
        </div>
      </div>
    </main>
  );
}