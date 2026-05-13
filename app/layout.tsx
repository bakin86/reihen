import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import dynamic from "next/dynamic";
import { AuthProvider } from "@/components/AuthProvider";
import { QueryProvider } from "@/lib/query";
import "./globals.css";

const ChatBot = dynamic(() => import("@/components/ChatBot").then((m) => m.ChatBot), {
  ssr: false,
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-space",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400", "500", "700", "900"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Reihen — PC Gaming Center",
  description: "PC Gaming Center Booking & Management — Mongolia",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="mn" className={`${spaceGrotesk.variable} ${inter.variable}`}>
      <body>
        <QueryProvider>
          <AuthProvider>
            {children}
            <ChatBot />
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
