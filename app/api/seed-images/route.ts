import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_ENGINE_ID;

  if (!apiKey || !cx) {
    return NextResponse.json({ 
      error: 'Google Search API is not configured on the server. Please add GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID to your environment variables.' 
    }, { status: 500 });
  }

  try {
    // Call the official Google Custom Search JSON API
    const searchUrl = `https://customsearch.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}&searchType=image&num=10&safe=active`;
    
    const res = await fetch(searchUrl);
    const data = await res.json();

    if (data.error) {
      return NextResponse.json({ error: data.error.message }, { status: res.status });
    }

    if (!data.items) {
      return NextResponse.json({ items: [] });
    }

    // Format the results into a clean, predictable array for the frontend
    const items = data.items.map((item: any) => ({
      url: item.link,                 // The full resolution image
      thumbnail: item.image.thumbnailLink, // A lightweight thumbnail for the grid
      title: item.title,
      source: item.displayLink
    }));

    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ error: `Internal Server Error: ${e.message}` }, { status: 500 });
  }
}