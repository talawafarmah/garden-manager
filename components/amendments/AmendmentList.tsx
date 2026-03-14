'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Search, Plus, Leaf, Droplets, Sun, Beaker, Sprout, Mountain, Microscope } from 'lucide-react';
import { Amendment, AmendmentType } from '@/types/amendments';

interface AmendmentListProps {
  initialAmendments: Amendment[];
}

export default function AmendmentList({ initialAmendments }: AmendmentListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<AmendmentType | 'all'>('all');

  // Memoize the filtered list so it only recalculates when search/filter changes
  const filteredAmendments = useMemo(() => {
    return initialAmendments.filter((amendment) => {
      const matchesSearch = 
        amendment.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        amendment.brand.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesType = typeFilter === 'all' || amendment.type === typeFilter;

      return matchesSearch && matchesType;
    });
  }, [initialAmendments, searchTerm, typeFilter]);

  // Helper to get an icon based on amendment type
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
    <div className="space-y-6">
      {/* Search and Filter Controls */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4 sticky top-4 z-10">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500 bg-gray-50"
            placeholder="Search by brand or product name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Filter Chips - Scrollable horizontally on small screens */}
        <div className="flex overflow-x-auto pb-2 -mx-1 px-1 gap-2 scrollbar-hide">
          <button
            onClick={() => setTypeFilter('all')}
            className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              typeFilter === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All Inventory
          </button>
          {['organic', 'synthetic', 'compost', 'mineral', 'microbial'].map((type) => (
            <button
              key={type}
              onClick={() => setTypeFilter(type as AmendmentType)}
              className={`whitespace-nowrap flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${
                typeFilter === type ? 'bg-green-700 text-white' : 'bg-green-50 text-green-800 hover:bg-green-100'
              }`}
            >
              {getTypeIcon(type as AmendmentType)}
              {type.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Amendment Cards */}
      {filteredAmendments.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100 border-dashed">
          <p className="text-gray-500 mb-4">No amendments found matching your criteria.</p>
          <Link 
            href="/amendments/new"
            className="inline-flex items-center text-green-700 font-semibold hover:text-green-800"
          >
            <Plus size={18} className="mr-1" /> Add New Amendment
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredAmendments.map((amendment) => (
            <Link href={`/amendments/${amendment.id}`} key={amendment.id} className="block group">
              <div className="bg-white border border-gray-200 rounded-xl p-4 hover:border-green-400 hover:shadow-md transition-all h-full flex flex-col">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-0.5">
                      {amendment.brand}
                    </span>
                    <h3 className="text-lg font-bold text-gray-900 group-hover:text-green-700 transition-colors line-clamp-1">
                      {amendment.name}
                    </h3>
                  </div>
                  <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 bg-gray-100 text-gray-600 rounded-md">
                    {getTypeIcon(amendment.type)}
                  </span>
                </div>

                {/* Mini N-P-K Visualizer */}
                <div className="mt-auto grid grid-cols-3 gap-2 bg-gray-50 rounded-lg p-2 border border-gray-100">
                  <div className="text-center">
                    <div className="text-xs text-green-600 font-bold flex items-center justify-center">
                      <Leaf size={10} className="mr-1" /> N
                    </div>
                    <div className="font-semibold text-sm text-gray-800">{amendment.n_value}</div>
                  </div>
                  <div className="text-center border-l border-gray-200">
                    <div className="text-xs text-blue-600 font-bold flex items-center justify-center">
                      <Droplets size={10} className="mr-1" /> P
                    </div>
                    <div className="font-semibold text-sm text-gray-800">{amendment.p_value}</div>
                  </div>
                  <div className="text-center border-l border-gray-200">
                    <div className="text-xs text-orange-500 font-bold flex items-center justify-center">
                      <Sun size={10} className="mr-1" /> K
                    </div>
                    <div className="font-semibold text-sm text-gray-800">{amendment.k_value}</div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}