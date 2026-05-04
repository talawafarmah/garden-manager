'use client';

import React, { useMemo, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Printer, Image as ImageIcon } from 'lucide-react';
import { InventorySeed, SeedlingTray } from '../types';

interface PrintableSeedCatalogProps {
  inventory: InventorySeed[];
  trays: SeedlingTray[];
  handleGoBack: (fallback: string) => void;
}

export default function PrintableSeedCatalog({ inventory, trays, handleGoBack }: PrintableSeedCatalogProps) {
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  // 1. Mathematically extract only the seeds relevant to this season/wishlist
  const activeSeeds = useMemo(() => {
    const activeSeedIds = new Set<string>();

    // Add seeds currently sown in active trays
    trays?.forEach(t => {
      t.contents?.forEach((c: any) => activeSeedIds.add(c.seed_id));
    });

    // Add seeds currently in stock / wishlist
    inventory?.forEach(s => {
      if (!s.out_of_stock) {
        activeSeedIds.add(s.id);
      }
    });

    // Filter inventory and sort by Seed ID
    return inventory
      .filter(s => activeSeedIds.has(s.id))
      .sort((a, b) => a.id.localeCompare(b.id));
  }, [inventory, trays]);

  // 2. Group the filtered seeds by their Botanical Category
  const groupedSeeds = useMemo(() => {
    const groups: Record<string, InventorySeed[]> = {};
    activeSeeds.forEach(seed => {
      const cat = seed.category || 'Uncategorized';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(seed);
    });
    return groups;
  }, [activeSeeds]);

  // 3. Resolve secure Supabase image URLs so the printer can actually load the images
  useEffect(() => {
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
        // Request secure access tokens from Supabase valid for 1 hour
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

    if (activeSeeds.length > 0) {
      fetchSignedUrls();
    }
  }, [activeSeeds]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-stone-100 print:bg-white text-stone-900 font-sans pb-20 print:pb-0">
      
      {/* --- NON-PRINTABLE HEADER --- */}
      <header className="bg-stone-900 text-white p-4 shadow-md sticky top-0 z-20 print:hidden flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => handleGoBack('dashboard')} 
            className="p-2 bg-stone-800 rounded-full hover:bg-stone-700 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-bold">Printable Seed Catalog</h1>
        </div>
        <button 
          onClick={handlePrint}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-black uppercase tracking-widest text-xs shadow-md active:scale-95 transition-transform"
        >
          <Printer size={16} /> Print Document
        </button>
      </header>

      {/* --- PRINTABLE CONTENT --- */}
      <div className="max-w-4xl mx-auto p-6 print:p-0 print:m-0">
        
        {/* Print Document Title */}
        <div className="mb-8 border-b-2 border-stone-800 pb-4 print:border-black">
          <h1 className="text-3xl font-black text-stone-900 print:text-black uppercase tracking-tight">Active Season Seed List</h1>
          <p className="text-sm font-bold text-stone-500 print:text-gray-700 mt-1 uppercase tracking-widest">
            Generated on: {new Date().toLocaleDateString()} • Total Seeds: {activeSeeds.length}
          </p>
        </div>

        {Object.keys(groupedSeeds).length === 0 ? (
          <div className="text-center py-20 text-stone-500 print:hidden">
            No active seeds found in trays or inventory.
          </div>
        ) : (
          <div className="space-y-8">
            {Object.keys(groupedSeeds).sort().map(category => (
              <div key={category} className="print:break-inside-avoid-page">
                {/* Category Header */}
                <h2 className="text-lg font-black bg-stone-200 print:bg-gray-100 print:text-black text-stone-800 px-3 py-1.5 rounded-md mb-4 uppercase tracking-widest flex items-center gap-2">
                  <span className="text-xl leading-none pt-0.5">🌱</span> {category} 
                  <span className="text-xs text-stone-500 font-bold ml-auto normal-case">
                    ({groupedSeeds[category].length})
                  </span>
                </h2>

                {/* Seed Grid - Adapts to columns for print/desktop */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 print:grid-cols-2 gap-3">
                  {groupedSeeds[category].map(seed => {
                    const imageUrl = seed.thumbnail ? signedUrls[seed.thumbnail] || seed.thumbnail : null;

                    return (
                      <div 
                        key={seed.id} 
                        // break-inside-avoid prevents a single card from being cut in half across printer pages
                        className="flex gap-3 border border-stone-300 print:border-gray-400 p-2 rounded-lg bg-white break-inside-avoid shadow-sm print:shadow-none"
                      >
                        {/* Thumbnail */}
                        <div className="w-16 h-16 shrink-0 bg-stone-100 border border-stone-200 rounded flex items-center justify-center overflow-hidden">
                          {imageUrl ? (
                            <img src={imageUrl} alt={seed.variety_name} className="w-full h-full object-cover grayscale-[20%] print:grayscale-[50%]" />
                          ) : (
                            <ImageIcon size={20} className="text-stone-300" />
                          )}
                        </div>

                        {/* Seed Details */}
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          <span className="text-[10px] font-mono font-black text-stone-500 bg-stone-100 print:bg-transparent print:border-none print:p-0 px-1.5 py-0.5 rounded border border-stone-200 w-fit mb-0.5 block">
                            ID: {seed.id}
                          </span>
                          <h3 className="font-black text-sm text-stone-900 print:text-black leading-tight truncate">
                            {seed.variety_name}
                          </h3>
                          <p className="text-[10px] font-bold text-stone-500 print:text-gray-600 uppercase tracking-widest mt-0.5 truncate">
                            {seed.status || 'Stored'} • {seed.germination_days || '--'} Days
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}