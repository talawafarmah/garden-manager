import { NextResponse } from 'next/server';
import { AmendmentType } from '@/types/amendments';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const barcode = searchParams.get('barcode');

  if (!barcode) {
    return NextResponse.json(
      { error: 'Barcode parameter is required.' },
      { status: 400 }
    );
  }

  try {
    const upcResponse = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`, {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store', 
    });

    if (!upcResponse.ok) {
      throw new Error(`External API responded with status: ${upcResponse.status}`);
    }

    const data = await upcResponse.json();

    if (!data.items || data.items.length === 0) {
      return NextResponse.json(
        { error: 'Product not found in UPC database.' },
        { status: 404 }
      );
    }

    const item = data.items[0];
    const fullText = `${item.title} ${item.description}`.toLowerCase();

    // Botanical Parsing Logic: Extract N-P-K using Regex
    const npkRegex = /\b(\d{1,2}(?:\.\d+)?)[-:](\d{1,2}(?:\.\d+)?)[-:](\d{1,2}(?:\.\d+)?)\b/;
    const npkMatch = fullText.match(npkRegex);

    let n_value = 0, p_value = 0, k_value = 0;
    if (npkMatch) {
      n_value = parseFloat(npkMatch[1]) || 0;
      p_value = parseFloat(npkMatch[2]) || 0;
      k_value = parseFloat(npkMatch[3]) || 0;
    }

    // Botanical Categorization
    let type: AmendmentType = 'synthetic';
    if (fullText.includes('organic') || fullText.includes('omri') || fullText.includes('natural')) {
      type = 'organic';
    } else if (fullText.includes('compost') || fullText.includes('casting')) {
      type = 'compost';
    } else if (fullText.includes('microbial') || fullText.includes('mycorrhizae')) {
      type = 'microbial';
    } else if (fullText.includes('mineral') || fullText.includes('rock dust') || fullText.includes('azomite')) {
      type = 'mineral';
    }

    const mappedData = {
      barcode_upc: barcode,
      brand: item.brand || extractBrandFromTitle(item.title) || 'Unknown Brand',
      name: cleanTitle(item.title, item.brand),
      type,
      n_value,
      p_value,
      k_value,
      derived_from: item.description ? item.description.substring(0, 250) + '...' : '',
    };

    return NextResponse.json(mappedData, { status: 200 });

  } catch (error) {
    console.error('Error scraping barcode:', error);
    return NextResponse.json(
      { error: 'Failed to process barcode. Please enter details manually.' },
      { status: 500 }
    );
  }
}

function extractBrandFromTitle(title: string): string {
  if (!title) return '';
  const words = title.split(' ');
  return words.slice(0, 2).join(' ');
}

function cleanTitle(title: string, brand?: string): string {
  if (!title) return '';
  let cleaned = title;
  if (brand && title.toLowerCase().startsWith(brand.toLowerCase())) {
    cleaned = title.substring(brand.length).trim();
  }
  return cleaned;
}