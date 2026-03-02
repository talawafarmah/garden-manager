import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { SeasonSeedling, Season, AppView, SeedlingJournalEntry } from '../types';

export default function SeedlingsList({ navigateTo, handleGoBack, userRole }: any) {
  const [ledgers, setLedgers] = useState<SeasonSeedling[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [activeSeason, setActiveSeason] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [activeModal, setActiveModal] = useState<'LOG_EVENT' | 'ALLOCATE' | 'JOURNAL' | 'LOCATIONS' | null>(null);
  const [selectedLedger, setSelectedLedger] = useState<SeasonSeedling | null>(null);

  // Double-Entry Event Form State
  const [eventType, setEventType] = useState<'qty_planted' | 'qty_gifted' | 'qty_sold' | 'qty_dead'>('qty_planted');
  const [deductKeep, setDeductKeep] = useState(0);
  const [deductReserve, setDeductReserve] = useState(0);
  const [deductAvailable, setDeductAvailable] = useState(0);

  // Journal State
  const [newNote, setNewNote] = useState('');
  const [noteType, setNoteType] = useState<'UPPOT' | 'FERTILIZE' | 'EVENT' | 'NOTE'>('NOTE');

  useEffect(() => {
    fetchSeasonsAndLedgers();
  }, []);

  const fetchSeasonsAndLedgers = async () => {
    setIsLoading(true);
    const { data: seasonData } = await supabase.from('seasons').select('*').order('created_at', { ascending: false });
    if (seasonData && seasonData.length > 0) {
      setSeasons(seasonData);
      const currentSeason = activeSeason || seasonData[0].id;
      setActiveSeason(currentSeason);
      fetchLedgers(currentSeason);
    } else {
      setIsLoading(false);
    }
  };

  const fetchLedgers = async (seasonId: string) => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('season_seedlings')
      .select('*, seed:seed_inventory(*)')
      .eq('season_id', seasonId);
      
    if (data) setLedgers(data);
    setIsLoading(false);
  };

  const availableCalc = (l: SeasonSeedling) => Math.max(0, l.qty_growing - l.allocate_keep - l.allocate_reserve);

  // Open Double-Entry Event Modal
  const openEventModal = (ledger: SeasonSeedling) => {
    setSelectedLedger(ledger);
    setEventType('qty_planted');
    setDeductKeep(0);
    setDeductReserve(0);
    setDeductAvailable(0);
    setActiveModal('LOG_EVENT');
  };

  // Submit Double-Entry Event
  const submitEvent = async () => {
    if (!selectedLedger) return;
    const totalDeducted = deductKeep + deductReserve + deductAvailable;
    if (totalDeducted === 0) return;

    const newGrowing = Math.max(0, selectedLedger.qty_growing - totalDeducted);
    const newKeep = Math.max(0, selectedLedger.allocate_keep - deductKeep);
    const newReserve = Math.max(0, selectedLedger.allocate_reserve - deductReserve);
    const newEventTotal = (selectedLedger[eventType] as number) + totalDeducted;

    const verb = eventType.replace('qty_', ''); // planted, gifted, sold, dead
    const newJournalEntry: SeedlingJournalEntry = {
      id: crypto.randomUUID(),
      date: new Date().toISOString().split('T')[0],
      type: 'EVENT',
      note: `Logged ${totalDeducted} as ${verb.toUpperCase()}. (-${deductKeep} Keep, -${deductReserve} Reserve, -${deductAvailable} Available)`
    };

    const updatedJournal = [newJournalEntry, ...(selectedLedger.journal || [])];

    const updates = {
      qty_growing: newGrowing,
      allocate_keep: newKeep,
      allocate_reserve: newReserve,
      [eventType]: newEventTotal,
      journal: updatedJournal
    };

    // Optimistic UI update
    setLedgers(ledgers.map(l => l.id === selectedLedger.id ? { ...l, ...updates } : l));
    setActiveModal(null);

    await supabase.from('season_seedlings').update(updates).eq('id', selectedLedger.id);
  };

  const submitJournalNote = async () => {
    if (!selectedLedger || !newNote.trim()) return;
    const newEntry: SeedlingJournalEntry = {
      id: crypto.randomUUID(),
      date: new Date().toISOString().split('T')[0],
      type: noteType,
      note: newNote.trim()
    };
    const updatedJournal = [newEntry, ...(selectedLedger.journal || [])];
    setLedgers(ledgers.map(l => l.id === selectedLedger.id ? { ...l, journal: updatedJournal } : l));
    setNewNote('');
    
    await supabase.from('season_seedlings').update({ journal: updatedJournal }).eq('id', selectedLedger.id);
  };

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900 pb-24 font-sans relative">
      <header className="bg-emerald-800 text-white p-4 shadow-md sticky top-0 z-10 flex items-center justify-between border-b border-emerald-900">
        <div className="flex items-center gap-2">
          <button onClick={() => navigateTo('dashboard')} className="p-2 bg-emerald-900 rounded-full hover:bg-emerald-700 transition-colors" title="Dashboard">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
          </button>
          <h1 className="text-xl font-bold ml-1">Seedling Nursery</h1>
        </div>
        <select 
          value={activeSeason} 
          onChange={(e) => { setActiveSeason(e.target.value); fetchLedgers(e.target.value); }}
          className="bg-emerald-900 border border-emerald-700 text-sm font-bold rounded-xl px-3 py-1.5 outline-none appearance-none cursor-pointer"
        >
          {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
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
             <p className="text-stone-500 text-sm">Pot up some seeds from your trays to start a ledger.</p>
           </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ledgers.map(ledger => {
              const seed = ledger.seed;
              const available = availableCalc(ledger);
              return (
                <div key={ledger.id} className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden flex flex-col">
                  {/* Ledger Header */}
                  <div className="p-4 border-b border-stone-100 flex items-center gap-4 bg-stone-50">
                    <div className="w-16 h-16 bg-stone-200 rounded-xl overflow-hidden shadow-inner flex-shrink-0">
                      {seed?.thumbnail ? <img src={seed.thumbnail} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-stone-400">🌱</div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-black text-lg text-stone-900 truncate">{seed?.variety_name || 'Unknown Seed'}</h3>
                      <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest">{seed?.category || 'Plant'}</p>
                    </div>
                  </div>

                  {/* Active Allocation Math */}
                  <div className="p-4 grid grid-cols-4 gap-2 text-center relative">
                    <div className="bg-emerald-50 rounded-xl p-2 border border-emerald-100">
                      <div className="text-[10px] font-black text-emerald-800 uppercase tracking-widest mb-1">Growing</div>
                      <div className="text-2xl font-black text-emerald-600">{ledger.qty_growing}</div>
                    </div>
                    <div className="bg-stone-50 rounded-xl p-2 border border-stone-200">
                      <div className="text-[10px] font-black text-stone-500 uppercase tracking-widest mb-1">Keep</div>
                      <div className="text-xl font-black text-stone-800">{ledger.allocate_keep}</div>
                    </div>
                    <div className="bg-purple-50 rounded-xl p-2 border border-purple-100">
                      <div className="text-[10px] font-black text-purple-800 uppercase tracking-widest mb-1">Reserve</div>
                      <div className="text-xl font-black text-purple-600">{ledger.allocate_reserve}</div>
                    </div>
                    <div className="bg-blue-50 rounded-xl p-2 border border-blue-100 shadow-inner">
                      <div className="text-[10px] font-black text-blue-800 uppercase tracking-widest mb-1">Avail</div>
                      <div className="text-2xl font-black text-blue-600">{available}</div>
                    </div>
                  </div>

                  {/* Action Bar */}
                  <div className="p-3 bg-stone-50 border-t border-b border-stone-100 flex gap-2 overflow-x-auto scrollbar-hide">
                    <button onClick={() => openEventModal(ledger)} className="flex-1 min-w-[100px] py-2 bg-stone-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-1 shadow-sm">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg> Log Event
                    </button>
                    <button onClick={() => { setSelectedLedger(ledger); setActiveModal('JOURNAL'); }} className="flex-1 min-w-[100px] py-2 bg-white text-stone-600 border border-stone-200 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-1 hover:bg-stone-100">
                      📓 Journal ({ledger.journal?.length || 0})
                    </button>
                  </div>

                  {/* Terminal Tallies */}
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

      {/* ========================================================= */}
      {/* MODAL: LOG EVENT (Double Entry Bookkeeping)                 */}
      {/* ========================================================= */}
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
                  <button onClick={() => setEventType('qty_sold')} className={`py-2 rounded-xl text-xs font-black uppercase tracking-widest border transition-all ${eventType === 'qty_sold' ? 'bg-amber-100 text-amber-800 border-amber-300 shadow-sm' : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-50'}`}>💰 Sold</button>
                  <button onClick={() => setEventType('qty_dead')} className={`py-2 rounded-xl text-xs font-black uppercase tracking-widest border transition-all ${eventType === 'qty_dead' ? 'bg-red-100 text-red-800 border-red-300 shadow-sm' : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-50'}`}>💀 Dead</button>
                </div>
              </div>

              <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200">
                <label className="block text-[10px] font-black text-stone-500 uppercase tracking-widest mb-3 text-center">Where are these coming from?</label>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-stone-700 w-24">My Keep</span>
                    <input type="number" min="0" max={selectedLedger.allocate_keep} value={deductKeep || ''} onChange={(e) => setDeductKeep(Math.min(selectedLedger.allocate_keep, Number(e.target.value)))} className="w-16 text-center border border-stone-300 rounded-lg py-1 shadow-inner focus:border-emerald-500 outline-none font-black" placeholder="0" />
                    <span className="text-[10px] font-bold text-stone-400 w-12 text-right">Max {selectedLedger.allocate_keep}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-stone-700 w-24">Reserved</span>
                    <input type="number" min="0" max={selectedLedger.allocate_reserve} value={deductReserve || ''} onChange={(e) => setDeductReserve(Math.min(selectedLedger.allocate_reserve, Number(e.target.value)))} className="w-16 text-center border border-stone-300 rounded-lg py-1 shadow-inner focus:border-emerald-500 outline-none font-black" placeholder="0" />
                    <span className="text-[10px] font-bold text-stone-400 w-12 text-right">Max {selectedLedger.allocate_reserve}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-stone-700 w-24">Available</span>
                    <input type="number" min="0" max={availableCalc(selectedLedger)} value={deductAvailable || ''} onChange={(e) => setDeductAvailable(Math.min(availableCalc(selectedLedger), Number(e.target.value)))} className="w-16 text-center border border-stone-300 rounded-lg py-1 shadow-inner focus:border-emerald-500 outline-none font-black" placeholder="0" />
                    <span className="text-[10px] font-bold text-stone-400 w-12 text-right">Max {availableCalc(selectedLedger)}</span>
                  </div>
                </div>
                
                <div className="mt-4 pt-3 border-t border-stone-200 flex justify-between items-center text-sm font-black">
                  <span className="uppercase tracking-widest text-stone-500">Total Selected:</span>
                  <span className="text-xl text-stone-900">{deductKeep + deductReserve + deductAvailable}</span>
                </div>
              </div>

              <button 
                onClick={submitEvent}
                disabled={deductKeep + deductReserve + deductAvailable === 0}
                className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black uppercase tracking-widest shadow-xl shadow-emerald-900/20 active:scale-95 transition-all disabled:opacity-50"
              >
                Log & Deduct
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: JOURNAL (Pot sizes, notes, timeline)                 */}
      {/* ========================================================= */}
      {activeModal === 'JOURNAL' && selectedLedger && (
        <div className="fixed inset-0 z-50 bg-stone-900/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md h-[85vh] sm:h-[600px] shadow-2xl flex flex-col animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300">
            <div className="bg-stone-50 p-4 border-b border-stone-200 flex justify-between items-center shrink-0">
              <div>
                <h2 className="font-black text-stone-800 tracking-tight">Ledger Journal</h2>
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{selectedLedger.seed?.variety_name}</p>
              </div>
              <button onClick={() => setActiveModal(null)} className="p-2 rounded-full text-stone-400 hover:bg-stone-200 hover:text-stone-800"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-stone-100">
              {(selectedLedger.journal || []).length === 0 ? (
                <p className="text-center text-stone-400 text-sm italic py-10">No journal entries yet.</p>
              ) : (
                (selectedLedger.journal || []).map((entry, idx) => (
                  <div key={idx} className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200 relative">
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded shadow-sm
                        ${entry.type === 'UPPOT' ? 'bg-amber-100 text-amber-800' : 
                          entry.type === 'FERTILIZE' ? 'bg-blue-100 text-blue-800' : 
                          entry.type === 'EVENT' ? 'bg-stone-800 text-white' : 'bg-emerald-100 text-emerald-800'}`}
                      >
                        {entry.type}
                      </span>
                      <span className="text-[10px] font-bold text-stone-400">{entry.date}</span>
                    </div>
                    <p className="text-sm text-stone-700 font-medium leading-relaxed">{entry.note}</p>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 bg-white border-t border-stone-200 shrink-0 shadow-[0_-10px_20px_rgba(0,0,0,0.03)]">
              <div className="flex gap-2 mb-3">
                {['NOTE', 'UPPOT', 'FERTILIZE'].map(t => (
                  <button key={t} onClick={() => setNoteType(t as any)} className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg border transition-colors ${noteType === t ? 'bg-stone-800 text-white border-stone-800' : 'bg-stone-50 text-stone-500 border-stone-200'}`}>{t}</button>
                ))}
              </div>
              <div className="flex gap-2">
                <input type="text" value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Type a note or log pot size..." className="flex-1 border border-stone-200 rounded-xl px-4 py-3 text-sm focus:border-emerald-500 outline-none bg-stone-50 shadow-inner" />
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