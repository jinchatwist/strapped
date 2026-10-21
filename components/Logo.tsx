import { useId } from "react";

export function Logo({ size = 32 }: { size?: number }) {
  const mask = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <mask id={mask} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
        <rect width="100" height="100" fill="#fff" />
        <circle cx="33" cy="77" r="2.4" fill="#000" />
        <circle cx="41" cy="77" r="2.4" fill="#000" />
        <circle cx="49" cy="77" r="2.4" fill="#000" />
      </mask>
      <path
        d="M72 23H42C17 23 17 49 41 49H59C84 49 84 77 58 77H28"
        stroke="currentColor"
        strokeWidth="12"
        strokeLinecap="round"
        fill="none"
        mask={`url(#${mask})`}
      />
    </svg>
  );
}
