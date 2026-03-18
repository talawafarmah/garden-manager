"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { InventorySeed, SeedCategory, SeedlingTray, AppView } from '../types';

// CORE COMPONENTS
import Dashboard from '../components/Dashboard';
import ScannerImporter from '../components/ScannerImporter';
import VaultList from '../components/VaultList';
import SeedDetail from '../components/SeedDetail';
import SeedEdit from '../components/SeedEdit';
import TrayList from '../components/TrayList';
import TrayDetail from '../components/TrayDetail';
import TrayEdit from '../components/TrayEdit';
import SeedlingsList from '../components/SeedlingsList';

// AMENDMENT MODULE COMPONENTS
import AmendmentList from '../components/amendments/AmendmentList';
import NewAmendmentForm from '../components/amendments/NewAmendmentForm';
import AmendmentDetailPage from './amendments/[id]/page'; // Adjust path if you moved the detail UI to a component

// ADMIN & PLANNING COMPONENTS
import AdminHub from '../components/AdminHub';
import AdminCategories from '../components/AdminCategories';
import AdminSeasons from '../components/AdminSeasons';
import AdminDemand from '../components/AdminDemand';
import GrowPlanner from '../components/GrowPlanner';
import FarmMap from '../components/FarmMap';
import Apothecary from '../components/Apothecary';

// UPDATED VALID VIEWS
const VALID_VIEWS = [
  'dashboard', 'vault', 'seed_detail', 'seed_edit', 'scanner', 'importer',
  'trays', 'tray_detail', 'tray_edit', 'seedlings',
  'admin_hub', 'admin_categories', 'admin_seasons', 'admin_demand', 'grow_planner',
  'farm_map', 'apothecary', 'amendments', 'amendment_detail', 'amendment_new'
];

