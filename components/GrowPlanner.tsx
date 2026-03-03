import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Season, InventorySeed, AppView, SeedCategory } from '../types';

interface Props {
  categories: SeedCategory[]; // <-- THIS FIXES THE ERROR!
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
  indoor_start_date: string; 
  seed?: InventorySeed; 
}
interface DemandQueueItem { seed: InventorySeed; requested_qty: number; }

// The Specificity Waterfall Resolver
const resolveNurseryWeeks = (seed: InventorySeed, categories: SeedCategory[]) => {
  // 1. Seed Override
  if (seed.custom_nursery_weeks !== null && seed.custom_nursery_weeks !== undefined) {
    return seed.custom_nursery_weeks;
  }
  // 2. Category Default
  const cat = categories.find(c => c.name === seed.category);
  if (cat && cat.default_nursery_weeks !== null && cat.default_nursery_weeks !== undefined) {
    return cat.default_nursery_weeks;
  }
  // 3. Global Fallback
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
  const [globalTargetDate, setGlobalTargetDate] = useState<string>(`${new Date().getFullYear()}-05-10`);
  const [plans, setPlans] = useState<GrowPlanRecord[]>([]);
  const [demandQueue, setDemandQueue] = useState<DemandQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [activeModal, setActiveModal] = useState<'PLAN_SEED' | null>(null);
  const [editingItem, setEditingItem] = useState<DemandQueueItem | null>(null);
  const [formWeeks, setFormWeeks] = useState(6);
  const [formTargetDate, setFormTargetDate] = useState("");
  const [formQty, setFormQty] = useState(0);

  useEffect(() => {
    const fetchSeasons = async () => {
      const { data } = await supabase.from('seasons').select('*').order('created_at', { ascending: false });
      if (data) { setSeasons(data as Season[]); if (data.length > 0 && !activeSeasonId) setActiveSeasonId(data[0].id); }
    };
    fetchSeasons();
  }, []);

  useEffect(() => { if (activeSeasonId) fetchPlannerData(); }, [activeSeasonId]);

  const fetchPlannerData = async () => {
    setIsLoading(true);
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

  const openPlanModal = (item: DemandQueueItem) => {
    setEditingItem(item);
    setFormWeeks(resolveNurseryWeeks(item.seed, categories)); 
    setFormTargetDate(globalTargetDate);
    setFormQty(Math.max(item.requested_qty, 1));
    setActiveModal('PLAN_SEED');
  };

  const calculateStartDate = (target: string, weeks: number, germStr?: string) => {
    const targetDate = new Date(target);
    const germDays = parseGermDays(germStr);
    const totalDaysToSubtract = (weeks * 7) + germDays;
    targetDate.setDate(targetDate.getDate() - totalDaysToSubtract);
    return targetDate.toISOString().split('T')[0];
  };

  const savePlan = async () => {
    if (!editingItem || !activeSeasonId) return;
    const startDate = calculateStartDate(formTargetDate, formWeeks, editingItem.seed.germination_days);
    const payload = { season_id: activeSeasonId, seed_id: editingItem.seed.id, target_plant_date: formTargetDate, planned_qty: formQty, indoor_start_date: startDate };
    const { data, error } = await supabase.from('grow_plan').insert([payload]).select('*, seed:seed_inventory(*)').single();
    if (!error && data) {
      setPlans([...plans, data as GrowPlanRecord]);
      setDemandQueue(demandQueue.filter(q => q.seed.id !== editingItem.seed.id));
      setActiveModal(null);
    } else alert("Error saving plan: " + error?.message);
  };

  const deletePlan = async (id: string, seed: InventorySeed, qty: number) => {
    if (confirm("Remove this seed from your grow plan?")) {
      await supabase.from('grow_plan').delete().eq('id', id);
      setPlans(plans.filter(p => p.id !== id));
      setDemandQueue([...demandQueue, { seed, requested_qty: qty }].sort((a, b) => b.requested_qty - a.requested_qty));
    }
  };

  const today = new Date(); today.setHours(0,0,0,0);
  const sortedPlans = [...plans].sort((a, b) => new Date(a.indoor_start_date).getTime() - new Date(b.indoor_start_date).getTime());

  if (userRole !== 'admin') return <div className="p-10 text-center">Access Denied</div>;

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900 pb-24 font-sans relative">
      <header className="bg-stone-900 text-white p-4 shadow-md sticky top-0 z-10 flex items-center justify-between">
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

      <div className="max-w-2xl mx-auto p-4 space-y-6">
        <div className="bg-amber-50 p-4 rounded-3xl border border-amber-200 shadow-sm flex items-center justify-between">
          <div><h2 className="font-black text-amber-900 text-sm">Target Frost Date</h2><p className="text-[10px] text-amber-700 uppercase tracking-widest mt-0.5">Used for calculations</p></div>
          <input type="date" value={globalTargetDate} onChange={(e) => setGlobalTargetDate(e.target.value)} className="bg-white border border-amber-300 rounded-xl px-3 py-2 text-sm font-bold text-amber-900 outline-none focus:border-amber-500 shadow-sm" />
        </div>

        {isLoading ? (
           <div className="flex justify-center py-20 text-stone-400"><svg className="w-10 h-10 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>
        ) : (
          <div className="flex flex-col md:flex-row gap-6">
            <div className="md:w-1/3 space-y-3">
              <h3 className="font-black text-xs uppercase tracking-widest text-stone-400 border-b border-stone-200 pb-2">Unplanned Demand ({demandQueue.length})</h3>
              {demandQueue.length === 0 ? (
                <div className="bg-white p-4 rounded-2xl border border-stone-200 text-center text-stone-400 text-xs italic">All requested seeds are scheduled!</div>
              ) : (
                <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-1">
                  {demandQueue.map(item => (
                    <div key={item.seed.id} className="bg-white p-3 rounded-2xl border border-stone-200 shadow-sm group hover:border-emerald-300 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <div className="min-w-0 pr-2">
                          <h4 className="font-bold text-stone-800 text-sm leading-tight truncate">{item.seed.variety_name}</h4>
                          <p className="text-[9px] font-black uppercase tracking-widest text-stone-400 mt-0.5">{item.seed.category}</p>
                        </div>
                        <span className="bg-blue-50 text-blue-700 text-[10px] font-black px-1.5 py-0.5 rounded flex-shrink-0">Req: {item.requested_qty}</span>
                      </div>
                      <button onClick={() => openPlanModal(item)} className="w-full bg-stone-100 text-stone-600 hover:bg-emerald-50 hover:text-emerald-700 text-xs font-bold py-1.5 rounded-lg transition-colors border border-transparent hover:border-emerald-200 flex items-center justify-center gap-1"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg> Schedule</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="md:w-2/3 space-y-4">
              <h3 className="font-black text-xs uppercase tracking-widest text-stone-400 border-b border-stone-200 pb-2 flex justify-between"><span>Seed Starting Calendar</span><span className="text-emerald-600">{sortedPlans.length} Scheduled</span></h3>
              {sortedPlans.length === 0 ? (
                <div className="bg-white p-10 rounded-3xl border border-stone-200 text-center shadow-sm"><div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl">🌱</div><h4 className="font-black text-stone-800">Your calendar is empty</h4><p className="text-xs text-stone-500 mt-1">Schedule seeds from the queue to build your timeline.</p></div>
              ) : (
                <div className="relative border-l-2 border-stone-200 ml-3 md:ml-4 space-y-6 pb-4">
                  {sortedPlans.map(plan => {
                    const planDate = new Date(plan.indoor_start_date);
                    const diffDays = Math.round((planDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    let badgeColor = "bg-stone-100 text-stone-600 border-stone-200"; let statusTxt = "Future";
                    if (diffDays < 0) { badgeColor = "bg-red-100 text-red-700 border-red-200"; statusTxt = "Overdue"; }
                    else if (diffDays <= 7) { badgeColor = "bg-amber-100 text-amber-700 border-amber-300"; statusTxt = "This Week"; }
                    else if (diffDays <= 14) { badgeColor = "bg-blue-100 text-blue-700 border-blue-200"; statusTxt = "Next Week"; }

                    return (
                      <div key={plan.id} className="relative pl-6">
                        <div className={`absolute -left-[9px] top-1.5 w-4 h-4 rounded-full border-4 border-white shadow-sm ${badgeColor.split(' ')[0]}`}></div>
                        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm flex flex-col gap-2 hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-start">
                            <div><span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border inline-block mb-1.5 ${badgeColor}`}>{statusTxt}</span><h4 className="font-black text-stone-800 text-lg leading-tight cursor-pointer hover:text-emerald-600" onClick={() => navigateTo('seed_detail', plan.seed)}>{plan.seed?.variety_name}</h4></div>
                            <div className="text-right"><div className="text-xl font-black text-emerald-600">{planDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div><div className="text-[10px] text-stone-400 font-bold uppercase tracking-widest mt-0.5">Start Date</div></div>
                          </div>
                          <div className="flex items-center justify-between mt-2 pt-3 border-t border-stone-100">
                             <div className="flex items-center gap-3 text-xs font-bold text-stone-500"><span className="flex items-center gap-1"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg> Qty: {plan.planned_qty}</span><span>{plan.indoor_start_date === plan.target_plant_date ? 'Direct Sow' : 'Start Indoors'}</span></div>
                             <div className="flex gap-1.5"><button onClick={() => deletePlan(plan.id, plan.seed!, plan.planned_qty)} className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Remove from plan"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button><button onClick={() => navigateTo('tray_edit')} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 font-black text-[10px] uppercase tracking-widest rounded-lg border border-emerald-200 hover:bg-emerald-100 transition-colors flex items-center gap-1"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg> Sow Trays</button></div>
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

      {activeModal === 'PLAN_SEED' && editingItem && (
        <div className="fixed inset-0 z-50 bg-stone-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-stone-50 p-4 border-b border-stone-200 flex justify-between items-center">
              <div><h2 className="font-black text-stone-800 tracking-tight">Schedule Seed</h2><p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mt-0.5">{editingItem.seed.variety_name}</p></div>
              <button onClick={() => setActiveModal(null)} className="p-1 rounded-full text-stone-400 hover:bg-stone-200 hover:text-stone-800"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
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