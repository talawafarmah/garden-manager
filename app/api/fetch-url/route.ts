import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const browserHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    };

    let html = '';
    let lastStatus = 0;

    // ATTEMPT 1: Direct Fetch (Will likely fail on Cloudflare-protected sites)
    try {
      const response1 = await fetch(url, { headers: browserHeaders });
      lastStatus = response1.status;
      if (response1.ok) {
        html = await response1.text();
      }
    } catch (e) { console.log("Direct fetch failed."); }

    // ATTEMPT 2: Fallback to CorsProxy.io (Great for bypassing basic blocks)
    if (!html) {
      console.log(`Direct fetch failed (Status ${lastStatus}). Trying CorsProxy.io...`);
      try {
        const response2 = await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`, { headers: browserHeaders });
        lastStatus = response2.status;
        if (response2.ok) {
          html = await response2.text();
        }
      } catch (e) { console.log("CorsProxy fetch failed."); }
    }

    // ATTEMPT 3: Fallback to AllOrigins (Aggressive bypass)
    if (!html) {
      console.log(`CorsProxy failed (Status ${lastStatus}). Trying AllOrigins.win...`);
      try {
        const response3 = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`, { headers: browserHeaders });
        lastStatus = response3.status;
        if (response3.ok) {
          html = await response3.text();
        }
      } catch (e) { console.log("AllOrigins fetch failed."); }
    }

    // FINAL CHECK
    if (!html) {
      throw new Error(`Target website firewall blocked the request (Status ${lastStatus}). Please enter details manually.`);
    }

    return NextResponse.json({ html });

  } catch (error: any) {
    console.error("Proxy waterfall error:", error);
    return NextResponse.json({ error: error.message || 'Failed to fetch URL' }, { status: 500 });
  }
}