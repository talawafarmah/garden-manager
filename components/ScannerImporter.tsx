/* Component: ScannerImporter.tsx */
import React, { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { fileToBase64, fetchWithRetry, getBestModel, generateNextId } from '../lib/utils';
import { SeedData, InventorySeed, SeedCategory, AppView } from '../types';
import ImageSearch from './ImageSearch';

interface Props {
  isScanMode: boolean;
  categories: SeedCategory[];
  setCategories: any;
  inventory: InventorySeed[];
  setInventory: any;
  navigateTo: (view: AppView, payload?: any, replace?: boolean) => void;
  handleGoBack: (view: AppView) => void;
}

export default function ScannerImporter({ isScanMode, categories, setCategories, inventory, setInventory, navigateTo, handleGoBack }: Props) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importUrl, setImportUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<SeedData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [showNewCatForm, setShowNewCatForm] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatPrefix, setNewCatPrefix] = useState("");
  const [isImageSearchOpen, setIsImageSearchOpen] = useState(false);

  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";

  const aiSystemInstruction = { 
    parts: [{ 
      text: `You are a master horticulturist AI. Extract accurate botanical data from seed packets or vendor text into structured JSON. Standardize categories to broad groups (Herb, Flower, Pea, Leafy Green, Root Vegetable, Brassica, Vine/Squash, Tomato, Pepper, etc.). Extract a list of companion plants. Infer common botanical requirements if they are missing.

IMPORTANT: You MUST respond ONLY with a valid JSON object. Do not include markdown formatting wrappers like \`\`\`json. The JSON must exactly match this structure, substituting null for unknown numeric values and empty strings for unknown text:
{
  "variety_name": "string",
  "vendor": "string",
  "days_to_maturity": number or null,
  "species": "string",
  "category": "string",
  "tomato_type": "string (Determinate, Indeterminate, Semi-Determinate, or Dwarf/Micro)",
  "notes": "string",
  "companion_plants": ["string"],
  "seed_depth": "string",
  "plant_spacing": "string",
  "row_spacing": "string",
  "germination_days": "string",
  "sunlight": "string",
  "lifecycle": "string",
  "cold_stratification": boolean,
  "stratification_days": number or null,
  "light_required": boolean,
  "scoville_rating": number or null
}`
    }] 
  };

  const processAiResult = (textResponse: string | undefined) => {
    if (textResponse) {
      try {
        const cleanJson = textResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsedData = JSON.parse(cleanJson);
        
        for (const key in parsedData) {
          if (parsedData[key] === null) {
            parsedData[key] = "";
          }
        }

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
      } catch (e) {
        throw new Error("Failed to parse AI response. Ensure the image or link is clear.");
      }
    } else {
      throw new Error("No data returned from AI.");
    }
  };

  const analyzeImage = async () => {
    if (!selectedFile) return;
    setIsAnalyzing(true); 
    setErrorMsg(null);
    if (!apiKey) { setErrorMsg("Missing API Key!"); setIsAnalyzing(false); return; }
    
    try {
      const base64Data = await fileToBase64(selectedFile);
      const payload = {
        contents: [{ 
          role: "user", 
          parts: [
            { text: "Analyze this seed packet image. Extract all details requested in the JSON schema. Map the category to a broad group. Use the Google Search tool to fill in any missing botanical gaps." }, 
            { inlineData: { mimeType: selectedFile.type || "image/jpeg", data: base64Data } }
          ] 
        }],
        systemInstruction: aiSystemInstruction, 
        tools: [{ google_search: {} }] 
      };
      
      const modelToUse = await getBestModel();
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${apiKey}`;
      const result = await fetchWithRetry(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }, 3);
      processAiResult(result.candidates?.[0]?.content?.parts?.[0]?.text);
    } catch (err: any) { 
      setErrorMsg(`Error: ${err.message || "Unknown error occurred"}`);
    } finally { setIsAnalyzing(false); }
  };

  const analyzeUrl = async () => {
    if (!importUrl.trim() || !importUrl.startsWith("http")) { setErrorMsg("Please enter a valid complete URL."); return; }
    setIsAnalyzing(true); 
    setErrorMsg(null); 
    if (!apiKey) { setErrorMsg("Missing API Key!"); setIsAnalyzing(false); return; }
    
    try {
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(importUrl)}`;
      const fetchResponse = await fetch(proxyUrl);
      if (!fetchResponse.ok) throw new Error("Failed to fetch data from proxy.");
      const data = await fetchResponse.json();
      const htmlContent = data.contents;
      
      const doc = new DOMParser().parseFromString(htmlContent, 'text/html');
      let extractedImageUrl = doc.querySelector('meta[property="og:image"]')?.getAttribute('content');
      if (extractedImageUrl) setImagePreview(extractedImageUrl);

      doc.querySelectorAll('script, style, nav, footer, header, iframe').forEach(el => el.remove());
      const rawText = doc.body.textContent || "";
      const cleanText = rawText.replace(/\s+/g, ' ').substring(0, 15000);

      const payload = {
        contents: [{ 
          role: "user", 
          parts: [{ text: `Analyze the following text scraped from a website. Extract all details requested in the JSON schema. Use Google Search for gaps.\n\nWebsite Content:\n${cleanText}` }] 
        }],
        systemInstruction: aiSystemInstruction, 
        tools: [{ google_search: {} }]
      };
      
      const modelToUse = await getBestModel();
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${apiKey}`;
      const result = await fetchWithRetry(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }, 3);
      processAiResult(result.candidates?.[0]?.content?.parts?.[0]?.text);
    } catch (err: any) { 
      setErrorMsg(`Error: ${err.message}`);
    } finally { setIsAnalyzing(false); }
  };

  const handleMagicFill = async () => {
    if (!analysisResult) return;
    setIsAnalyzing(true);
    setErrorMsg(null);
    try {
      const modelToUse = await getBestModel();
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${apiKey}`;
      const payload = {
        contents: [{ 
          role: "user", 
          parts: [{ text: `Variety: "${analysisResult.variety_name}". Current data: ${JSON.stringify(analysisResult)}. Fill in ALL missing botanical fields accurately using Google Search.` }] 
        }],
        systemInstruction: aiSystemInstruction, 
        tools: [{ google_search: {} }]
      };
      const result = await fetchWithRetry(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }, 3);
      processAiResult(result.candidates?.[0]?.content?.parts?.[0]?.text);
    } catch (err: any) {
      setErrorMsg(`Magic Fill failed: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveScannedToInventory = async () => {
    if (analysisResult) {
      let finalCatName = analysisResult.category || 'Uncategorized';
      let finalPrefix = 'U';
      
      if (showNewCatForm && newCatName.trim() !== '') {
        finalCatName = newCatName.trim();
        finalPrefix = newCatPrefix.trim().toUpperCase() || finalCatName.substring(0, 2).toUpperCase();
      } else {
        const found = categories.find(c => c.name === finalCatName);
        if (found) finalPrefix = found.prefix;
      }

      const newId = await generateNextId(finalPrefix);
      
      const newSeedPayload: any = {
        ...analysisResult,
        id: newId, 
        category: finalCatName, 
        images: imagePreview ? [imagePreview] : [], 
        primaryImageIndex: 0, 
        out_of_stock: false, 
        thumbnail: '',
        newCatName: showNewCatForm ? newCatName : undefined,
        newCatPrefix: showNewCatForm ? newCatPrefix : undefined
      };

      navigateTo('seed_edit', newSeedPayload, true);
    }
  };

  const isPepper = analysisResult?.category?.toLowerCase().includes('pepper') || newCatName.toLowerCase().includes('pepper');
  const isTomato = analysisResult?.category?.toLowerCase().includes('tomato') || newCatName.toLowerCase().includes('tomato');

  return (
    <main className="min-h-screen bg-stone-900 text-stone-50 flex flex-col font-sans">
      {/* UPDATE: Replaced `query` with `baseQuery`, `species`, and `category` props */}
      {isImageSearchOpen && analysisResult && (
        <ImageSearch 
          baseQuery={`${analysisResult.vendor || ''} ${analysisResult.variety_name || ''}`.trim()}
          species={analysisResult.species}
          category={analysisResult.category}
          onSelect={(url) => { setImagePreview(url); setIsImageSearchOpen(false); }}
          onClose={() => setIsImageSearchOpen(false)}
        />
      )}

      <header className="p-4 flex items-center border-b border-stone-800 bg-stone-950 sticky top-0 z-50 shadow-xl">
        <button onClick={() => handleGoBack('dashboard')} className="p-2 mr-2 bg-stone-800 rounded-full hover:bg-stone-700 transition-colors shadow-md">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div>
          <h1 className="text-xl font-bold tracking-tight">{isScanMode ? 'Scan Packet' : 'Import Link'}</h1>
          <p className="text-[10px] text-stone-500 font-black uppercase tracking-[0.2em]">Digital Seed Vault</p>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto overflow-x-hidden">
        <input type="file" accept="image/*" capture="environment" ref={fileInputRef} className="hidden" onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setImagePreview(reader.result as string);
            reader.readAsDataURL(file);
            setSelectedFile(file);
            setAnalysisResult(null);
            setErrorMsg(null);
          }
        }} />
        
        {errorMsg && (
          <div className="w-full max-w-sm bg-red-900/30 border border-red-500/50 text-red-200 p-4 rounded-2xl mb-6 text-xs font-bold text-center animate-in fade-in zoom-in">
            {errorMsg}
          </div>
        )}

        {analysisResult ? (
          <div className="w-full max-w-sm animate-in slide-in-from-bottom-4 duration-500 pb-10 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setIsImageSearchOpen(true)} 
                className="py-4 bg-blue-600 text-white font-black rounded-2xl shadow-lg hover:bg-blue-500 transition-all flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest active:scale-95"
              >
                🌐 Find Photo
              </button>
              <button 
                onClick={handleMagicFill} 
                disabled={isAnalyzing} 
                className="py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-lg hover:bg-indigo-500 transition-all flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest disabled:opacity-50 active:scale-95"
              >
                {isAnalyzing ? '...' : '✨ Magic Fill'}
              </button>
            </div>
            
            {imagePreview && (
              <div className="rounded-3xl overflow-hidden border border-stone-700 h-40 relative shadow-2xl bg-stone-800 group">
                <img src={imagePreview} alt="Preview" className="object-cover w-full h-full opacity-60 group-hover:opacity-80 transition-opacity" />
                <button onClick={() => setImagePreview(null)} className="absolute top-3 right-3 p-2 bg-red-500 text-white rounded-full shadow-lg active:scale-90 transition-transform">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            )}

            <div className="bg-stone-50 rounded-3xl p-6 shadow-2xl border border-stone-200 space-y-6 text-stone-900">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-400 border-b border-stone-100 pb-3 flex items-center gap-2">
                <svg className="w-3 h-3 text-emerald-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                Horticultural Data Review
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Variety Name</label>
                  <input type="text" value={analysisResult.variety_name || ''} onChange={(e) => setAnalysisResult({ ...analysisResult, variety_name: e.target.value })} className="w-full bg-white border border-stone-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-emerald-500 transition-colors shadow-sm" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Species</label>
                    <input type="text" value={analysisResult.species || ''} onChange={(e) => setAnalysisResult({ ...analysisResult, species: e.target.value })} className="w-full bg-white border border-stone-200 rounded-xl p-3 text-sm font-medium outline-none italic shadow-sm" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Vendor</label>
                    <input type="text" value={analysisResult.vendor || ''} onChange={(e) => setAnalysisResult({ ...analysisResult, vendor: e.target.value })} className="w-full bg-white border border-stone-200 rounded-xl p-3 text-sm font-bold outline-none shadow-sm" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Category</label>
                  <select 
                    value={analysisResult.category || ''} 
                    onChange={(e) => {
                      const val = e.target.value;
                      setShowNewCatForm(val === '__NEW__');
                      setAnalysisResult({ ...analysisResult, category: val });
                    }} 
                    className="w-full bg-white border border-stone-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-emerald-500 transition-colors shadow-sm appearance-none"
                  >
                    <option value="" disabled>Select...</option>
                    {categories.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                    <option value="__NEW__" className="font-bold text-emerald-600">+ New Category</option>
                  </select>
                </div>

                {showNewCatForm && (
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 grid grid-cols-2 gap-3 animate-in slide-in-from-top-2">
                    <div className="col-span-2 text-[9px] font-black text-emerald-800 uppercase mb-1">Define New Category</div>
                    <div><input type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="Name" className="w-full bg-white border border-emerald-200 rounded-lg p-2 text-xs outline-none" /></div>
                    <div><input type="text" maxLength={2} value={newCatPrefix} onChange={(e) => setNewCatPrefix(e.target.value.toUpperCase())} placeholder="Prefix" className="w-full bg-white border border-emerald-200 rounded-lg p-2 text-xs outline-none uppercase" /></div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Days to Maturity</label>
                    <input type="number" value={analysisResult.days_to_maturity || ''} onChange={(e) => setAnalysisResult({ ...analysisResult, days_to_maturity: e.target.value ? Number(e.target.value) : "" })} className="w-full bg-white border border-stone-200 rounded-xl p-3 text-sm font-bold outline-none shadow-sm" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Lifecycle</label>
                    <input type="text" value={analysisResult.lifecycle || ''} onChange={(e) => setAnalysisResult({ ...analysisResult, lifecycle: e.target.value })} className="w-full bg-white border border-stone-200 rounded-xl p-3 text-sm outline-none shadow-sm" />
                  </div>
                </div>

                {isPepper && (
                  <div className="bg-red-50 p-4 rounded-2xl border border-red-100 flex items-center justify-between shadow-sm">
                    <label className="text-[10px] font-black text-red-800 uppercase tracking-widest">Scoville Rating</label>
                    <input type="number" value={analysisResult.scoville_rating || ''} onChange={(e) => setAnalysisResult({ ...analysisResult, scoville_rating: e.target.value ? Number(e.target.value) : "" })} className="w-24 bg-white border border-red-200 rounded-lg p-2 text-sm font-black text-red-600 text-right outline-none" />
                  </div>
                )}

                {isTomato && (
                  <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 flex items-center justify-between shadow-sm">
                    <label className="text-[10px] font-black text-rose-800 uppercase tracking-widest">Tomato Type</label>
                    <select 
                      value={analysisResult.tomato_type || ''} 
                      onChange={(e) => setAnalysisResult({ ...analysisResult, tomato_type: e.target.value })} 
                      className="w-32 bg-white border border-rose-200 rounded-lg p-2 text-xs font-black text-rose-700 outline-none"
                    >
                      <option value="">Select...</option>
                      <option value="Determinate">Determinate</option>
                      <option value="Indeterminate">Indeterminate</option>
                      <option value="Semi-Determinate">Semi-Determinate</option>
                      <option value="Dwarf/Micro">Dwarf/Micro</option>
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                   <div>
                    <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Sunlight</label>
                    <input type="text" value={analysisResult.sunlight || ''} onChange={(e) => setAnalysisResult({ ...analysisResult, sunlight: e.target.value })} className="w-full bg-white border border-stone-200 rounded-xl p-3 text-sm outline-none shadow-sm" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Germination Days</label>
                    <input type="text" value={analysisResult.germination_days || ''} onChange={(e) => setAnalysisResult({ ...analysisResult, germination_days: e.target.value })} className="w-full bg-white border border-stone-200 rounded-xl p-3 text-sm outline-none shadow-sm" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Seed Depth</label>
                    <input type="text" value={analysisResult.seed_depth || ''} onChange={(e) => setAnalysisResult({ ...analysisResult, seed_depth: e.target.value })} className="w-full bg-white border border-stone-200 rounded-xl p-2 text-xs outline-none shadow-sm" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Plant Space</label>
                    <input type="text" value={analysisResult.plant_spacing || ''} onChange={(e) => setAnalysisResult({ ...analysisResult, plant_spacing: e.target.value })} className="w-full bg-white border border-stone-200 rounded-xl p-2 text-xs outline-none shadow-sm" />
                  </div>
                   <div>
                    <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Row Space</label>
                    <input type="text" value={analysisResult.row_spacing || ''} onChange={(e) => setAnalysisResult({ ...analysisResult, row_spacing: e.target.value })} className="w-full bg-white border border-stone-200 rounded-xl p-2 text-xs outline-none shadow-sm" />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <button 
                    onClick={() => setAnalysisResult({...analysisResult, light_required: !analysisResult.light_required})}
                    className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${analysisResult.light_required ? 'bg-amber-100 border-amber-300 text-amber-700 shadow-sm' : 'bg-stone-100 border-stone-200 text-stone-400'}`}
                  >
                    Light Required
                  </button>
                  <button 
                    onClick={() => setAnalysisResult({...analysisResult, cold_stratification: !analysisResult.cold_stratification})}
                    className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${analysisResult.cold_stratification ? 'bg-blue-100 border-blue-300 text-blue-700 shadow-sm' : 'bg-stone-100 border-stone-200 text-stone-400'}`}
                  >
                    Cold Strat
                  </button>
                </div>

                {analysisResult.cold_stratification && (
                  <div className="animate-in slide-in-from-left-2 p-3 bg-blue-50/50 rounded-2xl border border-blue-100">
                    <label className="block text-[9px] font-black text-blue-800 uppercase tracking-widest mb-1 ml-1">Stratification Days</label>
                    <input type="number" value={analysisResult.stratification_days || ''} onChange={(e) => setAnalysisResult({ ...analysisResult, stratification_days: e.target.value ? Number(e.target.value) : "" })} className="w-full bg-white border border-blue-200 rounded-xl p-3 text-sm outline-none shadow-sm" />
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Companion Plants (comma separated)</label>
                  <input type="text" value={(analysisResult.companion_plants || []).join(', ')} onChange={(e) => setAnalysisResult({ ...analysisResult, companion_plants: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} className="w-full bg-white border border-stone-200 rounded-xl p-3 text-sm font-medium outline-none shadow-sm" />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Growing Notes</label>
                  <textarea value={analysisResult.notes || ''} onChange={(e) => setAnalysisResult({ ...analysisResult, notes: e.target.value })} rows={4} className="w-full bg-white border border-stone-200 rounded-xl p-3 text-sm outline-none shadow-sm resize-none" placeholder="Vendor tips, germination notes, etc..." />
                </div>
              </div>
            </div>

            <div className="flex gap-4 pt-2">
              <button onClick={() => setAnalysisResult(null)} className="flex-1 py-4 bg-stone-800 text-stone-400 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all">Discard</button>
              <button onClick={handleSaveScannedToInventory} className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-emerald-900/40 active:scale-95 transition-all">Review & Finish</button>
            </div>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center">
            {isScanMode ? (
              <div className="w-full max-w-sm flex flex-col items-center animate-in fade-in duration-500">
                {imagePreview ? (
                  <div className="w-full">
                    <div className="aspect-[3/4] rounded-[2.5rem] overflow-hidden border-2 border-stone-700 mb-8 relative bg-stone-800 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                      <img src={imagePreview} className="w-full h-full object-cover" alt="Captured packet" />
                      {isAnalyzing && (
                        <div className="absolute inset-0 bg-stone-950/80 flex flex-col items-center justify-center text-emerald-400 backdrop-blur-sm">
                          <svg className="w-14 h-14 animate-spin mb-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                          <span className="font-black text-white uppercase tracking-[0.3em] text-[10px] animate-pulse">Running AI Extraction</span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-4">
                      <button onClick={() => fileInputRef.current?.click()} className="flex-1 py-5 bg-stone-800 rounded-3xl font-black text-[10px] uppercase tracking-widest border border-stone-700 active:scale-95 transition-all">Retake</button>
                      <button onClick={analyzeImage} disabled={isAnalyzing} className="flex-1 py-5 bg-emerald-600 rounded-3xl font-black text-[10px] uppercase tracking-widest shadow-2xl shadow-emerald-900/50 active:scale-95 transition-all">Analyze Packet</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center justify-center w-full max-w-sm aspect-[3/4] border-2 border-dashed border-stone-700 rounded-[3rem] bg-stone-800/30 text-stone-500 hover:text-emerald-400 hover:border-emerald-500/50 transition-all group shadow-inner">
                    <div className="bg-stone-800 p-8 rounded-full mb-8 border border-stone-700 shadow-2xl group-hover:scale-110 transition-transform">
                      <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </div>
                    <span className="text-2xl font-black tracking-tight text-stone-300">Open Camera</span>
                    <span className="text-[10px] mt-2 uppercase tracking-[0.3em] font-black text-stone-600">Scan Seed Packet</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="w-full max-w-sm bg-stone-800 p-10 rounded-[3rem] border border-stone-700 shadow-2xl relative overflow-hidden text-center">
                {isAnalyzing && <div className="absolute inset-0 bg-stone-950/80 z-10 flex flex-col items-center justify-center text-blue-400 backdrop-blur-md"><svg className="w-12 h-12 animate-spin mb-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span className="font-black text-white uppercase text-[10px] tracking-widest">Scraping Vendor...</span></div>}
                <div className="bg-blue-950 p-6 rounded-full w-20 h-20 flex items-center justify-center mb-8 mx-auto text-blue-400 border border-blue-900 shadow-2xl"><svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg></div>
                <h2 className="text-3xl font-black text-stone-100 mb-3 tracking-tight">Import Link</h2>
                <p className="text-xs text-stone-500 mb-8 leading-relaxed font-medium">Paste a link to a seed product page. The AI will extract the botanical details automatically.</p>
                <input 
                  type="url" 
                  value={importUrl} 
                  onChange={(e) => setImportUrl(e.target.value)} 
                  placeholder="https://www.bakercreek.com/..." 
                  className="w-full bg-stone-900 border border-stone-600 rounded-2xl p-4 text-stone-100 focus:border-blue-500 outline-none mb-6 transition-all shadow-inner text-sm font-medium" 
                />
                <button 
                  onClick={analyzeUrl} 
                  disabled={isAnalyzing || !importUrl.trim()} 
                  className="w-full py-5 bg-blue-600 rounded-3xl font-black text-[10px] uppercase tracking-widest text-white shadow-2xl shadow-blue-900/40 active:scale-95 transition-all disabled:opacity-50"
                >
                  Start Web Import
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}