import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { SeedlingTray, InventorySeed } from '../types';

export default function TrayDetail({ tray, inventory, navigateTo, handleGoBack }: any) {
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [isDuplicating, setIsDuplicating] = useState(false);

  // Resolve Signed URLs for private bucket images in the tray
  useEffect(() => {
    const loadUrls = async () => {
      if (!tray || !tray.images) return;
      
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

  const handleDuplicateTray = () => {
    setIsDuplicating(true);
    
    // Create a copy but strip out the unique ID, Images, and reset dates/counts
    const duplicatedContents = tray.contents.map((item: any) => ({
      ...item,
      sown_count: 0,
      germinated_count: 0,
      planted_count: 0,
      germination_date: ""
    }));

    const duplicatedTray: SeedlingTray = {
      ...tray,
      id: undefined, // New trays don't have an ID yet
      name: `${tray.name} (Copy)`,
      sown_date: new Date().toISOString().split('T')[0],
      first_germination_date: "",
      first_planted_date: "",
      images: [],
      thumbnail: "",
      contents: duplicatedContents
    };

    // Navigate straight to the edit screen with the pre-filled copied data
    navigateTo('tray_edit', duplicatedTray);
    setIsDuplicating(false);
  };

  const handleSeedClick = (seedId: string) => {
    // Find the full seed object from the global inventory to pass to the detail view
    const fullSeed = inventory?.find((s: InventorySeed) => s.id === seedId);
    if (fullSeed) {
      navigateTo('seed_detail', fullSeed);
    } else {
      alert("Seed details not found in current inventory.");
    }
  };

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900 pb-20">
      {fullScreenImage && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-2 cursor-zoom-out" onClick={() => setFullScreenImage(null)}>
          <button className="absolute top-4 right-4 text-white bg-white/10 p-2 rounded-full hover:bg-white/20 transition-colors z-10"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
          <img src={fullScreenImage} alt="Full screen view" className="max-w-full max-h-full object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      <header className="bg-emerald-800 text-white p-4 shadow-md sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => handleGoBack('trays')} className="p-2 bg-emerald-900 rounded-full hover:bg-emerald-700 transition-colors"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
          <h1 className="text-xl font-bold truncate">Tray Details</h1>
        </div>
        <div className="flex items-center gap-2">
           <button onClick={handleDuplicateTray} disabled={isDuplicating} className="p-2 bg-emerald-900 rounded-full hover:bg-emerald-700 transition-colors flex items-center gap-1 px-3 disabled:opacity-50">
             {isDuplicating ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
             ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
             )}
             <span className="text-sm font-medium">Copy</span>
           </button>
           <button onClick={() => navigateTo('tray_edit', tray)} className="p-2 bg-emerald-900 rounded-full hover:bg-emerald-700 transition-colors flex items-center gap-1 px-3">
             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
             <span className="text-sm font-medium">Edit</span>
           </button>
        </div>
      </header>

      <div className="max-w-md mx-auto p-4 space-y-5">
         <div className="bg-white p-5 rounded-2xl shadow-sm border border-stone-200">
            <div className="flex justify-between items-start mb-3">
               <h2 className="text-2xl font-bold text-stone-800 leading-tight">{tray.name}</h2>
               <div className="flex gap-1.5">
                 {tray.heat_mat && <span className="bg-amber-100 text-amber-800 p-1.5 rounded-lg flex items-center justify-center" title="Heat Mat Used"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" /></svg></span>}
                 {tray.humidity_dome && <span className="bg-blue-100 text-blue-800 p-1.5 rounded-lg flex items-center justify-center" title="Humidity Dome Used"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15h18M5 15v4a2 2 0 002 2h10a2 2 0 002-2v-4M12 15V3m0 0l-4 4m4-4l4 4" /></svg></span>}
                 {tray.grow_light && <span className="bg-yellow-100 text-yellow-800 p-1.5 rounded-lg flex items-center justify-center" title="Grow Light Used"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg></span>}
               </div>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="bg-stone-100 text-stone-600 text-xs font-bold px-2 py-1 rounded border border-stone-200">{tray.location || 'Unknown Location'}</span>
              <span className="bg-stone-100 text-stone-600 text-xs font-bold px-2 py-1 rounded border border-stone-200">{tray.tray_type || 'Unknown flat'}</span>
            </div>
            
            <div className="grid grid-cols-3 gap-2 mb-4 bg-stone-50 rounded-xl p-3 border border-stone-200">
               <div className="text-center"><div className="text-[10px] text-stone-500 font-bold uppercase mb-0.5">Sown</div><div className="text-sm font-bold text-stone-800">{tray.sown_date || '--'}</div></div>
               <div className="text-center border-l border-stone-200"><div className="text-[10px] text-stone-500 font-bold uppercase mb-0.5">1st Sprout</div><div className="text-sm font-bold text-stone-800">{tray.first_germination_date || '--'}</div></div>
               <div className="text-center border-l border-stone-200"><div className="text-[10px] text-stone-500 font-bold uppercase mb-0.5">Planted</div><div className="text-sm font-bold text-stone-800">{tray.first_planted_date || '--'}</div></div>
            </div>

            <div className="grid grid-cols-3 gap-2 bg-emerald-50 rounded-xl p-3 border border-emerald-100 mb-4">
               <div className="text-center"><div className="text-xs text-emerald-600 font-bold uppercase mb-0.5">Sown</div><div className="text-xl font-black text-emerald-900">{totalSown}</div></div>
               <div className="text-center border-l border-emerald-200"><div className="text-xs text-emerald-600 font-bold uppercase mb-0.5">Sprouted</div><div className="text-xl font-black text-emerald-900">{totalGerminated}</div></div>
               <div className="text-center border-l border-emerald-200"><div className="text-xs text-emerald-600 font-bold uppercase mb-0.5">Rate</div><div className="text-xl font-black text-emerald-900">{germRate}%</div></div>
            </div>

            {tray.potting_mix && <div className="mb-4"><div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">Potting Mix</div><div className="text-sm text-stone-800 font-medium">{tray.potting_mix}</div></div>}
            {tray.notes && <p className="text-sm text-stone-600 bg-stone-50 p-3 rounded-lg border border-stone-100">{tray.notes}</p>}
         </div>

         <h3 className="font-bold text-stone-800 px-1">Contents</h3>
         <div className="space-y-3">
           {tray.contents.map((seedRecord: any, idx: number) => {
             // Look up the full seed in inventory to get its thumbnail
             const fullSeed = inventory?.find((s: InventorySeed) => s.id === seedRecord.seed_id);
             const thumb = fullSeed?.thumbnail || null;

             return (
               <div 
                 key={idx} 
                 onClick={() => handleSeedClick(seedRecord.seed_id)}
                 className="bg-white p-4 rounded-xl shadow-sm border border-stone-200 cursor-pointer hover:border-emerald-400 hover:shadow-md transition-all active:scale-95"
               >
                 <div className="flex justify-between items-start mb-3 border-b border-stone-100 pb-3">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-stone-100 overflow-hidden flex-shrink-0 border border-stone-200">
                        {thumb ? (
                          <img src={thumb} alt={seedRecord.variety_name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-stone-300">
                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          </div>
                        )}
                      </div>
                      <div>
                        <h4 className="font-bold text-stone-800 leading-tight">{seedRecord.variety_name}</h4>
                        <span className="text-[10px] font-mono bg-stone-100 px-1.5 py-0.5 rounded text-stone-600 border border-stone-200 mt-1 inline-block">{seedRecord.seed_id}</span>
                      </div>
                   </div>
                   <div className="text-right">
                     <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100 flex items-center gap-1">
                       {seedRecord.sown_count > 0 ? Math.round((seedRecord.germinated_count / seedRecord.sown_count) * 100) : 0}% Germ
                       <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                     </span>
                   </div>
                 </div>
                 <div className="flex justify-between text-sm px-1">
                   <div className="flex items-center gap-1.5 text-stone-600"><div className="w-2 h-2 rounded-full bg-stone-400"></div> Sown: <span className="font-bold text-stone-900">{seedRecord.sown_count}</span></div>
                   <div className="flex items-center gap-1.5 text-stone-600"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Sprouted: <span className="font-bold text-stone-900">{seedRecord.germinated_count}</span></div>
                   <div className="flex items-center gap-1.5 text-stone-600"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Planted: <span className="font-bold text-stone-900">{seedRecord.planted_count}</span></div>
                 </div>
               </div>
             );
           })}
         </div>

         {tray.images && tray.images.length > 0 && (
           <>
             <h3 className="font-bold text-stone-800 px-1 pt-2">Gallery</h3>
             <div className="grid grid-cols-3 gap-2">
               {tray.images.map((img: string, idx: number) => {
                  const displaySrc = img.startsWith('data:image') || img.startsWith('http') ? img : signedUrls[img] || '';
                  return (
                    <div key={idx} onClick={() => setFullScreenImage(displaySrc)} className="cursor-zoom-in aspect-square rounded-xl overflow-hidden border border-stone-200 shadow-sm relative bg-stone-100">
                      {displaySrc ? (
                        <img src={displaySrc} className="w-full h-full object-cover" alt="Tray Progress" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center"><svg className="w-5 h-5 text-stone-400 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>
                      )}
                    </div>
                  );
               })}
             </div>
           </>
         )}
      </div>
    </main>
  );
}