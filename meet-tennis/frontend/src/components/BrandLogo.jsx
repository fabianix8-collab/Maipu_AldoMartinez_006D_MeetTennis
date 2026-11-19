import { Link } from 'react-router-dom';

function BrandLogo({ className = '', homeLink = true }) {
  const logo = (
    <img
      src="/MeetTennis-logo.png"
      alt="MeetTennis"
      draggable="false"
      className={`w-auto select-none drop-shadow-[0_0_35px_rgba(16,185,129,0.45)] ${className}`}
    />
  );

  if (!homeLink) return logo;

  return (
    <Link
      to="/"
      aria-label="MeetTennis: ir al inicio"
      title="Ir al inicio"
      className="flex w-fit max-w-full rounded-lg transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
    >
      {logo}
    </Link>
  );
}

export default BrandLogo;
