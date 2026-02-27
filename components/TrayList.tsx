import React from 'react';
import { SeedlingTray } from '../types';

export default function TrayList({ trays, navigateTo, handleGoBack, isLoadingDB }: any) {
  const handleCreateNewTray = () => {
    const newTray: SeedlingTray = {
      name: `Tray ${trays.length + 1}`, tray_type: "72-Cell Flat", sown_date: new Date().toISOString().split('T')[0], first_germination_date: "", first_planted_date: "", heat_mat: false, humidity_dome: false, grow_light: false, potting_mix: "Standard Seed Starting Mix", location: "Indoors", notes: "", images: [], contents: []
    };
    navigateTo('tray_edit', newTray);
  };

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900 pb-20">
      <header className="bg-emerald-800 text-white p-4 shadow-md sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => handleGoBack('dashboard')} className="p-2 bg-emerald-900 rounded-full hover:bg-emerald-700 transition-colors"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
          <h1 className="text-xl font-bold">Seedling Tracker</h1>
        </div>
        <button onClick={handleCreateNewTray} className="bg-emerald-500 hover:bg-emerald-400 text-white px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm flex items-center gap-1"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>New Tray</button>
      </header>

      <div className="max-w-md mx-auto p-4 space-y-3">
        {isLoadingDB ? (
          <div className="flex justify-center py-10 text-emerald-600"><svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>
        ) : trays.length > 0 ? (
          trays.map((tray: SeedlingTray) => {
            const totalSown = tray.contents.reduce((s, i) => s + (i.sown_count || 0), 0);
            const thumb = tray.images && tray.images.length > 0 ? tray.images[0] : null;

            return (
              <div key={tray.id} onClick={() => navigateTo('tray_detail', tray)} className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-sm flex gap-4 items-center hover:border-emerald-400 hover:shadow-md cursor-pointer transition-all active:scale-95">
                <div className="w-16 h-16 rounded-xl bg-stone-100 flex-shrink-0 border border-stone-200 overflow-hidden relative">
                  {thumb ? <img src={thumb} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-stone-300"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg></div>}
                  {tray.heat_mat && <div className="absolute bottom-0 right-0 bg-amber-500 text-white text-[8px] font-bold px-1 rounded-tl-lg">HEAT</div>}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-stone-800 text-base truncate leading-tight">{tray.name}</h3>
                  <div className="text-xs text-stone-500 mt-1 mb-2 truncate">Sown: {tray.sown_date} • {tray.location || tray.tray_type}</div>
                  <div className="flex gap-2">
                     <span className="text-[10px] font-bold bg-stone-100 text-stone-600 px-2 py-0.5 rounded border border-stone-200">{tray.contents.length} Varieties</span>
                     <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">{totalSown} Seeds Sown</span>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
           <div className="text-center py-10 text-stone-500 bg-white rounded-xl border border-stone-100 shadow-sm">
              <svg className="w-12 h-12 mx-auto text-stone-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
              <p>No seedling trays tracked yet.</p>
              <button onClick={handleCreateNewTray} className="mt-4 text-emerald-600 font-bold border border-emerald-200 bg-emerald-50 px-4 py-2 rounded-lg hover:bg-emerald-100">Start a New Tray</button>
           </div>
        )}
      </div>
    </main>
  );
}
