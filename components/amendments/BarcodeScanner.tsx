'use client';

import React, { useState } from 'react';
import { useZxing } from 'react-zxing';
import { Camera, X } from 'lucide-react';

interface BarcodeScannerProps {
  onScanSuccess: (barcode: string) => void;
  onCancel: () => void;
}

export default function BarcodeScanner({ onScanSuccess, onCancel }: BarcodeScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(true);

  const { ref } = useZxing({
    // Changed from onDecodeResult to onResult for v1.1.3 compatibility
    onResult(result) {
      // Pause scanning immediately to prevent multiple rapid-fire triggers
      setIsScanning(false);
      
      // Optional: Give the user physical feedback that the scan worked
      if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(200); 
      }

      const rawBarcode = result.getText();
      onScanSuccess(rawBarcode);
    },
    onError(err) {
      // ZXing throws errors continuously when a barcode is NOT found in the frame.
      // We ignore these standard "NotFound" errors to keep the console clean.
      if (err.name !== 'NotFoundException') {
        console.error(err);
      }
    },
    // Enforce rear camera usage for field work
    constraints: {
      video: {
        facingMode: 'environment',
      },
    },
  });

  // If the browser blocks camera access
  if (error) {
    return (
      <div className="p-6 bg-red-50 text-red-700 rounded-xl text-center border border-red-200">
        <p className="font-semibold mb-2">Camera Access Denied</p>
        <p className="text-sm mb-4">Please ensure your browser has permission to access the camera.</p>
        <button 
          onClick={onCancel}
          className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-800 rounded-md font-medium"
        >
          Close Scanner
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center">
      {/* Top Header / Close Button */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent z-10">
        <div className="flex items-center text-white">
          <Camera size={20} className="mr-2" />
          <span className="font-semibold">Scan Amendment Barcode</span>
        </div>
        <button 
          onClick={onCancel}
          className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
        >
          <X size={24} />
        </button>
      </div>

      {/* Video Viewport & Scanning Reticle */}
      <div className="relative w-full max-w-sm aspect-[3/4] overflow-hidden rounded-2xl bg-gray-900 border-2 border-white/20">
        {isScanning ? (
          <>
            {/* The actual video element attached to the device camera */}
            <video 
              ref={ref} 
              className="absolute inset-0 w-full h-full object-cover" 
              playsInline 
              muted 
            />
            
            {/* Overlay to guide the user */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-64 h-32 border-2 border-green-500 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] flex items-center justify-center">
                <div className="w-full h-[2px] bg-green-400/50 animate-pulse"></div>
              </div>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-green-600 text-white">
            <span className="text-2xl mb-2">✅</span>
            <span className="font-semibold text-lg">Barcode Captured!</span>
            <p className="text-sm text-green-100 mt-2">Fetching amendment data...</p>
          </div>
        )}
      </div>

      <div className="absolute bottom-10 left-0 right-0 text-center px-6">
        <p className="text-white/70 text-sm">
          Center the product's barcode within the green rectangle to automatically scan.
        </p>
      </div>
    </div>
  );
}