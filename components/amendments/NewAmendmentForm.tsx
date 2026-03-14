'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { AmendmentType } from '@/types/amendments';
import { Camera, AlertCircle } from 'lucide-react';
import BarcodeScanner from './BarcodeScanner';

// Initialize Supabase client for client-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function NewAmendmentForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Scanner state
  const [showScanner, setShowScanner] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeMessage, setScrapeMessage] = useState<string | null>(null);

  // Form state aligned with our new relational schema
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
    barcode_upc: '', // Added to capture the scanned barcode
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleScanSuccess = async (barcode: string) => {
    setShowScanner(false);
    setIsScraping(true);
    setScrapeMessage('Barcode found! Fetching amendment details...');
    setError(null);

    try {
      // Hit our secure serverless API route
      const response = await fetch(`/api/scrape-amendment?barcode=${barcode}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch product data.');
      }

      // Auto-fill the form with the scraped and regex-parsed data
      setFormData((prev) => ({
        ...prev,
        barcode_upc: data.barcode_upc || barcode,
        brand: data.brand || prev.brand,
        name: data.name || prev.name,
        type: data.type || prev.type,
        // Convert numbers back to strings for the input fields
        n_value: data.n_value ? data.n_value.toString() : prev.n_value,
        p_value: data.p_value ? data.p_value.toString() : prev.p_value,
        k_value: data.k_value ? data.k_value.toString() : prev.k_value,
        derived_from: data.derived_from || prev.derived_from,
      }));

      setScrapeMessage('Success! Form auto-filled. Please verify the guaranteed analysis.');
      
      // Clear the success message after 5 seconds
      setTimeout(() => setScrapeMessage(null), 5000);

    } catch (err: any) {
      console.error(err);
      setError(`Scanner note: ${err.message} You can still enter the details manually.`);
      // Still save the barcode so they don't have to type that part!
      setFormData((prev) => ({ ...prev, barcode_upc: barcode }));
    } finally {
      setIsScraping(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    // Parse numeric fields, falling back to 0.00 if left blank
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
      barcode_upc: formData.barcode_upc || null, // Allow null if not scanned
    };

    // Insert into Supabase
    const { data, error: submitError } = await supabase
      .from('amendments')
      .insert([payload])
      .select()
      .single();

    setIsSubmitting(false);

    if (submitError) {
      if (submitError.code === '23505') { // Unique violation error code in Postgres
        setError('An amendment with this barcode already exists in your database.');
      } else {
        setError(submitError.message);
      }
      return;
    }

    // Route to the new amendment's detail page to begin adding Feeding Schedules
    if (data) {
      router.push(`/amendments/${data.id}`);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
      
      {/* Scanner Modal Overlay */}
      {showScanner && (
        <BarcodeScanner 
          onScanSuccess={handleScanSuccess} 
          onCancel={() => setShowScanner(false)} 
        />
      )}

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900">Add New Amendment</h2>
        <button
          type="button"
          onClick={() => setShowScanner(true)}
          disabled={isScraping}
          className="flex items-center gap-2 bg-green-100 hover:bg-green-200 text-green-800 px-3 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
        >
          <Camera size={16} />
          <span>Scan Barcode</span>
        </button>
      </div>
      
      {isScraping && (
        <div className="mb-4 p-3 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-sm flex items-center animate-pulse">
          <span className="mr-2">🔄</span> Fetching database records...
        </div>
      )}

      {scrapeMessage && !isScraping && (
        <div className="mb-4 p-3 bg-green-50 text-green-700 border border-green-200 rounded-md text-sm flex items-center">
          <span className="mr-2">✅</span> {scrapeMessage}
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-md text-sm flex items-start">
          <AlertCircle size={18} className="mr-2 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Hidden Barcode Input - Visually hidden but trackable */}
        {formData.barcode_upc && (
          <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded border border-gray-100 font-mono">
            Attached UPC: {formData.barcode_upc}
          </div>
        )}

        {/* Basic Info */}
        <div className="space-y-4">
          <div>
            <label htmlFor="brand" className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
            <input
              type="text"
              id="brand"
              name="brand"
              required
              value={formData.brand}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
              placeholder="e.g., Down To Earth"
            />
          </div>

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
            <input
              type="text"
              id="name"
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
              placeholder="e.g., Blood Meal"
            />
          </div>

          <div>
            <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">Amendment Type</label>
            <select
              id="type"
              name="type"
              value={formData.type}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white"
            >
              <option value="synthetic">Synthetic</option>
              <option value="organic">Organic</option>
              <option value="compost">Compost / Casting</option>
              <option value="mineral">Mineral</option>
              <option value="microbial">Microbial / Inoculant</option>
            </select>
          </div>
        </div>

        <hr className="border-gray-200" />

        {/* N-P-K Guaranteed Analysis */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">Guaranteed Analysis (%)</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label htmlFor="n_value" className="block text-xs font-medium text-green-700 mb-1">Nitrogen (N)</label>
              <input
                type="number"
                id="n_value"
                name="n_value"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={formData.n_value}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-green-200 rounded-md focus:ring-2 focus:ring-green-500 bg-green-50"
                placeholder="0.00"
              />
            </div>
            <div>
              <label htmlFor="p_value" className="block text-xs font-medium text-blue-700 mb-1">Phosphorus (P)</label>
              <input
                type="number"
                id="p_value"
                name="p_value"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={formData.p_value}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-blue-200 rounded-md focus:ring-2 focus:ring-blue-500 bg-blue-50"
                placeholder="0.00"
              />
            </div>
            <div>
              <label htmlFor="k_value" className="block text-xs font-medium text-orange-700 mb-1">Potassium (K)</label>
              <input
                type="number"
                id="k_value"
                name="k_value"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={formData.k_value}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-orange-200 rounded-md focus:ring-2 focus:ring-orange-500 bg-orange-50"
                placeholder="0.00"
              />
            </div>
          </div>
        </div>

        {/* Secondary Nutrients */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">Secondary Nutrients (%)</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="calcium" className="block text-xs font-medium text-gray-600 mb-1">Calcium (Ca)</label>
              <input
                type="number"
                id="calcium"
                name="calcium"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={formData.calcium}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-500"
                placeholder="0.00"
              />
            </div>
            <div>
              <label htmlFor="magnesium" className="block text-xs font-medium text-gray-600 mb-1">Magnesium (Mg)</label>
              <input
                type="number"
                id="magnesium"
                name="magnesium"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={formData.magnesium}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-500"
                placeholder="0.00"
              />
            </div>
          </div>
        </div>

        {/* Ingredients / Derived From */}
        <div>
          <label htmlFor="derived_from" className="block text-sm font-medium text-gray-700 mb-1">Derived From (Ingredients)</label>
          <textarea
            id="derived_from"
            name="derived_from"
            rows={2}
            value={formData.derived_from}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
            placeholder="e.g., Feather meal, bone meal, sulfate of potash..."
          ></textarea>
        </div>

        <button
          type="submit"
          disabled={isSubmitting || isScraping}
          className="w-full bg-green-700 hover:bg-green-800 text-white font-bold py-3 px-4 rounded-lg shadow transition-colors disabled:opacity-50"
        >
          {isSubmitting ? 'Saving...' : 'Save Amendment'}
        </button>
      </form>
    </div>
  );
}