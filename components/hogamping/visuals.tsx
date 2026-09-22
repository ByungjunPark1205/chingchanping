import { Heart } from "lucide-react";
export function PingMark({
  className = "",
  animate = false,
}: {
  className?: string;
  animate?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={`ping-mark ${animate ? "ping-animate" : ""} ${className}`}
    >
      <span />
      <span />
      <Heart size={18} strokeWidth={2.1} />
    </span>
  );
}
export function Avatar({
  name,
  index = 0,
  large = false,
}: {
  name: string;
  index?: number;
  large?: boolean;
}) {
  return (
    <span
      className={`avatar avatar-${index % 6} ${large ? "avatar-large" : ""}`}
      aria-hidden="true"
    >
      {name.slice(0, 1)}
    </span>
  );
}
