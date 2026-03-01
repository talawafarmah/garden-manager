import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const basicAuth = req.headers.get('authorization');

  if (basicAuth) {
    const authValue = basicAuth.split(' ')[1];
    const [user, pwd] = atob(authValue).split(':');

    // Fetch credentials from environment variables
    const adminUser = process.env.AUTH_ADMIN_USER;
    const adminPass = process.env.AUTH_ADMIN_PASS;
    const viewerUser = process.env.AUTH_VIEWER_USER;
    const viewerPass = process.env.AUTH_VIEWER_PASS;

    // Check if it's the Admin
    if (user === adminUser && pwd === adminPass) {
      const response = NextResponse.next();
      // Set a cookie so the frontend components know this is an admin
      response.cookies.set('app_role', 'admin', { path: '/' });
      return response;
    }

    // Check if it's the Read-Only Viewer
    if (user === viewerUser && pwd === viewerPass) {
      const response = NextResponse.next();
      // Set a cookie so the frontend components know to hide edit buttons
      response.cookies.set('app_role', 'viewer', { path: '/' });
      return response;
    }
  }

  // If no auth header or wrong credentials, prompt the browser login box
  return new NextResponse('Unauthorized: Access Denied', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Garden Manager Secure Area"',
    },
  });
}

// Ensure the middleware runs on all pages and API routes, but skips static assets (images, CSS)
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};