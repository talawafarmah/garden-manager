"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { InventorySeed, SeedCategory, SeedlingTray, AppView } from '../types';

import Dashboard from '../components/Dashboard';
import ScannerImporter from '../components/ScannerImporter';
import VaultList from '../components/VaultList';
import SeedDetail from '../components/SeedDetail';
import SeedEdit from '../components/SeedEdit';
import TrayList from '../components/TrayList';
import TrayDetail from '../components/TrayDetail';
import TrayEdit from '../components/TrayEdit';

export default function App() {
  const [activeView, setActiveView] = useState<AppView>('dashboard');
  const [selectedSeed, setSelectedSeed] = useState<any>(null); 
  const [selectedTray, setSelectedTray] = useState<SeedlingTray | null>(null);

  const [inventory, setInventory] = useState<InventorySeed[]>([]);
  const [categories, setCategories] = useState<SeedCategory[]>([]);
  const [trays, setTrays] = useState<SeedlingTray[]>([]);
  const [isLoadingDB, setIsLoadingDB] = useState(false);

  const [vaultState, setVaultState] = useState({ searchQuery: "", activeFilter: "All", page: 0, scrollY: 0 });

  // RESTORED: Role state defaults to viewer for safety
  const [userRole, setUserRole] = useState<'admin' | 'viewer'>('viewer');

  // RESTORED: Read the Role Cookie on initial load
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const cookies = document.cookie.split('; ');
      const roleCookie = cookies.find(row => row.startsWith('app_role='));
      if (roleCookie) {
        const role = roleCookie.split('=')[1];
        if (role === 'admin') {
          setUserRole('admin');
        }
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
         ...t, 
         contents: t.contents || [], 
         images: t.images || [], 
         humidity_dome: t.humidity_dome || false, 
         grow_light: t.grow_light || false, 
         first_germination_date: t.first_germination_date || '', 
         first_planted_date: t.first_planted_date || '', 
         potting_mix: t.potting_mix || '', 
         location: t.location || '' 
       })));
    }
  };

  useEffect(() => { fetchCategories(); fetchInventory(); fetchTrays(); }, []);

  const applyRoute = (view: AppView, payload: any = null) => {
    setActiveView(view);
    if (typeof window !== 'undefined') window.scrollTo(0, 0);

    if (view === 'dashboard' || view === 'vault' || view === 'trays' || view === 'scanner' || view === 'importer') {
        setSelectedSeed(null); setSelectedTray(null);
    }
    if (view === 'seed_detail' && payload) setSelectedSeed(payload);
    if (view === 'seed_edit' && payload) setSelectedSeed(payload);
    if (view === 'tray_detail' && payload) setSelectedTray(payload);
    if (view === 'tray_edit' && payload) setSelectedTray(payload);
    
    if (view === 'vault') fetchInventory();
    if (view === 'trays') { fetchTrays(); fetchInventory(); }
  };

  // ADDED 'replace' flag to prevent history loops when saving edits
  const navigateTo = (view: AppView, payload: any = null, replace: boolean = false) => {
    if (typeof window !== 'undefined') {
        if (replace) {
            window.history.replaceState({ view, payload }, '', `#${view}`);
        } else {
            window.history.pushState({ view, payload }, '', `#${view}`);
        }
    }
    applyRoute(view, payload);
  };

  const handleGoBack = (fallbackView: AppView) => {
     if (typeof window !== 'undefined') {
         if (window.history.length > 2) { window.history.back(); } 
         else { navigateTo(fallbackView); }
     } else applyRoute(fallbackView);
  };

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
        if (e.state && e.state.view) applyRoute(e.state.view, e.state.payload);
        else {
            const hash = window.location.hash.replace('#', '') as AppView;
            if (['vault', 'trays', 'scanner', 'importer'].includes(hash)) applyRoute(hash);
            else applyRoute('dashboard');
        }
    };
    window.addEventListener('popstate', handlePopState);
    
    const initialHash = window.location.hash.replace('#', '') as AppView;
    if (initialHash && ['vault', 'trays'].includes(initialHash)) {
         window.history.replaceState({ view: initialHash }, '', `#${initialHash}`);
         applyRoute(initialHash);
    } else {
         window.history.replaceState({ view: 'dashboard' }, '', '#dashboard');
    }
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // RESTORED: Passing userRole down to VaultList, SeedDetail, TrayList, and TrayDetail
  switch (activeView) {
    case 'scanner':
    case 'importer':
      return <ScannerImporter isScanMode={activeView === 'scanner'} categories={categories} setCategories={setCategories} inventory={inventory} setInventory={setInventory} navigateTo={navigateTo} handleGoBack={handleGoBack} />;
    case 'vault':
      return <VaultList inventory={inventory} setInventory={setInventory} categories={categories} isLoadingDB={isLoadingDB} navigateTo={navigateTo} handleGoBack={handleGoBack} vaultState={vaultState} setVaultState={setVaultState} userRole={userRole} />;
    case 'seed_detail':
      return selectedSeed ? <SeedDetail key={selectedSeed.id} seed={selectedSeed} trays={trays} categories={categories} navigateTo={navigateTo} handleGoBack={handleGoBack} userRole={userRole} /> : <Dashboard navigateTo={navigateTo} />;
    case 'seed_edit':
      return selectedSeed ? <SeedEdit key={selectedSeed.id} seed={selectedSeed} inventory={inventory} setInventory={setInventory} categories={categories} setCategories={setCategories} navigateTo={navigateTo} handleGoBack={handleGoBack} /> : <Dashboard navigateTo={navigateTo} />;
    case 'trays':
      return <TrayList trays={trays} isLoadingDB={isLoadingDB} navigateTo={navigateTo} handleGoBack={handleGoBack} userRole={userRole} />;
    case 'tray_detail':
      return selectedTray ? <TrayDetail key={selectedTray.id} tray={selectedTray} inventory={inventory} navigateTo={navigateTo} handleGoBack={handleGoBack} userRole={userRole} /> : <Dashboard navigateTo={navigateTo} />;
    case 'tray_edit':
      return selectedTray ? <TrayEdit key={selectedTray.id} tray={selectedTray} trays={trays} setTrays={setTrays} inventory={inventory} categories={categories} navigateTo={navigateTo} handleGoBack={handleGoBack} /> : <Dashboard navigateTo={navigateTo} />;
    case 'dashboard':
    default:
      return <Dashboard navigateTo={navigateTo} />;
  }
}