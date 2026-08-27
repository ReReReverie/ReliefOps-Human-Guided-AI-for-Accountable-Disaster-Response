import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { WarningBanner } from "@/components/WarningBanner";

export const metadata: Metadata = {
  title: "ReliefOps",
  description:
    "Prototype humanitarian-relief coordination system — synthetic demonstration data only.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900 antialiased">
        <WarningBanner />
        <SiteHeader />
        <main>{children}</main>
      </body>
    </html>
  );
}
