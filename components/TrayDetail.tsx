import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { SeedlingTray, InventorySeed } from '../types';

/**
 * TrayDetail Component
 * Displays the specific details, progress gallery, and variety contents of a tray.
 */
export default function TrayDetail({ tray, inventory, navigateTo, handleGoBack }: any) {
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [isDuplicating, setIsDuplicating] = useState(false);

  // Resolve temporary Signed URLs for images stored in the private Supabase bucket
  useEffect(() => {
    const loadUrls = async () => {
      if (!tray || !tray.images || tray.images.length === 0) return;
      
      const newUrls: Record<string, string> = { ...signedUrls };
      let changed = false;

      for (const img of tray.images) {
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
  }, [tray]);

  const totalSown = tray.contents.reduce((sum: number, item: any) => sum + (item.sown_count || 0), 0);
  const totalGerminated = tray.contents.reduce((sum: number, item: any) => sum + (item.germinated_count || 0), 0);
  const germRate = totalSown > 0 ? Math.round((totalGerminated / totalSown) * 100) : 0;

  /**
   * Duplication Logic:
   * Creates a new tray object copying the environmental setup and varieties,
   * but resetting the historical counts and dates for a fresh seedling run.
   */
  const handleDuplicateTray = () => {
    setIsDuplicating(true);
    
    const duplicatedTray: SeedlingTray = {
      ...tray,
      id: undefined, // ID is removed so TrayEdit knows it's a new record
      name: `${tray.name} (Copy)`,
      sown_date: new Date().toISOString().split('T')[0],
      first_germination_date: "",
      first_planted_date: "",
      images: [],
      thumbnail: "",
      contents: tray.contents.map((item: any) => ({
        ...item,
        sown_count: 0,
        germinated_count: 0,
        planted_count: 0,
        germination_date: ""
      }))
    };

    navigateTo('tray_edit', duplicatedTray);
    setIsDuplicating(false);
  };

  /**
   * Context-Aware Drilling:
   * When a user clicks a seed variety in this tray, we navigate to the seed details
   * but pass navigation metadata so the user can return exactly to this tray.
   */
  const handleSeedClick = (seedId: string) => {
    const fullSeed = inventory?.find((s: InventorySeed) => s.id === seedId);
    if (fullSeed) {
      navigateTo('seed_detail', { 
        ...fullSeed, 
        returnTo: 'tray_detail', 
        returnPayload: tray 
      });
    } else {
      navigateTo('seed_detail', { 
        id: seedId, 
        returnTo: 'tray_detail', 
        returnPayload: tray 
      });
    }
  };

  /**
   * Explicit Back Navigation:
   * Ensures the user always returns to the main tray list.
   */
  const onBack = () => {
    navigateTo('trays');
  };

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900 pb-20">
      {fullScreenImage && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-2 cursor-zoom-out" onClick={() => setFullScreenImage(null)}>
          <img src={fullScreenImage} alt="Full screen" className="max-w-full max-h-full object-contain" />
        </div>
      )}

      <header className="bg-emerald-800 text-white p-4 shadow-md sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 bg-emerald-900 rounded-full hover:bg-emerald-700 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h1 className="text-xl font-bold truncate">Tray Details</h1>
        </div>
        <div className="flex items-center gap-2">
           <button onClick={handleDuplicateTray} disabled={isDuplicating} className="p-2 bg-emerald-900 rounded-full hover:bg-emerald-700 transition-colors flex items-center gap-1 px-3 disabled:opacity-50 text-sm font-medium">
             {isDuplicating ? 'Copying...' : 'Copy'}
           </button>
           <button onClick={() => navigateTo('tray_edit', tray)} className="p-2 bg-emerald-900 rounded-full hover:bg-emerald-700 transition-colors flex items-center gap-1 px-3 text-sm font-medium">
             Edit
           </button>
        </div>
      </header>

      <div className="max-w-md mx-auto p-4 space-y-5">
         <section className="bg-white p-5 rounded-2xl shadow-sm border border-stone-200">
            <h2 className="text-2xl font-bold text-stone-800 leading-tight mb-4">{tray.name}</h2>
            
            <div className="grid grid-cols-3 gap-2 bg-stone-50 rounded-xl p-3 border border-stone-200 mb-4 text-center">
               <div><div className="text-[10px] text-stone-500 font-bold uppercase">Sown</div><div className="text-sm font-bold">{tray.sown_date || '--'}</div></div>
               <div className="border-l border-stone-200">
                 <div className="text-[10px] text-stone-500 font-bold uppercase">Sprout</div>
                 <div className="text-sm font-bold text-emerald-600">{tray.first_germination_date || '--'}</div>
               </div>
               <div className="border-l border-stone-200">
                 <div className="text-[10px] text-stone-500 font-bold uppercase">Planted</div>
                 <div className="text-sm font-bold text-blue-600">{tray.first_planted_date || '--'}</div>
               </div>
            </div>

            <div className="grid grid-cols-3 gap-2 bg-emerald-50 rounded-xl p-3 border border-emerald-100">
               <div className="text-center"><div className="text-xs text-emerald-600 font-bold uppercase mb-0.5">Seeds</div><div className="text-xl font-black text-emerald-900">{totalSown}</div></div>
               <div className="text-center border-l border-emerald-200"><div className="text-xs text-emerald-600 font-bold uppercase mb-0.5">Sprouted</div><div className="text-xl font-black text-emerald-900">{totalGerminated}</div></div>
               <div className="text-center border-l border-emerald-200"><div className="text-xs text-emerald-600 font-bold uppercase mb-0.5">Rate</div><div className="text-xl font-black text-emerald-900">{germRate}%</div></div>
            </div>
         </section>

         <section>
           <h3 className="font-bold text-stone-800 px-1 mb-3 flex items-center justify-between">
             Contents
             <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{tray.contents.length} Varieties</span>
           </h3>
           <div className="space-y-3">
             {tray.contents.map((seedRecord: any, idx: number) => {
               const fullSeed = inventory?.find((s: InventorySeed) => s.id === seedRecord.seed_id);
               return (
                 <div 
                   key={idx} 
                   onClick={() => handleSeedClick(seedRecord.seed_id)} 
                   className="bg-white p-4 rounded-xl shadow-sm border border-stone-200 cursor-pointer hover:border-emerald-400 transition-all active:scale-95 group"
                 >
                   <div className="flex justify-between items-start mb-3 border-b border-stone-100 pb-3">
                     <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-stone-100 border border-stone-200 overflow-hidden flex-shrink-0">
                          {fullSeed?.thumbnail ? (
                            <img src={fullSeed.thumbnail} className="w-full h-full object-cover" alt="" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-stone-300">
                               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" /></svg>
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-stone-800 leading-tight group-hover:text-emerald-700 transition-colors truncate">{seedRecord.variety_name}</h4>
                          <span className="text-[10px] font-mono bg-stone-100 px-1.5 py-0.5 rounded text-stone-600 border border-stone-200 mt-1 inline-block">{seedRecord.seed_id}</span>
                        </div>
                     </div>
                     <div className="text-right">
                       <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100 flex items-center gap-1">
                         {seedRecord.sown_count > 0 ? Math.round((seedRecord.germinated_count / seedRecord.sown_count) * 100) : 0}%
                         <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                       </span>
                     </div>
                   </div>
                   <div className="flex justify-between text-xs px-1 text-stone-500 font-medium">
                     <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-stone-300"></div> Sown: <span className="text-stone-800 font-bold">{seedRecord.sown_count}</span></div>
                     <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div> Sprouted: <span className="text-stone-800 font-bold">{seedRecord.germinated_count}</span></div>
                     <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div> Planted: <span className="text-stone-800 font-bold">{seedRecord.planted_count}</span></div>
                   </div>
                 </div>
               );
             })}
           </div>
         </section>

         {tray.images && tray.images.length > 0 && (
           <section>
             <h3 className="font-bold text-stone-800 px-1 pt-2 mb-3">Gallery</h3>
             <div className="grid grid-cols-3 gap-2">
               {tray.images.map((img: string, idx: number) => {
                  const displaySrc = img.startsWith('data:image') || img.startsWith('http') ? img : signedUrls[img] || '';
                  return (
                    <div key={idx} onClick={() => setFullScreenImage(displaySrc)} className="cursor-zoom-in aspect-square rounded-xl overflow-hidden border border-stone-200 shadow-sm relative bg-stone-100">
                      {displaySrc && <img src={displaySrc} className="w-full h-full object-cover" alt="Gallery" />}
                    </div>
                  );
               })}
             </div>
           </section>
         )}
      </div>
    </main>
  );
}