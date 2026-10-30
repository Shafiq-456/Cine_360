import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "CINE 360 — Experience Your Seat Before You Book",
  description:
    "Step into virtual 3D cinema auditoriums, explore every row, preview your exact viewing perspective and book with confidence.",
  keywords: ["CINE 360", "3D cinema booking", "seat preview", "movie tickets", "auditorium"],
  authors: [{ name: "FROST & FLAME" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-background text-foreground min-h-screen flex flex-col">
        {children}
        <Toaster position="top-center" richColors theme="dark" />
      </body>
    </html>
  );
}
