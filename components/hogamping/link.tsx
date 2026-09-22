import type { ComponentProps } from "react";

// Vinext's current production RSC navigation fails during prefetch and click.
// Document navigation keeps links usable on the Node deployment and refreshes
// session-sensitive data on each page, without relying on that client runtime.
export default function Link(props: ComponentProps<"a">) {
  return <a {...props} />;
}
