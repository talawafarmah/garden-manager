import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY!);

export async function POST(request: Request) {
  try {
    const { brand, name } = await request.json();

    if (!brand || !name) {
      return NextResponse.json({ error: 'Brand and Name are required.' }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    const prompt = `
      Act as a master horticulturist. Use Google Search to find the official manufacturer application rate and feeding schedule for the garden product: "${brand} ${name}".
      
      Extract a general or standard dosage recommendation and format it into this EXACT JSON structure:
      {
        "stage": "all" | "seedling" | "vegetative" | "flowering",
        "amount": "string (e.g., '1 tbsp per gallon' or '1 cup per 10 sq ft')",
        "frequency": "string (e.g., 'Every 2 weeks' or 'Once a month')",
        "notes": "string (Any crucial warnings, like 'Water in well' or 'Do not apply directly to stem')"
      }

      Return ONLY the raw JSON. No markdown or backticks.
    `;

    const result = await model.generateContent(prompt);
    let cleanJson = result.response.text().replace(/```json|```/g, "").trim();

    // Safety JSON extraction
    if (!cleanJson.startsWith('{')) {
      const firstBrace = cleanJson.indexOf('{');
      const lastBrace = cleanJson.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        cleanJson = cleanJson.substring(firstBrace, lastBrace + 1);
      }
    }

    return NextResponse.json(JSON.parse(cleanJson));

  } catch (error: any) {
    console.error('Feeding Schedule AI Error:', error);
    return NextResponse.json({ 
      error: 'Could not find a standard feeding schedule for this product.' 
    }, { status: 500 });
  }
}