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

    // Explicitly FORCE JSON output to prevent mobile parsing errors
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json"
      }
    });
    
    const prompt = `
      You are a specialized horticultural data extractor. Analyze the provided photos of the product and its labels.
      
      TASK:
      1. Identify the brand, product name, and main ingredients.
      2. Extract the Guaranteed Analysis (N-P-K, Ca, Mg).
      3. EXTRACT FEEDING SCHEDULES: Read the application instructions on the label and convert them into structured guidelines.
      
      REQUIREMENTS:
      - "type" MUST be exactly one of: "organic", "synthetic", "compost", "mineral", or "microbial".
      
      JSON SCHEMA (You must return a JSON object exactly matching this structure):
      {
        "brand": "string",
        "name": "string",
        "type": "string",
        "n_value": number,
        "p_value": number,
        "k_value": number,
        "calcium": number,
        "magnesium": number,
        "derived_from": "string",
        "barcode_upc": "string",
        "schedules": [
          {
            "growth_stage": "seedling" | "vegetative" | "flowering" | "fruiting" | "dormant" | "pre_plant",
            "method": "soil_drench" | "foliar_spray" | "top_dress" | "soil_mix" | "hydroponic",
            "dosage_amount": number,
            "dosage_unit": "ml" | "tsp" | "tbsp" | "cup" | "oz" | "g" | "lbs" | "kg",
            "dilution_amount": number (use 0 if none),
            "dilution_unit": "gallon" | "liter" | "sq_ft" | "cubic_yard" | "acre",
            "frequency_days": number (e.g., 7 for weekly, 14 for bi-weekly. use null if as-needed),
            "notes": "string (Crucial mixing warnings or application tips)"
          }
        ]
      }
    `;

    const result = await model.generateContent([prompt, ...imageParts]);
    const cleanJson = result.response.text(); 

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