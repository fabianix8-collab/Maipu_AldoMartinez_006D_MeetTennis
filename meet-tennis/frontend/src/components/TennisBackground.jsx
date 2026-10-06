import { useEffect, useRef } from 'react';
import { Trophy } from 'lucide-react';
import { TennisBall, TennisRacket } from './TennisIcons.jsx';

// Pelota que rebota por toda la pantalla como el clásico logo de DVD:
// se mueve en diagonal y cambia de dirección al chocar con los bordes.
function PelotaRebotando() {
  const ref = useRef(null);

  useEffect(() => {
    let x = Math.random() * 300;
    let y = Math.random() * 200;
    let dx = 2.6;
    let dy = 1.9;
    let angulo = 0;
    let ultimo = performance.now();
    let raf;

    const paso = (ahora) => {
      const dt = Math.min((ahora - ultimo) / 16.7, 3);
      ultimo = ahora;
      x += dx * dt;
      y += dy * dt;
      angulo += 2.5 * dt; // rotación de 360° (una vuelta ~2.4s)

      const tamano = 48; // h-12 w-12
      const maxX = window.innerWidth - tamano;
      const maxY = window.innerHeight - tamano;

      if (x <= 0 || x >= maxX) {
        dx = -dx;
        x = Math.max(0, Math.min(x, maxX));
      }
      if (y <= 0 || y >= maxY) {
        dy = -dy;
        y = Math.max(0, Math.min(y, maxY));
      }

      if (ref.current) {
        // Gira sobre su propio centro para que se vea el giro de la pelota.
        ref.current.style.transformOrigin = 'center';
        ref.current.style.transform = `translate(${x}px, ${y}px) rotate(${angulo}deg)`;
      }

      raf = requestAnimationFrame(paso);
    };

    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div ref={ref} className="absolute left-0 top-0">
      <TennisBall className="h-12 w-12 text-lime-400 opacity-40" />
    </div>
  );
}

function TennisBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/* Gradiente base: azul profundo con tinte esmeralda */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-emerald-950/70" />

      {/* Resplandores radiales de color */}
      <div className="absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-emerald-500/15 blur-[130px]" />
      <div className="absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-lime-400/10 blur-[110px]" />
      <div className="absolute left-1/4 top-1/2 h-72 w-72 rounded-full bg-emerald-400/10 blur-[100px]" />

      {/* Líneas de cancha de tenis */}
      <svg
        className="absolute inset-0 h-full w-full text-emerald-300 opacity-[0.08]"
        viewBox="0 0 400 800"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <rect x="60" y="40" width="280" height="720" />
        <line x1="200" y1="40" x2="200" y2="760" />
        <line x1="60" y1="400" x2="340" y2="400" />
        <line x1="60" y1="200" x2="340" y2="200" />
        <line x1="60" y1="600" x2="340" y2="600" />
        <line x1="130" y1="200" x2="130" y2="600" />
        <line x1="270" y1="200" x2="270" y2="600" />
      </svg>

      {/* Trofeos en las esquinas (simétricos) */}
      <Trophy className="absolute -left-20 -top-20 h-72 w-72 -rotate-12 text-emerald-500 opacity-10" />
      <Trophy className="absolute -right-20 -top-20 h-72 w-72 rotate-12 text-emerald-500 opacity-10" />
      <Trophy className="absolute -bottom-20 -left-20 h-72 w-72 rotate-12 text-emerald-500 opacity-10" />
      <Trophy className="absolute -bottom-20 -right-20 h-72 w-72 -rotate-12 text-emerald-500 opacity-10" />

      {/* Raquetas a los lados (centradas verticalmente) */}
      <TennisRacket className="absolute -left-16 top-1/2 h-64 w-64 -translate-y-1/2 -rotate-12 text-emerald-500 opacity-20" />
      <TennisRacket className="absolute -right-16 top-1/2 h-64 w-64 -translate-y-1/2 rotate-12 text-emerald-500 opacity-20" />

      {/* Una sola pelota que rebota por toda la pantalla (efecto DVD) */}
      <PelotaRebotando />

      {/* Viñeta para enfocar el centro */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(2,6,23,0.55)_100%)]" />
    </div>
  );
}

export default TennisBackground;
