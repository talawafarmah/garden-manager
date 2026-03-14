import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { GardenArea, GardenBed, AppView } from '../types';

interface Props {
  navigateTo: (view: AppView, payload?: any) => void;
  handleGoBack: (view: AppView) => void;
}

export default function FarmMap({ navigateTo, handleGoBack }: Props) {
  const [areas, setAreas] = useState<GardenArea[]>([]);
  const [beds, setBeds] = useState<GardenBed[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [isAreaModalOpen, setIsAreaModalOpen] = useState(false);
  const [newAreaName, setNewAreaName] = useState("");

  const [isBedModalOpen, setIsBedModalOpen] = useState(false);
  const [activeAreaId, setActiveAreaId] = useState<string>("");
  const [bedForm, setBedForm] = useState<Partial<GardenBed>>({ name: '', type: 'Raised Bed', irrigation_type: 'Hand-water' });

  const BED_TYPES = ['Raised Bed', 'In-Ground Row', 'SIP', 'Container', 'Tree/Orchard'];
  const IRRIGATION_TYPES = ['Hand-water', 'Drip', 'Olla', 'SIP Reservoir', 'Sprinkler'];

  useEffect(() => {
    fetchFarmData();
  }, []);

  const fetchFarmData = async () => {
    setIsLoading(true);
    const [areaRes, bedRes] = await Promise.all([
      supabase.from('garden_areas').select('*').order('created_at', { ascending: true }),
      supabase.from('garden_beds').select('*').order('created_at', { ascending: true })
    ]);

    if (areaRes.data) setAreas(areaRes.data);
    if (bedRes.data) setBeds(bedRes.data);
    setIsLoading(false);
  };

  const handleCreateArea = async () => {
    if (!newAreaName.trim()) return;
    const { data, error } = await supabase.from('garden_areas').insert([{ name: newAreaName.trim() }]).select().single();
    if (data) {
      setAreas([...areas, data]);
      setNewAreaName("");
      setIsAreaModalOpen(false);
    } else {
      alert("Error adding area: " + error?.message);
    }
  };

  const handleCreateBed = async () => {
    if (!bedForm.name?.trim() || !activeAreaId) return;
    const payload = { ...bedForm, area_id: activeAreaId, name: bedForm.name.trim() };
    const { data, error } = await supabase.from('garden_beds').insert([payload]).select().single();
    if (data) {
      setBeds([...beds, data]);
      setBedForm({ name: '', type: 'Raised Bed', irrigation_type: 'Hand-water' });
      setIsBedModalOpen(false);
    } else {
      alert("Error adding bed: " + error?.message);
    }
  };

  const getIrrigationIcon = (type?: string) => {
    if (type?.includes('SIP')) return '💧';
    if (type?.includes('Olla')) return '🏺';
    if (type?.includes('Drip')) return '🚿';
    return '🚰';
  };

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900 pb-20 font-sans relative">
      <header className="bg-stone-900 text-white p-4 shadow-md sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => handleGoBack('dashboard')} className="p-2 bg-stone-800 rounded-full hover:bg-stone-700 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h1 className="text-xl font-bold">Farm Map</h1>
        </div>
        <button onClick={() => setIsAreaModalOpen(true)} className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-black uppercase tracking-widest rounded-lg shadow-sm hover:bg-emerald-500 transition-colors flex items-center gap-1">
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
            <button onClick={() => setIsAreaModalOpen(true)} className="px-6 py-3 bg-stone-900 text-white font-black uppercase tracking-widest rounded-xl shadow-md hover:bg-stone-800 transition-transform active:scale-95">
              Create First Area
            </button>
          </div>
        ) : (
          areas.map(area => {
            const areaBeds = beds.filter(b => b.area_id === area.id);
            return (
              <section key={area.id} className="bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden">
                <div className="bg-stone-100 p-4 border-b border-stone-200 flex justify-between items-center">
                  <h2 className="font-black text-stone-800 text-lg flex items-center gap-2">
                    <span className="text-stone-400">📍</span> {area.name}
                  </h2>
                  <button onClick={() => { setActiveAreaId(area.id); setIsBedModalOpen(true); }} className="text-xs font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors shadow-sm">
                    + Add Bed
                  </button>
                </div>
                
                <div className="p-5">
                  {areaBeds.length === 0 ? (
                    <p className="text-sm text-stone-400 italic text-center py-4">No beds added to this area yet.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {areaBeds.map(bed => (
                        <div key={bed.id} className="border border-stone-200 rounded-2xl p-4 hover:border-emerald-400 transition-colors group cursor-pointer shadow-sm relative overflow-hidden">
                          <div className="absolute top-0 right-0 p-2 opacity-10 text-4xl pointer-events-none group-hover:scale-110 transition-transform">
                            {bed.type.includes('SIP') ? '📦' : bed.type.includes('Tree') ? '🌳' : '🛏️'}
                          </div>
                          <div className="relative z-10">
                            <h3 className="font-black text-stone-800 text-lg group-hover:text-emerald-700 leading-tight">{bed.name}</h3>
                            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mt-1 mb-3">{bed.type}</p>
                            
                            <div className="flex flex-wrap gap-2">
                              <span className="bg-blue-50 text-blue-700 border border-blue-100 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md shadow-sm flex items-center gap-1">
                                {getIrrigationIcon(bed.irrigation_type)} {bed.irrigation_type}
                              </span>
                              {bed.dimensions && (
                                <span className="bg-stone-50 text-stone-600 border border-stone-200 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md shadow-sm">
                                  📐 {bed.dimensions}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            );
          })
        )}
      </div>

      {/* CREATE AREA MODAL */}
      {isAreaModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-stone-100 p-4 border-b border-stone-200 flex justify-between items-center">
              <h2 className="font-black text-stone-800 tracking-tight">Create Area</h2>
              <button onClick={() => setIsAreaModalOpen(false)} className="p-1 rounded-full text-stone-400 hover:bg-stone-200 hover:text-stone-800">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Area Name</label>
                <input type="text" autoFocus value={newAreaName} onChange={(e) => setNewAreaName(e.target.value)} placeholder="e.g., High Tunnel, Front Yard" className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 font-bold outline-none focus:border-emerald-500 shadow-inner" />
              </div>
              <button onClick={handleCreateArea} disabled={!newAreaName.trim()} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black uppercase tracking-widest shadow-xl shadow-emerald-900/20 active:scale-95 transition-all mt-2 disabled:opacity-50">
                Save Area
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE BED MODAL */}
      {isBedModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-emerald-50 p-4 border-b border-emerald-100 flex justify-between items-center">
              <h2 className="font-black text-emerald-900 tracking-tight">Add Growing Bed</h2>
              <button onClick={() => setIsBedModalOpen(false)} className="p-1 rounded-full text-emerald-600 hover:bg-emerald-200">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
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
                <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Dimensions (Optional)</label>
                <input type="text" value={bedForm.dimensions || ''} onChange={(e) => setBedForm({...bedForm, dimensions: e.target.value})} placeholder="e.g., 4x8 ft, 15 Gallon" className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm outline-none focus:border-emerald-500" />
              </div>

              <button onClick={handleCreateBed} disabled={!bedForm.name?.trim()} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black uppercase tracking-widest shadow-xl shadow-emerald-900/20 active:scale-95 transition-all mt-4 disabled:opacity-50">
                Save to Map
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}