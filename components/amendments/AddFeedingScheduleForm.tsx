'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { GrowthStage, ApplicationMethod, MeasurementUnit, DilutionUnit } from '@/types/amendments';

// Initialize Supabase client for client-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface AddFeedingScheduleFormProps {
  amendmentId: string;
  onSuccess?: () => void; // Callback to refresh the parent page data
}

export default function AddFeedingScheduleForm({ amendmentId, onSuccess }: AddFeedingScheduleFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Defaulting to the most common application: vegetative top dress
  const [formData, setFormData] = useState({
    growth_stage: 'vegetative' as GrowthStage,
    method: 'top_dress' as ApplicationMethod,
    dosage_amount: '',
    dosage_unit: 'tbsp' as MeasurementUnit,
    dilution_amount: '',
    dilution_unit: 'sq_ft' as DilutionUnit, // Defaults to area for top dress
    frequency_days: '',
    notes: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    // Validate and parse the numeric fields
    const dosageAmount = parseFloat(formData.dosage_amount);
    if (isNaN(dosageAmount) || dosageAmount <= 0) {
      setError('Please enter a valid dosage amount.');
      setIsSubmitting(false);
      return;
    }

    const payload = {
      amendment_id: amendmentId,
      growth_stage: formData.growth_stage,
      method: formData.method,
      dosage_amount: dosageAmount,
      dosage_unit: formData.dosage_unit,
      // Dilution and frequency are optional, handle empty strings safely
      dilution_amount: formData.dilution_amount ? parseFloat(formData.dilution_amount) : null,
      dilution_unit: formData.dilution_amount ? formData.dilution_unit : null,
      frequency_days: formData.frequency_days ? parseInt(formData.frequency_days, 10) : null,
      notes: formData.notes.trim() === '' ? null : formData.notes,
    };

    const { error: submitError } = await supabase
      .from('feeding_schedules')
      .insert([payload]);

    setIsSubmitting(false);

    if (submitError) {
      setError(submitError.message);
      return;
    }

    // Reset form on success
    setFormData({
      growth_stage: 'vegetative' as GrowthStage,
      method: 'top_dress' as ApplicationMethod,
      dosage_amount: '',
      dosage_unit: 'tbsp' as MeasurementUnit,
      dilution_amount: '',
      dilution_unit: 'sq_ft' as DilutionUnit,
      frequency_days: '',
      notes: '',
    });

    // Trigger parent refresh or router refresh to show the new data
    if (onSuccess) {
      onSuccess();
    } else {
      router.refresh();
    }
  };

  return (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 mt-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4">Add Feeding Instruction</h3>
      
      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-md text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        
        {/* Stage & Method */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="growth_stage" className="block text-sm font-medium text-gray-700 mb-1">Growth Stage</label>
            <select
              id="growth_stage"
              name="growth_stage"
              value={formData.growth_stage}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 bg-white text-sm"
            >
              <option value="pre_plant">Pre-Plant</option>
              <option value="seedling">Seedling</option>
              <option value="vegetative">Vegetative</option>
              <option value="flowering">Flowering</option>
              <option value="fruiting">Fruiting</option>
              <option value="dormant">Dormant</option>
            </select>
          </div>
          <div>
            <label htmlFor="method" className="block text-sm font-medium text-gray-700 mb-1">Method</label>
            <select
              id="method"
              name="method"
              value={formData.method}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 bg-white text-sm"
            >
              <option value="top_dress">Top Dress</option>
              <option value="soil_drench">Soil Drench</option>
              <option value="foliar_spray">Foliar Spray</option>
              <option value="soil_mix">Soil Mix</option>
              <option value="hydroponic">Hydroponic</option>
            </select>
          </div>
        </div>

        <hr className="border-gray-100" />

        {/* Dosage Rate */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Application Rate</h4>
          <div className="flex gap-2 items-center">
            <input
              type="number"
              id="dosage_amount"
              name="dosage_amount"
              required
              inputMode="decimal"
              step="0.01"
              min="0"
              value={formData.dosage_amount}
              onChange={handleChange}
              placeholder="Amt"
              className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
            />
            <select
              id="dosage_unit"
              name="dosage_unit"
              value={formData.dosage_unit}
              onChange={handleChange}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 bg-white"
            >
              <option value="ml">Milliliters (ml)</option>
              <option value="tsp">Teaspoons (tsp)</option>
              <option value="tbsp">Tablespoons (tbsp)</option>
              <option value="cup">Cups</option>
              <option value="oz">Ounces (oz)</option>
              <option value="g">Grams (g)</option>
              <option value="lbs">Pounds (lbs)</option>
              <option value="kg">Kilograms (kg)</option>
            </select>
          </div>
        </div>

        {/* Dilution / Carrier (Optional) */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Per (Carrier / Area)</h4>
          <div className="flex gap-2 items-center">
            <input
              type="number"
              id="dilution_amount"
              name="dilution_amount"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={formData.dilution_amount}
              onChange={handleChange}
              placeholder="Optional amt"
              className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 bg-blue-50/30"
            />
            <select
              id="dilution_unit"
              name="dilution_unit"
              value={formData.dilution_unit}
              onChange={handleChange}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="gallon">Gallon(s) of Water</option>
              <option value="liter">Liter(s) of Water</option>
              <option value="sq_ft">Square Foot (sq ft)</option>
              <option value="cubic_yard">Cubic Yard</option>
              <option value="acre">Acre</option>
            </select>
          </div>
          <p className="text-[11px] text-gray-400 mt-1 italic">Leave blank if applying directly to the plant without mixing/measuring an area.</p>
        </div>

        <hr className="border-gray-100" />

        {/* Frequency & Notes */}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 sm:col-span-1">
            <label htmlFor="frequency_days" className="block text-sm font-medium text-gray-700 mb-1">Frequency (Days)</label>
            <input
              type="number"
              id="frequency_days"
              name="frequency_days"
              inputMode="numeric"
              step="1"
              min="1"
              value={formData.frequency_days}
              onChange={handleChange}
              placeholder="e.g., 14"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div className="col-span-2">
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">Application Notes</label>
            <textarea
              id="notes"
              name="notes"
              rows={2}
              value={formData.notes}
              onChange={handleChange}
              placeholder="e.g., Apply early morning to avoid leaf burn."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 text-sm"
            ></textarea>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-gray-900 hover:bg-black text-white font-semibold py-2.5 px-4 rounded-lg shadow-sm transition-colors disabled:opacity-50"
        >
          {isSubmitting ? 'Adding...' : 'Add Schedule'}
        </button>
      </form>
    </div>
  );
}