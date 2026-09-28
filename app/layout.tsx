import type { Metadata } from "next";
import "./globals.css";
import "./rift.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://chingchanping.emile941205.workers.dev"),
  title: "칭찬핑 · 서로의 좋은 행동을 발견하는 곳",
  description:
    "좋은 행동을 발견했다면, 칭찬핑을 찍어주세요. 우리 게임 커뮤니티의 익명 칭찬 공간.",
  openGraph: {
    type: "website",
    url: "https://chingchanping.emile941205.workers.dev/",
    locale: "ko_KR",
    siteName: "칭찬핑",
    title: "칭찬핑 · 서로의 좋은 행동을 발견하는 곳",
    description: "고마웠던 사람에게 익명으로 칭찬을 남겨보세요. 작은 핑 하나가 우리 커뮤니티를 따뜻하게 만들어요.",
    images: [{
      url: "/social/chingchanping-v1.png",
      width: 1200,
      height: 630,
      type: "image/png",
      alt: "금빛 핑 로고와 칭찬핑 — 좋은 행동을 발견했다면, 칭찬핑을 찍어주세요.",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "칭찬핑 · 서로의 좋은 행동을 발견하는 곳",
    description: "고마웠던 사람에게 익명으로 칭찬을 남겨보세요.",
    images: ["/social/chingchanping-v1.png"],
  },
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
