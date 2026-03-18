import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { GardenArea, GardenBed, FieldPlanting, SeasonSeedling, Season, AppView, SeedlingJournalEntry } from '../types';

interface Props {
  navigateTo: (view: AppView, payload?: any) => void;
  handleGoBack: (view: AppView) => void;
}

export default function FarmMap({ navigateTo, handleGoBack }: Props) {
  const [areas, setAreas] = useState<GardenArea[]>([]);
  const [beds, setBeds] = useState<GardenBed[]>([]);
  const [plantings, setPlantings] = useState<FieldPlanting[]>([]);
  const [ledgers, setLedgers] = useState<SeasonSeedling[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [activeSeason, setActiveSeason] = useState<Season | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // New Map UI State
  const [activeAreaId, setActiveAreaId] = useState<string>("");
  const [mapMode, setMapMode] = useState<'CROP' | 'NUTRIENT' | 'LAYOUT'>('CROP');
  const [viewingBed, setViewingBed] = useState<GardenBed | null>(null);

  // Drag and Drop State
  const [dragState, setDragState] = useState<{ id: string, startX: number, startY: number, initX: number, initY: number } | null>(null);
  const GRID_SIZE = 20; // 20 pixels = 1 unit (ft, m, etc)

  // Area Modals
  const [isAreaModalOpen, setIsAreaModalOpen] = useState(false);
  const [areaForm, setAreaForm] = useState<{ id?: string, name: string, width: number, length: number, unit: string }>({ name: '', width: 50, length: 50, unit: 'ft' });

  // Bed Modals
  const [isBedModalOpen, setIsBedModalOpen] = useState(false);
  const [bedForm, setBedForm] = useState<Partial<GardenBed>>({ 
    name: '', type: 'Raised Bed', irrigation_type: 'Hand-water', unit: 'ft', watering_frequency_days: 3,
    current_stage: 'Vegetative', drench_volume_gallons: 1.0, feed_frequency_days: 14
  });

  // Planting Out Modal
  const [isPlantOutModalOpen, setIsPlantOutModalOpen] = useState(false);
  const [selectedBedForPlanting, setSelectedBedForPlanting] = useState<GardenBed | null>(null);
  const [plantOutForm, setPlantOutForm] = useState({ ledgerId: '', qty: 1, date: '' });
  const [isSubmittingPlantOut, setIsSubmittingPlantOut] = useState(false);

  // Manage Existing Planting Modal
  const [editingPlanting, setEditingPlanting] = useState<FieldPlanting | null>(null);
  const [plantingForm, setPlantingForm] = useState<{ status: string, yield_lbs: number, yield_count: number }>({ status: 'Growing', yield_lbs: 0, yield_count: 0 });

  const BED_TYPES = ['Raised Bed', 'In-Ground Row', 'SIP', 'Container', 'Tree/Orchard'];
  const IRRIGATION_TYPES = ['Hand-water', 'Drip', 'Olla', 'SIP Reservoir', 'Sprinkler'];
  const UNITS = ['ft', 'in', 'm', 'cm'];
  const PLANTING_STATUSES = ['Growing', 'Harvesting', 'Done', 'Failed'];

  useEffect(() => {
    fetchFarmData();
  }, []);

  const fetchFarmData = async () => {
    setIsLoading(true);
    
    const { data: seasonData } = await supabase.from('seasons').select('*').order('created_at', { ascending: false });
    let currentSeason = null;
    if (seasonData && seasonData.length > 0) {
      currentSeason = seasonData.find(s => s.status === 'Active') || seasonData[0];
      setActiveSeason(currentSeason);
    }

    const [areaRes, bedRes, plantRes, ledgerRes, recipeRes] = await Promise.all([
      supabase.from('garden_areas').select('*').order('created_at', { ascending: true }),
      supabase.from('garden_beds').select('*').order('created_at', { ascending: true }),
      supabase.from('field_plantings').select('*, seed:seed_inventory(*)').order('plant_date', { ascending: false }),
      supabase.from('season_seedlings').select('*, seed:seed_inventory(*)').eq('season_id', currentSeason?.id || ''),
      supabase.from('recipes').select('id, name, type')
    ]);

    if (areaRes.data) {
      setAreas(areaRes.data);
      if (areaRes.data.length > 0 && !activeAreaId) setActiveAreaId(areaRes.data[0].id);
    }
    if (bedRes.data) setBeds(bedRes.data);
    if (plantRes.data) setPlantings(plantRes.data);
    if (ledgerRes.data) setLedgers(ledgerRes.data);
    if (recipeRes.data) setRecipes(recipeRes.data);
    
    setIsLoading(false);
  };

  const availableCalc = (l: SeasonSeedling) => Math.max(0, l.qty_growing - l.allocate_keep - l.allocate_reserve);

  // --- MAP DRAG & DROP ENGINE ---
  const handlePointerDown = (e: React.PointerEvent, bed: GardenBed) => {
    if (mapMode !== 'LAYOUT') {
      setViewingBed(bed);
      return;
    }
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragState({
      id: bed.id,
      startX: e.clientX,
      startY: e.clientY,
      initX: (bed as any).pos_x || 0,
      initY: (bed as any).pos_y || 0
    });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (mapMode !== 'LAYOUT' || !dragState) return;
    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;
    
    const gridDx = Math.round(dx / GRID_SIZE);
    const gridDy = Math.round(dy / GRID_SIZE);

    setBeds(prev => prev.map(b => b.id === dragState.id ? {
      ...b,
      pos_x: Math.max(0, dragState.initX + gridDx),
      pos_y: Math.max(0, dragState.initY + gridDy)
    } as any : b));
  };

  const handlePointerUp = async (e: React.PointerEvent) => {
    if (mapMode !== 'LAYOUT' || !dragState) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    const bed: any = beds.find(b => b.id === dragState.id);
    setDragState(null);
    if (bed) {
      await supabase.from('garden_beds').update({ pos_x: bed.pos_x, pos_y: bed.pos_y }).eq('id', bed.id);
    }
  };

  // --- AREA CRUD ---
  const openAreaModal = (area?: GardenArea) => {
    setAreaForm(area ? { 
      id: area.id, 
      name: area.name, 
      width: (area as any).width || 50, 
      length: (area as any).length || 50,
      unit: (area as any).unit || 'ft'
    } : { name: '', width: 50, length: 50, unit: 'ft' });
    setIsAreaModalOpen(true);
  };

  const handleSaveArea = async () => {
    if (!areaForm.name.trim()) return;
    const payload = { name: areaForm.name.trim(), width: areaForm.width, length: areaForm.length, unit: areaForm.unit };
    if (areaForm.id) {
      const { data, error } = await supabase.from('garden_areas').update(payload).eq('id', areaForm.id).select().single();
      if (data) { setAreas(areas.map(a => a.id === areaForm.id ? data : a)); setIsAreaModalOpen(false); } 
      else { alert("Error updating area: " + error?.message); }
    } else {
      const { data, error } = await supabase.from('garden_areas').insert([payload]).select().single();
      if (data) { setAreas([...areas, data]); setActiveAreaId(data.id); setIsAreaModalOpen(false); } 
      else { alert("Error adding area: " + error?.message); }
    }
  };

  const handleDeleteArea = async (id: string) => {
    if (confirm("Are you sure you want to delete this entire area? This will delete ALL beds and plantings inside it permanently!")) {
      const { error } = await supabase.from('garden_areas').delete().eq('id', id);
      if (!error) {
        const remaining = areas.filter(a => a.id !== id);
        setAreas(remaining);
        if (activeAreaId === id) setActiveAreaId(remaining.length > 0 ? remaining[0].id : "");
      } else { alert("Error deleting area: " + error.message); }
    }
  };

  // --- BED CRUD ---
  const openBedModal = (bed?: GardenBed) => {
    if (bed) {
      setBedForm({ ...bed, watering_frequency_days: bed.watering_frequency_days || 3, drench_volume_gallons: (bed as any).drench_volume_gallons || 1.0, current_stage: (bed as any).current_stage || 'Vegetative' });
    } else {
      const activeAreaObj = areas.find(a => a.id === activeAreaId);
      setBedForm({ 
        name: '', type: 'Raised Bed', irrigation_type: 'Hand-water', unit: (activeAreaObj as any)?.unit || 'ft', watering_frequency_days: 3,
        current_stage: 'Vegetative', drench_volume_gallons: 1.0, feed_frequency_days: 14
      });
    }
    setIsBedModalOpen(true);
  };

  const handleSaveBed = async () => {
    if (!bedForm.name?.trim() || !activeAreaId) return;
    const payload = { ...bedForm, area_id: activeAreaId, name: bedForm.name.trim() };
    if (bedForm.id) {
      const { data, error } = await supabase.from('garden_beds').update(payload).eq('id', bedForm.id).select().single();
      if (data) { setBeds(beds.map(b => b.id === bedForm.id ? data : b)); setIsBedModalOpen(false); } 
      else { alert("Error updating bed: " + error?.message); }
    } else {
      const { data, error } = await supabase.from('garden_beds').insert([payload]).select().single();
      if (data) { setBeds([...beds, data]); setIsBedModalOpen(false); } 
      else { alert("Error adding bed: " + error?.message); }
    }
  };

  const handleDeleteBed = async (id: string) => {
    if (confirm("Delete this bed? This will delete all plantings currently assigned to it.")) {
      const { error } = await supabase.from('garden_beds').delete().eq('id', id);
      if (!error) { setBeds(beds.filter(b => b.id !== id)); setIsBedModalOpen(false); setViewingBed(null); } 
      else { alert("Error deleting bed: " + error.message); }
    }
  };

  const handleLogFeedToday = async () => {
    if (!viewingBed) return;
    const todayObj = new Date();
    const localToday = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
    
    const { error } = await supabase.from('garden_beds').update({ last_fed_date: localToday }).eq('id', viewingBed.id);
    if (!error) {
      setBeds(beds.map(b => b.id === viewingBed.id ? { ...b, last_fed_date: localToday } as any : b));
      setViewingBed({ ...viewingBed, last_fed_date: localToday } as any);
    } else {
      alert("Failed to log feed: " + error.message);
    }
  };

  // --- PLANTING OUT WORKFLOW ---
  const openPlantOutModal = (bed: GardenBed) => {
    setSelectedBedForPlanting(bed);
    const todayObj = new Date();
    const localToday = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
    setPlantOutForm({ ledgerId: '', qty: 1, date: localToday });
    setIsPlantOutModalOpen(true);
  };

  const handlePlantOutSubmit = async () => {
    if (!selectedBedForPlanting || !plantOutForm.ledgerId || plantOutForm.qty < 1 || !activeSeason) return;
    setIsSubmittingPlantOut(true);

    try {
      const ledger = ledgers.find(l => l.id === plantOutForm.ledgerId);
      if (!ledger || !ledger.seed) throw new Error("Could not find source ledger.");

      const { data: newPlanting, error: plantError } = await supabase.from('field_plantings').insert([{
        bed_id: selectedBedForPlanting.id, seed_id: ledger.seed_id, season_id: activeSeason.id,
        plant_date: plantOutForm.date, qty_planted: plantOutForm.qty, status: 'Growing'
      }]).select('*, seed:seed_inventory(*)').single();

      if (plantError) throw new Error("Planting Error: " + plantError.message);

      const newGrowing = Math.max(0, ledger.qty_growing - plantOutForm.qty);
      const newPlanted = ledger.qty_planted + plantOutForm.qty;
      const journalEntry: SeedlingJournalEntry = {
        id: window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).substring(2),
        date: plantOutForm.date, type: 'EVENT', note: `Transplanted ${plantOutForm.qty} to ${selectedBedForPlanting.name}.`
      };
      const updatedJournal = [journalEntry, ...(ledger.journal || [])];

      await supabase.from('season_seedlings').update({ qty_growing: newGrowing, qty_planted: newPlanted, journal: updatedJournal }).eq('id', ledger.id);
      setPlantings([newPlanting, ...plantings]);
      setLedgers(ledgers.map(l => l.id === ledger.id ? { ...l, qty_growing: newGrowing, qty_planted: newPlanted, journal: updatedJournal } : l));
      setIsPlantOutModalOpen(false);
    } catch (err: any) { alert(err.message); } 
    finally { setIsSubmittingPlantOut(false); }
  };

  // --- MANAGE PLANTING CRUD ---
  const openEditPlantingModal = (planting: FieldPlanting) => {
    setEditingPlanting(planting);
    setPlantingForm({ status: planting.status, yield_lbs: planting.yield_lbs || 0, yield_count: planting.yield_count || 0 });
  };

  const handleUpdatePlanting = async () => {
    if (!editingPlanting) return;
    const { data, error } = await supabase.from('field_plantings').update({
      status: plantingForm.status, yield_lbs: plantingForm.yield_lbs, yield_count: plantingForm.yield_count
    }).eq('id', editingPlanting.id).select('*, seed:seed_inventory(*)').single();

    if (data && !error) {
      setPlantings(plantings.map(p => p.id === editingPlanting.id ? data : p));
      setEditingPlanting(null);
    } else { alert("Failed to update: " + error?.message); }
  };

  const handleDeletePlanting = async () => {
    if (!editingPlanting) return;
    const revertToLedger = confirm("Do you want to return these plants to the Nursery Ledger? (Click OK to return to nursery, or Cancel to just delete them forever).");

    if (revertToLedger) {
       const ledger = ledgers.find(l => l.seed_id === editingPlanting.seed_id && l.season_id === editingPlanting.season_id);
       if (ledger) {
         const newGrowing = ledger.qty_growing + editingPlanting.qty_planted;
         const newPlanted = Math.max(0, ledger.qty_planted - editingPlanting.qty_planted);
         const journalEntry: SeedlingJournalEntry = {
            id: window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).substring(2),
            date: new Date().toISOString().split('T')[0], type: 'EVENT', note: `Reverted ${editingPlanting.qty_planted} back from field map.`
         };
         const updatedJournal = [journalEntry, ...(ledger.journal || [])];
         await supabase.from('season_seedlings').update({ qty_growing: newGrowing, qty_planted: newPlanted, journal: updatedJournal }).eq('id', ledger.id);
         setLedgers(ledgers.map(l => l.id === ledger.id ? { ...l, qty_growing: newGrowing, qty_planted: newPlanted, journal: updatedJournal } : l));
       }
    }

    const { error } = await supabase.from('field_plantings').delete().eq('id', editingPlanting.id);
    if (!error) {
      setPlantings(plantings.filter(p => p.id !== editingPlanting.id));
      setEditingPlanting(null);
    } else { alert("Failed to delete planting: " + error.message); }
  };

  const getIrrigationIcon = (type?: string) => {
    if (type?.includes('SIP')) return '💧';
    if (type?.includes('Olla')) return '🏺';
    if (type?.includes('Drip')) return '🚿';
    return '🚰';
  };

  const activeArea = areas.find(a => a.id === activeAreaId);
  const activeAreaBeds = beds.filter(b => b.area_id === activeAreaId);

  return (
    <main className="min-h-screen bg-stone-100 text-stone-900 pb-32 font-sans relative">
      <header className="bg-stone-900 text-white p-4 shadow-md sticky top-0 z-20 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => handleGoBack('dashboard')} className="p-2 bg-stone-800 rounded-full hover:bg-stone-700 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button onClick={() => navigateTo('dashboard')} className="p-2 bg-stone-800 rounded-full hover:bg-stone-700 transition-colors" title="Dashboard">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
            </button>
            <h1 className="text-xl font-bold">Farm Map</h1>
          </div>
          <button onClick={() => openAreaModal()} className="px-3 py-1.5 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-sm hover:bg-emerald-500 transition-colors">
            + Add Area
          </button>
        </div>
        
        {/* AREA TABS */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {areas.map(area => (
            <button 
              key={area.id} 
              onClick={() => { setActiveAreaId(area.id); setViewingBed(null); }}
              className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors ${activeAreaId === area.id ? 'bg-white text-stone-900 shadow-sm' : 'bg-stone-800 text-stone-300 hover:bg-stone-700'}`}
            >
              {area.name}
            </button>
          ))}
        </div>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-20 text-stone-400">
           <svg className="w-10 h-10 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        </div>
      ) : activeArea ? (
        <div className="p-4 flex flex-col h-[calc(100vh-140px)] max-w-6xl mx-auto">
          {/* MAP TOGGLE CONTROLS */}
          <div className="flex justify-between items-center bg-white p-2 sm:p-3 rounded-2xl shadow-sm border border-stone-200 mb-4 shrink-0 overflow-x-auto scrollbar-hide gap-4">
             <div className="flex items-center gap-2 shrink-0">
               <button onClick={() => openAreaModal(activeArea)} className="p-2 bg-stone-100 rounded-lg text-stone-500 hover:text-emerald-600 transition-colors" title="Edit Area"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
               <button onClick={() => openBedModal()} className="text-[10px] font-black uppercase tracking-widest text-stone-600 bg-stone-100 border border-stone-200 px-3 py-2 rounded-lg hover:bg-stone-200 transition-colors shadow-sm whitespace-nowrap">+ Add Bed</button>
             </div>
             
             <div className="flex bg-stone-100 p-1 rounded-xl shrink-0">
               <button onClick={() => setMapMode('CROP')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${mapMode === 'CROP' ? 'bg-white text-emerald-700 shadow-sm border border-stone-200' : 'text-stone-400 hover:text-stone-600'}`}>🌱 Crops</button>
               <button onClick={() => setMapMode('NUTRIENT')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${mapMode === 'NUTRIENT' ? 'bg-white text-purple-700 shadow-sm border border-stone-200' : 'text-stone-400 hover:text-stone-600'}`}>🧪 Nutrients</button>
               <button onClick={() => setMapMode('LAYOUT')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${mapMode === 'LAYOUT' ? 'bg-white text-amber-700 shadow-sm border border-stone-200' : 'text-stone-400 hover:text-stone-600'}`}>📐 Layout</button>
             </div>
          </div>

          {/* THE SPATIAL MAP */}
          <div className="flex-1 bg-stone-200 rounded-3xl border border-stone-300 shadow-inner overflow-auto relative">
             <div className="relative bg-[radial-gradient(#a8a29e_1px,transparent_1px)] m-8 border-4 border-stone-400 border-dashed rounded-xl shadow-lg" 
                  style={{ width: ((activeArea as any).width || 50) * GRID_SIZE, height: ((activeArea as any).length || 50) * GRID_SIZE, backgroundSize: '20px 20px', touchAction: mapMode === 'LAYOUT' ? 'none' : 'auto' }}>
                
                <div className="absolute -top-6 left-0 text-stone-400 font-black tracking-widest uppercase text-xs">
                  {activeArea.name} Fence Line ({((activeArea as any).width || 50)}x{((activeArea as any).length || 50)} {((activeArea as any).unit || 'ft')})
                </div>

                {activeAreaBeds.map((bed: any) => {
                   const bedPlantings = plantings.filter(p => p.bed_id === bed.id);
                   const isDragging = dragState?.id === bed.id;
                   
                   const w = (bed.width || 4) * GRID_SIZE;
                   const h = (bed.length || 8) * GRID_SIZE;
                   const x = (bed.pos_x || 0) * GRID_SIZE;
                   const y = (bed.pos_y || 0) * GRID_SIZE;

                   // Dynamic Coloring based on Map Mode
                   let bedBg = 'bg-amber-800/80';
                   let bedBorder = 'border-amber-900/60';
                   let bedText = 'text-amber-100';

                   if (mapMode === 'NUTRIENT') {
                       if (bed.feed_frequency_days) {
                           if (!bed.last_fed_date) {
                               bedBg = 'bg-red-500/90'; bedBorder = 'border-red-700'; bedText = 'text-red-100';
                           } else {
                               const lastFed = new Date(bed.last_fed_date + 'T12:00:00');
                               const diffDays = Math.round((new Date().getTime() - lastFed.getTime()) / (1000*60*60*24));
                               if (diffDays >= bed.feed_frequency_days) { bedBg = 'bg-red-500/90'; bedBorder = 'border-red-700'; bedText = 'text-red-100'; }
                               else if (diffDays >= bed.feed_frequency_days - 2) { bedBg = 'bg-amber-400/90'; bedBorder = 'border-amber-600'; bedText = 'text-amber-900'; }
                               else { bedBg = 'bg-emerald-500/90'; bedBorder = 'border-emerald-700'; bedText = 'text-emerald-100'; }
                           }
                       } else {
                           bedBg = 'bg-stone-400/80'; bedBorder = 'border-stone-500'; bedText = 'text-stone-100';
                       }
                   }

                   return (
                     <div 
                        key={bed.id}
                        onPointerDown={(e) => handlePointerDown(e, bed)}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                        className={`absolute rounded-md border-2 overflow-hidden flex flex-col items-center justify-center p-1 
                          ${mapMode === 'LAYOUT' ? 'cursor-move' : 'cursor-pointer hover:border-emerald-400 hover:shadow-[0_0_15px_rgba(16,185,129,0.4)]'} 
                          ${isDragging ? 'border-emerald-500 bg-emerald-100/80 shadow-2xl scale-105 z-50' : `${bedBorder} ${bedBg} shadow-md z-10`}
                          transition-colors`}
                        style={{ width: w, height: h, left: x, top: y, touchAction: 'none' }}
                     >
                        <span className={`text-[10px] font-black text-center leading-tight tracking-tight w-full px-1 drop-shadow-md break-words line-clamp-3 ${isDragging ? 'text-emerald-900' : bedText}`}>
                          {bed.name}
                        </span>
                        
                        {mapMode === 'CROP' && bedPlantings.length > 0 && (
                           <div className="flex flex-wrap items-center justify-center gap-0.5 mt-1">
                             {bedPlantings.map(p => (
                               <span key={p.id} className="text-xs" title={p.seed?.variety_name}>🌱</span>
                             ))}
                           </div>
                        )}
                        {mapMode === 'NUTRIENT' && bed.feed_frequency_days && (
                           <div className="mt-1 text-[8px] font-black uppercase tracking-widest bg-black/30 text-white px-1.5 rounded">
                             {bed.current_stage || 'VEG'}
                           </div>
                        )}
                     </div>
                   );
                })}
             </div>
          </div>
          {mapMode === 'LAYOUT' && (
             <div className="bg-amber-100 text-amber-800 text-xs font-bold text-center p-2 rounded-xl mt-3 animate-pulse border border-amber-200 shrink-0">
               Drag and drop beds to arrange them! (1 grid square = 1 {((activeArea as any).unit || 'ft')})
             </div>
          )}
          {mapMode === 'NUTRIENT' && (
             <div className="flex justify-center gap-4 text-[10px] font-black uppercase tracking-widest mt-3 shrink-0">
               <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-emerald-500"></div> Fed</span>
               <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-amber-400"></div> Due Soon</span>
               <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-red-500"></div> Hungry</span>
             </div>
          )}
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-3xl border border-stone-200 shadow-sm max-w-xl mx-auto m-4">
           <h2 className="text-lg font-black text-stone-800">Your map is empty</h2>
           <button onClick={() => openAreaModal()} className="mt-4 px-6 py-3 bg-stone-900 text-white font-black uppercase tracking-widest rounded-xl shadow-md hover:bg-stone-800 transition-transform active:scale-95">Create First Area</button>
        </div>
      )}

      {/* BED VIEWING DETAILS MODAL (Slide Over) */}
      {viewingBed && (() => {
         const bedPlantings = plantings.filter(p => p.bed_id === viewingBed.id);
         const hasDims = viewingBed.length && viewingBed.width;
         const areaSq = hasDims ? (viewingBed.length! * viewingBed.width!) : null;

         let daysUntilFeed = 0;
         let feedStatusText = 'No schedule set';
         if ((viewingBed as any).feed_frequency_days) {
             if (!(viewingBed as any).last_fed_date) feedStatusText = 'NEVER FED (Overdue)';
             else {
                 const lastFed = new Date((viewingBed as any).last_fed_date + 'T12:00:00');
                 const diffDays = Math.round((new Date().getTime() - lastFed.getTime()) / (1000*60*60*24));
                 daysUntilFeed = (viewingBed as any).feed_frequency_days - diffDays;
                 if (daysUntilFeed < 0) feedStatusText = `OVERDUE (${Math.abs(daysUntilFeed)} days)`;
                 else if (daysUntilFeed === 0) feedStatusText = 'DUE TODAY';
                 else feedStatusText = `Due in ${daysUntilFeed} days`;
             }
         }

         return (
          <div className="fixed inset-0 z-40 bg-stone-900/60 backdrop-blur-sm flex justify-end">
            <div className="bg-stone-50 w-full max-w-md h-full shadow-2xl flex flex-col animate-in slide-in-from-right-8 duration-300">
               
               <div className="bg-stone-900 p-5 shrink-0 relative">
                  <button onClick={() => setViewingBed(null)} className="absolute top-4 right-4 p-2 bg-stone-800 text-stone-300 hover:text-white rounded-full">
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                  <h2 className="text-2xl font-black text-white leading-tight pr-10">{viewingBed.name}</h2>
                  <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mt-1">{viewingBed.type}</p>
                  
                  <div className="flex flex-wrap gap-2 mt-4">
                     <span className="bg-blue-900/50 text-blue-200 border border-blue-700/50 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded shadow-sm flex items-center gap-1">
                        {getIrrigationIcon(viewingBed.irrigation_type)} {viewingBed.irrigation_type}
                     </span>
                     {hasDims && (
                        <span className="bg-stone-800 text-stone-300 border border-stone-700 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded shadow-sm">
                           📐 {viewingBed.length}x{viewingBed.width} {viewingBed.unit} ({areaSq} sq {viewingBed.unit})
                        </span>
                     )}
                  </div>
               </div>

               <div className="flex-1 overflow-y-auto p-4 space-y-6">
                  {/* FEEDING STATUS WIDGET */}
                  {(viewingBed as any).feed_frequency_days && (
                    <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm flex flex-col gap-3">
                       <div className="flex justify-between items-start border-b border-stone-100 pb-3">
                          <div>
                            <span className="text-[9px] font-black uppercase tracking-widest text-stone-400">Nutrient Status</span>
                            <div className={`text-sm font-black mt-0.5 ${daysUntilFeed <= 0 ? 'text-red-600' : daysUntilFeed <= 2 ? 'text-amber-600' : 'text-emerald-600'}`}>
                               {feedStatusText}
                            </div>
                          </div>
                          <div className="text-right">
                             <span className="text-[9px] font-black uppercase tracking-widest text-stone-400">Current Stage</span>
                             <div className="text-sm font-black text-purple-700 mt-0.5">{(viewingBed as any).current_stage}</div>
                          </div>
                       </div>
                       <button onClick={handleLogFeedToday} className="w-full py-3 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-xl text-xs font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 border border-purple-200">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg> Log Feeding Today
                       </button>
                    </div>
                  )}

                  <div>
                    <div className="flex justify-between items-center mb-3">
                       <h3 className="text-xs font-black uppercase tracking-widest text-stone-400">Planted Crops</h3>
                       <button onClick={() => { setViewingBed(null); openPlantOutModal(viewingBed); }} className="px-3 py-1.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-lg text-[9px] font-black uppercase tracking-widest transition-colors shadow-sm border border-emerald-200">
                          + Plant New
                       </button>
                    </div>

                    {bedPlantings.length === 0 ? (
                       <div className="bg-white p-8 rounded-2xl border border-stone-200 text-center shadow-sm">
                          <span className="text-3xl mb-2 block opacity-50">🌱</span>
                          <p className="text-sm font-bold text-stone-600">Bed is currently empty.</p>
                       </div>
                    ) : (
                       <div className="space-y-3">
                          {bedPlantings.map(plant => (
                             <div key={plant.id} onClick={() => openEditPlantingModal(plant)} className="flex items-center gap-4 bg-white p-3 rounded-2xl border border-stone-200 shadow-sm hover:border-emerald-400 cursor-pointer transition-colors group">
                                <div className={`font-black text-sm w-12 h-12 rounded-xl flex items-center justify-center border shadow-inner
                                   ${plant.status === 'Growing' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                                   plant.status === 'Harvesting' ? 'bg-purple-50 text-purple-700 border-purple-200' : 
                                   plant.status === 'Failed' ? 'bg-red-50 text-red-700 border-red-200' : 
                                   'bg-stone-100 text-stone-600 border-stone-300'}`}
                                >
                                   {plant.qty_planted}
                                </div>
                                <div className="flex-1 min-w-0">
                                   <p className="text-base font-bold text-stone-800 truncate group-hover:text-emerald-700 transition-colors">{plant.seed?.variety_name || 'Unknown'}</p>
                                   <p className="text-[10px] text-stone-400 uppercase tracking-widest mt-0.5">Planted {new Date(plant.plant_date).toLocaleDateString()} • {plant.status}</p>
                                </div>
                                <svg className="w-5 h-5 text-stone-300 group-hover:text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                             </div>
                          ))}
                       </div>
                    )}
                  </div>
               </div>

               <div className="p-4 bg-white border-t border-stone-200 shrink-0">
                  <button onClick={() => { setViewingBed(null); openBedModal(viewingBed); }} className="w-full py-4 bg-stone-100 text-stone-700 rounded-xl font-black uppercase tracking-widest hover:bg-stone-200 transition-colors border border-stone-200">
                     Edit Bed Settings
                  </button>
               </div>
            </div>
          </div>
         );
      })()}

      {/* CREATE/EDIT AREA MODAL */}
      {isAreaModalOpen && (
        <div className="fixed inset-0 z-[60] bg-stone-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-stone-100 p-4 border-b border-stone-200 flex justify-between items-center">
              <h2 className="font-black text-stone-800 tracking-tight">{areaForm.id ? 'Edit Area' : 'Create Area'}</h2>
              <button onClick={() => setIsAreaModalOpen(false)} className="p-1 rounded-full text-stone-400 hover:bg-stone-200 hover:text-stone-800">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Area Name</label>
                <input type="text" autoFocus value={areaForm.name} onChange={(e) => setAreaForm({...areaForm, name: e.target.value})} placeholder="e.g., High Tunnel, Front Yard" className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 font-bold outline-none focus:border-emerald-500 shadow-inner" />
              </div>
              
              <div className="bg-stone-50 p-4 rounded-xl border border-stone-200">
                <label className="block text-[10px] font-black text-stone-500 uppercase tracking-widest mb-3">Area Dimensions</label>
                <div className="flex items-center gap-2">
                  <input type="number" min="10" value={areaForm.width} onChange={(e) => setAreaForm({...areaForm, width: Number(e.target.value)})} placeholder="Width" className="w-full text-center bg-white border border-stone-200 rounded-lg p-2 font-bold outline-none focus:border-emerald-500 shadow-sm" />
                  <span className="text-stone-400 font-black text-xs">X</span>
                  <input type="number" min="10" value={areaForm.length} onChange={(e) => setAreaForm({...areaForm, length: Number(e.target.value)})} placeholder="Length" className="w-full text-center bg-white border border-stone-200 rounded-lg p-2 font-bold outline-none focus:border-emerald-500 shadow-sm" />
                  <select value={areaForm.unit} onChange={e => setAreaForm({...areaForm, unit: e.target.value})} className="bg-stone-200 text-stone-700 font-bold border-none rounded-lg p-2 outline-none appearance-none cursor-pointer">
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              <button onClick={handleSaveArea} disabled={!areaForm.name.trim()} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black uppercase tracking-widest shadow-xl shadow-emerald-900/20 active:scale-95 transition-all mt-2 disabled:opacity-50">
                Save Area
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE/EDIT BED MODAL */}
      {isBedModalOpen && (
        <div className="fixed inset-0 z-[60] bg-stone-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-emerald-50 p-4 border-b border-emerald-100 flex justify-between items-center shrink-0">
              <h2 className="font-black text-emerald-900 tracking-tight">{bedForm.id ? 'Edit Growing Bed' : 'Add Growing Bed'}</h2>
              <button onClick={() => setIsBedModalOpen(false)} className="p-1 rounded-full text-emerald-600 hover:bg-emerald-200">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="p-5 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* SECTION: BASIC IDENTITY */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-stone-400 uppercase tracking-widest border-b border-stone-200 pb-1">1. Identity & Structure</h3>
                <div>
                  <label className="block text-[10px] font-black text-stone-500 uppercase tracking-widest mb-1.5 ml-1">Bed/Container Name</label>
                  <input type="text" value={bedForm.name || ''} onChange={(e) => setBedForm({...bedForm, name: e.target.value})} placeholder="e.g., Raised Bed 1, SIP Row A" className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 font-bold outline-none focus:border-emerald-500 shadow-inner" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black text-stone-500 uppercase tracking-widest mb-1.5 ml-1">Bed Type</label>
                    <select value={bedForm.type} onChange={e => setBedForm({...bedForm, type: e.target.value})} className="w-full bg-white border border-stone-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-emerald-500 shadow-sm appearance-none">
                      {BED_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-stone-500 uppercase tracking-widest mb-1.5 ml-1">Dimensions</label>
                    <div className="flex items-center gap-1 bg-white border border-stone-200 rounded-xl p-2 shadow-sm">
                      <input type="number" value={bedForm.width || ''} onChange={(e) => setBedForm({...bedForm, width: Number(e.target.value)})} className="w-full text-center font-bold outline-none" />
                      <span className="text-stone-400 text-xs">x</span>
                      <input type="number" value={bedForm.length || ''} onChange={(e) => setBedForm({...bedForm, length: Number(e.target.value)})} className="w-full text-center font-bold outline-none" />
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION: WATERING */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-widest border-b border-blue-100 pb-1">2. Irrigation</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black text-stone-500 uppercase tracking-widest mb-1.5 ml-1">Setup Type</label>
                    <select value={bedForm.irrigation_type} onChange={e => setBedForm({...bedForm, irrigation_type: e.target.value})} className="w-full bg-white border border-stone-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-blue-500 shadow-sm appearance-none">
                      {IRRIGATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-stone-500 uppercase tracking-widest mb-1.5 ml-1">Watering Frequency</label>
                    <div className="relative">
                      <input type="number" min="1" value={bedForm.watering_frequency_days || ''} onChange={(e) => setBedForm({...bedForm, watering_frequency_days: Number(e.target.value)})} className="w-full bg-white border border-stone-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-blue-500 shadow-sm" />
                      <span className="absolute right-4 top-3 text-stone-400 font-bold pointer-events-none">Days</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION: NUTRITION */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-purple-400 uppercase tracking-widest border-b border-purple-100 pb-1">3. Nutrition & Feeding Profile</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black text-stone-500 uppercase tracking-widest mb-1.5 ml-1">Current Life Stage</label>
                    <select value={(bedForm as any).current_stage || 'Vegetative'} onChange={e => setBedForm({...bedForm, current_stage: e.target.value} as any)} className="w-full bg-purple-50 text-purple-900 border border-purple-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-purple-500 shadow-sm appearance-none">
                      <option value="Vegetative">Vegetative</option>
                      <option value="Flowering/Fruiting">Flowering/Fruiting</option>
                      <option value="Dormant">Dormant</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-stone-500 uppercase tracking-widest mb-1.5 ml-1">Feeding Frequency</label>
                    <div className="relative">
                      <input type="number" min="1" value={(bedForm as any).feed_frequency_days || ''} onChange={(e) => setBedForm({...bedForm, feed_frequency_days: Number(e.target.value)} as any)} className="w-full bg-white border border-stone-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-purple-500 shadow-sm" />
                      <span className="absolute right-4 top-3 text-stone-400 font-bold pointer-events-none">Days</span>
                    </div>
                  </div>
                </div>

                <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-4 shadow-inner">
                   <div>
                     <label className="block text-[10px] font-black text-stone-500 uppercase tracking-widest mb-1.5 ml-1">Drench Volume (Per Feed)</label>
                     <div className="relative">
                       <input type="number" min="0.1" step="0.1" value={(bedForm as any).drench_volume_gallons || ''} onChange={(e) => setBedForm({...bedForm, drench_volume_gallons: Number(e.target.value)} as any)} className="w-full bg-white border border-stone-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-purple-500 shadow-sm" />
                       <span className="absolute right-4 top-3 text-stone-400 font-bold pointer-events-none">Gallons</span>
                     </div>
                     <p className="text-[9px] text-stone-500 mt-1 ml-1">The total amount of liquid fertilizer mixture required to cover this bed.</p>
                   </div>
                   
                   <div className="grid grid-cols-1 gap-3 pt-2 border-t border-stone-200">
                     <div>
                       <label className="block text-[10px] font-black text-stone-500 uppercase tracking-widest mb-1.5 ml-1">Vegetative Recipe</label>
                       <select value={(bedForm as any).recipe_veg_id || ''} onChange={e => setBedForm({...bedForm, recipe_veg_id: e.target.value} as any)} className="w-full bg-white border border-stone-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-purple-500 shadow-sm appearance-none">
                         <option value="">-- None Selected --</option>
                         {recipes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                       </select>
                     </div>
                     <div>
                       <label className="block text-[10px] font-black text-stone-500 uppercase tracking-widest mb-1.5 ml-1">Bloom/Fruiting Recipe</label>
                       <select value={(bedForm as any).recipe_bloom_id || ''} onChange={e => setBedForm({...bedForm, recipe_bloom_id: e.target.value} as any)} className="w-full bg-white border border-stone-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-purple-500 shadow-sm appearance-none">
                         <option value="">-- None Selected --</option>
                         {recipes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                       </select>
                     </div>
                   </div>
                </div>
              </div>

              <div className="pt-2">
                <button onClick={handleSaveBed} disabled={!bedForm.name?.trim()} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black uppercase tracking-widest shadow-xl shadow-emerald-900/20 active:scale-95 transition-all disabled:opacity-50">
                  Save Bed
                </button>
                {bedForm.id && (
                  <button onClick={() => handleDeleteBed(bedForm.id!)} className="w-full py-3 mt-3 bg-red-50 text-red-600 font-bold rounded-xl border border-red-200 hover:bg-red-100 transition-colors">
                    Delete Bed Permanently
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PLANT OUT MODAL (Move from Ledger to Bed) */}
      {isPlantOutModalOpen && selectedBedForPlanting && (
        <div className="fixed inset-0 z-[60] bg-stone-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="bg-emerald-800 p-4 border-b border-emerald-900 flex justify-between items-center shrink-0">
              <div>
                <h2 className="font-black text-white tracking-tight flex items-center gap-2">🌱 Plant Out</h2>
                <p className="text-[10px] font-bold text-emerald-300 uppercase tracking-widest mt-0.5">Dest: {selectedBedForPlanting.name}</p>
              </div>
              <button onClick={() => setIsPlantOutModalOpen(false)} className="p-1 rounded-full text-emerald-300 hover:bg-emerald-700 hover:text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="p-5 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Select Seedling from Nursery</label>
                <select value={plantOutForm.ledgerId} onChange={e => setPlantOutForm({...plantOutForm, ledgerId: e.target.value})} className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm font-bold text-stone-800 outline-none focus:border-emerald-500 shadow-inner">
                  <option value="">-- Choose Plant --</option>
                  {ledgers.filter(l => availableCalc(l) > 0).map(l => (
                    <option key={l.id} value={l.id}>{l.seed?.variety_name || 'Unknown'} (Avail: {availableCalc(l)})</option>
                  ))}
                </select>
              </div>

              {plantOutForm.ledgerId && (
                <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2">
                  <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 text-center">
                    <span className="block text-[9px] font-black uppercase tracking-widest text-stone-400 mb-1">Qty to Plant</span>
                    <input type="number" min="1" max={availableCalc(ledgers.find(l => l.id === plantOutForm.ledgerId)!)} value={plantOutForm.qty} onChange={(e) => setPlantOutForm({...plantOutForm, qty: Number(e.target.value)})} className="w-full text-center bg-transparent text-xl font-black text-emerald-600 outline-none border-b border-stone-300 focus:border-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-stone-400 uppercase tracking-widest mb-1 ml-1 text-center">Plant Date</label>
                    <input type="date" value={plantOutForm.date} onChange={(e) => setPlantOutForm({...plantOutForm, date: e.target.value})} className="w-full bg-white border border-stone-200 rounded-xl p-2.5 text-xs font-bold outline-none focus:border-emerald-500 shadow-sm" />
                  </div>
                </div>
              )}

              <button onClick={handlePlantOutSubmit} disabled={!plantOutForm.ledgerId || plantOutForm.qty < 1 || isSubmittingPlantOut} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black uppercase tracking-widest shadow-xl shadow-emerald-900/20 active:scale-95 transition-all mt-4 disabled:opacity-50">
                {isSubmittingPlantOut ? 'Moving...' : 'Move to Bed'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MANAGE PLANTING MODAL (Edit Status / Yield / Delete) */}
      {editingPlanting && (
        <div className="fixed inset-0 z-[60] bg-stone-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            <div className="bg-stone-100 p-4 border-b border-stone-200 flex justify-between items-center shrink-0">
              <div>
                <h2 className="font-black text-stone-800 tracking-tight flex items-center gap-2">Manage Crop</h2>
                <p className="text-[10px] font-bold text-stone-500 uppercase tracking-widest mt-0.5">{editingPlanting.seed?.variety_name}</p>
              </div>
              <button onClick={() => setEditingPlanting(null)} className="p-1 rounded-full text-stone-400 hover:bg-stone-200 hover:text-stone-800">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="p-5 space-y-5">
              <div>
                <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Crop Status</label>
                <select value={plantingForm.status} onChange={e => setPlantingForm({...plantingForm, status: e.target.value})} className="w-full bg-white border border-stone-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-emerald-500 shadow-sm appearance-none">
                  {PLANTING_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                <label className="block text-[10px] font-black text-purple-600 uppercase tracking-widest mb-3 text-center">Log Harvest Yields</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="block text-[9px] font-black uppercase tracking-widest text-purple-400 mb-1 text-center">Weight (Lbs)</span>
                    <input type="number" min="0" step="0.1" value={plantingForm.yield_lbs} onChange={e => setPlantingForm({...plantingForm, yield_lbs: Number(e.target.value)})} className="w-full text-center bg-white border border-purple-200 rounded-lg p-2 font-bold outline-none focus:border-purple-500 shadow-sm text-purple-900" />
                  </div>
                  <div>
                    <span className="block text-[9px] font-black uppercase tracking-widest text-purple-400 mb-1 text-center">Quantity Count</span>
                    <input type="number" min="0" value={plantingForm.yield_count} onChange={e => setPlantingForm({...plantingForm, yield_count: Number(e.target.value)})} className="w-full text-center bg-white border border-purple-200 rounded-lg p-2 font-bold outline-none focus:border-purple-500 shadow-sm text-purple-900" />
                  </div>
                </div>
              </div>

              <button onClick={handleUpdatePlanting} className="w-full py-4 bg-stone-800 text-white rounded-xl font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all mt-4 hover:bg-stone-700">
                Save Updates
              </button>

              <button onClick={handleDeletePlanting} className="w-full py-3 mt-2 bg-red-50 text-red-600 font-bold rounded-xl border border-red-200 hover:bg-red-100 transition-colors">
                Remove from Bed
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}