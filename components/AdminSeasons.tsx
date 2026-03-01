import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Season, WishlistSession, AppView } from '../types';

interface Props {
  navigateTo: (view: AppView) => void;
  handleGoBack: (view: AppView) => void;
  userRole?: string;
}

export default function AdminSeasons({ handleGoBack, userRole }: Props) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [activeSeasonId, setActiveSeasonId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<WishlistSession[]>([]);
  
  const [newSeasonName, setNewSeasonName] = useState("");
  const [newListName, setNewListName] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const fetchSeasons = async () => {
    setIsLoading(true);
    const { data, error } = await supabase.from('seasons').select('*').order('created_at', { ascending: false });
    if (data) {
      setSeasons(data as Season[]);
      if (data.length > 0 && !activeSeasonId) setActiveSeasonId(data[0].id);
    }
    setIsLoading(false);
  };

  const fetchSessions = async (seasonId: string) => {
    const { data } = await supabase.from('wishlist_sessions').select('*').eq('season_id', seasonId).order('created_at', { ascending: false });
    if (data) setSessions(data as WishlistSession[]);
  };

  useEffect(() => {
    fetchSeasons();
  }, []);

  useEffect(() => {
    if (activeSeasonId) fetchSessions(activeSeasonId);
  }, [activeSeasonId]);

  const handleCreateSeason = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSeasonName.trim()) return;
    
    const { data, error } = await supabase.from('seasons').insert([{ name: newSeasonName.trim(), status: 'Planning' }]).select().single();
    if (!error && data) {
      setSeasons([data as Season, ...seasons]);
      setActiveSeasonId(data.id);
      setNewSeasonName("");
    }
  };

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim() || !activeSeasonId) return;

    const { data, error } = await supabase.from('wishlist_sessions').insert([{
      list_name: newListName.trim(),
      season_id: activeSeasonId
    }]).select().single();

    if (!error && data) {
      setSessions([data as WishlistSession, ...sessions]);
      setNewListName("");
    }
  };

  const copyToClipboard = (token: string) => {
    const link = `${window.location.origin}/wishlist/${token}`;
    navigator.clipboard.writeText(link);
    alert("Magic Link copied to clipboard!\n\n" + link);
  };

  if (userRole !== 'admin') return <div className="p-10 text-center">Access Denied</div>;

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900 pb-20 font-sans">
      <header className="bg-stone-900 text-white p-4 shadow-md sticky top-0 z-10 flex items-center gap-3">
        <button onClick={() => handleGoBack('dashboard')} className="p-2 bg-stone-800 rounded-full hover:bg-stone-700 transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h1 className="text-xl font-bold">Season & Link Manager</h1>
      </header>

      <div className="max-w-md mx-auto p-4 space-y-6 mt-4">
        
        {/* Season Creation */}
        <section className="bg-white p-6 rounded-3xl shadow-sm border border-stone-200">
          <h2 className="font-black text-stone-800 mb-4">1. Select or Create Season</h2>
          <select 
            value={activeSeasonId || ''} 
            onChange={(e) => setActiveSeasonId(e.target.value)}
            className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-emerald-500 mb-4"
          >
            {seasons.map(s => <option key={s.id} value={s.id}>{s.name} ({s.status})</option>)}
          </select>

          <form onSubmit={handleCreateSeason} className="flex gap-2">
            <input 
              type="text" 
              placeholder="e.g. Spring 2026" 
              value={newSeasonName} 
              onChange={e => setNewSeasonName(e.target.value)}
              className="flex-1 bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm outline-none focus:border-emerald-500"
            />
            <button type="submit" className="bg-stone-800 text-white px-4 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-stone-700 active:scale-95 transition-all">
              Add
            </button>
          </form>
        </section>

        {/* Link Generation */}
        {activeSeasonId && (
          <section className="bg-emerald-50 p-6 rounded-3xl shadow-sm border border-emerald-100">
            <h2 className="font-black text-emerald-900 mb-2">2. Generate Magic Links</h2>
            <p className="text-xs text-emerald-700 mb-4">Create unique catalog links to send to friends and family for this season.</p>
            
            <form onSubmit={handleCreateLink} className="flex gap-2 mb-6">
              <input 
                type="text" 
                placeholder="e.g. Aunt Susan" 
                value={newListName} 
                onChange={e => setNewListName(e.target.value)}
                className="flex-1 bg-white border border-emerald-200 rounded-xl p-3 text-sm outline-none focus:border-emerald-500"
              />
              <button type="submit" className="bg-emerald-600 text-white px-4 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-emerald-500 active:scale-95 transition-all shadow-sm">
                Create
              </button>
            </form>

            <div className="space-y-3">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-800/60 border-b border-emerald-200 pb-1">Active Links</h3>
              {sessions.length === 0 ? (
                <p className="text-sm text-emerald-600/60 italic">No links generated yet.</p>
              ) : (
                sessions.map(session => (
                  <div key={session.id} className="bg-white p-3 rounded-xl border border-emerald-100 shadow-sm flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-stone-800">{session.list_name}</h4>
                      <p className="text-[9px] font-mono text-stone-400 mt-0.5 truncate max-w-[150px]">{session.id}</p>
                    </div>
                    <button 
                      onClick={() => copyToClipboard(session.id)}
                      className="flex items-center gap-1.5 bg-emerald-100 text-emerald-700 px-3 py-2 rounded-lg text-xs font-bold hover:bg-emerald-200 active:scale-95 transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                      Copy Link
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}