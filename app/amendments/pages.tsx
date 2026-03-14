import React from 'react';
import { createClient } from '@supabase/supabase-js';
import AmendmentList from '@/components/amendments/AmendmentList';
import { Amendment } from '@/types/amendments';
import { redirect } from 'next/navigation';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const revalidate = 0; 

export default async function AmendmentsShedPage() {
  // Fetch all amendments
  const { data, error } = await supabase
    .from('amendments')
    .select('*')
    .order('brand', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-red-50 p-6 rounded-xl text-red-700 border border-red-200">
          <p className="font-bold">Failed to load Digital Shed</p>
          <p className="text-sm">{error.message}</p>
        </div>
      </div>
    );
  }

  const amendments = (data || []) as Amendment[];

  /**
   * IMPORTANT: Since this is a server component page, we create
   * client-side shims for the SPA navigation props to satisfy 
   * the AmendmentList interface.
   */
  return (
    <main className="min-h-screen bg-gray-50 pb-20 pt-6 px-4 max-w-3xl mx-auto">
      <AmendmentList 
        initialAmendments={amendments} 
        // These shims allow the component to function even on a direct route
        navigateTo={(view, payload) => {
          if (view === 'amendment_new') window.location.href = '/amendments/new';
          if (view === 'amendment_detail') window.location.href = `/amendments/${payload.id}`;
          if (view === 'dashboard') window.location.href = '/';
        }}
        handleGoBack={(fallback) => {
          window.history.back();
        }}
      />
    </main>
  );
}