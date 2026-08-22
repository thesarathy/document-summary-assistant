import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Self-hosted (OFL-licensed) rather than next/font/google: removes a
// build-time and runtime dependency on Google Fonts' CDN being reachable,
// which matters for reliable deploys and cold starts on serverless hosting.
const displaySerif = localFont({
  src: "../fonts/SourceSerif4-Variable.ttf",
  variable: "--font-display",
  weight: "200 900",
  display: "swap",
});

const bodySans = localFont({
  src: "../fonts/IBMPlexSans-Variable.ttf",
  variable: "--font-body",
  weight: "100 700",
  display: "swap",
});

const mono = localFont({
  src: [
    { path: "../fonts/IBMPlexMono-Regular.ttf", weight: "400", style: "normal" },
    { path: "../fonts/IBMPlexMono-Medium.ttf", weight: "500", style: "normal" },
  ],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Document Summary Assistant",
  description: "Upload a PDF or image and get a faithful, length-controlled summary.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${displaySerif.variable} ${bodySans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink">{children}</body>
    </html>
  );
}
