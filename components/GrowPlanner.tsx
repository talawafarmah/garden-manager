import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Season, InventorySeed, AppView, SeedCategory } from '../types';

interface Props {
  categories: SeedCategory[];
  navigateTo: (view: AppView, payload?: any) => void;
  handleGoBack: (view: AppView) => void;
  userRole?: string;
}

interface GrowPlanRecord {
  id: string;
  season_id: string;
  seed_id: string;
  target_plant_date: string;
  planned_qty: number;
  sown_qty: number; // NEW: Tracking partial fulfillments
  indoor_start_date: string;
  seed?: InventorySeed;
}

interface DemandQueueItem {
  seed: InventorySeed;
  requested_qty: number;
}

const resolveNurseryWeeks = (seed: InventorySeed, categories: SeedCategory[]) => {
  if (seed.custom_nursery_weeks !== null && seed.custom_nursery_weeks !== undefined) return seed.custom_nursery_weeks;
  const cat = categories.find(c => c.name === seed.category);
  if (cat && cat.default_nursery_weeks !== null && cat.default_nursery_weeks !== undefined) return cat.default_nursery_weeks;
  return 4; 
};

const parseGermDays = (str?: string) => {
  if (!str) return 7;
  const nums = str.match(/\d+/g);
  if (nums) return Math.max(...nums.map(Number));
  return 7;
};

