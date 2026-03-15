'use client';

import React from 'react';
import { Droplets, Calendar, AlertCircle, Leaf } from 'lucide-react';
import { FeedingSchedule } from '@/types/amendments';

interface FeedingScheduleListProps {
  schedules: FeedingSchedule[];
}

export default function FeedingScheduleList({ schedules }: FeedingScheduleListProps) {
  
  if (!schedules || schedules.length === 0) {
    return (
      <div className="bg-gray-50 border border-dashed border-gray-200 rounded-2xl p-8 text-center mt-2">
        <Leaf className="mx-auto text-gray-300 mb-3" size={32} />
        <p className="text-sm font-semibold text-gray-500">No feeding schedules added yet.</p>
        <p className="text-xs text-gray-400 mt-1">Use the AI search or add one manually below.</p>
      </div>
    );
  }

  const getStageStyles = (stage: string) => {
    switch (stage?.toLowerCase()) {
      case 'seedling':
      case 'pre_plant':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'vegetative':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'flowering':
      case 'fruiting':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'dormant':
        return 'bg-gray-100 text-gray-600 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'; 
    }
  };

  const formatStageLabel = (stage: string) => {
    if (!stage) return 'General';
    return stage.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatMethodLabel = (method: string) => {
    if (!method) return '';
    return method.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="space-y-4 mt-2">
      {schedules.map((schedule) => (
        <div 
          key={schedule.id} 
          className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm"
        >
          <div className="flex justify-between items-start mb-4">
            <span className={`text-[10px] font-extrabold uppercase tracking-widest px-3 py-1.5 rounded-lg border ${getStageStyles(schedule.growth_stage)}`}>
              {formatStageLabel(schedule.growth_stage)}
            </span>
            <span className="text-[10px] font-bold text-gray-500 uppercase bg-gray-50 px-2 py-1 rounded">
              {formatMethodLabel(schedule.method)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-1">
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
              <div className="flex items-center text-gray-500 mb-1.5">
                <Droplets size={14} className="mr-1.5" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Dosage</span>
              </div>
              <p className="text-sm font-extrabold text-gray-900 break-words">
                {schedule.dosage_amount} {schedule.dosage_unit}
                {schedule.dilution_amount && schedule.dilution_amount > 0 ? ` / ${schedule.dilution_amount} ${schedule.dilution_unit}` : ''}
              </p>
            </div>

            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
              <div className="flex items-center text-gray-500 mb-1.5">
                <Calendar size={14} className="mr-1.5" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Frequency</span>
              </div>
              <p className="text-sm font-extrabold text-gray-900 break-words">
                {schedule.frequency_days ? `Every ${schedule.frequency_days} days` : 'As needed'}
              </p>
            </div>
          </div>

          {schedule.notes && schedule.notes.trim() !== '' && (
            <div className="bg-amber-50/50 border border-amber-100 p-3 rounded-xl flex items-start mt-3">
              <AlertCircle size={16} className="text-amber-600 mr-2 flex-shrink-0 mt-0.5" />
              <p className="text-xs font-semibold text-amber-900 leading-relaxed">
                {schedule.notes}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}