import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AppView, FarmAmendment, TeaRecipe, ActiveBrew, TeaIngredient } from '../types';

interface Props {
  navigateTo: (view: AppView, payload?: any) => void;
  handleGoBack: (view: AppView) => void;
}

export default function Apothecary({ navigateTo, handleGoBack }: Props) {
  const [activeTab, setActiveTab] = useState<'INVENTORY' | 'RECIPES' | 'BREWERY'>('BREWERY');
  const [isLoading, setIsLoading] = useState(true);

  // Data
  const [amendments, setAmendments] = useState<FarmAmendment[]>([]);
  const [recipes, setRecipes] = useState<TeaRecipe[]>([]);
  const [brews, setBrews] = useState<ActiveBrew[]>([]);

  // Modals & Forms
  const [isAmendmentModalOpen, setIsAmendmentModalOpen] = useState(false);
  const [amendmentForm, setAmendmentForm] = useState<Partial<FarmAmendment>>({ name: '', category: 'Dry Amendment', qty_in_stock: 0, unit: 'lbs' });

  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
  const [recipeForm, setRecipeForm] = useState<Partial<TeaRecipe>>({ name: '', purpose: 'Fungal', steep_time_hours: 24, ingredients: [] });

  const [isBrewModalOpen, setIsBrewModalOpen] = useState(false);
  const [brewForm, setBrewForm] = useState<{ recipe_id: string, gallons: number }>({ recipe_id: '', gallons: 5 });

  const AMENDMENT_CATEGORIES = ['Dry Amendment', 'Liquid', 'Compost/Casting', 'Microbial', 'Mineral'];
  const UNITS = ['lbs', 'oz', 'gal', 'cups', 'tbsp', 'ml'];
  const RECIPE_PURPOSES = ['Fungal', 'Bacterial', 'Veg', 'Bloom', 'All-Purpose'];

  useEffect(() => {
    fetchApothecaryData();
  }, []);

  const fetchApothecaryData = async () => {
    setIsLoading(true);
    const [amendRes, recipeRes, brewRes] = await Promise.all([
      supabase.from('farm_amendments').select('*').order('name'),
      supabase.from('tea_recipes').select('*').order('name'),
      supabase.from('active_brews').select('*, recipe:tea_recipes(*)').order('brew_end', { ascending: true })
    ]);

    if (amendRes.data) setAmendments(amendRes.data);
    if (recipeRes.data) setRecipes(recipeRes.data);
    if (brewRes.data) setBrews(brewRes.data);
    setIsLoading(false);
  };

  // --- AMENDMENTS CRUD ---
  const handleSaveAmendment = async () => {
    if (!amendmentForm.name) return;
    const { data, error } = await supabase.from('farm_amendments').insert([amendmentForm]).select().single();
    if (data) {
      setAmendments([...amendments, data]);
      setIsAmendmentModalOpen(false);
      setAmendmentForm({ name: '', category: 'Dry Amendment', qty_in_stock: 0, unit: 'lbs' });
    } else { alert(error?.message); }
  };

  const handleUpdateStock = async (id: string, delta: number) => {
    const item = amendments.find(a => a.id === id);
    if (!item) return;
    const newQty = Math.max(0, item.qty_in_stock + delta);
    setAmendments(amendments.map(a => a.id === id ? { ...a, qty_in_stock: newQty } : a));
    await supabase.from('farm_amendments').update({ qty_in_stock: newQty }).eq('id', id);
  };

  // --- RECIPES CRUD ---
  const handleAddIngredientToRecipe = (amendmentId: string) => {
    const item = amendments.find(a => a.id === amendmentId);
    if (!item) return;
    const currentIngredients = recipeForm.ingredients || [];
    if (!currentIngredients.find(i => i.amendment_id === amendmentId)) {
      setRecipeForm({
        ...recipeForm,
        ingredients: [...currentIngredients, { amendment_id: item.id, name: item.name, qty: 1, unit: item.unit || 'cups' }]
      });
    }
  };

  const handleUpdateRecipeIngredient = (amendmentId: string, qty: number, unit: string) => {
    const updated = (recipeForm.ingredients || []).map(i => i.amendment_id === amendmentId ? { ...i, qty, unit } : i);
    setRecipeForm({ ...recipeForm, ingredients: updated });
  };

  const handleSaveRecipe = async () => {
    if (!recipeForm.name) return;
    const { data, error } = await supabase.from('tea_recipes').insert([recipeForm]).select().single();
    if (data) {
      setRecipes([...recipes, data]);
      setIsRecipeModalOpen(false);
      setRecipeForm({ name: '', purpose: 'Fungal', steep_time_hours: 24, ingredients: [] });
    } else { alert(error?.message); }
  };

  // --- BREWERY CRUD ---
  const handleStartBrew = async () => {
    if (!brewForm.recipe_id) return;
    const recipe = recipes.find(r => r.id === brewForm.recipe_id);
    if (!recipe) return;

    const start = new Date();
    const end = new Date(start.getTime() + recipe.steep_time_hours * 60 * 60 * 1000);

    const newBrew = {
      recipe_id: recipe.id,
      brew_start: start.toISOString(),
      brew_end: end.toISOString(),
      status: 'Brewing',
      gallons_brewed: brewForm.gallons
    };

    const { data, error } = await supabase.from('active_brews').insert([newBrew]).select('*, recipe:tea_recipes(*)').single();
    if (data) {
      setBrews([...brews, data]);
      setIsBrewModalOpen(false);
      
      // Auto-deduct inventory (Basic 1:1 deduction for MVP)
      const updates = recipe.ingredients.map(ing => {
        const stockItem = amendments.find(a => a.id === ing.amendment_id);
        if (stockItem && stockItem.unit === ing.unit) {
          const newQty = Math.max(0, stockItem.qty_in_stock - ing.qty);
          return supabase.from('farm_amendments').update({ qty_in_stock: newQty }).eq('id', stockItem.id);
        }
        return Promise.resolve();
      });
      await Promise.all(updates);
      fetchApothecaryData(); // Refresh to get accurate stock levels
    } else {
      alert(error?.message);
    }
  };

  const handleBrewAction = async (id: string, newStatus: string) => {
    setBrews(brews.map(b => b.id === id ? { ...b, status: newStatus } : b));
    await supabase.from('active_brews').update({ status: newStatus }).eq('id', id);
  };

  // Helper: Live Countdown Text
  const getCountdown = (endDateStr: string) => {
    const end = new Date(endDateStr).getTime();
    const now = new Date().getTime();
    const diff = end - now;
    if (diff <= 0) return 'Ready!';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m remaining`;
  };

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900 pb-32 font-sans relative">
      <header className="bg-purple-900 text-white p-4 shadow-md sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => handleGoBack('dashboard')} className="p-2 bg-purple-800 rounded-full hover:bg-purple-700 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h1 className="text-xl font-bold">Apothecary</h1>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white p-2 shadow-sm border-b border-stone-200 sticky top-[72px] z-10 flex gap-2">
        {['BREWERY', 'RECIPES', 'INVENTORY'].map(tab => (
          <button 
            key={tab} 
            onClick={() => setActiveTab(tab as any)} 
            className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === tab ? 'bg-purple-100 text-purple-800 shadow-sm' : 'text-stone-400 hover:bg-stone-50'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="max-w-3xl mx-auto p-4 mt-2">
        {isLoading ? (
           <div className="flex justify-center py-20 text-purple-400"><svg className="w-10 h-10 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>
        ) : (
          <>
            {/* INVENTORY TAB */}
            {activeTab === 'INVENTORY' && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <button onClick={() => setIsAmendmentModalOpen(true)} className="w-full py-4 bg-white border border-stone-200 text-purple-600 rounded-xl font-black uppercase tracking-widest shadow-sm hover:border-purple-300 transition-colors flex items-center justify-center gap-2">
                  + Add New Amendment
                </button>
                
                {amendments.length === 0 ? <p className="text-center py-10 text-stone-400 italic">No inventory tracked yet.</p> : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {amendments.map(item => (
                      <div key={item.id} className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="font-bold text-stone-800 text-lg leading-tight">{item.name}</h3>
                            <span className="text-[9px] font-black uppercase tracking-widest text-stone-400">{item.category}</span>
                          </div>
                          {item.npk && <span className="bg-emerald-50 text-emerald-700 text-[10px] font-black px-2 py-1 rounded shadow-sm border border-emerald-100">NPK: {item.npk}</span>}
                        </div>
                        <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Stock</span>
                          <div className="flex items-center gap-3">
                            <button onClick={() => handleUpdateStock(item.id, -1)} className="w-8 h-8 flex items-center justify-center bg-stone-100 rounded-lg text-stone-500 hover:bg-red-100 hover:text-red-600 font-black transition-colors">-</button>
                            <span className="font-black text-lg text-stone-800 min-w-[60px] text-center">{item.qty_in_stock} <span className="text-xs text-stone-500 font-bold">{item.unit}</span></span>
                            <button onClick={() => handleUpdateStock(item.id, 1)} className="w-8 h-8 flex items-center justify-center bg-stone-100 rounded-lg text-stone-500 hover:bg-emerald-100 hover:text-emerald-600 font-black transition-colors">+</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* RECIPES TAB */}
            {activeTab === 'RECIPES' && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <button onClick={() => setIsRecipeModalOpen(true)} className="w-full py-4 bg-white border border-stone-200 text-purple-600 rounded-xl font-black uppercase tracking-widest shadow-sm hover:border-purple-300 transition-colors flex items-center justify-center gap-2">
                  + Create Tea Recipe
                </button>

                {recipes.length === 0 ? <p className="text-center py-10 text-stone-400 italic">No recipes created yet.</p> : (
                  <div className="space-y-4">
                    {recipes.map(recipe => (
                      <div key={recipe.id} className="bg-white p-5 rounded-3xl shadow-sm border border-stone-200">
                        <div className="flex justify-between items-start border-b border-stone-100 pb-3 mb-3">
                          <div>
                            <h3 className="font-black text-xl text-stone-800">{recipe.name}</h3>
                            <span className="bg-purple-100 text-purple-800 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded shadow-sm inline-block mt-1">{recipe.purpose}</span>
                          </div>
                          <div className="text-right">
                            <span className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-0.5">Steep Time</span>
                            <span className="font-black text-lg text-stone-700">{recipe.steep_time_hours}h</span>
                          </div>
                        </div>
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Ingredients / 5 Gallons</h4>
                        <ul className="space-y-1.5">
                          {recipe.ingredients.map((ing, i) => (
                            <li key={i} className="flex justify-between items-center text-sm bg-stone-50 p-2 rounded-lg border border-stone-100">
                              <span className="font-bold text-stone-700">{ing.name}</span>
                              <span className="font-black text-stone-500">{ing.qty} {ing.unit}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* BREWERY TAB */}
            {activeTab === 'BREWERY' && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <button onClick={() => setIsBrewModalOpen(true)} className="w-full py-4 bg-purple-600 text-white rounded-xl font-black uppercase tracking-widest shadow-xl shadow-purple-900/20 active:scale-95 transition-all flex items-center justify-center gap-2 hover:bg-purple-500">
                  ⚗️ Start New Brew
                </button>

                {brews.filter(b => b.status !== 'Dumped').length === 0 ? (
                  <div className="text-center py-20 bg-white rounded-3xl border border-stone-200 shadow-sm">
                    <div className="text-4xl mb-3 opacity-50">🧪</div>
                    <h2 className="text-lg font-black text-stone-800">Brewery is Empty</h2>
                    <p className="text-stone-500 text-sm mt-1">Start a compost tea to begin the timer.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {brews.filter(b => b.status !== 'Dumped').map(brew => {
                      const isReady = new Date(brew.brew_end).getTime() <= new Date().getTime();
                      return (
                        <div key={brew.id} className={`p-5 rounded-3xl shadow-sm border transition-colors ${brew.status === 'Applied' ? 'bg-stone-50 border-stone-200 opacity-60' : isReady ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-purple-200'}`}>
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h3 className="font-black text-xl text-stone-800">{brew.recipe?.name || 'Custom Brew'}</h3>
                              <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mt-1">{brew.gallons_brewed} Gallon Batch</p>
                            </div>
                            <div className="text-right">
                              <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded shadow-sm ${brew.status === 'Applied' ? 'bg-stone-200 text-stone-600' : isReady ? 'bg-emerald-500 text-white animate-pulse' : 'bg-purple-100 text-purple-800'}`}>
                                {brew.status === 'Brewing' && isReady ? 'Ready!' : brew.status}
                              </span>
                            </div>
                          </div>

                          {brew.status === 'Brewing' && (
                            <div className="bg-stone-100 p-4 rounded-2xl border border-stone-200 text-center mb-4">
                              <span className="block text-[9px] font-black uppercase tracking-widest text-stone-400 mb-1">Time Remaining</span>
                              <span className={`text-2xl font-black ${isReady ? 'text-emerald-600' : 'text-purple-600'}`}>{getCountdown(brew.brew_end)}</span>
                            </div>
                          )}

                          {brew.status !== 'Applied' && (
                            <div className="flex gap-2">
                              {isReady && brew.status !== 'Applied' && (
                                <button onClick={() => handleBrewAction(brew.id, 'Applied')} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:bg-emerald-500 transition-colors">
                                  Mark Applied
                                </button>
                              )}
                              <button onClick={() => handleBrewAction(brew.id, 'Dumped')} className="px-4 py-3 bg-white border border-stone-200 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:bg-red-50 transition-colors">
                                Dump
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* AMENDMENT MODAL */}
      {isAmendmentModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-stone-100 p-4 border-b border-stone-200 flex justify-between items-center">
              <h2 className="font-black text-stone-800 tracking-tight">Add Inventory</h2>
              <button onClick={() => setIsAmendmentModalOpen(false)} className="p-1 rounded-full text-stone-400 hover:bg-stone-200 hover:text-stone-800"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Product Name</label>
                <input type="text" autoFocus value={amendmentForm.name} onChange={(e) => setAmendmentForm({...amendmentForm, name: e.target.value})} placeholder="e.g., Kelp Meal, Fish Emulsion" className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 font-bold outline-none focus:border-purple-500 shadow-inner" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Category</label>
                  <select value={amendmentForm.category} onChange={e => setAmendmentForm({...amendmentForm, category: e.target.value})} className="w-full bg-white border border-stone-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-purple-500 shadow-sm appearance-none">
                    {AMENDMENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">NPK (Optional)</label>
                  <input type="text" value={amendmentForm.npk || ''} onChange={(e) => setAmendmentForm({...amendmentForm, npk: e.target.value})} placeholder="e.g., 4-4-4" className="w-full bg-white border border-stone-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-purple-500 shadow-sm text-center" />
                </div>
              </div>
              <div className="bg-stone-50 p-4 rounded-xl border border-stone-200">
                <label className="block text-[10px] font-black text-stone-500 uppercase tracking-widest mb-3 text-center">Initial Stock Qty</label>
                <div className="flex items-center gap-2">
                  <input type="number" min="0" step="0.1" value={amendmentForm.qty_in_stock || ''} onChange={(e) => setAmendmentForm({...amendmentForm, qty_in_stock: Number(e.target.value)})} className="w-full text-center bg-white border border-stone-200 rounded-lg p-2 font-bold outline-none focus:border-purple-500 shadow-sm" />
                  <select value={amendmentForm.unit} onChange={e => setAmendmentForm({...amendmentForm, unit: e.target.value})} className="bg-stone-200 text-stone-700 font-bold border-none rounded-lg p-2 outline-none appearance-none cursor-pointer">
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={handleSaveAmendment} disabled={!amendmentForm.name} className="w-full py-4 bg-purple-600 text-white rounded-xl font-black uppercase tracking-widest shadow-xl shadow-purple-900/20 active:scale-95 transition-all mt-2 disabled:opacity-50 hover:bg-purple-500">
                Save to Inventory
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECIPE MODAL */}
      {isRecipeModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="bg-stone-100 p-4 border-b border-stone-200 flex justify-between items-center shrink-0">
              <h2 className="font-black text-stone-800 tracking-tight">Create Brew Recipe</h2>
              <button onClick={() => setIsRecipeModalOpen(false)} className="p-1 rounded-full text-stone-400 hover:bg-stone-200 hover:text-stone-800"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Recipe Name</label>
                <input type="text" autoFocus value={recipeForm.name} onChange={(e) => setRecipeForm({...recipeForm, name: e.target.value})} placeholder="e.g., Fungal Dominated Veg Tea" className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 font-bold outline-none focus:border-purple-500 shadow-inner" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Purpose</label>
                  <select value={recipeForm.purpose} onChange={e => setRecipeForm({...recipeForm, purpose: e.target.value})} className="w-full bg-white border border-stone-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-purple-500 shadow-sm appearance-none">
                    {RECIPE_PURPOSES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Steep (Hours)</label>
                  <input type="number" min="1" value={recipeForm.steep_time_hours || ''} onChange={(e) => setRecipeForm({...recipeForm, steep_time_hours: Number(e.target.value)})} className="w-full bg-white border border-stone-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-purple-500 shadow-sm text-center" />
                </div>
              </div>
              
              <div className="bg-stone-50 p-4 rounded-xl border border-stone-200">
                <label className="block text-[10px] font-black text-stone-500 uppercase tracking-widest mb-3">Ingredients (Per 5 Gal)</label>
                
                <div className="space-y-2 mb-3">
                  {(recipeForm.ingredients || []).map((ing, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-stone-200 shadow-sm">
                      <span className="flex-1 text-xs font-bold text-stone-700 truncate">{ing.name}</span>
                      <input type="number" min="0.1" step="0.1" value={ing.qty} onChange={e => handleUpdateRecipeIngredient(ing.amendment_id, Number(e.target.value), ing.unit)} className="w-14 text-center border-b border-stone-300 bg-transparent text-xs font-black outline-none focus:border-purple-500" />
                      <select value={ing.unit} onChange={e => handleUpdateRecipeIngredient(ing.amendment_id, ing.qty, e.target.value)} className="bg-stone-100 text-[10px] font-bold p-1 rounded outline-none appearance-none">
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                      <button onClick={() => setRecipeForm({...recipeForm, ingredients: recipeForm.ingredients?.filter(i => i.amendment_id !== ing.amendment_id)})} className="text-red-400 hover:text-red-600"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                    </div>
                  ))}
                </div>

                <select onChange={e => { if(e.target.value) handleAddIngredientToRecipe(e.target.value); e.target.value = ''; }} className="w-full bg-white border border-stone-200 rounded-lg p-2 text-xs font-bold text-purple-600 outline-none focus:border-purple-500 shadow-sm">
                  <option value="">+ Add Ingredient...</option>
                  {amendments.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>

              <button onClick={handleSaveRecipe} disabled={!recipeForm.name} className="w-full py-4 bg-purple-600 text-white rounded-xl font-black uppercase tracking-widest shadow-xl shadow-purple-900/20 active:scale-95 transition-all mt-2 disabled:opacity-50 hover:bg-purple-500">
                Save Recipe
              </button>
            </div>
          </div>
        </div>
      )}

      {/* START BREW MODAL */}
      {isBrewModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-purple-900 p-4 border-b border-purple-950 flex justify-between items-center">
              <h2 className="font-black text-white tracking-tight flex items-center gap-2">⚗️ Start Brew</h2>
              <button onClick={() => setIsBrewModalOpen(false)} className="p-1 rounded-full text-purple-300 hover:bg-purple-700 hover:text-white"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Select Recipe</label>
                <select value={brewForm.recipe_id} onChange={e => setBrewForm({...brewForm, recipe_id: e.target.value})} className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm font-bold text-stone-800 outline-none focus:border-purple-500 shadow-inner">
                  <option value="">-- Choose Recipe --</option>
                  {recipes.map(r => <option key={r.id} value={r.id}>{r.name} ({r.steep_time_hours}h)</option>)}
                </select>
              </div>

              <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 text-center">
                <span className="block text-[9px] font-black uppercase tracking-widest text-stone-400 mb-1">Batch Size</span>
                <div className="flex items-center justify-center gap-2">
                  <input type="number" min="1" value={brewForm.gallons || ''} onChange={(e) => setBrewForm({...brewForm, gallons: Number(e.target.value)})} className="w-20 text-center bg-white border border-stone-200 rounded-lg p-2 text-xl font-black outline-none focus:border-purple-500 shadow-sm text-purple-700" />
                  <span className="font-bold text-stone-500">Gallons</span>
                </div>
              </div>
              
              <p className="text-[10px] text-stone-400 text-center font-bold px-4">Starting this brew will begin the timer and deduct matching ingredients from your inventory.</p>

              <button onClick={handleStartBrew} disabled={!brewForm.recipe_id || brewForm.gallons < 1} className="w-full py-4 bg-purple-600 text-white rounded-xl font-black uppercase tracking-widest shadow-xl shadow-purple-900/20 active:scale-95 transition-all mt-4 disabled:opacity-50 hover:bg-purple-500">
                Start Timer
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}