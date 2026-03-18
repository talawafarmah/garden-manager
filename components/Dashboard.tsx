"use client";

import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { AppView, FarmTask, GardenBed, Season } from '../types';

interface Props {
  navigateTo: (view: AppView) => void;
  userRole?: string; 
}

export default function Dashboard({ navigateTo, userRole }: Props) {
  const [tasks, setTasks] = useState<FarmTask[]>([]);
  const [activeSeasonId, setActiveSeasonId] = useState<string | null>(null);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);

  const wakeLockRef = useRef<any>(null);

  useEffect(() => {
    const requestWakeLock = async () => {
      try { if ('wakeLock' in navigator) wakeLockRef.current = await navigator.wakeLock.request('screen'); } 
      catch (err: any) { console.error(`Wake Lock error: ${err.name}, ${err.message}`); }
    };
    requestWakeLock();
    const handleVisibilityChange = () => { if (document.visibilityState === 'visible') requestWakeLock(); };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current !== null) { wakeLockRef.current.release(); wakeLockRef.current = null; }
    };
  }, []);

  // --- VERSION 3.0 SMART GENERATOR ---
  useEffect(() => {
    const initializeDashboard = async () => {
      setIsLoadingTasks(true);
      
      const { data: seasonData } = await supabase.from('seasons').select('*').order('created_at', { ascending: false });
      let currentSeasonId = null;
      if (seasonData && seasonData.length > 0) {
        currentSeasonId = (seasonData.find((s: Season) => s.status === 'Active') || seasonData[0]).id;
        setActiveSeasonId(currentSeasonId);
      }

      if (currentSeasonId) {
        const [bedRes, taskRes, recipeRes, activePlantingsRes] = await Promise.all([
          supabase.from('garden_beds').select('*'),
          supabase.from('farm_tasks').select('*').eq('season_id', currentSeasonId).eq('status', 'Pending').order('due_date', { ascending: true }),
          supabase.from('recipes').select('*'),
          supabase.from('field_plantings').select('bed_id').eq('season_id', currentSeasonId).eq('status', 'Growing')
        ]);

        const beds = bedRes.data || [];
        const recipes = recipeRes.data || [];
        let currentTasks = taskRes.data || [];
        const activeBedIds = new Set(activePlantingsRes.data?.map(p => p.bed_id) || []);

        // 1. SELF-CLEANING GHOST TASKS
        const validTasks: FarmTask[] = [];
        const staleTaskIds: string[] = [];
        for (const task of currentTasks) {
          if ((task.category === 'Watering' || task.category === 'Feeding') && task.related_bed_id && !activeBedIds.has(task.related_bed_id)) {
            staleTaskIds.push(task.id);
          } else { validTasks.push(task); }
        }
        currentTasks = validTasks; 
        if (staleTaskIds.length > 0) supabase.from('farm_tasks').delete().in('id', staleTaskIds).then();

        // 2. SETUP VARIABLES FOR NEW TASK GENERATION
        const existingWaterBeds = new Set(currentTasks.filter(t => t.category === 'Watering').map(t => t.related_bed_id));
        const existingFeedBeds = new Set(currentTasks.filter(t => t.category === 'Feeding').map(t => t.related_bed_id));
        const existingBrewTitles = new Set(currentTasks.filter(t => t.category === 'Brewing').map(t => t.title));
        
        const todayObj = new Date(); todayObj.setHours(0,0,0,0);
        const todayStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
        
        const newTasks: Partial<FarmTask>[] = [];
        const brewAggregation: Record<string, { recipe: any, totalDrench: number, beds: string[] }> = {};

        // 3. ANALYZE BEDS FOR WATERING AND FEEDING
        for (const bed of beds) {
          if (!activeBedIds.has(bed.id)) continue;

          // --- WATERING LOGIC ---
          if (!existingWaterBeds.has(bed.id)) {
            let isWaterDue = !bed.last_watered_date;
            if (bed.last_watered_date) {
              const diffTime = Math.abs(todayObj.getTime() - new Date(bed.last_watered_date + 'T00:00:00').getTime());
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              if (diffDays >= (bed.watering_frequency_days || 3)) isWaterDue = true;
            }
            if (isWaterDue) {
              let actionText = bed.irrigation_type?.includes('SIP') ? 'Top up SIP Reservoir for' : bed.irrigation_type?.includes('Olla') ? 'Fill Ollas in' : bed.irrigation_type?.includes('Drip') ? 'Run Drip Line for' : 'Water';
              newTasks.push({ season_id: currentSeasonId, title: `${actionText} ${bed.name}`, category: 'Watering', due_date: todayStr, status: 'Pending', related_bed_id: bed.id });
            }
          }

          // --- FEEDING & BREWING LOGIC (V3.0) ---
          if (bed.feed_frequency_days && bed.drench_volume_gallons) {
              let isFeedDue = false;
              let targetFeedDateStr = todayStr;

              if (!bed.last_fed_date) {
                 isFeedDue = true;
              } else {
                 const lastFed = new Date(bed.last_fed_date + 'T00:00:00');
                 const diffDays = Math.ceil(Math.abs(todayObj.getTime() - lastFed.getTime()) / (1000*60*60*24));
                 const daysUntilFeed = bed.feed_frequency_days - diffDays;
                 
                 // If due within the next 3 days, trigger the workflow
                 if (daysUntilFeed <= 3) {
                     isFeedDue = true;
                     const targetObj = new Date(todayObj);
                     targetObj.setDate(targetObj.getDate() + Math.max(0, daysUntilFeed));
                     targetFeedDateStr = `${targetObj.getFullYear()}-${String(targetObj.getMonth() + 1).padStart(2, '0')}-${String(targetObj.getDate()).padStart(2, '0')}`;
                 }
              }

              if (isFeedDue && !existingFeedBeds.has(bed.id)) {
                  const activeRecipeId = (bed.current_stage === 'Flowering/Fruiting' || bed.current_stage === 'Bloom') ? bed.recipe_bloom_id : bed.recipe_veg_id;
                  const recipe = recipes.find(r => r.id === activeRecipeId);
                  const recipeName = recipe ? recipe.name : 'Fertilizer';

                  newTasks.push({ season_id: currentSeasonId, title: `Feed ${bed.name} (${recipeName})`, category: 'Feeding', due_date: targetFeedDateStr, status: 'Pending', related_bed_id: bed.id });

                  // Aggregation for brewing tasks
                  if (recipe && ['liquid_tea', 'extract', 'ferment'].includes(recipe.type)) {
                      if (!brewAggregation[recipe.id]) brewAggregation[recipe.id] = { recipe, totalDrench: 0, beds: [] };
                      brewAggregation[recipe.id].totalDrench += Number(bed.drench_volume_gallons);
                      brewAggregation[recipe.id].beds.push(bed.name);
                  }
              }
          }
        }

        // 4. GENERATE AGGREGATED BREW TASKS
        for (const req of Object.values(brewAggregation)) {
           const { recipe, totalDrench, beds } = req;
           const dilution = recipe.dilution_ratio || 1;
           const baseBrew = recipe.base_brew_gallons || 5;
           
           const concentrateNeeded = totalDrench / dilution;
           const multiplier = concentrateNeeded / baseBrew;
           
           const brewTitle = `BREW: ${concentrateNeeded.toFixed(2)} Gal of ${recipe.name}`;
           if (!existingBrewTitles.has(brewTitle)) {
               newTasks.push({
                   season_id: currentSeasonId,
                   title: brewTitle,
                   category: 'Brewing',
                   due_date: todayStr, // Brew immediately for upcoming feeds
                   status: 'Pending',
                   notes: `${multiplier.toFixed(2)}x Scale Needed.\nRequires ${totalDrench} Gal drench total for: ${beds.join(', ')}`
               });
           }
        }

        if (newTasks.length > 0) {
          const { data } = await supabase.from('farm_tasks').insert(newTasks).select();
          if (data) currentTasks = [...currentTasks, ...data].sort((a, b) => a.due_date.localeCompare(b.due_date));
        }

        setTasks(currentTasks);
      }
      setIsLoadingTasks(false);
    };

    initializeDashboard();
  }, []);

  const handleCompleteTask = async (task: FarmTask) => {
    setTasks(tasks.filter(t => t.id !== task.id));
    const todayObj = new Date();
    const todayStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
    const nowIso = todayObj.toISOString();

    await supabase.from('farm_tasks').update({ status: 'Completed', completed_at: nowIso }).eq('id', task.id);

    if (task.related_bed_id) {
      if (task.category === 'Watering') {
         await supabase.from('garden_beds').update({ last_watered_date: todayStr }).eq('id', task.related_bed_id);
      } else if (task.category === 'Feeding') {
         await supabase.from('garden_beds').update({ last_fed_date: todayStr }).eq('id', task.related_bed_id);
      }
    }
  };

  const getCategoryStyles = (category: string) => {
      if (category === 'Watering') return 'bg-blue-100 text-blue-700 border-blue-200';
      if (category === 'Feeding') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      if (category === 'Brewing') return 'bg-purple-100 text-purple-800 border-purple-200';
      return 'bg-amber-100 text-amber-700 border-amber-200';
  };

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900 pb-20">
      <header className="bg-emerald-700 text-white p-6 shadow-md rounded-b-2xl">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-baseline gap-2">
              Garden Manager
              <span className="text-sm font-normal text-emerald-300 select-none">v3.0</span>
            </h1>
            <p className="text-emerald-100 text-sm mt-1">Zone 5b • Last Frost: May 1-10</p>
          </div>
          <svg className="w-8 h-8 text-emerald-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
        </div>
      </header>

      <div className="max-w-md mx-auto p-4 mt-4 space-y-6">
        
        {/* AUTOMATED ACTION CENTER */}
        <section>
          <div className="flex justify-between items-end mb-3 px-1">
            <h2 className="text-lg font-semibold text-stone-800">Daily Action Center</h2>
          </div>
          
          <div className="bg-white p-4 rounded-xl shadow-sm border border-stone-100">
            {isLoadingTasks ? (
              <div className="flex justify-center py-6 text-stone-300">
                <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              </div>
            ) : tasks.length === 0 ? (
              <div className="text-center py-6">
                <div className="text-3xl mb-2">🎉</div>
                <h3 className="font-bold text-stone-800">All caught up!</h3>
                <p className="text-xs text-stone-500 mt-1">Watering schedules are looking good. Check back tomorrow!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tasks.map(task => {
                  const isOverdue = new Date(task.due_date + 'T00:00:00') < new Date(new Date().setHours(0,0,0,0));
                  const isBrewing = task.category === 'Brewing';

                  return (
                    <div key={task.id} className="flex items-start gap-3 p-3 bg-stone-50 rounded-xl border border-stone-100 group transition-all hover:border-emerald-200">
                      <button 
                        onClick={() => handleCompleteTask(task)}
                        className={`w-6 h-6 rounded-full border-2 mt-0.5 flex-shrink-0 flex items-center justify-center transition-colors ${isBrewing ? 'border-purple-300 hover:border-purple-500 hover:bg-purple-50' : 'border-stone-300 hover:border-emerald-500 hover:bg-emerald-50'}`}
                      >
                        <div className={`w-3 h-3 rounded-full opacity-0 group-hover:opacity-100 transition-opacity ${isBrewing ? 'bg-purple-500' : 'bg-emerald-500'}`} />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold leading-tight ${isBrewing ? 'text-purple-900' : 'text-stone-800'}`}>{task.title}</p>
                        
                        {task.notes && (
                           <p className="text-[10px] text-stone-500 mt-1.5 whitespace-pre-wrap leading-relaxed border-l-2 border-stone-200 pl-2">
                             {task.notes}
                           </p>
                        )}
                        
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${getCategoryStyles(task.category)}`}>
                            {task.category}
                          </span>
                          <span className={`text-[10px] font-bold ${isOverdue ? 'text-red-500' : 'text-stone-400'}`}>
                            Due: {new Date(task.due_date + 'T12:00:00').toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}
                          </span>
                        </div>

                        {isBrewing && (
                          <button onClick={() => navigateTo('apothecary')} className="mt-3 text-[10px] font-black uppercase tracking-widest text-purple-700 bg-purple-100 hover:bg-purple-200 px-3 py-1.5 rounded-lg border border-purple-200 transition-colors w-fit flex items-center gap-1.5 shadow-sm">
                             <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                             Open Brewery
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* FARM & FIELD SECTION */}
        <section>
          <h2 className="text-lg font-semibold text-stone-800 mb-3 px-1">Farm & Field</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            <button onClick={() => navigateTo('farm_map')} className="flex items-center gap-4 p-4 bg-white rounded-xl shadow-sm border border-stone-100 hover:border-emerald-500 hover:shadow-md transition-all active:scale-95 group">
              <div className="bg-emerald-100 p-3 rounded-full text-emerald-600 group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
              </div>
              <div className="text-left">
                <span className="block text-lg font-bold text-stone-700 leading-tight">Farm Map</span>
                <span className="text-xs text-stone-400 font-medium">Beds & Plantings</span>
              </div>
            </button>

            <button onClick={() => navigateTo('apothecary')} className="flex items-center gap-4 p-4 bg-white rounded-xl shadow-sm border border-stone-100 hover:border-purple-500 hover:shadow-md transition-all active:scale-95 group">
              <div className="bg-purple-100 p-3 rounded-full text-purple-600 group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
              </div>
              <div className="text-left">
                <span className="block text-lg font-bold text-stone-700 leading-tight">Apothecary</span>
                <span className="text-xs text-stone-400 font-medium">Amendments & Teas</span>
              </div>
            </button>

          </div>
        </section>

        {/* INVENTORY MANAGEMENT */}
        <section>
          <h2 className="text-lg font-semibold text-stone-800 mb-3 px-1">Inventory Management</h2>
          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => navigateTo('scanner')} className="flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-sm border border-stone-100 hover:border-emerald-500 hover:shadow-md transition-all active:scale-95">
              <div className="bg-emerald-100 p-3 rounded-full mb-2 text-emerald-600"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg></div>
              <span className="text-sm font-medium">Scan Packet</span>
            </button>

            <button onClick={() => navigateTo('importer')} className="flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-sm border border-stone-100 hover:border-blue-500 hover:shadow-md transition-all active:scale-95">
              <div className="bg-blue-100 p-3 rounded-full mb-2 text-blue-600"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg></div>
              <span className="text-sm font-medium">Import URL</span>
            </button>
            
            <button onClick={() => navigateTo('vault')} className="flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-sm border border-stone-100 hover:border-amber-500 hover:shadow-md transition-all active:scale-95">
              <div className="bg-amber-100 p-3 rounded-full mb-2 text-amber-600"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg></div>
              <span className="text-sm font-medium">Seed Vault</span>
            </button>

            <button onClick={() => navigateTo('trays')} className="flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-sm border border-stone-100 hover:border-purple-500 hover:shadow-md transition-all active:scale-95">
              <div className="bg-purple-100 p-3 rounded-full mb-2 text-purple-600"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg></div>
              <span className="text-sm font-medium">Tray Tracker</span>
            </button>

            <button onClick={() => navigateTo('seedlings')} className="col-span-2 flex items-center justify-center gap-4 p-4 bg-white rounded-xl shadow-sm border border-stone-100 hover:border-teal-500 hover:shadow-md transition-all active:scale-95">
              <div className="bg-teal-100 p-3 rounded-full text-teal-600"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg></div>
              <span className="text-lg font-bold text-stone-700">Seedling Ledger</span>
            </button>
          </div>
        </section>

        {/* ADMIN SECTION - UNCONDITIONALLY RENDERED */}
        <section className="mt-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 mb-3 px-1">System Administration</h2>
          <button 
            onClick={() => navigateTo('admin_hub')} 
            className="w-full bg-stone-900 p-4 rounded-xl shadow-md border border-stone-800 text-left hover:bg-stone-800 hover:border-stone-600 transition-all active:scale-95 flex items-center justify-between group"
          >
            <div className="flex items-center gap-4">
              <div className="bg-stone-800 text-white p-3 rounded-lg group-hover:scale-110 group-hover:bg-emerald-600 transition-all shadow-inner">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </div>
              <div>
                <h3 className="font-black text-white text-lg">Admin Control Panel</h3>
                <p className="text-xs text-stone-400 font-medium">Planners, Categories & Links</p>
              </div>
            </div>
            <svg className="w-5 h-5 text-stone-500 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </section>

      </div>
    </main>
  );
}