"use client";

import React, { useState, useRef } from 'react';

// Use environment variable for your local Next.js/Vercel app, fallback to empty string for Canvas
const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || ""; 

// Define the shape of our extracted seed data
interface SeedData {
  variety_name?: string;
  vendor?: string;
  days_to_maturity?: number | string;
  species?: string;
  category?: string;
  notes?: string;
}

// Mock database for the inventory view (initial state)
const initialMockInventory = [
  { id: 'P154', category: 'Pepper', variety_name: 'Yellow Habanero', vendor: 'XYZ Seeds Inc.', days_to_maturity: 90, species: 'Capsicum chinense' },
  { id: 'T089', category: 'Tomato', variety_name: 'Cherokee Purple', vendor: 'Baker Creek', days_to_maturity: 80, species: 'Solanum lycopersicum' },
  { id: 'B012', category: 'Brassica', variety_name: 'Dinosaur Kale', vendor: 'Johnny\'s Seeds', days_to_maturity: 60, species: 'Brassica oleracea' },
  { id: 'P102-1', category: 'Pepper', variety_name: 'Red Habanero (Saved)', vendor: 'Homegrown (F1)', days_to_maturity: 95, species: 'Capsicum chinense' },
  { id: 'F004', category: 'Flower', variety_name: 'Marigold (French)', vendor: 'Botanical Interests', days_to_maturity: 45, species: 'Tagetes patula' },
];

