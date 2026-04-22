'use client';

import React, { useState, useMemo } from 'react';
import { calculateOptimalDryMix, NpkIngredient } from '../../lib/npkCalculator';
import { Calculator, Target, Info, Check } from 'lucide-react';

interface DryMixCalculatorProps {
  amendments: any[];
}

export default function DryMixCalculator({ amendments }: DryMixCalculatorProps) {
  const [targetN, setTargetN] = useState<number>(4);
  const [targetP, setTargetP] = useState<number>(4);
  const [targetK, setTargetK] = useState<number>(4);
  const [targetWeight, setTargetWeight] = useState<number>(10);

  // Automatically filter out Liquid/Soluble forms AND empty containers
  const availableDryIngredients = useMemo(() => {
    return amendments.filter(a => 
      !a.is_empty && 
      (a.physical_form === 'Granular/Dry' || a.physical_form === 'Powder')
    ).map(a => ({
      id: a.id,
      name: a.name,
      brand: a.brand || '',
      n: Number(a.n_value) || 0,
      p: Number(a.p_value) || 0,
      k: Number(a.k_value) || 0
    }));
  }, [amendments]);

  // User can uncheck specific ingredients if they don't want to use them in the mix
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(availableDryIngredients.map(a => a.id))
  );

  const toggleIngredient = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const results = useMemo(() => {
    const activeIngredients = availableDryIngredients.filter(ing => selectedIds.has(ing.id));
    return calculateOptimalDryMix(activeIngredients, targetN, targetP, targetK, targetWeight);
  }, [availableDryIngredients, selectedIds, targetN, targetP, targetK, targetWeight]);

  // Calculate the *Actual* NPK achieved by mixing these pounds together
  const totalAchievedWeight = results.reduce((sum, r) => sum + r.calculated_lbs, 0) || 1;
  const achievedN = (results.reduce((sum, r) => sum + (r.calculated_lbs * r.n), 0) / totalAchievedWeight).toFixed(1);
  const achievedP = (results.reduce((sum, r) => sum + (r.calculated_lbs * r.p), 0) / totalAchievedWeight).toFixed(1);
  const achievedK = (results.reduce((sum, r) => sum + (r.calculated_lbs * r.k), 0) / totalAchievedWeight).toFixed(1);

  return (
    <div className="space-y-6 animate-in fade-in pb-20">
      
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 shadow-sm">
        <h2 className="flex items-center gap-2 font-black text-emerald-900 mb-4">
          <Target size={20} /> Set Your Target
        </h2>
        
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div>
            <label className="block text-[10px] font-black text-green-700 uppercase tracking-widest mb-1 text-center">Nitrogen (N)</label>
            <input type="number" min="0" step="1" value={targetN} onChange={e => setTargetN(Number(e.target.value))} className="w-full text-center bg-white border border-green-300 rounded-xl py-3 text-xl font-black text-green-700 outline-none focus:ring-2 focus:ring-green-500 shadow-sm" />
          </div>
          <div>
            <label className="block text-[10px] font-black text-blue-700 uppercase tracking-widest mb-1 text-center">Phos (P)</label>
            <input type="number" min="0" step="1" value={targetP} onChange={e => setTargetP(Number(e.target.value))} className="w-full text-center bg-white border border-blue-300 rounded-xl py-3 text-xl font-black text-blue-700 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm" />
          </div>
          <div>
            <label className="block text-[10px] font-black text-orange-700 uppercase tracking-widest mb-1 text-center">Potash (K)</label>
            <input type="number" min="0" step="1" value={targetK} onChange={e => setTargetK(Number(e.target.value))} className="w-full text-center bg-white border border-orange-300 rounded-xl py-3 text-xl font-black text-orange-700 outline-none focus:ring-2 focus:ring-orange-500 shadow-sm" />
          </div>
        </div>

        <div>
           <label className="block text-[10px] font-black text-emerald-800 uppercase tracking-widest mb-1 text-center">Total Batch Size (lbs)</label>
           <input type="number" min="1" step="1" value={targetWeight} onChange={e => setTargetWeight(Number(e.target.value))} className="w-full max-w-[150px] mx-auto block text-center bg-white border border-emerald-300 rounded-xl py-2 text-lg font-bold text-stone-800 outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner" />
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm">
         <div className="flex justify-between items-center mb-4">
             <h2 className="font-black text-stone-800 uppercase tracking-widest text-xs flex items-center gap-2">
               <Calculator size={16} className="text-stone-400" />
               Calculated Recipe
             </h2>
         </div>

         {results.length === 0 ? (
            <p className="text-center text-sm text-stone-400 py-6 italic">Select ingredients below to calculate.</p>
         ) : (
            <div className="space-y-2">
               {results.map((r, i) => (
                  <div key={i} className="flex justify-between items-center p-3 bg-stone-50 border border-stone-100 rounded-xl">
                     <div>
                        <p className="font-bold text-stone-800 text-sm">{r.name}</p>
                        <p className="text-[10px] text-stone-500 uppercase tracking-widest">{r.brand} ({r.n}-{r.p}-{r.k})</p>
                     </div>
                     <div className="text-right">
                        <span className="text-lg font-black text-emerald-600">{r.calculated_lbs}</span>
                        <span className="text-xs text-stone-500 font-bold ml-1">lbs</span>
                     </div>
                  </div>
               ))}
               
               <div className="mt-4 pt-4 border-t border-stone-200">
                  <p className="text-center text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2">Target vs Achieved NPK</p>
                  <div className="flex justify-center items-center gap-4">
                     <span className="text-sm font-bold text-stone-400 line-through decoration-red-400 decoration-2">{targetN}-{targetP}-{targetK}</span>
                     <span className="text-lg">➡️</span>
                     <span className="text-xl font-black text-stone-800 bg-stone-100 px-3 py-1 rounded-lg border border-stone-200">{achievedN} - {achievedP} - {achievedK}</span>
                  </div>
                  <p className="text-center text-xs text-stone-500 mt-2 leading-tight">
                     *Calculated blends will get as mathematically close to the target as possible based on the inputs provided.
                  </p>
               </div>
            </div>
         )}
      </div>

      <div className="bg-stone-50 rounded-2xl p-4 border border-stone-200 shadow-inner">
         <div className="flex items-start gap-2 mb-4 text-stone-500">
            <Info size={16} className="shrink-0 mt-0.5 text-stone-400" />
            <p className="text-xs font-medium leading-relaxed">
               Uncheck any dry amendments below if you are running low or don't want to include them in the mix. The calculator will automatically adjust the recipe using the remaining selected items.
            </p>
         </div>

         <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {availableDryIngredients.length === 0 ? (
               <p className="text-center text-sm text-stone-400 py-4">No Dry/Granular amendments found in Shed.</p>
            ) : (
               availableDryIngredients.map(ing => (
                  <label key={ing.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedIds.has(ing.id) ? 'bg-white border-emerald-200 shadow-sm' : 'bg-stone-100 border-transparent opacity-60'}`}>
                     <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border ${selectedIds.has(ing.id) ? 'bg-emerald-500 border-emerald-600' : 'bg-white border-stone-300'}`}>
                        {selectedIds.has(ing.id) && <Check size={14} className="text-white" />}
                     </div>
                     <div className="flex-1 min-w-0">
                        <p className="font-bold text-stone-800 text-sm truncate">{ing.name}</p>
                        <p className="text-[10px] text-stone-500 uppercase tracking-widest">{ing.brand}</p>
                     </div>
                     <div className="shrink-0 font-mono text-xs font-bold text-stone-500 bg-stone-100 px-2 py-1 rounded">
                        {ing.n}-{ing.p}-{ing.k}
                     </div>
                  </label>
               ))
            )}
         </div>
      </div>
      
    </div>
  );
}