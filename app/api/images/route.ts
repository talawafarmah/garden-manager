import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
  }

  const apiKey = process.env.SERPER_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ 
      error: 'SERPER_API_KEY is missing from environment variables.' 
    }, { status: 500 });
  }

  try {
    const res = await fetch('https://google.serper.dev/images', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q: query,
        num: 12 // Number of images to return
      })
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch from Serper API' }, { status: res.status });
    }

    const data = await res.json();

    if (!data.images || data.images.length === 0) {
      return NextResponse.json({ items: [] });
    }

    // Format the Serper results to match our frontend component's expectations
    const items = data.images.map((img: any) => ({
      url: img.imageUrl,
      thumbnail: img.thumbnailUrl || img.imageUrl,
      title: img.title,
      source: img.source
    }));

    return NextResponse.json({ items });
    
  } catch (e: any) {
    return NextResponse.json({ error: `Internal Server Error: ${e.message}` }, { status: 500 });
  }
}