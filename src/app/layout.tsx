import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BAPS Temple Transport",
  description: "Weekly Saturday temple trip coordination",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
  themeColor: "#f97316",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 4000,
            style: { borderRadius: "12px", fontFamily: inter.style.fontFamily },
          }}
        />
        {children}
      </body>
    </html>
  );
}
