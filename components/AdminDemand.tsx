import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Season, InventorySeed, AppView } from '../types';

interface Props { navigateTo: (view: AppView, payload?: any) => void; handleGoBack: (view: AppView) => void; userRole?: string; }

interface DemandItem {
  seed: InventorySeed;
  count: number;
  requesters: string[];
  ledger?: { growing: number; keep: number; reserve: number; available: number; };
}

interface CustomRequest { id: string; requester: string; request: string; created_at: string; }

export default function AdminDemand({ navigateTo, handleGoBack, userRole }: Props) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [activeSeasonId, setActiveSeasonId] = useState<string | null>(null);
  
  const [aggregatedDemand, setAggregatedDemand] = useState<DemandItem[]>([]);
  const [customRequests, setCustomRequests] = useState<CustomRequest[]>([]);
  
  // NEW: Draft Toggling logic
  const [showDrafts, setShowDrafts] = useState(false);
  const [counts, setCounts] = useState({ submitted: 0, drafts: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSeasons = async () => {
      setIsLoading(true);
      const { data, error } = await supabase.from('seasons').select('*').order('created_at', { ascending: false });
      if (data) { setSeasons(data as Season[]); if (data.length > 0 && !activeSeasonId) setActiveSeasonId(data[0].id); }
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
        
        // Filter the session IDs based on the toggle!
        const validSessionIds = sessions.filter(s => showDrafts || s.submitted_at).map(s => s.id);
        
        // Update the top counts
        setCounts({
          submitted: sessions.filter(s => s.submitted_at).length,
          drafts: sessions.filter(s => !s.submitted_at).length
        });

        if (validSessionIds.length === 0) {
           setAggregatedDemand([]); setCustomRequests([]); setIsLoading(false); return;
        }

        const { data: selections, error: selectionsErr } = await supabase.from('wishlist_selections').select('*, seed:seed_inventory(*)').in('session_id', validSessionIds);
        if (selectionsErr) throw selectionsErr;

        const { data: ledgers } = await supabase.from('season_seedlings').select('*').eq('season_id', activeSeasonId);
        const ledgerMap = new Map();
        if (ledgers) ledgers.forEach(l => ledgerMap.set(l.seed_id, l));

        const demandMap = new Map<string, DemandItem>();
        const customReqs: CustomRequest[] = [];

        (selections || []).forEach((sel: any) => {
          const sessionInfo = sessionMap.get(sel.session_id) || { name: 'Unknown', isSubmitted: false };
          // Append a draft tag to the name if it's not submitted
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
              demandMap.set(sel.seed_id, { seed: sel.seed as InventorySeed, count: 1, requesters: [requesterName], ledger: seedLedger });
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

  if (userRole !== 'admin') return <div className="p-10 text-center">Access Denied</div>;

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900 pb-20 font-sans">
      <header className="bg-stone-900 text-white p-4 shadow-md sticky top-0 z-10 flex items-center gap-3">
        <button onClick={() => handleGoBack('dashboard')} className="p-2 bg-stone-800 rounded-full hover:bg-stone-700 transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h1 className="text-xl font-bold">Demand Planner</h1>
      </header>

      <div className="max-w-xl mx-auto p-4 space-y-6 mt-4">
        
        <div className="bg-white p-4 rounded-3xl shadow-sm border border-stone-200 flex flex-col gap-3">
          <div className="flex items-center gap-4 border-b border-stone-100 pb-3">
            <div className="bg-blue-100 text-blue-600 p-3 rounded-2xl">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </div>
            <div className="flex-1">
              <select value={activeSeasonId || ''} onChange={(e) => setActiveSeasonId(e.target.value)} className="w-full bg-transparent text-lg font-black text-stone-800 outline-none cursor-pointer appearance-none">
                {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <p className="text-xs font-bold text-stone-400 tracking-wider uppercase">{counts.submitted} Submitted • {counts.drafts} Drafts</p>
            </div>
            <svg className="w-5 h-5 text-stone-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </div>
          
          <div className="flex justify-between items-center px-1">
            <span className="text-xs font-bold text-stone-500">Include unsubmitted drafts?</span>
            <button onClick={() => setShowDrafts(!showDrafts)} className={`w-12 h-6 rounded-full transition-colors relative ${showDrafts ? 'bg-blue-500' : 'bg-stone-300'}`}>
              <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${showDrafts ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20 text-blue-600"><svg className="w-10 h-10 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>
        ) : (
          <>
            <section className="space-y-3">
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 ml-1 border-b border-stone-200 pb-2">Top Requested Varieties</h2>
              {aggregatedDemand.length === 0 ? (
                <div className="text-center py-10 bg-white rounded-3xl border border-stone-200"><p className="text-stone-400 italic">No seeds requested for this season yet.</p></div>
              ) : (
                aggregatedDemand.map((item) => (
                  <div key={item.seed.id} className="bg-white p-4 rounded-3xl border border-stone-200 shadow-sm flex gap-4 items-start">
                    <div className="flex flex-col items-center justify-center bg-stone-50 border border-stone-200 rounded-2xl w-14 h-14 flex-shrink-0">
                      <span className="text-[9px] font-black text-stone-400 leading-none uppercase tracking-widest">Req</span>
                      <span className="text-xl font-black text-blue-600 leading-none mt-1">{item.count}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <h3 className="font-black text-stone-800 text-lg leading-tight truncate pr-2 cursor-pointer hover:text-emerald-600 transition-colors" onClick={() => navigateTo('seed_detail', item.seed)}>{item.seed.variety_name}</h3>
                        {item.seed.out_of_stock && <span className="bg-red-100 text-red-700 text-[9px] font-black uppercase px-2 py-0.5 rounded tracking-widest flex-shrink-0">Out of Stock</span>}
                      </div>
                      <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mt-0.5">{item.seed.category}</p>
                      
                      <div className="mt-3 flex flex-wrap gap-1.5 items-center">
                        {item.ledger ? (
                          <>
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded">Grow: {item.ledger.growing}</span>
                            <span className="bg-purple-50 text-purple-700 border border-purple-100 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded">Res: {item.ledger.reserve}</span>
                            <span className={`border text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded ${item.ledger.available < item.count ? 'bg-red-50 text-red-600 border-red-200' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>Avail: {item.ledger.available}</span>
                          </>
                        ) : (
                          <span className="bg-stone-100 text-stone-500 border border-stone-200 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded flex items-center gap-1"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>Not Started Yet</span>
                        )}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-1 border-t border-stone-100 pt-3">
                        {item.requesters.map((req, i) => (
                          <span key={i} className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${req.includes('(Draft)') ? 'bg-stone-50 text-stone-400 border-stone-200 border-dashed' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>{req}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </section>

            {customRequests.length > 0 && (
              <section className="space-y-3 mt-8">
                <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 ml-1 border-b border-stone-200 pb-2 flex items-center gap-2"><span>✨</span> Custom Write-ins</h2>
                <div className="bg-amber-50 rounded-3xl border border-amber-100 p-2 space-y-2">
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
    </main>
  );
}