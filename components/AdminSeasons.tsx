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

  // Inline Editing States
  const [editingSeason, setEditingSeason] = useState<boolean>(false);
  const [editSeasonName, setEditSeasonName] = useState("");
  const [editSeasonStatus, setEditSeasonStatus] = useState<'Planning' | 'Active' | 'Archived'>('Planning');

  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editSessionName, setEditSessionName] = useState("");

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

  useEffect(() => { fetchSeasons(); }, []);

  useEffect(() => {
    if (activeSeasonId) {
      fetchSessions(activeSeasonId);
      setEditingSeason(false);
    }
  }, [activeSeasonId]);

  // --- CREATE ---
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
    const { data, error } = await supabase.from('wishlist_sessions').insert([{ list_name: newListName.trim(), season_id: activeSeasonId }]).select().single();
    if (!error && data) {
      setSessions([data as WishlistSession, ...sessions]);
      setNewListName("");
    }
  };

  // --- UPDATE / DELETE SEASON ---
  const startEditingSeason = () => {
    const s = seasons.find(x => x.id === activeSeasonId);
    if (s) {
      setEditSeasonName(s.name);
      setEditSeasonStatus(s.status);
      setEditingSeason(true);
    }
  };

  const saveSeasonEdit = async () => {
    if (!activeSeasonId || !editSeasonName.trim()) return;
    const { error } = await supabase.from('seasons').update({ name: editSeasonName.trim(), status: editSeasonStatus }).eq('id', activeSeasonId);
    if (!error) {
      setSeasons(seasons.map(s => s.id === activeSeasonId ? { ...s, name: editSeasonName.trim(), status: editSeasonStatus } : s));
      setEditingSeason(false);
    }
  };

  const deleteSeason = async () => {
    if (!activeSeasonId) return;
    if (confirm("Are you sure? This will permanently delete this season AND all associated wishlist links and requests!")) {
      const { error } = await supabase.from('seasons').delete().eq('id', activeSeasonId);
      if (!error) {
        setSeasons(seasons.filter(s => s.id !== activeSeasonId));
        setActiveSeasonId(seasons.length > 1 ? seasons.find(s => s.id !== activeSeasonId)!.id : null);
        setEditingSeason(false);
      }
    }
  };

  // --- UPDATE / DELETE SESSION ---
  const saveSessionEdit = async (id: string) => {
    if (!editSessionName.trim()) return;
    const { error } = await supabase.from('wishlist_sessions').update({ list_name: editSessionName.trim() }).eq('id', id);
    if (!error) {
      setSessions(sessions.map(s => s.id === id ? { ...s, list_name: editSessionName.trim() } : s));
      setEditingSessionId(null);
    }
  };

  const deleteSession = async (id: string) => {
    if (confirm("Are you sure you want to delete this link? The user will no longer be able to access it or submit requests.")) {
      const { error } = await supabase.from('wishlist_sessions').delete().eq('id', id);
      if (!error) {
        setSessions(sessions.filter(s => s.id !== id));
      }
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
        
        {/* Season Management */}
        <section className="bg-white p-6 rounded-3xl shadow-sm border border-stone-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-black text-stone-800">1. Manage Seasons</h2>
            {activeSeasonId && !editingSeason && (
               <button onClick={startEditingSeason} className="text-[10px] font-bold uppercase tracking-widest text-stone-500 bg-stone-100 hover:bg-stone-200 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                 <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg> Edit
               </button>
            )}
          </div>

          {editingSeason ? (
            <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 mb-6 space-y-3 animate-in fade-in">
               <input type="text" value={editSeasonName} onChange={e => setEditSeasonName(e.target.value)} className="w-full bg-white border border-stone-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-emerald-500" />
               <select value={editSeasonStatus} onChange={e => setEditSeasonStatus(e.target.value as any)} className="w-full bg-white border border-stone-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-emerald-500 appearance-none">
                 <option value="Planning">Planning</option>
                 <option value="Active">Active</option>
                 <option value="Archived">Archived</option>
               </select>
               <div className="flex gap-2 pt-2">
                 <button onClick={saveSeasonEdit} className="flex-1 bg-emerald-600 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-widest active:scale-95 transition-transform">Save</button>
                 <button onClick={() => setEditingSeason(false)} className="flex-1 bg-stone-200 text-stone-700 font-bold py-3 rounded-xl text-xs uppercase tracking-widest active:scale-95 transition-transform">Cancel</button>
                 <button onClick={deleteSeason} className="bg-red-100 text-red-600 px-4 rounded-xl active:scale-95 transition-transform"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
               </div>
            </div>
          ) : (
            <select 
              value={activeSeasonId || ''} 
              onChange={(e) => setActiveSeasonId(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-emerald-500 mb-6 appearance-none"
            >
              {seasons.map(s => <option key={s.id} value={s.id}>{s.name} ({s.status})</option>)}
            </select>
          )}

          <div className="border-t border-stone-100 pt-4">
            <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2 ml-1">Create New Season</label>
            <form onSubmit={handleCreateSeason} className="flex gap-2">
              <input 
                type="text" 
                placeholder="e.g. Spring 2026" 
                value={newSeasonName} 
                onChange={e => setNewSeasonName(e.target.value)}
                className="flex-1 bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm outline-none focus:border-emerald-500"
              />
              <button type="submit" disabled={!newSeasonName.trim()} className="bg-stone-800 text-white px-5 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-stone-700 active:scale-95 transition-all disabled:opacity-50">
                Add
              </button>
            </form>
          </div>
        </section>

        {/* Link Generation */}
        {activeSeasonId && (
          <section className="bg-emerald-50 p-6 rounded-3xl shadow-sm border border-emerald-100">
            <h2 className="font-black text-emerald-900 mb-2">2. Wishlist Links</h2>
            <p className="text-xs text-emerald-700 mb-4">Create and manage catalog links for friends and family.</p>
            
            <form onSubmit={handleCreateLink} className="flex gap-2 mb-6">
              <input 
                type="text" 
                placeholder="e.g. Aunt Susan" 
                value={newListName} 
                onChange={e => setNewListName(e.target.value)}
                className="flex-1 bg-white border border-emerald-200 rounded-xl p-3 text-sm outline-none focus:border-emerald-500 shadow-sm"
              />
              <button type="submit" disabled={!newListName.trim()} className="bg-emerald-600 text-white px-4 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-emerald-500 active:scale-95 transition-all shadow-sm disabled:opacity-50">
                Create
              </button>
            </form>

            <div className="space-y-3">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-800/60 border-b border-emerald-200 pb-1">Active Links ({sessions.length})</h3>
              {sessions.length === 0 ? (
                <p className="text-sm text-emerald-600/60 italic">No links generated yet.</p>
              ) : (
                sessions.map(session => (
                  <div key={session.id} className="bg-white p-3 rounded-xl border border-emerald-100 shadow-sm flex flex-col gap-2 group">
                    {editingSessionId === session.id ? (
                      <div className="flex gap-2 animate-in fade-in">
                        <input type="text" autoFocus value={editSessionName} onChange={e => setEditSessionName(e.target.value)} className="flex-1 bg-stone-50 border border-stone-200 rounded-lg p-2 text-sm font-bold outline-none focus:border-emerald-500" />
                        <button onClick={() => saveSessionEdit(session.id)} className="bg-emerald-600 text-white px-3 rounded-lg text-xs font-bold active:scale-95">Save</button>
                        <button onClick={() => setEditingSessionId(null)} className="bg-stone-200 text-stone-600 px-3 rounded-lg text-xs font-bold active:scale-95">Cancel</button>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold text-stone-800">{session.list_name}</h4>
                            <p className="text-[9px] font-mono text-stone-400 mt-0.5 truncate max-w-[150px]">{session.id}</p>
                          </div>
                          <div className="flex gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                             <button onClick={() => { setEditingSessionId(session.id); setEditSessionName(session.list_name); }} className="p-1.5 text-stone-400 hover:text-stone-800 bg-stone-50 hover:bg-stone-200 rounded-md transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                             <button onClick={() => deleteSession(session.id)} className="p-1.5 text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                          </div>
                        </div>
                        <button 
                          onClick={() => copyToClipboard(session.id)}
                          className="w-full flex items-center justify-center gap-1.5 bg-emerald-50 text-emerald-700 py-2 rounded-lg text-[10px] uppercase tracking-widest font-black border border-emerald-100 hover:bg-emerald-100 active:scale-95 transition-all mt-1"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                          Copy Public Link
                        </button>
                      </>
                    )}
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