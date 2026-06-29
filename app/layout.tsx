import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IPSM Music School",
  description: "Music school management system MVP",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
