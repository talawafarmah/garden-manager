'use client';

import React, { useState } from 'react';
import { Beaker, BookOpen, Warehouse, Camera, Plus } from 'lucide-react';
// Import your new Amendment components
import AmendmentList from './amendments/AmendmentList';

interface ApothecaryProps {
  navigateTo: (view: any, payload?: any) => void;
  handleGoBack: (fallback: any) => void;
  amendments: any[]; // Pass this in from your main page.tsx state
}

export default function Apothecary({ navigateTo, handleGoBack, amendments }: ApothecaryProps) {
  const [activeTab, setActiveTab] = useState<'brewery' | 'recipes' | 'inventory'>('brewery');

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Tab Navigation */}
      <div className="flex bg-white border-b border-gray-200 sticky top-0 z-20">
        <button
          onClick={() => setActiveTab('brewery')}
          className={`flex-1 py-4 text-sm font-bold flex flex-col items-center gap-1 ${
            activeTab === 'brewery' ? 'text-green-700 border-b-2 border-green-700' : 'text-gray-500'
          }`}
        >
          <Beaker size={20} />
          <span>Brewery</span>
        </button>
        <button
          onClick={() => setActiveTab('recipes')}
          className={`flex-1 py-4 text-sm font-bold flex flex-col items-center gap-1 ${
            activeTab === 'recipes' ? 'text-green-700 border-b-2 border-green-700' : 'text-gray-500'
          }`}
        >
          <BookOpen size={20} />
          <span>Recipes</span>
        </button>
        <button
          onClick={() => setActiveTab('inventory')}
          className={`flex-1 py-4 text-sm font-bold flex flex-col items-center gap-1 ${
            activeTab === 'inventory' ? 'text-green-700 border-b-2 border-green-700' : 'text-gray-500'
          }`}
        >
          <Warehouse size={20} />
          <span>Inventory</span>
        </button>
      </div>

      <div className="p-4">
        {activeTab === 'brewery' && (
          <div className="text-center py-12 text-gray-500 italic">
            Brewery module coming soon...
          </div>
        )}

        {activeTab === 'recipes' && (
          <div className="text-center py-12 text-gray-500 italic">
            Soil & Tea recipes coming soon...
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="space-y-4">
            {/* Quick Action for Scanning */}
            <div className="flex gap-3 mb-6">
              <button
                onClick={() => navigateTo('amendment_new')}
                className="flex-1 flex items-center justify-center gap-2 bg-green-700 text-white py-4 rounded-xl font-bold shadow-md active:scale-95 transition-transform"
              >
                <Camera size={20} />
                <span>Scan New Input</span>
              </button>
            </div>

            {/* The New Digital Shed List */}
            <AmendmentList 
              initialAmendments={amendments} 
              navigateTo={navigateTo} 
              handleGoBack={handleGoBack} 
            />
          </div>
        )}
      </div>
    </div>
  );
}