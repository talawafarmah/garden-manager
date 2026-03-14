import React from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import AmendmentList from '@/components/amendments/AmendmentList';
import { Amendment } from '@/types/amendments';

// Initialize Supabase client for server-side fetching
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// We want this page to dynamically fetch the latest data, not serve a stale cached build
export const revalidate = 0; 

export default async function AmendmentsShedPage() {
  // Fetch all amendments, ordered alphabetically by brand, then name
  const { data, error } = await supabase
    .from('amendments')
    .select('*')
    .order('brand', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-red-50 p-6 rounded-xl text-red-700 max-w-md w-full text-center border border-red-200">
          <p className="font-bold mb-2">Failed to load Digital Shed</p>
          <p className="text-sm">{error.message}</p>
        </div>
      </div>
    );
  }

  const amendments = (data || []) as Amendment[];

  return (
    <main className="min-h-screen bg-gray-50 pb-20 pt-6 px-4 max-w-3xl mx-auto">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Digital Shed</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your soil amendments & fertilizers.</p>
        </div>
        <Link 
          href="/amendments/new" 
          className="bg-green-700 hover:bg-green-800 text-white p-3 rounded-full shadow-md transition-transform hover:scale-105 active:scale-95"
          aria-label="Add new amendment"
        >
          <Plus size={24} />
        </Link>
      </div>

      <AmendmentList initialAmendments={amendments} />
    </main>
  );
}