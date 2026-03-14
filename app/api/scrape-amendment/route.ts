import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize with your existing key
const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY!);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const imageParts: any[] = [];

    for (const [key, value] of Array.from(formData.entries())) {
      if (key.startsWith('image_') && value instanceof File) {
        const bytes = await value.arrayBuffer();
        imageParts.push({
          inlineData: {
            data: Buffer.from(bytes).toString("base64"),
            mimeType: value.type
          }
        });
      }
    }

    if (imageParts.length === 0) return NextResponse.json({ error: 'No images found.' }, { status: 400 });

    // FIX: Updated to Gemini 2.5 Flash for stable production use
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    const prompt = `
      Extract the following from these fertilizer photos into a JSON object:
      - brand, name, type (organic/synthetic/compost/mineral/microbial), 
      - n_value, p_value, k_value, calcium, magnesium, 
      - derived_from, barcode_upc.
      Return ONLY raw JSON.
    `;

    const result = await model.generateContent([prompt, ...imageParts]);
    const responseText = result.response.text();
    const cleanJson = responseText.replace(/```json|```/g, "").trim();

    return NextResponse.json(JSON.parse(cleanJson));

  } catch (error: any) {
    console.error('Gemini Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}