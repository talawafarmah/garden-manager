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
    // Default to the big three heirloom/open-pollinated sources if no vendor is specified
    let siteQuery = 'site:rareseeds.com OR site:johnnyseeds.com OR site:burpee.com';
    
    if (vendor && vendor.trim() !== '') {
      // Clean the vendor string and target it specifically
      const cleanVendor = vendor.replace(/[^a-zA-Z0-9.-]/g, '').toLowerCase();
      // Try to guess the domain structure or do a strict keyword match
      siteQuery = `site:${cleanVendor}.com OR site:${cleanVendor}.org OR site:${cleanVendor}.net OR "${vendor}"`;
    }

    // 2. Fetch search results from a non-JS search engine (DuckDuckGo HTML)
    // We append "seeds" to ensure we get product pages and not blog posts
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`${siteQuery} ${query} seeds`)}`;
    
    const searchResponse = await fetch(searchUrl, {
      headers: { 
        // Spoof a standard user agent so we don't get blocked by bot protection
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    });

    if (!searchResponse.ok) {
      throw new Error('Upstream search engine rate limit reached. Try Wikipedia mode.');
    }

    const html = await searchResponse.text();

    // 3. Extract the actual target URLs from the search results
    // FIXED: Removed the /s flag and used [\s\S] to support older TS compilation targets
    const resultRegex = /<a class="result__url" href="([^"]+)"[\s\S]*?>([\s\S]*?)<\/a>/g;
    const pageUrls: {url: string, title: string}[] = [];
    let match;

    while ((match = resultRegex.exec(html)) !== null && pageUrls.length < 5) {
      let url = match[1];
      // DDG wraps URLs in a redirect; we need to extract the actual destination
      if (url.includes('uddg=')) {
        url = decodeURIComponent(new URLSearchParams(url.split('?')[1]).get('uddg') || url);
      }
      
      // Basic horticultural filter: skip generic category pages, prioritize product pages
      if (!url.toLowerCase().includes('/category/')) {
        pageUrls.push({ 
          url, 
          title: match[2].replace(/<[^>]+>/g, '').trim() // Strip HTML tags from title
        });
      }
    }

    if (pageUrls.length === 0) {
      return NextResponse.json({ error: 'No catalog pages found for this variety.' }, { status: 404 });
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
            // Clean up the title (e.g., "Tomato Cherokee Purple Seeds - Baker Creek" -> "Tomato Cherokee Purple Seeds")
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