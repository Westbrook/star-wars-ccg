import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Star Wars CCG · The Holotable",
  description: "Enter the holotable. Build your Star Wars deck, open sealed packs, and challenge the computer or a friend.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
