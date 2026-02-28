import React, { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { fileToBase64, fetchWithRetry, getBestModel, generateNextId } from '../lib/utils';
import { SeedData, InventorySeed, SeedCategory, AppView } from '../types';

interface Props {
  isScanMode: boolean;
  categories: SeedCategory[];
  setCategories: any;
  inventory: InventorySeed[];
  setInventory: any;
  navigateTo: (view: AppView) => void;
  handleGoBack: (view: AppView) => void;
}

// Universal Resizer: Downscales huge files to an optimal size/quality to save bucket space
const resizeImage = (source: string, maxSize: number, quality: number): Promise<string> => {
  return new Promise((resolve) => {
    if (!source) return resolve("");
    
    const img = new Image();
    img.crossOrigin = "anonymous"; 
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      
      if (width > height) {
        if (width > maxSize) { height *= maxSize / width; width = maxSize; }
      } else {
        if (height > maxSize) { width *= maxSize / height; height = maxSize; }
      }
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      try {
        resolve(canvas.toDataURL('image/jpeg', quality)); 
      } catch (e) {
        resolve(""); 
      }
    };
    img.onerror = () => resolve("");
    
    let finalSrc = source;
    if (source.startsWith('http') && !source.includes('supabase.co') && !source.includes('allorigins')) {
       finalSrc = `https://api.allorigins.win/raw?url=${encodeURIComponent(source)}`;
    } else if (!source.startsWith('http') && !source.startsWith('data:')) {
       finalSrc = `data:image/jpeg;base64,${source}`;
    }
    
    img.src = finalSrc;
  });
};

