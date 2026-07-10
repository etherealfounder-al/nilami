import type { Metadata } from "next";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/inter";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Nilami — Bank Asset Auctions",
    template: "%s · Nilami",
  },
  description:
    "Official auction portal for collateral properties offered for sale by the bank. Browse current auction notices, property details, and bidding terms.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
