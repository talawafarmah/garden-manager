'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '../../lib/supabase';
import { RecipeType, RecipeIngredient, Recipe } from '@/types/amendments';
import { ArrowLeft, Loader2, Plus, Trash2, Beaker, Flame, LeafyGreen, Sprout } from 'lucide-react';

// Dynamically import ReactQuill to prevent Next.js SSR "document is not defined" errors
const ReactQuill = dynamic(() => import('react-quill'), { ssr: false });
import 'react-quill/dist/quill.snow.css';

interface RecipeFormProps {
  onClose: () => void;
  onSuccess: () => void;
  initialData?: Recipe | null; // NEW: Passed in for Edit mode
}

export default function RecipeForm({ onClose, onSuccess, initialData }: RecipeFormProps) {
  const isEditing = !!initialData;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    type: initialData?.type || 'liquid_tea' as RecipeType,
    description: initialData?.description || '',
    instructions: initialData?.instructions || '',
    brew_time_hours: initialData?.brew_time_hours || 24,
  });

  const [ingredients, setIngredients] = useState<RecipeIngredient[]>(
    initialData?.ingredients?.length ? initialData.ingredients : [{ name: '', amount: 1, unit: 'cup' }]
  );

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

    const cleanedIngredients = ingredients.filter(i => i.name.trim() !== '');

    setIsSubmitting(true);
    setError(null);

    const payload = {
      name: formData.name.trim(),
      type: formData.type,
      description: formData.description.trim(),
      instructions: formData.instructions.trim(),
      brew_time_hours: formData.brew_time_hours,
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

  // Custom Quill Toolbar Modules for a clean UI
  const quillModules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{'list': 'ordered'}, {'list': 'bullet'}],
      ['clean']
    ],
  };

  return (
    <div className="animate-in slide-in-from-bottom-4 duration-300 bg-white min-h-screen pb-24">
      <header className="bg-white border-b border-stone-200 p-4 sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 -ml-2 text-stone-400 hover:bg-stone-100 hover:text-stone-800 rounded-full transition-colors">
            <ArrowLeft size={24} />
          </button>
          <h2 className="text-lg font-black text-stone-800">{isEditing ? 'Edit Recipe' : 'New Master Recipe'}</h2>
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

              {/* RICH TEXT EDITOR: DESCRIPTION */}
              <div className="quill-container">
                <label className="block text-[10px] font-black text-stone-500 uppercase mb-1.5">Description / Purpose</label>
                <div className="bg-white rounded-xl overflow-hidden border border-stone-200 shadow-sm">
                  <ReactQuill 
                    theme="snow"
                    value={formData.description}
                    onChange={(val) => setFormData({ ...formData, description: val })}
                    modules={quillModules}
                    placeholder="What is this recipe best used for?"
                    className="h-32"
                  />
                </div>
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

          {/* RICH TEXT EDITOR: INSTRUCTIONS */}
          <div className="space-y-4 quill-container">
            <h3 className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-1">Brewing Instructions</h3>
            <div className="bg-white rounded-2xl overflow-hidden border border-stone-200 shadow-sm">
               <ReactQuill 
                  theme="snow"
                  value={formData.instructions}
                  onChange={(val) => setFormData({ ...formData, instructions: val })}
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

      {/* Add some quick global styles so the rich text editor looks clean inside our containers */}
      <style dangerouslySetInnerHTML={{__html: `
        .quill-container .ql-toolbar {
          border: none !important;
          border-bottom: 1px solid #e5e7eb !important;
          background-color: #fafaf9;
          border-top-left-radius: 0.75rem;
          border-top-right-radius: 0.75rem;
        }
        .quill-container .ql-container {
          border: none !important;
          font-family: inherit;
          font-size: 0.875rem;
        }
        .quill-container .ql-editor {
          min-height: 100%;
        }
      `}} />
    </div>
  );
}