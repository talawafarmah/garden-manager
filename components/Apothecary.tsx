'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Beaker, BookOpen, Warehouse, Camera, Plus, ArrowLeft, Droplets, Clock, LeafyGreen, Flame, PlayCircle, Sprout, Edit2, Trash2, X, CheckCircle2 } from 'lucide-react';
import AmendmentList from './amendments/AmendmentList';
import RecipeForm from './amendments/RecipeForm';
import { Recipe, ActiveBrew } from '@/types/amendments'; 

interface ApothecaryProps {
  navigateTo: (view: any, payload?: any) => void;
  handleGoBack: (fallback: any) => void;
  amendments: any[]; 
}

export default function Apothecary({ navigateTo, handleGoBack, amendments }: ApothecaryProps) {
  const [activeTab, setActiveTab] = useState<'brewery' | 'recipes' | 'inventory'>('brewery');
  
  // --- STATE ---
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [brews, setBrews] = useState<any[]>([]); 
  const [isLoading, setIsLoading] = useState(false);
  const [now, setNow] = useState(new Date());
  
  const [showRecipeForm, setShowRecipeForm] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  const [isStartingBrew, setIsStartingBrew] = useState(false);
  const [brewForm, setBrewForm] = useState({ recipe_id: '', custom_name: '', brew_start: '' });

  // --- DATA FETCHING ---
  const fetchData = async () => {
    setIsLoading(true);
    // Pointing back to the correct "recipes" table!
    const [recipeRes, brewRes] = await Promise.all([
      supabase.from('recipes').select('*').order('created_at', { ascending: false }),
      supabase.from('active_brews').select('*, recipes(*)').order('brew_start', { ascending: false })
    ]);
      
    if (recipeRes.data) setRecipes(recipeRes.data as Recipe[]);
    if (brewRes.data) {
      const mappedBrews = brewRes.data.map(b => ({
        ...b,
        recipe: b.recipes || b.recipe
      }));
      setBrews(mappedBrews);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
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

  const getBrewProgress = (startStr: string, endStr: string) => {
    if (!startStr || !endStr) return { percent: 0, elapsedText: '0h 0m', isComplete: false };
    
    const start = new Date(startStr).getTime();
    const current = now.getTime();
    const elapsedMs = Math.max(0, current - start);
    
    const hours = Math.floor(elapsedMs / (1000 * 60 * 60));
    const minutes = Math.floor((elapsedMs % (1000 * 60 * 60)) / (1000 * 60));
    const elapsedText = `${hours}h ${minutes}m`;

    const target = new Date(endStr).getTime();
    const totalMs = Math.max(1, target - start);
    const rawPercent = (elapsedMs / totalMs) * 100;
    const percent = Math.min(100, Math.max(0, rawPercent));
    
    return { percent, elapsedText, isComplete: percent >= 100 };
  };

  const handleOpenStartBrew = () => {
    const initialRecipe = recipes.length > 0 ? recipes[0].id : '';
    const initialName = recipes.length > 0 ? `Batch of ${recipes[0].name}` : '';
    
    const localNow = new Date();
    localNow.setMinutes(localNow.getMinutes() - localNow.getTimezoneOffset());
    const timeStr = localNow.toISOString().slice(0,16);

    setBrewForm({ recipe_id: initialRecipe, custom_name: initialName, brew_start: timeStr });
    setIsStartingBrew(true);
  };

  const handleStartBrew = async () => {
    if (!brewForm.recipe_id || !brewForm.custom_name) return;
    
    const recipe = recipes.find(r => r.id === brewForm.recipe_id);
    if (!recipe) return;

    const startObj = new Date(brewForm.brew_start);
    const hoursToAdd = recipe.brew_time_hours || 24; 
    const endObj = new Date(startObj.getTime() + (hoursToAdd * 60 * 60 * 1000));

    const payload = {
      recipe_id: recipe.id,
      custom_name: brewForm.custom_name,
      status: 'Brewing', 
      brew_start: startObj.toISOString(),
      brew_end: endObj.toISOString(),
      gallons_brewed: 5, 
    };

    const { error } = await supabase.from('active_brews').insert([payload]);
    if (!error) {
      fetchData(); 
      setIsStartingBrew(false);
    } else {
      alert("Failed to start brew: " + error.message);
    }
  };

  const handleUpdateBrewStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase.from('active_brews').update({ status: newStatus }).eq('id', id);
    if (!error) {
      setBrews(brews.map(b => b.id === id ? { ...b, status: newStatus } : b));
    }
  };

  const handleEditRecipe = (recipe: Recipe) => {
    setEditingRecipe(recipe);
    setShowRecipeForm(true);
    setSelectedRecipe(null); 
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
        onClose={() => { setShowRecipeForm(false); setEditingRecipe(null); }} 
        onSuccess={() => { setShowRecipeForm(false); setEditingRecipe(null); fetchData(); }} 
      />
    );
  }

  const activeBrews = brews.filter(b => b.status === 'Brewing');
  const historyBrews = brews.filter(b => b.status !== 'Brewing');

  return (
    <div className="min-h-screen bg-stone-50 pb-20 font-sans relative">
      
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
        
        {activeTab === 'brewery' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-between items-center px-1">
              <h2 className="text-lg font-bold text-stone-800">Active Brews</h2>
              <button 
                onClick={handleOpenStartBrew}
                className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest bg-purple-100 text-purple-700 px-3 py-1.5 rounded-lg border border-purple-200 hover:bg-purple-200 transition-colors shadow-sm"
              >
                <PlayCircle size={16} /> Start Brew
              </button>
            </div>

            {activeBrews.length === 0 ? (
               <div className="text-center py-12 bg-white rounded-3xl border border-stone-200 shadow-sm">
                 <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl">🪣</div>
                 <h3 className="font-black text-stone-800">Quiet in the Brewery</h3>
                 <p className="text-xs text-stone-500 mt-1 max-w-xs mx-auto">Start a fresh batch of compost tea or liquid ferment to get things bubbling.</p>
               </div>
            ) : (
              <div className="space-y-4">
                {activeBrews.map(brew => {
                  const progress = getBrewProgress(brew.brew_start, brew.brew_end);
                  const isExtractOrFerment = brew.recipe?.type === 'extract' || brew.recipe?.type === 'ferment';
                  
                  return (
                    <div key={brew.id} className={`bg-white border ${progress.isComplete ? 'border-emerald-400 shadow-emerald-900/10' : 'border-stone-200 shadow-sm'} rounded-2xl p-5 relative overflow-hidden group transition-all`}>
                      <div className="absolute top-0 right-0 p-4 opacity-5 text-6xl pointer-events-none group-hover:scale-110 transition-transform">
                        {isExtractOrFerment ? '🌿' : '🫧'}
                      </div>
                      
                      <div className="flex justify-between items-start mb-3 relative z-10">
                        <div className="pr-4">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md border mb-2 shadow-sm ${progress.isComplete ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-amber-100 text-amber-800 border-amber-200'}`}>
                            {progress.isComplete ? <CheckCircle2 size={12} /> : isExtractOrFerment ? <Clock size={12} /> : <Flame size={12} />} 
                            {progress.isComplete ? 'Brew Ready!' : isExtractOrFerment ? 'Steeping' : 'Aerating'}
                          </span>
                          <h3 className="text-xl font-black text-stone-900 leading-tight">{brew.custom_name}</h3>
                          <p className="text-xs text-stone-400 font-bold uppercase tracking-widest mt-1">Recipe: {brew.recipe?.name || 'Unknown'}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-4 relative z-10">
                        <div className="bg-stone-50 p-3 rounded-xl border border-stone-100">
                          <div className="flex items-center text-stone-400 mb-1">
                            <Clock size={14} className="mr-1.5" />
                            <span className="text-[9px] font-black uppercase tracking-widest">Time Elapsed</span>
                          </div>
                          <p className={`text-sm font-black ${progress.isComplete ? 'text-emerald-600' : 'text-stone-700'}`}>{progress.elapsedText}</p>
                        </div>
                        <div className="bg-stone-50 p-3 rounded-xl border border-stone-100">
                          <div className="flex items-center text-stone-400 mb-1">
                            <Droplets size={14} className="mr-1.5" />
                            <span className="text-[9px] font-black uppercase tracking-widest">Target Time</span>
                          </div>
                          <p className="text-sm font-black text-stone-700">
                            {brew.recipe?.brew_time_hours ? `${brew.recipe.brew_time_hours} Hours` : '24 Hours'}
                          </p>
                        </div>
                      </div>

                      <div className="w-full bg-stone-100 rounded-full h-2 mb-4 overflow-hidden shadow-inner border border-stone-200">
                        <div className={`h-full rounded-full transition-all duration-1000 ${progress.isComplete ? 'bg-emerald-500 w-full' : 'bg-amber-400 animate-pulse'}`} style={{ width: `${progress.percent}%` }}></div>
                      </div>

                      <div className="flex gap-2">
                        <button onClick={() => handleUpdateBrewStatus(brew.id, 'Applied')} className={`flex-1 text-white font-black uppercase tracking-widest text-[10px] py-3 rounded-xl shadow-md transition-colors ${progress.isComplete ? 'bg-emerald-600 hover:bg-emerald-500 animate-pulse' : 'bg-stone-800 hover:bg-stone-700'}`}>
                          Mark as Done & Apply
                        </button>
                        <button onClick={() => handleUpdateBrewStatus(brew.id, 'Dumped')} className="px-4 bg-stone-100 text-stone-500 font-black uppercase tracking-widest text-[10px] py-3 rounded-xl shadow-sm border border-stone-200 hover:bg-red-50 hover:text-red-500 transition-colors">
                          Dump
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {historyBrews.length > 0 && (
              <div className="mt-8">
                <h3 className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-3 px-1">Brew History</h3>
                <div className="space-y-2">
                  {historyBrews.slice(0, 10).map(brew => (
                    <div key={brew.id} className="bg-stone-100 border border-stone-200 rounded-2xl p-4 shadow-sm flex justify-between items-center">
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-stone-500 mb-0.5 block">
                          {new Date(brew.brew_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        <h4 className="text-sm font-black text-stone-700">{brew.custom_name}</h4>
                      </div>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${brew.status === 'Applied' ? 'bg-emerald-200 text-emerald-700' : 'bg-red-200 text-red-700'}`}>
                        {brew.status === 'Applied' ? '✓' : '🗑'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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

            {isLoading ? (
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
                          className="prose prose-sm prose-stone mb-4 max-w-none text-stone-600 line-clamp-2 break-words whitespace-pre-wrap"
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

      {/* --- START BREW MODAL --- */}
      {isStartingBrew && (
        <div className="fixed inset-0 z-50 bg-stone-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-purple-800 p-4 border-b border-purple-900 flex justify-between items-center">
              <h2 className="font-black text-white tracking-tight flex items-center gap-2"><PlayCircle size={20}/> Start Batch</h2>
              <button onClick={() => setIsStartingBrew(false)} className="p-1 rounded-full text-purple-300 hover:bg-purple-700 hover:text-white">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              {recipes.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-stone-500 text-sm font-medium mb-4">You need to create a recipe first!</p>
                  <button onClick={() => { setIsStartingBrew(false); setActiveTab('recipes'); }} className="text-purple-600 font-bold">Go to Recipes</button>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Select Recipe</label>
                    <select 
                      value={brewForm.recipe_id} 
                      onChange={e => {
                        const r = recipes.find(x => x.id === e.target.value);
                        setBrewForm({...brewForm, recipe_id: e.target.value, custom_name: r ? `Batch of ${r.name}` : ''});
                      }} 
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm font-bold text-stone-800 outline-none focus:border-purple-500 shadow-inner"
                    >
                      {recipes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Batch Name / Identifier</label>
                    <input 
                      type="text" 
                      value={brewForm.custom_name} 
                      onChange={e => setBrewForm({...brewForm, custom_name: e.target.value})}
                      className="w-full bg-white border border-stone-200 rounded-xl p-3 text-sm font-bold text-stone-800 outline-none focus:border-purple-500 shadow-sm" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Start Time</label>
                    <input 
                      type="datetime-local" 
                      value={brewForm.brew_start} 
                      onChange={e => setBrewForm({...brewForm, brew_start: e.target.value})}
                      className="w-full bg-white border border-stone-200 rounded-xl p-3 text-sm font-bold text-stone-800 outline-none focus:border-purple-500 shadow-sm" 
                    />
                  </div>

                  <button 
                    onClick={handleStartBrew}
                    disabled={!brewForm.recipe_id || !brewForm.custom_name}
                    className="w-full py-4 bg-purple-700 text-white rounded-xl font-black uppercase tracking-widest shadow-xl shadow-purple-900/20 active:scale-95 transition-all mt-4 disabled:opacity-50 hover:bg-purple-600 flex justify-center items-center gap-2"
                  >
                    <Flame size={16} /> Begin Brewing
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- FULL RECIPE VIEW MODAL --- */}
      {selectedRecipe && (() => {
         const styles = getTypeStyles(selectedRecipe.type);
         return (
          <div className="fixed inset-0 z-[60] bg-stone-900/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
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

              <div className="p-5 sm:p-6 overflow-y-auto space-y-8 bg-stone-50">
                {selectedRecipe.description && selectedRecipe.description !== '<p><br></p>' && (
                  <section>
                    <h3 className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-3 border-b border-stone-200 pb-2">Description / Purpose</h3>
                    <div 
                      className="prose prose-sm prose-stone max-w-none text-stone-700 bg-white p-5 rounded-2xl border border-stone-200 shadow-sm break-words whitespace-pre-wrap"
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
                      className="prose prose-sm prose-stone max-w-none text-stone-700 bg-white p-5 sm:p-6 rounded-2xl border border-stone-200 shadow-sm break-words whitespace-pre-wrap"
                      dangerouslySetInnerHTML={{ __html: selectedRecipe.instructions }} 
                    />
                  </section>
                )}
              </div>
            </div>
          </div>
         );
      })()}

      <style dangerouslySetInnerHTML={{__html: `
        .prose { word-break: break-word; overflow-wrap: break-word; }
        .prose p { margin-top: 0.25em; margin-bottom: 0.25em; white-space: pre-wrap; }
        .prose ul { margin-top: 0.25em; margin-bottom: 0.25em; padding-left: 1.25em; list-style-type: disc; }
        .prose ol { margin-top: 0.25em; margin-bottom: 0.25em; padding-left: 1.25em; list-style-type: decimal; }
        .prose strong { color: #1c1917; font-weight: 800; }
        .prose a { color: #7e22ce; word-break: break-all; }
      `}} />
    </div>
  );
}