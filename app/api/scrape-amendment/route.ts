import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

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

    if (imageParts.length === 0) {
      return NextResponse.json({ error: 'No images found in request.' }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    const prompt = `
      You are a specialized horticultural data extractor. Analyze the provided photos.
      
      TASK:
      1. Identify the brand and product name.
      2. Extract the N-P-K percentages, Calcium, and Magnesium.
      3. Extract the recommended "application_rate" and "application_method".
      4. If crucial data is blurry or missing, USE GOOGLE SEARCH GROUNDING to find the official specifications for this product.
      
      REQUIREMENTS:
      - Return ONLY a raw JSON object. Do not wrap in markdown or backticks.
      - "type" MUST be exactly one of: "organic", "synthetic", "compost", "mineral", or "microbial". If it is a blend, pick the primary base.
      
      JSON STRUCTURE:
      {
        "brand": "string",
        "name": "string",
        "type": "string",
        "n_value": number,
        "p_value": number,
        "k_value": number,
        "calcium": number,
        "magnesium": number,
        "application_rate": "string",
        "application_method": "string",
        "derived_from": "string",
        "barcode_upc": "string"
      }
    `;

    const result = await model.generateContent([prompt, ...imageParts]);
    const responseText = result.response.text();
    
    // Scrub markdown formatting (e.g. ```json ... ```)
    let cleanJson = responseText.replace(/```json|```/g, "").trim();

    // Safety net: Extract only the JSON block if the AI added conversational text
    if (!cleanJson.startsWith('{')) {
      const firstBrace = cleanJson.indexOf('{');
      const lastBrace = cleanJson.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        cleanJson = cleanJson.substring(firstBrace, lastBrace + 1);
      }
    }

    try {
      const analyzedData = JSON.parse(cleanJson);
      return NextResponse.json(analyzedData);
    } catch (parseError) {
      console.error("JSON Parse Error. Raw AI Response:", responseText);
      return NextResponse.json({ 
        error: "The AI returned an invalid format. Please take a clearer photo and try again." 
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('API Route Error:', error);
    
    if (error.message?.includes('API_KEY_INVALID') || error.message?.includes('403')) {
      return NextResponse.json({ error: 'Gemini API Key is invalid or expired.' }, { status: 401 });
    }

    return NextResponse.json({ 
      error: error.message || 'Internal Server Error during image processing.' 
    }, { status: 500 });
  }
}