export default function GrowPlanner({ categories, navigateTo, handleGoBack, userRole }: Props) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [activeSeasonId, setActiveSeasonId] = useState<string | null>(null);
  const [inventory, setInventory] = useState<InventorySeed[]>([]);
  
  const [globalTargetDate, setGlobalTargetDate] = useState<string>(`${new Date().getFullYear()}-05-10`);
  
  const [plans, setPlans] = useState<GrowPlanRecord[]>([]);
  const [demandQueue, setDemandQueue] = useState<DemandQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Checkbox State for Bulk Actions
  const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>([]);
  const [showCompleted, setShowCompleted] = useState(false);

  // Manual Add State
  const [isManualAdding, setIsManualAdding] = useState(false);
  const [manualSearch, setManualSearch] = useState("");

  // Modal State
  const [activeModal, setActiveModal] = useState<'PLAN_SEED' | null>(null);
  const [editingItem, setEditingItem] = useState<DemandQueueItem | null>(null);
  const [formWeeks, setFormWeeks] = useState(6);
  const [formTargetDate, setFormTargetDate] = useState("");
  const [formQty, setFormQty] = useState(0);

  useEffect(() => {
    const fetchBaseData = async () => {
      const [{ data: seasonData }, { data: invData }] = await Promise.all([
        supabase.from('seasons').select('*').order('created_at', { ascending: false }),
        supabase.from('seed_inventory').select('*')
      ]);
      
      if (invData) setInventory(invData as InventorySeed[]);
      if (seasonData) {
        setSeasons(seasonData as Season[]);
        if (seasonData.length > 0 && !activeSeasonId) setActiveSeasonId(seasonData[0].id);
      }
    };
    fetchBaseData();
  }, []);

  useEffect(() => { if (activeSeasonId) fetchPlannerData(); }, [activeSeasonId]);

  const fetchPlannerData = async () => {
    setIsLoading(true);
    setSelectedPlanIds([]);
    try {
      const { data: planData } = await supabase.from('grow_plan').select('*, seed:seed_inventory(*)').eq('season_id', activeSeasonId);
      const currentPlans = (planData || []) as GrowPlanRecord[];
      setPlans(currentPlans);

      const plannedSeedIds = new Set(currentPlans.map(p => p.seed_id));
      const { data: sessions } = await supabase.from('wishlist_sessions').select('id').eq('season_id', activeSeasonId).not('submitted_at', 'is', null);
      const sessionIds = (sessions || []).map(s => s.id);
      
      if (sessionIds.length > 0) {
        const { data: selections } = await supabase.from('wishlist_selections').select('*, seed:seed_inventory(*)').in('session_id', sessionIds);
        const demandMap = new Map<string, DemandQueueItem>();
        (selections || []).forEach(sel => {
          if (sel.seed_id && sel.seed && !plannedSeedIds.has(sel.seed_id)) {
            if (demandMap.has(sel.seed_id)) demandMap.get(sel.seed_id)!.requested_qty += 1;
            else demandMap.set(sel.seed_id, { seed: sel.seed, requested_qty: 1 });
          }
        });
        setDemandQueue(Array.from(demandMap.values()).sort((a, b) => b.requested_qty - a.requested_qty));
      } else setDemandQueue([]);
    } catch (err) { console.error(err); } finally { setIsLoading(false); }
  };

  const calculateStartDate = (target: string, weeks: number, germStr?: string) => {
    const targetDate = new Date(target);
    const germDays = parseGermDays(germStr);
    targetDate.setDate(targetDate.getDate() - ((weeks * 7) + germDays));
    return targetDate.toISOString().split('T')[0];
  };

  // POINT 3: 1-Click Quick Add
  const handleQuickAdd = async (item: DemandQueueItem) => {
    if (!activeSeasonId) return;
    const weeks = resolveNurseryWeeks(item.seed, categories);
    const startDate = calculateStartDate(globalTargetDate, weeks, item.seed.germination_days);
    
    const payload = {
      season_id: activeSeasonId,
      seed_id: item.seed.id,
      target_plant_date: globalTargetDate,
      planned_qty: item.requested_qty,
      sown_qty: 0,
      indoor_start_date: startDate
    };

    const { data, error } = await supabase.from('grow_plan').insert([payload]).select('*, seed:seed_inventory(*)').single();
    if (!error && data) {
      setPlans([...plans, data as GrowPlanRecord]);
      setDemandQueue(demandQueue.filter(q => q.seed.id !== item.seed.id));
    }
  };

  const openPlanModal = (item: DemandQueueItem) => {
    setEditingItem(item);
    setFormWeeks(resolveNurseryWeeks(item.seed, categories)); 
    setFormTargetDate(globalTargetDate);
    setFormQty(Math.max(item.requested_qty, 1));
    setActiveModal('PLAN_SEED');
  };

  const savePlan = async () => {
    if (!editingItem || !activeSeasonId) return;
    const startDate = calculateStartDate(formTargetDate, formWeeks, editingItem.seed.germination_days);
    const payload = { season_id: activeSeasonId, seed_id: editingItem.seed.id, target_plant_date: formTargetDate, planned_qty: formQty, sown_qty: 0, indoor_start_date: startDate };
    
    const { data, error } = await supabase.from('grow_plan').insert([payload]).select('*, seed:seed_inventory(*)').single();
    if (!error && data) {
      setPlans([...plans, data as GrowPlanRecord]);
      setDemandQueue(demandQueue.filter(q => q.seed.id !== editingItem.seed.id));
      setActiveModal(null);
      setIsManualAdding(false);
    } else alert("Error saving plan: " + error?.message);
  };

  const deletePlan = async (id: string, seed: InventorySeed, qty: number) => {
    if (confirm("Remove this seed from your grow plan entirely?")) {
      await supabase.from('grow_plan').delete().eq('id', id);
      setPlans(plans.filter(p => p.id !== id));
      // Return it to the queue if it was a requested item
      if (qty > 0) setDemandQueue([...demandQueue, { seed, requested_qty: qty }].sort((a, b) => b.requested_qty - a.requested_qty));
    }
  };

  // Tracking Partial Fulfillments (The 20 vs 12 problem)
  const updateSownQty = async (id: string, delta: number) => {
    const plan = plans.find(p => p.id === id);
    if (!plan) return;
    const newQty = Math.max(0, (plan.sown_qty || 0) + delta);
    setPlans(plans.map(p => p.id === id ? { ...p, sown_qty: newQty } : p));
    await supabase.from('grow_plan').update({ sown_qty: newQty }).eq('id', id);
  };

  const toggleSelection = (id: string) => {
    setSelectedPlanIds(prev => prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]);
  };

  // POINT 4: Bulk Sow & Navigate
  const handleBulkSow = async () => {
    const selected = plans.filter(p => selectedPlanIds.includes(p.id));
    if (selected.length === 0) return;

    // Calculate how many they actually need to sow (Planned - Sown)
    const trayContents = selected.map(p => ({
      seed_id: p.seed_id,
      sown_count: Math.max(1, p.planned_qty - (p.sown_qty || 0))
    }));

    // Auto-mark them as completed in the database
    for (const p of selected) {
      await supabase.from('grow_plan').update({ sown_qty: p.planned_qty }).eq('id', p.id);
    }
    
    // Pass them to TrayEdit
    const prefilledTray = {
      season_id: activeSeasonId,
      contents: trayContents
    };

    navigateTo('tray_edit', prefilledTray);
  };

  const today = new Date(); today.setHours(0,0,0,0);
  
  const filteredPlans = plans.filter(p => showCompleted || (p.sown_qty || 0) < p.planned_qty);
  const sortedPlans = [...filteredPlans].sort((a, b) => new Date(a.indoor_start_date).getTime() - new Date(b.indoor_start_date).getTime());

  // Filter out seeds already in the plan from the manual search dropdown
  const plannedSeedIds = new Set(plans.map(p => p.seed_id));
  const manualSearchResults = useMemo(() => {
    if (!manualSearch) return [];
    const q = manualSearch.toLowerCase();
    return inventory.filter(s => !plannedSeedIds.has(s.id) && s.variety_name.toLowerCase().includes(q)).slice(0, 5);
  }, [manualSearch, inventory, plannedSeedIds]);

  if (userRole !== 'admin') return <div className="p-10 text-center">Access Denied</div>;

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900 pb-32 font-sans relative">
      <header className="bg-stone-900 text-white p-4 shadow-md sticky top-0 z-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => handleGoBack('admin_hub')} className="p-2 bg-stone-800 rounded-full hover:bg-stone-700 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h1 className="text-xl font-bold">Grow Planner</h1>
        </div>
        <select value={activeSeasonId || ''} onChange={(e) => setActiveSeasonId(e.target.value)} className="bg-stone-800 border border-stone-700 text-sm font-bold rounded-xl px-3 py-1.5 outline-none appearance-none cursor-pointer">
          {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </header>

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        
        {/* Global Settings */}
        <div className="bg-amber-50 p-4 rounded-3xl border border-amber-200 shadow-sm flex items-center justify-between">
          <div><h2 className="font-black text-amber-900 text-sm">Target Frost Date</h2><p className="text-[10px] text-amber-700 uppercase tracking-widest mt-0.5">Used for calculating timelines</p></div>
          <input type="date" value={globalTargetDate} onChange={(e) => setGlobalTargetDate(e.target.value)} className="bg-white border border-amber-300 rounded-xl px-3 py-2 text-sm font-bold text-amber-900 outline-none focus:border-amber-500 shadow-sm" />
        </div>

        {isLoading ? (
           <div className="flex justify-center py-20 text-stone-400"><svg className="w-10 h-10 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>
        ) : (
          <div className="flex flex-col md:flex-row gap-6">
            
            {/* LEFT COL: Unplanned Queue & Manual Add */}
            <div className="md:w-1/3 space-y-4">
              
              {/* POINT 2: Manual Add Component */}
              <div className="bg-white p-3 rounded-2xl border border-stone-200 shadow-sm">
                 {isManualAdding ? (
                   <div className="space-y-2 animate-in fade-in">
                     <div className="flex justify-between items-center mb-1">
                       <span className="text-[10px] font-black uppercase tracking-widest text-stone-500">Search Vault</span>
                       <button onClick={() => { setIsManualAdding(false); setManualSearch(""); }} className="text-stone-400 hover:text-stone-800"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                     </div>
                     <input type="text" autoFocus placeholder="e.g. Jalapeno..." value={manualSearch} onChange={e => setManualSearch(e.target.value)} className="w-full bg-stone-50 border border-stone-200 rounded-lg p-2 text-sm outline-none focus:border-emerald-500" />
                     {manualSearchResults.length > 0 && (
                       <div className="border border-stone-100 rounded-lg divide-y divide-stone-100 overflow-hidden mt-2">
                         {manualSearchResults.map(s => (
                           <button key={s.id} onClick={() => openPlanModal({ seed: s, requested_qty: 1 })} className="w-full text-left p-2 hover:bg-emerald-50 text-sm flex justify-between items-center group">
                             <span className="font-bold text-stone-800 group-hover:text-emerald-700 truncate">{s.variety_name}</span>
                             <span className="text-[9px] text-stone-400 uppercase">{s.category}</span>
                           </button>
                         ))}
                       </div>
                     )}
                   </div>
                 ) : (
                   <button onClick={() => setIsManualAdding(true)} className="w-full py-2 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-xl text-xs font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-1">
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg> Add Custom Seed
                   </button>
                 )}
              </div>

              <h3 className="font-black text-xs uppercase tracking-widest text-stone-400 border-b border-stone-200 pb-2">Wishlist Queue ({demandQueue.length})</h3>
              {demandQueue.length === 0 ? (
                <div className="bg-white p-4 rounded-2xl border border-stone-200 text-center text-stone-400 text-xs italic">All requested seeds are scheduled!</div>
              ) : (
                <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto pr-1">
                  {demandQueue.map(item => (
                    <div key={item.seed.id} className="bg-white p-3 rounded-2xl border border-stone-200 shadow-sm group hover:border-emerald-300 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <div className="min-w-0 pr-2 cursor-pointer hover:text-emerald-600" onClick={() => navigateTo('seed_detail', item.seed)}>
                          <h4 className="font-bold text-stone-800 text-sm leading-tight truncate">{item.seed.variety_name}</h4>
                          <p className="text-[9px] font-black uppercase tracking-widest text-stone-400 mt-0.5">{item.seed.category}</p>
                        </div>
                        <span className="bg-blue-50 text-blue-700 text-[10px] font-black px-1.5 py-0.5 rounded flex-shrink-0">Req: {item.requested_qty}</span>
                      </div>
                      
                      <div className="flex gap-1">
                        <button onClick={() => openPlanModal(item)} className="flex-1 bg-stone-100 text-stone-600 hover:bg-stone-200 text-[10px] uppercase tracking-widest font-bold py-1.5 rounded-lg transition-colors border border-transparent">
                           Edit & Plan
                        </button>
                        <button onClick={() => handleQuickAdd(item)} className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 text-[10px] uppercase tracking-widest font-black px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 shadow-sm" title="Quick Add with Defaults">
                          ⚡ Add
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* RIGHT COL: The Timeline */}
            <div className="md:w-2/3 space-y-4">
              <div className="flex justify-between items-end border-b border-stone-200 pb-2">
                <h3 className="font-black text-xs uppercase tracking-widest text-stone-400">
                  Seed Starting Calendar
                </h3>
                <div className="flex items-center gap-2 text-xs font-bold text-stone-500">
                  <span>Show Completed</span>
                  <button onClick={() => setShowCompleted(!showCompleted)} className={`w-8 h-4 rounded-full transition-colors relative ${showCompleted ? 'bg-emerald-500' : 'bg-stone-300'}`}>
                    <div className={`w-2.5 h-2.5 bg-white rounded-full absolute top-[3px] transition-transform ${showCompleted ? 'translate-x-[18px]' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>

              {sortedPlans.length === 0 ? (
                <div className="bg-white p-10 rounded-3xl border border-stone-200 text-center shadow-sm"><div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl">🌱</div><h4 className="font-black text-stone-800">Your timeline is empty</h4><p className="text-xs text-stone-500 mt-1">Schedule seeds from the queue to build your timeline.</p></div>
              ) : (
                <div className="relative border-l-2 border-stone-200 ml-3 md:ml-4 space-y-5 pb-4">
                  {sortedPlans.map(plan => {
                    const isSelected = selectedPlanIds.includes(plan.id);
                    const planDate = new Date(plan.indoor_start_date);
                    const diffDays = Math.round((planDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    
                    const isComplete = (plan.sown_qty || 0) >= plan.planned_qty;
                    let badgeColor = "bg-stone-100 text-stone-600 border-stone-200"; let statusTxt = "Future";
                    
                    if (isComplete) { badgeColor = "bg-emerald-100 text-emerald-700 border-emerald-200"; statusTxt = "Sown ✓"; }
                    else if (diffDays < 0) { badgeColor = "bg-red-100 text-red-700 border-red-200"; statusTxt = "Overdue"; }
                    else if (diffDays <= 7) { badgeColor = "bg-amber-100 text-amber-700 border-amber-300"; statusTxt = "This Week"; }
                    else if (diffDays <= 14) { badgeColor = "bg-blue-100 text-blue-700 border-blue-200"; statusTxt = "Next Week"; }

                    const progressPercent = Math.min(100, Math.round(((plan.sown_qty || 0) / plan.planned_qty) * 100));

                    return (
                      <div key={plan.id} className="relative pl-6">
                        <div className={`absolute -left-[9px] top-1.5 w-4 h-4 rounded-full border-4 border-white shadow-sm ${badgeColor.split(' ')[0]}`}></div>
                        
                        <div 
                          className={`bg-white p-4 rounded-2xl border shadow-sm flex flex-col gap-2 transition-all cursor-pointer ${isSelected ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-stone-200 hover:shadow-md hover:border-emerald-300'}`}
                          onClick={() => !isComplete && toggleSelection(plan.id)}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex gap-3 items-start">
                              {!isComplete && (
                                <div className={`w-5 h-5 rounded border flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors ${isSelected ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-stone-50 border-stone-300 text-transparent'}`}>
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                </div>
                              )}
                              <div>
                                <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border inline-block mb-1 ${badgeColor}`}>{statusTxt}</span>
                                <h4 className="font-black text-stone-800 text-lg leading-tight hover:text-emerald-600" onClick={(e) => { e.stopPropagation(); navigateTo('seed_detail', plan.seed); }}>{plan.seed?.variety_name}</h4>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className={`text-xl font-black ${isComplete ? 'text-stone-400' : 'text-stone-800'}`}>{planDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                              <div className="text-[10px] text-stone-400 font-bold uppercase tracking-widest mt-0.5">{plan.indoor_start_date === plan.target_plant_date ? 'Direct Sow' : 'Indoors'}</div>
                            </div>
                          </div>

                          {/* Tracking UI */}
                          <div className="mt-2 pt-3 border-t border-stone-100 flex items-center justify-between" onClick={e => e.stopPropagation()}>
                             
                             <div className="flex-1 mr-4">
                               <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-1">
                                 <span className="text-stone-400">Goal: {plan.planned_qty}</span>
                                 <span className="text-emerald-600">Sown: {plan.sown_qty || 0}</span>
                               </div>
                               <div className="w-full bg-stone-100 rounded-full h-1.5 overflow-hidden">
                                 <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
                               </div>
                             </div>

                             <div className="flex items-center gap-1 bg-stone-50 rounded-lg p-1 border border-stone-200">
                               <button onClick={() => updateSownQty(plan.id, -1)} className="w-6 h-6 flex items-center justify-center bg-white text-stone-500 rounded shadow-sm hover:text-red-500 font-black">-</button>
                               <button onClick={() => updateSownQty(plan.id, 1)} className="w-6 h-6 flex items-center justify-center bg-white text-stone-500 rounded shadow-sm hover:text-emerald-500 font-black">+</button>
                             </div>
                             
                             <button onClick={() => deletePlan(plan.id, plan.seed!, plan.planned_qty)} className="ml-2 p-1.5 text-stone-300 hover:text-red-500 transition-colors" title="Delete Plan"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* POINT 4: Floating Action Bar for Bulk Sowing */}
      {selectedPlanIds.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-stone-200 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-40 animate-in slide-in-from-bottom-5">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-4 px-2">
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Action Required</span>
              <span className="font-black text-sm md:text-lg text-emerald-700">{selectedPlanIds.length} Seeds Selected</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setSelectedPlanIds([])} className="px-4 py-3 bg-stone-100 text-stone-600 rounded-xl font-bold text-xs uppercase tracking-widest active:scale-95 transition-all">
                Cancel
              </button>
              <button onClick={handleBulkSow} className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-black text-xs md:text-sm uppercase tracking-widest shadow-lg shadow-emerald-900/20 active:scale-95 transition-all flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg> Sow in Trays
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PLAN SEED MODAL */}
      {activeModal === 'PLAN_SEED' && editingItem && (
        <div className="fixed inset-0 z-50 bg-stone-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-stone-50 p-4 border-b border-stone-200 flex justify-between items-center">
              <div><h2 className="font-black text-stone-800 tracking-tight">Schedule Seed</h2><p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mt-0.5">{editingItem.seed.variety_name}</p></div>
              <button onClick={() => { setActiveModal(null); setIsManualAdding(false); }} className="p-1 rounded-full text-stone-400 hover:bg-stone-200 hover:text-stone-800"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                 <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 text-center">
                    <span className="block text-[9px] font-black uppercase tracking-widest text-stone-400 mb-1">Nursery Time</span>
                    <div className="flex items-center justify-center gap-1 text-sm font-black text-stone-800"><input type="number" min="0" value={formWeeks} onChange={(e) => setFormWeeks(Number(e.target.value))} className="w-10 text-center border-b border-stone-300 outline-none bg-transparent focus:border-emerald-500" /> Weeks</div>
                 </div>
                 <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 text-center">
                    <span className="block text-[9px] font-black uppercase tracking-widest text-stone-400 mb-1">Planned Qty</span>
                    <input type="number" min="1" value={formQty} onChange={(e) => setFormQty(Number(e.target.value))} className="w-full text-center bg-transparent text-lg font-black text-blue-600 outline-none border-b border-stone-300 focus:border-blue-500" />
                 </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Target Plant-Out Date</label>
                <input type="date" value={formTargetDate} onChange={(e) => setFormTargetDate(e.target.value)} className="w-full bg-white border border-stone-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-emerald-500 shadow-sm text-stone-800" />
              </div>
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex justify-between items-center mt-2">
                <span className="text-xs font-black uppercase tracking-widest text-emerald-800">Start Date:</span><span className="text-xl font-black text-emerald-600">{new Date(calculateStartDate(formTargetDate, formWeeks, editingItem.seed.germination_days)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              </div>
              <button onClick={savePlan} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black uppercase tracking-widest shadow-xl shadow-emerald-900/20 active:scale-95 transition-all mt-2 hover:bg-emerald-500">Confirm & Add to Calendar</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}