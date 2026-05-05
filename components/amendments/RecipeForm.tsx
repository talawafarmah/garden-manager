'use client';

import React, { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '../../lib/supabase';
import { RecipeType, RecipeIngredient, Recipe } from '@/types/amendments';
import { ArrowLeft, Loader2, Plus, Trash2, Beaker, Flame, LeafyGreen, Sprout, Target, X, Check, Calculator, Search } from 'lucide-react';

const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false }) as React.ComponentType<any>;
// @ts-ignore
import 'react-quill-new/dist/quill.snow.css';

interface RecipeFormProps {
  onClose: () => void;
  onSuccess: () => void;
  initialData?: Recipe | null; 
  amendments?: any[]; 
}

// --- SMART AMOUNT PARSER (Handles fractions like "1/2") ---
const parseAmount = (amountStr: string | number) => {
  if (typeof amountStr === 'number') return amountStr;
  let parsedAmount = 0;
  const str = String(amountStr).trim();
  const parts = str.split(' ').filter(Boolean);
  for (const part of parts) {
    if (part.includes('/')) {
      const [num, den] = part.split('/');
      const n = parseFloat(num); const d = parseFloat(den);
      if (!isNaN(n) && !isNaN(d) && d !== 0) parsedAmount += (n / d);
    } else {
      const n = parseFloat(part);
      if (!isNaN(n)) parsedAmount += n;
    }
  }
  return parsedAmount;
};

// --- ROUGH VOLUME TO LBS CONVERTER FOR NPK MATH ---
const getIngredientPounds = (amount: number, unit: string) => {
  const u = (unit || '').toLowerCase();
  if (u === 'lb' || u === 'lbs') return amount;
  if (u === 'oz') return amount / 16;
  if (u === 'kg') return amount * 2.20462;
  if (u === 'g' || u === 'gram' || u === 'grams') return amount * 0.00220462;
  if (u === 'cup' || u === 'cups') return amount * 0.3; 
  if (u === 'tbsp' || u === 'tablespoon') return (amount * 0.3) / 16;
  if (u === 'tsp' || u === 'teaspoon') return (amount * 0.3) / 48;
  if (u === 'gal' || u === 'gallon' || u === 'gallons') return amount * 8; 
  if (u === 'ml' || u === 'milliliter') return amount * 0.0022;
  if (u === 'l' || u === 'liter' || u === 'liters') return amount * 2.2;
  if (u === 'part' || u === 'parts') return amount; 
  return amount; 
};

// --- NEW COMBINATORIAL NPK OPTIMIZER ---
interface NpkIngredient {
  id: string; name: string; brand: string; n: number; p: number; k: number;
}

