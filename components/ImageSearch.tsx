import React, { useState } from 'react';

// Inline SVG components to ensure portability
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
  BookOpen: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
  ),
  Leaf: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M11 20A7 7 0 0 1 14 6h7v7a7 7 0 0 1-7 7h-3Z"></path><path d="M14 6v6a3 3 0 0 1-3 3h-3a3 3 0 0 1-3-3V6h6Z"></path></svg>
  )
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

type SearchMode = 'wiki' | 'catalogs';

const ImageSearch: React.FC<ImageSearchProps> = ({ query: initialQuery = '', onSelect, onClose }) => {
  const [query, setQuery] = useState(initialQuery);
  const [searchMode, setSearchMode] = useState<SearchMode>('wiki');
  const [vendor, setVendor] = useState('');
  
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const performSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    setError(null);
    setResults([]);

    try {
      if (searchMode === 'wiki') {
        // Direct Wikipedia API fetch (Fast, CORS-safe, highly reliable)
        const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=8&prop=pageimages&pithumbsize=800&origin=*`;
        const response = await fetch(url);
        
        if (!response.ok) throw new Error(`Wikipedia search failed: ${response.status}`);
        
        const data = await response.json();
        const pages = data.query?.pages;

        if (pages) {
          const fetchedResults: SearchResult[] = [];
          Object.values(pages).forEach((page: any) => {
            if (page.thumbnail?.source) {
              fetchedResults.push({
                url: page.thumbnail.source,
                title: page.title,
                source: "Wikimedia Commons"
              });
            }
          });

          if (fetchedResults.length > 0) {
            setResults(fetchedResults);
          } else {
            throw new Error("No botanical images found on Wikipedia for this query.");
          }
        } else {
          throw new Error("No Wikipedia articles found matching this plant variety.");
        }
      } else {
        // Custom Next.js API Route for scraping Seed Catalogs
        const params = new URLSearchParams({ q: query });
        if (vendor.trim()) params.append('vendor', vendor.trim());

        const response = await fetch(`/api/seed-images?${params.toString()}`);
        
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `Catalog search failed (${response.status})`);
        }

        const data = await response.json();
        
        if (data.images && data.images.length > 0) {
          setResults(data.images);
        } else {
          throw new Error("No images successfully extracted from catalogs.");
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to retrieve search results.");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Icons.Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Botanical Image Search</h3>
              <p className="text-xs text-slate-400">Multiple source databases</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
            <Icons.X className="h-6 w-6" />
          </button>
        </div>

        {/* Search Configuration */}
        <div className="p-5 bg-slate-900/50 border-b border-slate-800/50">
          
          {/* Mode Toggles */}
          <div className="flex gap-2 mb-4 bg-slate-950 p-1 rounded-xl">
            <button 
              type="button"
              onClick={() => setSearchMode('wiki')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${searchMode === 'wiki' ? 'bg-slate-800 text-emerald-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <Icons.BookOpen className="w-4 h-4" />
              Wikipedia (Fast)
            </button>
            <button 
              type="button"
              onClick={() => setSearchMode('catalogs')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${searchMode === 'catalogs' ? 'bg-slate-800 text-emerald-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <Icons.Leaf className="w-4 h-4" />
              Seed Catalogs (Deep)
            </button>
          </div>

          <form onSubmit={performSearch} className="space-y-3">
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchMode === 'wiki' ? "e.g. 'Jalapeno plant', 'Solanum lycopersicum'" : "e.g. 'Cherokee Purple Tomato'"}
                className="w-full rounded-2xl bg-slate-800 border-slate-700 py-4 pl-5 pr-14 text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
              />
              <button
                type="submit"
                disabled={isSearching || !query.trim()}
                className="absolute right-2 top-2 rounded-xl bg-emerald-600 p-2.5 text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {isSearching ? <Icons.Loader2 className="h-5 w-5 animate-spin" /> : <Icons.Search className="h-5 w-5" />}
              </button>
            </div>

            {/* Optional Vendor Input for Catalog Mode */}
            {searchMode === 'catalogs' && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <input
                  type="text"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  placeholder="Optional: Specific Vendor (e.g., Baker Creek, Johnny's)"
                  className="w-full rounded-xl bg-slate-800/50 border border-slate-700/50 py-3 px-5 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-1 outline-none"
                />
              </div>
            )}
          </form>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar min-h-[300px]">
          {isSearching && (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-400">
              <Icons.Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
              <p className="animate-pulse text-sm font-medium text-emerald-500/80">
                {searchMode === 'wiki' ? 'Accessing Wikimedia Commons...' : 'Scraping seed catalogs...'}
              </p>
              {searchMode === 'catalogs' && (
                <p className="text-xs text-slate-500">This may take a few seconds as we process external pages.</p>
              )}
            </div>
          )}

          {!isSearching && results.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500 text-center">
              <Icons.ImageIcon className="h-16 w-16 mb-4 opacity-10" />
              <p className="text-sm max-w-xs">
                {searchMode === 'wiki' 
                  ? "Enter a plant variety to search the world's largest open botanical database."
                  : "Search across top heirloom catalogs or target a specific seed vendor."}
              </p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
              <Icons.AlertCircle className="w-12 h-12 text-amber-500/50 mb-3" />
              <p className="text-amber-400 text-sm font-medium mb-6">{error}</p>
              <button onClick={(e) => performSearch(e as any)} className="px-6 py-3 bg-slate-800 text-white rounded-xl hover:bg-slate-700 font-bold">
                Try Again
              </button>
            </div>
          )}

          {results.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {results.map((img, idx) => (
                <div 
                  key={idx} 
                  className="group relative flex flex-col rounded-2xl bg-slate-800 border border-slate-700 overflow-hidden hover:border-emerald-500 transition-all cursor-pointer shadow-lg"
                  onClick={() => onSelect(img.url)}
                >
                  <div className="aspect-video w-full bg-slate-950 flex items-center justify-center overflow-hidden relative">
                    {/* Placeholder shown while image loads or if it fails */}
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900 text-slate-700">
                      <Icons.ImageIcon className="w-8 h-8 opacity-50" />
                    </div>
                    <img
                      src={img.url}
                      alt={img.title}
                      className="w-full h-full object-cover relative z-10 transition-transform group-hover:scale-105"
                      onError={(e) => {
                        // Hide the broken image to reveal the placeholder underneath
                        (e.target as HTMLImageElement).style.opacity = '0';
                      }}
                    />
                  </div>
                  <div className="p-3 bg-slate-800 relative z-20">
                    <h4 className="text-xs font-bold text-slate-200 line-clamp-1 mb-1">{img.title}</h4>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wider text-emerald-500 font-bold flex items-center gap-1">
                        <Icons.Globe className="w-3 h-3" /> {img.source}
                      </span>
                      <Icons.ExternalLink className="w-3 h-3 text-slate-600" />
                    </div>
                  </div>
                  <div className="absolute inset-0 bg-emerald-600/10 opacity-0 group-hover:opacity-100 transition-opacity z-30 pointer-events-none" />
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