import type { Metadata } from "next";
import "./globals.css";
import "./rift.css";

export const metadata: Metadata = {
  title: "칭찬핑 · 서로의 좋은 행동을 발견하는 곳",
  description:
    "좋은 행동을 발견했다면, 칭찬핑을 찍어주세요. 우리 게임 커뮤니티의 익명 칭찬 공간.",
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