const calculateOptimalDryMix = (
  ingredients: NpkIngredient[],
  targetN: number, targetP: number, targetK: number,
  totalAmount: number
) => {
  if (ingredients.length === 0) return [];
  if (targetN === 0 && targetP === 0 && targetK === 0) return [];

  const getCombos = (arr: any[], k: number): any[][] => {
    if (k === 1) return arr.map(a => [a]);
    const combos: any[][] = [];
    for (let i = 0; i < arr.length; i++) {
      const smaller = getCombos(arr.slice(i + 1), k - 1);
      for (const small of smaller) combos.push([arr[i], ...small]);
    }
    return combos;
  };

  const solveSubset = (subset: NpkIngredient[], iterations: number = 500) => {
    let weights = subset.map(() => 1.0); 
    const lr = 0.05; 

    for (let i = 0; i < iterations; i++) {
      let sumW = weights.reduce((a, b) => a + b, 0);
      if (sumW === 0) sumW = 0.0001; 

      let cN = weights.reduce((sum, w, idx) => sum + w * subset[idx].n, 0) / sumW;
      let cP = weights.reduce((sum, w, idx) => sum + w * subset[idx].p, 0) / sumW;
      let cK = weights.reduce((sum, w, idx) => sum + w * subset[idx].k, 0) / sumW;

      let eN = cN - targetN; let eP = cP - targetP; let eK = cK - targetK;

      for (let j = 0; j < weights.length; j++) {
        let gN = eN * (subset[j].n - cN) / sumW;
        let gP = eP * (subset[j].p - cP) / sumW;
        let gK = eK * (subset[j].k - cK) / sumW;
        weights[j] -= lr * (gN + gP + gK);
        if (weights[j] < 0) weights[j] = 0; 
      }
    }

    let sumW = weights.reduce((a, b) => a + b, 0) || 1;
    let cN = weights.reduce((sum, w, idx) => sum + w * subset[idx].n, 0) / sumW;
    let cP = weights.reduce((sum, w, idx) => sum + w * subset[idx].p, 0) / sumW;
    let cK = weights.reduce((sum, w, idx) => sum + w * subset[idx].k, 0) / sumW;
    let error = Math.abs(cN - targetN) + Math.abs(cP - targetP) + Math.abs(cK - targetK);
    
    return { weights, error, subset };
  };

  let bestSolution: any = null;
  let bestScore = Infinity;
  const maxK = Math.min(3, ingredients.length); 

  for (let k = 1; k <= maxK; k++) {
    const combos = getCombos(ingredients, k);
    for (const combo of combos) {
      const res = solveSubset(combo, 500);
      const score = res.error + (k * 0.2); 
      if (score < bestScore) {
        bestScore = score;
        bestSolution = res;
      }
    }
  }

  if (!bestSolution) return [];
  bestSolution = solveSubset(bestSolution.subset, 2000); 

  let finalSumW = bestSolution.weights.reduce((a: number, b: number) => a + b, 0) || 1;
  return bestSolution.subset.map((ing: any, idx: number) => ({
    ...ing,
    calculated_amount: Number(((bestSolution.weights[idx] / finalSumW) * totalAmount).toFixed(2))
  })).filter((ing: any) => ing.calculated_amount > 0.01); 
};


