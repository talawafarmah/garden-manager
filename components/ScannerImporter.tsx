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
  const [isImageSearchOpen, setIsImageSearchOpen] = useState(false);

  const [showNewCatForm, setShowNewCatForm] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatPrefix, setNewCatPrefix] = useState("");

  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";

  const aiSystemInstruction = { 
    parts: [{ 
      text: `You are a master horticulturist AI. Extract accurate botanical data from seed packets or vendor text into structured JSON. Standardize categories to broad groups (Herb, Flower, Pea, Leafy Green, Root Vegetable, Brassica, Vine/Squash, Tomato, Pepper, etc.) so the database remains clean. Extract a list of companion plants. Infer common botanical requirements if they are missing.

IMPORTANT: You MUST respond ONLY with a valid JSON object. Do not include markdown formatting wrappers like \`\`\`json. The JSON must exactly match this structure, substituting null for entirely unknown numeric values and empty strings for unknown text:
{
  "variety_name": "string",
  "vendor": "string",
  "days_to_maturity": number or null,
  "species": "string",
  "category": "string",
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
      const parsedData = JSON.parse(textResponse.replace(/```json/gi, '').replace(/```/g, '').trim());
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
  };

  const analyzeImage = async () => {
    if (!selectedFile) return;
    setIsAnalyzing(true); 
    setErrorMsg(null);
    if (!apiKey) { setErrorMsg("Missing API Key!"); setIsAnalyzing(false); return; }
    try {
      const base64Data = await fileToBase64(selectedFile);
      const mimeType = selectedFile.type || "image/jpeg";
      const payload = {
        contents: [{ role: "user", parts: [{ text: "Analyze this seed packet image. Extract all details requested in the JSON schema. Use Search tool for missing gaps." }, { inlineData: { mimeType: mimeType, data: base64Data } }] }],
        systemInstruction: aiSystemInstruction, 
        tools: [{ google_search: {} }] 
      };
      const modelToUse = await getBestModel();
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${apiKey}`;
      const result = await fetchWithRetry(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }, 3);
      processAiResult(result.candidates?.[0]?.content?.parts?.[0]?.text);
    } catch (err: any) { setErrorMsg(`Error: ${err.message || "Unknown error"}`); } finally { setIsAnalyzing(false); }
  };

  const analyzeUrl = async () => {
    if (!importUrl.trim() || !importUrl.startsWith("http")) { setErrorMsg("Enter a valid URL."); return; }
    setIsAnalyzing(true); 
    setErrorMsg(null); 
    if (!apiKey) { setErrorMsg("Missing API Key!"); setIsAnalyzing(false); return; }
    try {
      let htmlContent = "";
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(importUrl)}`;
      const fetchResponse = await fetch(proxyUrl);
      if (!fetchResponse.ok) throw new Error("Failed to fetch from proxy.");
      const data = await fetchResponse.json();
      htmlContent = data.contents;
      
      const doc = new DOMParser().parseFromString(htmlContent, 'text/html');
      let extractedImageUrl = doc.querySelector('meta[property="og:image"]')?.getAttribute('content');
      if (extractedImageUrl) setImagePreview(extractedImageUrl);

      doc.querySelectorAll('script, style').forEach(el => el.remove());
      const cleanText = (doc.body.textContent || "").replace(/\s+/g, ' ').substring(0, 10000);
      const payload = {
        contents: [{ role: "user", parts: [{ text: `Scraped Website Content:\n${cleanText}` }] }],
        systemInstruction: aiSystemInstruction, 
        tools: [{ google_search: {} }]
      };
      const modelToUse = await getBestModel();
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${apiKey}`;
      const result = await fetchWithRetry(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }, 3);
      processAiResult(result.candidates?.[0]?.content?.parts?.[0]?.text);
    } catch (err: any) { setErrorMsg(`Error: ${err.message}`); } finally { setIsAnalyzing(false); }
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
        ...analysisResult, id: newId, category: finalCatName, images: imagePreview ? [imagePreview] : [], primaryImageIndex: 0, out_of_stock: false, thumbnail: ''
      };
      navigateTo('seed_edit', newSeedPayload, true);
    }
  };

  return (
    <main className="min-h-screen bg-stone-900 text-stone-50 flex flex-col">
      {isImageSearchOpen && (
        <ImageSearch 
          query={`${analysisResult?.variety_name} ${analysisResult?.species} plant`}
          onSelect={(url) => { setImagePreview(url); setIsImageSearchOpen(false); }}
          onClose={() => setIsImageSearchOpen(false)}
        />
      )}
      <header className="p-4 flex items-center border-b border-stone-800 bg-stone-950">
        <button onClick={() => handleGoBack('dashboard')} className="p-2 mr-2 bg-stone-800 rounded-full hover:bg-stone-700 transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h1 className="text-xl font-bold">{isScanMode ? 'Scan Seed Packet' : 'Import URL'}</h1>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto">
        <input type="file" accept="image/*" capture="environment" ref={fileInputRef} className="hidden" onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setImagePreview(reader.result as string);
            reader.readAsDataURL(file);
            setSelectedFile(file);
            setAnalysisResult(null);
          }
        }} />
        {errorMsg && <div className="w-full max-w-sm bg-red-900/50 border border-red-500 text-red-200 p-4 rounded-xl mb-4 text-xs font-mono">{errorMsg}</div>}
        
        {analysisResult ? (
          <div className="w-full max-w-sm animate-in slide-in-from-bottom-4 duration-500 space-y-4 pb-10">
            <div className="grid grid-cols-2 gap-2">
               <button onClick={() => setIsImageSearchOpen(true)} className="py-3 bg-blue-600 text-white font-bold rounded-xl shadow-md text-xs flex items-center justify-center gap-2">🌐 Find Plant Photo</button>
               <button onClick={analyzeUrl} disabled={isAnalyzing} className="py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-md text-xs flex items-center justify-center gap-2">✨ Refresh AI</button>
            </div>
            {imagePreview && (
              <div className="rounded-2xl overflow-hidden border border-stone-700 h-32 relative group">
                <img src={imagePreview} alt="Attached" className="object-cover w-full h-full opacity-60" />
                <button onClick={() => setImagePreview(null)} className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
              </div>
            )}
            <div className="bg-stone-800 rounded-2xl p-5 border border-stone-700 space-y-4">
              <div><label className="block text-xs text-stone-400 mb-1">Variety Name</label><input type="text" value={analysisResult.variety_name || ''} onChange={(e) => setAnalysisResult({ ...analysisResult, variety_name: e.target.value })} className="w-full bg-stone-900 border border-stone-700 rounded-lg p-3 text-stone-100 font-bold" /></div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setAnalysisResult(null)} className="flex-1 py-4 bg-stone-700 rounded-xl font-medium">Back</button>
              <button onClick={handleSaveScannedToInventory} className="flex-[2] py-4 bg-emerald-600 rounded-xl font-bold">Review & Save</button>
            </div>
          </div>
        ) : isScanMode ? (
          <div className="w-full flex flex-col items-center">
             {imagePreview ? (
              <div className="w-full max-w-sm">
                <div className="aspect-[3/4] rounded-2xl overflow-hidden border-2 border-stone-700 mb-6 relative bg-stone-800">
                  <img src={imagePreview} className="w-full h-full object-cover" />
                  {isAnalyzing && <div className="absolute inset-0 bg-stone-900/60 flex items-center justify-center"><svg className="w-10 h-10 animate-spin text-emerald-400" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>}
                </div>
                <div className="flex gap-4">
                  <button onClick={() => fileInputRef.current?.click()} className="flex-1 py-4 bg-stone-800 rounded-xl font-medium border border-stone-700">Retake</button>
                  <button onClick={analyzeImage} disabled={isAnalyzing} className="flex-1 py-4 bg-emerald-600 rounded-xl font-bold shadow-lg shadow-emerald-900/50">Analyze</button>
                </div>
              </div>
             ) : (
               <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center justify-center w-full max-w-sm aspect-[3/4] border-2 border-dashed border-stone-600 rounded-3xl bg-stone-800/50 text-stone-400 hover:text-emerald-400 transition-all">
                <svg className="w-12 h-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                <span className="text-lg font-medium">Tap to open camera</span>
              </button>
             )}
          </div>
        ) : (
          <div className="w-full max-w-sm bg-stone-800 p-8 rounded-3xl border border-stone-700 shadow-2xl">
            <h2 className="text-xl font-bold text-center mb-6">Import from Vendor</h2>
            <input type="url" value={importUrl} onChange={(e) => setImportUrl(e.target.value)} placeholder="https://..." className="w-full bg-stone-900 border border-stone-600 rounded-xl p-4 text-stone-100 mb-4" />
            <button onClick={analyzeUrl} disabled={isAnalyzing || !importUrl.trim()} className="w-full py-4 bg-blue-600 rounded-xl font-bold text-white shadow-lg shadow-blue-900/30">Extract Data</button>
          </div>
        )}
      </div>
    </main>
  );
}