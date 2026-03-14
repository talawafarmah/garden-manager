import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

// Access the key using your existing environment variable
const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY!);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const imageParts: any[] = [];

    // 1. Extract all images from the multipart form data
    for (const [key, value] of Array.from(formData.entries())) {
      if (key.startsWith('image_') && value instanceof File) {
        // More robust conversion for Next.js environments
        const bytes = await value.arrayBuffer();
        const base64 = Buffer.from(bytes).toString("base64");
        
        imageParts.push({
          inlineData: {
            data: base64,
            mimeType: value.type
          }
        });
      }
    }

    if (imageParts.length === 0) {
      return NextResponse.json({ error: 'No images found in request.' }, { status: 400 });
    }

    // 2. Initialize the model
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // 3. The "Botanical Extraction" System Prompt
    const prompt = `
      You are a specialized horticultural data extractor. Analyze the provided photos of a fertilizer or soil amendment product.
      
      Extract the following data points into a single, valid JSON object:
      - brand: The manufacturer/brand name.
      - name: The specific product name.
      - type: Categorize as exactly one of: 'organic', 'synthetic', 'compost', 'mineral', or 'microbial'.
      - n_value: The Total Nitrogen percentage (number only).
      - p_value: The Available Phosphate percentage (number only).
      - k_value: The Soluble Potash percentage (number only).
      - calcium: Calcium (Ca) percentage if listed (number only, else 0).
      - magnesium: Magnesium (Mg) percentage if listed (number only, else 0).
      - derived_from: A concise string listing the ingredients or sources.
      - barcode_upc: The 12 or 13 digit UPC barcode if legible.

      Return ONLY the raw JSON object. No markdown, no backticks.
    `;

    // 4. Execute Analysis
    const result = await model.generateContent([prompt, ...imageParts]);
    const responseText = result.response.text();
    
    // 5. Clean up AI response
    // Sometimes AI includes ```json ... ``` tags which break JSON.parse
    const cleanJson = responseText.replace(/```json|```/g, "").trim();
    
    try {
      const analyzedData = JSON.parse(cleanJson);
      return NextResponse.json(analyzedData);
    } catch (parseError) {
      console.error("JSON Parse Error:", responseText);
      return NextResponse.json({ error: "AI returned invalid data format." }, { status: 500 });
    }

  } catch (error: any) {
    console.error('API Route Error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal Server Error' 
    }, { status: 500 });
  }
}