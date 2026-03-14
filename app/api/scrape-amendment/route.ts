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
        const arrayBuffer = await value.arrayBuffer();
        imageParts.push({
          inlineData: {
            data: Buffer.from(arrayBuffer).toString("base64"),
            mimeType: value.type
          }
        });
      }
    }

    if (imageParts.length === 0) {
      return NextResponse.json({ error: 'No images provided for analysis.' }, { status: 400 });
    }

    // 2. Initialize the Flash model (optimized for speed and OCR)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // 3. The "Botanical Extraction" System Prompt
    const prompt = `
      You are a specialized horticultural data extractor. Analyze the provided photos of a fertilizer or soil amendment product.
      
      Extract the following data points into a single, valid JSON object:
      - brand: The manufacturer/brand name (e.g., FoxFarm, Espoma).
      - name: The specific product name (e.g., Ocean Forest, Garden-Tone).
      - type: Categorize as exactly one of: 'organic', 'synthetic', 'compost', 'mineral', or 'microbial'.
      - n_value: The Total Nitrogen percentage (number only).
      - p_value: The Available Phosphate percentage (number only).
      - k_value: The Soluble Potash percentage (number only).
      - calcium: Calcium (Ca) percentage if listed (number only, else 0).
      - magnesium: Magnesium (Mg) percentage if listed (number only, else 0).
      - derived_from: A concise string listing the ingredients or sources (e.g., "Feather meal, fish emulsion").
      - barcode_upc: The 12 or 13 digit UPC barcode if legible in any photo.

      Return ONLY the raw JSON object. Do not include markdown formatting or commentary.
    `;

    // 4. Execute Multi-Modal Analysis
    const result = await model.generateContent([prompt, ...imageParts]);
    const responseText = result.response.text();
    
    // 5. Clean and Parse JSON
    const cleanJson = responseText.replace(/```json|```/g, "").trim();
    const analyzedData = JSON.parse(cleanJson);

    // Return the structured botanical data to your NewAmendmentForm
    return NextResponse.json(analyzedData);

  } catch (error: any) {
    console.error('Vision Analysis Error:', error);
    
    // Handle specific API key errors
    if (error.message?.includes('API_KEY_INVALID')) {
      return NextResponse.json({ error: 'Gemini API Key is invalid or expired.' }, { status: 401 });
    }

    return NextResponse.json({ 
      error: 'The AI could not read these photos. Please try taking clearer, closer shots of the labels.' 
    }, { status: 500 });
  }
}