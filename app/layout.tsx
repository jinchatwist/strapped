import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Fraunces, Rubik } from "next/font/google";
import { RegisterSW } from "@/components/RegisterSW";
import { Splash } from "@/components/Splash";
import "./globals.css";

const rubik = Rubik({ subsets: ["latin"], variable: "--font-rubik" });
// The Strapped wordmark.
const fraunces = Fraunces({ subsets: ["latin"], style: "italic", weight: "500", variable: "--font-wordmark" });

export const metadata: Metadata = {
  title: "Strapped",
  description: "Find out if a watch suits you before you buy it.",
  appleWebApp: { capable: true, title: "Strapped", statusBarStyle: "default" },
  icons: { icon: "/icon-512.png", apple: "/icon-512.png" },
};

export const viewport: Viewport = {
  themeColor: "#f7f6f3",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Also: the opening animation plays once per visit; a reload or a swipe back to the page doesn't replay it.
const THEME_SCRIPT = `try{var t=localStorage.getItem("strapped-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}try{if(sessionStorage.getItem("strapped-splash"))document.documentElement.dataset.splash="seen";else sessionStorage.setItem("strapped-splash","1")}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${rubik.variable} ${fraunces.variable}`} suppressHydrationWarning>
      <head>
        {/* Apply the saved theme before the first paint so the opening animation matches it. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <Splash />
        {children}
        <RegisterSW />
        <Analytics />
      </body>
    </html>
  );
}