export default function App() {
  const [isScanning, setIsScanning] = useState(false);
  const [isViewingInventory, setIsViewingInventory] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  // App Data State
  const [inventory, setInventory] = useState(initialMockInventory);

  // AI States
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<SeedData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setImagePreview(url);
      setSelectedFile(file);
      setAnalysisResult(null);
      setErrorMsg(null);
    }
  };

  const cancelScan = () => {
    setIsScanning(false);
    setImagePreview(null);
    setSelectedFile(null);
    setAnalysisResult(null);
    setErrorMsg(null);
  };

  const handleSaveToInventory = () => {
    if (analysisResult) {
      // Generate a mock ID (e.g. 'P' for Pepper + random number)
      const prefix = analysisResult.category ? analysisResult.category.charAt(0).toUpperCase() : 'U';
      const mockId = `${prefix}${Math.floor(Math.random() * 1000)}`;

      const newSeed = {
        id: mockId,
        category: analysisResult.category || 'Uncategorized',
        variety_name: analysisResult.variety_name || 'Unknown Variety',
        vendor: analysisResult.vendor || 'Unknown Vendor',
        days_to_maturity: Number(analysisResult.days_to_maturity) || 0,
        species: analysisResult.species || 'Unknown Species',
        notes: analysisResult.notes || ''
      };

      // Add the new seed to the top of our inventory state
      setInventory([newSeed, ...inventory]);
      
      // Notify the user and reset scanner
      alert(`Success! ${newSeed.variety_name} added as ${newSeed.id}`);
      cancelScan();
    }
  };

  // Convert File to Base64 (stripping the data:image/... prefix for the API)
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64Data = result.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  // Exponential backoff fetcher for spotty garden Wi-Fi
  const fetchWithRetry = async (url: string, options: RequestInit, retries = 5) => {
    let delay = 1000;
    for (let i = 0; i < retries; i++) {
      try {
        const res = await fetch(url, options);
        if (!res.ok) {
          // Attempt to extract the actual API error message instead of a generic failure
          const errText = await res.text();
          throw new Error(`HTTP ${res.status}: ${errText.substring(0, 150)}...`);
        }
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

    // Sanity check before calling API
    if (!apiKey) {
      setErrorMsg("Missing API Key! Please set NEXT_PUBLIC_GEMINI_API_KEY in your .env.local file.");
      setIsAnalyzing(false);
      return;
    }

    try {
      const base64Data = await fileToBase64(selectedFile);
      // Fallback MIME type in case the mobile browser doesn't provide one
      const mimeType = selectedFile.type || "image/jpeg";
      
      const payload = {
        contents: [{
          role: "user",
          parts: [
            { text: "Analyze this seed packet. Extract the variety name, vendor/company, days to maturity (number only), botanical species, general category (e.g., Pepper, Tomato, Flower), and any growing notes, descriptions, or instructions." },
            { inlineData: { mimeType: mimeType, data: base64Data } }
          ]
        }],
        systemInstruction: {
          parts: [{ text: "You are a master horticulturist AI. Extract accurate botanical data from seed packets into structured JSON." }]
        },
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
              notes: { type: "STRING" }
            }
          }
        }
      };

      // Determine which model to use. Canvas uses the internal preview model.
      // For local deployments, we will AUTO-DISCOVER the models your key has access to!
      const isLocalDeployment = !!process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      let modelToUse = "gemini-2.5-flash-preview-09-2025";

      if (isLocalDeployment) {
        try {
          console.log("Discovering available models for your API key...");
          const modelsRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
          if (!modelsRes.ok) throw new Error("Failed to fetch models list");
          
          const modelsData = await modelsRes.json();
          
          if (modelsData.models) {
            // Filter for models that can generate content and aren't legacy text-only models
            const available = modelsData.models
              .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent') && m.name.includes('gemini'))
              .map((m: any) => m.name.replace('models/', ''));
            
            console.log("Your API key has access to:", available);

            // Prioritize the best, most cost-effective vision models in order
            const bestModels = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"];
            modelToUse = bestModels.find(m => available.includes(m)) || available[0];

            if (!modelToUse) throw new Error("No compatible Gemini models found for this API key.");
            console.log("Auto-selected model:", modelToUse);
          }
        } catch (discoveryErr) {
          console.warn("Model discovery failed, falling back to basic flash.", discoveryErr);
          modelToUse = "gemini-1.5-flash"; // Ultimate hardcoded fallback
        }
      }

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${apiKey}`;
      
      const result = await fetchWithRetry(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }, 3);

      const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (textResponse) {
        try {
          // Safely strip any potential markdown formatting the AI might inject
          const cleanText = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
          const parsedData = JSON.parse(cleanText);
          setAnalysisResult(parsedData);
        } catch (parseError) {
          throw new Error(`Failed to parse AI response. Raw Output: ${textResponse}`);
        }
      } else {
        throw new Error("No text returned from AI");
      }
      
    } catch (err: any) {
      console.error(err);
      // We display the exact error message to the user for easier debugging
      setErrorMsg(`Error: ${err.message || "Unknown error occurred"}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // --- INVENTORY VIEW ---
  if (isViewingInventory) {
    const filteredInventory = inventory.filter(seed => 
      seed.variety_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      seed.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      seed.id.toLowerCase().includes(searchQuery.toLowerCase())
    );

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

          {/* Filter Chips */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <button className="px-4 py-1.5 bg-emerald-100 text-emerald-800 rounded-full text-sm font-medium whitespace-nowrap">All</button>
            <button className="px-4 py-1.5 bg-white border border-stone-200 text-stone-600 rounded-full text-sm font-medium whitespace-nowrap hover:bg-stone-50">Peppers</button>
            <button className="px-4 py-1.5 bg-white border border-stone-200 text-stone-600 rounded-full text-sm font-medium whitespace-nowrap hover:bg-stone-50">Tomatoes</button>
            <button className="px-4 py-1.5 bg-white border border-stone-200 text-stone-600 rounded-full text-sm font-medium whitespace-nowrap hover:bg-stone-50">Flowers</button>
          </div>

          {/* Seed List */}
          <div className="space-y-3">
            {filteredInventory.length > 0 ? (
              filteredInventory.map(seed => (
                <div key={seed.id} className="bg-white p-4 rounded-xl border border-stone-100 shadow-sm flex items-start gap-4 hover:border-emerald-300 transition-colors active:scale-95 cursor-pointer">
                  {/* Identification Code Badge */}
                  <div className="bg-stone-100 text-stone-600 font-mono text-xs font-bold px-2 py-1.5 rounded border border-stone-200 mt-1 shadow-inner">
                    {seed.id}
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="font-bold text-stone-800 text-lg leading-tight">{seed.variety_name}</h3>
                    <div className="text-xs text-emerald-600 font-semibold mb-2">{seed.category} <span className="text-stone-400 font-normal italic">({seed.species})</span></div>
                    
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-stone-500 flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                        {seed.vendor}
                      </span>
                      <span className="font-medium text-stone-700 bg-stone-100 px-2 py-0.5 rounded-md">
                        {seed.days_to_maturity} DTM
                      </span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-10 text-stone-500">
                <svg className="w-12 h-12 mx-auto text-stone-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <p>No seeds found matching "{searchQuery}"</p>
              </div>
            )}
          </div>
        </div>
      </main>
    );
  }

  // --- SCANNER VIEW ---
  if (isScanning) {
    return (
      <main className="min-h-screen bg-stone-900 text-stone-50 flex flex-col">
        {/* Scanner Header */}
        <header className="p-4 flex items-center border-b border-stone-800 bg-stone-950">
          <button 
            onClick={cancelScan}
            className="p-2 mr-2 bg-stone-800 rounded-full hover:bg-stone-700 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold flex items-baseline gap-2">
            Scan Seed Packet
            <span className="text-sm font-normal text-stone-500">v1.8</span>
          </h1>
        </header>

        {/* Scanner Body */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={fileInputRef}
            className="hidden"
            onChange={handleImageCapture}
          />

          {errorMsg && (
            <div className="w-full max-w-sm bg-red-900/50 border border-red-500 text-red-200 p-4 rounded-xl mb-4 text-xs font-mono break-words">
              {errorMsg}
            </div>
          )}

          {analysisResult ? (
            // --- VERIFICATION FORM ---
            <div className="w-full max-w-sm animate-in slide-in-from-bottom-4 duration-500">
              <div className="bg-stone-800 rounded-2xl p-6 shadow-2xl border border-stone-700">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-emerald-400">Verify Details</h2>
                  <div className="bg-emerald-900/50 p-2 rounded-full text-emerald-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  </div>
                </div>

                {/* Image Attachment Preview */}
                {imagePreview && (
                  <div className="mb-6 rounded-xl overflow-hidden border border-stone-700 h-24 relative">
                    <img src={imagePreview} alt="Captured Seed Packet" className="object-cover w-full h-full opacity-60" />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="bg-stone-900/80 px-3 py-1.5 rounded-lg text-xs font-medium text-stone-200 shadow-sm flex items-center gap-1.5">
                        <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        Packet Image Attached
                      </span>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-stone-400 mb-1">Category</label>
                    <input 
                      type="text" 
                      value={analysisResult.category || ''} 
                      onChange={(e) => setAnalysisResult({ ...analysisResult, category: e.target.value })}
                      className="w-full bg-stone-900 border border-stone-700 rounded-lg p-3 text-stone-100 focus:border-emerald-500 focus:outline-none" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-400 mb-1">Variety Name</label>
                    <input 
                      type="text" 
                      value={analysisResult.variety_name || ''} 
                      onChange={(e) => setAnalysisResult({ ...analysisResult, variety_name: e.target.value })}
                      className="w-full bg-stone-900 border border-stone-700 rounded-lg p-3 text-stone-100 font-bold focus:border-emerald-500 focus:outline-none" 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-stone-400 mb-1">Vendor</label>
                      <input 
                        type="text" 
                        value={analysisResult.vendor || ''} 
                        onChange={(e) => setAnalysisResult({ ...analysisResult, vendor: e.target.value })}
                        className="w-full bg-stone-900 border border-stone-700 rounded-lg p-3 text-stone-100 focus:border-emerald-500 focus:outline-none" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-stone-400 mb-1">Days to Maturity</label>
                      <input 
                        type="number" 
                        value={analysisResult.days_to_maturity || ''} 
                        onChange={(e) => setAnalysisResult({ ...analysisResult, days_to_maturity: e.target.value })}
                        className="w-full bg-stone-900 border border-stone-700 rounded-lg p-3 text-stone-100 focus:border-emerald-500 focus:outline-none" 
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-400 mb-1">Botanical Species</label>
                    <input 
                      type="text" 
                      value={analysisResult.species || ''} 
                      onChange={(e) => setAnalysisResult({ ...analysisResult, species: e.target.value })}
                      className="w-full bg-stone-900 border border-stone-700 rounded-lg p-3 text-stone-100 italic focus:border-emerald-500 focus:outline-none" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-400 mb-1">Growing Notes & Instructions</label>
                    <textarea 
                      value={analysisResult.notes || ''} 
                      onChange={(e) => setAnalysisResult({ ...analysisResult, notes: e.target.value })}
                      rows={4}
                      className="w-full bg-stone-900 border border-stone-700 rounded-lg p-3 text-stone-100 focus:border-emerald-500 focus:outline-none resize-none"
                      placeholder="e.g. Sow 1/4 inch deep, transplant after last frost..."
                    />
                  </div>
                </div>

                <div className="mt-8 flex gap-3">
                  <button onClick={() => setAnalysisResult(null)} className="flex-1 py-3 bg-stone-700 rounded-xl font-medium hover:bg-stone-600 transition-colors">
                    Back
                  </button>
                  <button onClick={handleSaveToInventory} className="flex-[2] py-3 bg-emerald-600 rounded-xl font-bold hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-900/50">
                    Save to Inventory
                  </button>
                </div>
              </div>
            </div>
          ) : imagePreview ? (
            // --- IMAGE PREVIEW & ACTIONS ---
            <div className="w-full flex flex-col items-center animate-in fade-in duration-300">
              <div className="relative w-full max-w-sm aspect-[3/4] mb-8 rounded-2xl overflow-hidden border-2 border-stone-700 shadow-2xl relative">
                <img 
                  src={imagePreview} 
                  alt="Captured Seed Packet" 
                  className={`object-cover w-full h-full transition-opacity duration-300 ${isAnalyzing ? 'opacity-50' : 'opacity-100'}`}
                />
                {isAnalyzing && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-emerald-400 bg-stone-900/40">
                    <svg className="w-12 h-12 animate-spin mb-3" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="font-bold text-lg drop-shadow-md">Extracting Data...</span>
                  </div>
                )}
              </div>
              
              <div className="flex gap-4 w-full max-w-sm">
                <button 
                  onClick={() => fileInputRef.current?.click()} 
                  disabled={isAnalyzing}
                  className="flex-1 py-4 bg-stone-800 rounded-xl font-medium hover:bg-stone-700 transition-colors border border-stone-700 disabled:opacity-50"
                >
                  Retake
                </button>
                <button 
                  onClick={analyzeImage}
                  disabled={isAnalyzing}
                  className="flex-1 py-4 bg-emerald-600 rounded-xl font-bold hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-900/50 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  {isAnalyzing ? "Processing..." : "Analyze"}
                </button>
              </div>
            </div>
          ) : (
            // --- PROMPT TO OPEN CAMERA ---
            <button 
              onClick={() => fileInputRef.current?.click()} 
              className="flex flex-col items-center justify-center w-full max-w-sm aspect-[3/4] border-2 border-dashed border-stone-600 rounded-3xl bg-stone-800/50 text-stone-400 hover:text-emerald-400 hover:border-emerald-500 hover:bg-stone-800 transition-all active:scale-95"
            >
              <div className="bg-stone-800 p-5 rounded-full mb-4 shadow-lg">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <span className="text-lg font-medium">Tap to open camera</span>
              <span className="text-sm mt-2 text-stone-500 text-center px-8">Ensure the variety name and planting instructions are clearly visible.</span>
            </button>
          )}
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
              <span className="text-sm font-normal text-emerald-300">v1.8</span>
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
            <button 
              onClick={() => setIsScanning(true)}
              className="flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-sm border border-stone-100 hover:border-emerald-500 hover:shadow-md transition-all active:scale-95"
            >
              <div className="bg-emerald-100 p-3 rounded-full mb-2 text-emerald-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <span className="text-sm font-medium">Scan Packet</span>
            </button>

            <button className="flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-sm border border-stone-100 hover:border-blue-500 hover:shadow-md transition-all active:scale-95">
              <div className="bg-blue-100 p-3 rounded-full mb-2 text-blue-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
              <span className="text-sm font-medium">Import URL</span>
            </button>

            <button className="flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-sm border border-stone-100 hover:border-purple-500 hover:shadow-md transition-all active:scale-95">
              <div className="bg-purple-100 p-3 rounded-full mb-2 text-purple-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <span className="text-sm font-medium">Manual Entry</span>
            </button>

            <button 
              onClick={() => setIsViewingInventory(true)}
              className="flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-sm border border-stone-100 hover:border-amber-500 hover:shadow-md transition-all active:scale-95"
            >
              <div className="bg-amber-100 p-3 rounded-full mb-2 text-amber-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
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
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
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