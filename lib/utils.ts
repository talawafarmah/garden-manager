import { supabase } from './supabase';

const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = (error) => reject(error);
  });
};

export const fetchWithRetry = async (url: string, options: RequestInit, retries = 5) => {
  let delay = 1000;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).substring(0, 150)}...`);
      return await res.json();
    } catch (e: any) {
      if (i === retries - 1) throw e;
      await new Promise(r => setTimeout(r, delay));
      delay *= 2;
    }
  }
};

export const getBestModel = async () => {
  let modelToUse = "gemini-2.5-flash-lite"; 
  if (!!process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
    try {
      const modelsRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      const modelsData = await modelsRes.json();
      if (modelsData.models) {
        const available = modelsData.models
          .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent') && m.name.includes('gemini'))
          .map((m: any) => m.name.replace('models/', ''));
        const bestModels = ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
        modelToUse = bestModels.find(m => available.includes(m)) || available[0] || modelToUse;
      }
    } catch (e) {
         console.error("Model discovery failed, attempting to proceed.", e);
    }
  }
  return modelToUse;
};

export const generateNextId = async (prefix: string) => {
  const { data, error } = await supabase.from('seed_inventory').select('id').ilike('id', `${prefix}%`);
  let maxNum = 0;
  if (!error && data) {
    data.forEach(row => {
      const match = row.id.match(new RegExp(`^${prefix}(\\d+)`, 'i'));
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });
  }
  return `${prefix.toUpperCase()}${maxNum + 1}`;
};