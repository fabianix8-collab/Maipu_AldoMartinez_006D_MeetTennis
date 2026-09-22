export function TennisBall({ className = '', ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M6.6 5.6c3 3 3 9.8 0 12.8" />
      <path d="M17.4 5.6c-3 3-3 9.8 0 12.8" />
    </svg>
  );
}

export function TennisRacket({ className = '', ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <ellipse cx="12" cy="8.6" rx="5.4" ry="6.4" />
      <line x1="10" y1="3.2" x2="10" y2="14" />
      <line x1="12" y1="2.4" x2="12" y2="14.8" />
      <line x1="14" y1="3.2" x2="14" y2="14" />
      <line x1="7.2" y1="6" x2="16.8" y2="6" />
      <line x1="6.7" y1="8.6" x2="17.3" y2="8.6" />
      <line x1="7.2" y1="11.2" x2="16.8" y2="11.2" />
      <path d="M9.7 14.3c.9 1 1.5 1.6 1.7 2.8" />
      <path d="M14.3 14.3c-.9 1-1.5 1.6-1.7 2.8" />
      <rect x="10.8" y="16.9" width="2.4" height="4.6" rx="1.2" />
    </svg>
  );
}
