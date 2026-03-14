import React from 'react';
import { createClient } from '@supabase/supabase-js';
import AmendmentHeader from '@/components/amendments/AmendmentHeader';
import FeedingScheduleList from '@/components/amendments/FeedingScheduleList';
import { AmendmentWithSchedules } from '@/types/amendments';

// Initialize Supabase client (ensure these env vars are set in your Vercel project)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Next.js App Router dynamic page component
export default async function AmendmentDetailPage({ params }: { params: { id: string } }) {
  // Fetch amendment and its relational feeding schedules from Supabase
  const { data, error } = await supabase
    .from('amendments')
    .select(`
      *,
      feeding_schedules (*)
    `)
    .eq('id', params.id)
    .single();

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <p className="text-red-500">Error loading amendment data.</p>
      </div>
    );
  }

  const amendmentData = data as AmendmentWithSchedules;

  return (
    <main className="min-h-screen bg-gray-50 pb-20 pt-6 px-4 max-w-md mx-auto sm:max-w-xl">
      {/* Mobile-optimized constrained width container */}
      <AmendmentHeader amendment={amendmentData} />
      <FeedingScheduleList schedules={amendmentData.feeding_schedules} />
    </main>
  );
}