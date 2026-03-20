import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { SeasonSeedling, Season, AppView, SeedlingJournalEntry, InventorySeed } from '../types';

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

export default function SeedlingsList({ navigateTo, handleGoBack }: any) {
  const [ledgers, setLedgers] = useState<SeasonSeedling[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [inventory, setInventory] = useState<InventorySeed[]>([]);
  const [activeSeason, setActiveSeason] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  const [activeModal, setActiveModal] = useState<'LOG_EVENT' | 'ALLOCATE' | 'JOURNAL' | 'ADJUST' | null>(null);
  const [selectedLedger, setSelectedLedger] = useState<SeasonSeedling | null>(null);

  const [carousel, setCarousel] = useState<{ images: string[], currentIndex: number } | null>(null);

  const [isDirectAddOpen, setIsDirectAddOpen] = useState(false);
  const [directAddForm, setDirectAddForm] = useState({ seedId: '', count: 1, note: '', seasonId: '', sownDate: '' });
  const [isSubmittingDirectAdd, setIsSubmittingDirectAdd] = useState(false);
  const [showSeedSearch, setShowSeedSearch] = useState(false);
  const [seedSearchQuery, setSeedSearchQuery] = useState("");

  const [eventType, setEventType] = useState<'qty_planted' | 'qty_gifted' | 'qty_sold' | 'qty_dead'>('qty_planted');
  const [deductKeep, setDeductKeep] = useState(0);
  const [deductReserve, setDeductReserve] = useState(0);
  const [deductAvailable, setDeductAvailable] = useState(0);

  const [editKeep, setEditKeep] = useState(0);
  const [editReserve, setEditReserve] = useState(0);
  
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustSownDate, setAdjustSownDate] = useState(''); 

  const [newNote, setNewNote] = useState('');
  const [noteType, setNoteType] = useState<'UPPOT' | 'FERTILIZE' | 'EVENT' | 'NOTE'>('NOTE');
  const [journalFilter, setJournalFilter] = useState<'ALL' | 'NOTE' | 'UPPOT' | 'FERTILIZE' | 'EVENT' | 'ALLOCATE' | 'PHOTO'>('ALL');
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  useEffect(() => { fetchBaseData(); }, []);
  useEffect(() => { 
     const todayObj = new Date();
     const localToday = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
     setDirectAddForm(prev => ({ ...prev, seasonId: activeSeason, sownDate: localToday })); 
  }, [activeSeason]);

  const fetchBaseData = async () => {
    setIsLoading(true);
    const [ { data: seasonData }, { data: invData } ] = await Promise.all([
      supabase.from('seasons').select('*').order('created_at', { ascending: false }),
      supabase.from('seed_inventory').select('*')
    ]);

    if (invData) setInventory(invData as InventorySeed[]);

    if (seasonData && seasonData.length > 0) {
      setSeasons(seasonData as Season[]);
      const active = seasonData.find((s: any) => s.status === 'Active');
      const defaultSeasonId = active ? active.id : seasonData[0].id;
      const currentSeason = activeSeason || defaultSeasonId;
      setActiveSeason(currentSeason);
      fetchLedgers(currentSeason);
    } else {
      setIsLoading(false);
    }
  };

  const fetchLedgers = async (seasonId: string) => {
    setIsLoading(true);
    const { data } = await supabase.from('season_seedlings').select('*, seed:seed_inventory(*)').eq('season_id', seasonId);
    if (data) {
       setLedgers(data);
       
       const urlsToFetch = data.flatMap(l => l.images || []).filter(img => img && !img.startsWith('http') && !img.startsWith('data:'));
       data.forEach(l => {
          (l.journal || []).forEach((j: any) => { if (j.image_path) urlsToFetch.push(j.image_path); });
       });

       if (urlsToFetch.length > 0) {
          const fetchedUrls: Record<string, string> = {};
          const { data: sData } = await supabase.storage.from('talawa_media').createSignedUrls(Array.from(new Set(urlsToFetch)), 3600);
          if (sData) sData.forEach((item: any) => { if (item.signedUrl) fetchedUrls[item.path] = item.signedUrl; });
          setSignedUrls(prev => ({ ...prev, ...fetchedUrls }));
       }
    }
    setIsLoading(false);
  };

  const availableCalc = (l: SeasonSeedling) => Math.max(0, l.qty_growing - l.allocate_keep - l.allocate_reserve);

  const handleCapturePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedLedger) return;
    
    setIsUploadingPhoto(true);
    try {
      const today = new Date();
      const dateStr = today.toLocaleDateString();
      let daysStr = "Unknown Age";
      
      if (selectedLedger.sown_date) {
         const sowDate = new Date(selectedLedger.sown_date + 'T12:00:00');
         const diffDays = Math.floor((today.getTime() - sowDate.getTime()) / (1000 * 60 * 60 * 24));
         daysStr = `${diffDays} days old`;
      } else if (selectedLedger.created_at) {
         const createdAt = new Date(selectedLedger.created_at);
         const diffDays = Math.floor((today.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
         daysStr = `Potted ${diffDays}d ago`;
      }
      const watermarkText = `${dateStr} : ${selectedLedger.seed?.variety_name || 'Unknown'} : ${daysStr}`;

      const watermarkedBlob = await processImageWithWatermark(file, watermarkText);

      const fileName = `seedling_${crypto.randomUUID()}.jpg`;
      const filePath = `seedlings/${selectedLedger.id}/${fileName}`;
      await supabase.storage.from('talawa_media').upload(filePath, watermarkedBlob, { contentType: 'image/jpeg' });
      
      const { data: urlData } = await supabase.storage.from('talawa_media').createSignedUrl(filePath, 3600);
      if (urlData?.signedUrl) {
         setSignedUrls(prev => ({...prev, [filePath]: urlData.signedUrl}));
      }

      const newImages = [...(selectedLedger.images || []), filePath];
      const todayObj = new Date();
      const localToday = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
      
      const newEntry: any = {
        id: window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).substring(2),
        date: localToday,
        type: 'PHOTO',
        note: '📸 Progression photo logged.',
        image_path: filePath
      };
      
      const updatedJournal = [newEntry, ...(selectedLedger.journal || [])];

      setLedgers(ledgers.map(l => l.id === selectedLedger.id ? { ...l, images: newImages, journal: updatedJournal } : l));
      setSelectedLedger({ ...selectedLedger, images: newImages, journal: updatedJournal });
      await supabase.from('season_seedlings').update({ images: newImages, journal: updatedJournal }).eq('id', selectedLedger.id);
      
    } catch (err: any) { alert("Upload failed: " + err.message); } 
    finally { setIsUploadingPhoto(false); }
  };

  const openEventModal = (ledger: SeasonSeedling) => { setSelectedLedger(ledger); setEventType('qty_planted'); setDeductKeep(0); setDeductReserve(0); setDeductAvailable(0); setActiveModal('LOG_EVENT'); };
  const openAllocateModal = (ledger: SeasonSeedling) => { setSelectedLedger(ledger); setEditKeep(ledger.allocate_keep); setEditReserve(ledger.allocate_reserve); setActiveModal('ALLOCATE'); };
  
  const openAdjustModal = (ledger: SeasonSeedling) => { 
      setSelectedLedger(ledger); 
      setAdjustQty(ledger.qty_growing); 
      setAdjustSownDate(ledger.sown_date || '');
      setActiveModal('ADJUST'); 
  };

  const submitEvent = async () => {
    if (!selectedLedger) return;
    const totalDeducted = deductKeep + deductReserve + deductAvailable;
    if (totalDeducted === 0) return;

    const newGrowing = Math.max(0, selectedLedger.qty_growing - totalDeducted);
    const verb = eventType.replace('qty_', ''); 
    const newJournalEntry: SeedlingJournalEntry = {
      id: window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).substring(2),
      date: new Date().toISOString().split('T')[0],
      type: 'EVENT',
      note: `Logged ${totalDeducted} as ${verb.toUpperCase()}. (-${deductKeep} Keep, -${deductReserve} Reserve, -${deductAvailable} Available)`
    };

    const updates = { qty_growing: newGrowing, allocate_keep: Math.max(0, selectedLedger.allocate_keep - deductKeep), allocate_reserve: Math.max(0, selectedLedger.allocate_reserve - deductReserve), [eventType]: (selectedLedger[eventType] as number) + totalDeducted, journal: [newJournalEntry, ...(selectedLedger.journal || [])] };
    setLedgers(ledgers.map(l => l.id === selectedLedger.id ? { ...l, ...updates } : l));
    setActiveModal(null);
    await supabase.from('season_seedlings').update(updates).eq('id', selectedLedger.id);
  };

  const submitAllocation = async () => {
    if (!selectedLedger) return;
    const newJournalEntry: SeedlingJournalEntry = { id: window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).substring(2), date: new Date().toISOString().split('T')[0], type: 'ALLOCATE', note: `Updated Allocations: Keep (${editKeep}), Reserve (${editReserve})` };
    const updates = { allocate_keep: editKeep, allocate_reserve: editReserve, journal: [newJournalEntry, ...(selectedLedger.journal || [])] };
    setLedgers(ledgers.map(l => l.id === selectedLedger.id ? { ...l, ...updates } : l));
    setActiveModal(null);
    await supabase.from('season_seedlings').update(updates).eq('id', selectedLedger.id);
  };

  const submitAdjustment = async () => {
    if (!selectedLedger) return;
    const deltaQty = adjustQty - selectedLedger.qty_growing;
    const isDateChanged = adjustSownDate !== (selectedLedger.sown_date || '');
    
    if (deltaQty === 0 && !isDateChanged) { setActiveModal(null); return; }
    
    const todayObj = new Date();
    const localToday = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
    
    let noteText = '';
    if (deltaQty !== 0) noteText += `Corrected total growing to ${adjustQty} (${deltaQty > 0 ? '+' : ''}${deltaQty}). `;
    if (isDateChanged) noteText += `Updated Original Sow Date to ${adjustSownDate}.`;

    const newJournalEntry: SeedlingJournalEntry = { 
        id: window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).substring(2), 
        date: localToday, 
        type: 'EVENT', 
        note: `Inventory Audit: ${noteText.trim()}` 
    };
    
    // FIX: Using undefined for local React state strictly to satisfy TS 'string | undefined'
    const localUpdates = { qty_growing: adjustQty, sown_date: adjustSownDate || undefined, journal: [newJournalEntry, ...(selectedLedger.journal || [])] };
    
    setLedgers(ledgers.map(l => l.id === selectedLedger.id ? { ...l, ...localUpdates } : l));
    setActiveModal(null);
    
    // FIX: Passing null directly to Supabase to clear DB columns if necessary
    await supabase.from('season_seedlings').update({ 
        qty_growing: adjustQty, 
        sown_date: adjustSownDate || null, 
        journal: [newJournalEntry, ...(selectedLedger.journal || [])] 
    }).eq('id', selectedLedger.id);
  };

  const submitJournalNote = async () => {
    if (!selectedLedger || !newNote.trim()) return;
    const todayObj = new Date();
    const localToday = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
    const newEntry: SeedlingJournalEntry = { id: window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).substring(2), date: localToday, type: noteType as any, note: newNote.trim() };
    const updatedJournal = [newEntry, ...(selectedLedger.journal || [])];
    setLedgers(ledgers.map(l => l.id === selectedLedger.id ? { ...l, journal: updatedJournal } : l));
    setSelectedLedger({ ...selectedLedger, journal: updatedJournal });
    setNewNote('');
    await supabase.from('season_seedlings').update({ journal: updatedJournal }).eq('id', selectedLedger.id);
  };

  const deleteJournalEntry = async (entryId: string) => {
    if (!selectedLedger) return;
    if (!confirm("Are you sure you want to delete this journal entry?")) return;
    
    const updatedJournal = (selectedLedger.journal || []).filter(j => j.id !== entryId);
    
    setLedgers(ledgers.map(l => l.id === selectedLedger.id ? { ...l, journal: updatedJournal } : l));
    setSelectedLedger({ ...selectedLedger, journal: updatedJournal });
    await supabase.from('season_seedlings').update({ journal: updatedJournal }).eq('id', selectedLedger.id);
  };

  const filteredInventoryForDirectAdd = inventory.filter((s: InventorySeed) => {
    if (!seedSearchQuery.trim()) return true;
    const q = seedSearchQuery.toLowerCase();
    return s.variety_name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q) || s.id.toLowerCase().includes(q);
  });

  const handleDirectAddSubmit = async () => {
    if (!directAddForm.seedId || !directAddForm.seasonId || directAddForm.count < 1) return;
    setIsSubmittingDirectAdd(true);
    try {
      const { data: existingLedger } = await supabase.from('season_seedlings').select('*').eq('seed_id', directAddForm.seedId).eq('season_id', directAddForm.seasonId).maybeSingle();
      const todayObj = new Date();
      const localToday = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
      const journalEntry = { id: window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).substring(2), date: localToday, type: 'EVENT', note: `Direct added ${directAddForm.count} plants/seedlings. ${directAddForm.note}` };

      if (existingLedger) {
        await supabase.from('season_seedlings').update({ qty_growing: existingLedger.qty_growing + directAddForm.count, journal: [journalEntry, ...(existingLedger.journal || [])] }).eq('id', existingLedger.id);
      } else {
        await supabase.from('season_seedlings').insert([{ 
            seed_id: directAddForm.seedId, season_id: directAddForm.seasonId, 
            qty_growing: directAddForm.count, 
            sown_date: directAddForm.sownDate || localToday,
            allocate_keep: 0, allocate_reserve: 0, qty_planted: 0, qty_gifted: 0, qty_sold: 0, qty_dead: 0, locations: {}, 
            journal: [journalEntry] 
        }]);
      }
      setIsDirectAddOpen(false);
      setDirectAddForm({ seedId: '', count: 1, note: '', seasonId: activeSeason, sownDate: localToday });
      fetchLedgers(activeSeason); 
      alert("Successfully added to your nursery ledger!");
    } catch (err: any) { alert("Failed to add seedlings: " + err.message); } 
    finally { setIsSubmittingDirectAdd(false); }
  };

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900 pb-24 font-sans relative">
      
      {/* CAROUSEL MODAL */}
      {carousel && (
        <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center">
          <div className="absolute top-4 right-4 z-50">
             <button onClick={() => setCarousel(null)} className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-sm transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
             </button>
          </div>
          
          {carousel.images.length > 1 && (
            <>
              <button onClick={() => setCarousel(prev => ({...prev!, currentIndex: (prev!.currentIndex - 1 + prev!.images.length) % prev!.images.length}))} className="absolute left-4 top-1/2 -translate-y-1/2 p-4 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-sm z-50">
                 <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <button onClick={() => setCarousel(prev => ({...prev!, currentIndex: (prev!.currentIndex + 1) % prev!.images.length}))} className="absolute right-4 top-1/2 -translate-y-1/2 p-4 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-sm z-50">
                 <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
              <div className="absolute bottom-6 left-0 right-0 text-center text-white/70 text-sm font-bold tracking-widest uppercase">
                 {carousel.currentIndex + 1} / {carousel.images.length}
              </div>
            </>
          )}

          <img src={carousel.images[carousel.currentIndex]} className="w-full h-full object-contain" />
        </div>
      )}

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

                <button onClick={handleDirectAddSubmit} disabled={isSubmittingDirectAdd || !directAddForm.seedId || directAddForm.count < 1} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black uppercase tracking-widest shadow-xl shadow-emerald-900/20 active:scale-95 transition-all disabled:opacity-50 mt-2 hover:bg-emerald-500">
                  {isSubmittingDirectAdd ? 'Saving...' : 'Add to Ledger'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <header className="bg-emerald-800 text-white p-4 shadow-md sticky top-0 z-10 flex items-center justify-between border-b border-emerald-900">
        <div className="flex items-center gap-2">
          <button onClick={() => navigateTo('dashboard')} className="p-2 bg-emerald-900 rounded-full hover:bg-emerald-700 transition-colors" title="Dashboard">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 001 1m-6 0h6" /></svg>
          </button>
          <h1 className="text-xl font-bold ml-1 truncate">Seedling Nursery</h1>
        </div>
        <div className="flex items-center gap-3">
            <button onClick={() => setIsDirectAddOpen(true)} className="px-3 py-1.5 bg-emerald-900 text-emerald-100 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm text-xs font-black uppercase tracking-widest flex items-center gap-1 border border-emerald-700/50" title="Direct Add Seedlings">
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg> Add
            </button>
            <select 
              value={activeSeason} 
              onChange={(e) => { setActiveSeason(e.target.value); fetchLedgers(e.target.value); }}
              className="bg-emerald-900 border border-emerald-700 text-sm font-bold rounded-xl px-3 py-1.5 outline-none appearance-none cursor-pointer max-w-[120px] truncate"
            >
              {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-4 space-y-4">
        {isLoading ? (
           <div className="flex justify-center py-20 text-emerald-600">
             <svg className="w-10 h-10 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
           </div>
        ) : ledgers.length === 0 ? (
           <div className="text-center py-20 bg-white rounded-3xl border border-stone-200 shadow-sm">
             <svg className="w-16 h-16 mx-auto text-stone-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
             <h2 className="text-lg font-black text-stone-800">No Seedlings Found</h2>
             <p className="text-stone-500 text-sm mt-1">Pot up some seeds from your trays to start a ledger.</p>
           </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ledgers.map(ledger => {
              const seed = ledger.seed;
              const available = availableCalc(ledger);
              return (
                <div key={ledger.id} className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden flex flex-col">
                  <div className="p-4 border-b border-stone-100 flex items-center gap-4 bg-stone-50">
                    <div className="w-16 h-16 bg-stone-200 rounded-xl overflow-hidden shadow-inner flex-shrink-0 cursor-pointer hover:border-emerald-500 border border-transparent transition-colors" onClick={() => navigateTo('seed_detail', seed)}>
                      {seed?.thumbnail ? <img src={seed.thumbnail} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-stone-400">🌱</div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-black text-lg text-stone-900 truncate hover:text-emerald-600 cursor-pointer" onClick={() => navigateTo('seed_detail', seed)}>{seed?.variety_name || 'Unknown Seed'}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest bg-emerald-100 px-1.5 py-0.5 rounded-md leading-none border border-emerald-200">{seed?.category || 'Plant'}</p>
                        <p className="text-[9px] font-mono text-stone-500 bg-stone-100 border border-stone-200 px-1.5 py-0.5 rounded shadow-sm">ID: {seed?.id || 'Unknown'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="px-4 pt-3 flex justify-between items-end">
                    <span className="text-[9px] font-black uppercase tracking-widest text-stone-400">Inventory Status</span>
                    <button onClick={() => openAdjustModal(ledger)} className="text-[9px] font-black uppercase tracking-widest text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-md active:scale-95 transition-all hover:bg-amber-100 flex items-center gap-1 shadow-sm">
                      ⚖️ Adjust
                    </button>
                  </div>

                  <div className="px-4 pb-4 pt-2 grid grid-cols-4 gap-2 text-center relative">
                    <div className="bg-emerald-50 rounded-xl p-2 border border-emerald-100"><div className="text-[10px] font-black text-emerald-800 uppercase tracking-widest mb-1">Growing</div><div className="text-2xl font-black text-emerald-600">{ledger.qty_growing}</div></div>
                    <div className="bg-stone-50 rounded-xl p-2 border border-stone-200"><div className="text-[10px] font-black text-stone-500 uppercase tracking-widest mb-1">Keep</div><div className="text-xl font-black text-stone-800">{ledger.allocate_keep}</div></div>
                    <div className="bg-purple-50 rounded-xl p-2 border border-purple-100"><div className="text-[10px] font-black text-purple-800 uppercase tracking-widest mb-1">Reserve</div><div className="text-xl font-black text-purple-600">{ledger.allocate_reserve}</div></div>
                    <div className="bg-blue-50 rounded-xl p-2 border border-blue-100 shadow-inner"><div className="text-[10px] font-black text-blue-800 uppercase tracking-widest mb-1">Avail</div><div className="text-2xl font-black text-blue-600">{available}</div></div>
                  </div>

                  <div className="p-3 bg-stone-50 border-t border-b border-stone-100 flex gap-2 overflow-x-auto scrollbar-hide">
                    <button onClick={() => openEventModal(ledger)} className="flex-1 min-w-[90px] py-2 bg-stone-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center shadow-sm">Log Event</button>
                    <button onClick={() => openAllocateModal(ledger)} className="flex-1 min-w-[90px] py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center hover:bg-purple-100">Allocate</button>
                    <button onClick={() => { setSelectedLedger(ledger); setJournalFilter('ALL'); setActiveModal('JOURNAL'); }} className="flex-1 min-w-[90px] py-2 bg-white text-stone-600 border border-stone-200 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center hover:bg-stone-100 gap-1.5">
                       Journal {(ledger.images && ledger.images.length > 0) && <span className="w-2 h-2 bg-blue-500 rounded-full" />}
                    </button>
                  </div>

                  <div className="p-3 bg-white grid grid-cols-4 gap-2 text-center text-xs font-bold text-stone-500">
                    <div>Planted <span className="block text-stone-800 font-black text-lg">{ledger.qty_planted}</span></div>
                    <div>Gifted <span className="block text-stone-800 font-black text-lg">{ledger.qty_gifted}</span></div>
                    <div>Sold <span className="block text-stone-800 font-black text-lg">{ledger.qty_sold}</span></div>
                    <div>Dead <span className="block text-red-600 font-black text-lg">{ledger.qty_dead}</span></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {activeModal === 'ADJUST' && selectedLedger && (
        <div className="fixed inset-0 z-50 bg-stone-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-amber-50 p-4 border-b border-amber-200 flex justify-between items-center">
              <h2 className="font-black text-amber-900 tracking-tight flex items-center gap-2">⚖️ Inventory Audit</h2>
              <button onClick={() => setActiveModal(null)} className="p-1 rounded-full text-amber-600 hover:bg-amber-200"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-stone-500 leading-relaxed">Fix a miscount without logging them as "Dead" or doing another "Direct Add". This will add a note to your journal.</p>
              
              <div className="flex items-center justify-between bg-white border border-stone-200 p-4 rounded-2xl shadow-sm">
                <div><span className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">Current Total</span><span className="text-2xl font-black text-stone-400 line-through decoration-red-500 decoration-2">{selectedLedger.qty_growing}</span></div>
                <div className="text-xl text-stone-300">➡️</div>
                <div className="text-right">
                  <span className="block text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Actual Total</span>
                  <input type="number" min="0" value={adjustQty === 0 && adjustQty !== selectedLedger.qty_growing ? '' : adjustQty} onChange={(e) => setAdjustQty(Number(e.target.value))} className="w-24 text-center border-b-2 border-amber-300 py-1 text-2xl font-black text-stone-800 outline-none focus:border-amber-500" />
                </div>
              </div>
              
              {adjustQty !== selectedLedger.qty_growing && (
                <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 text-center text-sm font-bold text-stone-600 animate-in fade-in">
                  Difference: <span className={adjustQty > selectedLedger.qty_growing ? 'text-emerald-600' : 'text-red-600'}>{adjustQty > selectedLedger.qty_growing ? '+' : ''}{adjustQty - selectedLedger.qty_growing}</span>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Original Sow Date</label>
                <input type="date" value={adjustSownDate} onChange={(e) => setAdjustSownDate(e.target.value)} className="w-full bg-white border border-stone-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-amber-500 shadow-sm" />
              </div>

              <button onClick={submitAdjustment} disabled={adjustQty === selectedLedger.qty_growing && adjustSownDate === (selectedLedger.sown_date || '')} className="w-full py-4 bg-amber-500 text-white rounded-xl font-black uppercase tracking-widest shadow-xl shadow-amber-900/20 active:scale-95 transition-all mt-2 hover:bg-amber-600 disabled:opacity-50 disabled:grayscale">Confirm Adjustment</button>
            </div>
          </div>
        </div>
      )}

      {activeModal === 'LOG_EVENT' && selectedLedger && (
        <div className="fixed inset-0 z-50 bg-stone-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-stone-100 p-4 border-b border-stone-200 flex justify-between items-center">
              <h2 className="font-black text-stone-800 tracking-tight">Log Event</h2>
              <button onClick={() => setActiveModal(null)} className="p-1 rounded-full text-stone-400 hover:bg-stone-200 hover:text-stone-800"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="p-5 space-y-5">
              <div>
                <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2">What happened?</label>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setEventType('qty_planted')} className={`py-2 rounded-xl text-xs font-black uppercase tracking-widest border transition-all ${eventType === 'qty_planted' ? 'bg-emerald-100 text-emerald-800 border-emerald-300 shadow-sm' : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-50'}`}>🌱 Planted</button>
                  <button onClick={() => setEventType('qty_gifted')} className={`py-2 rounded-xl text-xs font-black uppercase tracking-widest border transition-all ${eventType === 'qty_gifted' ? 'bg-blue-100 text-blue-800 border-blue-300 shadow-sm' : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-50'}`}>🎁 Gifted</button>
                  <button onClick={() => setEventType('qty_sold')} className={`py-2 rounded-xl text-xs font-black uppercase tracking-widest border transition-all ${eventType === 'qty_sold' ? 'bg-amber-100 text-amber-800 border-amber-300 shadow-sm' : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-50'}`}>🏷️ Sold</button>
                  <button onClick={() => setEventType('qty_dead')} className={`py-2 rounded-xl text-xs font-black uppercase tracking-widest border transition-all ${eventType === 'qty_dead' ? 'bg-red-100 text-red-800 border-red-300 shadow-sm' : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-50'}`}>💀 Dead</button>
                </div>
              </div>
              <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200">
                <label className="block text-[10px] font-black text-stone-500 uppercase tracking-widest mb-3 text-center">Where are these coming from?</label>
                <div className="space-y-3">
                  <div className="flex items-center justify-between"><span className="text-sm font-bold text-stone-700 w-24">My Keep</span><input type="number" min="0" max={selectedLedger.allocate_keep} value={deductKeep || ''} onChange={(e) => setDeductKeep(Math.min(selectedLedger.allocate_keep, Number(e.target.value)))} className="w-16 text-center border border-stone-300 rounded-lg py-1 shadow-inner focus:border-emerald-500 outline-none font-black" placeholder="0" /><span className="text-[10px] font-bold text-stone-400 w-12 text-right">Max {selectedLedger.allocate_keep}</span></div>
                  <div className="flex items-center justify-between"><span className="text-sm font-bold text-stone-700 w-24">Reserved</span><input type="number" min="0" max={selectedLedger.allocate_reserve} value={deductReserve || ''} onChange={(e) => setDeductReserve(Math.min(selectedLedger.allocate_reserve, Number(e.target.value)))} className="w-16 text-center border border-stone-300 rounded-lg py-1 shadow-inner focus:border-emerald-500 outline-none font-black" placeholder="0" /><span className="text-[10px] font-bold text-stone-400 w-12 text-right">Max {selectedLedger.allocate_reserve}</span></div>
                  <div className="flex items-center justify-between"><span className="text-sm font-bold text-stone-700 w-24">Available</span><input type="number" min="0" max={availableCalc(selectedLedger)} value={deductAvailable || ''} onChange={(e) => setDeductAvailable(Math.min(availableCalc(selectedLedger), Number(e.target.value)))} className="w-16 text-center border border-stone-300 rounded-lg py-1 shadow-inner focus:border-emerald-500 outline-none font-black" placeholder="0" /><span className="text-[10px] font-bold text-stone-400 w-12 text-right">Max {availableCalc(selectedLedger)}</span></div>
                </div>
                <div className="mt-4 pt-3 border-t border-stone-200 flex justify-between items-center text-sm font-black"><span className="uppercase tracking-widest text-stone-500">Total Selected:</span><span className="text-xl text-stone-900">{deductKeep + deductReserve + deductAvailable}</span></div>
              </div>
              <button onClick={submitEvent} disabled={deductKeep + deductReserve + deductAvailable === 0} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black uppercase tracking-widest shadow-xl shadow-emerald-900/20 active:scale-95 transition-all disabled:opacity-50">Log & Deduct</button>
            </div>
          </div>
        </div>
      )}

      {activeModal === 'ALLOCATE' && selectedLedger && (
        <div className="fixed inset-0 z-50 bg-stone-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-purple-50 p-4 border-b border-purple-100 flex justify-between items-center">
              <h2 className="font-black text-purple-900 tracking-tight flex items-center gap-2">🧮 Update Allocations</h2>
              <button onClick={() => setActiveModal(null)} className="p-1 rounded-full text-purple-400 hover:bg-purple-200 hover:text-purple-800"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="p-5 space-y-5">
              <div className="text-center bg-stone-100 p-3 rounded-xl border border-stone-200 mb-4"><span className="text-[10px] font-black uppercase tracking-widest text-stone-500">Total Growing</span><div className="text-3xl font-black text-stone-800">{selectedLedger.qty_growing}</div></div>
              <div className="space-y-4">
                <div className="flex items-center justify-between"><span className="text-sm font-bold text-stone-700 w-24">My Keep</span><input type="number" min="0" value={editKeep === 0 ? '' : editKeep} onChange={(e) => setEditKeep(Number(e.target.value))} className="w-20 text-center border border-stone-300 rounded-xl py-2 shadow-inner focus:border-purple-500 outline-none font-black text-lg" placeholder="0" /></div>
                <div className="flex items-center justify-between"><span className="text-sm font-bold text-stone-700 w-24">Reserved</span><input type="number" min="0" value={editReserve === 0 ? '' : editReserve} onChange={(e) => setEditReserve(Number(e.target.value))} className="w-20 text-center border border-stone-300 rounded-xl py-2 shadow-inner focus:border-purple-500 outline-none font-black text-lg" placeholder="0" /></div>
              </div>
              <div className="mt-4 pt-4 border-t border-stone-200 flex justify-between items-center">
                <span className="text-xs font-black uppercase tracking-widest text-blue-600">Calculated Available</span><span className={`text-2xl font-black ${selectedLedger.qty_growing - editKeep - editReserve < 0 ? 'text-red-500' : 'text-blue-600'}`}>{selectedLedger.qty_growing - editKeep - editReserve}</span>
              </div>
              {selectedLedger.qty_growing - editKeep - editReserve < 0 && <p className="text-[10px] text-red-500 font-bold text-center">You have over-allocated your growing plants!</p>}
              <button onClick={submitAllocation} className="w-full py-4 bg-purple-600 text-white rounded-xl font-black uppercase tracking-widest shadow-xl shadow-purple-900/20 active:scale-95 transition-all mt-2">Save Allocations</button>
            </div>
          </div>
        </div>
      )}

      {activeModal === 'JOURNAL' && selectedLedger && (
        <div className="fixed inset-0 z-50 bg-stone-900/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md h-[85vh] sm:h-[700px] shadow-2xl flex flex-col animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300">
            <div className="bg-stone-50 p-4 border-b border-stone-200 flex justify-between items-center shrink-0 rounded-t-3xl">
              <div>
                <h2 className="font-black text-stone-800 tracking-tight">Ledger Journal</h2>
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{selectedLedger.seed?.variety_name}</p>
              </div>
              <button onClick={() => setActiveModal(null)} className="p-2 rounded-full text-stone-400 hover:bg-stone-200 hover:text-stone-800"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>

            <div className="bg-white px-4 py-2 border-b border-stone-100 flex gap-2 overflow-x-auto scrollbar-hide shrink-0 shadow-sm z-10">
               {['ALL', 'NOTE', 'UPPOT', 'FERTILIZE', 'EVENT', 'PHOTO'].map(f => (
                 <button key={f} onClick={() => setJournalFilter(f as any)} className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors whitespace-nowrap ${journalFilter === f ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}>
                   {f}
                 </button>
               ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-stone-100">
              {(selectedLedger.journal || [])
                .filter((j: any) => journalFilter === 'ALL' || j.type === journalFilter || (journalFilter === 'PHOTO' && j.image_path))
                .length === 0 ? (
                <p className="text-center text-stone-400 text-sm italic py-10">No journal entries found.</p>
              ) : (
                (selectedLedger.journal || [])
                .filter((j: any) => journalFilter === 'ALL' || j.type === journalFilter || (journalFilter === 'PHOTO' && j.image_path))
                .map((entry: any, idx) => (
                  <div key={idx} className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200 relative group">
                    
                    <button 
                      onClick={() => deleteJournalEntry(entry.id)}
                      className="absolute top-3 right-3 p-1.5 bg-stone-50 text-stone-300 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete Entry"
                    >
                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>

                    <div className="flex justify-between items-start mb-2 pr-8">
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded shadow-sm
                        ${entry.type === 'UPPOT' ? 'bg-amber-100 text-amber-800' : 
                          entry.type === 'FERTILIZE' ? 'bg-blue-100 text-blue-800' : 
                          entry.type === 'PHOTO' ? 'bg-indigo-100 text-indigo-800' :
                          entry.type === 'ALLOCATE' ? 'bg-purple-100 text-purple-800' :
                          entry.type === 'EVENT' ? 'bg-stone-800 text-white' : 'bg-emerald-100 text-emerald-800'}`}
                      >
                        {entry.type}
                      </span>
                      <span className="text-[10px] font-bold text-stone-400">{entry.date}</span>
                    </div>
                    <p className="text-sm text-stone-700 font-medium leading-relaxed">{entry.note}</p>
                    
                    {entry.image_path && signedUrls[entry.image_path] && (
                       <div 
                          className="mt-3 w-full h-40 rounded-xl overflow-hidden border border-stone-200 shadow-sm cursor-zoom-in hover:opacity-90 transition-opacity"
                          onClick={() => {
                             const jPhotos = (selectedLedger.journal || []).map((j: any) => j.image_path ? signedUrls[j.image_path] : null).filter(Boolean) as string[];
                             const clickedIndex = jPhotos.indexOf(signedUrls[entry.image_path]);
                             setCarousel({ images: jPhotos, currentIndex: clickedIndex });
                          }}
                       >
                           <img src={signedUrls[entry.image_path]} className="w-full h-full object-cover" />
                       </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="p-4 bg-white border-t border-stone-200 shrink-0 shadow-[0_-10px_20px_rgba(0,0,0,0.03)]">
              <div className="flex gap-2 mb-3">
                <button onClick={() => photoInputRef.current?.click()} disabled={isUploadingPhoto} className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1 active:scale-95 transition-all border border-blue-200 shadow-sm disabled:opacity-50">
                  {isUploadingPhoto ? '⏳' : '📸'} Photo
                </button>
                <input type="file" accept="image/*" capture="environment" ref={photoInputRef} className="hidden" onChange={handleCapturePhoto} />
                
                {['NOTE', 'UPPOT', 'FERTILIZE'].map(t => (
                  <button key={t} onClick={() => setNoteType(t as any)} className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg border transition-colors shadow-sm ${noteType === t ? 'bg-stone-800 text-white border-stone-800' : 'bg-stone-50 text-stone-500 border-stone-200'}`}>{t}</button>
                ))}
              </div>
              <div className="flex gap-2">
                <input type="text" value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Type a note or log pot size..." className="flex-1 border border-stone-200 rounded-xl px-4 py-3 text-sm focus:border-emerald-500 outline-none bg-stone-50 shadow-inner font-medium" />
                <button onClick={submitJournalNote} disabled={!newNote.trim()} className="bg-emerald-600 text-white px-4 rounded-xl shadow-md disabled:opacity-50 active:scale-95 transition-all">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}