'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase'; // Aligned with your file structure
import { AmendmentWithSchedules, Amendment, FeedingSchedule } from '@/types/amendments';
import { ArrowLeft, Plus, Beaker, Leaf, Droplets, Sun } from 'lucide-react';

// Sub-components
import AmendmentHeader from '@/components/amendments/AmendmentHeader';
import FeedingScheduleList from '@/components/amendments/FeedingScheduleList';
import AddFeedingScheduleForm from '@/components/amendments/AddFeedingScheduleForm';

interface AmendmentDetailPageProps {
  params: { id: string };
  navigateTo: (view: any, payload?: any) => void;
  handleGoBack: (fallbackView: any) => void;
}

export default function AmendmentDetailPage({ params, navigateTo, handleGoBack }: AmendmentDetailPageProps) {
  const [amendment, setAmendment] = useState<AmendmentWithSchedules | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddSchedule, setShowAddSchedule] = useState(false);

  const fetchAmendmentData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('amendments')
      .select(`
        *,
        feeding_schedules (*)
      `)
      .eq('id', params.id)
      .single();

    if (data) {
      setAmendment(data as AmendmentWithSchedules);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAmendmentData();
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-700"></div>
        <p className="text-gray-500 font-medium">Loading product analysis...</p>
      </div>
    );
  }

  if (!amendment) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-500 mb-4">Amendment not found.</p>
        <button onClick={() => handleGoBack('amendments')} className="text-green-700 font-bold">
          Return to Digital Shed
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto pb-24">
      {/* Navigation Header */}
      <div className="flex justify-between items-center mb-6 px-1">
        <button 
          onClick={() => handleGoBack('amendments')} 
          className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft size={24} className="text-gray-700" />
        </button>
        <div className="flex gap-2">
           <button 
            onClick={() => setShowAddSchedule(!showAddSchedule)}
            className={`p-2 rounded-full shadow-md transition-colors ${
              showAddSchedule ? 'bg-gray-800 text-white' : 'bg-green-700 text-white'
            }`}
          >
            {showAddSchedule ? <ArrowLeft size={20} /> : <Plus size={20} />}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="space-y-6">
        {!showAddSchedule ? (
          <>
            <AmendmentHeader amendment={amendment} />
            
            <div className="px-1">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">
                Nutrient Schedules
              </h3>
              <FeedingScheduleList schedules={amendment.feeding_schedules} />
              
              {amendment.feeding_schedules.length === 0 && (
                <div className="bg-orange-50 border border-orange-100 p-4 rounded-xl text-center">
                  <p className="text-orange-800 text-sm mb-3">
                    No feeding instructions added yet.
                  </p>
                  <button 
                    onClick={() => setShowAddSchedule(true)}
                    className="text-xs font-bold uppercase tracking-wide bg-orange-100 text-orange-800 px-4 py-2 rounded-lg"
                  >
                    Add Manufacturer Guidelines
                  </button>
                </div>
              )}
            </div>
            
            {amendment.derived_from && (
              <div className="px-4 py-3 bg-white border border-gray-100 rounded-xl">
                <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Source / Ingredients</h4>
                <p className="text-sm text-gray-600 leading-relaxed italic">
                  {amendment.derived_from}
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="animate-in slide-in-from-bottom-4 duration-300">
             <div className="flex items-center gap-2 mb-4 px-1">
                <Beaker className="text-green-700" size={20} />
                <h2 className="text-xl font-bold">New Instruction</h2>
             </div>
             <AddFeedingScheduleForm 
  amendmentId={amendment.id}
  amendmentBrand={amendment.brand} // NEW
  amendmentName={amendment.name}   // NEW
  onSuccess={() => {
    setShowAddSchedule(false);
    fetchAmendmentData();
  }} 
/>
             <button 
               onClick={() => setShowAddSchedule(false)}
               className="w-full mt-4 py-3 text-gray-500 text-sm font-medium"
             >
               Cancel and go back
             </button>
          </div>
        )}
      </div>
    </div>
  );
}