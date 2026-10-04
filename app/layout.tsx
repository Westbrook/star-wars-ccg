import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./installed-app.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#101214",
  colorScheme: "dark",
};

export const metadata: Metadata = {
  title: "Star Wars CCG · The Holotable",
  description: "Enter the holotable. Build your Star Wars deck, open sealed packs, and challenge the computer or a friend.",
  applicationName: "Holotable",
  appleWebApp: { capable: true, title: "Holotable", statusBarStyle: "black-translucent" },
  // Vinext emits the modern mobile-web-app-capable name for appleWebApp.capable.
  // Retain Apple's original capability tag for older iOS Home Screen launches.
  other: { "apple-mobile-web-app-capable": "yes" },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48" },
      { url: "/favicon.svg", type: "image/svg+xml", sizes: "any" },
      { url: "/icons/favicon-32.png", type: "image/png", sizes: "32x32" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon-180.png", sizes: "180x180" },
      { url: "/icons/apple-touch-icon-167.png", sizes: "167x167" },
      { url: "/icons/apple-touch-icon-152.png", sizes: "152x152" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* The private Sites origin requires cookies when fetching the manifest. */}
        <link rel="manifest" href="/manifest.json" crossOrigin="use-credentials" />
      </head>
      <body className="antialiased"><div className="app-viewport">{children}</div></body>
    </html>
  );
}
