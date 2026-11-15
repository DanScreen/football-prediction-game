import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/app/components/Header";
import { getTheme } from "@/lib/theme.server";
import { APP_STORE_ID } from "@/lib/appStore";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  // `template` appends the brand to every page that sets its own title;
  // `default` covers pages that don't.
  title: {
    default: "Scorers",
    template: "%s — Scorers",
  },
  description: "Predict match scores and compete with friends",
  // Safari on iPhone shows its Smart App Banner, linking to the app (or opening it if installed).
  itunes: { appId: APP_STORE_ID },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Rendered into the initial HTML so there's no flash of the wrong theme.
  // "system" sets no attribute, letting the prefers-color-scheme rules apply.
  const theme = await getTheme();

  return (
    <html
      lang="en"
      data-theme={theme === "system" ? undefined : theme}
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-ground">
        <Header />
        {/* pb-20 keeps content clear of the fixed mobile tab bar. */}
        <main className="flex-1 pb-20 sm:pb-0">{children}</main>
      </body>
    </html>
  );
}
