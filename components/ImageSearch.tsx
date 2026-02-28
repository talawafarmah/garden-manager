import React, { useState, useEffect } from 'react';
import { fetchWithRetry, getBestModel } from '../lib/utils';

interface Props {
  query: string;
  onSelect: (url: string) => void;
  onClose: () => void;
}

export default function ImageSearch({ query, onSelect, onClose }: Props) {
  const [results, setResults] = useState<{ url: string; title: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";

  const performSearch = async () => {
    if (!query || !apiKey) return;
    setIsSearching(true);
    setError(null);

    try {
      const modelToUse = await getBestModel();
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${apiKey}`;

      // We ask the AI to find high-quality image URLs for the plant.
      // Note: We use the Search Tool to get grounding metadata which usually contains image source URIs or page URIs.
      const payload = {
        contents: [{
          role: "user",
          parts: [{ text: `Find 6 high-quality, direct image URLs or reliable source page URLs for a photo of the plant variety: "${query}". I need images that clearly show the fruit or flower for botanical identification.` }]
        }],
        tools: [{ google_search: {} }]
      };

      const result = await fetchWithRetry(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }, 3);

      // Extract URIs from grounding metadata
      const attributions = result.candidates?.[0]?.groundingMetadata?.groundingAttributions || [];
      const foundLinks = attributions
        .map((a: any) => ({
          url: a.web?.uri || "",
          title: a.web?.title || "Plant Image Source"
        }))
        .filter((item: any) => item.url.startsWith('http'));

      if (foundLinks.length === 0) {
        throw new Error("No specific image sources found. Try a different variety name.");
      }

      setResults(foundLinks);
    } catch (err: any) {
      setError(err.message || "Search failed.");
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    performSearch();
  }, [query]);

  return (
    <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-stone-900 w-full max-w-lg h-[80vh] sm:h-auto sm:max-h-[70vh] rounded-t-3xl sm:rounded-2xl flex flex-col shadow-2xl overflow-hidden border border-stone-800">
        <header className="p-4 border-b border-stone-800 flex justify-between items-center bg-stone-950">
          <div>
            <h3 className="font-bold text-stone-100">Internet Image Search</h3>
            <p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold">Query: {query}</p>
          </div>
          <button onClick={onClose} className="p-2 text-stone-400 hover:bg-stone-800 rounded-full transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          {isSearching ? (
            <div className="flex flex-col items-center justify-center py-20 text-emerald-500">
              <svg className="w-10 h-10 animate-spin mb-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              <span className="text-sm font-bold animate-pulse">Consulting Botanical Archives...</span>
            </div>
          ) : error ? (
            <div className="bg-red-900/20 border border-red-900/50 text-red-400 p-4 rounded-xl text-sm text-center">
              {error}
              <button onClick={performSearch} className="block mx-auto mt-2 underline font-bold">Try again</button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {results.map((res, idx) => (
                <button 
                  key={idx} 
                  onClick={() => onSelect(res.url)}
                  className="group relative aspect-square bg-stone-800 rounded-xl overflow-hidden border border-stone-700 hover:border-emerald-500 transition-all active:scale-95"
                >
                  {/* Since direct URLs might be blocked by CORS or not be direct images, 
                      we try to render them but provide a "Open Link" fallback UI if they fail. 
                      In a production app, we would use a proxy to get the actual image src. */}
                  <img 
                    src={res.url} 
                    alt={res.title} 
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      (e.target as any).nextSibling.style.display = 'flex';
                    }}
                  />
                  <div className="hidden absolute inset-0 flex-col items-center justify-center p-3 text-center bg-stone-800">
                     <svg className="w-6 h-6 text-stone-500 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                     <span className="text-[10px] text-stone-400 font-medium leading-tight">{res.title}</span>
                  </div>
                  <div className="absolute bottom-0 left-0 w-full p-2 bg-gradient-to-t from-black/80 to-transparent">
                     <span className="text-[9px] text-white font-bold uppercase truncate block">Select Image</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        
        <div className="p-4 bg-stone-950 border-t border-stone-800 text-center text-[10px] text-stone-500 font-bold uppercase tracking-widest">
          Powered by Gemini Search Grounding
        </div>
      </div>
    </div>
  );
}