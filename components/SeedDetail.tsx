import React, { useState, useEffect } from 'react';

// Mocking types and Supabase/Utils for isolated Canvas preview
interface InventorySeed {
  id: string;
  category: string;
  variety_name: string;
  species?: string;
  vendor?: string;
  days_to_maturity?: number | string;
  plant_spacing?: string;
  out_of_stock?: boolean;
  thumbnail?: string;
  images?: string[];
  primaryImageIndex?: number;
  companion_plants?: string[];
  scoville_rating?: number | string;
  tomato_type?: string;
  sunlight?: string;
  lifecycle?: string;
  seed_depth?: string;
  germination_days?: string;
  light_required?: boolean;
  cold_stratification?: boolean;
  stratification_days?: number | string;
  notes?: string;
  returnTo?: string;
  returnPayload?: any;
}

interface SeedlingTray {
  id: string;
  name: string;
  sown_date: string;
  contents: { seed_id: string; sown_count: number; germinated_count: number }[];
}

export default function SeedDetail({ seed: initialSeed, trays = [], categories = [], navigateTo = () => {}, handleGoBack = () => {} }: any) {
  // Use mock seed data if none is provided via props
  const defaultSeed: InventorySeed = initialSeed || {
    id: "TOM-01",
    variety_name: "Cherokee Purple",
    category: "Tomato",
    species: "Solanum lycopersicum",
    tomato_type: "Indeterminate",
    vendor: "Baker Creek",
    days_to_maturity: 80,
    sunlight: "Full Sun",
    lifecycle: "Annual",
    seed_depth: "1/4 inch",
    plant_spacing: "24-36 inches",
    germination_days: "7-14 days",
    images: ["https://images.unsplash.com/photo-1592841200221-a6898f307baa?auto=format&fit=crop&q=80&w=1600"],
    primaryImageIndex: 0,
    out_of_stock: false,
    notes: "Requires heavy staking or trellising. Very prone to cracking if watering is inconsistent."
  };

  const [fullSeed, setFullSeed] = useState<InventorySeed | null>(defaultSeed);
  const [isLoading, setIsLoading] = useState(false);
  const [viewingImageIndex, setViewingImageIndex] = useState(defaultSeed.primaryImageIndex || 0);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  const handleDuplicateSeed = async () => {
    if (!fullSeed) return;
    setIsDuplicating(true);
    try {
      // Mocked duplication logic
      setTimeout(() => {
        alert("In your full app, this would duplicate the seed to the editor.");
        setIsDuplicating(false); 
      }, 500);
    } catch (error: any) { 
      alert("Failed to duplicate seed: " + error.message); 
      setIsDuplicating(false);
    }
  };

  const onBack = () => {
    if (fullSeed?.returnTo) {
      navigateTo(fullSeed.returnTo, fullSeed.returnPayload);
    } else {
      navigateTo('vault');
    }
  };

  const onEdit = () => {
    navigateTo('seed_edit', { 
      ...fullSeed, 
      returnTo: fullSeed?.returnTo, 
      returnPayload: fullSeed?.returnPayload 
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

  // Determine Badge States
  const isTomato = fullSeed.category?.toLowerCase().includes('tomato');
  const isPepper = fullSeed.category?.toLowerCase().includes('pepper');
  const shu = fullSeed.scoville_rating !== undefined && fullSeed.scoville_rating !== null ? Number(fullSeed.scoville_rating) : null;
  
  let spiceColor = "bg-stone-500/20 text-stone-200 border-stone-500/50";
  let spiceLabel = "SHU ?";
  if (shu !== null && !isNaN(shu)) {
    if (shu === 0) { spiceColor = "bg-stone-500/50 text-stone-100 border-stone-400/50"; spiceLabel = "Sweet"; }
    else if (shu < 2500) { spiceColor = "bg-green-500/60 text-green-50 border-green-400/50"; spiceLabel = "Mild"; }
    else if (shu < 30000) { spiceColor = "bg-amber-500/60 text-amber-50 border-amber-400/50"; spiceLabel = "Medium"; }
    else if (shu < 100000) { spiceColor = "bg-orange-500/60 text-orange-50 border-orange-400/50"; spiceLabel = "Hot"; }
    else if (shu < 300000) { spiceColor = "bg-red-500/60 text-red-50 border-red-400/50"; spiceLabel = "X-Hot"; }
    else { spiceColor = "bg-red-900/80 text-red-50 border-red-500/50"; spiceLabel = "Superhot"; }
  }

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
           <button onClick={handleDuplicateSeed} disabled={isDuplicating} className="bg-emerald-800 hover:bg-emerald-600 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border border-emerald-600 shadow-sm flex items-center gap-1.5 disabled:opacity-50">
             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
             {isDuplicating ? 'Copying...' : 'Copy'}
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
          <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-stone-900/95 via-stone-900/70 to-transparent p-4 pt-16">
            <div className="bg-emerald-500 text-white text-xs font-bold px-2 py-1 rounded inline-block mb-2 shadow-sm">{fullSeed.id}</div>
            <h2 className="text-2xl font-bold text-white leading-tight shadow-black">{fullSeed.variety_name}</h2>
            <div className="flex flex-col gap-2 mt-1">
              <p className="text-emerald-300 text-sm font-medium uppercase tracking-wider">{fullSeed.category} <span className="text-stone-300/80 font-normal italic lowercase">({fullSeed.species})</span></p>
              
              {/* Dynamic Badges Overlay */}
              {(isTomato || isPepper) && (
                <div className="flex flex-wrap gap-2 mt-0.5">
                   {isTomato && fullSeed.tomato_type && (
                      <span className="font-bold flex items-center gap-1.5 px-2.5 py-1 rounded-md border bg-rose-500/80 text-white border-rose-400/50 text-[10px] uppercase tracking-wider shadow-sm backdrop-blur-md">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 21a7 7 0 100-14 7 7 0 000 14z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 7v3m-2-2.5a2.5 2.5 0 014 0" /></svg>
                        {fullSeed.tomato_type}
                      </span>
                   )}
                   {isPepper && shu !== null && !isNaN(shu) && (
                      <span className={`font-bold flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[10px] uppercase tracking-wider shadow-sm backdrop-blur-md ${spiceColor}`}>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" /></svg>
                        {spiceLabel} ({shu.toLocaleString()} SHU)
                      </span>
                   )}
                </div>
              )}
            </div>
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
                  <span className="text-stone-800 font-bold text-sm">{fullSeed.days_to_maturity || '--'} Days</span>
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