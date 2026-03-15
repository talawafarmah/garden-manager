'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Beaker, BookOpen, Warehouse, Camera, Plus, ArrowLeft, Droplets, Clock, LeafyGreen, Flame, PlayCircle, Sprout } from 'lucide-react';
import AmendmentList from './amendments/AmendmentList';
import RecipeForm from './amendments/RecipeForm';
import { Recipe } from '@/types/amendments'; // Or wherever your types are located

interface ApothecaryProps {
  navigateTo: (view: any, payload?: any) => void;
  handleGoBack: (fallback: any) => void;
  amendments: any[]; 
}

export default function Apothecary({ navigateTo, handleGoBack, amendments }: ApothecaryProps) {
  const [activeTab, setActiveTab] = useState<'brewery' | 'recipes' | 'inventory'>('brewery');
  
  // Recipe State
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoadingRecipes, setIsLoadingRecipes] = useState(false);
  const [showRecipeForm, setShowRecipeForm] = useState(false);

  const fetchRecipes = async () => {
    setIsLoadingRecipes(true);
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (data && !error) {
      setRecipes(data as Recipe[]);
    }
    setIsLoadingRecipes(false);
  };

  useEffect(() => {
    fetchRecipes();
  }, []);

  const getTypeStyles = (type: string) => {
    switch (type) {
      case 'liquid_tea': return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-100', label: 'Liquid Tea' };
      case 'dry_mix': return { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-100', label: 'Dry Mix' };
      case 'extract': return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100', label: 'Extract' };
      case 'ferment': return { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-100', label: 'Ferment' };
      default: return { bg: 'bg-stone-50', text: 'text-stone-700', border: 'border-stone-100', label: 'Unknown' };
    }
  };

  // If the user clicked "New Recipe", hijack the view and show the form
  if (showRecipeForm) {
    return (
      <RecipeForm 
        onClose={() => setShowRecipeForm(false)} 
        onSuccess={() => {
          setShowRecipeForm(false);
          fetchRecipes(); // Refresh the list!
        }} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 pb-20 font-sans">
      
      {/* UNIVERSAL HEADER */}
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

            {/* Mockup Active Brew Card (We will wire this up next!) */}
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
          </div>
        )}

        {/* --- RECIPES TAB --- */}
        {activeTab === 'recipes' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-between items-center px-1">
              <h2 className="text-lg font-bold text-stone-800">Master Recipes</h2>
              <button 
                onClick={() => setShowRecipeForm(true)}
                className="flex items-center gap-1 text-xs font-black uppercase tracking-widest text-purple-700 bg-purple-100 px-3 py-1.5 rounded-lg border border-purple-200 hover:bg-purple-200 transition-colors shadow-sm"
              >
                <Plus size={16} /> New Recipe
              </button>
            </div>

            {isLoadingRecipes ? (
              <div className="flex justify-center py-10 text-purple-400">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-700"></div>
              </div>
            ) : recipes.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-3xl border border-stone-200 shadow-sm">
                <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl">📝</div>
                <h3 className="font-black text-stone-800">No Recipes Yet</h3>
                <p className="text-xs text-stone-500 mt-1 max-w-xs mx-auto">Create your first custom soil mix or compost tea recipe to use in the Brewery.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {recipes.map(recipe => {
                  const styles = getTypeStyles(recipe.type);
                  return (
                    <div key={recipe.id} className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm hover:border-purple-300 transition-colors cursor-pointer group">
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="text-lg font-black text-stone-900 leading-tight group-hover:text-purple-700 transition-colors pr-2">
                          {recipe.name}
                        </h3>
                        <span className={`${styles.bg} ${styles.text} ${styles.border} text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border flex-shrink-0`}>
                          {styles.label}
                        </span>
                      </div>
                      
                      {recipe.description && (
                        <p className="text-xs text-stone-500 font-medium mb-4 line-clamp-2">
                          {recipe.description}
                        </p>
                      )}
                      
                      {recipe.ingredients && recipe.ingredients.length > 0 && (
                        <div className="bg-stone-50 rounded-xl p-3 border border-stone-100">
                          <h4 className="text-[9px] font-black uppercase tracking-widest text-stone-400 mb-2">Key Ingredients</h4>
                          <ul className="text-xs font-bold text-stone-700 space-y-1">
                            {recipe.ingredients.slice(0, 4).map((ing, i) => (
                              <li key={i} className="flex items-center justify-between gap-2">
                                <span className="flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-purple-400"></div>
                                  {ing.name}
                                </span>
                                <span className="text-[10px] text-stone-500 font-black tracking-widest uppercase">
                                  {ing.amount} {ing.unit}
                                </span>
                              </li>
                            ))}
                            {recipe.ingredients.length > 4 && (
                              <li className="text-[10px] text-stone-400 font-black uppercase tracking-widest text-center mt-2 pt-1 border-t border-stone-200/50">
                                + {recipe.ingredients.length - 4} more
                              </li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
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