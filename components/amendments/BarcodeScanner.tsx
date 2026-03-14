'use client';

import React, { useRef, useState } from 'react';
import { Camera, X, Loader2, Image as ImageIcon } from 'lucide-react';

interface BarcodeScannerProps {
  onScanSuccess: (barcode: string) => void;
  onCancel: () => void;
}

export default function BarcodeScanner({ onScanSuccess, onCancel }: BarcodeScannerProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    // Create a FormData object to send the image to our API
    const formData = new FormData();
    formData.append('image', file);

    try {
      // We will create this endpoint next to handle the image decoding
      const response = await fetch('/api/decode-barcode', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Failed to read barcode');

      onScanSuccess(data.barcode);
    } catch (err: any) {
      console.error('Scan Error:', err);
      setError(err.message || 'Could not detect a barcode. Try a clearer photo.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/90 flex flex-col items-center justify-center p-6">
      <button 
        onClick={onCancel}
        className="absolute top-6 right-6 p-2 bg-white/10 rounded-full text-white"
      >
        <X size={24} />
      </button>

      <div className="w-full max-w-sm text-center">
        <div className="mb-8">
          <div className="w-24 h-24 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-900/20">
            {isProcessing ? (
              <Loader2 size={40} className="text-white animate-spin" />
            ) : (
              <Camera size={40} className="text-white" />
            )}
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {isProcessing ? 'Analyzing Image...' : 'Scan Amendment'}
          </h2>
          <p className="text-gray-400 text-sm">
            Take a clear photo of the barcode on the back of the product.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className="w-full bg-white text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50"
          >
            <Camera size={20} />
            Capture Photo
          </button>
          
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className="w-full bg-white/10 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-white/20 transition-colors"
          >
            <ImageIcon size={18} />
            Choose from Gallery
          </button>
        </div>

        {/* Hidden Input for Camera Trigger */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleCapture}
          accept="image/*"
          capture="environment"
          className="hidden"
        />
      </div>
    </div>
  );
}