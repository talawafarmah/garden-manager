import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});



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

export const metadata: Metadata = {
  title: 'Mi Deh Yah Farms',
  description: 'Select your seeds for the upcoming season! Browse our seed vault and build your custom garden wishlist.',
  icons: {
      icon: '/my-square-icon.jpg', // Point this to the file in your public folder
    },
  // These are the "Open Graph" tags that iMessage, WhatsApp, and Facebook use
  openGraph: {
    title: 'Mi Deh Yah Farms | Seed Wishlist',
    description: 'Select your seeds for the upcoming season! Browse our seed vault and build your custom garden wishlist.',
    url: 'https://garden-manager-git-main-talawafarmah-6352s-projects.vercel.app', // Replace with your actual deployed URL
    siteName: 'Mi Deh Yah Farms',
    
    images: [
      {
        url: '/og-image.jpg', // This points to the image you put in the public folder
        width: 1200,
        height: 630,
        alt: 'Mi Deh Yah Farms Garden',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  
  // These are specific to Twitter/X texts
  twitter: {
    card: 'summary_large_image',
    title: 'Mi Deh Yah Farms | Seed Wishlist',
    description: 'Select your seeds for the upcoming season! Browse our seed vault and build your custom garden wishlist.',
    images: ['/og-image.jpg'],
  },
}

