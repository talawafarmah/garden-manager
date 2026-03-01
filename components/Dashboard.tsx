import React from 'react';
import { AppView } from '../types';

interface DashboardProps {
  navigateTo: (view: AppView) => void;
  userRole?: string;
}

export default function Dashboard({ navigateTo, userRole = 'viewer' }: DashboardProps) {
  return (
    <main className="min-h-screen bg-stone-50 p-6 font-sans">
      <header className="mb-8 mt-4">
        <h1 className="text-3xl font-black text-stone-900 tracking-tight">Garden Manager</h1>
        <p className="text-stone-500 font-medium mt-1">What are we working on today?</p>
      </header>

      <div className="grid grid-cols-2 gap-4">
        <button onClick={() => navigateTo('vault')} className="bg-white p-6 rounded-3xl shadow-sm border border-stone-200 text-left hover:border-emerald-400 hover:shadow-md transition-all active:scale-95 group flex flex-col items-start">
          <div className="bg-emerald-100 text-emerald-600 p-3 rounded-2xl mb-4 group-hover:scale-110 transition-transform">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
          </div>
          <h2 className="font-black text-stone-800 text-lg">Seed Vault</h2>
          <p className="text-xs text-stone-500 font-medium mt-1">Browse inventory</p>
        </button>

        <button onClick={() => navigateTo('trays')} className="bg-white p-6 rounded-3xl shadow-sm border border-stone-200 text-left hover:border-emerald-400 hover:shadow-md transition-all active:scale-95 group flex flex-col items-start">
          <div className="bg-emerald-100 text-emerald-600 p-3 rounded-2xl mb-4 group-hover:scale-110 transition-transform">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
          </div>
          <h2 className="font-black text-stone-800 text-lg">Tray Tracker</h2>
          <p className="text-xs text-stone-500 font-medium mt-1">Manage seedlings</p>
        </button>
      </div>

      {/* Admin Section (Only visible to authenticated admin) */}
      {userRole === 'admin' && (
        <div className="mt-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 mb-4 ml-1">Nursery Admin</h3>
          <div className="grid grid-cols-1 gap-4">
            
            <button onClick={() => navigateTo('admin_seasons')} className="bg-stone-800 p-5 rounded-3xl shadow-sm border border-stone-700 text-left hover:bg-stone-700 transition-all active:scale-95 flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="bg-stone-700 text-emerald-400 p-3 rounded-2xl group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                </div>
                <div>
                  <h2 className="font-black text-white text-lg">Season & Links</h2>
                  <p className="text-xs text-stone-400 font-medium mt-0.5">Manage wishlist links</p>
                </div>
              </div>
              <svg className="w-5 h-5 text-stone-500 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>

            <button onClick={() => navigateTo('admin_demand')} className="bg-stone-800 p-5 rounded-3xl shadow-sm border border-stone-700 text-left hover:bg-stone-700 transition-all active:scale-95 flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="bg-stone-700 text-blue-400 p-3 rounded-2xl group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <div>
                  <h2 className="font-black text-white text-lg">Demand Planner</h2>
                  <p className="text-xs text-stone-400 font-medium mt-0.5">View submitted requests</p>
                </div>
              </div>
              <svg className="w-5 h-5 text-stone-500 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>

          </div>
        </div>
      )}
    </main>
  );
}