import React from 'react';
import { FeedingSchedule } from '@/types/amendments';

interface FeedingScheduleListProps {
  schedules: FeedingSchedule[];
}

export default function FeedingScheduleList({ schedules }: FeedingScheduleListProps) {
  if (!schedules || schedules.length === 0) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg text-gray-500 text-center text-sm">
        No specific feeding schedule data available for this product.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-gray-900 mb-2">Application Guide</h2>
      
      {schedules.map((schedule) => (
        <div 
          key={schedule.id} 
          className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm"
        >
          {/* Header row: Stage & Method */}
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
            <span className="font-semibold text-gray-800 capitalize">
              {schedule.growth_stage.replace('_', ' ')} Stage
            </span>
            <span className="text-xs font-medium px-2 py-1 bg-white border border-gray-200 rounded-full text-gray-600 capitalize">
              {schedule.method.replace('_', ' ')}
            </span>
          </div>

          {/* Details row: Dosage, Dilution, Frequency */}
          <div className="p-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Mix Rate</p>
              <p className="font-medium text-gray-900">
                {schedule.dosage_amount} {schedule.dosage_unit}
                {schedule.dilution_amount && schedule.dilution_unit && (
                  <span className="text-gray-600 font-normal">
                    {' '}/ {schedule.dilution_amount} {schedule.dilution_unit.replace('_', ' ')}
                  </span>
                )}
              </p>
            </div>

            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Frequency</p>
              <p className="font-medium text-gray-900">
                {schedule.frequency_days 
                  ? `Every ${schedule.frequency_days} days` 
                  : 'As needed / One-time'}
              </p>
            </div>

            {/* Notes full width */}
            {schedule.notes && (
              <div className="col-span-2 mt-2 pt-2 border-t border-gray-100">
                <p className="text-sm text-gray-600 italic">
                  Note: {schedule.notes}
                </p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}