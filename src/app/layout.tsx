import type { Metadata } from "next";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/inter";
import { getLang } from "@/lib/i18n/server";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Nilami — Asset Auctions",
    template: "%s · Nilami",
  },
  description:
    "Multi-institution auction portal for collateral properties offered for sale by participating banks and financial institutions. Browse current auction notices, property details, and bidding terms.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const lang = await getLang();
  return (
    <html lang={lang}>
      <body>{children}</body>
    </html>
  );
}
