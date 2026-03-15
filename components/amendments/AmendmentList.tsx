'use client';

import React, { useState, useMemo } from 'react';
import { Search, Plus, Leaf, Droplets, Sun, Beaker, Sprout, Mountain, Microscope, ArrowLeft, Image as ImageIcon } from 'lucide-react';
import { Amendment, AmendmentType } from '@/types/amendments';

interface AmendmentListProps {
  initialAmendments: Amendment[];
  navigateTo: (view: any, payload?: any) => void; 
  handleGoBack: (fallbackView: any) => void;      
}

export default function AmendmentList({ initialAmendments, navigateTo, handleGoBack }: AmendmentListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<AmendmentType | 'all'>('all');

  const filteredAmendments = useMemo(() => {
    return initialAmendments.filter((amendment) => {
      const matchesSearch = 
        amendment.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        amendment.brand.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesType = typeFilter === 'all' || amendment.type === typeFilter;

      return matchesSearch && matchesType;
    });
  }, [initialAmendments, searchTerm, typeFilter]);

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
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center px-1">
        <button onClick={() => handleGoBack('dashboard')} className="p-2 -ml-2 hover:bg-gray-200 rounded-full transition-colors">
          <ArrowLeft size={24} className="text-gray-700" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Digital Shed</h1>
        <button 
          onClick={() => navigateTo('amendment_new')}
          className="bg-green-700 text-white p-2 rounded-full shadow-lg active:scale-90 transition-transform"
        >
          <Plus size={20} />
        </button>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4 sticky top-0 z-10">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500 bg-gray-50 text-gray-900 font-medium outline-none"
            placeholder="Search by brand or product name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex overflow-x-auto pb-2 -mx-1 px-1 gap-2 scrollbar-hide">
          <button
            onClick={() => setTypeFilter('all')}
            className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-bold transition-colors ${
              typeFilter === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            All Inventory
          </button>
          {['organic', 'synthetic', 'compost', 'mineral', 'microbial'].map((type) => (
            <button
              key={type}
              onClick={() => setTypeFilter(type as AmendmentType)}
              className={`whitespace-nowrap flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-bold capitalize transition-colors ${
                typeFilter === type ? 'bg-green-700 text-white' : 'bg-green-50 text-green-800'
              }`}
            >
              {getTypeIcon(type as AmendmentType)}
              {type.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {filteredAmendments.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200 border-dashed">
          <p className="text-gray-500 font-medium mb-4">No amendments found.</p>
          <button 
            onClick={() => navigateTo('amendment_new')}
            className="inline-flex items-center text-green-700 font-bold hover:text-green-800 transition-colors"
          >
            <Plus size={18} className="mr-1" /> Add New Amendment
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredAmendments.map((amendment) => (
            <button 
              key={amendment.id} 
              onClick={() => navigateTo('amendment_detail', amendment)}
              className="text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-green-400 hover:shadow-md transition-all h-full flex flex-col group"
            >
                <div className="flex gap-4 mb-3 w-full items-start">
                  {/* Thumbnail Image Logic */}
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

                  <div className="flex-1 pt-1">
                    <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest block mb-1">
                      {amendment.brand}
                    </span>
                    <h3 className="text-base font-bold text-gray-900 group-hover:text-green-700 transition-colors line-clamp-2 leading-tight">
                      {amendment.name}
                    </h3>
                  </div>
                </div>

                <div className="mt-auto flex justify-between items-center">
                  <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 bg-gray-50 text-gray-600 border border-gray-100 rounded-lg">
                    {getTypeIcon(amendment.type)}
                    {amendment.type}
                  </span>

                  <div className="flex gap-1.5">
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
          ))}
        </div>
      )}
    </div>
  );
}