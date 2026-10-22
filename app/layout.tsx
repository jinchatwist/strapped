import type { Metadata, Viewport } from "next";
import { Rubik } from "next/font/google";
import { RegisterSW } from "@/components/RegisterSW";
import "./globals.css";

const rubik = Rubik({ subsets: ["latin"], variable: "--font-rubik" });

export const metadata: Metadata = {
  title: "Strapped",
  description: "Find out if a watch suits you before you buy it.",
  appleWebApp: { capable: true, title: "Strapped", statusBarStyle: "default" },
  icons: { icon: "/icon-512.png", apple: "/icon-512.png" },

export const viewport: Viewport = {
  themeColor: "#f7f6f3",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={rubik.variable}>
      <body>
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
