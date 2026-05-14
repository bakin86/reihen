import type { Metadata } from "next";
import { Inter } from "next/font/google";
import dynamic from "next/dynamic";
import { AuthProvider } from "@/components/AuthProvider";
import { QueryProvider } from "@/lib/query";
import "./globals.css";

const ChatBot = dynamic(() => import("@/components/ChatBot").then((m) => m.ChatBot), {
  ssr: false,
});

/* Inter is loaded purely as a web-safe fallback.
   Primary display font is 'Neue Haas Grotesk Display' / 'Helvetica Neue'
   resolved via the CSS custom property --font-display in globals.css.        */
const inter = Inter({
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400", "500", "700", "900"],
  variable: "--font-inter",
  display: "swap",
});

/* --font-space kept for backwards-compat with any component that references it */
const fontSpaceCompat = inter;

export const metadata: Metadata = {
  title: "Reihen — PC Gaming Center",
  description: "PC Gaming Center Booking & Management — Mongolia",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="mn" className={inter.variable}>
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
