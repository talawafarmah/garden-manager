import React from 'react';
import { Amendment } from '@/types/amendments';
import { Leaf, Droplets, Sun } from 'lucide-react'; 

interface AmendmentHeaderProps {
  amendment: Amendment;
}

export default function AmendmentHeader({ amendment }: AmendmentHeaderProps) {
  // Safely default optional secondary macronutrients to 0 for our mathematical logic
  const calciumValue = amendment.calcium ?? 0;
  const magnesiumValue = amendment.magnesium ?? 0;

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
      <div className="mb-4">
        <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
          {amendment.brand}
        </span>
        <h1 className="text-2xl font-bold text-gray-900 leading-tight">
          {amendment.name}
        </h1>
        <p className="text-sm text-gray-600 capitalize mt-1">
          {amendment.type.replace('_', ' ')} Amendment
        </p>
      </div>

      {/* N-P-K Visualizer */}
      <div className="flex justify-between items-center bg-gray-50 rounded-lg p-4">
        <div className="text-center flex-1">
          <div className="flex items-center justify-center mb-1 text-green-600">
            <Leaf size={18} className="mr-1" />
            <span className="font-bold text-xl">{amendment.n_value}</span>
          </div>
          <span className="text-xs text-gray-500 font-medium uppercase">Nitrogen</span>
        </div>
        
        <div className="w-px h-10 bg-gray-200"></div>
        
        <div className="text-center flex-1">
          <div className="flex items-center justify-center mb-1 text-blue-600">
            <Droplets size={18} className="mr-1" />
            <span className="font-bold text-xl">{amendment.p_value}</span>
          </div>
          <span className="text-xs text-gray-500 font-medium uppercase">Phosphorus</span>
        </div>

        <div className="w-px h-10 bg-gray-200"></div>

        <div className="text-center flex-1">
          <div className="flex items-center justify-center mb-1 text-orange-500">
            <Sun size={18} className="mr-1" />
            <span className="font-bold text-xl">{amendment.k_value}</span>
          </div>
          <span className="text-xs text-gray-500 font-medium uppercase">Potassium</span>
        </div>
      </div>

      {/* Secondary Nutrients */}
      {(calciumValue > 0 || magnesiumValue > 0) && (
        <div className="mt-4 flex gap-4 text-sm text-gray-600 bg-emerald-50 p-3 rounded-md border border-emerald-100">
          <span className="font-medium text-emerald-800">Includes:</span>
          {calciumValue > 0 && <span>Ca: {calciumValue}%</span>}
          {magnesiumValue > 0 && <span>Mg: {magnesiumValue}%</span>}
        </div>
      )}
    </div>
  );
}