export default function RecipeForm({ onClose, onSuccess, initialData, amendments = [] }: RecipeFormProps) {
  const isEditing = !!initialData;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    type: initialData?.type || 'liquid_tea' as RecipeType,
    description: initialData?.description || '',
    instructions: initialData?.instructions || '',
    brew_time_hours: initialData?.brew_time_hours || 24,
    base_brew_gallons: initialData?.base_brew_gallons || 5,
    dilution_ratio: initialData?.dilution_ratio || 1,      
  });

  const [ingredients, setIngredients] = useState<any[]>(
    initialData?.ingredients?.length ? initialData.ingredients : []
  );

  // --- INGREDIENT PICKER MODAL STATE ---
  const [pickingForIndex, setPickingForIndex] = useState<number | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');

  const filteredAmendmentsForPicker = useMemo(() => {
    if (!pickerSearch.trim()) return amendments;
    const query = pickerSearch.toLowerCase();
    return amendments.filter(a => 
      a.name.toLowerCase().includes(query) || 
      (a.brand && a.brand.toLowerCase().includes(query)) ||
      (a.category && a.category.toLowerCase().includes(query))
    );
  }, [amendments, pickerSearch]);

  // --- NPK OPTIMIZER STATE ---
  const [showOptimizer, setShowOptimizer] = useState(false);
  const [targetN, setTargetN] = useState<number>(4);
  const [targetP, setTargetP] = useState<number>(4);
  const [targetK, setTargetK] = useState<number>(4);
  const [targetAmount, setTargetAmount] = useState<number>(10);
  const [targetUnit, setTargetUnit] = useState<string>('cups');

  const availableIngredientsForOpt = useMemo(() => {
    return amendments.filter(a => {
      if (a.is_empty) return false;
      if (formData.type === 'dry_mix') return a.physical_form === 'Granular/Dry' || a.physical_form === 'Powder';
      return true;
    }).map(a => ({
      id: a.id, name: a.name, brand: a.brand || '',
      n: Number(a.n_value) || 0, p: Number(a.p_value) || 0, k: Number(a.k_value) || 0
    }));
  }, [amendments, formData.type]);

  const [selectedOptIds, setSelectedOptIds] = useState<Set<string>>(
    new Set(availableIngredientsForOpt.map(a => a.id))
  );

  const toggleOptimizerIngredient = (id: string) => {
    const next = new Set(selectedOptIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedOptIds(next);
  };

  const optimizerResults = useMemo(() => {
    const activeIngredients = availableIngredientsForOpt.filter(ing => selectedOptIds.has(ing.id));
    return calculateOptimalDryMix(activeIngredients, targetN, targetP, targetK, targetAmount);
  }, [availableIngredientsForOpt, selectedOptIds, targetN, targetP, targetK, targetAmount]);

  const applyOptimizerToRecipe = () => {
      const newIngredients = optimizerResults.map((r: any) => ({
          amendment_id: r.id, 
          name: r.name,
          amount: r.calculated_amount.toString(),
          unit: targetUnit
      }));
      setIngredients(newIngredients); 
      setFormData(prev => ({
         ...prev, 
         base_brew_gallons: targetAmount,
      }));
      setShowOptimizer(false);
  };

  // --- CURRENT RECIPE LIVE NPK CALCULATION WITH FRACTION PARSING ---
  const currentRecipeNPK = useMemo(() => {
     let totalLbs = 0;
     let totalN = 0, totalP = 0, totalK = 0;

     ingredients.forEach(ing => {
        const am = amendments.find(a => a.id === ing.amendment_id || a.name === ing.name);
        if (am) {
           const parsedAmt = parseAmount(ing.amount);
           const lbs = getIngredientPounds(parsedAmt, ing.unit || 'lbs');
           totalLbs += lbs;
           totalN += lbs * (Number(am.n_value) || 0);
           totalP += lbs * (Number(am.p_value) || 0);
           totalK += lbs * (Number(am.k_value) || 0);
        }
     });

     if (totalLbs === 0) return { n: '0.0', p: '0.0', k: '0.0' };
     return {
        n: (totalN / totalLbs).toFixed(1),
        p: (totalP / totalLbs).toFixed(1),
        k: (totalK / totalLbs).toFixed(1),
     };
  }, [ingredients, amendments]);

  const handleAddIngredient = () => {
    setIngredients([...ingredients, { amendment_id: '', name: '', amount: '1', unit: 'cup' }]);
  };

  const handleUpdateIngredient = (index: number, field: string, value: string | number) => {
    const newIngredients = [...ingredients];
    newIngredients[index] = { ...newIngredients[index], [field]: value };
    setIngredients(newIngredients);
  };

  const handleRemoveIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return setError("Recipe name is required.");
    if (ingredients.filter(i => i.name.trim() !== '').length === 0) return setError("Add at least one ingredient.");

    const cleanedIngredients = ingredients.filter(i => i.name.trim() !== '');

    setIsSubmitting(true);
    setError(null);

    const payload = {
      name: formData.name.trim(),
      type: formData.type,
      description: formData.description.trim(),
      instructions: formData.instructions.trim(),
      brew_time_hours: formData.type === 'dry_mix' ? 0 : formData.brew_time_hours,
      base_brew_gallons: formData.base_brew_gallons, 
      dilution_ratio: formData.dilution_ratio,       
      ingredients: cleanedIngredients, 
    };

    let submitError;
    if (isEditing && initialData?.id) {
      const { error } = await supabase.from('recipes').update(payload).eq('id', initialData.id);
      submitError = error;
    } else {
      const { error } = await supabase.from('recipes').insert([payload]);
      submitError = error;
    }

    setIsSubmitting(false);
    if (submitError) setError(submitError.message);
    else onSuccess();
  };

  const getTypeIcon = (type: RecipeType) => {
    switch (type) {
      case 'liquid_tea': return <Beaker size={16} className="text-blue-500" />;
      case 'dry_mix': return <Sprout size={16} className="text-amber-600" />;
      case 'extract': return <LeafyGreen size={16} className="text-emerald-500" />;
      case 'ferment': return <Flame size={16} className="text-orange-500" />;
    }
  };

  const quillModules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{'list': 'ordered'}, {'list': 'bullet'}],
      ['clean']
    ],
  };

  const achievedWeight = optimizerResults.reduce((sum: number, r: any) => sum + r.calculated_amount, 0) || 1;
  const achievedN = (optimizerResults.reduce((sum: number, r: any) => sum + (r.calculated_amount * r.n), 0) / achievedWeight).toFixed(1);
  const achievedP = (optimizerResults.reduce((sum: number, r: any) => sum + (r.calculated_amount * r.p), 0) / achievedWeight).toFixed(1);
  const achievedK = (optimizerResults.reduce((sum: number, r: any) => sum + (r.calculated_amount * r.k), 0) / achievedWeight).toFixed(1);

  const canShowOptimizer = formData.type === 'dry_mix' || formData.type === 'liquid_tea';

  return (
    <div className="animate-in slide-in-from-bottom-4 duration-300 bg-stone-50 min-h-screen pb-24 relative">
      
      {/* --- INGREDIENT SEARCH & PICKER MODAL --- */}
      {pickingForIndex !== null && (
        <div className="fixed inset-0 z-[100] bg-stone-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
             
             {/* Modal Header & Search */}
             <div className="p-4 border-b border-stone-200 bg-stone-50 shrink-0">
               <div className="flex justify-between items-center mb-3">
                 <h3 className="font-black text-stone-800 flex items-center gap-2">
                    <Search size={18} className="text-purple-600" /> Select Amendment
                 </h3>
                 <button 
                    type="button" 
                    onClick={() => { setPickingForIndex(null); setPickerSearch(''); }} 
                    className="p-1 rounded-full text-stone-400 hover:bg-stone-200 hover:text-stone-800 transition-colors"
                 >
                    <X size={20}/>
                 </button>
               </div>
               <div className="relative">
                 <input 
                   type="text" 
                   placeholder="Search by name, brand, or NPK..." 
                   value={pickerSearch} 
                   onChange={e => setPickerSearch(e.target.value)}
                   className="w-full bg-white border border-stone-300 rounded-xl py-3 pl-10 pr-4 text-sm font-bold text-stone-800 outline-none focus:border-purple-500 shadow-sm"
                   autoFocus
                 />
                 <Search size={16} className="absolute left-3 top-3.5 text-stone-400" />
               </div>
             </div>
             
             {/* Filtered List */}
             <div className="overflow-y-auto p-2 space-y-1 bg-white flex-1">
                {filteredAmendmentsForPicker.map(am => (
                  <button
                    key={am.id}
                    type="button"
                    onClick={() => {
                       handleUpdateIngredient(pickingForIndex, 'amendment_id', am.id);
                       handleUpdateIngredient(pickingForIndex, 'name', am.name);
                       setPickingForIndex(null);
                       setPickerSearch('');
                    }}
                    className="w-full text-left p-3 rounded-xl hover:bg-purple-50 focus:bg-purple-50 transition-colors flex items-center justify-between group border border-transparent hover:border-purple-200"
                  >
                    <div className="min-w-0 pr-3">
                      <div className="font-bold text-sm text-stone-800 group-hover:text-purple-900 truncate">
                        {am.name}
                      </div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 truncate mt-0.5">
                        {am.brand || am.category || 'Unbranded'}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <span className="text-[9px] font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded border border-green-100 shadow-sm">N: {am.n_value || 0}</span>
                      <span className="text-[9px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 shadow-sm">P: {am.p_value || 0}</span>
                      <span className="text-[9px] font-bold text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100 shadow-sm">K: {am.k_value || 0}</span>
                    </div>
                  </button>
                ))}
                
                {filteredAmendmentsForPicker.length === 0 && (
                  <div className="text-center py-10">
                     <p className="text-stone-400 font-bold text-sm">No amendments found.</p>
                     <p className="text-stone-400 text-xs mt-1">Try a different search term.</p>
                  </div>
                )}
             </div>
          </div>
        </div>
      )}

      <header className="bg-white border-b border-stone-200 p-4 sticky top-0 z-20 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 -ml-2 text-stone-400 hover:bg-stone-100 hover:text-stone-800 rounded-full transition-colors">
            <ArrowLeft size={24} />
          </button>
          <h2 className="text-lg font-black text-stone-800">{isEditing ? 'Edit Master Recipe' : 'New Master Recipe'}</h2>
        </div>
      </header>

      <div className="max-w-xl mx-auto p-4 space-y-6 mt-2">
        {error && (
          <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm font-bold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-1">Recipe Identity</h3>
            <div className="bg-white p-5 rounded-3xl border border-stone-200 shadow-sm space-y-4">
              <div>
                <label className="block text-[10px] font-black text-stone-500 uppercase mb-1.5">Recipe Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Fungal Compost Tea"
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 font-bold text-stone-800 outline-none focus:border-purple-500 shadow-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-stone-500 uppercase mb-1.5">Type</label>
                  <div className="relative">
                    <select
                      value={formData.type}
                      onChange={e => setFormData({ ...formData, type: e.target.value as RecipeType })}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 font-bold text-stone-800 outline-none focus:border-purple-500 shadow-sm appearance-none pl-10"
                    >
                      <option value="liquid_tea">Liquid Brew / Tea</option>
                      <option value="dry_mix">Dry Mix</option>
                      <option value="extract">Botanical Extract</option>
                      <option value="ferment">Ferment (JADAM)</option>
                    </select>
                    <div className="absolute left-3 top-3.5 pointer-events-none">
                      {getTypeIcon(formData.type)}
                    </div>
                  </div>
                </div>

                {formData.type !== 'dry_mix' && (
                   <div className="animate-in fade-in zoom-in-95">
                     <label className="block text-[10px] font-black text-stone-500 uppercase mb-1.5">Brew/Cook Time</label>
                     <div className="relative flex bg-stone-50 border border-stone-200 rounded-xl overflow-hidden shadow-sm focus-within:border-purple-500">
                       <input
                         type="number"
                         min="0"
                         value={formData.brew_time_hours}
                         onChange={e => setFormData({ ...formData, brew_time_hours: Number(e.target.value) })}
                         className="w-full p-3 font-bold text-stone-800 outline-none bg-transparent"
                       />
                       <span className="bg-stone-100 px-4 py-3 text-xs font-bold text-stone-500 border-l border-stone-200 flex items-center pointer-events-none">Hours</span>
                     </div>
                   </div>
                )}
              </div>

              <div className="quill-container">
                <label className="block text-[10px] font-black text-stone-500 uppercase mb-1.5">Description / Purpose</label>
                <div className="bg-white rounded-xl overflow-hidden border border-stone-200 shadow-sm">
                  <ReactQuill 
                    theme="snow"
                    value={formData.description}
                    onChange={(val: any) => setFormData({ ...formData, description: val })}
                    modules={quillModules}
                    placeholder="What is this recipe best used for?"
                    className="h-32"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-1">Smart Scaling Rules</h3>
            <div className="bg-purple-50 p-4 sm:p-5 rounded-3xl border border-purple-100 shadow-sm space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-purple-500 uppercase mb-1.5">Base Yield Amount</label>
                  <div className="flex items-center gap-2 bg-white border border-purple-200 rounded-xl p-2 shadow-sm">
                    <input type="number" min="0.1" step="0.1" value={formData.base_brew_gallons || ''} onChange={e => setFormData({...formData, base_brew_gallons: Number(e.target.value)})} className="w-full text-center font-bold text-purple-900 outline-none" />
                    <span className="text-purple-400 font-bold text-xs pr-2">{formData.type === 'dry_mix' ? 'Lbs' : 'Gallons'}</span>
                  </div>
                  <p className="text-[9px] text-purple-400 mt-1.5 leading-tight">What amount does this ingredient list make naturally?</p>
                </div>
                
                <div>
                  <label className="block text-[10px] font-black text-purple-500 uppercase mb-1.5">Dilution Ratio</label>
                  <div className="flex items-center bg-white border border-purple-200 rounded-xl p-2 shadow-sm">
                    <span className="text-purple-400 font-black text-sm pl-3 pr-1 whitespace-nowrap">1 :</span>
                    <input type="number" min="1" value={formData.dilution_ratio || ''} onChange={e => setFormData({...formData, dilution_ratio: Number(e.target.value)})} className="w-full text-left font-bold text-purple-900 outline-none" />
                  </div>
                  <p className="text-[9px] text-purple-400 mt-1.5 leading-tight">e.g., '10' means 1 part {formData.type === 'dry_mix' ? 'mix' : 'concentrate'} to 10 parts {formData.type === 'dry_mix' ? 'soil' : 'water'}.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-end px-1 border-b border-purple-200/50 pb-2">
               <h3 className="text-[10px] font-black text-purple-800 uppercase tracking-widest">Ingredients List</h3>
               {canShowOptimizer && (
                  <button 
                    type="button" 
                    onClick={() => setShowOptimizer(!showOptimizer)} 
                    className="text-[10px] font-black uppercase tracking-widest bg-amber-100 text-amber-800 px-3 py-1.5 rounded-lg border border-amber-200 hover:bg-amber-200 transition-colors flex items-center gap-1 shadow-sm active:scale-95"
                  >
                    ✨ Auto-Balance NPK
                  </button>
               )}
            </div>

            {/* --- NPK OPTIMIZER WIDGET --- */}
            {canShowOptimizer && showOptimizer && (
               <div className="bg-white border border-stone-200 rounded-3xl p-5 shadow-sm mb-6 animate-in slide-in-from-top-4 duration-300">
                  <div className="flex justify-between items-center mb-4">
                     <h4 className="font-black text-amber-900 flex items-center gap-2 text-sm uppercase tracking-widest"><Target size={16} /> Target N-P-K</h4>
                     <button type="button" onClick={() => setShowOptimizer(false)} className="p-1 text-stone-400 hover:text-stone-700 rounded-full"><X size={16} /></button>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div>
                      <label className="block text-[9px] font-black text-green-700 uppercase tracking-widest mb-1 text-center">N</label>
                      <input type="number" min="0" value={targetN} onChange={e => setTargetN(Number(e.target.value))} className="w-full text-center bg-green-50 border border-green-200 rounded-xl py-2 font-black text-green-700 outline-none shadow-sm focus:border-green-400" />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-blue-700 uppercase tracking-widest mb-1 text-center">P</label>
                      <input type="number" min="0" value={targetP} onChange={e => setTargetP(Number(e.target.value))} className="w-full text-center bg-blue-50 border border-blue-200 rounded-xl py-2 font-black text-blue-700 outline-none shadow-sm focus:border-blue-400" />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-orange-700 uppercase tracking-widest mb-1 text-center">K</label>
                      <input type="number" min="0" value={targetK} onChange={e => setTargetK(Number(e.target.value))} className="w-full text-center bg-orange-50 border border-orange-200 rounded-xl py-2 font-black text-orange-700 outline-none shadow-sm focus:border-orange-400" />
                    </div>
                  </div>

                  <div className="mb-4">
                     <label className="block text-[9px] font-black text-stone-600 uppercase tracking-widest mb-1 text-center">Target Yield</label>
                     <div className="flex items-center gap-2 bg-stone-100 border border-stone-200 p-2 rounded-xl shadow-inner max-w-[200px] mx-auto focus-within:border-emerald-500">
                        <input type="number" min="1" value={targetAmount} onChange={e => setTargetAmount(Number(e.target.value))} className="w-full text-right bg-transparent py-1 font-black text-stone-800 outline-none" />
                        <select value={targetUnit} onChange={e => setTargetUnit(e.target.value)} className="bg-white border border-stone-300 rounded-lg px-2 py-1 text-xs font-bold text-stone-600 outline-none cursor-pointer appearance-none">
                           <optgroup label="Volume">
                             <option value="cups">Cups</option>
                             <option value="tbsp">Tbsp</option>
                             <option value="tsp">Tsp</option>
                             <option value="gal">Gallons</option>
                             <option value="L">Liters</option>
                             <option value="ml">ml</option>
                           </optgroup>
                           <optgroup label="Weight">
                             <option value="lbs">lbs</option>
                             <option value="kg">kg</option>
                             <option value="g">g</option>
                             <option value="oz">oz</option>
                           </optgroup>
                           <optgroup label="Other">
                             <option value="parts">Parts</option>
                             <option value="scoop">Scoops</option>
                           </optgroup>
                        </select>
                     </div>
                  </div>

                  <div className="bg-stone-50 rounded-2xl border border-stone-200 p-4 mb-4">
                     <p className="text-[9px] font-black uppercase tracking-widest text-stone-400 mb-2">Inventory to Use</p>
                     <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 scrollbar-hide">
                        {availableIngredientsForOpt.length === 0 ? (
                           <p className="text-xs text-stone-400 text-center py-2 italic">No available amendments in shed.</p>
                        ) : (
                           availableIngredientsForOpt.map(ing => (
                              <label key={ing.id} onClick={(e) => { e.preventDefault(); toggleOptimizerIngredient(ing.id); }} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${selectedOptIds.has(ing.id) ? 'bg-white border-emerald-200 shadow-sm' : 'bg-transparent border-transparent opacity-60'}`}>
                                 <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border ${selectedOptIds.has(ing.id) ? 'bg-emerald-500 border-emerald-600' : 'bg-white border-stone-300'}`}>
                                    {selectedOptIds.has(ing.id) && <Check size={14} className="text-white" />}
                                 </div>
                                 <div className="flex-1 min-w-0">
                                     <span className="text-sm font-bold text-stone-800 block truncate">{ing.name}</span>
                                     <span className="text-[9px] text-stone-400 uppercase tracking-widest block truncate">{ing.brand}</span>
                                 </div>
                                 <span className="text-[10px] font-mono font-bold text-stone-500 bg-stone-100 px-2 py-1 rounded border border-stone-200 shrink-0">{ing.n}-{ing.p}-{ing.k}</span>
                              </label>
                           ))
                        )}
                     </div>
                  </div>

                  <div className="bg-amber-100/50 border border-amber-200 rounded-2xl p-4 text-center">
                     <p className="text-[9px] font-black uppercase tracking-widest text-amber-700 mb-1">Estimated Result</p>
                     <p className="text-3xl font-black text-amber-900">{achievedN} - {achievedP} - {achievedK}</p>
                     
                     <button type="button" onClick={applyOptimizerToRecipe} className="w-full mt-4 bg-amber-500 text-white font-black uppercase tracking-widest py-3.5 rounded-xl shadow-md active:scale-95 transition-transform text-xs hover:bg-amber-600">
                        Apply to Recipe
                     </button>
                  </div>
               </div>
            )}
            
            <div className="bg-stone-50 p-4 rounded-3xl border border-stone-200 shadow-inner space-y-3">
              
              {/* --- LIVE RECIPE NPK DISPLAY --- */}
              <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-stone-200 shadow-sm mb-4">
                 <div className="flex items-center gap-2">
                    <Calculator size={16} className="text-purple-600" />
                    <span className="text-xs font-black text-stone-600 uppercase tracking-widest">Recipe NPK</span>
                 </div>
                 <div className="text-sm font-black text-purple-700 bg-purple-50 px-3 py-1 rounded-lg border border-purple-100">
                    {currentRecipeNPK.n} - {currentRecipeNPK.p} - {currentRecipeNPK.k}
                 </div>
              </div>

              {ingredients.length === 0 ? (
                 <div className="text-center py-8 text-stone-400 text-sm italic">No ingredients added yet.</div>
              ) : (
                 ingredients.map((ing, idx) => {
                   const matchedAmendment = amendments.find(a => a.id === ing.amendment_id || a.name === ing.name);

                   return (
                     <div key={idx} className="flex gap-2 items-start bg-white p-3 rounded-2xl border border-stone-200 relative group animate-in slide-in-from-left-2 shadow-sm">
                       <div className="flex-1 space-y-2">
                         
                         {/* --- NEW SEARCHABLE PICKER BUTTON --- */}
                         <button
                           type="button"
                           onClick={() => setPickingForIndex(idx)}
                           className={`w-full flex items-center justify-between bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm outline-none focus:border-purple-500 shadow-sm transition-colors ${matchedAmendment ? 'text-stone-800 font-bold hover:bg-stone-100' : 'text-stone-400 font-medium italic hover:bg-white'}`}
                         >
                           <span className="truncate pr-2">{matchedAmendment ? matchedAmendment.name : "Tap to select amendment..."}</span>
                           <Search size={16} className="text-stone-400 shrink-0" />
                         </button>
                         
                         {matchedAmendment && (
                            <div className="flex gap-1.5 ml-1 mb-2">
                              <span className="text-[9px] font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded border border-green-100 shadow-sm">N: {matchedAmendment.n_value || 0}</span>
                              <span className="text-[9px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 shadow-sm">P: {matchedAmendment.p_value || 0}</span>
                              <span className="text-[9px] font-bold text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100 shadow-sm">K: {matchedAmendment.k_value || 0}</span>
                            </div>
                         )}

                         <div className="flex gap-2">
                           <input
                             type="text"
                             placeholder="Qty"
                             value={ing.amount}
                             onChange={e => handleUpdateIngredient(idx, 'amount', e.target.value)}
                             className="w-24 bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm font-black text-purple-700 text-center outline-none focus:border-purple-500 shadow-sm"
                           />
                           
                           <select
                             value={ing.unit}
                             onChange={e => handleUpdateIngredient(idx, 'unit', e.target.value)}
                             className="flex-1 bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs font-black text-stone-500 uppercase tracking-wider outline-none focus:border-purple-500 shadow-sm appearance-none cursor-pointer"
                           >
                             <optgroup label="Volume (US)">
                               <option value="tsp">tsp</option>
                               <option value="tbsp">tbsp</option>
                               <option value="fl oz">fl oz</option>
                               <option value="cups">cups</option>
                               <option value="pt">pint</option>
                               <option value="qt">quart</option>
                               <option value="gal">gallon</option>
                             </optgroup>
                             <optgroup label="Volume (Metric)">
                               <option value="ml">ml</option>
                               <option value="L">liter</option>
                             </optgroup>
                             <optgroup label="Weight">
                               <option value="oz">oz</option>
                               <option value="lbs">lbs</option>
                               <option value="g">gram</option>
                               <option value="kg">kg</option>
                             </optgroup>
                             <optgroup label="Other">
                               <option value="parts">parts</option>
                               <option value="scoop">scoops</option>
                               <option value="handful">handfuls</option>
                             </optgroup>
                           </select>
                         </div>
                       </div>
                       
                       <button type="button" onClick={() => handleRemoveIngredient(idx)} className="w-10 h-10 flex flex-shrink-0 items-center justify-center bg-stone-50 border border-stone-200 text-stone-400 rounded-xl hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors mt-1">
                         <Trash2 size={16} />
                       </button>
                     </div>
                   );
                 })
              )}

              <button 
                type="button" 
                onClick={handleAddIngredient}
                className="w-full py-4 bg-white text-stone-500 text-xs font-black uppercase tracking-widest rounded-2xl border-2 border-stone-200 border-dashed hover:bg-stone-100 hover:border-stone-300 transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={16} /> Add Ingredient
              </button>
            </div>
          </div>

          <div className="space-y-4 quill-container">
            <h3 className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-1">Brewing / Mixing Instructions</h3>
            <div className="bg-white rounded-3xl overflow-hidden border border-stone-200 shadow-sm">
               <ReactQuill 
                  theme="snow"
                  value={formData.instructions}
                  onChange={(val: any) => setFormData({ ...formData, instructions: val })}
                  modules={quillModules}
                  placeholder="Step-by-step instructions..."
                  className="h-40"
                />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-purple-700 text-white font-black uppercase tracking-widest py-4 rounded-2xl shadow-xl shadow-purple-900/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-purple-600 transition-all mt-4"
          >
            {isSubmitting ? (
              <><Loader2 size={20} className="animate-spin" /> Saving Recipe...</>
            ) : (
              isEditing ? 'Update Master Recipe' : 'Save Master Recipe'
            )}
          </button>
        </form>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .quill-container .ql-toolbar {
          border: none !important;
          border-bottom: 1px solid #e5e7eb !important;
          background-color: #fafaf9;
          padding: 12px !important;
        }
        .quill-container .ql-container {
          border: none !important;
          font-family: inherit;
          font-size: 0.875rem;
        }
        .quill-container .ql-editor {
          min-height: 100%;
          color: #292524 !important; 
          font-weight: 500;
          padding: 16px !important;
        }
        .quill-container .ql-editor.ql-blank::before {
          color: #a8a29e !important; 
          font-style: normal;
        }
      `}} />
    </div>
  );
}