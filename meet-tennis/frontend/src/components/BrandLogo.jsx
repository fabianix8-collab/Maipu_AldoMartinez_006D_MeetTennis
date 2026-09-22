function BrandLogo({ className = '' }) {
  return (
    <img
      src="/MeetTennis-logo.png"
      alt="MeetTennis"
      draggable="false"
      className={`w-auto select-none drop-shadow-[0_0_30px_rgba(16,185,129,0.35)] ${className}`}
    />
  );
}

export default BrandLogo;
