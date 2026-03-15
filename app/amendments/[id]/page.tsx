'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { AmendmentWithSchedules, FeedingSchedule } from '@/types/amendments';
import { ArrowLeft, Plus, Beaker, Loader2, Sparkles, Trash2, Edit2 } from 'lucide-react';

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
  
  // States for CRUD forms
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<FeedingSchedule | null>(null);
  
  const [isSearching, setIsSearching] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchAmendmentData = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('amendments')
      .select(`*, feeding_schedules (*)`)
      .eq('id', params.id)
      .single();

    if (data) setAmendment(data as AmendmentWithSchedules);
    setLoading(false);
  };

  useEffect(() => {
    fetchAmendmentData();
  }, [params.id]);

  // --- AMENDMENT CRUD ---
  const handleDeleteAmendment = async () => {
    if (!window.confirm(`Are you sure you want to delete ${amendment?.name}? This cannot be undone.`)) return;
    setIsDeleting(true);
    
    const { error } = await supabase.from('amendments').delete().eq('id', params.id);
    
    if (error) {
      alert("Failed to delete: " + error.message);
      setIsDeleting(false);
    } else {
      handleGoBack('amendments');
    }
  };

  // --- SCHEDULE CRUD ---
  const handleDeleteSchedule = async (scheduleId: string) => {
    const { error } = await supabase.from('feeding_schedules').delete().eq('id', scheduleId);
    if (error) alert("Failed to delete schedule: " + error.message);
    else fetchAmendmentData();
  };

  const handleOpenEditSchedule = (schedule: FeedingSchedule) => {
    setEditingSchedule(schedule);
    setShowScheduleForm(true);
  };

  const handleCloseScheduleForm = () => {
    setEditingSchedule(null);
    setShowScheduleForm(false);
  };

  const handleAILookup = async () => {
    if (!amendment) return;
    setIsSearching(true);
    try {
      const response = await fetch('/api/generate-feeding-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand: amendment.brand, name: amendment.name }),
      });

      const schedules = await response.json();
      if (!response.ok) throw new Error(schedules.error);

      const payload = schedules.map((sched: any) => ({
        amendment_id: amendment.id,
        growth_stage: sched.growth_stage || 'vegetative',
        method: sched.method || 'soil_drench',
        dosage_amount: Number(sched.dosage_amount) || 0,
        dosage_unit: sched.dosage_unit || 'tbsp',
        dilution_amount: Number(sched.dilution_amount) || 0,
        dilution_unit: sched.dilution_unit || 'gallon',
        frequency_days: Number(sched.frequency_days) || null,
        notes: sched.notes || ''
      }));

      const { error: submitError } = await supabase.from('feeding_schedules').insert(payload);
      if (submitError) throw submitError;

      fetchAmendmentData();
    } catch (err: any) {
      alert("AI Search Failed: " + err.message);
    } finally {
      setIsSearching(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-700"></div>
      <p className="text-gray-500 font-medium">Loading product analysis...</p>
    </div>
  );

  if (!amendment) return (
    <div className="p-6 text-center">
      <p className="text-red-500 mb-4">Amendment not found.</p>
      <button onClick={() => handleGoBack('amendments')} className="text-green-700 font-bold">Return to Digital Shed</button>
    </div>
  );

  return (
    <div className="max-w-xl mx-auto pb-24">
      {/* Navigation Header */}
      <div className="flex justify-between items-center mb-6 px-1">
        <button onClick={() => handleGoBack('amendments')} className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft size={24} className="text-gray-700" />
        </button>
        <div className="flex gap-2">
          
          {/* EDIT AMENDMENT BUTTON */}
          <button 
            onClick={() => navigateTo('amendment_new', amendment)}
            className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-full transition-colors"
          >
            <Edit2 size={20} />
          </button>

          {/* DELETE AMENDMENT BUTTON */}
          <button 
            disabled={isDeleting}
            onClick={handleDeleteAmendment}
            className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-full transition-colors disabled:opacity-50"
          >
            {isDeleting ? <Loader2 size={20} className="animate-spin" /> : <Trash2 size={20} />}
          </button>
          
          {/* ADD SCHEDULE BUTTON */}
          <button 
            onClick={() => {
              setEditingSchedule(null);
              setShowScheduleForm(!showScheduleForm);
            }}
            className={`p-2 rounded-full shadow-md transition-colors ${showScheduleForm && !editingSchedule ? 'bg-gray-800 text-white' : 'bg-green-700 text-white'}`}
          >
            {showScheduleForm && !editingSchedule ? <ArrowLeft size={20} /> : <Plus size={20} />}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {!showScheduleForm ? (
          <>
            <AmendmentHeader amendment={amendment} />
            
            <div className="px-1">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Nutrient Schedules</h3>
                <button
                  onClick={handleAILookup}
                  disabled={isSearching}
                  className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 hover:bg-emerald-100 transition-colors disabled:opacity-50 shadow-sm active:scale-95"
                >
                  {isSearching ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} className="text-emerald-500" />}
                  {isSearching ? 'Searching Web...' : 'AI Web Search'}
                </button>
              </div>

              <FeedingScheduleList 
                schedules={amendment.feeding_schedules} 
                onEdit={handleOpenEditSchedule}
                onDelete={handleDeleteSchedule}
              />
            </div>
            
            {amendment.derived_from && (
              <div className="px-4 py-3 bg-white border border-gray-100 rounded-xl shadow-sm">
                <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Source / Ingredients</h4>
                <p className="text-sm text-gray-700 font-medium leading-relaxed italic">{amendment.derived_from}</p>
              </div>
            )}
          </>
        ) : (
          <div className="animate-in slide-in-from-bottom-4 duration-300">
             <div className="flex items-center gap-2 mb-4 px-1">
                <Beaker className="text-green-700" size={20} />
                <h2 className="text-xl font-bold">{editingSchedule ? 'Edit Guideline' : 'New Guideline'}</h2>
             </div>
             
             <AddFeedingScheduleForm 
                amendmentId={amendment.id}
                initialData={editingSchedule}
                onSuccess={() => {
                  handleCloseScheduleForm();
                  fetchAmendmentData();
                }} 
                onCancel={handleCloseScheduleForm}
              />
          </div>
        )}
      </div>
    </div>
  );
}