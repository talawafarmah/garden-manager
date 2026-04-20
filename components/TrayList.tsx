import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { SeedlingTray, AppView, InventorySeed, Season } from '../types';

interface TrayListProps {
  trays: SeedlingTray[];
  inventory: InventorySeed[];
  isLoadingDB: boolean;
  navigateTo: (view: AppView, payload?: any, replace?: boolean) => void;
  handleGoBack: (view: AppView) => void;
  userRole?: string;
  trayState?: any;
  setTrayState?: any;
}

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

export default function TrayList({ trays, inventory, isLoadingDB, navigateTo, handleGoBack, userRole, trayState = { searchQuery: '', statusFilter: 'Active', sortBy: 'urgent' }, setTrayState }: TrayListProps) {
  
  const searchQuery = trayState.searchQuery || "";
  const statusFilter = trayState.statusFilter || "Active";
  const sortBy = trayState.sortBy || "urgent";

  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [activeSeason, setActiveSeason] = useState<string>('');

  const [isDirectAddOpen, setIsDirectAddOpen] = useState(false);
  const [directAddForm, setDirectAddForm] = useState({ seedId: '', count: 1, note: '', seasonId: '', sownDate: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSeedSearch, setShowSeedSearch] = useState(false);
  const [seedSearchQuery, setSeedSearchQuery] = useState("");

  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateState = (updates: any) => {
    if (setTrayState) setTrayState((prev: any) => ({ ...prev, ...updates }));
  };

  useEffect(() => {
    const fetchSeasons = async () => {
      const { data } = await supabase.from('seasons').select('*').order('created_at', { ascending: false });
      if (data) {
        setSeasons(data as Season[]);
        const active = data.find(s => s.status === 'Active') || data[0];
        if (active) {
            setActiveSeason(active.id);
            const todayObj = new Date();
            const localToday = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
            setDirectAddForm(prev => ({ ...prev, seasonId: active.id, sownDate: localToday }));
        }
      }
    };
    fetchSeasons();
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadThumbnailUrls = async () => {
      try {
        const trayImgUrls = trays.map(t => (t.images || [])[0]).filter(img => img && typeof img === 'string' && !img.startsWith('data:') && !img.startsWith('http'));
        
        const seedThumbUrls = trays
          .flatMap(t => t.contents || [])
          .map(c => {
             const seed = inventory.find((s: InventorySeed) => s.id === c.seed_id);
             return seed ? seed.thumbnail : null;
          })
          .filter(img => img && typeof img === 'string' && !img.startsWith('data:') && !img.startsWith('http'));

        const urlsToFetch = [...trayImgUrls, ...seedThumbUrls as string[]];
        if (urlsToFetch.length === 0) return;

        const uniqueUrls = Array.from(new Set(urlsToFetch));
        const fetchedUrls: Record<string, string> = {};
        const { data, error } = await supabase.storage.from('talawa_media').createSignedUrls(uniqueUrls, 3600);

        if (data && !error) { data.forEach((item: any) => { if (item.signedUrl) fetchedUrls[item.path] = item.signedUrl; }); }
        if (isMounted && Object.keys(fetchedUrls).length > 0) setSignedUrls(prev => ({ ...prev, ...fetchedUrls }));
      } catch (err) { console.error("Error fetching tray thumbnails:", err); }
    };

    if (trays.length > 0) loadThumbnailUrls();
    return () => { isMounted = false; };
  }, [trays, inventory]);

  const handleDirectAddSubmit = async () => {
    if (!directAddForm.seedId || !directAddForm.seasonId || directAddForm.count < 1) return;
    setIsSubmitting(true);
    
    try {
      const { data: existingLedger } = await supabase.from('season_seedlings')
        .select('*').eq('seed_id', directAddForm.seedId).eq('season_id', directAddForm.seasonId).maybeSingle();

      const todayObj = new Date();
      const localToday = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;

      const journalEntry = {
        id: window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).substring(2),
        date: localToday,
        type: 'ADD',
        note: `Direct added ${directAddForm.count} plants/seedlings. ${directAddForm.note}`
      };

      if (existingLedger) {
        await supabase.from('season_seedlings').update({
          qty_growing: existingLedger.qty_growing + directAddForm.count,
          journal: [journalEntry, ...(existingLedger.journal || [])]
        }).eq('id', existingLedger.id);
      } else {
        await supabase.from('season_seedlings').insert([{
          seed_id: directAddForm.seedId,
          season_id: directAddForm.seasonId,
          qty_growing: directAddForm.count,
          sown_date: directAddForm.sownDate || localToday,
          allocate_keep: 0,
          allocate_reserve: 0,
          qty_planted: 0,
          qty_gifted: 0,
          qty_sold: 0,
          qty_dead: 0,
          locations: {},
          journal: [journalEntry]
        }]);
      }

      setIsDirectAddOpen(false);
      setDirectAddForm({ seedId: '', count: 1, note: '', seasonId: directAddForm.seasonId, sownDate: localToday });
      alert("Successfully added to your nursery ledger!");
    } catch (err: any) {
      alert("Failed to add seedlings: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const triggerPhotoUpload = (e: React.MouseEvent, trayId: string) => {
    e.stopPropagation();
    setUploadTargetId(trayId);
    fileInputRef.current?.click();
  };

  const handleQuickPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadTargetId) return;
    
    setIsUploading(uploadTargetId);
    try {
      const targetTray = trays.find(t => t.id === uploadTargetId);
      
      const today = new Date();
      const dateStr = today.toLocaleDateString();
      let daysStr = "Not Sown";
      
      if (targetTray?.sown_date) {
        const sowDate = new Date(targetTray.sown_date + 'T12:00:00');
        const diffDays = Math.floor((today.getTime() - sowDate.getTime()) / (1000 * 60 * 60 * 24));
        daysStr = `${diffDays} days`;
      }
      const watermarkText = `${dateStr} : ${daysStr}`;

      const watermarkedBlob = await processImageWithWatermark(file, watermarkText);

      const filePath = `trays/${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
      const { error: uploadError } = await supabase.storage.from('talawa_media').upload(filePath, watermarkedBlob);
      if (uploadError) throw uploadError;
      
      const { data: urlData } = await supabase.storage.from('talawa_media').createSignedUrl(filePath, 3600);
      if (urlData?.signedUrl) {
         setSignedUrls(prev => ({...prev, [filePath]: urlData.signedUrl}));
      }

      const newImages = [...(targetTray?.images || []), filePath];
      await supabase.from('seedling_trays').update({ images: newImages }).eq('id', uploadTargetId);
    } catch (err: any) {
      alert('Quick upload failed: ' + err.message);
    } finally {
      setIsUploading(null);
      setUploadTargetId(null);
    }
  };

  // --- FILTER, ENRICH, AND SCORE TRAYS ---
  const filteredTrays = trays.filter(tray => {
    if (activeSeason && tray.season_id && tray.season_id !== activeSeason) return false;
    
    const status = tray.status || 'Active';
    if (statusFilter !== 'All' && status !== statusFilter) return false;

    const q = searchQuery.toLowerCase();
    const seedIds = (tray.contents || []).map(c => c.seed_id).filter(Boolean);
    const seedNames = seedIds.map(id => inventory.find((s: InventorySeed) => s.id === id)?.variety_name?.toLowerCase() || "");
    
    return (
      tray.id.toLowerCase().includes(q) || 
      (tray.name && tray.name.toLowerCase().includes(q)) ||
      (tray.location && tray.location.toLowerCase().includes(q)) ||
      seedNames.some(name => name.includes(q)) ||
      seedIds.some(id => id.toLowerCase().includes(q))
    );
  });

  const enrichedTrays = filteredTrays.map(tray => {
      const totalSown = tray.contents?.reduce((sum: number, item: any) => sum + (item.sown_count || 0), 0) || 0;
      const totalGerm = tray.contents?.reduce((sum: number, item: any) => sum + (item.germinated_count || 0), 0) || 0;
      const germPercent = totalSown > 0 ? Math.round((totalGerm / totalSown) * 100) : 0;
      const uniqueSeedIds = Array.from(new Set((tray.contents || []).map(c => c.seed_id).filter(Boolean)));

      const today = new Date(); today.setHours(12, 0, 0, 0);

      let maxDaysOverdue = 0;
      let minDaysLeftInWindow = Infinity;
      let minDaysUntilWindow = Infinity;
      let hasUnsprouted = false;

      (tray.contents || []).forEach(c => {
          if (!c.sown_count) return;
          const isFullyGerm = (c.germinated_count || 0) >= c.sown_count;
          if (!isFullyGerm) {
              hasUnsprouted = true;
              const s = inventory.find(i => i.id === c.seed_id);
              if (s && s.germination_days) {
                  const nums = s.germination_days.match(/\d+/g);
                  if (nums && nums.length > 0) {
                       const parsed = nums.map((n: string) => parseInt(n, 10)).filter(n => n > 0);
                       if (parsed.length > 0) {
                           const seedMin = Math.min(...parsed);
                           const seedMax = Math.max(...parsed);

                           const sownDate = parseDateString(c.sown_date || tray.sown_date);
                           const minTargetDate = new Date(sownDate); minTargetDate.setDate(minTargetDate.getDate() + seedMin);
                           const diffDaysToMin = Math.round((minTargetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                           const maxTargetDate = new Date(sownDate); maxTargetDate.setDate(maxTargetDate.getDate() + seedMax);
                           const diffDaysToMax = Math.round((maxTargetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

                           if (diffDaysToMax < 0) {
                               maxDaysOverdue = Math.max(maxDaysOverdue, Math.abs(diffDaysToMax));
                           } else if (diffDaysToMin <= 0 && diffDaysToMax >= 0) {
                               minDaysLeftInWindow = Math.min(minDaysLeftInWindow, diffDaysToMax);
                           } else {
                               minDaysUntilWindow = Math.min(minDaysUntilWindow, diffDaysToMin);
                           }
                       }
                  }
              }
          }
      });

      let urgencyScore = 0;
      let statusText = "";
      let statusColor = "text-stone-500 bg-stone-100 border-stone-200";
      let showSproutIcon = false;

      const trayStatus = tray.status || 'Active';

      if (trayStatus === 'Emptied') {
          statusText = "Emptied"; statusColor = "text-stone-500 bg-stone-100 border-stone-300 opacity-80";
          urgencyScore = -2000;
      } else if (trayStatus === 'Abandoned') {
          statusText = "Abandoned"; statusColor = "text-red-600 bg-red-50 border-red-200 opacity-80";
          urgencyScore = -3000;
      } else if (!hasUnsprouted && (tray.contents || []).length > 0) {
          statusText = "100% Sprouted!"; statusColor = "text-emerald-700 bg-emerald-50 border-emerald-300"; showSproutIcon = true;
          urgencyScore = -1000;
      } else if (maxDaysOverdue > 0) {
          statusText = `⚠️ Overdue (${maxDaysOverdue}d)`; statusColor = "text-red-700 bg-red-50 border-red-300";
          urgencyScore = 10000 + maxDaysOverdue;
      } else if (minDaysLeftInWindow !== Infinity) {
          statusText = `Sprout Window (${minDaysLeftInWindow}d left)`; statusColor = "text-amber-700 bg-amber-50 border-amber-300";
          urgencyScore = 5000 - minDaysLeftInWindow;
      } else if (minDaysUntilWindow !== Infinity) {
          statusText = `Sprouts in ~${minDaysUntilWindow}d`; statusColor = "text-blue-700 bg-blue-50 border-blue-200";
          urgencyScore = 1000 - minDaysUntilWindow;
      } else if (tray.first_germination_date) {
          statusText = "Partially Sprouted"; statusColor = "text-emerald-700 bg-emerald-50 border-emerald-300"; showSproutIcon = true;
          urgencyScore = 500;
      } else {
          statusText = "Sown (No Data)";
          urgencyScore = 100;
      }

      return { ...tray, germPercent, uniqueSeedIds, urgencyScore, statusText, statusColor, showSproutIcon };
  });

  // --- SORT ENRICHED TRAYS ---
  enrichedTrays.sort((a, b) => {
      if (sortBy === 'urgent') {
          if (b.urgencyScore !== a.urgencyScore) return b.urgencyScore - a.urgencyScore;
          return new Date(b.sown_date).getTime() - new Date(a.sown_date).getTime();
      }
      if (sortBy === 'lowest_germ') return a.germPercent - b.germPercent;
      if (sortBy === 'oldest') return new Date(a.sown_date).getTime() - new Date(b.sown_date).getTime();
      
      // Default: Newest Sown
      return new Date(b.sown_date).getTime() - new Date(a.sown_date).getTime();
  });

  const filteredInventoryForDirectAdd = inventory.filter((s: InventorySeed) => {
    if (!seedSearchQuery.trim()) return true;
    const q = seedSearchQuery.toLowerCase();
    return s.variety_name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q) || s.id.toLowerCase().includes(q);
  });

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900 pb-20 font-sans">
      
      {/* Hidden Quick Add Photo Input */}
      <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleQuickPhotoUpload} className="hidden" />

      {/* DIRECT ADD MODAL */}
      {isDirectAddOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          {showSeedSearch ? (
            <div className="bg-white rounded-3xl w-full max-w-md h-[80vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="p-4 border-b border-stone-200 flex gap-3 items-center bg-stone-50 rounded-t-3xl shrink-0">
                <div className="relative flex-1">
                  <input type="text" autoFocus placeholder="Search 300+ seeds..." value={seedSearchQuery} onChange={e => setSeedSearchQuery(e.target.value)} className="w-full bg-white border border-stone-200 rounded-xl py-3 pl-10 pr-4 outline-none focus:border-emerald-500 shadow-inner text-sm font-bold" />
                  <svg className="w-5 h-5 text-stone-400 absolute left-3 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
                <button onClick={() => { setShowSeedSearch(false); setSeedSearchQuery(""); }} className="p-2 bg-stone-200 hover:bg-stone-300 rounded-full text-stone-600 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {filteredInventoryForDirectAdd.length === 0 ? (
                  <div className="text-center py-10 text-stone-400 text-sm">No seeds found matching "{seedSearchQuery}"</div>
                ) : (
                  filteredInventoryForDirectAdd.map((s: InventorySeed) => (
                    <button key={s.id} onClick={() => { setDirectAddForm({ ...directAddForm, seedId: s.id }); setShowSeedSearch(false); setSeedSearchQuery(""); }} className="w-full text-left p-3 rounded-xl hover:bg-emerald-50 transition-colors flex items-center gap-3 group border border-transparent hover:border-emerald-100">
                      <div className="w-10 h-10 rounded-lg bg-stone-100 overflow-hidden flex-shrink-0 border border-stone-200 group-hover:border-emerald-300">
                        {s.thumbnail ? <img src={s.thumbnail} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-stone-300"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" /></svg></div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-stone-800 text-sm truncate flex items-center gap-2">
                          {s.variety_name}
                          <span className="text-[9px] font-mono text-stone-400 bg-stone-100 px-1 py-0.5 rounded border border-stone-200">{s.id}</span>
                        </h4>
                        <p className="text-[10px] text-stone-500 uppercase tracking-widest truncate mt-0.5">{s.category}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="bg-emerald-50 p-4 border-b border-emerald-100 flex justify-between items-center">
                <h2 className="font-black text-emerald-900 tracking-tight flex items-center gap-2">🌱 Direct Add Seedlings</h2>
                <button onClick={() => setIsDirectAddOpen(false)} className="p-1 rounded-full text-emerald-600 hover:bg-emerald-200"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
              </div>
              <div className="p-5 space-y-4">
                
                <div>
                  <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Seed Variety</label>
                  <button onClick={() => setShowSeedSearch(true)} className={`w-full text-left bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm outline-none hover:border-emerald-400 transition-colors shadow-inner flex items-center justify-between ${directAddForm.seedId ? 'text-stone-800 font-bold' : 'text-stone-400'}`}>
                    {directAddForm.seedId ? inventory.find(s => s.id === directAddForm.seedId)?.variety_name : "Tap to select variety..."}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 text-center">
                    <span className="block text-[9px] font-black uppercase tracking-widest text-stone-400 mb-1">Quantity Added</span>
                    <input type="number" min="1" value={directAddForm.count} onChange={(e) => setDirectAddForm({ ...directAddForm, count: Number(e.target.value) })} className="w-full text-center bg-transparent text-xl font-black text-emerald-600 outline-none border-b border-stone-300 focus:border-emerald-500" />
                  </div>
                  <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 text-center flex flex-col justify-center">
                    <span className="block text-[9px] font-black uppercase tracking-widest text-stone-400 mb-1">Season</span>
                    <select value={directAddForm.seasonId} onChange={(e) => setDirectAddForm({ ...directAddForm, seasonId: e.target.value })} className="w-full bg-transparent text-sm font-bold text-stone-800 outline-none cursor-pointer appearance-none text-center">
                      {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                   <div className="col-span-2">
                     <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Original Sow Date</label>
                     <input type="date" value={directAddForm.sownDate} onChange={(e) => setDirectAddForm({ ...directAddForm, sownDate: e.target.value })} className="w-full bg-white border border-stone-200 rounded-xl p-2.5 text-xs font-bold outline-none focus:border-emerald-500 shadow-sm" />
                   </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Source / Notes</label>
                  <input type="text" placeholder="e.g. Bought from local nursery..." value={directAddForm.note} onChange={(e) => setDirectAddForm({ ...directAddForm, note: e.target.value })} className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm shadow-sm outline-none focus:border-emerald-500" />
                </div>

                <button onClick={handleDirectAddSubmit} disabled={isSubmitting || !directAddForm.seedId || directAddForm.count < 1} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black uppercase tracking-widest shadow-xl shadow-emerald-900/20 active:scale-95 transition-all disabled:opacity-50 mt-2 hover:bg-emerald-500">
                  {isSubmitting ? 'Saving...' : 'Add to Ledger'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <header className="bg-emerald-700 text-white p-4 shadow-md sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => navigateTo('dashboard')} className="p-2 bg-emerald-900 rounded-full hover:bg-emerald-700 transition-colors" title="Dashboard">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
          </button>
          <h1 className="text-xl font-bold ml-1 truncate">Nursery Trays</h1>
        </div>
        <div className="flex items-center gap-2">
            <select 
              value={activeSeason} 
              onChange={(e) => setActiveSeason(e.target.value)}
              className="bg-emerald-900 border border-emerald-700 text-xs font-bold rounded-xl px-2 py-1.5 outline-none appearance-none cursor-pointer max-w-[100px] truncate shadow-inner"
            >
              <option value="">All Seasons</option>
              {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button onClick={() => setIsDirectAddOpen(true)} className="px-2 py-1.5 bg-emerald-900 text-emerald-100 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm text-[10px] font-black uppercase tracking-widest flex items-center gap-1 border border-emerald-700/50">
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg> Add
            </button>
            <button onClick={() => navigateTo('tray_edit')} className="p-2 bg-emerald-900 rounded-full hover:bg-emerald-700 transition-colors shadow-sm">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            </button>
        </div>
      </header>

      <div className="max-w-md mx-auto p-4 space-y-4">
        
        {/* --- DUAL DROPDOWN ROW FOR SEARCH & FILTERS --- */}
        <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <input 
                type="text" 
                placeholder="Search tray or seed name..." 
                value={searchQuery} 
                onChange={e => updateState({ searchQuery: e.target.value })} 
                className="w-full bg-white border border-stone-200 rounded-xl py-3 pl-10 pr-4 shadow-sm focus:border-emerald-500 outline-none transition-colors" 
              />
              <svg className="w-5 h-5 text-stone-400 absolute left-3 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            
            <div className="flex gap-2 w-full sm:w-auto shrink-0">
                <div className="relative flex-1 sm:w-36">
                   <select 
                     value={sortBy} 
                     onChange={e => updateState({ sortBy: e.target.value })} 
                     className="w-full bg-white border border-stone-200 rounded-xl py-3 pl-3 pr-8 shadow-sm focus:border-emerald-500 outline-none text-[11px] font-black uppercase tracking-widest text-stone-600 appearance-none cursor-pointer"
                   >
                     <option value="urgent">Urgent First</option>
                     <option value="newest">Newest Sown</option>
                     <option value="oldest">Oldest Sown</option>
                     <option value="lowest_germ">Lowest Germ %</option>
                   </select>
                   <svg className="w-4 h-4 text-stone-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
                <div className="relative flex-1 sm:w-32">
                   <select 
                     value={statusFilter} 
                     onChange={e => updateState({ statusFilter: e.target.value })} 
                     className="w-full bg-white border border-stone-200 rounded-xl py-3 pl-3 pr-8 shadow-sm focus:border-emerald-500 outline-none text-[11px] font-black uppercase tracking-widest text-stone-600 appearance-none cursor-pointer"
                   >
                     <option value="Active">Active</option>
                     <option value="Emptied">Emptied</option>
                     <option value="Abandoned">Abandoned</option>
                     <option value="All">Show All</option>
                   </select>
                   <svg className="w-4 h-4 text-stone-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
            </div>
        </div>

        <div className="space-y-3">
          {isLoadingDB ? (
            <div className="flex justify-center items-center py-10 text-emerald-600"><svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>
          ) : enrichedTrays.length > 0 ? (
            enrichedTrays.map((tray) => {
              const firstImage = (tray.images || [])[0];
              const displayImg = firstImage ? (firstImage.startsWith('http') || firstImage.startsWith('data:') ? firstImage : signedUrls[firstImage]) : null;

              const seedNames = tray.uniqueSeedIds.map((id: string) => {
                 const seed = inventory.find((s: InventorySeed) => s.id === id);
                 return seed ? seed.variety_name : id;
              });
              const seedsDisplay = seedNames.length > 0 ? seedNames.join(', ') : 'Empty Tray';

              const getThumbSrc = (seed: any) => {
                  const thumb = seed?.thumbnail;
                  if (!thumb) return null;
                  if (typeof thumb === 'string' && (thumb.startsWith('http') || thumb.startsWith('data:'))) return thumb;
                  return signedUrls[thumb as string] || null;
              };

              let thumbnailContent = null;
              const topSeeds = [...(tray.contents || [])]
                .sort((a: any, b: any) => (b.sown_count || 0) - (a.sown_count || 0))
                .map((c: any) => inventory.find((s: InventorySeed) => s.id === c.seed_id))
                .filter(s => s && s.thumbnail)
                .slice(0, 4);

              if (topSeeds.length === 1) {
                  const src = getThumbSrc(topSeeds[0]);
                  thumbnailContent = src ? <img src={src} className="w-full h-full object-cover opacity-90" /> : null;
              } else if (topSeeds.length === 2) {
                  const src1 = getThumbSrc(topSeeds[0]); const src2 = getThumbSrc(topSeeds[1]);
                  thumbnailContent = (<div className="flex w-full h-full opacity-90"><div className="w-1/2 h-full border-r border-stone-200">{src1 && <img src={src1} className="w-full h-full object-cover" />}</div><div className="w-1/2 h-full">{src2 && <img src={src2} className="w-full h-full object-cover" />}</div></div>);
              } else if (topSeeds.length >= 3) {
                  const src1 = getThumbSrc(topSeeds[0]); const src2 = getThumbSrc(topSeeds[1]); const src3 = getThumbSrc(topSeeds[2]); const src4 = getThumbSrc(topSeeds[3]);
                  thumbnailContent = (<div className="grid grid-cols-2 grid-rows-2 w-full h-full opacity-90"><div className="border-r border-b border-stone-200">{src1 && <img src={src1} className="w-full h-full object-cover" />}</div><div className="border-b border-stone-200">{src2 && <img src={src2} className="w-full h-full object-cover" />}</div><div className="border-r border-stone-200">{src3 && <img src={src3} className="w-full h-full object-cover" />}</div><div>{src4 && <img src={src4} className="w-full h-full object-cover" />}</div></div>);
              }
              if (!thumbnailContent) thumbnailContent = <div className="w-full h-full flex items-center justify-center text-stone-300"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></div>;

              return (
                <div key={tray.id} onClick={() => navigateTo('tray_detail', tray)} className={`bg-white p-3 rounded-xl border shadow-sm flex gap-4 cursor-pointer relative overflow-hidden group ${tray.status !== 'Active' ? 'border-stone-200 opacity-80' : tray.urgencyScore > 5000 ? 'border-red-300 shadow-md ring-1 ring-red-500/20' : 'border-stone-200 hover:border-emerald-400 hover:shadow-md transition-all active:scale-95'}`}>
                  <button onClick={(e) => triggerPhotoUpload(e, tray.id)} className="absolute top-2 right-2 p-2 bg-stone-100/80 backdrop-blur border border-stone-200 rounded-full text-stone-500 hover:bg-emerald-100 hover:text-emerald-700 hover:border-emerald-300 transition-colors shadow-sm z-10">
                     {isUploading === tray.id ? <svg className="w-4 h-4 animate-spin text-emerald-600" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
                  </button>

                  <div className="w-20 h-20 rounded-lg bg-stone-100 overflow-hidden flex-shrink-0 border border-stone-200 relative">
                    {thumbnailContent}
                    <div className="absolute bottom-1 right-1 flex gap-1 z-10">
                      {tray.humidity_dome && <span className="bg-blue-500/90 text-white p-0.5 rounded shadow-sm backdrop-blur-sm" title="Humidity Dome On"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg></span>}
                      {tray.grow_light && <span className="bg-amber-500/90 text-white p-0.5 rounded shadow-sm backdrop-blur-sm" title="Grow Lights On"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg></span>}
                    </div>
                  </div>
                  <div className="flex-1 py-1 flex flex-col justify-between min-w-0 pr-8">
                    <div>
                      <div className="flex justify-between items-start mb-0.5">
                        <h3 className="font-black text-stone-800 text-lg leading-none truncate pr-2">{tray.name || tray.id}</h3>
                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest whitespace-nowrap">{tray.sown_date}</span>
                      </div>
                      <p className="text-xs font-bold text-emerald-600 truncate mb-1">{seedsDisplay}</p>
                      <p className="text-[10px] text-stone-500 truncate">{tray.location || 'Location Not Set'}</p>
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-stone-100">
                      <span className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 px-2 py-0.5 rounded border shadow-sm ${tray.statusColor}`}>
                        {tray.showSproutIcon ? <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg> : <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                        {tray.statusText}
                      </span>
                      <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{tray.uniqueSeedIds.length} Var{tray.uniqueSeedIds.length === 1 ? '' : 's'}</span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-10 text-stone-500 bg-white rounded-xl border border-stone-100 shadow-sm">
              <svg className="w-12 h-12 mx-auto text-stone-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
              <p className="font-medium">No trays found matching filter.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}