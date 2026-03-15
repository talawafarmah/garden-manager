'use client';

import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, Sparkles, AlertCircle } from 'lucide-react';

interface AddFeedingScheduleFormProps {
  amendmentId: string;
  amendmentBrand: string;
  amendmentName: string;
  onSuccess: () => void;
}

export default function AddFeedingScheduleForm({ 
  amendmentId, 
  amendmentBrand, 
  amendmentName, 
  onSuccess 
}: AddFeedingScheduleFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    stage: 'all',
    amount: '',
    frequency: '',
    notes: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAILookup = async () => {
    setIsSearching(true);
    setError(null);
    try {
      const response = await fetch('/api/generate-feeding-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand: amendmentBrand, name: amendmentName }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setFormData({
        stage: data.stage || 'all',
        amount: data.amount || '',
        frequency: data.frequency || '',
        notes: data.notes || ''
      });
    } catch (err: any) {
      setError(err.message || "Failed to fetch AI recommendations.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const payload = {
      amendment_id: amendmentId,
      stage: formData.stage,
      amount: formData.amount,
      frequency: formData.frequency,
      notes: formData.notes
    };

    const { error: submitError } = await supabase
      .from('feeding_schedules')
      .insert([payload]);

    setIsSubmitting(false);

    if (submitError) {
      setError(submitError.message);
    } else {
      onSuccess();
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
      
      {/* The AI Magic Button */}
      <button
        type="button"
        onClick={handleAILookup}
        disabled={isSearching}
        className="w-full mb-6 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 text-green-800 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 hover:bg-green-100 transition-colors disabled:opacity-50"
      >
        {isSearching ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} className="text-emerald-600" />}
        {isSearching ? 'Searching Web for Guidelines...' : 'Auto-Fill with AI Web Search'}
      </button>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm flex items-start">
          <AlertCircle size={16} className="mr-2 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Growth Stage</label>
          <select
            name="stage"
            value={formData.stage}
            onChange={handleChange}
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 font-bold focus:ring-2 focus:ring-green-500 outline-none appearance-none"
          >
            <option value="all">All Stages (General Use)</option>
            <option value="seedling">Seedling / Clone</option>
            <option value="vegetative">Vegetative Growth</option>
            <option value="flowering">Flowering / Fruiting</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Dosage / Amount</label>
          <input
            type="text"
            name="amount"
            required
            value={formData.amount}
            onChange={handleChange}
            placeholder="e.g. 2 Tbsp per gallon"
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 font-bold focus:ring-2 focus:ring-green-500 outline-none placeholder-gray-400"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Frequency</label>
          <input
            type="text"
            name="frequency"
            required
            value={formData.frequency}
            onChange={handleChange}
            placeholder="e.g. Every watering, or Once a week"
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 font-bold focus:ring-2 focus:ring-green-500 outline-none placeholder-gray-400"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Notes / Warnings</label>
          <textarea
            name="notes"
            rows={2}
            value={formData.notes}
            onChange={handleChange}
            placeholder="e.g. Do not mix with calcium products..."
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 font-medium focus:ring-2 focus:ring-green-500 outline-none placeholder-gray-400"
          ></textarea>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-gray-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          {isSubmitting ? 'Saving...' : 'Save Instruction'}
        </button>
      </form>
    </div>
  );
}