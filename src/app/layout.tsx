import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

export const metadata: Metadata = {
  metadataBase: siteUrl ? new URL(siteUrl) : undefined,
  title: {
    default: "Lexify School | Learn at your pace",
    template: "%s | Lexify School",
  },
  description:
    "Find curriculum-aligned tutoring, learn computer packages, and discover practical learning resources with Lexify School in Kenya.",
  applicationName: "Lexify School",
  openGraph: {
    type: "website",
    siteName: "Lexify School",
    title: "Lexify School | Learn at your pace",
    description:
      "Tutoring, computer packages and practical learning resources for students and families in Kenya.",
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1E3A8A",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
