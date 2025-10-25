import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ExamProctor | AI-Powered Exam Monitoring & Proctoring",
  description: "Advanced AI-powered exam proctoring solution with real-time cheat detection, live monitoring, and comprehensive analytics for secure online assessments.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico" }
    ],
  },
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
