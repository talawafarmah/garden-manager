import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { SeedlingTray, InventorySeed, SeedlingJournalEntry } from '../types';

const parseDateString = (dateStr: string) => {
  if (!dateStr) return new Date();
  return new Date(dateStr + 'T12:00:00');
};

export default function TrayDetail({ tray, inventory, navigateTo, handleGoBack, userRole }: any) {
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [localTray, setLocalTray] = useState<SeedlingTray>(tray);

  const [potUpState, setPotUpState] = useState<{isOpen: boolean, seedId: string, varietyName: string, count: number, note: string, maxAvailable: number} | null>(null);
  const [isPottingUp, setIsPottingUp] = useState(false);

  useEffect(() => { setLocalTray(tray); }, [tray]);

  useEffect(() => {
    const loadUrls = async () => {
      if (!localTray || !localTray.images || localTray.images.length === 0) return;
      const newUrls: Record<string, string> = { ...signedUrls };
      let changed = false;
      for (const img of localTray.images) {
        if (!img.startsWith('data:image') && !img.startsWith('http') && !newUrls[img]) {
          const { data } = await supabase.storage.from('talawa_media').createSignedUrl(img, 3600);
          if (data) { newUrls[img] = data.signedUrl; changed = true; }
        }
      }
      if (changed) setSignedUrls(newUrls);
    };
    loadUrls();
  }, [localTray]);

  const totalSown = localTray.contents.reduce((sum: number, item: any) => sum + (item.sown_count || 0), 0);
  const totalGerminated = localTray.contents.reduce((sum: number, item: any) => sum + (item.germinated_count || 0), 0);
  const totalPlanted = localTray.contents.reduce((sum: number, item: any) => sum + (item.planted_count || 0), 0);
  const germRate = totalSown > 0 ? Math.round((totalGerminated / totalSown) * 100) : 0;

  const handleQuickUpdate = async (e: React.MouseEvent, index: number, field: string, delta: number) => {
    e.stopPropagation();
    if (userRole !== 'admin') return;

    const updatedContents = [...localTray.contents];
    const currentVal = updatedContents[index][field as keyof typeof updatedContents[0]] || 0;
    const newVal = Math.max(0, (currentVal as number) + delta);
    
    (updatedContents[index][field as keyof typeof updatedContents[0]] as any) = newVal;
    setLocalTray({ ...localTray, contents: updatedContents });
    await supabase.from('seedling_trays').update({ contents: updatedContents }).eq('id', localTray.id);
  };

  const handleDuplicateTray = () => {
    setIsDuplicating(true);
    const todayObj = new Date();
    const localToday = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
    
    const duplicatedTray: SeedlingTray = {
      ...localTray, id: crypto.randomUUID(), name: `${localTray.name || 'Tray'} (Copy)`, sown_date: localToday, first_germination_date: "", first_planted_date: "", images: [],
      contents: localTray.contents.map((item: any) => ({ ...item, sown_count: item.sown_count || 0, germinated_count: 0, planted_count: 0 }))
    };
    navigateTo('tray_edit', duplicatedTray);
    setIsDuplicating(false);
  };

  const handleSeedClick = (seedId: string) => {
    const fullSeed = inventory?.find((s: InventorySeed) => s.id === seedId);
    if (fullSeed) navigateTo('seed_detail', { ...fullSeed, returnTo: 'tray_detail', returnPayload: localTray });
    else navigateTo('seed_detail', { id: seedId, returnTo: 'tray_detail', returnPayload: localTray });
  };

  const openPotUpModal = (e: React.MouseEvent, seedRecord: any, varietyName: string) => {
    e.stopPropagation();
    const max = (seedRecord.germinated_count || 0) - (seedRecord.planted_count || 0);
    setPotUpState({ isOpen: true, seedId: seedRecord.seed_id, varietyName, count: max > 0 ? max : 0, note: '', maxAvailable: max });
  };

  const handlePotUpSubmit = async () => {
    if (!potUpState) return;
    setIsPottingUp(true);

    try {
      let sId = localTray.season_id;
      if (!sId) {
        const { data: sData } = await supabase.from('seasons').select('id').order('created_at', { ascending: false }).limit(1);
        if (sData && sData.length > 0) sId = sData[0].id;
      }
      if (!sId) throw new Error("No active season found to attach these seedlings to.");

      const { data: existingLedger } = await supabase.from('season_seedlings').select('*').eq('seed_id', potUpState.seedId).eq('season_id', sId).maybeSingle();
      const trayReference = localTray.name || 'a tray';
      const todayObj = new Date();
      const localToday = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;

      const journalEntry: SeedlingJournalEntry = { id: crypto.randomUUID(), date: localToday, type: 'UPPOT', note: `Potted up ${potUpState.count} from ${trayReference}. ${potUpState.note}` };

      if (existingLedger) {
        await supabase.from('season_seedlings').update({ qty_growing: existingLedger.qty_growing + potUpState.count, journal: [journalEntry, ...(existingLedger.journal || [])] }).eq('id', existingLedger.id);
      } else {
        await supabase.from('season_seedlings').insert([{ seed_id: potUpState.seedId, season_id: sId, qty_growing: potUpState.count, allocate_keep: 0, allocate_reserve: 0, qty_planted: 0, qty_gifted: 0, qty_sold: 0, qty_dead: 0, locations: {}, journal: [journalEntry] }]);
      }

      const updatedContents = localTray.contents.map((c: any) => c.seed_id === potUpState.seedId ? { ...c, planted_count: (c.planted_count || 0) + potUpState.count } : c);
      await supabase.from('seedling_trays').update({ contents: updatedContents }).eq('id', localTray.id);
      setLocalTray({ ...localTray, contents: updatedContents });
      setPotUpState(null);
    } catch (err: any) { alert("Failed to pot up: " + err.message); } finally { setIsPottingUp(false); }
  };

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900 pb-20 font-sans relative">
      
      {fullScreenImage && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-2 cursor-zoom-out" onClick={() => setFullScreenImage(null)}>
          <img src={fullScreenImage} alt="Full screen" className="max-w-full max-h-full object-contain" />
        </div>
      )}

      {potUpState?.isOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-emerald-50 p-4 border-b border-emerald-100 flex justify-between items-center">
              <div>
                <h2 className="font-black text-emerald-900 tracking-tight flex items-center gap-2">🌱 Pot Up Seedlings</h2>
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mt-0.5">{potUpState.varietyName}</p>
              </div>
              <button onClick={() => setPotUpState(null)} className="p-1 rounded-full text-emerald-600 hover:bg-emerald-200"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between bg-stone-50 p-4 rounded-2xl border border-stone-200">
                <div>
                  <span className="block text-xs font-black text-stone-500 uppercase tracking-widest mb-1">Quantity to Pot Up</span>
                  <span className="block text-[10px] text-stone-400">Max unpotted: {potUpState.maxAvailable > 0 ? potUpState.maxAvailable : 0}</span>
                </div>
                <input type="number" min="1" value={potUpState.count || ''} onChange={(e) => setPotUpState({ ...potUpState, count: Number(e.target.value) })} className="w-20 text-center border border-stone-300 rounded-xl py-2 shadow-inner focus:border-emerald-500 outline-none font-black text-lg bg-white" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Pot Size / Location Note</label>
                <input type="text" placeholder="e.g., 4-inch pots, Garage rack..." value={potUpState.note} onChange={(e) => setPotUpState({ ...potUpState, note: e.target.value })} className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm shadow-sm outline-none focus:border-emerald-500" />
              </div>
              <button onClick={handlePotUpSubmit} disabled={isPottingUp || potUpState.count <= 0} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black uppercase tracking-widest shadow-xl shadow-emerald-900/20 active:scale-95 transition-all disabled:opacity-50">
                {isPottingUp ? 'Moving...' : 'Move to Nursery'}
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="bg-emerald-800 text-white p-4 shadow-md sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-2 mr-2">
          <button onClick={() => navigateTo('trays', null, true)} className="p-2 bg-emerald-900 rounded-full hover:bg-emerald-700 transition-colors" title="Go Back"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
          <button onClick={() => navigateTo('dashboard')} className="p-2 bg-emerald-900 rounded-full hover:bg-emerald-700 transition-colors" title="Dashboard"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg></button>
        </div>
        <h1 className="text-xl font-bold truncate flex-1">Tray Details</h1>
        <div className="flex items-center gap-2">
           <button onClick={handleDuplicateTray} disabled={isDuplicating} className="p-2 bg-emerald-900 rounded-full hover:bg-emerald-700 transition-colors flex items-center gap-1 px-3 disabled:opacity-50 text-sm">Copy</button>
           {userRole === 'admin' && (<button onClick={() => navigateTo('tray_edit', localTray)} className="p-2 bg-emerald-900 rounded-full hover:bg-emerald-700 transition-colors flex items-center gap-1 px-3 text-sm">Edit</button>)}
        </div>
      </header>

      <div className="max-w-md mx-auto p-4 space-y-5">
         <section className="bg-white p-5 rounded-2xl shadow-sm border border-stone-200">
            <div className="flex justify-between items-start mb-3">
               <h2 className="text-2xl font-bold text-stone-800 leading-tight">{(localTray as any).name || localTray.id}</h2>
               <div className="flex gap-1.5 flex-shrink-0">
                 {localTray.humidity_dome && <span className="bg-blue-100 text-blue-800 p-1.5 rounded-lg flex items-center justify-center" title="Humidity Dome Used"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15h18M5 15v4a2 2 0 002 2h10a2 2 0 002-2v-4M12 15V3m0 0l-4 4m4-4l4 4" /></svg></span>}
                 {localTray.grow_light && <span className="bg-yellow-100 text-yellow-800 p-1.5 rounded-lg flex items-center justify-center" title="Grow Light Used"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg></span>}
               </div>
            </div>
            
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="bg-stone-100 text-stone-600 text-xs font-bold px-2 py-1 rounded border border-stone-200">{localTray.location || 'Unknown Location'}</span>
              <span className="bg-stone-100 text-stone-600 text-xs font-bold px-2 py-1 rounded border border-stone-200">{localTray.cell_count} Cell Tray</span>
            </div>
            
            <div className="grid grid-cols-3 gap-2 bg-stone-50 rounded-xl p-3 border border-stone-200 mb-4 text-center">
               <div><div className="text-[10px] text-stone-500 font-bold uppercase mb-0.5">Sown</div><div className="text-sm font-bold text-stone-800">{localTray.sown_date || '--'}</div></div>
               <div className="border-l border-stone-200"><div className="text-[10px] text-stone-500 font-bold uppercase mb-0.5">Sprout</div><div className="text-sm font-bold text-emerald-600">{localTray.first_germination_date || '--'}</div></div>
               <div className="border-l border-stone-200"><div className="text-[10px] text-stone-500 font-bold uppercase mb-0.5">Potted</div><div className="text-sm font-bold text-blue-600">{localTray.first_planted_date || '--'}</div></div>
            </div>

            <div className="grid grid-cols-3 gap-2 bg-emerald-50 rounded-xl p-3 border border-emerald-100 mb-4 text-center">
               <div><div className="text-xs text-emerald-600 font-bold uppercase mb-0.5">Sown</div><div className="text-xl font-black text-emerald-900">{totalSown}</div></div>
               <div className="border-l border-emerald-200"><div className="text-xs text-emerald-600 font-bold uppercase mb-0.5">Sprouted</div><div className="text-xl font-black text-emerald-900">{totalGerminated}</div></div>
               <div className="border-l border-emerald-200"><div className="text-xs text-emerald-600 font-bold uppercase mb-0.5">Rate</div><div className="text-xl font-black text-emerald-900">{germRate}%</div></div>
            </div>

            {localTray.potting_mix && <div className="mb-4"><div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">Potting Mix</div><div className="text-sm text-stone-800 font-medium">{localTray.potting_mix}</div></div>}
            {localTray.notes && <p className="text-sm text-stone-600 bg-stone-50 p-3 rounded-lg border border-stone-100">{localTray.notes}</p>}
         </section>

         <h3 className="font-bold text-stone-800 px-1">Tray Contents</h3>
         <div className="space-y-3">
           {(localTray.contents || []).map((seedRecord: any, idx: number) => {
             const fullSeed = inventory?.find((s: InventorySeed) => s.id === seedRecord.seed_id);
             const varietyName = fullSeed?.variety_name || seedRecord.seed_id;
             const isPottable = (seedRecord.germinated_count || 0) - (seedRecord.planted_count || 0) > 0;

             const today = new Date();
             today.setHours(12, 0, 0, 0);
             let seedStatusBadge = null;

             if (seedRecord.germinated_count > 0) {
                 seedStatusBadge = <span className="text-[9px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 ml-2 shadow-sm flex-shrink-0 flex items-center gap-1"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg> Sprouted</span>;
             } else if (localTray.sown_date && fullSeed?.germination_days) {
                 const nums = fullSeed.germination_days.match(/\d+/g);
                 if (nums && nums.length > 0) {
                     const parsed = nums.map((n: string) => parseInt(n, 10)).filter((n: number) => n > 0);
                     if (parsed.length > 0) {
                         const seedMin = Math.min(...parsed);
                         const seedMax = Math.max(...parsed);
                         const sownDate = parseDateString(localTray.sown_date);
                         
                         const minTarget = new Date(sownDate); minTarget.setDate(minTarget.getDate() + seedMin);
                         const maxTarget = new Date(sownDate); maxTarget.setDate(maxTarget.getDate() + seedMax);
                         
                         const diffToMin = Math.round((minTarget.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                         const diffToMax = Math.round((maxTarget.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                         
                         if (diffToMin > 0) {
                             seedStatusBadge = <span className="text-[9px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 ml-2 whitespace-nowrap">Wait ~{diffToMin}d</span>;
                         } else if (diffToMax >= 0) {
                             seedStatusBadge = <span className="text-[9px] font-black uppercase tracking-widest text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-300 ml-2 whitespace-nowrap">Window ({diffToMax}d left)</span>;
                         } else {
                             seedStatusBadge = <span className="text-[9px] font-black uppercase tracking-widest text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200 ml-2 whitespace-nowrap">Overdue {Math.abs(diffToMax)}d</span>;
                         }
                     }
                 }
             }

             return (
               <div key={idx} onClick={() => handleSeedClick(seedRecord.seed_id)} className="bg-white p-4 rounded-xl shadow-sm border border-stone-200 cursor-pointer hover:border-emerald-400 transition-all active:scale-95 group">
                 <div className="flex justify-between items-start mb-3 border-b border-stone-100 pb-3">
                   <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-lg bg-stone-100 border border-stone-200 overflow-hidden flex-shrink-0">
                        {fullSeed?.thumbnail ? <img src={fullSeed.thumbnail} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-stone-300"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" /></svg></div>}
                      </div>
                      <div className="min-w-0 flex flex-col items-start">
                        <h4 className="font-bold text-stone-800 leading-tight group-hover:text-emerald-700 transition-colors truncate w-full">{varietyName}</h4>
                        <div className="flex items-center mt-1 flex-wrap gap-y-1">
                          {/* FIX 2: Explicit ID tag */}
                          <span className="text-[10px] font-mono bg-stone-100 px-1.5 py-0.5 rounded text-stone-500 border border-stone-200 shadow-sm">ID: {seedRecord.seed_id}</span>
                          {seedStatusBadge}
                        </div>
                      </div>
                   </div>
                   
                   {userRole === 'admin' && (
                     <button 
                       onClick={(e) => openPotUpModal(e, seedRecord, varietyName)}
                       disabled={!isPottable}
                       className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest border transition-all ml-2 ${isPottable ? 'bg-emerald-100 text-emerald-800 border-emerald-300 shadow-sm hover:bg-emerald-200' : 'bg-stone-50 text-stone-400 border-stone-200 opacity-50'}`}
                     >
                       🌱 Pot Up
                     </button>
                   )}
                 </div>
                 
                 <div className="grid grid-cols-3 text-xs pt-1 mt-1">
                   <div className="flex flex-col items-center border-r border-stone-100">
                     <span className="text-[9px] uppercase tracking-widest text-stone-400 mb-1.5">Sown</span>
                     <div className="flex items-center gap-1.5">
                       <button onClick={(e) => handleQuickUpdate(e, idx, 'sown_count', -1)} disabled={userRole !== 'admin'} className="w-6 h-6 flex items-center justify-center bg-stone-100 rounded-md text-stone-500 hover:bg-stone-200 disabled:opacity-50 font-black">-</button>
                       <span className="font-bold text-stone-800 w-5 text-center text-sm">{seedRecord.sown_count || 0}</span>
                       <button onClick={(e) => handleQuickUpdate(e, idx, 'sown_count', 1)} disabled={userRole !== 'admin'} className="w-6 h-6 flex items-center justify-center bg-stone-100 rounded-md text-stone-500 hover:bg-stone-200 disabled:opacity-50 font-black">+</button>
                     </div>
                   </div>
                   
                   <div className="flex flex-col items-center border-r border-stone-100">
                     <span className="text-[9px] uppercase tracking-widest text-emerald-600 mb-1.5">Sprouted</span>
                     <div className="flex items-center gap-1.5">
                       <button onClick={(e) => handleQuickUpdate(e, idx, 'germinated_count', -1)} disabled={userRole !== 'admin'} className="w-6 h-6 flex items-center justify-center bg-emerald-50 text-emerald-600 rounded-md hover:bg-emerald-100 disabled:opacity-50 font-black">-</button>
                       <span className="font-bold text-emerald-600 w-5 text-center text-sm">{seedRecord.germinated_count || 0}</span>
                       <button onClick={(e) => handleQuickUpdate(e, idx, 'germinated_count', 1)} disabled={userRole !== 'admin'} className="w-6 h-6 flex items-center justify-center bg-emerald-50 text-emerald-600 rounded-md hover:bg-emerald-100 disabled:opacity-50 font-black">+</button>
                     </div>
                   </div>

                   <div className="flex flex-col items-center">
                     <span className="text-[9px] uppercase tracking-widest text-blue-600 mb-1.5">Potted</span>
                     <div className="flex items-center h-6">
                       <span className="font-black text-blue-600 text-lg">{seedRecord.planted_count || 0}</span>
                     </div>
                   </div>
                 </div>
               </div>
             );
           })}
         </div>

         {localTray.images && localTray.images.length > 0 && (
           <div className="grid grid-cols-3 gap-2 pt-2">
             {localTray.images.map((img: string, idx: number) => {
                const displaySrc = img.startsWith('data:image') || img.startsWith('http') ? img : signedUrls[img] || '';
                return (
                  <div key={idx} onClick={() => setFullScreenImage(displaySrc)} className="cursor-zoom-in aspect-square rounded-xl overflow-hidden border border-stone-200 shadow-sm relative bg-stone-100">
                    {displaySrc && <img src={displaySrc} className="w-full h-full object-cover" alt="Gallery" />}
                  </div>
                );
             })}
           </div>
         )}
      </div>
    </main>
  );
}