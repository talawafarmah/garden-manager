'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Beaker, BookOpen, Warehouse, Camera, Plus, ArrowLeft, Droplets, Clock, LeafyGreen, Flame, PlayCircle, Sprout, Edit2, Trash2, X } from 'lucide-react';
import AmendmentList from './amendments/AmendmentList';
import RecipeForm from './amendments/RecipeForm';
import { Recipe } from '@/types/amendments'; 

interface ApothecaryProps {
  navigateTo: (view: any, payload?: any) => void;
  handleGoBack: (fallback: any) => void;
  amendments: any[]; 
}

export default function Apothecary({ navigateTo, handleGoBack, amendments }: ApothecaryProps) {
  const [activeTab, setActiveTab] = useState<'brewery' | 'recipes' | 'inventory'>('brewery');
  
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoadingRecipes, setIsLoadingRecipes] = useState(false);
  
  const [showRecipeForm, setShowRecipeForm] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  
  // NEW: State to track which recipe is currently being viewed in the popup
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

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
      case 'liquid_tea': return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-100', label: 'Liquid Tea', icon: <Beaker size={14}/> };
      case 'dry_mix': return { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-100', label: 'Dry Mix', icon: <Sprout size={14}/> };
      case 'extract': return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100', label: 'Extract', icon: <LeafyGreen size={14}/> };
      case 'ferment': return { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-100', label: 'Ferment', icon: <Flame size={14}/> };
      default: return { bg: 'bg-stone-50', text: 'text-stone-700', border: 'border-stone-100', label: 'Unknown', icon: <Beaker size={14}/> };
    }
  };

  // --- RECIPE CRUD ACTIONS ---
  const handleEditRecipe = (recipe: Recipe) => {
    setEditingRecipe(recipe);
    setShowRecipeForm(true);
    setSelectedRecipe(null); // Close the view modal if it's open
  };

  const handleDeleteRecipe = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to permanently delete the recipe "${name}"?`)) {
      const { error } = await supabase.from('recipes').delete().eq('id', id);
      if (error) {
        alert("Failed to delete recipe: " + error.message);
      } else {
        setRecipes(recipes.filter(r => r.id !== id));
        if (selectedRecipe?.id === id) setSelectedRecipe(null);
      }
    }
  };

  if (showRecipeForm) {
    return (
      <RecipeForm 
        initialData={editingRecipe}
        onClose={() => {
          setShowRecipeForm(false);
          setEditingRecipe(null);
        }} 
        onSuccess={() => {
          setShowRecipeForm(false);
          setEditingRecipe(null);
          fetchRecipes(); 
        }} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 pb-20 font-sans relative">
      
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
                onClick={() => { setEditingRecipe(null); setShowRecipeForm(true); }}
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
                    <div 
                      key={recipe.id} 
                      onClick={() => setSelectedRecipe(recipe)}
                      className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm relative group cursor-pointer hover:border-purple-300 transition-all hover:shadow-md"
                    >
                      {/* CRUD ACTIONS: Hidden until hover (or always visible on mobile) */}
                      <div className="absolute top-4 right-4 flex gap-1.5 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleEditRecipe(recipe); }} 
                          className="p-2 bg-stone-100 text-stone-500 hover:bg-blue-100 hover:text-blue-600 rounded-lg transition-colors"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeleteRecipe(recipe.id, recipe.name); }} 
                          className="p-2 bg-stone-100 text-stone-500 hover:bg-red-100 hover:text-red-600 rounded-lg transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <div className="flex justify-between items-start mb-3 pr-20">
                        <h3 className="text-lg font-black text-stone-900 leading-tight group-hover:text-purple-700 transition-colors">
                          {recipe.name}
                        </h3>
                      </div>

                      <div className="flex gap-2 mb-3">
                        <span className={`${styles.bg} ${styles.text} ${styles.border} text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border flex items-center gap-1`}>
                          {styles.icon} {styles.label}
                        </span>
                        {recipe.brew_time_hours ? (
                          <span className="bg-stone-100 text-stone-600 border-stone-200 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border flex items-center gap-1">
                            <Clock size={12} /> {recipe.brew_time_hours} Hours
                          </span>
                        ) : null}
                      </div>
                      
                      {recipe.description && recipe.description !== '<p><br></p>' && (
                        <div 
                          className="prose prose-sm prose-stone mb-4 max-w-none text-stone-600 line-clamp-2"
                          dangerouslySetInnerHTML={{ __html: recipe.description }} 
                        />
                      )}
                      
                      {recipe.ingredients && recipe.ingredients.length > 0 && (
                        <div className="bg-stone-50 rounded-xl p-3 border border-stone-100">
                          <h4 className="text-[9px] font-black uppercase tracking-widest text-stone-400 mb-2">Key Ingredients</h4>
                          <ul className="text-xs font-bold text-stone-700 space-y-1">
                            {recipe.ingredients.slice(0, 3).map((ing, i) => (
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
                            {recipe.ingredients.length > 3 && (
                              <li className="text-[10px] text-stone-400 font-black uppercase tracking-widest text-center mt-2 pt-1 border-t border-stone-200/50">
                                + {recipe.ingredients.length - 3} more
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

      {/* --- FULL RECIPE VIEW MODAL --- */}
      {selectedRecipe && (() => {
         const styles = getTypeStyles(selectedRecipe.type);
         return (
          <div className="fixed inset-0 z-[60] bg-stone-900/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
              
              {/* Modal Header */}
              <div className="bg-purple-800 text-white p-4 sm:p-5 flex justify-between items-center shrink-0">
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-purple-900/50 text-purple-100 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border border-purple-700 shadow-sm flex items-center gap-1 w-fit">
                      {styles.icon} {styles.label}
                    </span>
                    {selectedRecipe.brew_time_hours ? (
                      <span className="bg-purple-900/50 text-purple-100 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border border-purple-700 shadow-sm flex items-center gap-1 w-fit">
                        <Clock size={12} /> {selectedRecipe.brew_time_hours}h
                      </span>
                    ) : null}
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black leading-tight truncate">
                    {selectedRecipe.name}
                  </h2>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button 
                    onClick={() => handleEditRecipe(selectedRecipe)}
                    className="p-2 bg-purple-700 hover:bg-purple-600 rounded-full transition-colors"
                    title="Edit Recipe"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => setSelectedRecipe(null)}
                    className="p-2 bg-purple-700 hover:bg-purple-600 rounded-full transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="p-5 sm:p-6 overflow-y-auto space-y-8 bg-stone-50">
                
                {selectedRecipe.description && selectedRecipe.description !== '<p><br></p>' && (
                  <section>
                    <h3 className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-3 border-b border-stone-200 pb-2">Description / Purpose</h3>
                    <div 
                      className="prose prose-sm prose-stone max-w-none text-stone-700 bg-white p-5 rounded-2xl border border-stone-200 shadow-sm"
                      dangerouslySetInnerHTML={{ __html: selectedRecipe.description }} 
                    />
                  </section>
                )}

                {selectedRecipe.ingredients && selectedRecipe.ingredients.length > 0 && (
                  <section>
                    <h3 className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-3 border-b border-stone-200 pb-2">Ingredients Needed</h3>
                    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
                      <table className="w-full text-left text-sm">
                        <tbody className="divide-y divide-stone-100">
                          {selectedRecipe.ingredients.map((ing, i) => (
                            <tr key={i} className="hover:bg-stone-50 transition-colors">
                              <td className="py-3 px-4 font-bold text-stone-800">{ing.name}</td>
                              <td className="py-3 px-4 text-right font-black text-purple-700">
                                {ing.amount} <span className="text-[10px] text-stone-500 uppercase tracking-widest">{ing.unit}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}

                {selectedRecipe.instructions && selectedRecipe.instructions !== '<p><br></p>' && (
                  <section>
                    <h3 className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-3 border-b border-stone-200 pb-2">Instructions</h3>
                    <div 
                      className="prose prose-sm prose-stone max-w-none text-stone-700 bg-white p-5 sm:p-6 rounded-2xl border border-stone-200 shadow-sm"
                      dangerouslySetInnerHTML={{ __html: selectedRecipe.instructions }} 
                    />
                  </section>
                )}
                
              </div>
            </div>
          </div>
         );
      })()}

      {/* Global Prose Styles for HTML Content */}
      <style dangerouslySetInnerHTML={{__html: `
        .prose p { margin-top: 0.25em; margin-bottom: 0.25em; }
        .prose ul { margin-top: 0.25em; margin-bottom: 0.25em; padding-left: 1.25em; list-style-type: disc; }
        .prose ol { margin-top: 0.25em; margin-bottom: 0.25em; padding-left: 1.25em; list-style-type: decimal; }
        .prose strong { color: #1c1917; font-weight: 800; }
      `}} />
    </div>
  );
}