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
      불러오는 중…
    </div>
  );
}
export function Empty({
  title = "아직 받은 칭찬이 없어요",
  text = "받은 칭찬은 여기에 표시돼요.",
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