export default function ScannerImporter({ isScanMode, categories, setCategories, inventory, setInventory, navigateTo, handleGoBack }: Props) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importUrl, setImportUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false); 
  const [isAutoFilling, setIsAutoFilling] = useState(false); // NEW: Auto-fill loading state
  const [analysisResult, setAnalysisResult] = useState<SeedData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showNewCatForm, setShowNewCatForm] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatPrefix, setNewCatPrefix] = useState("");

  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";

  const aiSystemInstruction = { parts: [{ text: "You are a master horticulturist AI. Extract accurate botanical data from seed packets or vendor text into structured JSON. Standardize categories to broad groups (Herb, Flower, Pea, Leafy Green, Root Vegetable, Brassica, Vine/Squash, Tomato, Pepper, etc.) so the database remains clean. Extract a list of companion plants. Infer common botanical requirements if they are missing." }] };
  const aiGenerationConfig = {
    responseMimeType: "application/json",
    responseSchema: {
      type: "OBJECT",
      properties: {
        variety_name: { type: "STRING" }, vendor: { type: "STRING" }, days_to_maturity: { type: "INTEGER" }, species: { type: "STRING" }, category: { type: "STRING" }, notes: { type: "STRING" }, companion_plants: { type: "ARRAY", items: { type: "STRING" } }, seed_depth: { type: "STRING" }, plant_spacing: { type: "STRING" }, row_spacing: { type: "STRING" }, germination_days: { type: "STRING" }, sunlight: { type: "STRING" }, lifecycle: { type: "STRING" }, cold_stratification: { type: "BOOLEAN" }, stratification_days: { type: "INTEGER" }, light_required: { type: "BOOLEAN" }, scoville_rating: { type: "INTEGER" }
      }
    }
  };

  const processAiResult = (textResponse: string | undefined) => {
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
    } else throw new Error("No text returned from AI");
  };

  const analyzeImage = async () => {
    if (!selectedFile) return;
    setIsAnalyzing(true); setErrorMsg(null);
    if (!apiKey) { setErrorMsg("Missing API Key!"); setIsAnalyzing(false); return; }
    try {
      const base64Data = await fileToBase64(selectedFile);
      const mimeType = selectedFile.type || "image/jpeg";
      const payload = {
        contents: [{ role: "user", parts: [{ text: "Analyze this seed packet image. Extract all details requested in the JSON schema. Map the category to a broad group. If it is a hot pepper, estimate the scoville rating." }, { inlineData: { mimeType: mimeType, data: base64Data } }] }],
        systemInstruction: aiSystemInstruction, generationConfig: aiGenerationConfig
      };
      const modelToUse = await getBestModel();
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${apiKey}`;
      const result = await fetchWithRetry(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }, 3);
      processAiResult(result.candidates?.[0]?.content?.parts?.[0]?.text);
    } catch (err: any) { setErrorMsg(`Error: ${err.message || "Unknown error occurred"}`);
    } finally { setIsAnalyzing(false); }
  };

  const analyzeUrl = async () => {
    if (!importUrl.trim() || !importUrl.startsWith("http")) { setErrorMsg("Please enter a valid complete URL."); return; }
    setIsAnalyzing(true); setErrorMsg(null); setImagePreview(null);
    if (!apiKey) { setErrorMsg("Missing API Key!"); setIsAnalyzing(false); return; }
    try {
      let htmlContent = "";
      try {
        const directRes = await fetch(importUrl);
        if (!directRes.ok) throw new Error("Direct fetch failed");
        htmlContent = await directRes.text();
      } catch (directErr) {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(importUrl)}`;
        const fetchResponse = await fetch(proxyUrl);
        if (!fetchResponse.ok) throw new Error("Failed to fetch data from proxy.");
        const data = await fetchResponse.json();
        htmlContent = data.contents;
      }
      if (!htmlContent) throw new Error("No readable content found.");
      
      const doc = new DOMParser().parseFromString(htmlContent, 'text/html');
      let extractedImageUrl = doc.querySelector('meta[property="og:image"]')?.getAttribute('content');
      if (!extractedImageUrl) {
        const imgElement = doc.querySelector('img[src*="product"], img[src*="seed"], .product-image img');
        if (imgElement) extractedImageUrl = imgElement.getAttribute('src');
      }
      if (extractedImageUrl && !extractedImageUrl.startsWith('http')) {
        try { const base = new URL(importUrl); extractedImageUrl = new URL(extractedImageUrl, base.origin).href; } catch(e) {}
      }
      if (extractedImageUrl) setImagePreview(extractedImageUrl);

      doc.querySelectorAll('script, style, nav, footer, header, iframe').forEach(el => el.remove());
      const rawText = doc.body.textContent || "";
      const cleanText = rawText.replace(/\s+/g, ' ').substring(0, 20000);

      const payload = {
        contents: [{ role: "user", parts: [{ text: `Analyze the following text scraped from a seed vendor's website. Extract all details requested in the JSON schema based on this text. Map the category to a broad group. If it is a hot pepper, extract the scoville rating.\n\nWebsite Content:\n${cleanText}` }] }],
        systemInstruction: aiSystemInstruction, generationConfig: aiGenerationConfig
      };
      const modelToUse = await getBestModel();
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${apiKey}`;
      const result = await fetchWithRetry(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }, 3);
      processAiResult(result.candidates?.[0]?.content?.parts?.[0]?.text);
    } catch (err: any) { setErrorMsg(`Error: ${err.message}`);
    } finally { setIsAnalyzing(false); }
  };

  const handleImageCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
      setSelectedFile(file); setAnalysisResult(null); setErrorMsg(null); setShowNewCatForm(false);
    }
  };

  const handleSaveScannedToInventory = async () => {
    if (!analysisResult) return;
    
    setIsSaving(true);
    
    try {
      const variety = analysisResult.variety_name?.trim() || 'Unknown Variety';
      const vendor = analysisResult.vendor?.trim() || 'Unknown Vendor';
      
      const { data: duplicates, error: checkError } = await supabase
        .from('seed_inventory')
        .select('id')
        .ilike('variety_name', variety)
        .ilike('vendor', vendor);
        
      if (!checkError && duplicates && duplicates.length > 0) {
        const isConfirmed = confirm(`⚠️ Duplicate Detected!\n\nYou already have '${variety}' from '${vendor}'. Add anyway?`);
        if (!isConfirmed) {
          setIsSaving(false);
          return; 
        }
      }
      
      let finalCatName = analysisResult.category || 'Uncategorized';
      let finalPrefix = 'U';
      if (showNewCatForm && newCatName.trim() !== '') {
        finalCatName = newCatName.trim();
        finalPrefix = newCatPrefix.trim().toUpperCase() || finalCatName.substring(0, 2).toUpperCase();
        await supabase.from('seed_categories').insert([{ name: finalCatName, prefix: finalPrefix }]);
        setCategories([...categories, { name: finalCatName, prefix: finalPrefix }].sort((a: any,b: any) => a.name.localeCompare(b.name)));
      } else {
        const found = categories.find(c => c.name === finalCatName);
        if (found) finalPrefix = found.prefix;
      }

      const newId = await generateNextId(finalPrefix);
      
      // Image Processing & Upload Logic
      const uploadedImagePaths = [];
      let newThumbnail = "";
      
      if (imagePreview) {
        const folderName = btoa(newId).replace(/=/g, ''); 
        
        // 1. Upload Main Image
        const optimizedBase64 = await resizeImage(imagePreview, 1600, 0.8);
        if (optimizedBase64) {
             const res = await fetch(optimizedBase64);
             const blob = await res.blob();
             const fileName = `${crypto.randomUUID()}.jpg`;
             const filePath = `${folderName}/${fileName}`;
             const { error: uploadErr } = await supabase.storage.from('talawa_media').upload(filePath, blob, { contentType: 'image/jpeg' });
             if (!uploadErr) uploadedImagePaths.push(filePath);
        }
        
        // 2. Generate Thumbnail
        newThumbnail = await resizeImage(imagePreview, 150, 0.6);
      }

      // Explicitly typed as any to safely pass nulls for numeric values
      const payloadToSave: any = {
        id: newId, 
        category: finalCatName, 
        variety_name: analysisResult.variety_name || 'Unknown Variety', 
        vendor: analysisResult.vendor || 'Unknown Vendor', 
        days_to_maturity: analysisResult.days_to_maturity === "" || analysisResult.days_to_maturity === undefined ? null : Number(analysisResult.days_to_maturity), 
        species: analysisResult.species || 'Unknown Species', 
        notes: analysisResult.notes || '', 
        images: uploadedImagePaths, 
        primaryImageIndex: 0, 
        companion_plants: analysisResult.companion_plants || [], 
        cold_stratification: analysisResult.cold_stratification || false, 
        stratification_days: analysisResult.stratification_days === "" || analysisResult.stratification_days === undefined ? null : Number(analysisResult.stratification_days), 
        light_required: analysisResult.light_required || false, 
        germination_days: analysisResult.germination_days || '', 
        seed_depth: analysisResult.seed_depth || '', 
        plant_spacing: analysisResult.plant_spacing || '', 
        row_spacing: analysisResult.row_spacing || '', 
        out_of_stock: false, 
        sunlight: analysisResult.sunlight || '', 
        lifecycle: analysisResult.lifecycle || '',
        scoville_rating: analysisResult.scoville_rating === "" || analysisResult.scoville_rating === undefined ? null : Number(analysisResult.scoville_rating),
        thumbnail: newThumbnail
      };

      const { error } = await supabase.from('seed_inventory').insert([payloadToSave]);
      
      if (error) { 
        alert("Failed to save to database: " + error.message);
      } else {
        const savedSeed: InventorySeed = {
           ...payloadToSave,
           days_to_maturity: payloadToSave.days_to_maturity === null ? "" : payloadToSave.days_to_maturity,
           stratification_days: payloadToSave.stratification_days === null ? "" : payloadToSave.stratification_days,
           scoville_rating: payloadToSave.scoville_rating === null ? "" : payloadToSave.scoville_rating,
        };
        setInventory([savedSeed, ...inventory]);
        alert(`Success! ${savedSeed.variety_name} added as ${savedSeed.id}`);
        navigateTo('vault');
      }
    } catch (err: any) {
      alert("An error occurred while saving: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAutoFill = async () => {
    if (!analysisResult) return;
    setIsAutoFilling(true);
    try {
      if (!apiKey) throw new Error("Missing API Key!");

      const modelToUse = await getBestModel();
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${apiKey}`;

      const payload = {
        contents: [{
          role: "user",
          parts: [{ text: `You are an expert horticulturist. Here is the current data for a seed named "${analysisResult.variety_name}" (Vendor: ${analysisResult.vendor || 'unknown'}, Category: ${analysisResult.category}, Species: ${analysisResult.species || 'unknown'}). \n\n${JSON.stringify(analysisResult)}\n\nPlease fill in any missing or empty fields with accurate botanical data. Use the Google Search tool if you are unsure. Keep existing populated data intact.\n\nIMPORTANT: You must respond ONLY with a valid JSON object. Do not wrap it in markdown block quotes. The JSON must exactly match this structure (use null or defaults if unknown). If it is a pepper, try to find the Scoville Heat Unit (SHU) rating and include it as a number in scoville_rating. \n\nIMAGE SEARCH INSTRUCTIONS:\nUse the Google Search tool to find a direct image file URL (.jpg, .png, .webp). To find the best image, search exactly for: "images of the ${analysisResult.variety_name} ${analysisResult.category} sold by ${analysisResult.vendor || 'seed vendors'}". Extract the direct raw image URL and put it in the "image_url" field. DO NOT put an HTML webpage URL. If you cannot find a direct image file, set it to null:\n{"variety_name":"","vendor":"","days_to_maturity":0,"species":"","category":"","notes":"","companion_plants":[],"seed_depth":"","plant_spacing":"","row_spacing":"","germination_days":"","sunlight":"","lifecycle":"","cold_stratification":false,"stratification_days":0,"light_required":false,"scoville_rating":null,"image_url":null}` }]
        }],
        tools: [{ google_search: {} }]
      };

      const result = await fetchWithRetry(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }, 3);
      const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (textResponse) {
        const parsedData = JSON.parse(textResponse.replace(/```json/g, '').replace(/```/g, '').trim());
        const { image_url, ...restData } = parsedData; 
        
        setAnalysisResult(prev => ({ ...prev, ...restData }));

        // Only attach the web image if the user hasn't already provided a camera scan image
        if (!imagePreview && image_url && image_url.startsWith('http') && (image_url.includes('.jpg') || image_url.includes('.png') || image_url.includes('.jpeg') || image_url.includes('.webp'))) {
            try {
               await new Promise((resolve, reject) => {
                   const img = new Image();
                   const timer = setTimeout(() => reject(new Error("Timeout")), 5000);
                   img.onload = () => { clearTimeout(timer); resolve(true); };
                   img.onerror = () => { clearTimeout(timer); reject(new Error("Image load failed")); };
                   img.src = `https://api.allorigins.win/raw?url=${encodeURIComponent(image_url)}`;
               });
               setImagePreview(image_url);
            } catch (e) {
               console.warn("Failed to load external image found by AI.");
            }
        }
      }
    } catch (e: any) { alert("Auto-fill failed: " + e.message); } 
    finally { setIsAutoFilling(false); }
  };

  const isPepper = analysisResult?.category?.toLowerCase().includes('pepper') || newCatName.toLowerCase().includes('pepper');

  return (
    <main className="min-h-screen bg-stone-900 text-stone-50 flex flex-col">
      <header className="p-4 flex items-center border-b border-stone-800 bg-stone-950">
        <button onClick={() => handleGoBack('dashboard')} className="p-2 mr-2 bg-stone-800 rounded-full hover:bg-stone-700 transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h1 className="text-xl font-bold flex items-baseline gap-2">
          {isScanMode ? 'Scan Seed Packet' : 'Import from URL'}
          <span className="text-sm font-normal text-stone-500">v2.0</span>
        </h1>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto">
        <input type="file" accept="image/*" capture="environment" ref={fileInputRef} className="hidden" onChange={handleImageCapture} />
        {errorMsg && <div className="w-full max-w-sm bg-red-900/50 border border-red-500 text-red-200 p-4 rounded-xl mb-4 text-xs font-mono break-words">{errorMsg}</div>}

        {analysisResult ? (
          <div className="w-full max-w-sm animate-in slide-in-from-bottom-4 duration-500 pb-10 space-y-4">
            {imagePreview && (
              <div className="rounded-2xl overflow-hidden border border-stone-700 h-24 relative shadow-lg">
                <img src={imagePreview} alt="Captured" className="object-cover w-full h-full opacity-60" />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="bg-stone-900/80 px-3 py-1.5 rounded-lg text-xs font-medium text-stone-200 shadow-sm flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    {isScanMode ? 'Packet Image Attached' : 'Product Image Extracted'}
                  </span>
                </div>
              </div>
            )}
            
            {!imagePreview && !isScanMode && (
               <div className="bg-blue-900/40 text-blue-300 p-3 rounded-xl border border-blue-800 text-xs flex items-center gap-2">
                 <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                 Data extracted from URL successfully. You can attach photos later via the Edit page.
               </div>
            )}

            {/* MAGIC AUTO-FILL BUTTON */}
            <div className="space-y-3">
              <button 
                onClick={handleAutoFill}
                disabled={isAutoFilling || isSaving}
                className="w-full py-4 bg-indigo-600 text-white font-bold rounded-xl shadow-md hover:bg-indigo-500 transition-all flex items-center justify-center gap-2 disabled:opacity-75 disabled:cursor-not-allowed"
              >
                {isAutoFilling ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Gathering Data...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 text-indigo-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    ✨ Auto-Fill Missing Data (AI)
                  </>
                )}
              </button>
            </div>

            <div className="bg-stone-800 rounded-2xl p-5 shadow-xl border border-stone-700 space-y-4">
              <h3 className="text-sm font-bold text-emerald-400 border-b border-stone-700 pb-2">Basic Details</h3>
              <div>
                <label className="block text-xs font-medium text-stone-400 mb-1">Category</label>
                <select value={analysisResult.category || ''} onChange={(e) => {
                    const val = e.target.value;
                    if (val === '__NEW__') { setShowNewCatForm(true); setNewCatName(""); setNewCatPrefix(""); } else setShowNewCatForm(false);
                    setAnalysisResult({ ...analysisResult, category: val });
                  }} className="w-full bg-stone-900 border border-stone-700 rounded-lg p-3 text-stone-100 focus:border-emerald-500 outline-none appearance-none"
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
              
              {isPepper && (
                 <div className="bg-red-900/30 p-3 rounded-lg border border-red-800 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-red-400">
                       <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" /></svg>
                       <label className="block text-xs font-bold mb-0">Scoville (SHU)</label>
                    </div>
                    <input type="number" value={analysisResult.scoville_rating || ''} onChange={(e) => setAnalysisResult({ ...analysisResult, scoville_rating: e.target.value })} placeholder="e.g. 50000" className="w-1/2 bg-stone-900 border border-red-800 rounded-md p-2 text-stone-100 font-bold outline-none focus:border-red-500" />
                 </div>
              )}

              <div>
                <label className="block text-xs font-medium text-stone-400 mb-1">Variety Name</label>
                <input type="text" value={analysisResult.variety_name || ''} onChange={(e) => setAnalysisResult({ ...analysisResult, variety_name: e.target.value })} className="w-full bg-stone-900 border border-stone-700 rounded-lg p-3 text-stone-100 font-bold focus:border-emerald-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-stone-400 mb-1">Botanical Species</label><input type="text" value={analysisResult.species || ''} onChange={(e) => setAnalysisResult({ ...analysisResult, species: e.target.value })} className="w-full bg-stone-900 border border-stone-700 rounded-lg p-2 text-stone-100 italic focus:border-emerald-500 outline-none" /></div>
                <div><label className="block text-xs font-medium text-stone-400 mb-1">Vendor</label><input type="text" value={analysisResult.vendor || ''} onChange={(e) => setAnalysisResult({ ...analysisResult, vendor: e.target.value })} className="w-full bg-stone-900 border border-stone-700 rounded-lg p-2 text-stone-100 focus:border-emerald-500 outline-none" /></div>
                <div><label className="block text-xs font-medium text-stone-400 mb-1">Life Cycle</label><input type="text" value={analysisResult.lifecycle || ''} onChange={(e) => setAnalysisResult({ ...analysisResult, lifecycle: e.target.value })} placeholder="Annual, Perennial..." className="w-full bg-stone-900 border border-stone-700 rounded-lg p-2 text-stone-100 focus:border-emerald-500 outline-none" /></div>
                <div><label className="block text-xs font-medium text-stone-400 mb-1">Sunlight</label><input type="text" value={analysisResult.sunlight || ''} onChange={(e) => setAnalysisResult({ ...analysisResult, sunlight: e.target.value })} placeholder="Full Sun..." className="w-full bg-stone-900 border border-stone-700 rounded-lg p-2 text-stone-100 focus:border-emerald-500 outline-none" /></div>
              </div>
            </div>

            <div className="bg-stone-800 rounded-2xl p-5 shadow-xl border border-stone-700 space-y-4">
              <h3 className="text-sm font-bold text-emerald-400 border-b border-stone-700 pb-2">Planting Specs</h3>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-stone-400 mb-1">Seed Depth</label><input type="text" value={analysisResult.seed_depth || ''} onChange={(e) => setAnalysisResult({ ...analysisResult, seed_depth: e.target.value })} className="w-full bg-stone-900 border border-stone-700 rounded-lg p-2 text-stone-100 focus:border-emerald-500 outline-none" /></div>
                <div><label className="block text-xs font-medium text-stone-400 mb-1">Plant Spacing</label><input type="text" value={analysisResult.plant_spacing || ''} onChange={(e) => setAnalysisResult({ ...analysisResult, plant_spacing: e.target.value })} className="w-full bg-stone-900 border border-stone-700 rounded-lg p-2 text-stone-100 focus:border-emerald-500 outline-none" /></div>
                <div><label className="block text-xs font-medium text-stone-400 mb-1">Row Spacing</label><input type="text" value={analysisResult.row_spacing || ''} onChange={(e) => setAnalysisResult({ ...analysisResult, row_spacing: e.target.value })} className="w-full bg-stone-900 border border-stone-700 rounded-lg p-2 text-stone-100 focus:border-emerald-500 outline-none" /></div>
                <div><label className="block text-xs font-medium text-stone-400 mb-1">Days to Maturity</label><input type="number" value={analysisResult.days_to_maturity || ''} onChange={(e) => setAnalysisResult({ ...analysisResult, days_to_maturity: e.target.value })} className="w-full bg-stone-900 border border-stone-700 rounded-lg p-2 text-stone-100 focus:border-emerald-500 outline-none" /></div>
              </div>
            </div>

            <div className="bg-stone-800 rounded-2xl p-5 shadow-xl border border-stone-700 space-y-4">
              <h3 className="text-sm font-bold text-emerald-400 border-b border-stone-700 pb-2">Germination Needs</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><label className="block text-xs font-medium text-stone-400 mb-1">Days to Germination</label><input type="text" value={analysisResult.germination_days || ''} onChange={(e) => setAnalysisResult({ ...analysisResult, germination_days: e.target.value })} placeholder="e.g. 7-14 days" className="w-full bg-stone-900 border border-stone-700 rounded-lg p-2 text-stone-100 focus:border-emerald-500 outline-none" /></div>
                <div className="flex items-center gap-2 bg-stone-900 p-2 rounded-lg border border-stone-700"><input type="checkbox" checked={analysisResult.light_required || false} onChange={(e) => setAnalysisResult({ ...analysisResult, light_required: e.target.checked })} className="w-4 h-4 accent-emerald-500" /><label className="text-xs text-stone-200">Needs Light</label></div>
                <div className="flex items-center gap-2 bg-stone-900 p-2 rounded-lg border border-stone-700"><input type="checkbox" checked={analysisResult.cold_stratification || false} onChange={(e) => setAnalysisResult({ ...analysisResult, cold_stratification: e.target.checked })} className="w-4 h-4 accent-emerald-500" /><label className="text-xs text-stone-200">Needs Cold Strat.</label></div>
                {analysisResult.cold_stratification && (<div className="col-span-2 mt-2"><label className="block text-xs font-medium text-stone-400 mb-1">Stratification Days</label><input type="number" value={analysisResult.stratification_days || ''} onChange={(e) => setAnalysisResult({ ...analysisResult, stratification_days: e.target.value })} placeholder="Days in fridge..." className="w-full bg-stone-900 border border-stone-700 rounded-lg p-2 text-stone-100 focus:border-emerald-500 outline-none" /></div>)}
              </div>
            </div>

            <div className="bg-stone-800 rounded-2xl p-5 shadow-xl border border-stone-700 space-y-4">
              <div><label className="block text-xs font-medium text-stone-400 mb-1">Companion Plants (Comma separated)</label><input type="text" value={(analysisResult.companion_plants || []).join(', ')} onChange={(e) => setAnalysisResult({ ...analysisResult, companion_plants: e.target.value.split(',').map(s=>s.trim()).filter(Boolean) })} placeholder="Basil, Marigold..." className="w-full bg-stone-900 border border-stone-700 rounded-lg p-3 text-stone-100 focus:border-emerald-500 outline-none" /></div>
              <div><label className="block text-xs font-medium text-stone-400 mb-1">Growing Notes</label><textarea value={analysisResult.notes || ''} onChange={(e) => setAnalysisResult({ ...analysisResult, notes: e.target.value })} rows={4} className="w-full bg-stone-900 border border-stone-700 rounded-lg p-3 text-stone-100 focus:border-emerald-500 outline-none resize-none" /></div>
            </div>

            <div className="flex gap-3 pt-4">
              <button onClick={() => setAnalysisResult(null)} disabled={isSaving} className="flex-1 py-4 bg-stone-700 rounded-xl font-medium hover:bg-stone-600 transition-colors disabled:opacity-50">Back</button>
              <button onClick={handleSaveScannedToInventory} disabled={isSaving} className="flex-[2] py-4 bg-emerald-600 rounded-xl font-bold text-white hover:bg-emerald-500 shadow-lg shadow-emerald-900/50 transition-all disabled:opacity-50">
                {isSaving ? "Saving..." : "Save to Database"}
              </button>
            </div>
          </div>
          
        ) : isScanMode ? (
          <div className="w-full flex flex-col items-center animate-in fade-in duration-300">
            {imagePreview ? (
              <>
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
              </>
            ) : (
              <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center justify-center w-full max-w-sm aspect-[3/4] border-2 border-dashed border-stone-600 rounded-3xl bg-stone-800/50 text-stone-400 hover:text-emerald-400 hover:border-emerald-50 active:scale-95 transition-all">
                <div className="bg-stone-800 p-5 rounded-full mb-4 shadow-lg">
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </div>
                <span className="text-lg font-medium">Tap to open camera</span>
              </button>
            )}
          </div>
        ) : (
          <div className="w-full flex flex-col items-center animate-in fade-in duration-300">
            <div className="w-full max-w-sm bg-stone-800 p-6 rounded-3xl border border-stone-700 shadow-2xl relative overflow-hidden">
              {isAnalyzing && (
                <div className="absolute inset-0 bg-stone-900/80 z-10 flex flex-col items-center justify-center text-blue-400 backdrop-blur-sm">
                  <svg className="w-12 h-12 animate-spin mb-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  <span className="font-bold text-lg drop-shadow-md">Scraping URL...</span>
                </div>
              )}
              <div className="bg-blue-900/30 border border-blue-800 p-4 rounded-full w-16 h-16 flex items-center justify-center mb-6 mx-auto text-blue-400 shadow-inner">
                 <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
              </div>
              <h2 className="text-xl font-bold text-center text-stone-100 mb-2">Import from Link</h2>
              <p className="text-sm text-stone-400 text-center mb-6 leading-relaxed">Paste a link to a seed product page. The AI will scrape the page and extract the botanical details automatically.</p>
              <input type="url" value={importUrl} onChange={(e) => setImportUrl(e.target.value)} placeholder="https://www.bakercreek.com/..." className="w-full bg-stone-900 border border-stone-600 rounded-xl p-4 text-stone-100 focus:border-blue-500 outline-none mb-4 transition-colors placeholder:text-stone-600" />
              <button onClick={analyzeUrl} disabled={isAnalyzing || !importUrl.trim()} className="w-full py-4 bg-blue-600 rounded-xl font-bold text-white hover:bg-blue-500 shadow-lg shadow-blue-900/30 flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-95">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                Extract Data
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}