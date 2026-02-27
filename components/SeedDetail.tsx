import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { InventorySeed, SeedlingTray } from '../types';

export default function SeedDetail({ seed, trays, navigateTo, handleGoBack }: any) {
  const [fullSeed, setFullSeed] = useState<InventorySeed | null>(seed.images ? seed : null);
  const [isLoading, setIsLoading] = useState(!seed.images);
  const [viewingImageIndex, setViewingImageIndex] = useState(seed.primaryImageIndex || 0);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);

  useEffect(() => {
    const fetchFullDetails = async () => {
      if (!seed.images) {
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
  }, [seed.id, seed.images]);

  if (isLoading || !fullSeed) {
    return (
      <main className="min-h-screen bg-stone-50 flex items-center justify-center">
         <div className="text-emerald-600 flex flex-col items-center">
            <svg className="w-10 h-10 animate-spin mb-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            <p className="font-bold text-stone-500">Fetching botanical data...</p>
         </div>
      </main>
    );
  }

  const displayImg = (fullSeed.images && fullSeed.images.length > 0) ? fullSeed.images[viewingImageIndex] : null;
  const seedHistory = trays.filter((t: SeedlingTray) => t.contents.some(c => c.seed_id === fullSeed.id));

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900 pb-20">
      {fullScreenImage && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-2 cursor-zoom-out" onClick={() => setFullScreenImage(null)}>
          <button className="absolute top-4 right-4 text-white bg-white/10 p-2 rounded-full hover:bg-white/20 transition-colors z-10"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
          <img src={fullScreenImage} alt="Full screen view" className="max-w-full max-h-full object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      <header className="bg-emerald-700 text-white p-4 shadow-md sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => { setFullScreenImage(null); handleGoBack('vault'); }} className="p-2 bg-emerald-800 rounded-full hover:bg-emerald-600 transition-colors"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
          <h1 className="text-xl font-bold truncate">Seed Details</h1>
        </div>
        <button onClick={() => navigateTo('seed_edit', fullSeed)} className="p-2 bg-emerald-800 rounded-full hover:bg-emerald-600 transition-colors flex items-center gap-1 px-3">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
          <span className="text-sm font-medium">Edit</span>
        </button>
      </header>

      <div className="max-w-md mx-auto">
        <div className="w-full aspect-[4/3] bg-stone-200 relative">
          {displayImg ? (
            <img src={displayImg} alt={fullSeed.variety_name} className="w-full h-full object-cover cursor-zoom-in" onClick={() => setFullScreenImage(displayImg)} />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-stone-400"><svg className="w-12 h-12 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg><span>No primary image</span></div>
          )}
          <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-stone-900/80 to-transparent p-4 pt-12 pointer-events-none">
            <div className="flex gap-2 mb-1">
              <div className="bg-emerald-500 text-white text-xs font-bold px-2 py-1 rounded shadow-sm">{fullSeed.id}</div>
              {fullSeed.out_of_stock && <div className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded shadow-sm">OUT OF STOCK</div>}
            </div>
            <h2 className="text-2xl font-bold text-white leading-tight">{fullSeed.variety_name}</h2>
            <p className="text-emerald-300 text-sm font-medium">{fullSeed.category} <span className="text-stone-300 font-normal italic">({fullSeed.species})</span></p>
          </div>
        </div>

        {(fullSeed.images && fullSeed.images.length > 1) && (
          <div className="p-4 bg-white border-b border-stone-200 flex gap-2 overflow-x-auto scrollbar-hide">
            {fullSeed.images.map((img: string, idx: number) => (
              <div key={idx} onClick={() => setViewingImageIndex(idx)} className={`flex-shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 cursor-pointer transition-all ${idx === viewingImageIndex ? 'border-emerald-500 opacity-100 shadow-md' : 'border-transparent opacity-60 hover:opacity-100'}`}>
                <img src={img} className="w-full h-full object-cover" alt="Thumbnail" />
              </div>
            ))}
          </div>
        )}

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white p-3.5 rounded-xl shadow-sm border border-stone-100"><div className="text-stone-400 text-[10px] font-bold uppercase tracking-wider mb-1">Maturity</div><div className="text-stone-800 font-bold">{fullSeed.days_to_maturity} Days</div></div>
            <div className="bg-white p-3.5 rounded-xl shadow-sm border border-stone-100"><div className="text-stone-400 text-[10px] font-bold uppercase tracking-wider mb-1">Sunlight</div><div className="text-stone-800 font-bold truncate">{fullSeed.sunlight || '--'}</div></div>
            <div className="bg-white p-3.5 rounded-xl shadow-sm border border-stone-100"><div className="text-stone-400 text-[10px] font-bold uppercase tracking-wider mb-1">Life Cycle</div><div className="text-stone-800 font-bold truncate">{fullSeed.lifecycle || '--'}</div></div>
            <div className="bg-white p-3.5 rounded-xl shadow-sm border border-stone-100"><div className="text-stone-400 text-[10px] font-bold uppercase tracking-wider mb-1">Vendor</div><div className="text-stone-800 font-bold truncate">{fullSeed.vendor || '--'}</div></div>
          </div>

          {seedHistory.length > 0 && (
            <div className="bg-white p-4 rounded-xl shadow-sm border border-emerald-100 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
              <h3 className="text-sm font-bold text-emerald-800 mb-3 flex items-center gap-2"><svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>Germination History</h3>
              <div className="space-y-3">
                {seedHistory.map((tray: SeedlingTray) => {
                   const seedData = tray.contents.find(c => c.seed_id === fullSeed.id);
                   if (!seedData) return null;
                   const rate = seedData.sown_count > 0 ? Math.round((seedData.germinated_count / seedData.sown_count) * 100) : 0;
                   return (
                     <div key={tray.id} className="bg-stone-50 rounded-lg p-2.5 border border-stone-200 text-sm flex justify-between items-center cursor-pointer hover:bg-stone-100" onClick={() => navigateTo('tray_detail', tray)}>
                       <div className="min-w-0 flex-1 pr-2"><div className="font-bold text-stone-800 truncate leading-tight">{tray.name}</div><div className="text-[10px] text-stone-500">{tray.sown_date}</div></div>
                       <div className="flex flex-col items-end text-right flex-shrink-0"><div className="font-bold text-emerald-700">{rate}% Rate</div><div className="text-[10px] text-stone-600 font-medium">({seedData.germinated_count}/{seedData.sown_count} seeds)</div></div>
                     </div>
                   );
                })}
              </div>
            </div>
          )}

          <div className="bg-white p-4 rounded-xl shadow-sm border border-stone-100">
            <h3 className="text-sm font-bold text-stone-800 mb-3 flex items-center gap-2"><svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>Planting Requirements</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between border-b border-stone-50 pb-2"><span className="text-stone-500">Seed Depth</span><span className="font-medium text-stone-800">{fullSeed.seed_depth || '--'}</span></div>
              <div className="flex justify-between border-b border-stone-50 pb-2"><span className="text-stone-500">Plant Spacing</span><span className="font-medium text-stone-800">{fullSeed.plant_spacing || '--'}</span></div>
              <div className="flex justify-between border-b border-stone-50 pb-2"><span className="text-stone-500">Row Spacing</span><span className="font-medium text-stone-800">{fullSeed.row_spacing || '--'}</span></div>
              <div className="flex justify-between border-b border-stone-50 pb-2"><span className="text-stone-500">Germination Time</span><span className="font-medium text-stone-800">{fullSeed.germination_days || '--'}</span></div>
              {(fullSeed.light_required || fullSeed.cold_stratification) && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {fullSeed.light_required && <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-1 rounded">Needs Light to Germinate</span>}
                  {fullSeed.cold_stratification && <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">Cold Stratification ({fullSeed.stratification_days} days)</span>}
                </div>
              )}
            </div>
          </div>

          {fullSeed.companion_plants && fullSeed.companion_plants.length > 0 && (
            <div className="bg-emerald-50 p-4 rounded-xl shadow-sm border border-emerald-100">
              <h3 className="text-sm font-bold text-emerald-800 mb-2 flex items-center gap-2"><svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>Companion Plants</h3>
              <div className="flex flex-wrap gap-1.5">
                {fullSeed.companion_plants.map((comp: string) => <span key={comp} className="bg-white border border-emerald-200 text-emerald-700 text-xs font-medium px-2.5 py-1 rounded-full">{comp}</span>)}
              </div>
            </div>
          )}

          {fullSeed.notes && (
            <div className="bg-white p-5 rounded-xl shadow-sm border border-stone-100">
              <h3 className="text-stone-800 font-bold mb-2 flex items-center gap-2"><svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>Growing Notes</h3>
              <p className="text-stone-600 text-sm leading-relaxed whitespace-pre-wrap">{fullSeed.notes}</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}