import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const vendor = searchParams.get('vendor');

  if (!query) {
    return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
  }

  try {
    // 1. Construct a targeted site search
    let siteQuery = 'site:rareseeds.com OR site:johnnyseeds.com OR site:burpee.com';
    
    if (vendor && vendor.trim() !== '') {
      const cleanVendor = vendor.replace(/[^a-zA-Z0-9.-]/g, '').toLowerCase();
      siteQuery = `site:${cleanVendor}.com OR site:${cleanVendor}.org OR site:${cleanVendor}.net OR "${vendor}"`;
    }

    // 2. Fetch search results using DuckDuckGo Lite via POST (Stealthier, less rate-limiting)
    const searchUrl = 'https://lite.duckduckgo.com/lite/';
    const payloadQuery = `${siteQuery} ${query} seeds`;
    
    const searchResponse = await fetch(searchUrl, {
      method: 'POST',
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Origin': 'https://lite.duckduckgo.com',
        'Referer': 'https://lite.duckduckgo.com/'
      },
      body: `q=${encodeURIComponent(payloadQuery)}`
    });

    if (!searchResponse.ok) {
      throw new Error(`Upstream search engine rate limit reached (${searchResponse.status}). Try Wikipedia mode.`);
    }

    const html = await searchResponse.text();

    // 3. Extract the actual target URLs from the search results
    // Broadened regex to catch any href in the Lite HTML structure
    const resultRegex = /<a[^>]+href="([^"]+)"[\s\S]*?>([\s\S]*?)<\/a>/g;
    const pageUrls: {url: string, title: string}[] = [];
    let match;

    while ((match = resultRegex.exec(html)) !== null && pageUrls.length < 5) {
      let url = match[1];
      
      // DDG Lite wraps outgoing links in a redirect
      if (url.includes('uddg=')) {
        try {
          url = decodeURIComponent(new URLSearchParams(url.split('?')[1]).get('uddg') || url);
        } catch (e) {
          continue; // Skip if we can't parse the URL
        }
      }
      
      // Filter out internal DDG links, generic category pages, and ensure it's a real HTTP link
      if (
        url.startsWith('http') && 
        !url.includes('duckduckgo.com') && 
        !url.toLowerCase().includes('/category/') &&
        !url.toLowerCase().includes('/collections/')
      ) {
        pageUrls.push({ 
          url, 
          title: match[2].replace(/<[^>]+>/g, '').trim() // Strip HTML tags
        });
      }
    }

    if (pageUrls.length === 0) {
      return NextResponse.json({ error: 'No catalog pages found. The search engine may be temporarily blocking requests.' }, { status: 404 });
    }

    // 4. Concurrently fetch the product pages and scrape their Open Graph images
    const imageResults = await Promise.all(pageUrls.map(async (page) => {
      try {
        const pageRes = await fetch(page.url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            signal: AbortSignal.timeout(3500) // 3.5s timeout so the UI doesn't hang forever
        });
        
        if (!pageRes.ok) return null;
        
        const pageHtml = await pageRes.text();
        
        // Look for standard social media sharing images (og:image)
        const ogMatch = pageHtml.match(/<meta\s+(?:property|name)="og:image"\s+content="([^"]+)"/i);
        let imgUrl = ogMatch ? ogMatch[1] : null;

        // Fallback: Find the first large image if og:image is missing
        if (!imgUrl) {
          const imgRegex = /<img[^>]+src="([^">]+)"[^>]*>/gi;
          let imgMatch;
          while ((imgMatch = imgRegex.exec(pageHtml)) !== null) {
            const tempUrl = imgMatch[1].toLowerCase();
            // Skip logos, icons, and tiny UI elements
            if (!tempUrl.includes('logo') && !tempUrl.includes('icon') && !tempUrl.includes('svg')) {
              imgUrl = imgMatch[1];
              break;
            }
          }
        }

        if (imgUrl) {
          // Normalize relative URLs to absolute URLs
          if (imgUrl.startsWith('/')) {
            imgUrl = new URL(imgUrl, page.url).href;
          }
          
          return {
            url: imgUrl,
            // Clean up the title (e.g., "Tomato Cherokee Purple Seeds - Baker Creek" -> "Tomato Cherokee Purple")
            title: page.title.split('|')[0].split('-')[0].trim(),
            source: new URL(page.url).hostname.replace('www.', ''),
          };
        }
      } catch (e) {
        // Silently fail individual page scrapes (timeouts, blockades) to ensure others succeed
        return null; 
      }
      return null;
    }));

    const validImages = imageResults.filter(Boolean);

    if (validImages.length === 0) {
        return NextResponse.json({ error: 'Found catalog pages, but could not extract images.' }, { status: 404 });
    }

    return NextResponse.json({ images: validImages });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}