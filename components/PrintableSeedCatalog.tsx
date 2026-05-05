'use client';

import React, { useMemo, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Printer, Image as ImageIcon, Loader2, LayoutGrid, List as ListIcon } from 'lucide-react';
import { InventorySeed, SeedlingTray } from '../types';

interface PrintableSeedCatalogProps {
  inventory: InventorySeed[];
  trays: SeedlingTray[];
  handleGoBack: (fallback: string) => void;
}

export default function PrintableSeedCatalog({ inventory, trays, handleGoBack }: PrintableSeedCatalogProps) {
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [ledgerSeedIds, setLedgerSeedIds] = useState<Set<string>>(new Set());
  const [isLoadingLedgers, setIsLoadingLedgers] = useState(true);
  
  // NEW: State to manage the print layout density
  const [viewMode, setViewMode] = useState<'detailed' | 'compact'>('detailed');

  // 1. Fetch actively growing seedlings from the database for the current season
  useEffect(() => {
    const fetchActiveSeasonLedgers = async () => {
      try {
        const { data: seasonData } = await supabase
          .from('seasons')
          .select('id')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (seasonData) {
          const { data: seedlings } = await supabase
            .from('season_seedlings')
            .select('seed_id')
            .eq('season_id', seasonData.id);

          if (seedlings) {
            setLedgerSeedIds(new Set(seedlings.map(s => s.seed_id)));
          }
        }
      } catch (err) {
        console.error("Failed to fetch season ledgers:", err);
      } finally {
        setIsLoadingLedgers(false);
      }
    };

    fetchActiveSeasonLedgers();
  }, []);

  // 2. Mathematically extract ONLY the seeds used THIS season
  const activeSeeds = useMemo(() => {
    const activeSeedIds = new Set<string>();

    trays?.forEach(t => {
      if (t.status !== 'Abandoned') {
        t.contents?.forEach((c: any) => {
          if (!c.abandoned) activeSeedIds.add(c.seed_id);
        });
      }
    });

    ledgerSeedIds.forEach(id => activeSeedIds.add(id));

    inventory?.forEach(s => {
      if (s.status === 'Wishlist' || s.wishlist === true) {
        activeSeedIds.add(s.id);
      }
    });

    // Natural Sorting (Alphanumeric)
    return inventory
      .filter(s => activeSeedIds.has(s.id))
      .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' }));
  }, [inventory, trays, ledgerSeedIds]);

  // 3. Group the filtered seeds by their Botanical Category
  const groupedSeeds = useMemo(() => {
    const groups: Record<string, InventorySeed[]> = {};
    activeSeeds.forEach(seed => {
      const cat = seed.category || 'Uncategorized';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(seed);
    });
    return groups;
  }, [activeSeeds]);

  // 4. Resolve secure Supabase image URLs
  useEffect(() => {
    // Optimization: Only fetch image URLs if we are in detailed mode
    if (viewMode !== 'detailed' || activeSeeds.length === 0) return;

    const fetchSignedUrls = async () => {
      const pathsToSign: string[] = [];
      const urlMap: Record<string, string> = {};

      activeSeeds.forEach(seed => {
        if (seed.thumbnail) {
          if (seed.thumbnail.startsWith('http') || seed.thumbnail.startsWith('data:')) {
            urlMap[seed.thumbnail] = seed.thumbnail;
          } else {
            pathsToSign.push(seed.thumbnail);
          }
        }
      });

      if (pathsToSign.length > 0) {
        const { data } = await supabase.storage.from('talawa_media').createSignedUrls(pathsToSign, 3600);
        if (data) {
          data.forEach(item => {
            if (item.signedUrl && item.path) {
              urlMap[item.path] = item.signedUrl;
            }
          });
        }
      }
      setSignedUrls(urlMap);
    };

    fetchSignedUrls();
  }, [activeSeeds, viewMode]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-stone-100 print:bg-white text-stone-900 font-sans pb-20 print:pb-0">
      
      {/* --- NON-PRINTABLE HEADER --- */}
      <header className="bg-stone-900 text-white p-4 shadow-md sticky top-0 z-20 print:hidden flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => handleGoBack('vault')} 
            className="p-2 bg-stone-800 rounded-full hover:bg-stone-700 transition-colors shrink-0"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-bold truncate">Printable Catalog</h1>
        </div>

        <div className="flex items-center gap-3 ml-auto">
          {/* VIEW TOGGLE */}
          <div className="flex bg-stone-800 rounded-lg p-1 border border-stone-700">
            <button 
              onClick={() => setViewMode('detailed')} 
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'detailed' ? 'bg-stone-600 text-white shadow-sm' : 'text-stone-400 hover:text-stone-200'}`}
            >
              <LayoutGrid size={14} /> <span className="hidden sm:inline">Detailed</span>
            </button>
            <button 
              onClick={() => setViewMode('compact')} 
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'compact' ? 'bg-stone-600 text-white shadow-sm' : 'text-stone-400 hover:text-stone-200'}`}
            >
              <ListIcon size={14} /> <span className="hidden sm:inline">Compact</span>
            </button>
          </div>

          <button 
            onClick={handlePrint}
            disabled={isLoadingLedgers || activeSeeds.length === 0}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-black uppercase tracking-widest text-xs shadow-md active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            <Printer size={16} /> <span className="hidden sm:inline">Print</span>
          </button>
        </div>
      </header>

      {/* --- PRINTABLE CONTENT --- */}
      <div className="max-w-4xl mx-auto p-6 print:p-0 print:m-0">
        
        {/* Print Document Title */}
        <div className="mb-8 border-b-2 border-stone-800 pb-4 print:border-black">
          <h1 className="text-3xl font-black text-stone-900 print:text-black uppercase tracking-tight">Active Season Seed List</h1>
          <p className="text-sm font-bold text-stone-500 print:text-gray-700 mt-1 uppercase tracking-widest flex items-center gap-2">
            <span>Generated on: {new Date().toLocaleDateString()}</span>
            <span>•</span>
            <span>Total Seeds: {activeSeeds.length}</span>
            <span className="print:hidden">•</span>
            <span className="print:hidden text-emerald-600">({viewMode === 'detailed' ? 'Detailed Mode' : 'Compact Index Mode'})</span>
          </p>
        </div>

        {isLoadingLedgers ? (
          <div className="flex flex-col items-center justify-center py-20 text-emerald-600 print:hidden">
            <Loader2 size={32} className="animate-spin mb-4" />
            <p className="font-bold text-sm uppercase tracking-widest text-stone-500">Compiling Season Data...</p>
          </div>
        ) : Object.keys(groupedSeeds).length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-stone-200 shadow-sm print:hidden">
            <div className="text-4xl mb-4">📋</div>
            <h3 className="font-black text-stone-800 mb-1">No Active Seeds Found</h3>
            <p className="text-sm text-stone-500 max-w-sm mx-auto">
              This catalog only prints seeds that are currently sown in trays, growing in the nursery, or explicitly marked on your wishlist.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.keys(groupedSeeds).sort().map(category => (
              <div key={category} className="print:break-inside-avoid-page">
                {/* Category Header */}
                <h2 className={`font-black bg-stone-200 print:bg-gray-100 print:text-black text-stone-800 rounded-md uppercase tracking-widest flex items-center gap-2 ${viewMode === 'detailed' ? 'text-lg px-3 py-1.5 mb-4' : 'text-sm px-2 py-1 mb-2 border-b border-stone-300 print:border-black print:bg-transparent print:border-b-2 print:rounded-none'}`}>
                  {viewMode === 'detailed' && <span className="text-xl leading-none pt-0.5">🌱</span>}
                  {category} 
                  <span className="text-xs text-stone-500 print:text-gray-600 font-bold ml-auto normal-case">
                    ({groupedSeeds[category].length})
                  </span>
                </h2>

                {/* --- DETAILED LAYOUT --- */}
                {viewMode === 'detailed' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 print:grid-cols-2 gap-3">
                    {groupedSeeds[category].map(seed => {
                      const imageUrl = seed.thumbnail ? signedUrls[seed.thumbnail] || seed.thumbnail : null;

                      return (
                        <div key={seed.id} className="flex gap-3 border border-stone-300 print:border-gray-400 p-2 rounded-lg bg-white break-inside-avoid shadow-sm print:shadow-none">
                          <div className="w-16 h-16 shrink-0 bg-stone-100 border border-stone-200 rounded flex items-center justify-center overflow-hidden">
                            {imageUrl ? (
                              <img src={imageUrl} alt={seed.variety_name} className="w-full h-full object-cover grayscale-[20%] print:grayscale-[50%]" />
                            ) : (
                              <ImageIcon size={20} className="text-stone-300" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0 flex flex-col justify-center py-1">
                            <h3 className="font-black text-sm text-stone-900 print:text-black leading-tight break-words">
                              <span className="text-emerald-700 print:text-black font-mono tracking-tight mr-1.5">{seed.id} -</span>
                              {seed.variety_name}
                            </h3>
                            <p className="text-[10px] font-bold text-stone-500 print:text-gray-600 uppercase tracking-widest mt-1 break-words leading-snug">
                              {seed.status || 'Stored'} • {seed.germination_days || '--'} Days
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* --- COMPACT LIST LAYOUT --- */}
                {viewMode === 'compact' && (
                  <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 print:grid-cols-3 gap-x-6 gap-y-1">
                    {groupedSeeds[category].map(seed => (
                      <li key={seed.id} className="text-sm print:text-[11px] break-inside-avoid border-b border-stone-200 print:border-gray-300 py-1.5 flex items-start gap-2">
                        <span className="font-mono font-black text-emerald-700 print:text-black shrink-0 w-10 print:w-8">
                          {seed.id}
                        </span>
                        <span className="text-stone-800 print:text-gray-900 leading-tight break-words flex-1">
                          {seed.variety_name}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}