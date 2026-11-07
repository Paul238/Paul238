/**
 * Drumețul: personaj desenat din forme simple, văzut din profil, cu rucsac.
 * În mers, picioarele și brațele se mișcă alternativ; pe loc, respiră ușor.
 */
export function Hiker({ color, walking, bag, bump }: { color: string; walking: boolean; bag: number; bump: number }) {
  return (
    <svg className={`hiker ${walking ? 'walking' : ''}`} viewBox="-40 -100 80 104" width="80" height="104" aria-hidden="true">
      <ellipse cx="0" cy="2" rx="22" ry="4" fill="#000" opacity="0.28" />
      <g className="hiker-body">
        {/* piciorul din spate */}
        <g className="leg leg-back">
          <rect x="-5" y="-38" width="9" height="36" rx="4.5" fill="#2b2f45" />
          <rect x="-6" y="-6" width="15" height="7" rx="3.5" fill="#1a1c2a" />
        </g>
        {/* brațul din spate */}
        <g className="arm arm-back">
          <rect x="-4" y="-66" width="8" height="28" rx="4" fill={color} style={{ filter: 'brightness(.75)' }} />
        </g>
        {/* rucsacul */}
        <g key={bump} className="bag">
          <rect x="-24" y="-74" width="20" height="34" rx="7" fill="#c47a3a" />
          <rect x="-24" y="-74" width="20" height="10" rx="5" fill="#a5612b" />
          <rect x="-21" y="-56" width="14" height="10" rx="3" fill="#a5612b" />
          <rect x="-28" y="-46" width="26" height="7" rx="3.5" fill="#5b6c8a" />
          {bag > 0 && (
            <g transform="translate(-14 -82)" className="bag-badge">
              <circle r="10" fill="#ffd36b" stroke="#fff" strokeWidth="2" />
              <text textAnchor="middle" dominantBaseline="central" fontSize="11" fontWeight="700" fill="#4a2e05">
                {bag}
              </text>
            </g>
          )}
        </g>
        {/* trunchiul */}
        <rect x="-9" y="-72" width="20" height="38" rx="9" fill={color} />
        <rect x="-9" y="-44" width="20" height="8" rx="3" fill="#2b2f45" />
        {/* capul */}
        <circle cx="3" cy="-84" r="10.5" fill="#f2c9a5" />
        <path d="M-8 -86 C-7 -98 13 -99 14 -87 L16 -86 L-9 -85 Z" fill="#2b2f45" />
        <rect x="6" y="-88" width="12" height="3" rx="1.5" fill="#2b2f45" />
        <circle cx="9" cy="-82" r="1.4" fill="#2b2f45" />
        {/* piciorul din față */}
        <g className="leg leg-front">
          <rect x="-3" y="-38" width="9" height="36" rx="4.5" fill="#363b57" />
          <rect x="-3" y="-6" width="15" height="7" rx="3.5" fill="#1a1c2a" />
        </g>
        {/* brațul din față, cu bețul de drumeție */}
        <g className="arm arm-front">
          <rect x="-1" y="-66" width="8" height="28" rx="4" fill={color} />
          <line x1="5" y1="-40" x2="16" y2="2" stroke="#8b6b4a" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      </g>
    </svg>
  );
}
