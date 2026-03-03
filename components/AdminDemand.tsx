import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Season, InventorySeed, AppView, SeedCategory } from '../types';

interface Props { 
  categories: SeedCategory[];
  navigateTo: (view: AppView, payload?: any) => void; 
  handleGoBack: (view: AppView) => void; 
  userRole?: string; 
}

interface DemandItem {
  seed: InventorySeed;
  count: number;
  requesters: string[];
  ledger?: { growing: number; keep: number; reserve: number; available: number; };
  plan?: { id: string; planned_qty: number; indoor_start_date: string; }; 
}

interface CustomRequest { id: string; requester: string; request: string; created_at: string; }

// Planning Helpers
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

const calculateStartDate = (target: string, weeks: number, germStr?: string) => {
  const targetDate = new Date(target);
  const germDays = parseGermDays(germStr);
  targetDate.setDate(targetDate.getDate() - ((weeks * 7) + germDays));
  return targetDate.toISOString().split('T')[0];
};

export default function AdminDemand({ categories, navigateTo, handleGoBack, userRole }: Props) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [activeSeasonId, setActiveSeasonId] = useState<string | null>(null);
  
  const [aggregatedDemand, setAggregatedDemand] = useState<DemandItem[]>([]);
  const [customRequests, setCustomRequests] = useState<CustomRequest[]>([]);
  
  const [globalTargetDate, setGlobalTargetDate] = useState<string>(`${new Date().getFullYear()}-05-10`);
  const [showDrafts, setShowDrafts] = useState(false);
  const [counts, setCounts] = useState({ submitted: 0, drafts: 0 });
  const [isLoading, setIsLoading] = useState(true);

  // Scheduling Modal State
  const [activeModal, setActiveModal] = useState<'PLAN_SEED' | null>(null);
  const [editingItem, setEditingItem] = useState<DemandItem | null>(null);
  const [formWeeks, setFormWeeks] = useState(6);
  const [formTargetDate, setFormTargetDate] = useState("");
  const [formQty, setFormQty] = useState(0);

  useEffect(() => {
    const fetchSeasons = async () => {
      setIsLoading(true);
      const { data, error } = await supabase.from('seasons').select('*').order('created_at', { ascending: false });
      if (data) { 
        setSeasons(data as Season[]); 
        if (data.length > 0 && !activeSeasonId) {
          const active = data.find(s => s.status === 'Active');
          setActiveSeasonId(active ? active.id : data[0].id);
        }
      }
      setIsLoading(false);
    };
    fetchSeasons();
  }, []);

  useEffect(() => {
    const fetchDemandData = async () => {
      if (!activeSeasonId) return;
      setIsLoading(true);

      try {
        const { data: sessions, error: sessionsErr } = await supabase.from('wishlist_sessions').select('id, list_name, submitted_at').eq('season_id', activeSeasonId);
        if (sessionsErr) throw sessionsErr;
        
        if (!sessions || sessions.length === 0) {
           setAggregatedDemand([]); setCustomRequests([]); setCounts({ submitted: 0, drafts: 0 }); setIsLoading(false); return;
        }

        const sessionMap = new Map(sessions.map(s => [s.id, { name: s.list_name, isSubmitted: !!s.submitted_at }]));
        const validSessionIds = sessions.filter(s => showDrafts || s.submitted_at).map(s => s.id);
        
        setCounts({
          submitted: sessions.filter(s => s.submitted_at).length,
          drafts: sessions.filter(s => !s.submitted_at).length
        });

        if (validSessionIds.length === 0) {
           setAggregatedDemand([]); setCustomRequests([]); setIsLoading(false); return;
        }

        const { data: selections, error: selectionsErr } = await supabase.from('wishlist_selections').select('*, seed:seed_inventory(*)').in('session_id', validSessionIds);
        if (selectionsErr) throw selectionsErr;

        const [{ data: ledgers }, { data: growPlans }] = await Promise.all([
          supabase.from('season_seedlings').select('*').eq('season_id', activeSeasonId),
          supabase.from('grow_plan').select('*').eq('season_id', activeSeasonId)
        ]);
        
        const ledgerMap = new Map();
        if (ledgers) ledgers.forEach(l => ledgerMap.set(l.seed_id, l));

        const planMap = new Map();
        if (growPlans) growPlans.forEach(p => planMap.set(p.seed_id, p));

        const demandMap = new Map<string, DemandItem>();
        const customReqs: CustomRequest[] = [];

        (selections || []).forEach((sel: any) => {
          const sessionInfo = sessionMap.get(sel.session_id) || { name: 'Unknown', isSubmitted: false };
          const requesterName = sessionInfo.isSubmitted ? sessionInfo.name : `${sessionInfo.name} (Draft)`;

          if (sel.seed_id && sel.seed) {
            if (demandMap.has(sel.seed_id)) {
              const existing = demandMap.get(sel.seed_id)!;
              existing.count += 1;
              if (!existing.requesters.includes(requesterName)) existing.requesters.push(requesterName);
            } else {
              let seedLedger;
              if (ledgerMap.has(sel.seed_id)) {
                const l = ledgerMap.get(sel.seed_id);
                seedLedger = { growing: l.qty_growing, keep: l.allocate_keep, reserve: l.allocate_reserve, available: Math.max(0, l.qty_growing - l.allocate_keep - l.allocate_reserve) };
              }
              
              let seedPlan;
              if (planMap.has(sel.seed_id)) {
                const p = planMap.get(sel.seed_id);
                seedPlan = { id: p.id, planned_qty: p.planned_qty, indoor_start_date: p.indoor_start_date };
              }

              demandMap.set(sel.seed_id, { 
                seed: sel.seed as InventorySeed, 
                count: 1, 
                requesters: [requesterName], 
                ledger: seedLedger,
                plan: seedPlan
              });
            }
          } else if (sel.custom_request) {
            customReqs.push({ id: sel.id, requester: requesterName, request: sel.custom_request, created_at: sel.created_at });
          }
        });

        setAggregatedDemand(Array.from(demandMap.values()).sort((a, b) => b.count - a.count));
        setCustomRequests(customReqs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));

      } catch (err) { console.error("Failed to load demand data:", err); } 
      finally { setIsLoading(false); }
    };

    fetchDemandData();
  }, [activeSeasonId, showDrafts]);

  const handleQuickAdd = async (item: DemandItem) => {
    if (!activeSeasonId) return;
    const weeks = resolveNurseryWeeks(item.seed, categories);
    const startDate = calculateStartDate(globalTargetDate, weeks, item.seed.germination_days);
    
    const payload = {
      season_id: activeSeasonId,
      seed_id: item.seed.id,
      target_plant_date: globalTargetDate,
      planned_qty: item.count,
      sown_qty: 0,
      indoor_start_date: startDate
    };

    const { data, error } = await supabase.from('grow_plan').insert([payload]).select().single();
    if (!error && data) {
      setAggregatedDemand(aggregatedDemand.map(d => 
        d.seed.id === item.seed.id 
          ? { ...d, plan: { id: data.id, planned_qty: item.count, indoor_start_date: startDate } } 
          : d
      ));
    } else {
      alert("Error saving plan: " + error?.message);
    }
  };

  const openPlanModal = (item: DemandItem) => {
    setEditingItem(item);
    setFormWeeks(resolveNurseryWeeks(item.seed, categories)); 
    setFormTargetDate(globalTargetDate);
    setFormQty(Math.max(item.count, 1));
    setActiveModal('PLAN_SEED');
  };

  const savePlan = async () => {
    if (!editingItem || !activeSeasonId) return;
    const startDate = calculateStartDate(formTargetDate, formWeeks, editingItem.seed.germination_days);
    const payload = { season_id: activeSeasonId, seed_id: editingItem.seed.id, target_plant_date: formTargetDate, planned_qty: formQty, sown_qty: 0, indoor_start_date: startDate };
    
    const { data, error } = await supabase.from('grow_plan').insert([payload]).select().single();
    if (!error && data) {
      setAggregatedDemand(aggregatedDemand.map(d => d.seed.id === editingItem.seed.id ? { ...d, plan: { id: data.id, planned_qty: formQty, indoor_start_date: startDate } } : d));
      setActiveModal(null);
    } else alert("Error saving plan: " + error?.message);
  };

  if (userRole !== 'admin') return <div className="p-10 text-center">Access Denied</div>;

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900 pb-20 font-sans">
      <header className="bg-stone-900 text-white p-4 shadow-md sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => handleGoBack('dashboard')} className="p-2 bg-stone-800 rounded-full hover:bg-stone-700 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h1 className="text-xl font-bold">Demand Planner</h1>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 space-y-6 mt-4">
        
        <div className="bg-white p-4 rounded-3xl shadow-sm border border-stone-200 flex flex-col md:flex-row md:items-center justify-between gap-4 max-w-4xl mx-auto">
          <div className="flex items-center gap-4 flex-1">
            <div className="bg-blue-100 text-blue-600 p-3 rounded-2xl hidden sm:block">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </div>
            <div className="flex-1 relative">
              <select value={activeSeasonId || ''} onChange={(e) => setActiveSeasonId(e.target.value)} className="w-full bg-transparent text-lg font-black text-stone-800 outline-none cursor-pointer appearance-none pr-6">
                {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <svg className="w-4 h-4 text-stone-400 absolute right-0 top-1.5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              <p className="text-[10px] font-bold text-stone-400 tracking-wider uppercase mt-1">{counts.submitted} Submitted • {counts.drafts} Drafts</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 px-1 md:px-4 md:border-l border-stone-100">
            <div>
              <h2 className="font-black text-stone-800 text-[10px] uppercase tracking-widest">Target Frost</h2>
            </div>
            <input type="date" value={globalTargetDate} onChange={(e) => setGlobalTargetDate(e.target.value)} className="bg-stone-50 border border-stone-200 rounded-lg px-2 py-1 text-xs font-bold text-stone-800 outline-none focus:border-emerald-500 shadow-inner" />
          </div>

          <div className="flex items-center justify-between sm:justify-start gap-3 px-1 md:pl-4 md:border-l border-stone-100">
            <span className="text-xs font-bold text-stone-500">Show drafts?</span>
            <button onClick={() => setShowDrafts(!showDrafts)} className={`w-10 h-5 rounded-full transition-colors relative ${showDrafts ? 'bg-blue-500' : 'bg-stone-300'}`}>
              <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] transition-transform ${showDrafts ? 'translate-x-[22px]' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20 text-blue-600"><svg className="w-10 h-10 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>
        ) : (
          <>
            <section className="space-y-3">
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 ml-1 border-b border-stone-200 pb-2 flex justify-between items-end">
                <span>All Requested Varieties</span>
                <button onClick={() => navigateTo('grow_planner')} className="text-emerald-600 flex items-center gap-1 hover:text-emerald-700 transition-colors bg-emerald-50 px-2 py-1 rounded">View Calendar <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg></button>
              </h2>
              {aggregatedDemand.length === 0 ? (
                <div className="text-center py-10 bg-white rounded-3xl border border-stone-200 max-w-xl mx-auto"><p className="text-stone-400 italic">No seeds requested for this season yet.</p></div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {aggregatedDemand.map((item) => (
                    <div key={item.seed.id} className="bg-white p-3 rounded-2xl border border-stone-200 shadow-sm flex flex-col h-full justify-between gap-2 hover:border-emerald-200 transition-colors">
                      <div className="flex gap-3 items-start">
                        <div className="flex flex-col items-center justify-center bg-stone-50 border border-stone-200 rounded-xl w-10 h-10 flex-shrink-0">
                          <span className="text-[7px] font-black text-stone-400 leading-none uppercase tracking-widest">Req</span>
                          <span className="text-base font-black text-blue-600 leading-none mt-0.5">{item.count}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-black text-stone-800 text-sm sm:text-base leading-tight truncate cursor-pointer hover:text-emerald-600 transition-colors" onClick={() => navigateTo('seed_detail', item.seed)}>{item.seed.variety_name}</h3>
                            {item.seed.out_of_stock && <span className="bg-red-100 text-red-700 text-[8px] font-black uppercase px-1.5 py-0.5 rounded tracking-widest flex-shrink-0">OOS</span>}
                          </div>
                          <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">{item.seed.category}</p>
                          
                          <div className="mt-1.5 flex flex-wrap gap-1 border-t border-stone-100 pt-1.5">
                            {item.requesters.map((req, i) => (
                              <span key={i} className={`text-[8px] font-bold px-1.5 py-0.5 rounded-md border ${req.includes('(Draft)') ? 'bg-stone-50 text-stone-400 border-stone-200 border-dashed' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>{req}</span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-stone-50 p-1.5 rounded-lg border border-stone-100 gap-2 mt-1">
                        <div className="flex flex-wrap gap-1 items-center">
                          {item.ledger ? (
                            <>
                              <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded shadow-sm">Grow: {item.ledger.growing}</span>
                              <span className="bg-purple-50 text-purple-700 border border-purple-100 text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded shadow-sm">Res: {item.ledger.reserve}</span>
                              <span className={`border text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded shadow-sm ${item.ledger.available < item.count ? 'bg-red-50 text-red-600 border-red-200' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>Avail: {item.ledger.available}</span>
                            </>
                          ) : (
                            <span className="text-stone-400 text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 flex items-center gap-1"><svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77-1.333.192 3 1.732 3z" /></svg>Nursery Empty</span>
                          )}
                        </div>

                        <div className="flex gap-1 justify-end self-end sm:self-auto w-full sm:w-auto">
                          {item.plan ? (
                             <span className="w-full sm:w-auto justify-center bg-amber-100 text-amber-800 border border-amber-200 text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded flex items-center gap-1 shadow-sm">
                               🗓️ Planned: {item.plan.planned_qty}
                             </span>
                          ) : (
                             <>
                               <button onClick={() => openPlanModal(item)} className="flex-1 sm:flex-none justify-center bg-stone-100 text-stone-600 hover:bg-stone-200 text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded transition-colors border border-transparent flex items-center gap-1">
                                 Edit
                               </button>
                               <button onClick={() => handleQuickAdd(item)} className="flex-1 sm:flex-none justify-center bg-emerald-600 text-white text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded flex items-center gap-1 hover:bg-emerald-500 active:scale-95 transition-transform shadow-sm">
                                 ⚡ Quick
                               </button>
                             </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {customRequests.length > 0 && (
              <section className="space-y-3 mt-8">
                <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 ml-1 border-b border-stone-200 pb-2 flex items-center gap-2"><span>✨</span> Custom Write-ins</h2>
                <div className="bg-amber-50 rounded-3xl border border-amber-100 p-2 space-y-2 max-w-xl">
                  {customRequests.map(req => (
                    <div key={req.id} className="bg-white p-4 rounded-2xl shadow-sm border border-amber-200/50">
                      <div className="flex justify-between items-center mb-2">
                        <span className={`text-xs font-black px-2 py-1 rounded-lg ${req.requester.includes('(Draft)') ? 'bg-stone-100 text-stone-500' : 'bg-amber-100 text-amber-800'}`}>{req.requester}</span>
                        <span className="text-[10px] text-stone-400 font-medium">{new Date(req.created_at).toLocaleDateString()}</span>
                      </div>
                      <p className="text-sm text-stone-700 leading-relaxed italic border-l-2 border-amber-300 pl-3">"{req.request}"</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {/* PLAN SEED MODAL */}
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