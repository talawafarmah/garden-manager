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

    // Initialize model and explicitly FORCE JSON output to prevent mobile parsing errors
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json"
      }
    });
    
    const prompt = `
      You are a specialized horticultural data extractor. Analyze the provided photos.
      
      TASK:
      1. Identify the brand and product name.
      2. Extract the N-P-K percentages, Calcium, and Magnesium.
      3. Extract the recommended "application_rate" and "application_method".
      
      REQUIREMENTS:
      - "type" MUST be exactly one of: "organic", "synthetic", "compost", "mineral", or "microbial".
      
      JSON SCHEMA (You must return a JSON object exactly matching this):
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
    const cleanJson = result.response.text(); // No more regex scrubbing needed!

    try {
      const analyzedData = JSON.parse(cleanJson);
      return NextResponse.json(analyzedData);
    } catch (parseError) {
      console.error("JSON Parse Error on Mobile Payload:", cleanJson);
      return NextResponse.json({ 
        error: "Failed to parse analysis data." 
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('API Route Error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal Server Error during image processing.' 
    }, { status: 500 });
  }
}