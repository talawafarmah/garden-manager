import React, { useState } from 'react';

// The exact function from our app
const fetchImageAsDataURL = async (url: string, log: (msg: string) => void): Promise<string> => {
  if (!url) return "";
  if (url.startsWith('data:')) return url;
  
  const proxies = [
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
  ];

  for (const proxy of proxies) {
    try {
      log(`Trying proxy: ${proxy.split('/')[2]}...`);
      const res = await fetch(proxy);
      if (res.ok) {
        const blob = await res.blob();
        if (!blob.type.includes('image')) {
            log(`❌ Proxy returned non-image data: ${blob.type}`);
            continue;
        }
        return await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            log(`✅ Success! Converted to Base64 (${(reader.result as string).length} bytes)`);
            resolve(reader.result as string);
          };
          reader.readAsDataURL(blob);
        });
      } else {
        log(`❌ Proxy returned status: ${res.status}`);
      }
    } catch (e: any) {
       log(`❌ Proxy fetch failed: ${e.message}`);
    }
  }
  log(`🚨 All proxies failed for ${url}`);
  return "";
};

export default function CollageTester({ handleGoBack }: any) {
  const [motherUrl, setMotherUrl] = useState("https://www.johnnyseeds.com/dw/image/v2/BJjc_PRD/on/demandware.static/-/Sites-jss-master/default/dw151fb278/images/products/vegetables/03138g_01_sunpeach.jpg");
  const [fatherUrl, setFatherUrl] = useState("https://www.johnnyseeds.com/dw/image/v2/BJjc_PRD/on/demandware.static/-/Sites-jss-master/default/dwec5f0ebc/images/products/vegetables/03128g_01_sungold.jpg");
  
  const [logs, setLogs] = useState<string[]>([]);
  const [motherBase64, setMotherBase64] = useState("");
  const [fatherBase64, setFatherBase64] = useState("");
  const [finalCollage, setFinalCollage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const addLog = (msg: string) => setLogs(prev => [...prev, msg]);

  const runTest = async () => {
    setIsProcessing(true);
    setLogs([]);
    setMotherBase64("");
    setFatherBase64("");
    setFinalCollage("");

    addLog("--- STARTING MOTHER DOWNLOAD ---");
    const mBase64 = await fetchImageAsDataURL(motherUrl, addLog);
    setMotherBase64(mBase64);

    addLog("--- STARTING FATHER DOWNLOAD ---");
    const fBase64 = await fetchImageAsDataURL(fatherUrl, addLog);
    setFatherBase64(fBase64);

    if (!mBase64 && !fBase64) {
        addLog("🚨 Both downloads failed. Cannot create collage.");
        setIsProcessing(false);
        return;
    }

    addLog("--- STARTING CANVAS RENDER ---");
    const canvas = document.createElement('canvas');
    canvas.width = 800; canvas.height = 800;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
        addLog("🚨 Failed to get 2D Canvas context.");
        setIsProcessing(false);
        return;
    }

    ctx.fillStyle = '#e7e5e4'; 
    ctx.fillRect(0, 0, 800, 800);

    const drawSide = (src: string, isLeft: boolean, parentName: string) => {
      return new Promise<void>((res) => {
        if (!src) {
            addLog(`⚠️ Skipping ${parentName}, no valid source.`);
            return res();
        }
        
        const img = new Image();
        img.onload = () => {
          addLog(`✅ Canvas successfully loaded ${parentName} Image Object.`);
          const scale = Math.max(400 / img.width, 800 / img.height);
          const w = img.width * scale;
          const h = img.height * scale;
          const x = isLeft ? (400 - w) / 2 : 400 + (400 - w) / 2;
          const y = (800 - h) / 2;
          
          ctx.save();
          ctx.beginPath();
          ctx.rect(isLeft ? 0 : 400, 0, 400, 800);
          ctx.clip();
          ctx.drawImage(img, x, y, w, h);
          ctx.restore();
          res();
        };
        img.onerror = () => {
            addLog(`🚨 Canvas FAILED to load ${parentName} Image Object!`);
            res();
        };
        img.src = src;
      });
    };

    await Promise.all([drawSide(mBase64, true, "Mother"), drawSide(fBase64, false, "Father")]);

    // Center UI
    ctx.fillStyle = '#1c1917'; ctx.fillRect(396, 0, 8, 800);
    ctx.font = '900 24px sans-serif';
    if (mBase64) { ctx.fillStyle = 'rgba(244, 63, 94, 0.9)'; ctx.fillRect(20, 20, 140, 40); ctx.fillStyle = 'white'; ctx.fillText('♀ Mother', 35, 48); }
    if (fBase64) { ctx.fillStyle = 'rgba(59, 130, 246, 0.9)'; ctx.fillRect(420, 20, 140, 40); ctx.fillStyle = 'white'; ctx.fillText('♂ Father', 435, 48); }
    ctx.beginPath(); ctx.arc(400, 400, 40, 0, 2 * Math.PI); ctx.fillStyle = '#1c1917'; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = '#f5f5f4'; ctx.stroke();
    ctx.fillStyle = 'white'; ctx.font = '900 36px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('X', 400, 400);

    try {
        const finalImg = canvas.toDataURL('image/jpeg', 0.85);
        addLog(`✅ Canvas successfully exported to Base64 JPEG (${finalImg.length} bytes).`);
        setFinalCollage(finalImg);
    } catch (e: any) {
        addLog(`🚨 Canvas export failed (Likely CORS Taint): ${e.message}`);
    }

    setIsProcessing(false);
  };

  return (
    <div className="min-h-screen bg-stone-50 p-6 text-stone-900 font-sans max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4 border-b border-stone-200 pb-4">
         <button onClick={() => handleGoBack('dashboard')} className="p-2 bg-stone-200 rounded-full">←</button>
         <h1 className="text-2xl font-black">Collage Test Lab</h1>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-xs font-bold text-stone-500 uppercase">Mother URL</label>
          <input type="text" value={motherUrl} onChange={e => setMotherUrl(e.target.value)} className="w-full p-2 border rounded" />
        </div>
        <div>
          <label className="text-xs font-bold text-stone-500 uppercase">Father URL</label>
          <input type="text" value={fatherUrl} onChange={e => setFatherUrl(e.target.value)} className="w-full p-2 border rounded" />
        </div>
        <button onClick={runTest} disabled={isProcessing} className="w-full py-3 bg-blue-600 text-white font-bold rounded shadow disabled:opacity-50">
           {isProcessing ? "Testing..." : "Run Collage Test"}
        </button>
      </div>

      <div className="bg-stone-900 text-green-400 p-4 rounded text-xs font-mono h-64 overflow-y-auto space-y-1">
        {logs.map((log, i) => <div key={i}>{log}</div>)}
        {logs.length === 0 && <div className="text-stone-600">Waiting for test to run...</div>}
      </div>

      {finalCollage && (
        <div className="border-4 border-emerald-500 rounded-xl overflow-hidden shadow-2xl">
           <div className="bg-emerald-500 text-white text-center font-black py-1 text-xs">FINAL RENDER SUCCESS</div>
           <img src={finalCollage} className="w-full h-auto" />
        </div>
      )}
    </div>
  );
}