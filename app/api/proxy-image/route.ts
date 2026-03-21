import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get('url');

  if (!imageUrl) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  try {
    // We fetch the image on the server, spoofing a real browser to bypass CDNs
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    });

    if (!response.ok) {
      return new NextResponse(`Failed to fetch image: ${response.status}`, { status: response.status });
    }

    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    // We return the raw image binary, but we ADD the magical CORS header 
    // so your browser Canvas is allowed to read it without tainting!
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    });
  } catch (error: any) {
    return new NextResponse(`Error proxying image: ${error.message}`, { status: 500 });
  }
}