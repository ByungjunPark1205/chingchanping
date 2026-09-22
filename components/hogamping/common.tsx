"use client";
import { Loader2 } from "lucide-react";
import { Empty as EmptyRoot } from "@/components/ui/empty";
import { PingMark } from "./visuals";

export function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading-state" role="status">
      <Loader2 className="spin" size={23} />
      칭찬핑을 탐지하고 있어요.
    </div>
  );
}
export function Empty({
  title = "아직 탐지된 칭찬핑이 없습니다.",
  text = "함께할 좋은 순간들이 차곡차곡 쌓이고 있어요.",
  children,
}: {
  title?: string;
  text?: string;
  children?: React.ReactNode;
}) {
  return (
    <EmptyRoot className="empty-state">
      <PingMark />
      <h2>{title}</h2>
      <p>{text}</p>
      {children}
    </EmptyRoot>
  );
}
