import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { SeedlingTray, InventorySeed } from '../types';

export default function TrayDetail({ tray, inventory, navigateTo, handleGoBack }: any) {
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [isDuplicating, setIsDuplicating] = useState(false);

  // Resolve Signed URLs for the tray's own gallery images
  useEffect(() => {
    const loadUrls = async () => {
      if (!tray || !tray.images || tray.images.length === 0) return;
      const newUrls: Record<string, string> = { ...signedUrls };
      let changed = false;
      for (const img of tray.images) {
        if (!img.startsWith('data:image') && !img.startsWith('http') && !newUrls[img]) {
          const { data } = await supabase.storage.from('talawa_media').createSignedUrl(img, 3600);
          if (data) { newUrls[img] = data.signedUrl; changed = true; }
        }
      }
      if (changed) setSignedUrls(newUrls);
    };
    loadUrls();
  }, [tray]);

  const totalSown = tray.contents.reduce((sum: number, item: any) => sum + (item.sown_count || 0), 0);
  const totalGerminated = tray.contents.reduce((sum: number, item: any) => sum + (item.germinated_count || 0), 0);
  const germRate = totalSown > 0 ? Math.round((totalGerminated / totalSown) * 100) : 0;

  const handleDuplicateTray = () => {
    setIsDuplicating(true);
    const duplicatedTray: SeedlingTray = {
      ...tray,
      id: undefined,
      name: `${tray.name} (Copy)`,
      sown_date: new Date().toISOString().split('T')[0],
      first_germination_date: "",
      first_planted_date: "",
      images: [],
      thumbnail: "",
      contents: tray.contents.map((item: any) => ({ ...item, sown_count: 0, germinated_count: 0, planted_count: 0, germination_date: "" }))
    };
    navigateTo('tray_edit', duplicatedTray);
    setIsDuplicating(false);
  };

  const handleSeedClick = (seedId: string) => {
    const fullSeed = inventory?.find((s: InventorySeed) => s.id === seedId);
    if (fullSeed) {
      // Pass returnTo context so SeedDetail knows how to come back here
      navigateTo('seed_detail', { ...fullSeed, returnTo: 'tray_detail', returnPayload: tray });
    } else {
      navigateTo('seed_detail', { id: seedId, returnTo: 'tray_detail', returnPayload: tray });
    }
  };

  /**
   * FIX: Return explicitly to 'trays' list view instead of using generic back button logic.
   * This prevents being stuck in a navigation loop if the user came here from Seed Detail.
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
           <button onClick={handleDuplicateTray} disabled={isDuplicating} className="p-2 bg-emerald-900 rounded-full hover:bg-emerald-700 transition-colors flex items-center gap-1 px-3 disabled:opacity-50 text-sm">
             Copy
           </button>
           <button onClick={() => navigateTo('tray_edit', tray)} className="p-2 bg-emerald-900 rounded-full hover:bg-emerald-700 transition-colors flex items-center gap-1 px-3 text-sm">
             Edit
           </button>
        </div>
      </header>

      <div className="max-w-md mx-auto p-4 space-y-5">
         <section className="bg-white p-5 rounded-2xl shadow-sm border border-stone-200">
            <div className="flex justify-between items-start mb-3">
               <h2 className="text-2xl font-bold text-stone-800 leading-tight">{tray.name}</h2>
               <div className="flex gap-1.5 flex-shrink-0">
                 {tray.heat_mat && <span className="bg-amber-100 text-amber-800 p-1.5 rounded-lg flex items-center justify-center" title="Heat Mat Used"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" /></svg></span>}
                 {tray.humidity_dome && <span className="bg-blue-100 text-blue-800 p-1.5 rounded-lg flex items-center justify-center" title="Humidity Dome Used"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15h18M5 15v4a2 2 0 002 2h10a2 2 0 002-2v-4M12 15V3m0 0l-4 4m4-4l4 4" /></svg></span>}
                 {tray.grow_light && <span className="bg-yellow-100 text-yellow-800 p-1.5 rounded-lg flex items-center justify-center" title="Grow Light Used"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg></span>}
               </div>
            </div>
            
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="bg-stone-100 text-stone-600 text-xs font-bold px-2 py-1 rounded border border-stone-200">{tray.location || 'Unknown Location'}</span>
              <span className="bg-stone-100 text-stone-600 text-xs font-bold px-2 py-1 rounded border border-stone-200">{tray.tray_type || 'Unknown flat'}</span>
            </div>
            
            <div className="grid grid-cols-3 gap-2 bg-stone-50 rounded-xl p-3 border border-stone-200 mb-4 text-center">
               <div><div className="text-[10px] text-stone-500 font-bold uppercase mb-0.5">Sown</div><div className="text-sm font-bold text-stone-800">{tray.sown_date || '--'}</div></div>
               <div className="border-l border-stone-200">
                 <div className="text-[10px] text-stone-500 font-bold uppercase mb-0.5">Sprout</div>
                 <div className="text-sm font-bold text-emerald-600">{tray.first_germination_date || '--'}</div>
               </div>
               <div className="border-l border-stone-200">
                 <div className="text-[10px] text-stone-500 font-bold uppercase mb-0.5">Planted</div>
                 <div className="text-sm font-bold text-blue-600">{tray.first_planted_date || '--'}</div>
               </div>
            </div>

            <div className="grid grid-cols-3 gap-2 bg-emerald-50 rounded-xl p-3 border border-emerald-100 mb-4 text-center">
               <div><div className="text-xs text-emerald-600 font-bold uppercase mb-0.5">Sown</div><div className="text-xl font-black text-emerald-900">{totalSown}</div></div>
               <div className="border-l border-emerald-200"><div className="text-xs text-emerald-600 font-bold uppercase mb-0.5">Sprouted</div><div className="text-xl font-black text-emerald-900">{totalGerminated}</div></div>
               <div className="border-l border-emerald-200"><div className="text-xs text-emerald-600 font-bold uppercase mb-0.5">Rate</div><div className="text-xl font-black text-emerald-900">{germRate}%</div></div>
            </div>

            {tray.potting_mix && <div className="mb-4"><div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">Potting Mix</div><div className="text-sm text-stone-800 font-medium">{tray.potting_mix}</div></div>}
            {tray.notes && <p className="text-sm text-stone-600 bg-stone-50 p-3 rounded-lg border border-stone-100">{tray.notes}</p>}
         </section>

         <h3 className="font-bold text-stone-800 px-1">Tray Contents</h3>
         <div className="space-y-3">
           {tray.contents.map((seedRecord: any, idx: number) => {
             const fullSeed = inventory?.find((s: InventorySeed) => s.id === seedRecord.seed_id);
             return (
               <div key={idx} onClick={() => handleSeedClick(seedRecord.seed_id)} className="bg-white p-4 rounded-xl shadow-sm border border-stone-200 cursor-pointer hover:border-emerald-400 transition-all active:scale-95 group">
                 <div className="flex justify-between items-start mb-3 border-b border-stone-100 pb-3">
                   <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-stone-100 border border-stone-200 overflow-hidden flex-shrink-0">
                        {fullSeed?.thumbnail ? <img src={fullSeed.thumbnail} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-stone-300"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" /></svg></div>}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-stone-800 leading-tight group-hover:text-emerald-700 transition-colors truncate">{seedRecord.variety_name}</h4>
                        <span className="text-[10px] font-mono bg-stone-100 px-1.5 py-0.5 rounded text-stone-600 border border-stone-200 mt-1 inline-block">{seedRecord.seed_id}</span>
                      </div>
                   </div>
                   <div className="text-right flex items-center gap-1">
                     <span className="text-xs font-bold text-emerald-600">{seedRecord.sown_count > 0 ? Math.round((seedRecord.germinated_count / seedRecord.sown_count) * 100) : 0}%</span>
                     <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                   </div>
                 </div>
                 <div className="flex justify-between text-xs px-1 text-stone-500 font-medium">
                   <div>Sown: <span className="text-stone-800 font-bold">{seedRecord.sown_count}</span></div>
                   <div>Sprouted: <span className="text-stone-800 font-bold">{seedRecord.germinated_count}</span></div>
                   <div>Planted: <span className="text-stone-800 font-bold">{seedRecord.planted_count}</span></div>
                 </div>
               </div>
             );
           })}
         </div>

         {tray.images && tray.images.length > 0 && (
           <div className="grid grid-cols-3 gap-2 pt-2">
             {tray.images.map((img: string, idx: number) => {
                const displaySrc = img.startsWith('data:image') || img.startsWith('http') ? img : signedUrls[img] || '';
                return (
                  <div key={idx} onClick={() => setFullScreenImage(displaySrc)} className="cursor-zoom-in aspect-square rounded-xl overflow-hidden border border-stone-200 shadow-sm relative bg-stone-100">
                    {displaySrc && <img src={displaySrc} className="w-full h-full object-cover" alt="Gallery" />}
                  </div>
                );
             })}
           </div>
         )}
      </div>
    </main>
  );
}