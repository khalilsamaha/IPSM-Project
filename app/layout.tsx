import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IPSM Music School",
  description: "IPSM Music School administration",
  icons: { icon: { url: "/assets/branding/ipsm-fingerprint-icon.png", type: "image/png", sizes: "64x64" }, shortcut: "/assets/branding/ipsm-fingerprint-icon.png", apple: "/assets/branding/ipsm-logo-original.jpg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
