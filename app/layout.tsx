import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "호감핑 · 좋은 마음이 모이는 곳",
  description:
    "좋은 행동을 발견했다면, 호감핑을 찍어주세요. 우리 게임 커뮤니티의 익명 칭찬 공간.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  );
}
