'use client';

import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, AlertCircle } from 'lucide-react';
import { FeedingSchedule, GrowthStage, ApplicationMethod, MeasurementUnit, DilutionUnit } from '@/types/amendments';

interface AddFeedingScheduleFormProps {
  amendmentId: string;
  initialData?: FeedingSchedule | null; // If passed, we are in Edit Mode
  onSuccess: () => void;
  onCancel: () => void;
}

export default function AddFeedingScheduleForm({ 
  amendmentId, 
  initialData,
  onSuccess,
  onCancel
}: AddFeedingScheduleFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!initialData;

  // Initialize state with initialData if editing, or defaults if creating
  const [formData, setFormData] = useState({
    growth_stage: initialData?.growth_stage || 'vegetative' as GrowthStage,
    method: initialData?.method || 'soil_drench' as ApplicationMethod,
    dosage_amount: initialData?.dosage_amount || '',
    dosage_unit: initialData?.dosage_unit || 'tbsp' as MeasurementUnit,
    dilution_amount: initialData?.dilution_amount || '',
    dilution_unit: initialData?.dilution_unit || 'gallon' as DilutionUnit,
    frequency_days: initialData?.frequency_days || '',
    notes: initialData?.notes || ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const payload = {
      amendment_id: amendmentId,
      growth_stage: formData.growth_stage,
      method: formData.method,
      dosage_amount: Number(formData.dosage_amount) || 0,
      dosage_unit: formData.dosage_unit,
      dilution_amount: Number(formData.dilution_amount) || 0,
      dilution_unit: formData.dilution_unit,
      frequency_days: Number(formData.frequency_days) || null,
      notes: formData.notes
    };

    let submitError;

    if (isEditing && initialData?.id) {
      // UPDATE existing record
      const { error } = await supabase
        .from('feeding_schedules')
        .update(payload)
        .eq('id', initialData.id);
      submitError = error;
    } else {
      // INSERT new record
      const { error } = await supabase
        .from('feeding_schedules')
        .insert([payload]);
      submitError = error;
    }

    setIsSubmitting(false);

    if (submitError) {
      setError(submitError.message);
    } else {
      onSuccess();
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
      <h3 className="text-lg font-bold text-gray-900 mb-4">
        {isEditing ? 'Edit Guideline' : 'Manual Entry'}
      </h3>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm flex items-start">
          <AlertCircle size={16} className="mr-2 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Growth Stage</label>
            <select
              name="growth_stage"
              value={formData.growth_stage}
              onChange={handleChange}
              className="w-full px-3 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 font-bold focus:ring-2 focus:ring-green-500 outline-none"
            >
              <option value="seedling">Seedling</option>
              <option value="vegetative">Vegetative</option>
              <option value="flowering">Flowering</option>
              <option value="fruiting">Fruiting</option>
              <option value="dormant">Dormant</option>
              <option value="pre_plant">Pre-Plant</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Method</label>
            <select
              name="method"
              value={formData.method}
              onChange={handleChange}
              className="w-full px-3 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 font-bold focus:ring-2 focus:ring-green-500 outline-none"
            >
              <option value="soil_drench">Soil Drench</option>
              <option value="foliar_spray">Foliar Spray</option>
              <option value="top_dress">Top Dress</option>
              <option value="soil_mix">Soil Mix</option>
              <option value="hydroponic">Hydroponic</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Amount</label>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.1"
                name="dosage_amount"
                required
                value={formData.dosage_amount}
                onChange={handleChange}
                placeholder="0"
                className="w-full px-3 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 font-bold focus:ring-2 focus:ring-green-500 outline-none"
              />
              <select
                name="dosage_unit"
                value={formData.dosage_unit}
                onChange={handleChange}
                className="w-full px-2 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 font-bold focus:ring-2 focus:ring-green-500 outline-none"
              >
                <option value="ml">ml</option>
                <option value="tsp">tsp</option>
                <option value="tbsp">tbsp</option>
                <option value="cup">cup</option>
                <option value="oz">oz</option>
                <option value="g">g</option>
                <option value="lbs">lbs</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Dilution (Per)</label>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.1"
                name="dilution_amount"
                value={formData.dilution_amount}
                onChange={handleChange}
                placeholder="1"
                className="w-full px-3 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 font-bold focus:ring-2 focus:ring-green-500 outline-none"
              />
              <select
                name="dilution_unit"
                value={formData.dilution_unit}
                onChange={handleChange}
                className="w-full px-2 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 font-bold focus:ring-2 focus:ring-green-500 outline-none"
              >
                <option value="gallon">gal</option>
                <option value="liter">L</option>
                <option value="sq_ft">sq ft</option>
                <option value="cubic_yard">yd³</option>
              </select>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Frequency (Days)</label>
          <input
            type="number"
            name="frequency_days"
            value={formData.frequency_days}
            onChange={handleChange}
            placeholder="e.g. 7 for weekly"
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 font-bold focus:ring-2 focus:ring-green-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Notes / Warnings</label>
          <textarea
            name="notes"
            rows={2}
            value={formData.notes}
            onChange={handleChange}
            placeholder="e.g. Do not mix with calcium products..."
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 font-medium focus:ring-2 focus:ring-green-500 outline-none"
          ></textarea>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="w-1/3 bg-gray-100 text-gray-700 font-bold py-4 rounded-xl hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-2/3 bg-gray-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-gray-800 transition-colors disabled:opacity-50 flex justify-center items-center"
          >
            {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : (isEditing ? 'Update Guideline' : 'Save Guideline')}
          </button>
        </div>
      </form>
    </div>
  );
}