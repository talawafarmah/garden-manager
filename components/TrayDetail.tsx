import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { SeedlingTray, InventorySeed, SeedlingJournalEntry } from '../types';

const parseDateString = (dateStr: string) => {
  if (!dateStr) return new Date();
  return new Date(dateStr + 'T12:00:00');
};

const processImageWithWatermark = (file: File, watermarkText: string, maxSize: number = 1600): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let width = img.width; let height = img.height;
      if (width > height) { if (width > maxSize) { height *= maxSize / width; width = maxSize; } }
      else { if (height > maxSize) { width *= maxSize / height; height = maxSize; } }
      
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Failed to get canvas context'));
      ctx.drawImage(img, 0, 0, width, height);

      const gradient = ctx.createLinearGradient(0, height - 80, 0, height);
      gradient.addColorStop(0, 'transparent');
      gradient.addColorStop(1, 'rgba(0,0,0,0.8)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, height - 80, width, 80);

      const fontSize = Math.max(16, Math.floor(height * 0.035));
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText(watermarkText, width - 16, height - 16);

      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob failed'));
      }, 'image/jpeg', 0.85);
    };
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = URL.createObjectURL(file);
  });
};

export default function TrayDetail({ tray, inventory, trays, navigateTo, handleGoBack }: any) {
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [localTray, setLocalTray] = useState<SeedlingTray>({ ...tray, status: tray.status || 'Active' });
  const [isSaving, setIsSaving] = useState(false);

  const [potUpState, setPotUpState] = useState<{isOpen: boolean, seedId: string, varietyName: string, count: number, note: string, maxAvailable: number} | null>(null);
  const [isPottingUp, setIsPottingUp] = useState(false);

  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- NEW HELP MODE STATE ---
  const [isHelpMode, setIsHelpMode] = useState(false);
  const [activeHelpInfo, setActiveHelpInfo] = useState<{title: string, text: string} | null>(null);

  useEffect(() => { setLocalTray({ ...tray, status: tray.status || 'Active' }); }, [tray]);

  useEffect(() => {
    const loadUrls = async () => {
      const urlsToSign: string[] = [];
      if (localTray.images) urlsToSign.push(...localTray.images);
      
      localTray.contents?.forEach((c: any) => {
         const s = inventory?.find((s: InventorySeed) => s.id === c.seed_id);
         if (s?.thumbnail && !s.thumbnail.startsWith('data:') && !s.thumbnail.startsWith('http')) urlsToSign.push(s.thumbnail as string);
      });

      if (urlsToSign.length === 0) return;
      const unique = Array.from(new Set(urlsToSign)).filter(u => u && !u.startsWith('data:') && !u.startsWith('http') && !signedUrls[u as string]);
      if (unique.length === 0) return;

      const { data } = await supabase.storage.from('talawa_media').createSignedUrls(unique, 3600);
      if (data) {
        const newUrls: Record<string, string> = { ...signedUrls };
        data.forEach(item => { if (item.signedUrl && item.path) newUrls[item.path] = item.signedUrl; });
        setSignedUrls(newUrls);
      }
    };
    loadUrls();
  }, [localTray, inventory]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if ((e.target as Element).closest('.cursor-pointer') || (e.target as Element).closest('input') || (e.target as Element).closest('button') || (e.target as Element).closest('select')) return;
    setTouchStart(e.targetTouches[0].clientX);
  };
  const handleTouchMove = (e: React.TouchEvent) => { if (touchStart) setTouchEnd(e.targetTouches[0].clientX); };
  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd || !trays || trays.length === 0) return;
    const distance = touchStart - touchEnd;
    const currentIndex = trays.findIndex((t: SeedlingTray) => t.id === localTray.id);
    if (distance > 75 && currentIndex < trays.length - 1) navigateTo('tray_detail', trays[currentIndex + 1], true);
    else if (distance < -75 && currentIndex > 0) navigateTo('tray_detail', trays[currentIndex - 1], true);
    setTouchStart(0); setTouchEnd(0);
  };

  const handleQuickPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const today = new Date();
      const dateStr = today.toLocaleDateString();
      let daysStr = "Not Sown";
      
      if (localTray.sown_date) {
        const sowDate = new Date(localTray.sown_date + 'T12:00:00');
        const diffDays = Math.floor((today.getTime() - sowDate.getTime()) / (1000 * 60 * 60 * 24));
        daysStr = `${diffDays} days`;
      }
      
      const watermarkText = `${dateStr} : ${daysStr}`;
      const watermarkedBlob = await processImageWithWatermark(file, watermarkText);

      const filePath = `trays/${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
      const { error: uploadError } = await supabase.storage.from('talawa_media').upload(filePath, watermarkedBlob);
      if (uploadError) throw uploadError;
      
      const { data: urlData } = await supabase.storage.from('talawa_media').createSignedUrl(filePath, 3600);
      if (urlData?.signedUrl) { setSignedUrls(prev => ({...prev, [filePath]: urlData.signedUrl})); }

      const newImages = [...(localTray.images || []), filePath];
      await supabase.from('seedling_trays').update({ images: newImages }).eq('id', localTray.id);
      setLocalTray({ ...localTray, images: newImages });
    } catch (err: any) { alert('Upload failed: ' + err.message); } 
    finally { setIsUploading(false); }
  };

  const handleStatusChange = async (newStatus: string) => {
      setIsSaving(true);
      const newTrayData = { ...localTray, status: newStatus };
      setLocalTray(newTrayData);
      
      const { error } = await supabase.from('seedling_trays').update({ status: newStatus }).eq('id', localTray.id);
      if (error) {
          alert("Failed to update status: " + error.message);
          setLocalTray(localTray); 
      }
      setIsSaving(false);
  };

  const totalSown = localTray.contents.reduce((sum: number, item: any) => sum + (item.sown_count || 0), 0);
  const totalGerminated = localTray.contents.reduce((sum: number, item: any) => sum + (item.germinated_count || 0), 0);
  const germRate = totalSown > 0 ? Math.round((totalGerminated / totalSown) * 100) : 0;
  
  const totalVars = (localTray.contents || []).length;
  const sproutedVars = (localTray.contents || []).filter(c => (c.germinated_count || 0) > 0).length;
  const varGermRate = totalVars > 0 ? Math.round((sproutedVars / totalVars) * 100) : 0;

  const handleToggleAbandon = async (e: React.MouseEvent, index: number) => {
      e.stopPropagation();
      const updatedContents = [...localTray.contents];
      updatedContents[index].abandoned = !updatedContents[index].abandoned;
      setLocalTray({ ...localTray, contents: updatedContents });
      await supabase.from('seedling_trays').update({ contents: updatedContents }).eq('id', localTray.id);
  };

  const handleQuickUpdate = async (e: React.MouseEvent, index: number, field: string, delta: number) => {
    e.stopPropagation();
    const updatedContents = [...localTray.contents];
    const currentVal = updatedContents[index][field as keyof typeof updatedContents[0]] || 0;
    const newVal = Math.max(0, (currentVal as number) + delta);
    (updatedContents[index][field as keyof typeof updatedContents[0]] as any) = newVal;
    if (delta > 0) {
      const todayObj = new Date();
      const localToday = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
      if (field === 'germinated_count' && !updatedContents[index].germination_date) updatedContents[index].germination_date = localToday;
      if (field === 'planted_count' && !updatedContents[index].planted_date) updatedContents[index].planted_date = localToday;
    }
    setLocalTray({ ...localTray, contents: updatedContents });
    await supabase.from('seedling_trays').update({ contents: updatedContents }).eq('id', localTray.id);
  };

  const handleQuickDateUpdate = async (index: number, field: string, val: string) => {
    const updatedContents = [...localTray.contents];
    (updatedContents[index] as any)[field] = val || null;
    setLocalTray({ ...localTray, contents: updatedContents });
    await supabase.from('seedling_trays').update({ contents: updatedContents }).eq('id', localTray.id);
  };

  const handleDuplicateTray = () => {
    setIsDuplicating(true);
    const todayObj = new Date();
    const localToday = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
    const duplicatedTray: any = {
      ...localTray, id: crypto.randomUUID(), name: `${localTray.name || 'Tray'} (Copy)`, sown_date: localToday, first_germination_date: "", first_planted_date: "", images: [], status: 'Active',
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
      
      const seedRecord = localTray.contents.find((c: any) => c.seed_id === potUpState.seedId);
      const todayObj = new Date();
      const localToday = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
      
      const actualSownDate = seedRecord?.sown_date || localTray.sown_date || localToday;

      const trayReference = localTray.name || 'a tray';
      const journalEntry: SeedlingJournalEntry = { id: crypto.randomUUID(), date: localToday, type: 'UPPOT', note: `Potted up ${potUpState.count} from ${trayReference}. ${potUpState.note}` };

      if (existingLedger) {
        await supabase.from('season_seedlings').update({ 
            qty_growing: existingLedger.qty_growing + potUpState.count, 
            journal: [journalEntry, ...(existingLedger.journal || [])] 
        }).eq('id', existingLedger.id);
      } else {
        await supabase.from('season_seedlings').insert([{ 
            seed_id: potUpState.seedId, 
            season_id: sId, 
            qty_growing: potUpState.count, 
            sown_date: actualSownDate, 
            allocate_keep: 0, allocate_reserve: 0, qty_planted: 0, qty_gifted: 0, qty_sold: 0, qty_dead: 0, locations: {}, 
            journal: [journalEntry] 
        }]);
      }

      const updatedContents = localTray.contents.map((c: any) => c.seed_id === potUpState.seedId ? { ...c, planted_count: (c.planted_count || 0) + potUpState.count } : c);
      await supabase.from('seedling_trays').update({ contents: updatedContents }).eq('id', localTray.id);
      setLocalTray({ ...localTray, contents: updatedContents });
      setPotUpState(null);
    } catch (err: any) { alert("Failed to pot up: " + err.message); } finally { setIsPottingUp(false); }
  };

  const topSeeds = [...(localTray.contents || [])]
    .sort((a, b) => (b.sown_count || 0) - (a.sown_count || 0))
    .map(c => inventory.find((s: InventorySeed) => s.id === c.seed_id))
    .filter(s => s && s.thumbnail)
    .slice(0, 4);

  const getThumbSrc = (seed: any) => {
      const thumb = seed?.thumbnail;
      if (!thumb) return null;
      if (typeof thumb === 'string' && (thumb.startsWith('http') || thumb.startsWith('data:'))) return thumb;
      return signedUrls[thumb as string] || null;
  };

  let collageHeader = null;
  if (topSeeds.length === 1) {
      const src = getThumbSrc(topSeeds[0]);
      collageHeader = src ? <img src={src} className="w-full h-full object-cover opacity-90" /> : null;
  } else if (topSeeds.length === 2) {
      const src1 = getThumbSrc(topSeeds[0]); const src2 = getThumbSrc(topSeeds[1]);
      collageHeader = (<div className="flex w-full h-full opacity-90"><div className="w-1/2 h-full border-r border-stone-200">{src1 && <img src={src1} className="w-full h-full object-cover" />}</div><div className="w-1/2 h-full">{src2 && <img src={src2} className="w-full h-full object-cover" />}</div></div>);
  } else if (topSeeds.length >= 3) {
      const src1 = getThumbSrc(topSeeds[0]); const src2 = getThumbSrc(topSeeds[1]); const src3 = getThumbSrc(topSeeds[2]); const src4 = getThumbSrc(topSeeds[3]);
      collageHeader = (<div className="grid grid-cols-2 grid-rows-2 w-full h-full opacity-90"><div className="border-r border-b border-stone-200">{src1 && <img src={src1} className="w-full h-full object-cover" />}</div><div className="border-b border-stone-200">{src2 && <img src={src2} className="w-full h-full object-cover" />}</div><div className="border-r border-stone-200">{src3 && <img src={src3} className="w-full h-full object-cover" />}</div><div>{src4 && <img src={src4} className="w-full h-full object-cover" />}</div></div>);
  }

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const traySownDate = new Date((localTray.sown_date || new Date().toISOString().split('T')[0]) + 'T12:00:00');

  // --- FIXED HELP WRAPPER COMPONENT ---
  const HelpWrapper = ({ children, title, text, wrapperClass = "" }: { children: React.ReactNode, title: string, text: string, wrapperClass?: string }) => {
    // FIX: When help mode is off, we still MUST render the wrapperClass if one is provided to preserve CSS layout!
    if (!isHelpMode) {
       return wrapperClass ? <div className={wrapperClass}>{children}</div> : <>{children}</>;
    }
    
    return (
      <div className={`relative group cursor-help ring-2 ring-blue-500 ring-dashed overflow-hidden transition-all hover:bg-blue-50/50 ${wrapperClass || 'rounded-xl'}`}>
         <div className="absolute inset-0 z-50" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActiveHelpInfo({ title, text }); }} />
         <div className="opacity-60 pointer-events-none transition-opacity group-hover:opacity-30 h-full w-full">
            {children}
         </div>
      </div>
    );
  };

  return (
    <main onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} className={`min-h-screen pb-20 font-sans transition-colors duration-300 relative select-none ${isHelpMode ? 'bg-stone-200' : 'bg-stone-50 text-stone-900'}`}>
      
      {/* HELP INFO MODAL */}
      {activeHelpInfo && (
         <div className="fixed inset-0 z-[200] bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setActiveHelpInfo(null)}>
            <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
               <div className="bg-blue-50 p-4 border-b border-blue-100 flex justify-between items-center">
                  <h2 className="font-black text-blue-900 tracking-tight flex items-center gap-2">
                     <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                     {activeHelpInfo.title}
                  </h2>
                  <button onClick={() => setActiveHelpInfo(null)} className="p-1 rounded-full text-blue-400 hover:bg-blue-200 hover:text-blue-800"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
               </div>
               <div className="p-5">
                  <p className="text-sm text-stone-600 leading-relaxed">{activeHelpInfo.text}</p>
                  <button onClick={() => setActiveHelpInfo(null)} className="w-full mt-6 py-3 bg-stone-100 text-stone-700 font-bold rounded-xl hover:bg-stone-200 transition-colors">Got it</button>
               </div>
            </div>
         </div>
      )}

      <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleQuickPhotoUpload} className="hidden" />

      {fullScreenImage && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-2 cursor-zoom-out" onClick={() => setFullScreenImage(null)}>
          <img src={fullScreenImage} alt="Full screen" className="max-w-full max-h-full object-contain" />
        </div>
      )}

      {potUpState?.isOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-emerald-50 p-4 border-b border-emerald-100 flex justify-between items-center">
              <div><h2 className="font-black text-emerald-900 tracking-tight flex items-center gap-2">🌱 Pot Up Seedlings</h2><p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mt-0.5">{potUpState.varietyName}</p></div>
              <button onClick={() => setPotUpState(null)} className="p-1 rounded-full text-emerald-600 hover:bg-emerald-200"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between bg-stone-50 p-4 rounded-2xl border border-stone-200">
                <div>
                   <span className="block text-xs font-black text-stone-500 uppercase tracking-widest mb-1">Quantity to Pot Up</span>
                   <span className="block text-[10px] text-stone-400">Max unpotted: {potUpState.maxAvailable > 0 ? potUpState.maxAvailable : 0}</span>
                </div>
                <div className="flex items-center gap-1">
                   <button 
                      onClick={() => setPotUpState({ ...potUpState, count: Math.max(1, potUpState.count - 1) })} 
                      className="w-10 h-10 flex items-center justify-center bg-stone-200 hover:bg-stone-300 rounded-xl text-stone-600 font-black text-xl transition-colors"
                   >-</button>
                   <input 
                      type="number" 
                      min="1" 
                      max={potUpState.maxAvailable} 
                      value={potUpState.count || ''} 
                      onChange={(e) => setPotUpState({ ...potUpState, count: Number(e.target.value) })} 
                      className="w-16 text-center border border-stone-300 rounded-xl py-2 shadow-inner focus:border-emerald-500 outline-none font-black text-lg bg-white" 
                   />
                   <button 
                      onClick={() => setPotUpState({ ...potUpState, count: Math.min(potUpState.maxAvailable, potUpState.count + 1) })} 
                      className="w-10 h-10 flex items-center justify-center bg-stone-200 hover:bg-stone-300 rounded-xl text-stone-600 font-black text-xl transition-colors"
                   >+</button>
                </div>
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

      <header className="bg-emerald-700 text-white p-4 shadow-md sticky top-0 z-10 flex items-center justify-between border-b border-emerald-900">
        <div className="flex items-center gap-3">
          <button onClick={() => handleGoBack('trays')} className="p-2 bg-emerald-800 rounded-full hover:bg-emerald-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h1 className="text-xl font-bold truncate max-w-[150px] sm:max-w-xs">{localTray.name || localTray.id}</h1>
        </div>
        
        <div className="flex items-center gap-2">
            <button onClick={() => setIsHelpMode(!isHelpMode)} className={`p-2 rounded-full font-bold text-sm transition-all flex items-center gap-1 border ${isHelpMode ? 'bg-blue-600 text-white border-blue-400 shadow-inner' : 'bg-emerald-800 text-emerald-100 border-emerald-600 hover:bg-emerald-600'}`}>
              {isHelpMode ? 'Close' : '❓'}
            </button>

            <HelpWrapper 
               title="Tray Status" 
               text="Change the state of the tray. 'Active' trays show in lists. 'Emptied' means it's done but kept for records. 'Abandoned' means it failed and hides it from overdue alerts."
            >
               <select 
                 value={localTray.status || 'Active'} 
                 onChange={(e) => handleStatusChange(e.target.value)}
                 disabled={isSaving || isHelpMode}
                 className={`text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-xl outline-none appearance-none cursor-pointer shadow-sm border disabled:opacity-50
                    ${localTray.status === 'Emptied' ? 'bg-stone-200 text-stone-600 border-stone-300' : 
                      localTray.status === 'Abandoned' ? 'bg-red-100 text-red-700 border-red-200' : 
                      'bg-emerald-800 text-emerald-100 border-emerald-600 hover:bg-emerald-600'}`}
               >
                 <option value="Active">🟢 Active</option>
                 <option value="Emptied">📥 Emptied</option>
                 <option value="Abandoned">💀 Abandoned</option>
               </select>
            </HelpWrapper>
            
            <button onClick={() => navigateTo('tray_edit', localTray)} disabled={isHelpMode} className="p-2 bg-emerald-800 rounded-full hover:bg-emerald-600 transition-colors shadow-sm disabled:opacity-50">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            </button>
        </div>
      </header>

      {isHelpMode && (
         <div className="bg-blue-600 text-white p-3 text-center text-xs font-bold uppercase tracking-widest sticky top-[72px] z-10 shadow-md">
            Help Mode Active: Tap any highlighted box to learn more.
         </div>
      )}

      <div className="max-w-2xl mx-auto p-4 space-y-6">
        
        {localTray.status === 'Abandoned' && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl flex items-center gap-3 shadow-sm animate-in fade-in">
                <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                <div>
                    <h3 className="font-black text-sm">Tray Abandoned</h3>
                    <p className="text-xs mt-0.5">This tray is no longer active and will be hidden from default lists.</p>
                </div>
            </div>
        )}

        <div className="bg-white rounded-3xl p-5 border border-stone-200 shadow-sm flex flex-col gap-4">
           {/* -- REBUILT SUMMARY HEADER -- */}
           <div className="flex justify-between items-start border-b border-stone-100 pb-4">
              <div>
                 <h2 className="font-black text-xl text-stone-800 leading-tight">{localTray.name || 'Unnamed Tray'}</h2>
                 <p className="font-mono text-[10px] text-stone-400 mt-1">ID: {localTray.id}</p>
              </div>
              <div className="text-right shrink-0 ml-4">
                 <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Sown Date</p>
                 <p className="font-bold text-emerald-700">{traySownDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
              </div>
           </div>

           <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-stone-50 rounded-2xl p-3 sm:p-4 border border-stone-100">
                 <p className="text-[9px] font-black uppercase tracking-widest text-stone-400 mb-1">Total Sown</p>
                 <p className="text-2xl sm:text-3xl font-black text-stone-800">{totalSown}</p>
              </div>
              <HelpWrapper 
                 title="Tray Germination Rate" 
                 text="Shows the exact percentage of individual seeds that have successfully sprouted across the entire tray."
                 wrapperClass="bg-emerald-50 rounded-2xl p-3 sm:p-4 border border-emerald-100 shadow-inner"
              >
                 <p className="text-[9px] font-black uppercase tracking-widest text-emerald-800 mb-1">Germinated</p>
                 <p className="text-2xl sm:text-3xl font-black text-emerald-600">{totalGerminated}</p>
                 <p className="text-[9px] font-bold text-emerald-700 mt-1">{germRate}% Success</p>
              </HelpWrapper>
              
              <HelpWrapper 
                 title="Variety Germination Rate" 
                 text="Shows how many distinct types of seeds (varieties) have at least one successful sprout. This helps you identify if entire crops failed."
                 wrapperClass="bg-blue-50 rounded-2xl p-3 sm:p-4 border border-blue-100 shadow-inner"
              >
                 <p className="text-[9px] font-black uppercase tracking-widest text-blue-800 mb-1">Varieties</p>
                 <p className="text-2xl sm:text-3xl font-black text-blue-600">{sproutedVars}/{totalVars}</p>
                 <p className="text-[9px] font-bold text-blue-700 mt-1">{varGermRate}% Sprouted</p>
              </HelpWrapper>
           </div>

           <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-stone-100">
               <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-stone-400 mb-1">Location</p>
                  <p className="font-bold text-stone-700 text-xs">{localTray.location || '--'}</p>
               </div>
               <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-stone-400 mb-1">Potting Mix</p>
                  <p className="font-bold text-stone-700 text-xs">{localTray.potting_mix || '--'}</p>
               </div>
               <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-stone-400 mb-1">Tray Size</p>
                  <p className="font-bold text-stone-700 text-xs">{localTray.cell_count ? `${localTray.cell_count} Cells` : '--'}</p>
               </div>
               <HelpWrapper 
                  title="Environment Toggles" 
                  text="Toggle these icons to record if this tray is currently using a humidity dome or sitting under grow lights."
               >
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-stone-400 mb-1.5">Environment</p>
                    <div className="flex items-center gap-3">
                       <div className={`flex flex-col items-center ${localTray.humidity_dome ? 'opacity-100' : 'opacity-30 grayscale'}`} title="Humidity Dome">
                           <span className="text-lg leading-none">💦</span>
                       </div>
                       <div className={`flex flex-col items-center ${localTray.grow_light ? 'opacity-100' : 'opacity-30 grayscale'}`} title="Grow Lights">
                           <span className="text-lg leading-none">💡</span>
                       </div>
                    </div>
                  </div>
               </HelpWrapper>
           </div>

           {localTray.notes && (
               <div className="pt-4 border-t border-stone-100">
                  <p className="text-[9px] font-black uppercase tracking-widest text-stone-400 mb-1">Notes</p>
                  <p className="text-xs text-stone-600 italic whitespace-pre-wrap leading-relaxed">{localTray.notes}</p>
               </div>
           )}
        </div>

        <div className="space-y-3">
          <h2 className="text-[10px] font-black text-stone-400 uppercase tracking-widest px-2 flex items-center justify-between">
              <span>Tray Contents ({localTray.contents?.length || 0})</span>
          </h2>
          
          {(localTray.contents || []).map((seedRecord: any, idx: number) => {
             const fullSeed = inventory?.find((s: InventorySeed) => s.id === seedRecord.seed_id);
             const varietyName = fullSeed?.variety_name || seedRecord.seed_id;
             const isPottable = (seedRecord.germinated_count || 0) - (seedRecord.planted_count || 0) > 0;
             const germCount = seedRecord.germinated_count || 0;
             const isFullyGerminated = germCount >= (seedRecord.sown_count || 0);

             let seedStatusBadge = null;
             const rowSownDate = seedRecord.sown_date || localTray.sown_date;
             const rowGermDate = seedRecord.germination_date || seedRecord.germinated_count > 0;

             let daysLate = 0;
             let isLate = false;
             
             if (fullSeed?.germination_days && !isFullyGerminated && !seedRecord.abandoned) {
                 const nums = fullSeed.germination_days.match(/\d+/g);
                 if (nums && nums.length > 0) {
                     const parsed = nums.map((n: string) => parseInt(n, 10)).filter((n: number) => n > 0);
                     if (parsed.length > 0) {
                         const maxDays = Math.max(...parsed);
                         const expectedDate = new Date(traySownDate);
                         expectedDate.setDate(expectedDate.getDate() + maxDays);
                         
                         if (today > expectedDate) {
                             isLate = true;
                             daysLate = Math.floor((today.getTime() - expectedDate.getTime()) / (1000 * 60 * 60 * 24));
                         }
                     }
                 }
             }

             if (seedRecord.abandoned) {
                 seedStatusBadge = <span className="text-[9px] font-black uppercase tracking-widest text-stone-600 bg-stone-200 px-2 py-0.5 rounded border border-stone-300 ml-2 whitespace-nowrap shadow-sm">💀 Abandoned</span>;
             } else if (rowGermDate) {
                 seedStatusBadge = <span className="text-[9px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 ml-2 shadow-sm flex-shrink-0 flex items-center gap-1"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg> Sprouted</span>;
             } else if (rowSownDate && fullSeed?.germination_days) {
                 const nums = fullSeed.germination_days.match(/\d+/g);
                 if (nums && nums.length > 0) {
                     const parsed = nums.map((n: string) => parseInt(n, 10)).filter((n: number) => n > 0);
                     if (parsed.length > 0) {
                         const seedMin = Math.min(...parsed);
                         const seedMax = Math.max(...parsed);
                         const sownDate = parseDateString(rowSownDate);
                         
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
               <div key={idx} onClick={() => handleSeedClick(seedRecord.seed_id)} className={`bg-white p-4 rounded-xl shadow-sm border border-stone-200 cursor-pointer hover:border-emerald-400 transition-all active:scale-95 group ${seedRecord.abandoned ? 'opacity-60 grayscale-[50%]' : ''}`}>
                 <div className="flex justify-between items-start mb-3 border-b border-stone-100 pb-3">
                   <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-lg bg-stone-100 border border-stone-200 overflow-hidden flex-shrink-0">
                        {fullSeed?.thumbnail ? <img src={fullSeed.thumbnail} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-stone-300"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" /></svg></div>}
                      </div>
                      <div className="min-w-0 flex flex-col items-start">
                        <h4 className="font-bold text-stone-800 leading-tight group-hover:text-emerald-700 transition-colors truncate w-full">{varietyName}</h4>
                        
                        <div className="flex items-center mt-1 flex-wrap gap-2">
                          <span className="text-[10px] font-mono bg-stone-100 px-1.5 py-0.5 rounded text-stone-500 border border-stone-200 shadow-sm">ID: {seedRecord.seed_id}</span>
                          
                          <HelpWrapper 
                             title="Sprout Window" 
                             text="The system automatically calculates when this seed should sprout based on its genetics. If it misses the window, an overdue warning will flash."
                          >
                             {seedStatusBadge}
                          </HelpWrapper>

                          <HelpWrapper 
                             title="Abandon Seed" 
                             text="If some seeds in a tray failed but others are fine, click this to hide the failed seeds from overdue alerts and lock their counts."
                          >
                             <button 
                                disabled={isHelpMode}
                                onClick={(e) => handleToggleAbandon(e, idx)}
                                className={`text-[9px] font-black uppercase tracking-widest underline disabled:opacity-50 ${seedRecord.abandoned ? 'text-stone-500 hover:text-stone-800' : 'text-stone-400 hover:text-red-600'}`}
                             >
                                {seedRecord.abandoned ? 'Restore' : 'Abandon'}
                             </button>
                          </HelpWrapper>
                        </div>
                      </div>
                   </div>
                   
                   <div className="flex flex-col items-end gap-2">
                     <HelpWrapper 
                        title="Pot Up" 
                        text="Move germinated seedlings from this tray into the Nursery Ledger as actively growing potted plants."
                     >
                        <button 
                          onClick={(e) => openPotUpModal(e, seedRecord, varietyName)}
                          disabled={!isPottable || seedRecord.abandoned || isHelpMode}
                          className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest border transition-all ml-2 disabled:opacity-50 ${isPottable && !seedRecord.abandoned ? 'bg-emerald-100 text-emerald-800 border-emerald-300 shadow-sm hover:bg-emerald-200' : 'bg-stone-50 text-stone-400 border-stone-200 opacity-50'}`}
                        >
                          🌱 Pot Up
                        </button>
                     </HelpWrapper>
                   </div>
                 </div>
                 
                 <div className="grid grid-cols-3 text-xs pt-1 mt-1" onClick={e => e.stopPropagation()}>
                   <div className="flex flex-col items-center border-r border-stone-100">
                     <span className="text-[9px] uppercase tracking-widest text-stone-400 mb-1.5">Sown</span>
                     <div className="flex items-center gap-1.5">
                       <button onClick={(e) => handleQuickUpdate(e, idx, 'sown_count', -1)} disabled={seedRecord.abandoned || isHelpMode} className="w-6 h-6 flex items-center justify-center bg-stone-100 rounded-md text-stone-500 hover:bg-stone-200 font-black disabled:opacity-50">-</button>
                       <span className="font-bold text-stone-800 w-5 text-center text-sm">{seedRecord.sown_count || 0}</span>
                       <button onClick={(e) => handleQuickUpdate(e, idx, 'sown_count', 1)} disabled={seedRecord.abandoned || isHelpMode} className="w-6 h-6 flex items-center justify-center bg-stone-100 rounded-md text-stone-500 hover:bg-stone-200 font-black disabled:opacity-50">+</button>
                     </div>
                   </div>
                   
                   <div className="flex flex-col items-center border-r border-stone-100">
                     <span className="text-[9px] uppercase tracking-widest text-emerald-600 mb-1.5">Sprouted</span>
                     <div className="flex items-center gap-1.5">
                       <button onClick={(e) => handleQuickUpdate(e, idx, 'germinated_count', -1)} disabled={seedRecord.abandoned || isHelpMode} className="w-6 h-6 flex items-center justify-center bg-emerald-50 text-emerald-600 rounded-md hover:bg-emerald-100 font-black disabled:opacity-50">-</button>
                       
                       <div className="flex flex-col items-center">
                          {isLate && <span className="text-[8px] font-black text-red-600 animate-pulse leading-none mb-0.5">⚠️ {daysLate}d Late</span>}
                          <span className="font-bold text-emerald-600 w-5 text-center text-sm">{seedRecord.germinated_count || 0}</span>
                       </div>

                       <button onClick={(e) => handleQuickUpdate(e, idx, 'germinated_count', 1)} disabled={isFullyGerminated || seedRecord.abandoned || isHelpMode} className="w-6 h-6 flex items-center justify-center bg-emerald-50 text-emerald-600 rounded-md hover:bg-emerald-100 font-black disabled:opacity-50">+</button>
                     </div>
                   </div>

                   <div className="flex flex-col items-center">
                     <span className="text-[9px] uppercase tracking-widest text-blue-600 mb-1.5">Potted</span>
                     <div className="flex items-center h-6">
                       <span className="font-black text-blue-600 text-lg">{seedRecord.planted_count || 0}</span>
                     </div>
                   </div>
                 </div>

                 <div className="grid grid-cols-3 text-xs pt-3 mt-3 border-t border-stone-100 gap-2" onClick={e => e.stopPropagation()}>
                    <div>
                       <label className="block text-[8px] font-black uppercase tracking-widest text-stone-400 mb-0.5 text-center">Sown Date</label>
                       <input type="date" value={seedRecord.sown_date || ''} onChange={e => handleQuickDateUpdate(idx, 'sown_date', e.target.value)} disabled={seedRecord.abandoned || isHelpMode} className="w-full text-[10px] p-1.5 bg-stone-50 border border-stone-200 rounded outline-none focus:border-emerald-500 text-center font-bold disabled:opacity-50" />
                    </div>
                    <div>
                       <label className="block text-[8px] font-black uppercase tracking-widest text-stone-400 mb-0.5 text-center">Sprout Date</label>
                       <input type="date" value={seedRecord.germination_date || ''} onChange={e => handleQuickDateUpdate(idx, 'germination_date', e.target.value)} disabled={seedRecord.abandoned || isHelpMode} className="w-full text-[10px] p-1.5 bg-stone-50 border border-stone-200 rounded outline-none focus:border-emerald-500 text-center font-bold disabled:opacity-50" />
                    </div>
                    <div>
                       <label className="block text-[8px] font-black uppercase tracking-widest text-stone-400 mb-0.5 text-center">Potted Date</label>
                       <input type="date" value={seedRecord.planted_date || ''} onChange={e => handleQuickDateUpdate(idx, 'planted_date', e.target.value)} disabled={seedRecord.abandoned || isHelpMode} className="w-full text-[10px] p-1.5 bg-stone-50 border border-stone-200 rounded outline-none focus:border-emerald-500 text-center font-bold disabled:opacity-50" />
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