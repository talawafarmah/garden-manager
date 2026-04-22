'use client';

import React, { useState, useMemo } from 'react';
import { Search, Plus, Leaf, Beaker, Sprout, Mountain, Microscope, ArrowLeft, Image as ImageIcon, ArchiveX } from 'lucide-react';
import { Amendment, AmendmentType } from '@/types/amendments';

interface AmendmentListProps {
  initialAmendments: Amendment[];
  navigateTo: (view: any, payload?: any) => void; 
  handleGoBack: (fallbackView: any) => void;      
  isEmbedded?: boolean; 
}

export default function AmendmentList({ initialAmendments, navigateTo, handleGoBack, isEmbedded = false }: AmendmentListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<AmendmentType | 'all'>('all');
  const [formFilter, setFormFilter] = useState<string>('all');

  const filteredAmendments = useMemo(() => {
    return initialAmendments.filter((amendment: any) => {
      const safeName = amendment.name || '';
      const safeBrand = amendment.brand || '';
      
      const matchesSearch = 
        safeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        safeBrand.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesType = typeFilter === 'all' || amendment.type === typeFilter;
      const itemForm = amendment.physical_form || 'Granular/Dry';
      const matchesForm = formFilter === 'all' || itemForm === formFilter;

      return matchesSearch && matchesType && matchesForm;
    });
  }, [initialAmendments, searchTerm, typeFilter, formFilter]);

  const getTypeIcon = (type: AmendmentType) => {
    switch(type) {
      case 'organic': return <Leaf size={14} />;
      case 'synthetic': return <Beaker size={14} />;
      case 'compost': return <Sprout size={14} />;
      case 'mineral': return <Mountain size={14} />;
      case 'microbial': return <Microscope size={14} />;
      default: return <Leaf size={14} />;
    }
  };

  return (
    <div className={`space-y-6 ${!isEmbedded ? 'pb-20' : ''}`}>
      
      {!isEmbedded && (
        <div className="flex justify-between items-center px-1">
          <div className="flex items-center gap-2">
            <button onClick={() => handleGoBack('dashboard')} className="p-2 -ml-2 hover:bg-gray-200 rounded-full transition-colors" title="Go Back">
              <ArrowLeft size={24} className="text-gray-700" />
            </button>
            <button onClick={() => navigateTo('dashboard')} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-700" title="Dashboard">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
            </button>
          </div>
          <h1 className="text-xl font-bold text-gray-900 pr-2">Digital Shed</h1>
          <button 
            onClick={() => navigateTo('amendment_new')}
            className="bg-green-700 text-white p-2 rounded-full shadow-lg active:scale-90 transition-transform"
          >
            <Plus size={20} />
          </button>
        </div>
      )}

      <div className={`bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4 ${!isEmbedded ? 'sticky top-0 z-10' : ''}`}>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-xl focus:ring-green-500 focus:border-green-500 bg-gray-50 text-gray-900 font-medium outline-none"
              placeholder="Search by brand or product name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="relative w-full sm:w-48 shrink-0">
             <select 
               value={formFilter} 
               onChange={e => setFormFilter(e.target.value)} 
               className="w-full bg-gray-50 border border-gray-300 rounded-xl py-2.5 pl-3 pr-8 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-sm text-gray-700 font-bold appearance-none cursor-pointer"
             >
               <option value="all">All Forms</option>
               <option value="Granular/Dry">Granular / Dry</option>
               <option value="Powder">Fine Powder</option>
               <option value="Water-Soluble">Water Soluble</option>
               <option value="Liquid">Liquid</option>
             </select>
             <svg className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </div>
        </div>

        <div className="flex overflow-x-auto pb-2 -mx-1 px-1 gap-2 scrollbar-hide">
          <button
            onClick={() => setTypeFilter('all')}
            className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-bold transition-colors ${
              typeFilter === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All Source Types
          </button>
          {['organic', 'synthetic', 'compost', 'mineral', 'microbial'].map((type) => (
            <button
              key={type}
              onClick={() => setTypeFilter(type as AmendmentType)}
              className={`whitespace-nowrap flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-bold capitalize transition-colors ${
                typeFilter === type ? 'bg-green-700 text-white' : 'bg-green-50 text-green-800 hover:bg-green-100'
              }`}
            >
              {getTypeIcon(type as AmendmentType)}
              {type.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {filteredAmendments.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200 border-dashed shadow-sm">
          <p className="text-gray-500 font-medium mb-4">No amendments found matching your filters.</p>
          <button 
            onClick={() => navigateTo('amendment_new')}
            className="inline-flex items-center text-green-700 font-bold hover:text-green-800 transition-colors bg-green-50 px-4 py-2 rounded-lg"
          >
            <Plus size={18} className="mr-1" /> Add New Amendment
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredAmendments.map((amendment: any) => {
            // FIXED: Removed the quantity logic. Now it only greys out if explicitly marked empty.
            const isEmpty = amendment.is_empty;

            return (
              <button 
                key={amendment.id} 
                onClick={() => navigateTo('amendment_detail', amendment)}
                className={`text-left bg-white border border-gray-200 rounded-xl p-4 transition-all h-full flex flex-col group relative ${isEmpty ? 'opacity-60 grayscale-[50%]' : 'hover:border-green-400 hover:shadow-md'}`}
              >
                  {isEmpty && (
                     <div className="absolute top-2 right-2 bg-stone-100 border border-stone-200 text-stone-500 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded shadow-sm flex items-center gap-1 z-10">
                        <ArchiveX size={10} /> Empty
                     </div>
                  )}

                  <div className="flex gap-4 mb-3 w-full items-start">
                    {amendment.thumbnail ? (
                      <img 
                        src={amendment.thumbnail} 
                        alt={amendment.name} 
                        className="w-16 h-16 rounded-xl object-cover border border-gray-200 flex-shrink-0 shadow-sm"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-gray-50 flex flex-col items-center justify-center border border-gray-200 flex-shrink-0 text-gray-400">
                        <ImageIcon size={20} className="mb-1 opacity-50" />
                        <span className="text-[8px] font-bold uppercase">No Image</span>
                      </div>
                    )}

                    <div className="flex-1 pt-1 pr-14">
                      <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest block mb-1">
                        {amendment.brand}
                      </span>
                      <h3 className={`text-base font-bold transition-colors line-clamp-2 leading-tight ${isEmpty ? 'text-gray-700' : 'text-gray-900 group-hover:text-green-700'}`}>
                        {amendment.name}
                      </h3>
                    </div>
                  </div>

                  <div className="mt-auto flex justify-between items-center">
                    <div className="flex flex-col gap-1">
                       <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 bg-gray-50 text-gray-600 border border-gray-100 rounded-lg w-fit">
                         {getTypeIcon(amendment.type)}
                         {amendment.type.replace('_', ' ')}
                       </span>
                       <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                         {amendment.physical_form || 'Granular/Dry'}
                       </span>
                    </div>

                    <div className="flex gap-1.5 items-end">
                      <div className="bg-green-50/80 border border-green-100 px-2 py-1 rounded flex items-center gap-1">
                        <span className="text-[9px] text-green-700 font-bold">N</span>
                        <span className="font-bold text-xs text-gray-900">{amendment.n_value}</span>
                      </div>
                      <div className="bg-blue-50/80 border border-blue-100 px-2 py-1 rounded flex items-center gap-1">
                        <span className="text-[9px] text-blue-700 font-bold">P</span>
                        <span className="font-bold text-xs text-gray-900">{amendment.p_value}</span>
                      </div>
                      <div className="bg-orange-50/80 border border-orange-100 px-2 py-1 rounded flex items-center gap-1">
                        <span className="text-[9px] text-orange-600 font-bold">K</span>
                        <span className="font-bold text-xs text-gray-900">{amendment.k_value}</span>
                      </div>
                    </div>
                  </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  );
}