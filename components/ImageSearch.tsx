import React, { useState, useEffect } from 'react';

interface ImageSearchProps {
  query?: string;
  onSelect: (url: string) => void;
  onClose: () => void;
}

interface SearchResult {
  url: string;
  thumbnail: string;
  title: string;
  source: string;
}

export default function ImageSearch({ query = "", onSelect, onClose }: ImageSearchProps) {
  const [activeTab, setActiveTab] = useState<'search' | 'link'>('search');
  
  // Search State
  const [searchQuery, setSearchQuery] = useState(query);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Direct Link State
  const [urlInput, setUrlInput] = useState("");
  const [previewError, setPreviewError] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  // Auto-search on initial open if a query is provided
  useEffect(() => {
    if (searchQuery.trim()) {
      handleSearch();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchError(null);

    try {
      const res = await fetch(`/api/images?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch images');
      }

      setResults(data.items || []);
    } catch (err: any) {
      setSearchError(err.message);
    } finally {
      setIsSearching(false);
    }
  };

  // Direct Link Handlers
  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrlInput(e.target.value);
    setPreviewError(false);
    setIsValidating(true);
  };

  const handleLinkSubmit = () => {
    if (urlInput && !previewError) {
      onSelect(urlInput);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
        {/* Header & Tabs */}
        <div className="bg-stone-50 border-b border-stone-200 flex flex-col">
          <div className="p-4 flex justify-between items-center">
            <h3 className="font-black text-stone-800 text-lg flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              Add Photo
            </h3>
            <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-200 rounded-full transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="flex px-4 gap-4">
            <button 
              onClick={() => setActiveTab('search')}
              className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'search' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-stone-500 hover:text-stone-700'}`}
            >
              Google Web Search
            </button>
            <button 
              onClick={() => setActiveTab('link')}
              className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'link' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-stone-500 hover:text-stone-700'}`}
            >
              Direct URL Link
            </button>
          </div>
        </div>

        {/* Tab Content: Google Search */}
        {activeTab === 'search' && (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="p-4 border-b border-stone-100">
              <form onSubmit={handleSearch} className="flex gap-2">
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="e.g., Cherokee Purple Tomato plant"
                  className="flex-1 bg-stone-100 border border-stone-200 rounded-xl p-3 text-sm outline-none focus:border-emerald-500 transition-colors"
                />
                <button type="submit" disabled={isSearching} className="bg-emerald-600 text-white px-5 rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm">
                  {isSearching ? <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : 'Search'}
                </button>
              </form>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-stone-50 scrollbar-hide">
              {isSearching ? (
                <div className="h-full flex items-center justify-center text-stone-400 flex-col gap-3 py-10">
                  <svg className="w-8 h-8 animate-spin text-emerald-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  <span className="text-xs font-bold uppercase tracking-widest">Searching Google...</span>
                </div>
              ) : searchError ? (
                <div className="text-center py-10 px-4 text-red-600 bg-red-50 rounded-2xl border border-red-100">
                  <svg className="w-10 h-10 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  <p className="font-bold text-sm">Search Failed</p>
                  <p className="text-xs mt-1 opacity-80">{searchError}</p>
                </div>
              ) : results.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {results.map((img, idx) => (
                    <button 
                      key={idx} 
                      onClick={() => onSelect(img.url)}
                      className="group relative aspect-square rounded-xl overflow-hidden border-2 border-transparent hover:border-emerald-500 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 active:scale-95 bg-white"
                    >
                      <img src={img.thumbnail || img.url} alt={img.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end text-left">
                        <p className="text-white text-xs font-bold line-clamp-2 leading-tight">{img.title}</p>
                        <p className="text-emerald-400 text-[9px] uppercase tracking-wider font-black mt-1 truncate">{img.source}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 text-stone-400">
                  <svg className="w-12 h-12 mx-auto mb-3 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  <p className="text-sm font-medium">No results found.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab Content: Direct Link */}
        {activeTab === 'link' && (
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Paste Image URL (.jpg, .png)</label>
              <input 
                type="url" 
                value={urlInput}
                onChange={handleUrlChange}
                placeholder="https://example.com/tomato.jpg"
                className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm outline-none focus:border-emerald-500 transition-colors shadow-sm"
              />
            </div>

            <div className="w-full aspect-video bg-stone-100 rounded-2xl border-2 border-dashed border-stone-200 overflow-hidden relative flex items-center justify-center">
              {!urlInput ? (
                 <div className="text-stone-400 flex flex-col items-center gap-2">
                   <svg className="w-8 h-8 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                   <span className="text-xs font-medium">Image Preview</span>
                 </div>
              ) : previewError ? (
                 <div className="text-red-400 flex flex-col items-center gap-2 p-4 text-center">
                   <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                   <span className="text-xs font-bold text-red-600 mt-1">Failed to load image.</span>
                   <span className="text-[10px] text-red-500/80 leading-tight">Link may be invalid, or the host server is blocking direct embeds (CORS).</span>
                 </div>
              ) : (
                <>
                  {isValidating && (
                    <div className="absolute inset-0 bg-stone-100/80 backdrop-blur-sm flex items-center justify-center z-10">
                       <svg className="w-6 h-6 animate-spin text-emerald-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    </div>
                  )}
                  <img 
                    src={urlInput} 
                    alt="Preview" 
                    onLoad={() => { setPreviewError(false); setIsValidating(false); }}
                    onError={() => { setPreviewError(true); setIsValidating(false); }}
                    className="w-full h-full object-contain bg-black/5"
                  />
                </>
              )}
            </div>

            <button 
              onClick={handleLinkSubmit}
              disabled={!urlInput || previewError || isValidating}
              className="w-full py-4 bg-emerald-600 text-white font-black rounded-xl shadow-sm disabled:opacity-50 transition-colors hover:bg-emerald-700 active:scale-95"
            >
              Add Image to Seed
            </button>
          </div>
        )}
      </div>
    </div>
  );
}