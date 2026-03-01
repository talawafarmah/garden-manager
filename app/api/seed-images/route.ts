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
    // Expanded to include major US and Canadian seed suppliers
    let siteQuery = 'site:rareseeds.com OR site:johnnyseeds.com OR site:burpee.com OR site:westcoastseeds.com OR site:oscseeds.com OR site:mckenzieseeds.com OR site:richters.com OR site:incredibleseeds.ca OR site:veseys.com OR site:scovillecanada.com';
    
    if (vendor && vendor.trim() !== '') {
      const cleanVendor = vendor.replace(/[^a-zA-Z0-9.-]/g, '').toLowerCase();
      // Added .ca to the domain guesser for Canadian vendors
      siteQuery = `site:${cleanVendor}.com OR site:${cleanVendor}.ca OR site:${cleanVendor}.org OR site:${cleanVendor}.net OR "${vendor}"`;
    }

    // 2. Fetch search results using Yahoo Search via GET 
    // Yahoo is significantly more tolerant of serverless/datacenter IP addresses than DDG/Google
    const searchUrl = `https://search.yahoo.com/search?p=${encodeURIComponent(`${siteQuery} ${query} seeds`)}`;
    
    const searchResponse = await fetch(searchUrl, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    });

    if (!searchResponse.ok) {
      throw new Error(`Upstream search engine blocked the request (${searchResponse.status}). Try Wikipedia mode.`);
    }

    const html = await searchResponse.text();

    // 3. Extract the actual target URLs from the search results
    const resultRegex = /<a[^>]+href="([^"]+)"[\s\S]*?>([\s\S]*?)<\/a>/g;
    const pageUrls: {url: string, title: string}[] = [];
    let match;

    while ((match = resultRegex.exec(html)) !== null && pageUrls.length < 5) {
      let url = match[1];
      
      // Yahoo wraps outgoing links in a tracking redirect. The actual URL is encoded in the 'RU=' parameter.
      if (url.includes('RU=')) {
        const ruMatch = url.match(/RU=([^/]+)/);
        if (ruMatch) {
          try {
            url = decodeURIComponent(ruMatch[1]);
          } catch (e) {
            continue; // Skip if URL decoding fails
          }
        }
      }
      
      // Basic horticultural filter: skip generic category pages, ensure it's a real HTTP link
      if (
        url.startsWith('http') && 
        !url.includes('yahoo.com') && 
        !url.toLowerCase().includes('/category/') &&
        !url.toLowerCase().includes('/collections/')
      ) {
        const cleanTitle = match[2].replace(/<[^>]+>/g, '').trim();
        // Ensure the link actually has text (skips structural/hidden anchors)
        if (cleanTitle.length > 0) {
          pageUrls.push({ 
            url, 
            title: cleanTitle 
          });
        }
      }
    }

    if (pageUrls.length === 0) {
      return NextResponse.json({ error: 'No catalog pages found. The upstream engine returned zero matches.' }, { status: 404 });
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