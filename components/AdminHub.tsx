import React from 'react';
import { AppView } from '../types';

interface Props {
  navigateTo: (view: AppView) => void;
  handleGoBack: (view: AppView) => void;
  userRole?: string;
}

export default function AdminHub({ navigateTo, handleGoBack, userRole }: Props) {
  if (userRole !== 'admin') return <div className="p-10 text-center">Access Denied</div>;

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900 pb-20 font-sans">
      <header className="bg-stone-900 text-white p-4 shadow-md sticky top-0 z-10 flex items-center gap-3">
        <button onClick={() => handleGoBack('dashboard')} className="p-2 bg-stone-800 rounded-full hover:bg-stone-700 transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h1 className="text-xl font-bold">Admin Control Panel</h1>
      </header>

      <div className="max-w-md mx-auto p-4 mt-4 space-y-4">
        
        {/* Grow Planner */}
        <button onClick={() => navigateTo('grow_planner')} className="w-full bg-white p-5 rounded-2xl shadow-sm border border-stone-200 text-left hover:border-amber-400 hover:shadow-md transition-all active:scale-95 flex items-center gap-4 group">
          <div className="bg-amber-50 text-amber-600 p-3 rounded-xl group-hover:bg-amber-100 transition-colors"><svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></div>
          <div className="flex-1">
            <h3 className="font-black text-stone-800 text-lg">Grow Planner</h3>
            <p className="text-xs text-stone-500 mt-0.5">Generate seed starting timelines based on demand.</p>
          </div>
          <svg className="w-5 h-5 text-stone-300 group-hover:text-amber-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>

        {/* Demand Planner */}
        <button onClick={() => navigateTo('admin_demand')} className="w-full bg-white p-5 rounded-2xl shadow-sm border border-stone-200 text-left hover:border-blue-400 hover:shadow-md transition-all active:scale-95 flex items-center gap-4 group">
          <div className="bg-blue-50 text-blue-600 p-3 rounded-xl group-hover:bg-blue-100 transition-colors"><svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg></div>
          <div className="flex-1">
            <h3 className="font-black text-stone-800 text-lg">Demand Planner</h3>
            <p className="text-xs text-stone-500 mt-0.5">View aggregated requests from your wishlists.</p>
          </div>
          <svg className="w-5 h-5 text-stone-300 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>

        {/* Seasons & Links */}
        <button onClick={() => navigateTo('admin_seasons')} className="w-full bg-white p-5 rounded-2xl shadow-sm border border-stone-200 text-left hover:border-emerald-400 hover:shadow-md transition-all active:scale-95 flex items-center gap-4 group">
          <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl group-hover:bg-emerald-100 transition-colors"><svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg></div>
          <div className="flex-1">
            <h3 className="font-black text-stone-800 text-lg">Seasons & Links</h3>
            <p className="text-xs text-stone-500 mt-0.5">Manage wishlist catalog links for friends and family.</p>
          </div>
          <svg className="w-5 h-5 text-stone-300 group-hover:text-emerald-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>

        {/* Categories Config */}
        <button onClick={() => navigateTo('admin_categories')} className="w-full bg-white p-5 rounded-2xl shadow-sm border border-stone-200 text-left hover:border-purple-400 hover:shadow-md transition-all active:scale-95 flex items-center gap-4 group">
          <div className="bg-purple-50 text-purple-600 p-3 rounded-xl group-hover:bg-purple-100 transition-colors"><svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg></div>
          <div className="flex-1">
            <h3 className="font-black text-stone-800 text-lg">Category Config</h3>
            <p className="text-xs text-stone-500 mt-0.5">Set default nursery times for plant categories.</p>
          </div>
          <svg className="w-5 h-5 text-stone-300 group-hover:text-purple-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>

      </div>
    </main>
  );
}