import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Creator OS Alpha — Sasha Edition",
  description: "Internal operating system for AI-assisted virtual creators.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
