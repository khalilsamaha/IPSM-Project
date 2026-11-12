import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IPSM Music School",
  description: "IPSM Music School administration",
  icons: { icon: { url: "/assets/branding/ipsm-logo-original.jpg", type: "image/jpeg" }, apple: "/assets/branding/ipsm-logo-original.jpg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
