import type { Metadata } from "next";
import "katex/dist/katex.min.css";
import "./globals.css";
import { Geist } from "next/font/google";
import { AppProviders } from "@/src/app/providers";
import { cn } from "@/src/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "LLM Tasks Agent",
  description: "agent chat",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body className="min-h-screen antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
