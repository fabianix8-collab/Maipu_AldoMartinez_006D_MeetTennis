import { Trophy } from 'lucide-react';
import { TennisBall, TennisRacket } from './TennisIcons.jsx';

function TennisBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <Trophy className="absolute -right-24 -top-24 h-96 w-96 rotate-6 text-emerald-500 opacity-5" />
      <Trophy className="absolute -bottom-28 -left-24 h-96 w-96 rotate-12 text-emerald-500 opacity-5" />

      <TennisRacket className="absolute -left-16 top-1/4 h-64 w-64 -rotate-12 text-emerald-500 opacity-[0.07]" />
      <TennisRacket className="absolute -right-20 bottom-1/4 h-72 w-72 rotate-12 text-emerald-500 opacity-[0.07]" />

      <TennisBall className="absolute right-8 top-20 h-16 w-16 text-lime-400 opacity-10" />
      <TennisBall className="absolute left-6 bottom-28 h-12 w-12 text-emerald-400 opacity-10" />
      <TennisBall className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 text-lime-400 opacity-10" />
    </div>
  );
}

export default TennisBackground;
