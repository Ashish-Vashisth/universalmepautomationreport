import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { Analytics } from "@vercel/analytics/next"

export const metadata: Metadata = {
  title: "UNIVERSAL MEP JJM SWSM Daily Report",
  description:
    "JJM SWSM Daily Report Generator — Upload JJMUP export and download formatted Excel report",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <Analytics />
      <body className="antialiased">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          {/* Fixed background image */}
          <div className="bg-hero" aria-hidden="true" />
          {/* Scrollable content above bg */}
          <div id="app-content">{children}</div>
        </ThemeProvider>
      </body>
    </html>
  );
}
