'use client';

import React, { useState } from 'react';
import { supabase } from '../../lib/supabase'; // Aligned with your specific project structure
import { AmendmentType } from '@/types/amendments';
import { Camera, AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';
import ProductCapture from './ProductCapture';

interface NewAmendmentFormProps {
  navigateTo: (view: any, payload?: any) => void;
  handleGoBack: (fallbackView: any) => void;
}

export default function NewAmendmentForm({ navigateTo, handleGoBack }: NewAmendmentFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Multi-photo Analysis State
  const [showScanner, setShowScanner] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisMessage, setAnalysisMessage] = useState<string | null>(null);

  // Form state capturing the full botanical profile
  const [formData, setFormData] = useState({
    brand: '',
    name: '',
    type: 'organic' as AmendmentType,
    n_value: '',
    p_value: '',
    k_value: '',
    calcium: '',
    magnesium: '',
    derived_from: '',
    barcode_upc: '', 
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  /**
   * Handles the successful analysis from the ProductCapture component.
   * This populates the form using data extracted from the photos.
   */
 const handleAnalysisSuccess = (data: any) => {
  // DEBUG 1: See exactly what the AI sent back in your browser console
  console.log("DEBUG: AI Analysis Result ->", data);

  if (!data || Object.keys(data).length === 0) {
    setError("AI returned an empty object. Try a clearer photo of the labels.");
    return;
  }

  setShowScanner(false);
  
  // DEBUG 2: Show a temporary UI message with the detected brand
  setAnalysisMessage(`Success! Identified ${data.brand ?? 'Product'} - Populating fields...`);
  setError(null);

  setFormData((prev) => {
    // DEBUG 3: Check for data-type mismatches
    const updatedForm = {
      ...prev,
      brand: data.brand || prev.brand,
      name: data.name || prev.name,
      type: data.type || prev.type,
      n_value: (data.n_value ?? "0").toString(),
      p_value: (data.p_value ?? "0").toString(),
      k_value: (data.k_value ?? "0").toString(),
      calcium: (data.calcium ?? "0").toString(),
      magnesium: (data.magnesium ?? "0").toString(),
      derived_from: data.derived_from || prev.derived_from,
      barcode_upc: data.barcode_upc || prev.barcode_upc,
    };
    
    console.log("DEBUG: Updated Form State ->", updatedForm);
    return updatedForm;
  });

  setTimeout(() => setAnalysisMessage(null), 5000);
};

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    // Final payload construction with numeric parsing
    const payload = {
      brand: formData.brand,
      name: formData.name,
      type: formData.type,
      n_value: parseFloat(formData.n_value) || 0,
      p_value: parseFloat(formData.p_value) || 0,
      k_value: parseFloat(formData.k_value) || 0,
      calcium: parseFloat(formData.calcium) || 0,
      magnesium: parseFloat(formData.magnesium) || 0,
      derived_from: formData.derived_from,
      barcode_upc: formData.barcode_upc || null, 
    };

    const { data, error: submitError } = await supabase
      .from('amendments')
      .insert([payload])
      .select()
      .single();

    setIsSubmitting(false);

    if (submitError) {
      if (submitError.code === '23505') { 
        setError('This product already exists in your Digital Shed.');
      } else {
        setError(submitError.message);
      }
      return;
    }

    if (data) {
      // Return to detail view in SPA mode
      navigateTo('amendment_detail', data);
    }
  };

  return (
    <div className="bg-white min-h-screen pb-24">
      {/* Product Capture Overlay */}
      {showScanner && (
        <ProductCapture 
          onAnalysisSuccess={handleAnalysisSuccess} 
          onCancel={() => setShowScanner(false)} 
        />
      )}

      {/* Header Navigation */}
      <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-white sticky top-0 z-10">
        <button 
          onClick={() => handleGoBack('amendments')} 
          className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft size={24} className="text-gray-700" />
        </button>
        <h2 className="text-lg font-bold text-gray-900">Add Amendment</h2>
        <button
          type="button"
          onClick={() => setShowScanner(true)}
          className="flex items-center gap-2 bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md active:scale-95"
        >
          <Camera size={16} />
          <span>Analyze</span>
        </button>
      </div>

      <div className="p-6">
        {analysisMessage && (
          <div className="mb-6 p-4 bg-green-50 text-green-700 border border-green-200 rounded-xl text-sm flex items-center">
            <span className="mr-3 text-lg">✅</span> {analysisMessage}
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm flex items-start">
            <AlertCircle size={18} className="mr-3 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* Section: Product Identification */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Identity</h3>
            
            <div className="space-y-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1 px-1">Brand</label>
                <input
                  type="text"
                  name="brand"
                  required
                  value={formData.brand}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 font-semibold focus:ring-2 focus:ring-green-500 outline-none"
                  placeholder="e.g., Down To Earth"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1 px-1">Product Name</label>
                <input
                  type="text"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 font-semibold focus:ring-2 focus:ring-green-500 outline-none"
                  placeholder="e.g., All Purpose Fertilizer"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1 px-1">Source Type</label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 font-semibold focus:ring-2 focus:ring-green-500 outline-none"
                  
                >
                  <option value="organic">Organic</option>
                  <option value="synthetic">Synthetic</option>
                  <option value="compost">Compost / Casting</option>
                  <option value="mineral">Mineral / Rock Dust</option>
                  <option value="microbial">Microbial / Inoculant</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section: Macro-Nutrients (N-P-K) */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Guaranteed Analysis (%)</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-green-50/50 p-3 rounded-2xl border border-green-100">
                <label className="block text-[10px] font-bold text-green-700 uppercase mb-2 text-center">Nitrogen (N)</label>
                <input
                  type="number"
                  name="n_value"
                  inputMode="decimal"
                  step="0.01"
                  value={formData.n_value}
                  onChange={handleChange}
                  className="w-full text-center font-extrabold text-xl text-gray-900 bg-white border border-green-200 rounded-xl py-2 outline-none"
                  placeholder="0"
                />
              </div>
              <div className="bg-blue-50/50 p-3 rounded-2xl border border-blue-100">
                <label className="block text-[10px] font-bold text-blue-700 uppercase mb-2 text-center">Phos (P)</label>
                <input
                  type="number"
                  name="p_value"
                  inputMode="decimal"
                  step="0.01"
                  value={formData.p_value}
                  onChange={handleChange}
                  className="w-full text-center font-extrabold text-xl text-gray-900 bg-white border border-green-200 rounded-xl py-2 outline-none"
                  placeholder="0"
                />
              </div>
              <div className="bg-orange-50/50 p-3 rounded-2xl border border-orange-100">
                <label className="block text-[10px] font-bold text-orange-700 uppercase mb-2 text-center">Potash (K)</label>
                <input
                  type="number"
                  name="k_value"
                  inputMode="decimal"
                  step="0.01"
                  value={formData.k_value}
                  onChange={handleChange}
                  className="w-full text-center font-extrabold text-xl text-gray-900 bg-white border border-green-200 rounded-xl py-2 outline-none"
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          {/* Section: Secondary Nutrients */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Secondary & Micronutrients</h3>
            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2">Calcium (Ca %)</label>
                <input
                  type="number"
                  name="calcium"
                  inputMode="decimal"
                  step="0.01"
                  value={formData.calcium}
                  onChange={handleChange}
                  className="w-full text-center font-extrabold text-xl text-gray-900 bg-white border border-green-200 rounded-xl py-2 outline-none"
                  placeholder="0.0"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2">Magnesium (Mg %)</label>
                <input
                  type="number"
                  name="magnesium"
                  inputMode="decimal"
                  step="0.01"
                  value={formData.magnesium}
                  onChange={handleChange}
                  className="w-full text-center font-extrabold text-xl text-gray-900 bg-white border border-green-200 rounded-xl py-2 outline-none"
                  placeholder="0.0"
                />
              </div>
            </div>
          </div>

          {/* Section: Technical Details */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Derived From</h3>
            <textarea
              name="derived_from"
              rows={3}
              value={formData.derived_from}
              onChange={handleChange}
              className="w-full text-center font-extrabold text-xl text-gray-900 bg-white border border-green-200 rounded-xl py-2 outline-none"
              placeholder="List ingredients (e.g. Feather meal, Bone meal, Sulfate of Potash...)"
            ></textarea>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-green-700 hover:bg-green-800 text-white font-bold py-4 rounded-2xl shadow-xl shadow-green-900/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                <span>Storing in Shed...</span>
              </>
            ) : (
              <span>Save Amendment</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}