'use client';

import React, { useState } from 'react';
import { Beaker, BookOpen, Warehouse, Camera, Plus, ArrowLeft, Droplets, Clock, LeafyGreen, Flame, PlayCircle } from 'lucide-react';
import AmendmentList from './amendments/AmendmentList';

interface ApothecaryProps {
  navigateTo: (view: any, payload?: any) => void;
  handleGoBack: (fallback: any) => void;
  amendments: any[]; 
}

export default function Apothecary({ navigateTo, handleGoBack, amendments }: ApothecaryProps) {
  const [activeTab, setActiveTab] = useState<'brewery' | 'recipes' | 'inventory'>('brewery');

  return (
    <div className="min-h-screen bg-stone-50 pb-20 font-sans">
      
      {/* UNIVERSAL HEADER (Protects against navigation loops) */}
      <header className="bg-purple-800 text-white p-4 shadow-md sticky top-0 z-30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => handleGoBack('dashboard')} className="p-2 bg-purple-900 rounded-full hover:bg-purple-700 transition-colors" title="Go Back">
             <ArrowLeft size={20} />
          </button>
          <button onClick={() => navigateTo('dashboard')} className="p-2 bg-purple-900 rounded-full hover:bg-purple-700 transition-colors" title="Dashboard">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
          </button>
          <h1 className="text-xl font-bold">Apothecary</h1>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="flex bg-white border-b border-stone-200 sticky top-[68px] z-20 shadow-sm">
        <button
          onClick={() => setActiveTab('brewery')}
          className={`flex-1 py-3 text-xs font-black uppercase tracking-widest flex flex-col items-center gap-1 transition-colors ${
            activeTab === 'brewery' ? 'text-purple-700 border-b-4 border-purple-700 bg-purple-50/50' : 'text-stone-400 hover:text-stone-600 hover:bg-stone-50'
          }`}
        >
          <Beaker size={20} />
          <span>Brewery</span>
        </button>
        <button
          onClick={() => setActiveTab('recipes')}
          className={`flex-1 py-3 text-xs font-black uppercase tracking-widest flex flex-col items-center gap-1 transition-colors ${
            activeTab === 'recipes' ? 'text-purple-700 border-b-4 border-purple-700 bg-purple-50/50' : 'text-stone-400 hover:text-stone-600 hover:bg-stone-50'
          }`}
        >
          <BookOpen size={20} />
          <span>Recipes</span>
        </button>
        <button
          onClick={() => setActiveTab('inventory')}
          className={`flex-1 py-3 text-xs font-black uppercase tracking-widest flex flex-col items-center gap-1 transition-colors ${
            activeTab === 'inventory' ? 'text-purple-700 border-b-4 border-purple-700 bg-purple-50/50' : 'text-stone-400 hover:text-stone-600 hover:bg-stone-50'
          }`}
        >
          <Warehouse size={20} />
          <span>Digital Shed</span>
        </button>
      </div>

      <div className="p-4 max-w-2xl mx-auto">
        
        {/* --- BREWERY SCAFFOLD --- */}
        {activeTab === 'brewery' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-between items-center px-1">
              <h2 className="text-lg font-bold text-stone-800">Active Brews</h2>
              <button className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest bg-purple-100 text-purple-700 px-3 py-1.5 rounded-lg border border-purple-200 hover:bg-purple-200 transition-colors shadow-sm">
                <PlayCircle size={16} /> Start Brew
              </button>
            </div>

            {/* Mockup Active Brew Card */}
            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 text-6xl pointer-events-none group-hover:scale-110 transition-transform">🫧</div>
              
              <div className="flex justify-between items-start mb-3 relative z-10">
                <div>
                  <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md border border-amber-200 mb-2 shadow-sm">
                    <Flame size={12} /> Aerating
                  </span>
                  <h3 className="text-xl font-black text-stone-900 leading-tight">Fungal Compost Tea (AACT)</h3>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4 relative z-10">
                <div className="bg-stone-50 p-3 rounded-xl border border-stone-100">
                  <div className="flex items-center text-stone-400 mb-1">
                    <Clock size={14} className="mr-1.5" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Time Elapsed</span>
                  </div>
                  <p className="text-sm font-black text-stone-700">18h 45m</p>
                </div>
                <div className="bg-stone-50 p-3 rounded-xl border border-stone-100">
                  <div className="flex items-center text-stone-400 mb-1">
                    <Droplets size={14} className="mr-1.5" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Target Brew</span>
                  </div>
                  <p className="text-sm font-black text-stone-700">24 - 36 Hours</p>
                </div>
              </div>

              <div className="w-full bg-stone-100 rounded-full h-2 mb-4 overflow-hidden shadow-inner border border-stone-200">
                <div className="bg-amber-400 h-full w-[65%] rounded-full animate-pulse"></div>
              </div>

              <div className="flex gap-2">
                <button className="flex-1 bg-emerald-600 text-white font-black uppercase tracking-widest text-[10px] py-3 rounded-xl shadow-md hover:bg-emerald-500 transition-colors">
                  Mark as Done & Apply
                </button>
                <button className="px-4 bg-stone-100 text-stone-500 font-black uppercase tracking-widest text-[10px] py-3 rounded-xl shadow-sm border border-stone-200 hover:bg-red-50 hover:text-red-500 transition-colors">
                  Dump
                </button>
              </div>
            </div>

            {/* Mockup Finished Brew Card */}
            <div className="bg-stone-100 border border-stone-200 rounded-2xl p-4 shadow-inner opacity-75">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-stone-500 mb-1 block">Completed Yesterday</span>
                  <h3 className="text-sm font-black text-stone-700 line-through">JADAM Liquid Fertilizer (JLF)</h3>
                </div>
                <div className="w-8 h-8 rounded-full bg-emerald-200 text-emerald-700 flex items-center justify-center font-bold">✓</div>
              </div>
            </div>
          </div>
        )}

        {/* --- RECIPES SCAFFOLD --- */}
        {activeTab === 'recipes' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-between items-center px-1">
              <h2 className="text-lg font-bold text-stone-800">Master Recipes</h2>
              <button className="flex items-center gap-1 text-xs font-black uppercase tracking-widest text-emerald-700 hover:text-emerald-500 transition-colors">
                <Plus size={16} /> New Recipe
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {/* Dummy Recipe Card 1 */}
              <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm hover:border-purple-300 transition-colors cursor-pointer">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-black text-stone-900 leading-tight">Actively Aerated Compost Tea (Fungal)</h3>
                  <span className="bg-blue-50 text-blue-700 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border border-blue-100">Liquid</span>
                </div>
                <p className="text-xs text-stone-500 font-medium mb-4 line-clamp-2">A rich fungal brew perfect for perennial beds and fruit trees. Requires air stones for 24 hours minimum.</p>
                <div className="bg-stone-50 rounded-xl p-3 border border-stone-100">
                  <h4 className="text-[9px] font-black uppercase tracking-widest text-stone-400 mb-2">Key Ingredients</h4>
                  <ul className="text-xs font-bold text-stone-700 space-y-1">
                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>Worm Castings</li>
                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>Unsulfured Molasses</li>
                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>Liquid Kelp</li>
                  </ul>
                </div>
              </div>

              {/* Dummy Recipe Card 2 */}
              <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm hover:border-purple-300 transition-colors cursor-pointer">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-black text-stone-900 leading-tight">Super Soil Pre-Mix</h3>
                  <span className="bg-amber-50 text-amber-800 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border border-amber-100">Dry Mix</span>
                </div>
                <p className="text-xs text-stone-500 font-medium mb-4 line-clamp-2">Base mix for starting heavy feeders. Let cook for 30 days before planting.</p>
                <div className="bg-stone-50 rounded-xl p-3 border border-stone-100">
                  <h4 className="text-[9px] font-black uppercase tracking-widest text-stone-400 mb-2">Key Ingredients</h4>
                  <ul className="text-xs font-bold text-stone-700 space-y-1">
                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-stone-500"></div>Peat Moss / Coco Coir</li>
                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-stone-500"></div>Perlite</li>
                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-stone-500"></div>Bone Meal</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- DIGITAL SHED (INVENTORY) --- */}
        {activeTab === 'inventory' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex gap-3 mb-2">
              <button
                onClick={() => navigateTo('amendment_new')}
                className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 text-white py-4 rounded-xl text-sm font-black uppercase tracking-widest shadow-md active:scale-95 transition-transform hover:bg-emerald-500"
              >
                <Camera size={18} />
                <span>Scan New Input</span>
              </button>
            </div>

            {/* We pass isEmbedded={true} so AmendmentList knows to hide its standalone 
              back buttons and headers, blending perfectly into the tab view!
            */}
            <AmendmentList 
              initialAmendments={amendments} 
              navigateTo={navigateTo} 
              handleGoBack={handleGoBack} 
              isEmbedded={true}
            />
          </div>
        )}
      </div>
    </div>
  );
}