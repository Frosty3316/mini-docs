export function Logo({ className = "logo-mark" }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="4" y="7" width="16" height="20" rx="2.5" fill="currentColor" opacity="0.28" />
      <rect x="10" y="5" width="16" height="20" rx="2.5" fill="currentColor" />
      <path
        d="M14 12.5h8M14 16.5h8M14 20.5h5"
        stroke="#1a120c"
        strokeOpacity="0.4"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
