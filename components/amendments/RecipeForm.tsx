'use client';

import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { RecipeType, RecipeIngredient } from '@/types/amendments'; // Or '@/types/index' depending on where you put them
import { ArrowLeft, Loader2, Plus, Trash2, Beaker, Flame, LeafyGreen, Sprout } from 'lucide-react';

interface RecipeFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function RecipeForm({ onClose, onSuccess }: RecipeFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    type: 'liquid_tea' as RecipeType,
    description: '',
    instructions: '',
    brew_time_hours: 24,
  });

  // Dynamic state for the JSONB ingredients array
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([
    { name: '', amount: 1, unit: 'cup' }
  ]);

  const handleAddIngredient = () => {
    setIngredients([...ingredients, { name: '', amount: 1, unit: 'cup' }]);
  };

  const handleUpdateIngredient = (index: number, field: keyof RecipeIngredient, value: string | number) => {
    const newIngredients = [...ingredients];
    newIngredients[index] = { ...newIngredients[index], [field]: value };
    setIngredients(newIngredients);
  };

  const handleRemoveIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError("Recipe name is required.");
      return;
    }

    // Filter out any empty ingredient rows
    const cleanedIngredients = ingredients.filter(i => i.name.trim() !== '');

    setIsSubmitting(true);
    setError(null);

    const payload = {
      name: formData.name.trim(),
      type: formData.type,
      description: formData.description.trim(),
      instructions: formData.instructions.trim(),
      brew_time_hours: formData.brew_time_hours,
      ingredients: cleanedIngredients, // Supabase will automatically parse this array to JSONB
    };

    const { error: submitError } = await supabase.from('recipes').insert([payload]);

    setIsSubmitting(false);

    if (submitError) {
      setError(submitError.message);
    } else {
      onSuccess();
    }
  };

  const getTypeIcon = (type: RecipeType) => {
    switch (type) {
      case 'liquid_tea': return <Beaker size={16} className="text-blue-500" />;
      case 'dry_mix': return <Sprout size={16} className="text-amber-600" />;
      case 'extract': return <LeafyGreen size={16} className="text-emerald-500" />;
      case 'ferment': return <Flame size={16} className="text-orange-500" />;
    }
  };

  return (
    <div className="animate-in slide-in-from-bottom-4 duration-300 bg-white min-h-screen pb-24">
      <header className="bg-white border-b border-stone-200 p-4 sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 -ml-2 text-stone-400 hover:bg-stone-100 hover:text-stone-800 rounded-full transition-colors">
            <ArrowLeft size={24} />
          </button>
          <h2 className="text-lg font-black text-stone-800">New Master Recipe</h2>
        </div>
      </header>

      <div className="max-w-xl mx-auto p-4 space-y-6 mt-2">
        {error && (
          <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm font-bold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* CORE DETAILS */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-1">Recipe Identity</h3>
            <div className="bg-stone-50 p-4 rounded-3xl border border-stone-100 shadow-sm space-y-4">
              <div>
                <label className="block text-[10px] font-black text-stone-500 uppercase mb-1.5">Recipe Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Fungal Compost Tea"
                  className="w-full bg-white border border-stone-200 rounded-xl p-3 font-bold text-stone-800 outline-none focus:border-purple-500 shadow-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-stone-500 uppercase mb-1.5">Type</label>
                  <div className="relative">
                    <select
                      value={formData.type}
                      onChange={e => setFormData({ ...formData, type: e.target.value as RecipeType })}
                      className="w-full bg-white border border-stone-200 rounded-xl p-3 font-bold text-stone-800 outline-none focus:border-purple-500 shadow-sm appearance-none pl-10"
                    >
                      <option value="liquid_tea">Liquid Tea</option>
                      <option value="dry_mix">Dry Mix</option>
                      <option value="extract">Botanical Extract</option>
                      <option value="ferment">Ferment (JADAM)</option>
                    </select>
                    <div className="absolute left-3 top-3.5 pointer-events-none">
                      {getTypeIcon(formData.type)}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-stone-500 uppercase mb-1.5">Brew/Cook Time</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      value={formData.brew_time_hours}
                      onChange={e => setFormData({ ...formData, brew_time_hours: Number(e.target.value) })}
                      className="w-full bg-white border border-stone-200 rounded-xl p-3 font-bold text-stone-800 outline-none focus:border-purple-500 shadow-sm"
                    />
                    <span className="absolute right-4 top-3.5 text-xs font-black text-stone-400 uppercase tracking-widest pointer-events-none">Hours</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-stone-500 uppercase mb-1.5">Description / Purpose</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="What is this recipe best used for?"
                  className="w-full bg-white border border-stone-200 rounded-xl p-3 text-sm font-medium text-stone-700 outline-none focus:border-purple-500 shadow-sm"
                />
              </div>
            </div>
          </div>

          {/* INGREDIENTS LIST */}
          <div className="space-y-4">
            <div className="flex justify-between items-end px-1">
              <h3 className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Ingredients List</h3>
            </div>
            
            <div className="bg-purple-50 p-4 rounded-3xl border border-purple-100 shadow-sm space-y-3">
              {ingredients.map((ing, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="flex-1 grid grid-cols-12 gap-2 bg-white p-2 rounded-xl border border-purple-200 shadow-sm">
                    <div className="col-span-6">
                      <input
                        type="text"
                        placeholder="Ingredient (e.g. Kelp)"
                        value={ing.name}
                        onChange={e => handleUpdateIngredient(idx, 'name', e.target.value)}
                        className="w-full bg-transparent text-sm font-bold text-stone-800 outline-none px-2 py-1"
                      />
                    </div>
                    <div className="col-span-3 border-l border-purple-100 pl-2">
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        placeholder="Qty"
                        value={ing.amount || ''}
                        onChange={e => handleUpdateIngredient(idx, 'amount', Number(e.target.value))}
                        className="w-full bg-transparent text-sm font-black text-purple-700 text-center outline-none py-1"
                      />
                    </div>
                    <div className="col-span-3 border-l border-purple-100 pl-2">
                       <input
                        type="text"
                        placeholder="Unit"
                        value={ing.unit}
                        onChange={e => handleUpdateIngredient(idx, 'unit', e.target.value)}
                        className="w-full bg-transparent text-xs font-bold text-stone-500 uppercase tracking-wider text-center outline-none py-1"
                      />
                    </div>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => handleRemoveIngredient(idx)}
                    className="w-10 h-10 flex flex-shrink-0 items-center justify-center bg-white border border-red-100 text-red-400 rounded-xl hover:bg-red-50 hover:text-red-600 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}

              <button 
                type="button" 
                onClick={handleAddIngredient}
                className="w-full py-3 bg-purple-100/50 text-purple-700 text-xs font-black uppercase tracking-widest rounded-xl border border-purple-200 border-dashed hover:bg-purple-100 transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={16} /> Add Ingredient
              </button>
            </div>
          </div>

          {/* INSTRUCTIONS */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-1">Brewing Instructions</h3>
            <textarea
              rows={4}
              value={formData.instructions}
              onChange={e => setFormData({ ...formData, instructions: e.target.value })}
              placeholder="Step-by-step instructions..."
              className="w-full bg-white border border-stone-200 rounded-2xl p-4 text-sm font-medium text-stone-700 outline-none focus:border-purple-500 shadow-sm"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-purple-700 text-white font-black uppercase tracking-widest py-4 rounded-2xl shadow-xl shadow-purple-900/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-purple-600 transition-all"
          >
            {isSubmitting ? (
              <><Loader2 size={20} className="animate-spin" /> Saving Recipe...</>
            ) : (
              'Save Master Recipe'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}