'use client';

import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Amendment, AmendmentType } from '@/types/amendments';
import { Camera, AlertCircle, ArrowLeft, Loader2, ListPlus } from 'lucide-react';
import ProductCapture from './ProductCapture';

interface NewAmendmentFormProps {
  navigateTo: (view: any, payload?: any) => void;
  handleGoBack: (fallbackView: any) => void;
  initialData?: Amendment | null; 
}

const generateThumbnail = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const MAX_SIZE = 150; 
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }
        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.6)); 
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export default function NewAmendmentForm({ navigateTo, handleGoBack, initialData }: NewAmendmentFormProps) {
  const isEditing = !!initialData;
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [analysisMessage, setAnalysisMessage] = useState<string | null>(null);
  
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [extractedSchedules, setExtractedSchedules] = useState<any[]>([]);

  const [previewUrls, setPreviewUrls] = useState<string[]>(
    initialData?.images && initialData.images.length > 0 
      ? initialData.images 
      : (initialData?.image_url ? [initialData.image_url] : [])
  );

  const [formData, setFormData] = useState({
    brand: initialData?.brand || '',
    name: initialData?.name || '',
    type: initialData?.type || 'organic' as AmendmentType,
    n_value: initialData?.n_value !== undefined ? String(initialData.n_value) : '',
    p_value: initialData?.p_value !== undefined ? String(initialData.p_value) : '',
    k_value: initialData?.k_value !== undefined ? String(initialData.k_value) : '',
    calcium: initialData?.calcium !== undefined ? String(initialData.calcium) : '',
    magnesium: initialData?.magnesium !== undefined ? String(initialData.magnesium) : '',
    derived_from: initialData?.derived_from || '',
    barcode_upc: initialData?.barcode_upc || '', 
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAnalysisSuccess = (data: any, capturedImages: File[]) => {
    if (!data || Object.keys(data).length === 0) {
      setError("Analysis returned no data.");
      return;
    }

    setShowScanner(false);
    setAnalysisMessage('Data populated! Review your changes.');
    setError(null);

    if (capturedImages && capturedImages.length > 0) {
      setPendingImages(capturedImages);
      setPreviewUrls(capturedImages.map(img => URL.createObjectURL(img)));
    }

    if (data.schedules && Array.isArray(data.schedules) && data.schedules.length > 0) {
      setExtractedSchedules(data.schedules);
    }

    const validTypes = ['organic', 'synthetic', 'compost', 'mineral', 'microbial'];
    const rawValue = Array.isArray(data.type) ? data.type[0] : (data.type || "organic");
    const normalizedValue = String(rawValue).toLowerCase();
    
    let finalizedType = 'organic'; 
    if (validTypes.includes(normalizedValue)) finalizedType = normalizedValue;
    else if (normalizedValue.includes('microbial')) finalizedType = 'microbial';
    else if (normalizedValue.includes('compost')) finalizedType = 'compost';
    else if (normalizedValue.includes('synthetic')) finalizedType = 'synthetic';
    else if (normalizedValue.includes('mineral')) finalizedType = 'mineral';

    setFormData((prev) => ({
      ...prev,
      brand: data.brand || prev.brand,
      name: data.name || prev.name,
      type: finalizedType as AmendmentType,
      n_value: (data.n_value && data.n_value !== 0) ? data.n_value.toString() : prev.n_value,
      p_value: (data.p_value && data.p_value !== 0) ? data.p_value.toString() : prev.p_value,
      k_value: (data.k_value && data.k_value !== 0) ? data.k_value.toString() : prev.k_value,
      calcium: (data.calcium && data.calcium !== 0) ? data.calcium.toString() : prev.calcium,
      magnesium: (data.magnesium && data.magnesium !== 0) ? data.magnesium.toString() : prev.magnesium,
      derived_from: data.derived_from || prev.derived_from,
      barcode_upc: data.barcode_upc || prev.barcode_upc,
    }));

    setTimeout(() => setAnalysisMessage(null), 5000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    let finalImages = initialData?.images || [];
    if (initialData?.image_url && finalImages.length === 0) {
      finalImages = [initialData.image_url];
    }
    
    let finalThumbnail = initialData?.thumbnail || null;
    let finalImageUrl = initialData?.image_url || null;

    if (pendingImages.length > 0) {
      try {
        finalThumbnail = await generateThumbnail(pendingImages[0]); 
        const newImageUrls = [];

        // Define our centralized bucket and the obfuscated folder path
        const targetBucket = 'talawa_media';
        const obfuscatedFolder = 'amend_x8q9p2'; 

        for (const file of pendingImages) {
          const fileExt = file.name.split('.').pop() || 'jpg';
          // File name includes the obfuscated folder structure
          const filePath = `${obfuscatedFolder}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from(targetBucket)
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          const { data: publicUrlData } = supabase.storage
            .from(targetBucket)
            .getPublicUrl(filePath);
            
          newImageUrls.push(publicUrlData.publicUrl);
        }

        finalImages = isEditing ? [...finalImages, ...newImageUrls] : newImageUrls; 
        finalImageUrl = finalImages[0]; 
        
      } catch (err: any) {
        setError("Image processing failed: " + err.message);
        setIsSubmitting(false);
        return;
      }
    }

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
      image_url: finalImageUrl,
      images: finalImages,     
      thumbnail: finalThumbnail,
    };

    let submitError;
    let returnedData;

    // 1. SAVE THE AMENDMENT
    if (isEditing && initialData?.id) {
      const { data, error } = await supabase.from('amendments').update(payload).eq('id', initialData.id).select().single();
      submitError = error;
      returnedData = data;
    } else {
      const { data, error } = await supabase.from('amendments').insert([payload]).select().single();
      submitError = error;
      returnedData = data;
    }

    if (submitError) {
      setError(submitError.message);
      setIsSubmitting(false);
      return;
    }

    // 2. SAVE EXTRACTED SCHEDULES (If any were found in the photo)
    if (returnedData && extractedSchedules.length > 0) {
      const schedulesPayload = extractedSchedules.map(sched => ({
        amendment_id: returnedData.id,
        growth_stage: sched.growth_stage || 'vegetative',
        method: sched.method || 'soil_drench',
        dosage_amount: Number(sched.dosage_amount) || 0,
        dosage_unit: sched.dosage_unit || 'tbsp',
        dilution_amount: Number(sched.dilution_amount) || 0,
        dilution_unit: sched.dilution_unit || 'gallon',
        frequency_days: Number(sched.frequency_days) || null,
        notes: sched.notes || ''
      }));

      const { error: scheduleError } = await supabase.from('feeding_schedules').insert(schedulesPayload);
      if (scheduleError) {
        console.error("Failed to save extracted schedules:", scheduleError);
      }
    }

    setIsSubmitting(false);
    if (returnedData) navigateTo('amendment_detail', returnedData);
  };

  return (
    <div className="bg-white min-h-screen pb-24">
      {showScanner && (
        <ProductCapture 
          onAnalysisSuccess={handleAnalysisSuccess} 
          onCancel={() => setShowScanner(false)} 
        />
      )}

      <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-white sticky top-0 z-10">
        <button 
          onClick={() => handleGoBack('amendments')} 
          className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft size={24} className="text-gray-700" />
        </button>
        <h2 className="text-lg font-bold text-gray-900">
          {isEditing ? 'Edit Amendment' : 'Add Amendment'}
        </h2>
        <button
          type="button"
          onClick={() => setShowScanner(true)}
          className="flex items-center gap-2 bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md active:scale-95 transition-transform"
        >
          <Camera size={16} />
          <span>Analyze</span>
        </button>
      </div>

      <div className="p-6">
        {analysisMessage && (
          <div className="mb-6 p-4 bg-green-50 text-green-700 border border-green-200 rounded-xl text-sm flex items-center font-medium">
            <span className="mr-3 text-lg">✅</span> {analysisMessage}
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm flex items-start font-medium">
            <AlertCircle size={18} className="mr-3 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        
        {extractedSchedules.length > 0 && (
           <div className="mb-6 p-4 bg-blue-50 text-blue-800 border border-blue-200 rounded-xl text-sm flex flex-col gap-2">
             <div className="flex items-center font-bold">
               <ListPlus size={18} className="mr-2" />
               Found {extractedSchedules.length} feeding guidelines!
             </div>
             <p className="text-xs text-blue-600 font-medium">
               These will automatically be saved to the Digital Shed when you submit this form.
             </p>
           </div>
        )}

        {previewUrls.length > 0 && (
          <div className="mb-6 flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {previewUrls.map((url, idx) => (
              <div key={idx} className="relative w-24 h-24 rounded-2xl overflow-hidden border-2 border-green-500 shadow-md flex-shrink-0">
                <img src={url} alt={`Thumbnail Preview ${idx + 1}`} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Identity</h3>
            <div className="space-y-4 bg-gray-50 p-4 rounded-2xl border border-gray-100 shadow-sm">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1 px-1">Brand</label>
                <input
                  type="text"
                  name="brand"
                  required
                  value={formData.brand}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 font-bold focus:ring-2 focus:ring-green-500 outline-none"
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
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 font-bold focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1 px-1">Source Type</label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 font-bold focus:ring-2 focus:ring-green-500 outline-none appearance-none"
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

          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Guaranteed Analysis (%)</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-green-50/50 p-3 rounded-2xl border border-green-200">
                <label className="block text-[10px] font-bold text-green-700 uppercase mb-2 text-center">Nitrogen (N)</label>
                <input
                  type="number"
                  name="n_value"
                  inputMode="decimal"
                  step="0.01"
                  value={formData.n_value}
                  onChange={handleChange}
                  className="w-full text-center font-extrabold text-xl text-gray-900 bg-white border border-green-300 rounded-xl py-2 outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div className="bg-blue-50/50 p-3 rounded-2xl border border-blue-200">
                <label className="block text-[10px] font-bold text-blue-700 uppercase mb-2 text-center">Phos (P)</label>
                <input
                  type="number"
                  name="p_value"
                  inputMode="decimal"
                  step="0.01"
                  value={formData.p_value}
                  onChange={handleChange}
                  className="w-full text-center font-extrabold text-xl text-gray-900 bg-white border border-blue-300 rounded-xl py-2 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="bg-orange-50/50 p-3 rounded-2xl border border-orange-200">
                <label className="block text-[10px] font-bold text-orange-700 uppercase mb-2 text-center">Potash (K)</label>
                <input
                  type="number"
                  name="k_value"
                  inputMode="decimal"
                  step="0.01"
                  value={formData.k_value}
                  onChange={handleChange}
                  className="w-full text-center font-extrabold text-xl text-gray-900 bg-white border border-orange-300 rounded-xl py-2 outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Secondary Nutrients (%)</h3>
            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100 shadow-sm">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2">Calcium (Ca)</label>
                <input
                  type="number"
                  name="calcium"
                  inputMode="decimal"
                  step="0.01"
                  value={formData.calcium}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-xl text-gray-900 font-bold outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2">Magnesium (Mg)</label>
                <input
                  type="number"
                  name="magnesium"
                  inputMode="decimal"
                  step="0.01"
                  value={formData.magnesium}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-xl text-gray-900 font-bold outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 border-t border-gray-100 pt-6">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Sourcing</h3>
            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 shadow-sm">
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2">Derived From (Ingredients)</label>
              <textarea
                name="derived_from"
                rows={3}
                value={formData.derived_from}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-sm text-gray-900 font-medium leading-relaxed"
              ></textarea>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-green-700 hover:bg-green-800 text-white font-bold py-4 rounded-2xl shadow-xl shadow-green-900/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                <span>{isEditing ? 'Updating...' : 'Storing in Shed...'}</span>
              </>
            ) : (
              <span>{isEditing ? 'Update Amendment' : 'Save Amendment'}</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}