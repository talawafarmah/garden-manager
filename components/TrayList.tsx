import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { SeedlingTray, AppView, InventorySeed } from '../types';

interface TrayListProps {
  trays: SeedlingTray[];
  inventory: InventorySeed[];
  isLoadingDB: boolean;
  navigateTo: (view: AppView, payload?: any, replace?: boolean) => void;
  handleGoBack: (view: AppView) => void;
  userRole?: string;
}

export default function TrayList({ trays, inventory, isLoadingDB, navigateTo, handleGoBack, userRole }: TrayListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let isMounted = true;

    const loadThumbnailUrls = async () => {
      try {
        const urlsToFetch = trays
          .map(t => (t.images || [])[0])
          .filter(img => img && typeof img === 'string' && !img.startsWith('data:') && !img.startsWith('http'));

        if (urlsToFetch.length === 0) return;

        const uniqueUrls = Array.from(new Set(urlsToFetch));
        const fetchedUrls: Record<string, string> = {};
        const { data, error } = await supabase.storage.from('talawa_media').createSignedUrls(uniqueUrls, 3600);

        if (data && !error) {
          data.forEach((item: any) => {
            if (item.signedUrl) fetchedUrls[item.path] = item.signedUrl;
          });
        }

        if (isMounted && Object.keys(fetchedUrls).length > 0) {
          setSignedUrls(prev => ({ ...prev, ...fetchedUrls }));
        }
      } catch (err) {
        console.error("Error fetching tray thumbnails:", err);
      }
    };

    if (trays.length > 0) {
      loadThumbnailUrls();
    }

    return () => { isMounted = false; };
  }, [trays]);

  const filteredTrays = trays.filter(tray => {
    const q = searchQuery.toLowerCase();
    const seedIds = (tray.contents || []).map(c => c.seed_id).filter(Boolean);
    const seedNames = seedIds.map(id => inventory.find((s: InventorySeed) => s.id === id)?.variety_name?.toLowerCase() || "");
    
    return (
      tray.id.toLowerCase().includes(q) || 
      (tray.name && tray.name.toLowerCase().includes(q)) ||
      (tray.location && tray.location.toLowerCase().includes(q)) ||
      seedNames.some(name => name.includes(q))
    );
  });

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900 pb-20 font-sans">
      
      <header className="bg-emerald-700 text-white p-4 shadow-md sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => handleGoBack('dashboard')} className="p-2 bg-emerald-800 rounded-full hover:bg-emerald-600 transition-colors" title="Go Back">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button onClick={() => navigateTo('dashboard')} className="p-2 bg-emerald-800 rounded-full hover:bg-emerald-600 transition-colors" title="Dashboard">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </button>
        </div>

        <h1 className="text-xl font-bold truncate">Nursery Trays</h1>
        
        <div className="flex justify-end min-w-[80px]">
          {userRole === 'admin' && (
            <button 
              onClick={() => navigateTo('tray_edit')} 
              className="p-2 bg-emerald-800 rounded-full hover:bg-emerald-600 transition-colors shadow-sm" 
              title="New Tray"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          )}
        </div>
      </header>

      <div className="max-w-md mx-auto p-4 space-y-4">
        <div className="relative">
          <input 
            type="text" 
            placeholder="Search by Tray, Seed Name, or Location..." 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            className="w-full bg-white border border-stone-200 rounded-xl py-3 pl-10 pr-4 shadow-sm focus:border-emerald-500 outline-none transition-colors" 
          />
          <svg className="w-5 h-5 text-stone-400 absolute left-3 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>

        <div className="space-y-3">
          {isLoadingDB ? (
            <div className="flex justify-center items-center py-10 text-emerald-600">
               <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            </div>
          ) : filteredTrays.length > 0 ? (
            filteredTrays.map((tray) => {
              const firstImage = (tray.images || [])[0];
              const displayImg = firstImage 
                ? (firstImage.startsWith('http') || firstImage.startsWith('data:') ? firstImage : signedUrls[firstImage])
                : null;

              // Extract unique seeds planted in this tray and map them to their names
              const uniqueSeedIds = Array.from(new Set((tray.contents || []).map(c => c.seed_id).filter(Boolean)));
              const seedNames = uniqueSeedIds.map(id => {
                 const seed = inventory.find((s: InventorySeed) => s.id === id);
                 return seed ? seed.variety_name : id;
              });
              const seedsDisplay = seedNames.length > 0 ? seedNames.join(', ') : 'Empty Tray (No seeds planted)';

              // Calculate Estimated Germination Range from the seeds
              let minGerm = 999;
              let maxGerm = 0;
              uniqueSeedIds.forEach(id => {
                 const s = inventory.find((i: InventorySeed) => i.id === id);
                 if (s && s.germination_days) {
                    const nums = s.germination_days.match(/\d+/g);
                    if (nums) {
                       nums.forEach(n => {
                          const val = parseInt(n, 10);
                          if (val < minGerm) minGerm = val;
                          if (val > maxGerm) maxGerm = val;
                       });
                    }
                 }
              });
              let germText = "Unknown";
              if (minGerm !== 999 && maxGerm !== 0) {
                 germText = minGerm === maxGerm ? `${minGerm} days` : `${minGerm}-${maxGerm} days`;
              }

              return (
                <div 
                  key={tray.id} 
                  onClick={() => navigateTo('tray_detail', tray)} 
                  className="bg-white p-3 rounded-xl border border-stone-200 shadow-sm flex gap-4 hover:border-emerald-400 hover:shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  {/* Thumbnail */}
                  <div className="w-20 h-20 rounded-lg bg-stone-100 overflow-hidden flex-shrink-0 border border-stone-200 relative">
                    {displayImg ? (
                      <img src={displayImg} alt="Tray" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-stone-300">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      </div>
                    )}
                    
                    {/* Status Icons Overlay */}
                    <div className="absolute bottom-1 right-1 flex gap-1">
                      {tray.humidity_dome && <span className="bg-blue-500/90 text-white p-0.5 rounded shadow-sm backdrop-blur-sm" title="Humidity Dome On"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg></span>}
                      {tray.grow_light && <span className="bg-amber-500/90 text-white p-0.5 rounded shadow-sm backdrop-blur-sm" title="Grow Lights On"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg></span>}
                    </div>
                  </div>

                  {/* Tray Info */}
                  <div className="flex-1 py-1 flex flex-col justify-between min-w-0">
                    <div>
                      <div className="flex justify-between items-start mb-0.5">
                        <h3 className="font-black text-stone-800 text-lg leading-none truncate pr-2">
                          {tray.name || tray.id}
                        </h3>
                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest whitespace-nowrap">{tray.sown_date}</span>
                      </div>
                      
                      <p className="text-xs font-bold text-emerald-600 truncate mb-1">
                        {seedsDisplay}
                      </p>
                      
                      <p className="text-[10px] text-stone-500 truncate">{tray.location || 'Location Not Set'}</p>
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-stone-100">
                      {tray.first_germination_date ? (
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                          Sprouted
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">
                          Est. Sprout: <span className="font-black text-stone-700">{germText}</span>
                        </span>
                      )}
                      <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{uniqueSeedIds.length} Varieties</span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-10 text-stone-500 bg-white rounded-xl border border-stone-100 shadow-sm">
              <svg className="w-12 h-12 mx-auto text-stone-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
              <p className="font-medium">No trays found.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}