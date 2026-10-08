import type { Metadata } from "next";
import localFont from "next/font/local";
import LocalizedMetadata from "@/components/LocalizedMetadata";
import { localizedMetadata } from "@/lib/i18n/metadata";
import "./globals.css";
import LegalFooter from "@/components/legal/LegalFooter";

const geistSans = localFont({
  src: "./fonts/Geist-Variable.woff2",
  weight: "100 900",
  variable: "--font-geist-sans",
});

const geistMono = localFont({
  src: "./fonts/GeistMono-Variable.woff2",
  weight: "100 900",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = localizedMetadata.tr;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('simplify-theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.classList.toggle('dark',t==='dark');document.documentElement.style.colorScheme=t;var l=localStorage.getItem('simplify-language');document.documentElement.lang=l==='en'?'en':'tr'}catch(e){document.documentElement.lang='tr'}})()`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col"><LocalizedMetadata />{children}<LegalFooter /></body>
    </html>
  );
}
