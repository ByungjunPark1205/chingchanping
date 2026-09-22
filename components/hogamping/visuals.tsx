/** Original interface icon: circular pin head, pointed tip, and ground ripple. */
export function PingIcon({
  size = 20,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 36"
      fill="none"
      className={`ping-icon ${className}`}
      aria-hidden="true"
    >
      <ellipse
        cx="16"
        cy="29"
        rx="13"
        ry="5"
        stroke="currentColor"
        strokeWidth="1.4"
        opacity=".35"
      />
      <path
        d="M16 2.5a10 10 0 0 0-10 10c0 6 10 16.5 10 16.5s10-10.5 10-16.5a10 10 0 0 0-10-10Z"
        fill="currentColor"
        fillOpacity=".14"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle
        cx="16"
        cy="12.5"
        r="5.6"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="16" cy="12.5" r="3.1" fill="currentColor" fillOpacity=".6" />
    </svg>
  );
}
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
      <span className="ping-ground ping-ground-outer" />
      <span className="ping-ground ping-ground-inner" />
      <PingIcon />
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
