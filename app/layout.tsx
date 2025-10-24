import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Exam Face Detection",
  description: "Next.js application for exam face detection",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
