import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const basicAuth = req.headers.get('authorization');

  if (basicAuth) {
    const authValue = basicAuth.split(' ')[1];
    const decoded = atob(authValue);
    
    // Safely split at the FIRST colon only, just in case a password contains a colon
    const colonIndex = decoded.indexOf(':');
    const user = decoded.substring(0, colonIndex);
    const pwd = decoded.substring(colonIndex + 1);

    // Fetch credentials from environment variables and TRIM invisible whitespace
    const adminUser = process.env.AUTH_ADMIN_USER?.trim();
    const adminPass = process.env.AUTH_ADMIN_PASS?.trim();
    const viewerUser = process.env.AUTH_VIEWER_USER?.trim();
    const viewerPass = process.env.AUTH_VIEWER_PASS?.trim();

    // DEBUG LOGGING: Look at your terminal (where npm run dev is running) to see this output
    console.log(`[Auth Attempt] User: "${user}" | Pass: "${pwd}"`);
    console.log(`[Env Loaded] Admin: "${adminUser}" | Viewer: "${viewerUser}"`);

    // Check if it's the Admin
    if (user === adminUser && pwd === adminPass) {
      console.log("[Auth Success] Logged in as Admin");
      const response = NextResponse.next();
      response.cookies.set('app_role', 'admin', { path: '/' });
      return response;
    }

    // Check if it's the Read-Only Viewer
    if (user === viewerUser && pwd === viewerPass) {
      console.log("[Auth Success] Logged in as Viewer");
      const response = NextResponse.next();
      response.cookies.set('app_role', 'viewer', { path: '/' });
      return response;
    }
    
    console.log("[Auth Failed] Credentials did not match.");
  }

  // If no auth header or wrong credentials, prompt the browser login box
  return new NextResponse('Unauthorized: Access Denied', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Garden Manager Secure Area"',
    },
  });
}

// Ensure the middleware runs on all pages and API routes, but skips static assets
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};