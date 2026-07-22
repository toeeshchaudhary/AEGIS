import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AEGIS — Agri-Tech Field Monitor",
  description:
    "Low-cost, modular AI-assisted crop & soil monitoring for sustainable farming. Techathon 3.0 — Vision Venture.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
