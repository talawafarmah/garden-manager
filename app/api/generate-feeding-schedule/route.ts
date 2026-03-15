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
      
      Extract the different dosage recommendations based on growth stage and format them into a JSON ARRAY.
      
      CRITICAL SCHEMA RULES:
      You MUST return an array of objects matching this EXACT interface. Do not use any values outside of the allowed enums.
      
      {
        "growth_stage": "seedling" | "vegetative" | "flowering" | "fruiting" | "dormant" | "pre_plant",
        "method": "soil_drench" | "foliar_spray" | "top_dress" | "soil_mix" | "hydroponic",
        "dosage_amount": number (e.g., 2),
        "dosage_unit": "ml" | "tsp" | "tbsp" | "cup" | "oz" | "g" | "lbs" | "kg",
        "dilution_amount": number (e.g., 1. Use 0 if not applicable),
        "dilution_unit": "gallon" | "liter" | "sq_ft" | "cubic_yard" | "acre",
        "frequency_days": number (e.g., if every 2 weeks, output 14. If once a week, output 7),
        "notes": "string (Any warnings or mixing instructions. Keep concise.)"
      }

      Return ONLY the raw JSON array. Do not wrap in markdown or backticks.
    `;

    const result = await model.generateContent(prompt);
    let cleanJson = result.response.text().replace(/```json|```/g, "").trim();

    if (!cleanJson.startsWith('[')) {
      const firstBracket = cleanJson.indexOf('[');
      const lastBracket = cleanJson.lastIndexOf(']');
      if (firstBracket !== -1 && lastBracket !== -1) {
        cleanJson = cleanJson.substring(firstBracket, lastBracket + 1);
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