import React from 'react';
import { SeedlingTray } from '../types';

/**
 * TrayList Component
 * * Displays the gallery of all active seedling trays.
 * navMetadata allows this component to return to a previous context (like a Seed Detail)
 * if the user arrived here from somewhere other than the main dashboard.
 */
export default function TrayList({ trays, navigateTo, handleGoBack, isLoadingDB, navMetadata }: any) {
  const handleCreateNewTray = () => {
    const newTray: SeedlingTray = {
      name: `Tray ${trays.length + 1}`, 
      tray_type: "72-Cell Flat", 
      sown_date: new Date().toISOString().split('T')[0], 
      first_germination_date: "", 
      first_planted_date: "", 
      heat_mat: false, 
      humidity_dome: false, 
      grow_light: false, 
      potting_mix: "Standard Seed Starting Mix", 
      location: "Indoors", 
      notes: "", 
      images: [], 
      contents: []
    };
    navigateTo('tray_edit', newTray);
  };

  /**
   * DYNAMIC BACK LOGIC:
   * If navMetadata contains a return path (e.g., from a Seed Detail page), 
   * we return there. Otherwise, we go to the main dashboard.
   */
  const onBack = () => {
    if (navMetadata?.returnTo) {
      navigateTo(navMetadata.returnTo, navMetadata.returnPayload);
    } else {
      navigateTo('dashboard');
    }
  };

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900 pb-20">
      <header className="bg-emerald-800 text-white p-4 shadow-md sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 bg-emerald-900 rounded-full hover:bg-emerald-700 transition-colors shadow-sm">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h1 className="text-xl font-bold">Seedling Tracker</h1>
        </div>
        <button onClick={handleCreateNewTray} className="bg-emerald-500 hover:bg-emerald-400 text-white px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          New Tray
        </button>
      </header>

      <div className="max-w-md mx-auto p-4 space-y-3">
        {isLoadingDB ? (
          <div className="flex justify-center py-10 text-emerald-600">
            <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          </div>
        ) : trays.length > 0 ? (
          trays.map((tray: SeedlingTray) => {
            const totalSown = tray.contents.reduce((s, i) => s + (i.sown_count || 0), 0);
            return (
              <div 
                key={tray.id} 
                onClick={() => navigateTo('tray_detail', tray)} 
                className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-sm flex gap-4 items-center hover:border-emerald-400 hover:shadow-md cursor-pointer transition-all active:scale-95 group"
              >
                <div className="w-16 h-16 rounded-xl bg-stone-100 flex-shrink-0 border border-stone-200 overflow-hidden relative shadow-inner">
                  {tray.thumbnail ? (
                    <img src={tray.thumbnail} className="w-full h-full object-cover" alt={tray.name} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-stone-300">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" /></svg>
                    </div>
                  )}
                  {tray.heat_mat && <div className="absolute bottom-0 right-0 bg-amber-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-tl-lg shadow-sm">HEAT</div>}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-stone-800 text-base truncate leading-tight group-hover:text-emerald-700 transition-colors">{tray.name}</h3>
                  <div className="text-xs text-stone-500 mt-1 mb-2 truncate font-medium">Sown: {tray.sown_date} • {tray.location || tray.tray_type}</div>
                  <div className="flex gap-2">
                     <span className="text-[10px] font-bold bg-stone-100 text-stone-600 px-2 py-0.5 rounded border border-stone-200 uppercase tracking-wider">{tray.contents.length} Varieties</span>
                     <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200 uppercase tracking-wider">{totalSown} Seeds</span>
                  </div>
                </div>
                <div className="text-stone-300 group-hover:text-emerald-500 transition-colors pr-1">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </div>
              </div>
            );
          })
        ) : (
           <div className="text-center py-12 text-stone-500 bg-white rounded-2xl border border-stone-100 shadow-sm px-6">
              <div className="bg-stone-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-stone-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
              </div>
              <p className="font-medium text-stone-600">No seedling trays tracked yet.</p>
              <button onClick={handleCreateNewTray} className="mt-4 text-emerald-600 font-bold border border-emerald-200 bg-emerald-50 px-5 py-2.5 rounded-xl hover:bg-emerald-100 transition-all shadow-sm">Start your first tray</button>
           </div>
        )}
      </div>
    </main>
  );
}