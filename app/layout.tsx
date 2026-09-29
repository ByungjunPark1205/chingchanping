import type { Metadata } from "next";
import "./globals.css";
import "./rift.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://chingchanping.emile941205.workers.dev"),
  title: "칭찬핑 · 게임 커뮤니티 익명 칭찬",
  description:
    "게임 커뮤니티를 위한 익명 칭찬 서비스. 함께한 사람에게 칭찬을 남기고, 받은 칭찬을 확인해보세요.",
  openGraph: {
    type: "website",
    url: "https://chingchanping.emile941205.workers.dev/",
    locale: "ko_KR",
    siteName: "칭찬핑",
    title: "칭찬핑 · 게임 커뮤니티 익명 칭찬",
    description: "게임 커뮤니티를 위한 익명 칭찬 서비스. 함께한 사람에게 칭찬을 남겨보세요.",
    images: [{
      url: "/social/chingchanping-v2.png",
      width: 1200,
      height: 630,
      type: "image/png",
      alt: "칭찬핑 — 게임 커뮤니티를 위한 익명 칭찬 서비스",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "칭찬핑 · 게임 커뮤니티 익명 칭찬",
    description: "함께한 사람에게 칭찬을 남겨보세요.",
    images: ["/social/chingchanping-v2.png"],
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
