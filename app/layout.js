import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import MainLayout from "@/components/MainLayout";
import FeedbackWidget from "@/components/FeedbackWidget";
import CookieBanner from "@/components/CookieBanner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Ascend – Dein KI-Laufcoach | PerformanceProtokoll",
  description: "Der kostenlose KI-Laufcoach der sich an dich erinnert. Wissenschaftlich fundierte Trainingspläne, persönlicher Coach-Chat und Wetterintegration. By PerformanceProtokoll.",
  openGraph: {
    title: "Ascend – KI-Laufcoach",
    description: "Dein persönlicher KI-Laufcoach. Kostenlos. By PerformanceProtokoll.",
    images: [
      {
        url: "/icons/icon-512.png",
      },
    ],
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="de"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#e63228" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="apple-mobile-web-app-title" content="Ascend" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="app-body flex min-h-full flex-col bg-bg font-sans text-text">
        <Navbar />
        <MainLayout>
          {children}
        </MainLayout>
        <Footer />
        <FeedbackWidget />
        <CookieBanner />

        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .then(function() { /* ok */ })
                    .catch(function(err) { console.log('SW error:', err); });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
