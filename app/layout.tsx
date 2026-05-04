import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

// @ts-ignore - Bypasses TS strict-mode "Nutrient Lockout" for CSS side-effect imports.
// The Next.js bundler will still process this perfectly during the Vercel build.
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: '#1c1917', // stone-900 to match the app header
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1, // Prevents auto-zooming on form inputs on iOS
  userScalable: false,
};

export const metadata: Metadata = {
  title: 'Mi Deh Yah Farms',
  description: 'Select your seeds for the upcoming season! Browse our seed vault and build your custom garden wishlist.',
  manifest: '/manifest.json', 
  appleWebApp: {              
    capable: true,
    statusBarStyle: 'default',
    title: 'Garden',
  },
  icons: {
      icon: '/my-square-icon.jpg', 
    },
  openGraph: {
    title: 'Mi Deh Yah Farms | Seed Wishlist',
    description: 'Select your seeds for the upcoming season! Browse our seed vault and build your custom garden wishlist.',
    url: 'https://garden-manager-git-main-talawafarmah-6352s-projects.vercel.app', 
    siteName: 'Mi Deh Yah Farms',
    
    images: [
      {
        url: '/og-image.jpg', 
        width: 1200,
        height: 630,
        alt: 'Mi Deh Yah Farms Garden',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  
  twitter: {
    card: 'summary_large_image',
    title: 'Mi Deh Yah Farms | Seed Wishlist',
    description: 'Select your seeds for the upcoming season! Browse our seed vault and build your custom garden wishlist.',
    images: ['/og-image.jpg'],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}