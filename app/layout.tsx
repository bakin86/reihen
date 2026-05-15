import type { Metadata } from "next";
import { Inter } from "next/font/google";
import dynamic from "next/dynamic";
import { ClerkProvider } from "@clerk/nextjs";
import { AuthProvider } from "@/components/AuthProvider";
import { QueryProvider } from "@/lib/query";
import { isClerkPublicConfigured } from "@/lib/clerk-config";
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
  title: "Reihen | PC Gaming Center",
  description: "PC Gaming Center Booking & Management in Mongolia",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const app = (
    <QueryProvider>
      <AuthProvider>
        {children}
        <ChatBot />
      </AuthProvider>
    </QueryProvider>
  );

  return (
    <html lang="mn" className={inter.variable}>
      <body>
        {isClerkPublicConfigured() ? (
          <ClerkProvider
            signInUrl="/login"
            signUpUrl="/register"
            afterSignInUrl="/"
            afterSignUpUrl="/"
          >
            {app}
          </ClerkProvider>
        ) : (
          app
        )}
      </body>
    </html>
  );
}
