import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { InventorySeed, SeedlingTray } from '../types';

interface SeedDetailProps {
  seed: InventorySeed;
  trays: SeedlingTray[];
  categories: any[];
  navigateTo: (view: any, payload?: any) => void;
  handleGoBack: (view: any) => void;
}

export default function SeedDetail({ seed, trays, navigateTo, handleGoBack }: SeedDetailProps) {
  const [viewingImageIndex, setViewingImageIndex] = useState(seed.primaryImageIndex || 0);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);

  /**
   * SIGNED URL RESOLVER WITH DIAGNOSTIC LOGGING
   */
  useEffect(() => {
    let isMounted = true;
    
    const loadSignedUrls = async () => {
      console.log("[SeedDetail] Starting signed URL resolution. Raw seed.images:", seed.images);
      try {
        if (!seed.images || !Array.isArray(seed.images) || seed.images.length === 0) {
           console.log("[SeedDetail] No images to process. Aborting resolution.");
           return;
        }
        
        const urlsToFetch = seed.images.filter((img: string) => img && typeof img === 'string' && !img.startsWith('http') && !img.startsWith('data:'));
        console.log("[SeedDetail] Paths requiring signed URLs (filtered):", urlsToFetch);

        if (urlsToFetch.length === 0) return;

        const fetchedUrls: Record<string, string> = {};

        console.log("[SeedDetail] Calling Supabase createSignedUrls (Bulk)...");
        const { data, error } = await supabase.storage.from('talawa_media').createSignedUrls(urlsToFetch, 3600);
        console.log("[SeedDetail] Bulk response data:", data, "error:", error);

        if (data && !error) {
          data.forEach((item: any) => {
            const url = item.signedUrl || item.signedURL;
            if (url) {
              fetchedUrls[item.path] = url;
            } else {
              console.warn("[SeedDetail] Missing signed URL in returned item:", item);
            }
          });
        } else {
          console.warn("[SeedDetail] Bulk fetch failed, falling back to sequential fetch. Error:", error);
          // Fallback: Sequential fetching if bulk endpoint encounters an issue
          for (const imgPath of urlsToFetch) {
            const { data: d, error: seqErr } = await supabase.storage.from('talawa_media').createSignedUrl(imgPath, 3600);
            console.log(`[SeedDetail] Sequential fetch for ${imgPath}:`, d, "error:", seqErr);
            const url = d?.signedUrl || (d as any)?.signedURL;
            if (url) {
              fetchedUrls[imgPath] = url;
            }
          }
        }

        console.log("[SeedDetail] Final resolved signed URLs mapping:", fetchedUrls);
        if (isMounted && Object.keys(fetchedUrls).length > 0) {
          setSignedUrls(prev => ({ ...prev, ...fetchedUrls }));
        }
      } catch (err) {
        console.error("[SeedDetail] Caught an exception in signed URL resolver:", err);
      }
    };

    loadSignedUrls();
    
    return () => { isMounted = false; };
  }, [seed.images]);

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

  // Resolve what to actually show in the <img> tag gracefully
  const rawImgPath = (seed.images && seed.images.length > 0) ? seed.images[viewingImageIndex] : null;
  const displayImg = rawImgPath ? (rawImgPath.startsWith('http') || rawImgPath.startsWith('data:') ? rawImgPath : signedUrls[rawImgPath]) : null;

  const isTomato = seed.category?.toLowerCase().includes('tomato');
  const isPepper = seed.category?.toLowerCase().includes('pepper');
  const shu = seed.scoville_rating ? Number(seed.scoville_rating) : null;

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900 pb-20 font-sans">
      {fullScreenImage && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4" onClick={() => setFullScreenImage(null)}>
          <img src={fullScreenImage} className="max-w-full max-h-full object-contain rounded-lg" alt="Fullscreen" />
        </div>
      )}

      <header className="bg-emerald-700 text-white p-4 shadow-md sticky top-0 z-10 flex items-center justify-between">
        <button onClick={onBack} className="p-2 bg-emerald-800 rounded-full active:scale-90 transition-transform">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h1 className="text-lg font-bold truncate px-2">Seed Details</h1>
        <button onClick={onEdit} className="p-2 bg-emerald-800 rounded-full active:scale-90 transition-transform">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
        </button>
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
              onError={(e) => console.error("[SeedDetail] Hero image failed to load in browser. Source URL:", displayImg)}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-stone-400 gap-2">
              <svg className="w-12 h-12 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              <span className="text-[10px] uppercase font-black tracking-widest">No Image Loaded</span>
            </div>
          )}
          
          <div className="absolute bottom-0 left-0 w-full p-6 bg-gradient-to-t from-stone-900 via-stone-900/40 to-transparent text-white">
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-emerald-500 text-[10px] font-black px-2 py-0.5 rounded shadow-sm">{seed.id}</span>
              {seed.out_of_stock && <span className="bg-red-500 text-[10px] font-black px-2 py-0.5 rounded shadow-sm">OUT OF STOCK</span>}
            </div>
            <h2 className="text-2xl font-black tracking-tight leading-tight">{seed.variety_name}</h2>
            <p className="text-emerald-300 text-xs font-bold uppercase tracking-widest opacity-90">{seed.category} <span className="text-white/60 font-medium italic lowercase">({seed.species})</span></p>
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
                    <img 
                      src={tSrc} 
                      className="w-full h-full object-cover" 
                      alt={`Thumb ${idx}`} 
                      onError={() => console.error(`[SeedDetail] Thumbnail ${idx} failed to load. Source:`, tSrc)}
                    />
                  ) : (
                    <div className="w-full h-full bg-stone-100 animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className="p-4 space-y-4">
          {/* Key Indicators */}
          {(isTomato || isPepper) && (
            <div className="grid grid-cols-1 gap-2">
              {isTomato && seed.tomato_type && (
                <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-rose-500 text-white p-2 rounded-xl shadow-sm">🍅</div>
                    <div>
                      <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest leading-none mb-1">Tomato Growth Habit</p>
                      <p className="font-black text-rose-900">{seed.tomato_type}</p>
                    </div>
                  </div>
                </div>
              )}
              {isPepper && shu !== null && !isNaN(shu) && (
                <div className="bg-orange-50 border border-orange-100 p-4 rounded-2xl flex items-center justify-between">
                   <div className="flex items-center gap-3">
                    <div className="bg-orange-500 text-white p-2 rounded-xl shadow-sm">🌶️</div>
                    <div>
                      <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest leading-none mb-1">Scoville Heat Units</p>
                      <p className="font-black text-orange-900">{shu.toLocaleString()} SHU</p>
                    </div>
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
              <svg className="w-3 h-3 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
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