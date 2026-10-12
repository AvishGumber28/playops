// Decorative background motif for the login hero panel. The reference
// design uses a photographic basketball-player silhouette; no such asset
// exists in this project and none was provided, so this is a hand-drawn
// abstract approximation instead (hoop, net, ball, a simplified jumping
// figure) - purely decorative, safe to swap for a real photo/illustration
// later without touching any layout code around it.
export function BasketballMotif({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 600 800"
      fill="none"
      aria-hidden="true"
      className={className}
      preserveAspectRatio="xMaxYMid slice"
    >
      {/* backboard + hoop, upper area */}
      <rect x="360" y="60" width="140" height="90" rx="4" stroke="white" strokeOpacity="0.5" strokeWidth="3" />
      <ellipse cx="430" cy="168" rx="46" ry="14" stroke="white" strokeOpacity="0.6" strokeWidth="4" />
      {/* net */}
      <path
        d="M389 172 L397 230 M408 175 L412 234 M430 176 L430 236 M452 175 L448 234 M471 172 L463 230"
        stroke="white"
        strokeOpacity="0.35"
        strokeWidth="2"
      />

      {/* simplified jumping figure, mid-dunk */}
      <g stroke="white" strokeOpacity="0.55" strokeWidth="6" strokeLinecap="round" fill="none">
        {/* raised arm to hoop */}
        <path d="M300 430 L360 300" />
        {/* torso */}
        <path d="M280 470 L300 430" />
        {/* head */}
        <circle cx="272" cy="450" r="16" fill="white" fillOpacity="0.25" stroke="none" />
        {/* trailing arm */}
        <path d="M280 470 L240 500" />
        {/* legs, bent mid-air */}
        <path d="M300 430 L330 520 L310 590" />
        <path d="M300 430 L270 510 L290 585" />
      </g>

      {/* ball, near the raised hand */}
      <circle cx="366" cy="288" r="20" stroke="white" strokeOpacity="0.6" strokeWidth="3" />
      <path
        d="M348 288 Q366 270 384 288 M348 288 Q366 306 384 288 M366 268 L366 308"
        stroke="white"
        strokeOpacity="0.5"
        strokeWidth="2"
      />

      {/* soft ground shadow */}
      <ellipse cx="290" cy="640" rx="90" ry="14" fill="white" fillOpacity="0.08" />
    </svg>
  );
}
