'use client';

import React, { useRef, useState } from 'react';
import { Camera, X, Loader2, Send, Plus, Image as ImageIcon } from 'lucide-react';

interface ProductCaptureProps {
  // We now pass the raw image File back so the form can upload it to Supabase
  onAnalysisSuccess: (data: any, capturedImages: File[]) => void;
  onCancel: () => void;
}

export default function ProductCapture({ onAnalysisSuccess, onCancel }: ProductCaptureProps) {
  const [images, setImages] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setImages(prev => [...prev, ...Array.from(files)]);
  };

  const processImages = async () => {
    if (images.length === 0) return;
    setIsProcessing(true);
    setError(null);

    const formData = new FormData();
    images.forEach((img, i) => formData.append(`image_${i}`, img));

    try {
      const response = await fetch('/api/scrape-amendment', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze product.');
      }

      // Pass the data AND the images back
      onAnalysisSuccess(data, images);
    } catch (err: any) {
      console.error("Capture Processing Error:", err);
      setError(err.message || 'Analysis failed. Please try clearer photos.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/95 flex flex-col p-6 overflow-y-auto">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-xl font-bold text-white">Product Analysis</h2>
        <button onClick={onCancel} className="p-2 text-white/50 hover:text-white transition-colors">
          <X size={24} />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center max-w-sm mx-auto w-full">
        {images.length === 0 ? (
          <div className="text-center space-y-4">
            <div className="w-20 h-20 bg-green-600 rounded-full flex items-center justify-center mx-auto shadow-lg">
              <Camera size={32} className="text-white" />
            </div>
            <p className="text-gray-300 text-sm">Take photos or choose from your gallery.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 w-full mb-6">
            {images.map((img, idx) => (
              <div key={idx} className="relative aspect-square bg-gray-800 rounded-lg overflow-hidden border border-white/10">
                <img src={URL.createObjectURL(img)} className="object-cover w-full h-full" alt={`Capture ${idx + 1}`} />
                <button 
                  onClick={() => setImages(images.filter((_, i) => i !== idx))}
                  className="absolute top-1 right-1 bg-black/50 p-1 rounded-full text-white"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            {images.length < 4 && (
               <button 
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square border-2 border-dashed border-white/20 rounded-lg flex flex-col items-center justify-center text-white/40 hover:text-white/60 hover:border-white/40 transition-colors"
               >
                 <Plus size={24} />
                 <span className="text-[10px] mt-1 font-bold">ADD PHOTO</span>
               </button>
            )}
          </div>
        )}

        {error && <p className="text-red-400 text-sm font-semibold mb-4 text-center bg-red-500/10 p-3 rounded-lg border border-red-500/20">{error}</p>}

        <div className="w-full space-y-3 mt-4">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className="w-full bg-white text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 transition-transform"
          >
            <ImageIcon size={20} />
            {images.length === 0 ? 'Choose or Capture' : 'Add Another Photo'}
          </button>

          {images.length > 0 && (
            <button
              onClick={processImages}
              disabled={isProcessing}
              className="w-full bg-green-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 shadow-lg shadow-green-900/40 transition-transform"
            >
              {isProcessing ? <Loader2 className="animate-spin" /> : <Send size={20} />}
              {isProcessing ? 'Analyzing Data...' : 'Analyze Product'}
            </button>
          )}
        </div>

        {/* Removed capture="environment" to allow Gallery access */}
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleCapture} 
          accept="image/*" 
          className="hidden" 
          multiple 
        />
      </div>
    </div>
  );
}