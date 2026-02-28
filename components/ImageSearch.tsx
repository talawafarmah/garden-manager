import React, { useState } from 'react';

const Icons = {
  Search: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
  ),
  Loader2: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>
  ),
  Globe: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
  ),
  X: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
  ),
  ExternalLink: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
  ),
  AlertCircle: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
  ),
  ImageIcon: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
  ),
};

interface SearchResult {
  url: string;
  title: string;
  source: string;
}

interface ImageSearchProps {
  query?: string;
  onSelect: (imageUrl: string) => void;
  onClose: () => void;
}

const ImageSearch: React.FC<ImageSearchProps> = ({ query: initialQuery = '', onSelect, onClose }) => {
  const [query, setQuery] = useState(initialQuery);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const performSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    setError(null);
    setResults([]);

    const apiKey = ""; 
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

    // Moving all instructions into a single user message to maximize grounding tool compatibility
    const promptText = `Find real-world botanical photos for the plant variety: "${query}". 
    Use Google Search to find high-quality image URLs from reputable sources like seed catalogs (Baker Creek, Johnny's, Burpee), botanical gardens, or university extensions.
    
    Return the results ONLY as a valid JSON object in this format:
    {
      "images": [
        {
          "url": "direct_image_link_or_catalog_page",
          "title": "descriptive_plant_name",
          "source": "website_name"
        }
      ]
    }`;

    const payload = {
      contents: [{ 
        parts: [{ text: promptText }] 
      }],
      tools: [{ "google_search": {} }]
    };

    let retries = 0;
    const maxRetries = 5;

    const attemptFetch = async (): Promise<void> => {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          if (response.status === 429 && retries < maxRetries) {
            const delay = Math.pow(2, retries) * 1000;
            retries++;
            await new Promise(resolve => setTimeout(resolve, delay));
            return attemptFetch();
          }
          throw new Error(`Botanical search failed with status: ${response.status}`);
        }

        const data = await response.json();
        const contentText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        
        // Manual JSON extraction to handle model verbosity or markdown fences
        try {
          const jsonMatch = contentText.match(/\{[\s\S]*\}/);
          if (!jsonMatch) throw new Error("No JSON found in response");
          
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.images && Array.isArray(parsed.images)) {
            setResults(parsed.images);
          } else {
            throw new Error("Invalid response structure");
          }
        } catch (parseErr) {
          // Fallback: If JSON parsing fails, check if grounding metadata contains URIs
          const grounding = data.candidates?.[0]?.groundingMetadata?.groundingAttributions;
          if (grounding && grounding.length > 0) {
            const fallbackResults = grounding.map((g: any) => ({
              url: g.web?.uri,
              title: g.web?.title || "Search Result",
              source: g.web?.uri ? new URL(g.web.uri).hostname.replace('www.', '') : "Web"
            })).filter((r: any) => r.url);
            
            if (fallbackResults.length > 0) {
              setResults(fallbackResults);
              return;
            }
          }
          throw new Error("Could not extract botanical results from search.");
        }
      } catch (err: any) {
        setError(err.message || "Failed to retrieve search results.");
      } finally {
        setIsSearching(false);
      }
    };

    await attemptFetch();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-slate-800 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Icons.Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Botanical Image Search</h3>
              <p className="text-xs text-slate-400">Powered by Google Search Grounding</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
            <Icons.X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-5 bg-slate-900/50">
          <form onSubmit={performSearch} className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. 'Aji Charapita Pepper ripe'"
              className="w-full rounded-2xl bg-slate-800 border-slate-700 py-4 pl-5 pr-14 text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
            />
            <button
              type="submit"
              disabled={isSearching || !query.trim()}
              className="absolute right-2 top-2 rounded-xl bg-emerald-600 p-2.5 text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {isSearching ? <Icons.Loader2 className="h-5 w-5 animate-spin" /> : <Icons.Search className="h-5 w-5" />}
            </button>
          </form>
        </div>

        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar min-h-[300px]">
          {isSearching && (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-400">
              <Icons.Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
              <p className="animate-pulse text-sm font-medium">Scouring botanical databases...</p>
            </div>
          )}

          {!isSearching && results.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500 text-center">
              <Icons.ImageIcon className="h-16 w-16 mb-4 opacity-10" />
              <p className="text-sm max-w-xs">Enter a variety to find real photos from around the web.</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
              <Icons.AlertCircle className="w-12 h-12 text-red-500/50 mb-3" />
              <p className="text-red-400 text-sm font-medium mb-6">{error}</p>
              <button onClick={() => performSearch()} className="px-6 py-3 bg-slate-800 text-white rounded-xl hover:bg-slate-700 font-bold">
                Try Again
              </button>
            </div>
          )}

          {results.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {results.map((img, idx) => (
                <div 
                  key={idx} 
                  className="group relative flex flex-col rounded-2xl bg-slate-800 border border-slate-700 overflow-hidden hover:border-emerald-500 transition-all cursor-pointer"
                  onClick={() => onSelect(img.url)}
                >
                  <div className="aspect-video w-full bg-slate-950 flex items-center justify-center overflow-hidden">
                    <img
                      src={img.url}
                      alt={img.title}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://via.placeholder.com/400x300?text=${encodeURIComponent(img.source)}`;
                      }}
                    />
                  </div>
                  <div className="p-3">
                    <h4 className="text-xs font-bold text-slate-200 line-clamp-1 mb-1">{img.title}</h4>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wider text-emerald-500 font-bold flex items-center gap-1">
                        <Icons.Globe className="w-3 h-3" /> {img.source}
                      </span>
                      <Icons.ExternalLink className="w-3 h-3 text-slate-600" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageSearch;