import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ギャンブルゴルフ",
  description: "ゴルフ打ちっぱなしで遊べるヤードビンゴアプリ"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#1d8f45"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
