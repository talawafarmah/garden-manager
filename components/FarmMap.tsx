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
  const [activeSeason, setActiveSeason] = useState<Season | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Area Modals
  const [isAreaModalOpen, setIsAreaModalOpen] = useState(false);
  const [areaForm, setAreaForm] = useState<{ id?: string, name: string }>({ name: '' });

  // Bed Modals
  const [isBedModalOpen, setIsBedModalOpen] = useState(false);
  const [activeAreaId, setActiveAreaId] = useState<string>("");
  const [bedForm, setBedForm] = useState<Partial<GardenBed>>({ 
    name: '', 
    type: 'Raised Bed', 
    irrigation_type: 'Hand-water', 
    unit: 'ft',
    watering_frequency_days: 3 
  });

  // Planting Out Modal
  const [isPlantOutModalOpen, setIsPlantOutModalOpen] = useState(false);
  const [selectedBed, setSelectedBed] = useState<GardenBed | null>(null);
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

    const [areaRes, bedRes, plantRes, ledgerRes] = await Promise.all([
      supabase.from('garden_areas').select('*').order('created_at', { ascending: true }),
      supabase.from('garden_beds').select('*').order('created_at', { ascending: true }),
      supabase.from('field_plantings').select('*, seed:seed_inventory(*)').order('plant_date', { ascending: false }),
      supabase.from('season_seedlings').select('*, seed:seed_inventory(*)').eq('season_id', currentSeason?.id || '')
    ]);

    if (areaRes.data) setAreas(areaRes.data);
    if (bedRes.data) setBeds(bedRes.data);
    if (plantRes.data) setPlantings(plantRes.data);
    if (ledgerRes.data) setLedgers(ledgerRes.data);
    
    setIsLoading(false);
  };

  const availableCalc = (l: SeasonSeedling) => Math.max(0, l.qty_growing - l.allocate_keep - l.allocate_reserve);

  // --- AREA CRUD ---
  const openAreaModal = (area?: GardenArea) => {
    setAreaForm(area ? { id: area.id, name: area.name } : { name: '' });
    setIsAreaModalOpen(true);
  };

  const handleSaveArea = async () => {
    if (!areaForm.name.trim()) return;
    
    if (areaForm.id) {
      const { data, error } = await supabase.from('garden_areas').update({ name: areaForm.name.trim() }).eq('id', areaForm.id).select().single();
      if (data) {
        setAreas(areas.map(a => a.id === areaForm.id ? data : a));
        setIsAreaModalOpen(false);
      } else { alert("Error updating area: " + error?.message); }
    } else {
      const { data, error } = await supabase.from('garden_areas').insert([{ name: areaForm.name.trim() }]).select().single();
      if (data) {
        setAreas([...areas, data]);
        setIsAreaModalOpen(false);
      } else { alert("Error adding area: " + error?.message); }
    }
  };

  const handleDeleteArea = async (id: string) => {
    if (confirm("Are you sure you want to delete this entire area? This will delete ALL beds and plantings inside it permanently!")) {
      const { error } = await supabase.from('garden_areas').delete().eq('id', id);
      if (!error) {
        setAreas(areas.filter(a => a.id !== id));
      } else { alert("Error deleting area: " + error.message); }
    }
  };

  // --- BED CRUD ---
  const openBedModal = (areaId: string, bed?: GardenBed) => {
    setActiveAreaId(areaId);
    if (bed) {
      setBedForm({ ...bed, watering_frequency_days: bed.watering_frequency_days || 3 });
    } else {
      setBedForm({ name: '', type: 'Raised Bed', irrigation_type: 'Hand-water', unit: 'ft', watering_frequency_days: 3 });
    }
    setIsBedModalOpen(true);
  };

  const handleSaveBed = async () => {
    if (!bedForm.name?.trim() || !activeAreaId) return;
    const payload = { ...bedForm, area_id: activeAreaId, name: bedForm.name.trim() };
    
    if (bedForm.id) {
      const { data, error } = await supabase.from('garden_beds').update(payload).eq('id', bedForm.id).select().single();
      if (data) {
        setBeds(beds.map(b => b.id === bedForm.id ? data : b));
        setIsBedModalOpen(false);
      } else { alert("Error updating bed: " + error?.message); }
    } else {
      const { data, error } = await supabase.from('garden_beds').insert([payload]).select().single();
      if (data) {
        setBeds([...beds, data]);
        setIsBedModalOpen(false);
      } else { alert("Error adding bed: " + error?.message); }
    }
  };

  const handleDeleteBed = async (id: string) => {
    if (confirm("Delete this bed? This will delete all plantings currently assigned to it.")) {
      const { error } = await supabase.from('garden_beds').delete().eq('id', id);
      if (!error) {
        setBeds(beds.filter(b => b.id !== id));
        setIsBedModalOpen(false);
      } else { alert("Error deleting bed: " + error.message); }
    }
  };

  // --- PLANTING OUT WORKFLOW ---
  const openPlantOutModal = (bed: GardenBed) => {
    setSelectedBed(bed);
    const todayObj = new Date();
    const localToday = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
    setPlantOutForm({ ledgerId: '', qty: 1, date: localToday });
    setIsPlantOutModalOpen(true);
  };

  const handlePlantOutSubmit = async () => {
    if (!selectedBed || !plantOutForm.ledgerId || plantOutForm.qty < 1 || !activeSeason) return;
    setIsSubmittingPlantOut(true);

    try {
      const ledger = ledgers.find(l => l.id === plantOutForm.ledgerId);
      if (!ledger || !ledger.seed) throw new Error("Could not find source ledger.");

      const { data: newPlanting, error: plantError } = await supabase.from('field_plantings').insert([{
        bed_id: selectedBed.id,
        seed_id: ledger.seed_id,
        season_id: activeSeason.id,
        plant_date: plantOutForm.date,
        qty_planted: plantOutForm.qty,
        status: 'Growing'
      }]).select('*, seed:seed_inventory(*)').single();

      if (plantError) throw new Error("Planting Error: " + plantError.message);

      const newGrowing = Math.max(0, ledger.qty_growing - plantOutForm.qty);
      const newPlanted = ledger.qty_planted + plantOutForm.qty;
      const journalEntry: SeedlingJournalEntry = {
        id: window.crypto.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).substring(2),
        date: plantOutForm.date,
        type: 'EVENT',
        note: `Transplanted ${plantOutForm.qty} to ${selectedBed.name}.`
      };
      const updatedJournal = [journalEntry, ...(ledger.journal || [])];

      await supabase.from('season_seedlings').update({
        qty_growing: newGrowing,
        qty_planted: newPlanted,
        journal: updatedJournal
      }).eq('id', ledger.id);

      setPlantings([newPlanting, ...plantings]);
      setLedgers(ledgers.map(l => l.id === ledger.id ? { ...l, qty_growing: newGrowing, qty_planted: newPlanted, journal: updatedJournal } : l));
      
      setIsPlantOutModalOpen(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmittingPlantOut(false);
    }
  };

  // --- MANAGE PLANTING CRUD ---
  const openEditPlantingModal = (planting: FieldPlanting) => {
    setEditingPlanting(planting);
    setPlantingForm({ status: planting.status, yield_lbs: planting.yield_lbs || 0, yield_count: planting.yield_count || 0 });
  };

  const handleUpdatePlanting = async () => {
    if (!editingPlanting) return;
    const { data, error } = await supabase.from('field_plantings').update({
      status: plantingForm.status,
      yield_lbs: plantingForm.yield_lbs,
      yield_count: plantingForm.yield_count
    }).eq('id', editingPlanting.id).select('*, seed:seed_inventory(*)').single();

    if (data && !error) {
      setPlantings(plantings.map(p => p.id === editingPlanting.id ? data : p));
      setEditingPlanting(null);
    } else {
      alert("Failed to update: " + error?.message);
    }
  };

  const handleDeletePlanting = async () => {
    if (!editingPlanting) return;
    const revertToLedger = confirm("Do you want to return these plants to the Nursery Ledger? (Click OK to return to nursery, or Cancel to just delete them forever).");

    if (revertToLedger) {
       // Revert logic
       const ledger = ledgers.find(l => l.seed_id === editingPlanting.seed_id && l.season_id === editingPlanting.season_id);
       if (ledger) {
         const newGrowing = ledger.qty_growing + editingPlanting.qty_planted;
         const newPlanted = Math.max(0, ledger.qty_planted - editingPlanting.qty_planted);
         const journalEntry: SeedlingJournalEntry = {
            id: window.crypto.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).substring(2),
            date: new Date().toISOString().split('T')[0],
            type: 'EVENT',
            note: `Reverted ${editingPlanting.qty_planted} back from field map.`
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

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900 pb-32 font-sans relative">
      <header className="bg-stone-900 text-white p-4 shadow-md sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => handleGoBack('dashboard')} className="p-2 bg-stone-800 rounded-full hover:bg-stone-700 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          {/* FIX: Explicit Home Button added here! */}
          <button onClick={() => navigateTo('dashboard')} className="p-2 bg-stone-800 rounded-full hover:bg-stone-700 transition-colors" title="Dashboard">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
          </button>
          <h1 className="text-xl font-bold">Farm Map</h1>
        </div>
        <button onClick={() => openAreaModal()} className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-black uppercase tracking-widest rounded-lg shadow-sm hover:bg-emerald-500 transition-colors flex items-center gap-1">
          + Area
        </button>
      </header>

      <div className="max-w-4xl mx-auto p-4 space-y-8 mt-4">
        {isLoading ? (
          <div className="flex justify-center py-20 text-stone-400">
             <svg className="w-10 h-10 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          </div>
        ) : areas.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-stone-200 shadow-sm max-w-xl mx-auto">
            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">🗺️</div>
            <h2 className="text-lg font-black text-stone-800">Your map is empty</h2>
            <p className="text-stone-500 text-sm mt-1 mb-6 max-w-sm mx-auto">Start by adding a high-level area (like "High Tunnel" or "Front Yard") and then build out your specific beds and containers inside it.</p>
            <button onClick={() => openAreaModal()} className="px-6 py-3 bg-stone-900 text-white font-black uppercase tracking-widest rounded-xl shadow-md hover:bg-stone-800 transition-transform active:scale-95">
              Create First Area
            </button>
          </div>
        ) : (
          areas.map(area => {
            const areaBeds = beds.filter(b => b.area_id === area.id);
            return (
              <section key={area.id} className="bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden">
                <div className="bg-stone-100 p-4 border-b border-stone-200 flex justify-between items-center gap-2">
                  <h2 className="font-black text-stone-800 text-lg flex items-center gap-2 min-w-0 truncate">
                    <span className="text-stone-400 shrink-0">📍</span> <span className="truncate">{area.name}</span>
                  </h2>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openAreaModal(area)} className="p-1.5 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors" title="Edit Area">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>
                    <button onClick={() => handleDeleteArea(area.id)} className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Delete Area">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                    <div className="w-px h-5 bg-stone-300 mx-1"></div>
                    <button onClick={() => openBedModal(area.id)} className="text-[10px] font-black uppercase tracking-widest text-stone-600 bg-white border border-stone-200 px-3 py-1.5 rounded-lg hover:bg-stone-50 transition-colors shadow-sm">
                      + Bed
                    </button>
                  </div>
                </div>
                
                <div className="p-4 bg-stone-50/50">
                  {areaBeds.length === 0 ? (
                    <p className="text-sm text-stone-400 italic text-center py-4">No beds added to this area yet.</p>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {areaBeds.map(bed => {
                        const bedPlantings = plantings.filter(p => p.bed_id === bed.id);
                        const hasDims = bed.length && bed.width;
                        const areaSq = hasDims ? (bed.length! * bed.width!) : null;
                        
                        return (
                          <div key={bed.id} className="bg-white border border-stone-200 rounded-2xl flex flex-col overflow-hidden shadow-sm hover:border-emerald-300 transition-colors group">
                            
                            {/* Bed Header */}
                            <div className="p-4 border-b border-stone-100 relative bg-stone-50 flex justify-between items-start">
                              <div className="absolute top-0 right-0 p-3 opacity-10 text-5xl pointer-events-none group-hover:scale-110 transition-transform -translate-y-2 translate-x-2">
                                {bed.type.includes('SIP') ? '📦' : bed.type.includes('Tree') ? '🌳' : '🛏️'}
                              </div>
                              <div className="relative z-10 flex-1 min-w-0 pr-2">
                                <h3 className="font-black text-stone-800 text-lg leading-tight truncate">{bed.name}</h3>
                                <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest mt-0.5">{bed.type}</p>
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                  <span className="bg-blue-50 text-blue-700 border border-blue-100 text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded shadow-sm flex items-center gap-1">
                                    {getIrrigationIcon(bed.irrigation_type)} {bed.irrigation_type} ({bed.watering_frequency_days || 3}d)
                                  </span>
                                  {hasDims && (
                                    <span className="bg-stone-100 text-stone-600 border border-stone-200 text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded shadow-sm">
                                      📐 {bed.length}x{bed.width} {bed.unit} ({areaSq} sq {bed.unit})
                                    </span>
                                  )}
                                  {!hasDims && bed.dimensions && (
                                    <span className="bg-stone-100 text-stone-600 border border-stone-200 text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded shadow-sm">
                                      📐 {bed.dimensions}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <button onClick={() => openBedModal(area.id, bed)} className="p-1.5 bg-white border border-stone-200 text-stone-400 hover:text-emerald-600 hover:border-emerald-300 rounded-lg shadow-sm transition-colors relative z-10">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                              </button>
                            </div>

                            {/* Bed Contents */}
                            <div className="p-4 flex-1">
                               <div className="flex justify-between items-center mb-2">
                                 <h4 className="text-[9px] font-black uppercase tracking-widest text-stone-400">Actively Growing</h4>
                               </div>
                               {bedPlantings.length === 0 ? (
                                 <p className="text-xs text-stone-400 italic">Empty bed. Ready for planting.</p>
                               ) : (
                                 <div className="space-y-2">
                                   {bedPlantings.map(plant => (
                                      <div key={plant.id} onClick={() => openEditPlantingModal(plant)} className="flex items-center gap-3 bg-stone-50 p-2 rounded-lg border border-stone-100 hover:border-emerald-300 cursor-pointer transition-colors group/plant">
                                        <div className={`font-black text-xs px-2 py-1.5 rounded-md flex-shrink-0 min-w-[32px] text-center border shadow-sm
                                          ${plant.status === 'Growing' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 
                                            plant.status === 'Harvesting' ? 'bg-purple-100 text-purple-700 border-purple-200' : 
                                            plant.status === 'Failed' ? 'bg-red-100 text-red-700 border-red-200' : 
                                            'bg-stone-200 text-stone-600 border-stone-300'}`}
                                        >
                                          {plant.qty_planted}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-bold text-stone-800 truncate group-hover/plant:text-emerald-700 transition-colors">{plant.seed?.variety_name || 'Unknown'}</p>
                                          <p className="text-[9px] text-stone-400 uppercase tracking-widest mt-0.5">Planted {new Date(plant.plant_date).toLocaleDateString()} • {plant.status}</p>
                                        </div>
                                        <svg className="w-4 h-4 text-stone-300 group-hover/plant:text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                      </div>
                                   ))}
                                 </div>
                               )}
                            </div>

                            {/* Bed Actions */}
                            <div className="p-3 bg-stone-50 border-t border-stone-100 mt-auto">
                              <button onClick={() => openPlantOutModal(bed)} className="w-full py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-transform flex items-center justify-center gap-1.5 shadow-sm hover:bg-emerald-500">
                                🌱 Plant Out Here
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </section>
            );
          })
        )}
      </div>

      {/* CREATE/EDIT AREA MODAL */}
      {isAreaModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/80 backdrop-blur-sm flex items-center justify-center p-4">
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
              <button onClick={handleSaveArea} disabled={!areaForm.name.trim()} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black uppercase tracking-widest shadow-xl shadow-emerald-900/20 active:scale-95 transition-all mt-2 disabled:opacity-50">
                Save Area
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE/EDIT BED MODAL */}
      {isBedModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-emerald-50 p-4 border-b border-emerald-100 flex justify-between items-center">
              <h2 className="font-black text-emerald-900 tracking-tight">{bedForm.id ? 'Edit Growing Bed' : 'Add Growing Bed'}</h2>
              <button onClick={() => setIsBedModalOpen(false)} className="p-1 rounded-full text-emerald-600 hover:bg-emerald-200">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Bed/Container Name</label>
                <input type="text" autoFocus value={bedForm.name || ''} onChange={(e) => setBedForm({...bedForm, name: e.target.value})} placeholder="e.g., Raised Bed 1, SIP Row A" className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 font-bold outline-none focus:border-emerald-500 shadow-inner" />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Bed Type</label>
                  <select value={bedForm.type} onChange={e => setBedForm({...bedForm, type: e.target.value})} className="w-full bg-white border border-stone-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-emerald-500 shadow-sm appearance-none">
                    {BED_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Irrigation Setup</label>
                  <select value={bedForm.irrigation_type} onChange={e => setBedForm({...bedForm, irrigation_type: e.target.value})} className="w-full bg-white border border-stone-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-blue-500 shadow-sm appearance-none">
                    {IRRIGATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Watering Frequency (Days)</label>
                <div className="relative">
                  <input type="number" min="1" value={bedForm.watering_frequency_days || ''} onChange={(e) => setBedForm({...bedForm, watering_frequency_days: Number(e.target.value)})} placeholder="e.g., 3" className="w-full bg-white border border-stone-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-blue-500 shadow-sm" />
                  <span className="absolute right-4 top-3 text-stone-400 font-bold pointer-events-none">Days</span>
                </div>
              </div>

              <div className="bg-stone-50 p-4 rounded-xl border border-stone-200">
                <label className="block text-[10px] font-black text-stone-500 uppercase tracking-widest mb-3 text-center">Dimensions (Optional)</label>
                <div className="flex items-center gap-2">
                  <input type="number" min="0" value={bedForm.length || ''} onChange={(e) => setBedForm({...bedForm, length: Number(e.target.value)})} placeholder="Length" className="w-full text-center bg-white border border-stone-200 rounded-lg p-2 font-bold outline-none focus:border-emerald-500 shadow-sm" />
                  <span className="text-stone-400 font-black text-xs">X</span>
                  <input type="number" min="0" value={bedForm.width || ''} onChange={(e) => setBedForm({...bedForm, width: Number(e.target.value)})} placeholder="Width" className="w-full text-center bg-white border border-stone-200 rounded-lg p-2 font-bold outline-none focus:border-emerald-500 shadow-sm" />
                  <select value={bedForm.unit || 'ft'} onChange={e => setBedForm({...bedForm, unit: e.target.value})} className="bg-stone-200 text-stone-700 font-bold border-none rounded-lg p-2 outline-none appearance-none cursor-pointer">
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              <button onClick={handleSaveBed} disabled={!bedForm.name?.trim()} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black uppercase tracking-widest shadow-xl shadow-emerald-900/20 active:scale-95 transition-all mt-4 disabled:opacity-50">
                Save to Map
              </button>

              {bedForm.id && (
                <button onClick={() => handleDeleteBed(bedForm.id!)} className="w-full py-3 mt-2 bg-red-50 text-red-600 font-bold rounded-xl border border-red-200 hover:bg-red-100 transition-colors">
                  Delete Bed
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PLANT OUT MODAL (Move from Ledger to Bed) */}
      {isPlantOutModalOpen && selectedBed && (
        <div className="fixed inset-0 z-50 bg-stone-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="bg-emerald-800 p-4 border-b border-emerald-900 flex justify-between items-center shrink-0">
              <div>
                <h2 className="font-black text-white tracking-tight flex items-center gap-2">🌱 Plant Out</h2>
                <p className="text-[10px] font-bold text-emerald-300 uppercase tracking-widest mt-0.5">Dest: {selectedBed.name}</p>
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
                {ledgers.filter(l => availableCalc(l) > 0).length === 0 && (
                  <p className="text-[10px] text-red-500 font-bold mt-1 ml-1">No seedlings available in your current ledger.</p>
                )}
              </div>

              {plantOutForm.ledgerId && (
                <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2">
                  <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 text-center">
                    <span className="block text-[9px] font-black uppercase tracking-widest text-stone-400 mb-1">Qty to Plant</span>
                    <input 
                      type="number" 
                      min="1" 
                      max={availableCalc(ledgers.find(l => l.id === plantOutForm.ledgerId)!)}
                      value={plantOutForm.qty} 
                      onChange={(e) => setPlantOutForm({...plantOutForm, qty: Number(e.target.value)})} 
                      className="w-full text-center bg-transparent text-xl font-black text-emerald-600 outline-none border-b border-stone-300 focus:border-emerald-500" 
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-stone-400 uppercase tracking-widest mb-1 ml-1 text-center">Plant Date</label>
                    <input type="date" value={plantOutForm.date} onChange={(e) => setPlantOutForm({...plantOutForm, date: e.target.value})} className="w-full bg-white border border-stone-200 rounded-xl p-2.5 text-xs font-bold outline-none focus:border-emerald-500 shadow-sm" />
                  </div>
                </div>
              )}

              <button 
                onClick={handlePlantOutSubmit} 
                disabled={!plantOutForm.ledgerId || plantOutForm.qty < 1 || isSubmittingPlantOut} 
                className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black uppercase tracking-widest shadow-xl shadow-emerald-900/20 active:scale-95 transition-all mt-4 disabled:opacity-50"
              >
                {isSubmittingPlantOut ? 'Moving...' : 'Move to Bed'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MANAGE PLANTING MODAL (Edit Status / Yield / Delete) */}
      {editingPlanting && (
        <div className="fixed inset-0 z-50 bg-stone-900/80 backdrop-blur-sm flex items-center justify-center p-4">
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