export default function App() {
  const [activeView, setActiveView] = useState<AppView | any>('dashboard');
  const [selectedSeed, setSelectedSeed] = useState<any>(null); 
  const [selectedTray, setSelectedTray] = useState<SeedlingTray | null>(null);
  const [selectedAmendment, setSelectedAmendment] = useState<any>(null);

  const [inventory, setInventory] = useState<InventorySeed[]>([]);
  const [categories, setCategories] = useState<SeedCategory[]>([]);
  const [trays, setTrays] = useState<SeedlingTray[]>([]);
  const [amendments, setAmendments] = useState<any[]>([]);
  const [isLoadingDB, setIsLoadingDB] = useState(false);

  const [vaultState, setVaultState] = useState({ searchQuery: "", activeFilter: "All", page: 0, scrollY: 0 });
  const [userRole, setUserRole] = useState<'admin' | 'viewer'>('viewer');

  useEffect(() => {
    if (typeof document !== 'undefined') {
      const cookies = document.cookie.split('; ');
      const roleCookie = cookies.find(row => row.startsWith('app_role='));
      if (roleCookie) {
        const role = roleCookie.split('=')[1];
        if (role === 'admin') setUserRole('admin');
      }
    }
  }, []);

  const fetchCategories = async () => {
    const { data } = await supabase.from('seed_categories').select('*').order('name');
    if (data) setCategories(data);
  };

  const fetchInventory = async () => {
    setIsLoadingDB(true);
    const { data } = await supabase.from('seed_inventory').select('*').order('created_at', { ascending: false });
    if (data) setInventory(data.map(s => ({ ...s, companion_plants: s.companion_plants || [] })));
    setIsLoadingDB(false);
  };

  const fetchTrays = async () => {
    const { data } = await supabase.from('seedling_trays').select('*').order('sown_date', { ascending: false });
    if (data) {
       setTrays(data.map(t => ({ 
         ...t, contents: t.contents || [], images: t.images || [], humidity_dome: t.humidity_dome || false, 
         grow_light: t.grow_light || false, first_germination_date: t.first_germination_date || '', 
         first_planted_date: t.first_planted_date || '', potting_mix: t.potting_mix || '', location: t.location || '' 
       })));
    }
  };

  const fetchAmendments = async () => {
    const { data } = await supabase.from('amendments').select('*').order('brand');
    if (data) setAmendments(data);
  };

  useEffect(() => { 
    fetchCategories(); 
    fetchInventory(); 
    fetchTrays(); 
    fetchAmendments();
  }, []);

  const applyRoute = (view: AppView | any, payload: any = null) => {
    setActiveView(view);
    if (typeof window !== 'undefined') window.scrollTo(0, 0);

    // FIXED: Added 'amendment_new' to the safe list so it doesn't clear the payload when editing!
    if (!['seed_detail', 'seed_edit', 'tray_detail', 'tray_edit', 'amendment_detail', 'amendment_new'].includes(view)) {
        setSelectedSeed(null); 
        setSelectedTray(null);
        setSelectedAmendment(null);
    }
    
    if (view === 'seed_detail' || view === 'seed_edit') setSelectedSeed(payload);
    if (view === 'tray_detail' || view === 'tray_edit') setSelectedTray(payload);
    
    // FIXED: Assign the payload if we are viewing OR editing an amendment
    if (view === 'amendment_detail' || view === 'amendment_new') setSelectedAmendment(payload);
    
    // Refresh lists when navigating to them
    if (view === 'vault') fetchInventory();
    if (view === 'trays') { fetchTrays(); fetchInventory(); }
    if (view === 'amendments') fetchAmendments();
  };

  const navigateTo = (view: AppView | any, payload: any = null, replace: boolean = false) => {
    if (typeof window !== 'undefined') {
        if (replace) window.history.replaceState({ view, payload }, '', `#${view}`);
        else window.history.pushState({ view, payload }, '', `#${view}`);
    }
    applyRoute(view, payload);
  };

  const handleGoBack = (fallbackView: AppView | any) => {
     if (typeof window !== 'undefined') {
         if (window.history.length > 2) window.history.back();
         else navigateTo(fallbackView);
     } else applyRoute(fallbackView);
  };

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
        if (e.state && e.state.view) {
            applyRoute(e.state.view, e.state.payload);
        } else {
            const hash = window.location.hash.replace('#', '') as AppView;
            if (VALID_VIEWS.includes(hash)) applyRoute(hash);
            else applyRoute('dashboard');
        }
    };
    
    window.addEventListener('popstate', handlePopState);
    
    const initialHash = window.location.hash.replace('#', '') as AppView;
    if (initialHash && VALID_VIEWS.includes(initialHash)) {
         window.history.replaceState({ view: initialHash }, '', `#${initialHash}`);
         applyRoute(initialHash);
    } else {
         window.history.replaceState({ view: 'dashboard' }, '', '#dashboard');
    }
    
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  switch (activeView) {
    case 'dashboard': return <Dashboard navigateTo={navigateTo} userRole={userRole} />;
    case 'scanner':
    case 'importer': return <ScannerImporter isScanMode={activeView === 'scanner'} categories={categories} setCategories={setCategories} inventory={inventory} setInventory={setInventory} navigateTo={navigateTo} handleGoBack={handleGoBack} />;
    case 'vault': return <VaultList inventory={inventory} setInventory={setInventory} categories={categories} isLoadingDB={isLoadingDB} navigateTo={navigateTo} handleGoBack={handleGoBack} vaultState={vaultState} setVaultState={setVaultState} userRole={userRole} />;
    case 'seed_edit': return selectedSeed ? <SeedEdit key={selectedSeed.id} seed={selectedSeed} inventory={inventory} setInventory={setInventory} categories={categories} setCategories={setCategories} navigateTo={navigateTo} handleGoBack={handleGoBack} /> : <Dashboard navigateTo={navigateTo} userRole={userRole} />;
    case 'trays': return <TrayList trays={trays} inventory={inventory} isLoadingDB={isLoadingDB} navigateTo={navigateTo} handleGoBack={handleGoBack} userRole={userRole} />;
    case 'seedlings': return <SeedlingsList navigateTo={navigateTo} handleGoBack={handleGoBack} userRole={userRole} />;
    
    case 'seed_detail': return selectedSeed ? <SeedDetail key={selectedSeed.id} seed={selectedSeed} inventory={inventory} trays={trays} categories={categories} navigateTo={navigateTo} handleGoBack={handleGoBack} userRole={userRole} /> : <Dashboard navigateTo={navigateTo} userRole={userRole} />;
    case 'tray_edit': return <TrayEdit key={selectedTray?.id || 'new_tray'} tray={selectedTray} trays={trays} setTrays={setTrays} inventory={inventory} categories={categories} navigateTo={navigateTo} handleGoBack={handleGoBack} />;
    case 'tray_detail': return selectedTray ? <TrayDetail key={selectedTray.id} tray={selectedTray} trays={trays} inventory={inventory} navigateTo={navigateTo} handleGoBack={handleGoBack} userRole={userRole} /> : <Dashboard navigateTo={navigateTo} userRole={userRole} />;

    // AMENDMENT VIEWS
    case 'amendments': return <AmendmentList initialAmendments={amendments} navigateTo={navigateTo} handleGoBack={handleGoBack} />;
    
    // FIXED: Passed initialData here!
    case 'amendment_new': return <NewAmendmentForm navigateTo={navigateTo} handleGoBack={handleGoBack} initialData={selectedAmendment} />;
    
    case 'amendment_detail': return <AmendmentDetailPage params={{ id: selectedAmendment?.id }} navigateTo={navigateTo} handleGoBack={handleGoBack} />;
    
    // ADMIN HUB & PLANNERS
    case 'admin_hub': return <AdminHub navigateTo={navigateTo} handleGoBack={handleGoBack} userRole={userRole} />;
    case 'admin_categories': return <AdminCategories categories={categories} setCategories={setCategories} inventory={inventory} setInventory={setInventory} navigateTo={navigateTo} handleGoBack={handleGoBack} userRole={userRole} />;
    case 'admin_seasons': return <AdminSeasons navigateTo={navigateTo} handleGoBack={handleGoBack} userRole={userRole} />;
    case 'admin_demand': return <AdminDemand categories={categories} navigateTo={navigateTo} handleGoBack={handleGoBack} userRole={userRole} />;
    case 'grow_planner': return <GrowPlanner categories={categories} navigateTo={navigateTo} handleGoBack={handleGoBack} userRole={userRole} />;
    case 'farm_map':  return <FarmMap navigateTo={navigateTo} handleGoBack={handleGoBack} />;
    case 'apothecary':  
      return (
        <Apothecary 
          navigateTo={navigateTo} 
          handleGoBack={handleGoBack} 
          amendments={amendments} 
        />
      );
    
    default: return <Dashboard navigateTo={navigateTo} userRole={userRole} />;
  }
}