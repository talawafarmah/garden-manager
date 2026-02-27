"use client";

import React, { useState, useRef, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Use environment variable for your local Next.js/Vercel app
const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || ""; 

// Define data shapes
interface SeedData {
  variety_name?: string;
  vendor?: string;
  days_to_maturity?: number | string;
  species?: string;
  category?: string;
  notes?: string;
  
  // New Botanical Attributes
  cold_stratification?: boolean;
  stratification_days?: number | string;
  light_required?: boolean;
  germination_days?: string;
  seed_depth?: string;
  plant_spacing?: string;
  row_spacing?: string;
  sunlight?: string;
  lifecycle?: string;
}

interface InventorySeed {
  id: string;
  category: string;
  variety_name: string;
  vendor: string;
  days_to_maturity: number | string;
  species: string;
  notes: string;
  images: string[];
  primaryImageIndex: number;
  
  // New Botanical Attributes
  cold_stratification: boolean;
  stratification_days: number | string;
  light_required: boolean;
  germination_days: string;
  seed_depth: string;
  plant_spacing: string;
  row_spacing: string;
  out_of_stock: boolean; // Quick toggle flag
  sunlight: string;
  lifecycle: string;
}

interface SeedCategory {
  name: string;
  prefix: string;
}

export default function App() {
  // Navigation States
  const [isScanning, setIsScanning] = useState(false);
  const [isViewingInventory, setIsViewingInventory] = useState(false);
  
  // App Data State
  const [inventory, setInventory] = useState<InventorySeed[]>([]);
  const [categories, setCategories] = useState<SeedCategory[]>([]);
  const [isLoadingDB, setIsLoadingDB] = useState(false);
  
  // Scanner States
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<SeedData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New Category Form States
  const [showNewCatForm, setShowNewCatForm] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatPrefix, setNewCatPrefix] = useState("");

  // Inventory & Detail States
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [selectedSeed, setSelectedSeed] = useState<InventorySeed | null>(null);
  
  // Edit States
  const [isEditingSeed, setIsEditingSeed] = useState(false);
  const [editFormData, setEditFormData] = useState<InventorySeed | null>(null);
  const editPhotoInputRef = useRef<HTMLInputElement>(null);

  // --- DATABASE FETCHING LOGIC ---
  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (isViewingInventory) {
      fetchInventory();
    }
  }, [isViewingInventory]);

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from('seed_categories')
      .select('*')
      .order('name');
    if (!error && data) {
      setCategories(data);
    }
  };

  const fetchInventory = async () => {
    setIsLoadingDB(true);
    const { data, error } = await supabase
      .from('seed_inventory')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching inventory:", error);
    } else if (data) {
      setInventory(data);
    }
    setIsLoadingDB(false);
  };

  // --- ID GENERATION LOGIC ---
  const generateNextId = async (prefix: string) => {
    const { data, error } = await supabase
      .from('seed_inventory')
      .select('id')
      .ilike('id', `${prefix}%`);
    
    let maxNum = 0;
    if (!error && data) {
      data.forEach(row => {
        const match = row.id.match(new RegExp(`^${prefix}(\\d+)`, 'i'));
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      });
    }
    return `${prefix.toUpperCase()}${maxNum + 1}`;
  };

  // --- QUICK TOGGLE LOGIC ---
  const toggleOutOfStock = async (seed: InventorySeed, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening detail view
    const newStatus = !seed.out_of_stock;
    
    // Optimistic UI Update
    setInventory(inventory.map(s => s.id === seed.id ? { ...s, out_of_stock: newStatus } : s));

    // Update DB
    const { error } = await supabase
      .from('seed_inventory')
      .update({ out_of_stock: newStatus })
      .eq('id', seed.id);

    if (error) {
      alert("Failed to update stock status: " + error.message);
      // Revert on error
      setInventory(inventory.map(s => s.id === seed.id ? { ...s, out_of_stock: !newStatus } : s));
    }
  };

  // --- SCANNER LOGIC ---
  const handleImageCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setImagePreview(url);
      setSelectedFile(file);
      setAnalysisResult(null);
      setErrorMsg(null);
      setShowNewCatForm(false);
    }
  };

  const cancelScan = () => {
    setIsScanning(false);
    setImagePreview(null);
    setSelectedFile(null);
    setAnalysisResult(null);
    setErrorMsg(null);
    setShowNewCatForm(false);
  };

  const handleSaveScannedToInventory = async () => {
    if (analysisResult) {
      let finalCatName = analysisResult.category || 'Uncategorized';
      let finalPrefix = 'U';

      if (showNewCatForm && newCatName.trim() !== '') {
        finalCatName = newCatName.trim();
        finalPrefix = newCatPrefix.trim().toUpperCase() || finalCatName.substring(0, 2).toUpperCase();
        await supabase.from('seed_categories').insert([{ name: finalCatName, prefix: finalPrefix }]);
        setCategories([...categories, { name: finalCatName, prefix: finalPrefix }].sort((a,b) => a.name.localeCompare(b.name)));
      } else {
        const found = categories.find(c => c.name === finalCatName);
        if (found) finalPrefix = found.prefix;
      }

      const newId = await generateNextId(finalPrefix);

      const newSeed: InventorySeed = {
        id: newId,
        category: finalCatName,
        variety_name: analysisResult.variety_name || 'Unknown Variety',
        vendor: analysisResult.vendor || 'Unknown Vendor',
        days_to_maturity: Number(analysisResult.days_to_maturity) || 0,
        species: analysisResult.species || 'Unknown Species',
        notes: analysisResult.notes || '',
        images: imagePreview ? [imagePreview] : [],
        primaryImageIndex: 0,
        
        cold_stratification: analysisResult.cold_stratification || false,
        stratification_days: analysisResult.stratification_days || 0,
        light_required: analysisResult.light_required || false,
        germination_days: analysisResult.germination_days || '',
        seed_depth: analysisResult.seed_depth || '',
        plant_spacing: analysisResult.plant_spacing || '',
        row_spacing: analysisResult.row_spacing || '',
        out_of_stock: false,
        sunlight: analysisResult.sunlight || '',
        lifecycle: analysisResult.lifecycle || ''
      };

      const { error } = await supabase.from('seed_inventory').insert([newSeed]);

      if (error) {
        alert("Failed to save to database: " + error.message);
      } else {
        setInventory([newSeed, ...inventory]);
        alert(`Success! ${newSeed.variety_name} added as ${newSeed.id}`);
        cancelScan();
      }
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = (error) => reject(error);
    });
  };

  const fetchWithRetry = async (url: string, options: RequestInit, retries = 5) => {
    let delay = 1000;
    for (let i = 0; i < retries; i++) {
      try {
        const res = await fetch(url, options);
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).substring(0, 150)}...`);
        return await res.json();
      } catch (e: any) {
        if (i === retries - 1) throw e;
        await new Promise(r => setTimeout(r, delay));
        delay *= 2;
      }
    }
  };

  const analyzeImage = async () => {
    if (!selectedFile) return;
    setIsAnalyzing(true);
    setErrorMsg(null);

    if (!apiKey) {
      setErrorMsg("Missing API Key! Please set NEXT_PUBLIC_GEMINI_API_KEY in your .env.local file.");
      setIsAnalyzing(false);
      return;
    }

    try {
      const base64Data = await fileToBase64(selectedFile);
      const mimeType = selectedFile.type || "image/jpeg";
      
      const payload = {
        contents: [{
          role: "user",
          parts: [
            { text: "Analyze this seed packet. Extract variety name, vendor, days to maturity (number only), botanical species, general category, seed depth, plant spacing, row spacing, days to germination, sunlight requirements (e.g., Full Sun), life cycle (Annual/Perennial), whether it requires cold stratification (boolean), whether it requires light to germinate (boolean), and any growing notes. IMPORTANT: Map the category to a broad group (e.g., Herb, Flower, Pea, Leafy Green, Root Vegetable, Brassica, Vine/Squash, Allium, Tomato, Pepper). If the packet is missing critical information, use your internal botanical knowledge to infer missing data." },
            { inlineData: { mimeType: mimeType, data: base64Data } }
          ]
        }],
        systemInstruction: { parts: [{ text: "You are a master horticulturist AI. Extract accurate botanical data from seed packets into structured JSON. Standardize categories to broad groups (Herb, Flower, Pea, Leafy Green, etc.) so the database remains clean. Infer common botanical requirements if they are missing from the packet text." }] },
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              variety_name: { type: "STRING" },
              vendor: { type: "STRING" },
              days_to_maturity: { type: "INTEGER" },
              species: { type: "STRING" },
              category: { type: "STRING" },
              notes: { type: "STRING" },
              seed_depth: { type: "STRING" },
              plant_spacing: { type: "STRING" },
              row_spacing: { type: "STRING" },
              germination_days: { type: "STRING" },
              sunlight: { type: "STRING" },
              lifecycle: { type: "STRING" },
              cold_stratification: { type: "BOOLEAN" },
              stratification_days: { type: "INTEGER" },
              light_required: { type: "BOOLEAN" }
            }
          }
        }
      };

      let modelToUse = "gemini-2.5-flash-preview-09-2025";
      if (!!process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
        try {
          const modelsRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
          const modelsData = await modelsRes.json();
          if (modelsData.models) {
            const available = modelsData.models
              .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent') && m.name.includes('gemini'))
              .map((m: any) => m.name.replace('models/', ''));
            modelToUse = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"].find(m => available.includes(m)) || modelToUse;
          }
        } catch (e) { modelToUse = "gemini-1.5-flash"; }
      }

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${apiKey}`;
      const result = await fetchWithRetry(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }, 3);

      const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (textResponse) {
        const parsedData = JSON.parse(textResponse.replace(/```json/g, '').replace(/```/g, '').trim());
        
        const aiCat = parsedData.category;
        if (aiCat) {
          const matched = categories.find(c => c.name.toLowerCase() === aiCat.toLowerCase());
          if (matched) {
            parsedData.category = matched.name;
            setShowNewCatForm(false);
          } else {
            parsedData.category = '__NEW__';
            setShowNewCatForm(true);
            setNewCatName(aiCat);
            setNewCatPrefix(aiCat.substring(0, 2).toUpperCase());
          }
        }
        setAnalysisResult(parsedData);
      } else {
        throw new Error("No text returned from AI");
      }
    } catch (err: any) {
      setErrorMsg(`Error: ${err.message || "Unknown error occurred"}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // --- EDIT SEED LOGIC ---
  const handleEditPhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && editFormData) {
      const url = URL.createObjectURL(file);
      setEditFormData({
        ...editFormData,
        images: [...(editFormData.images || []), url]
      });
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    if (!editFormData) return;
    const newImages = editFormData.images.filter((_, idx) => idx !== indexToRemove);
    let newPrimary = editFormData.primaryImageIndex || 0;
    if (indexToRemove === editFormData.primaryImageIndex) newPrimary = 0; 
    else if (indexToRemove < (editFormData.primaryImageIndex || 0)) newPrimary -= 1;
    setEditFormData({ ...editFormData, images: newImages, primaryImageIndex: newPrimary });
  };

  const handleSaveEdit = async () => {
    if (!editFormData) return;
    if (!editFormData.id.trim()) { alert("Shortcode ID is required."); return; }

    if (editFormData.id !== selectedSeed?.id) {
      const isDuplicate = inventory.some(s => s.id.toLowerCase() === editFormData.id.toLowerCase());
      if (isDuplicate) {
        alert(`Error: The shortcode '${editFormData.id}' is already assigned to another seed.`);
        return;
      }
    }

    let finalCatName = editFormData.category;

    if (editFormData.category === '__NEW__' && newCatName.trim() !== '') {
      finalCatName = newCatName.trim();
      const finalPrefix = newCatPrefix.trim().toUpperCase() || finalCatName.substring(0, 2).toUpperCase();
      await supabase.from('seed_categories').insert([{ name: finalCatName, prefix: finalPrefix }]);
      setCategories([...categories, { name: finalCatName, prefix: finalPrefix }].sort((a,b) => a.name.localeCompare(b.name)));
    } else if (editFormData.category === '__NEW__') {
      alert("Please provide a name for the new category.");
      return;
    }

    const payload = { ...editFormData, category: finalCatName };
    const { error } = await supabase.from('seed_inventory').update(payload).eq('id', selectedSeed?.id);

    if (error) {
      alert("Failed to update database: " + error.message);
    } else {
      setInventory(inventory.map(s => s.id === selectedSeed?.id ? payload : s));
      setSelectedSeed(payload);
      setIsEditingSeed(false);
      setShowNewCatForm(false);
    }
  };

  const handleDeleteSeed = async () => {
    if (!selectedSeed) return;
    if (confirm(`Are you sure you want to permanently delete ${selectedSeed.variety_name} (${selectedSeed.id})?`)) {
      const { error } = await supabase.from('seed_inventory').delete().eq('id', selectedSeed.id);
      if (error) {
        alert("Failed to delete from database: " + error.message);
      } else {
        setInventory(inventory.filter(s => s.id !== selectedSeed.id));
        setSelectedSeed(null);
        setIsEditingSeed(false);
      }
    }
  };

  // ==========================================
  // VIEW ROUTING
  // ==========================================

  // --- SCANNER VIEW ---
  if (isScanning) {
    return (
      <main className="min-h-screen bg-stone-900 text-stone-50 flex flex-col">
        <header className="p-4 flex items-center border-b border-stone-800 bg-stone-950">
          <button onClick={cancelScan} className="p-2 mr-2 bg-stone-800 rounded-full hover:bg-stone-700 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h1 className="text-xl font-bold flex items-baseline gap-2">Scan Seed Packet <span className="text-sm font-normal text-stone-500">v1.14</span></h1>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto">
          <input type="file" accept="image/*" capture="environment" ref={fileInputRef} className="hidden" onChange={handleImageCapture} />

          {errorMsg && (
            <div className="w-full max-w-sm bg-red-900/50 border border-red-500 text-red-200 p-4 rounded-xl mb-4 text-xs font-mono break-words">{errorMsg}</div>
          )}

          {analysisResult ? (
            <div className="w-full max-w-sm animate-in slide-in-from-bottom-4 duration-500 pb-10 space-y-4">
              {/* IMAGE PREVIEW HEADER */}
              {imagePreview && (
                <div className="rounded-2xl overflow-hidden border border-stone-700 h-24 relative shadow-lg">
                  <img src={imagePreview} alt="Captured" className="object-cover w-full h-full opacity-60" />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="bg-stone-900/80 px-3 py-1.5 rounded-lg text-xs font-medium text-stone-200 shadow-sm flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      Packet Image Attached
                    </span>
                  </div>
                </div>
              )}

              {/* BASIC DETAILS */}
              <div className="bg-stone-800 rounded-2xl p-5 shadow-xl border border-stone-700 space-y-4">
                <h3 className="text-sm font-bold text-emerald-400 border-b border-stone-700 pb-2">Basic Details</h3>
                
                <div>
                  <label className="block text-xs font-medium text-stone-400 mb-1">Category</label>
                  <select 
                    value={analysisResult.category || ''} 
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '__NEW__') {
                        setShowNewCatForm(true); setNewCatName(""); setNewCatPrefix("");
                      } else setShowNewCatForm(false);
                      setAnalysisResult({ ...analysisResult, category: val });
                    }}
                    className="w-full bg-stone-900 border border-stone-700 rounded-lg p-3 text-stone-100 focus:border-emerald-500 outline-none appearance-none"
                  >
                    <option value="" disabled>Select a category...</option>
                    {categories.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                    <option value="__NEW__" className="font-bold text-emerald-400">+ Add New Category</option>
                  </select>
                </div>

                {showNewCatForm && (
                  <div className="p-4 bg-stone-900/50 border border-emerald-900 rounded-xl space-y-3 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                    <div>
                      <label className="block text-[10px] font-medium text-stone-400 mb-1">Category Name</label>
                      <input type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} className="w-full bg-stone-900 border border-stone-700 rounded-md p-2 text-sm text-stone-100 outline-none" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-stone-400 mb-1">Prefix Code (1-2 letters)</label>
                      <input type="text" maxLength={2} value={newCatPrefix} onChange={(e) => setNewCatPrefix(e.target.value.toUpperCase())} className="w-full bg-stone-900 border border-stone-700 rounded-md p-2 text-sm text-stone-100 font-mono uppercase outline-none" />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-stone-400 mb-1">Variety Name</label>
                  <input type="text" value={analysisResult.variety_name || ''} onChange={(e) => setAnalysisResult({ ...analysisResult, variety_name: e.target.value })} className="w-full bg-stone-900 border border-stone-700 rounded-lg p-3 text-stone-100 font-bold focus:border-emerald-500 outline-none" />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-400 mb-1">Botanical Species</label>
                    <input type="text" value={analysisResult.species || ''} onChange={(e) => setAnalysisResult({ ...analysisResult, species: e.target.value })} className="w-full bg-stone-900 border border-stone-700 rounded-lg p-2 text-stone-100 italic focus:border-emerald-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-400 mb-1">Vendor</label>
                    <input type="text" value={analysisResult.vendor || ''} onChange={(e) => setAnalysisResult({ ...analysisResult, vendor: e.target.value })} className="w-full bg-stone-900 border border-stone-700 rounded-lg p-2 text-stone-100 focus:border-emerald-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-400 mb-1">Life Cycle</label>
                    <input type="text" value={analysisResult.lifecycle || ''} onChange={(e) => setAnalysisResult({ ...analysisResult, lifecycle: e.target.value })} placeholder="Annual, Perennial..." className="w-full bg-stone-900 border border-stone-700 rounded-lg p-2 text-stone-100 focus:border-emerald-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-400 mb-1">Sunlight</label>
                    <input type="text" value={analysisResult.sunlight || ''} onChange={(e) => setAnalysisResult({ ...analysisResult, sunlight: e.target.value })} placeholder="Full Sun..." className="w-full bg-stone-900 border border-stone-700 rounded-lg p-2 text-stone-100 focus:border-emerald-500 outline-none" />
                  </div>
                </div>
              </div>

              {/* PLANTING SPECS */}
              <div className="bg-stone-800 rounded-2xl p-5 shadow-xl border border-stone-700 space-y-4">
                <h3 className="text-sm font-bold text-emerald-400 border-b border-stone-700 pb-2">Planting Specs</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-400 mb-1">Seed Depth</label>
                    <input type="text" value={analysisResult.seed_depth || ''} onChange={(e) => setAnalysisResult({ ...analysisResult, seed_depth: e.target.value })} className="w-full bg-stone-900 border border-stone-700 rounded-lg p-2 text-stone-100 focus:border-emerald-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-400 mb-1">Plant Spacing</label>
                    <input type="text" value={analysisResult.plant_spacing || ''} onChange={(e) => setAnalysisResult({ ...analysisResult, plant_spacing: e.target.value })} className="w-full bg-stone-900 border border-stone-700 rounded-lg p-2 text-stone-100 focus:border-emerald-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-400 mb-1">Row Spacing</label>
                    <input type="text" value={analysisResult.row_spacing || ''} onChange={(e) => setAnalysisResult({ ...analysisResult, row_spacing: e.target.value })} className="w-full bg-stone-900 border border-stone-700 rounded-lg p-2 text-stone-100 focus:border-emerald-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-400 mb-1">Days to Maturity</label>
                    <input type="number" value={analysisResult.days_to_maturity || ''} onChange={(e) => setAnalysisResult({ ...analysisResult, days_to_maturity: e.target.value })} className="w-full bg-stone-900 border border-stone-700 rounded-lg p-2 text-stone-100 focus:border-emerald-500 outline-none" />
                  </div>
                </div>
              </div>

              {/* GERMINATION NEEDS */}
              <div className="bg-stone-800 rounded-2xl p-5 shadow-xl border border-stone-700 space-y-4">
                <h3 className="text-sm font-bold text-emerald-400 border-b border-stone-700 pb-2">Germination Needs</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-stone-400 mb-1">Days to Germination</label>
                    <input type="text" value={analysisResult.germination_days || ''} onChange={(e) => setAnalysisResult({ ...analysisResult, germination_days: e.target.value })} placeholder="e.g. 7-14 days" className="w-full bg-stone-900 border border-stone-700 rounded-lg p-2 text-stone-100 focus:border-emerald-500 outline-none" />
                  </div>
                  <div className="flex items-center gap-2 bg-stone-900 p-2 rounded-lg border border-stone-700">
                    <input type="checkbox" checked={analysisResult.light_required || false} onChange={(e) => setAnalysisResult({ ...analysisResult, light_required: e.target.checked })} className="w-4 h-4 accent-emerald-500" />
                    <label className="text-xs text-stone-200">Needs Light</label>
                  </div>
                  <div className="flex items-center gap-2 bg-stone-900 p-2 rounded-lg border border-stone-700">
                    <input type="checkbox" checked={analysisResult.cold_stratification || false} onChange={(e) => setAnalysisResult({ ...analysisResult, cold_stratification: e.target.checked })} className="w-4 h-4 accent-emerald-500" />
                    <label className="text-xs text-stone-200">Needs Cold Strat.</label>
                  </div>
                  {analysisResult.cold_stratification && (
                    <div className="col-span-2 mt-2">
                      <label className="block text-xs font-medium text-stone-400 mb-1">Stratification Days</label>
                      <input type="number" value={analysisResult.stratification_days || ''} onChange={(e) => setAnalysisResult({ ...analysisResult, stratification_days: e.target.value })} placeholder="Days in fridge..." className="w-full bg-stone-900 border border-stone-700 rounded-lg p-2 text-stone-100 focus:border-emerald-500 outline-none" />
                    </div>
                  )}
                </div>
              </div>

              {/* NOTES */}
              <div className="bg-stone-800 rounded-2xl p-5 shadow-xl border border-stone-700 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-stone-400 mb-1">Growing Notes</label>
                  <textarea value={analysisResult.notes || ''} onChange={(e) => setAnalysisResult({ ...analysisResult, notes: e.target.value })} rows={4} className="w-full bg-stone-900 border border-stone-700 rounded-lg p-3 text-stone-100 focus:border-emerald-500 outline-none resize-none" />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button onClick={() => setAnalysisResult(null)} className="flex-1 py-4 bg-stone-700 rounded-xl font-medium hover:bg-stone-600 transition-colors">Back</button>
                <button onClick={handleSaveScannedToInventory} className="flex-[2] py-4 bg-emerald-600 rounded-xl font-bold hover:bg-emerald-500 shadow-lg shadow-emerald-900/50">Save to Database</button>
              </div>
            </div>
          ) : imagePreview ? (
            <div className="w-full flex flex-col items-center animate-in fade-in duration-300">
              <div className="relative w-full max-w-sm aspect-[3/4] mb-8 rounded-2xl overflow-hidden border-2 border-stone-700 shadow-2xl">
                <img src={imagePreview} alt="Captured" className={`object-cover w-full h-full transition-opacity ${isAnalyzing ? 'opacity-50' : 'opacity-100'}`} />
                {isAnalyzing && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-emerald-400 bg-stone-900/40">
                    <svg className="w-12 h-12 animate-spin mb-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    <span className="font-bold text-lg drop-shadow-md">Extracting Data...</span>
                  </div>
                )}
              </div>
              <div className="flex gap-4 w-full max-w-sm">
                <button onClick={() => fileInputRef.current?.click()} disabled={isAnalyzing} className="flex-1 py-4 bg-stone-800 rounded-xl font-medium hover:bg-stone-700 border border-stone-700 disabled:opacity-50">Retake</button>
                <button onClick={analyzeImage} disabled={isAnalyzing} className="flex-1 py-4 bg-emerald-600 rounded-xl font-bold hover:bg-emerald-500 shadow-lg shadow-emerald-900/50 flex items-center justify-center gap-2 disabled:opacity-50">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  {isAnalyzing ? "Processing..." : "Analyze"}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center justify-center w-full max-w-sm aspect-[3/4] border-2 border-dashed border-stone-600 rounded-3xl bg-stone-800/50 text-stone-400 hover:text-emerald-400 hover:border-emerald-500 active:scale-95">
              <div className="bg-stone-800 p-5 rounded-full mb-4 shadow-lg">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </div>
              <span className="text-lg font-medium">Tap to open camera</span>
            </button>
          )}
        </div>
      </main>
    );
  }

  // --- INVENTORY VIEW (LIST & DETAILS) ---
  if (isViewingInventory) {
    
    // 1. DETAIL VIEW & EDIT VIEW
    if (selectedSeed) {
      if (isEditingSeed && editFormData) {
        return (
          <main className="min-h-screen bg-stone-50 text-stone-900 pb-20">
            <header className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center justify-between border-b border-stone-200">
              <div className="flex items-center gap-3">
                <button onClick={() => { setIsEditingSeed(false); setEditFormData(null); setShowNewCatForm(false); }} className="p-2 text-stone-500 hover:bg-stone-100 rounded-full transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
                <h1 className="text-xl font-bold text-stone-800">Edit Seed</h1>
              </div>
              <button onClick={handleSaveEdit} className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-500 transition-colors shadow-sm">
                Save
              </button>
            </header>

            <div className="max-w-md mx-auto p-4 space-y-5">
              {/* Image Manager */}
              <section className="bg-white p-5 rounded-2xl shadow-sm border border-stone-200">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-stone-800">Photos</h3>
                  <button onClick={() => editPhotoInputRef.current?.click()} className="text-emerald-600 text-sm font-bold flex items-center gap-1 hover:text-emerald-500 bg-emerald-50 px-3 py-1.5 rounded-lg">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Add Photo
                  </button>
                  <input type="file" accept="image/*" capture="environment" ref={editPhotoInputRef} className="hidden" onChange={handleEditPhotoCapture} />
                </div>
                
                <div className="grid grid-cols-3 gap-3">
                  {(!editFormData.images || editFormData.images.length === 0) && <p className="text-xs text-stone-400 col-span-3 text-center py-4">No photos attached.</p>}
                  {(editFormData.images || []).map((img, idx) => (
                    <div key={idx} className={`relative aspect-square rounded-xl overflow-hidden border-2 shadow-sm ${idx === (editFormData.primaryImageIndex || 0) ? 'border-emerald-500' : 'border-stone-200'}`}>
                      <img src={img} alt="Seed" className="w-full h-full object-cover" />
                      <div className="absolute top-1 right-1 flex flex-col gap-1">
                         <button onClick={() => setEditFormData({...editFormData, primaryImageIndex: idx})} className={`p-1.5 rounded-full backdrop-blur-sm ${idx === (editFormData.primaryImageIndex || 0) ? 'bg-emerald-500 text-white shadow-md' : 'bg-stone-900/40 text-stone-100 hover:bg-stone-900/60'}`}>
                           <svg className="w-3.5 h-3.5" fill={idx === (editFormData.primaryImageIndex || 0) ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                         </button>
                         <button onClick={() => handleRemoveImage(idx)} className="p-1.5 rounded-full bg-red-500/80 backdrop-blur-sm text-white hover:bg-red-500 shadow-sm">
                           <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                         </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Data Forms grouped into cards */}
              
              {/* Basics */}
              <section className="bg-white p-5 rounded-2xl shadow-sm border border-stone-200 space-y-4">
                <h3 className="font-bold text-stone-800 border-b border-stone-100 pb-2">Basic Info</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-stone-500 mb-1">Shortcode ID <span className="text-red-400">*</span></label>
                    <input type="text" value={editFormData.id} onChange={(e) => setEditFormData({ ...editFormData, id: e.target.value.toUpperCase() })} className="w-full bg-stone-50 border border-stone-300 rounded-lg p-2.5 text-stone-800 font-mono outline-none focus:border-emerald-500 uppercase" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-stone-500 mb-1">Variety Name</label>
                    <input type="text" value={editFormData.variety_name} onChange={(e) => setEditFormData({ ...editFormData, variety_name: e.target.value })} className="w-full bg-stone-50 border border-stone-300 rounded-lg p-2.5 text-stone-800 font-bold outline-none focus:border-emerald-500" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-stone-500 mb-1">Category</label>
                    <select 
                      value={editFormData.category} 
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '__NEW__') {
                          setShowNewCatForm(true); setNewCatName(""); setNewCatPrefix("");
                        } else setShowNewCatForm(false);
                        setEditFormData({ ...editFormData, category: val });
                      }}
                      className="w-full bg-stone-50 border border-stone-300 rounded-lg p-2.5 text-stone-800 outline-none focus:border-emerald-500 appearance-none"
                    >
                      <option value="" disabled>Select...</option>
                      {categories.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                      <option value="__NEW__" className="font-bold text-emerald-600">+ Add New Category</option>
                    </select>
                  </div>
                  
                  {showNewCatForm && (
                    <div className="col-span-2 p-3 bg-emerald-50 rounded-lg border border-emerald-200 grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-medium text-emerald-800 mb-1">New Cat Name</label>
                        <input type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} className="w-full bg-white border border-emerald-300 rounded-md p-2 text-sm outline-none" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-emerald-800 mb-1">Prefix (1-2 char)</label>
                        <input type="text" maxLength={2} value={newCatPrefix} onChange={(e) => setNewCatPrefix(e.target.value.toUpperCase())} className="w-full bg-white border border-emerald-300 rounded-md p-2 text-sm uppercase outline-none" />
                      </div>
                    </div>
                  )}
                  
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-stone-500 mb-1">Botanical Species</label>
                    <input type="text" value={editFormData.species} onChange={(e) => setEditFormData({ ...editFormData, species: e.target.value })} className="w-full bg-stone-50 border border-stone-300 rounded-lg p-2.5 text-stone-800 italic outline-none focus:border-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1">Vendor / Source</label>
                    <input type="text" value={editFormData.vendor} onChange={(e) => setEditFormData({ ...editFormData, vendor: e.target.value })} className="w-full bg-stone-50 border border-stone-300 rounded-lg p-2.5 text-stone-800 outline-none focus:border-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1">Life Cycle</label>
                    <input type="text" value={editFormData.lifecycle} onChange={(e) => setEditFormData({ ...editFormData, lifecycle: e.target.value })} className="w-full bg-stone-50 border border-stone-300 rounded-lg p-2.5 text-stone-800 outline-none focus:border-emerald-500" />
                  </div>
                </div>
              </section>

              {/* Specs */}
              <section className="bg-white p-5 rounded-2xl shadow-sm border border-stone-200 space-y-4">
                <h3 className="font-bold text-stone-800 border-b border-stone-100 pb-2">Planting Specs</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1">Days to Maturity</label>
                    <input type="number" value={editFormData.days_to_maturity} onChange={(e) => setEditFormData({ ...editFormData, days_to_maturity: e.target.value })} className="w-full bg-stone-50 border border-stone-300 rounded-lg p-2.5 text-stone-800 outline-none focus:border-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1">Sunlight</label>
                    <input type="text" value={editFormData.sunlight} onChange={(e) => setEditFormData({ ...editFormData, sunlight: e.target.value })} className="w-full bg-stone-50 border border-stone-300 rounded-lg p-2.5 text-stone-800 outline-none focus:border-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1">Plant Spacing</label>
                    <input type="text" value={editFormData.plant_spacing} onChange={(e) => setEditFormData({ ...editFormData, plant_spacing: e.target.value })} className="w-full bg-stone-50 border border-stone-300 rounded-lg p-2.5 text-stone-800 outline-none focus:border-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1">Row Spacing</label>
                    <input type="text" value={editFormData.row_spacing} onChange={(e) => setEditFormData({ ...editFormData, row_spacing: e.target.value })} className="w-full bg-stone-50 border border-stone-300 rounded-lg p-2.5 text-stone-800 outline-none focus:border-emerald-500" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-stone-500 mb-1">Seed Depth</label>
                    <input type="text" value={editFormData.seed_depth} onChange={(e) => setEditFormData({ ...editFormData, seed_depth: e.target.value })} className="w-full bg-stone-50 border border-stone-300 rounded-lg p-2.5 text-stone-800 outline-none focus:border-emerald-500" />
                  </div>
                </div>
              </section>

              {/* Germination Needs */}
              <section className="bg-white p-5 rounded-2xl shadow-sm border border-stone-200 space-y-4">
                <h3 className="font-bold text-stone-800 border-b border-stone-100 pb-2">Germination Needs</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-stone-500 mb-1">Days to Germination</label>
                    <input type="text" value={editFormData.germination_days} onChange={(e) => setEditFormData({ ...editFormData, germination_days: e.target.value })} className="w-full bg-stone-50 border border-stone-300 rounded-lg p-2.5 text-stone-800 outline-none focus:border-emerald-500" />
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-stone-50 rounded-lg border border-stone-200">
                    <input type="checkbox" checked={editFormData.light_required} onChange={(e) => setEditFormData({ ...editFormData, light_required: e.target.checked })} className="w-4 h-4 accent-emerald-600" />
                    <label className="text-sm font-medium text-stone-700">Needs Light</label>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-stone-50 rounded-lg border border-stone-200">
                    <input type="checkbox" checked={editFormData.cold_stratification} onChange={(e) => setEditFormData({ ...editFormData, cold_stratification: e.target.checked })} className="w-4 h-4 accent-emerald-600" />
                    <label className="text-sm font-medium text-stone-700">Cold Strat.</label>
                  </div>
                  {editFormData.cold_stratification && (
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-stone-500 mb-1">Stratification Days</label>
                      <input type="number" value={editFormData.stratification_days} onChange={(e) => setEditFormData({ ...editFormData, stratification_days: e.target.value })} className="w-full bg-stone-50 border border-stone-300 rounded-lg p-2.5 text-stone-800 outline-none focus:border-emerald-500" />
                    </div>
                  )}
                </div>
              </section>

              {/* Notes */}
              <section className="bg-white p-5 rounded-2xl shadow-sm border border-stone-200">
                <label className="block text-xs font-bold text-stone-800 mb-2">Growing Notes</label>
                <textarea value={editFormData.notes} onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })} rows={5} className="w-full bg-stone-50 border border-stone-300 rounded-lg p-3 text-stone-800 outline-none focus:border-emerald-500 resize-none leading-relaxed" />
              </section>

              <button onClick={handleDeleteSeed} className="w-full py-4 mt-4 bg-red-50 text-red-600 font-bold rounded-xl border border-red-200 hover:bg-red-100 transition-colors flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                Delete Seed Permanently
              </button>
            </div>
          </main>
        );
      }

      // --- DETAIL VIEW ---
      const primaryImg = (selectedSeed.images && selectedSeed.images.length > 0) ? selectedSeed.images[selectedSeed.primaryImageIndex || 0] : null;
      
      return (
        <main className="min-h-screen bg-stone-50 text-stone-900 pb-20">
          <header className="bg-emerald-700 text-white p-4 shadow-md sticky top-0 z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setSelectedSeed(null)} className="p-2 bg-emerald-800 rounded-full hover:bg-emerald-600 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <h1 className="text-xl font-bold truncate">Seed Details</h1>
            </div>
            <button 
              onClick={() => { setEditFormData(selectedSeed); setIsEditingSeed(true); }}
              className="p-2 bg-emerald-800 rounded-full hover:bg-emerald-600 transition-colors flex items-center gap-1 px-3"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
              <span className="text-sm font-medium">Edit</span>
            </button>
          </header>

          <div className="max-w-md mx-auto">
            {/* Hero Image */}
            <div className="w-full aspect-[4/3] bg-stone-200 relative">
              {primaryImg ? (
                <img src={primaryImg} alt={selectedSeed.variety_name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-stone-400">
                  <svg className="w-12 h-12 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  <span>No primary image</span>
                </div>
              )}
              <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-stone-900/80 to-transparent p-4 pt-12">
                <div className="flex gap-2 mb-1">
                  <div className="bg-emerald-500 text-white text-xs font-bold px-2 py-1 rounded shadow-sm">{selectedSeed.id}</div>
                  {selectedSeed.out_of_stock && (
                    <div className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded shadow-sm">OUT OF STOCK</div>
                  )}
                </div>
                <h2 className="text-2xl font-bold text-white leading-tight">{selectedSeed.variety_name}</h2>
                <p className="text-emerald-300 text-sm font-medium">{selectedSeed.category} <span className="text-stone-300 font-normal italic">({selectedSeed.species})</span></p>
              </div>
            </div>

            {/* Other Images Strip */}
            {(selectedSeed.images && selectedSeed.images.length > 1) && (
              <div className="p-4 bg-white border-b border-stone-200 flex gap-2 overflow-x-auto scrollbar-hide">
                {selectedSeed.images.map((img, idx) => (
                  <div key={idx} className={`flex-shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 ${idx === (selectedSeed.primaryImageIndex || 0) ? 'border-emerald-500 opacity-100' : 'border-transparent opacity-60'}`}>
                    <img src={img} className="w-full h-full object-cover" alt="Thumbnail" />
                  </div>
                ))}
              </div>
            )}

            {/* Data Sheets */}
            <div className="p-4 space-y-4">
              
              {/* Quick Info Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white p-3.5 rounded-xl shadow-sm border border-stone-100">
                  <div className="text-stone-400 text-[10px] font-bold uppercase tracking-wider mb-1">Maturity</div>
                  <div className="text-stone-800 font-bold">{selectedSeed.days_to_maturity} Days</div>
                </div>
                <div className="bg-white p-3.5 rounded-xl shadow-sm border border-stone-100">
                  <div className="text-stone-400 text-[10px] font-bold uppercase tracking-wider mb-1">Sunlight</div>
                  <div className="text-stone-800 font-bold truncate">{selectedSeed.sunlight || '--'}</div>
                </div>
                <div className="bg-white p-3.5 rounded-xl shadow-sm border border-stone-100">
                  <div className="text-stone-400 text-[10px] font-bold uppercase tracking-wider mb-1">Life Cycle</div>
                  <div className="text-stone-800 font-bold truncate">{selectedSeed.lifecycle || '--'}</div>
                </div>
                <div className="bg-white p-3.5 rounded-xl shadow-sm border border-stone-100">
                  <div className="text-stone-400 text-[10px] font-bold uppercase tracking-wider mb-1">Vendor</div>
                  <div className="text-stone-800 font-bold truncate">{selectedSeed.vendor || '--'}</div>
                </div>
              </div>

              {/* Planting & Germination Specs */}
              <div className="bg-white p-4 rounded-xl shadow-sm border border-stone-100">
                <h3 className="text-sm font-bold text-stone-800 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>
                  Planting Requirements
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between border-b border-stone-50 pb-2">
                    <span className="text-stone-500">Seed Depth</span>
                    <span className="font-medium text-stone-800">{selectedSeed.seed_depth || '--'}</span>
                  </div>
                  <div className="flex justify-between border-b border-stone-50 pb-2">
                    <span className="text-stone-500">Plant Spacing</span>
                    <span className="font-medium text-stone-800">{selectedSeed.plant_spacing || '--'}</span>
                  </div>
                  <div className="flex justify-between border-b border-stone-50 pb-2">
                    <span className="text-stone-500">Row Spacing</span>
                    <span className="font-medium text-stone-800">{selectedSeed.row_spacing || '--'}</span>
                  </div>
                  <div className="flex justify-between border-b border-stone-50 pb-2">
                    <span className="text-stone-500">Germination Time</span>
                    <span className="font-medium text-stone-800">{selectedSeed.germination_days || '--'}</span>
                  </div>
                  
                  {/* Tags for specific needs */}
                  {(selectedSeed.light_required || selectedSeed.cold_stratification) && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {selectedSeed.light_required && (
                        <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-1 rounded">Needs Light to Germinate</span>
                      )}
                      {selectedSeed.cold_stratification && (
                        <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">
                          Cold Stratification ({selectedSeed.stratification_days} days)
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {selectedSeed.notes && (
                <div className="bg-white p-5 rounded-xl shadow-sm border border-stone-100">
                  <h3 className="text-stone-800 font-bold mb-2 flex items-center gap-2">
                    <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    Growing Notes
                  </h3>
                  <p className="text-stone-600 text-sm leading-relaxed whitespace-pre-wrap">{selectedSeed.notes}</p>
                </div>
              )}
            </div>
          </div>
        </main>
      );
    }

    // 2. LIST VIEW
    const filteredInventory = inventory.filter(seed => {
      const matchesSearch = seed.variety_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            seed.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            seed.id?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = activeFilter === "All" || seed.category === activeFilter;
      return matchesSearch && matchesFilter;
    });

    return (
      <main className="min-h-screen bg-stone-50 text-stone-900 pb-20">
        <header className="bg-emerald-700 text-white p-4 shadow-md sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsViewingInventory(false)}
              className="p-2 bg-emerald-800 rounded-full hover:bg-emerald-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-bold">Seed Vault</h1>
              <p className="text-xs text-emerald-200">{inventory.length} varieties saved</p>
            </div>
          </div>
        </header>

        <div className="max-w-md mx-auto p-4 space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <input 
              type="text" 
              placeholder="Search by name, category, or code..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-stone-200 rounded-xl py-3 pl-10 pr-4 shadow-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all" 
            />
            <svg className="w-5 h-5 text-stone-400 absolute left-3 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Dynamic Filter Chips */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <button 
              onClick={() => setActiveFilter("All")}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${activeFilter === 'All' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'}`}
            >
              All
            </button>
            {categories.map(cat => (
              <button 
                key={cat.name}
                onClick={() => setActiveFilter(cat.name)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${activeFilter === cat.name ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'}`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Seed List */}
          <div className="space-y-3">
            {isLoadingDB ? (
              <div className="flex justify-center items-center py-10 text-emerald-600">
                <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              </div>
            ) : filteredInventory.length > 0 ? (
              filteredInventory.map(seed => {
                const thumb = seed.images && seed.images.length > 0 ? seed.images[seed.primaryImageIndex || 0] : null;
                const isOutOfStock = seed.out_of_stock;

                return (
                  <div 
                    key={seed.id} 
                    onClick={() => setSelectedSeed(seed)}
                    className={`bg-white p-3 rounded-xl border ${isOutOfStock ? 'border-red-100 bg-stone-50/50 opacity-75' : 'border-stone-100'} shadow-sm flex flex-col gap-3 hover:border-emerald-400 hover:shadow-md transition-all active:scale-95 cursor-pointer`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Thumbnail Image */}
                      <div className={`w-16 h-16 rounded-lg bg-stone-100 overflow-hidden flex-shrink-0 border border-stone-200 ${isOutOfStock ? 'grayscale' : ''}`}>
                        {thumb ? (
                          <img src={thumb} alt={seed.variety_name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-stone-300">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0 py-1">
                        <div className="flex justify-between items-start mb-0.5">
                          <h3 className={`font-bold text-base leading-tight truncate pr-2 ${isOutOfStock ? 'text-stone-500 line-through decoration-stone-300' : 'text-stone-800'}`}>{seed.variety_name}</h3>
                          <div className="bg-stone-100 text-stone-600 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border border-stone-200 shadow-inner whitespace-nowrap">
                            {seed.id}
                          </div>
                        </div>
                        <div className="text-xs text-emerald-600 font-semibold mb-2 truncate">{seed.category} <span className="text-stone-400 font-normal italic">({seed.species})</span></div>
                        
                        <div className="flex justify-between items-center text-[11px]">
                          {/* New Attribute Display: Plant Spacing visible on card */}
                          <span className="font-medium text-stone-600 flex items-center gap-1 bg-stone-100 px-1.5 py-0.5 rounded border border-stone-200">
                            <svg className="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                            {seed.plant_spacing || '--'}
                          </span>
                          
                          <span className="font-bold text-stone-700 bg-stone-100 px-1.5 py-0.5 rounded flex-shrink-0 border border-stone-200">
                            {seed.days_to_maturity} DTM
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Quick Action Footer */}
                    <div className="flex justify-end border-t border-stone-100 pt-2">
                      <button 
                        onClick={(e) => toggleOutOfStock(seed, e)}
                        className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-md transition-colors border ${isOutOfStock ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' : 'bg-stone-50 text-stone-500 border-stone-200 hover:bg-stone-100 hover:text-stone-800'}`}
                      >
                        {isOutOfStock ? 'Mark In Stock' : 'Mark Out of Stock'}
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-10 text-stone-500 bg-white rounded-xl border border-stone-100 shadow-sm">
                <svg className="w-12 h-12 mx-auto text-stone-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <p>No seeds found matching your filters.</p>
                {activeFilter !== "All" && (
                  <button onClick={() => setActiveFilter("All")} className="mt-3 text-emerald-600 font-medium text-sm hover:underline">Clear Filters</button>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    );
  }

  // --- DASHBOARD VIEW ---
  return (
    <main className="min-h-screen bg-stone-50 text-stone-900 pb-20">
      <header className="bg-emerald-700 text-white p-6 shadow-md rounded-b-2xl">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-baseline gap-2">
              Garden Manager
              <span className="text-sm font-normal text-emerald-300">v1.14</span>
            </h1>
            <p className="text-emerald-100 text-sm mt-1">Zone 5b • Last Frost: May 1-10</p>
          </div>
          <svg className="w-8 h-8 text-emerald-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
        </div>
      </header>

      <div className="max-w-md mx-auto p-4 mt-4 space-y-6">
        <section>
          <h2 className="text-lg font-semibold text-stone-800 mb-3 px-1">Add to Inventory</h2>
          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => setIsScanning(true)} className="flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-sm border border-stone-100 hover:border-emerald-500 hover:shadow-md transition-all active:scale-95">
              <div className="bg-emerald-100 p-3 rounded-full mb-2 text-emerald-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </div>
              <span className="text-sm font-medium">Scan Packet</span>
            </button>

            <button className="flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-sm border border-stone-100 hover:border-blue-500 hover:shadow-md transition-all active:scale-95">
              <div className="bg-blue-100 p-3 rounded-full mb-2 text-blue-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
              </div>
              <span className="text-sm font-medium">Import URL</span>
            </button>

            <button className="flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-sm border border-stone-100 hover:border-purple-500 hover:shadow-md transition-all active:scale-95">
              <div className="bg-purple-100 p-3 rounded-full mb-2 text-purple-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              </div>
              <span className="text-sm font-medium">Manual Entry</span>
            </button>

            <button onClick={() => setIsViewingInventory(true)} className="flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-sm border border-stone-100 hover:border-amber-500 hover:shadow-md transition-all active:scale-95">
              <div className="bg-amber-100 p-3 rounded-full mb-2 text-amber-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
              </div>
              <span className="text-sm font-medium">View Inventory</span>
            </button>
          </div>
        </section>

        <section>
          <div className="flex justify-between items-center mb-3 px-1">
            <h2 className="text-lg font-semibold text-stone-800">Season Insights</h2>
          </div>
          <div className="bg-white p-5 rounded-xl shadow-sm border border-stone-100">
            <div className="flex items-start space-x-3">
              <div className="bg-blue-100 p-2 rounded-lg text-blue-600 mt-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
              <div>
                <h3 className="font-medium text-stone-900">Start Indoors Soon</h3>
                <p className="text-sm text-stone-500 mt-1">
                  You are about 8-10 weeks out from your May 1st frost date. It's almost time to start those Habaneros and long-season peppers on heat mats!
                </p>
              </div>
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}