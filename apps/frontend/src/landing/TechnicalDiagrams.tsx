import React from 'react'

/**
 * Gráfica SVG editorial de proyección del mercado global de detección de fugas (2024–2030).
 * Muestra banda de estimación documentada por reportes de mercado (no predicción propia).
 */
export function MarketTrajectoryDiagram() {
  return (
    <figure className="hs-market-chart">
      <div className="hs-diagram-header">
        <span className="hs-mono">¿CÓMO CRECERÁ EL MERCADO GLOBAL DE DETECCIÓN (2024–2030)?</span>
        <span className="hs-mono">CAGR EST.: 6.2% – 7.2%</span>
      </div>
      <svg
        viewBox="0 0 640 245"
        className="hs-svg-diagram"
        role="img"
        aria-label="Gráfica editorial de rango estimado del mercado global de detección de fugas de agua entre 2024 (4.17 mil millones USD) y 2030 (5.90 a 6.80 mil millones USD)"
      >
        <rect width="640" height="245" fill="#FFFFFF" />

        {/* Líneas guía horizontales */}
        {[
          { y: 40, label: '$7.0B' },
          { y: 82, label: '$6.0B' },
          { y: 124, label: '$5.0B' },
          { y: 166, label: '$4.0B' },
          { y: 208, label: '$3.0B' },
        ].map((tick) => (
          <g key={tick.label}>
            <line x1="68" y1={tick.y} x2="608" y2={tick.y} stroke="rgba(2, 32, 69, 0.1)" strokeDasharray="3 4" />
            <text x="56" y={tick.y + 4} textAnchor="end" className="hs-svg-mono-xs" fill="#4E6078">
              {tick.label}
            </text>
          </g>
        ))}

        {/* Banda de incertidumbre entre proyección conservadora ($5.9B) y alta ($6.8B) en 2030 */}
        <polygon
          points="96,159 266,133 436,101 584,48 584,86 436,118 266,141 96,159"
          fill="#E4F7F9"
        />

        {/* Límite superior proyectado */}
        <polyline
          points="96,159 266,133 436,101 584,48"
          fill="none"
          stroke="#008496"
          strokeWidth="2"
        />

        {/* Límite inferior conservador */}
        <polyline
          points="96,159 266,141 436,118 584,86"
          fill="none"
          stroke="#022045"
          strokeWidth="2"
          strokeDasharray="5 4"
        />

        {/* Puntos clave */}
        <circle cx="96" cy="159" r="5" fill="#022045" />
        <text x="96" y="145" textAnchor="start" className="hs-svg-mono-sm" fill="#022045">$4.17B</text>

        <circle cx="584" cy="48" r="5" fill="#008496" />
        <text x="584" y="34" textAnchor="end" className="hs-svg-mono-sm" fill="#008496">$6.80B (est.)</text>

        <circle cx="584" cy="86" r="5" fill="#022045" />
        <text x="596" y="116" textAnchor="end" className="hs-svg-mono-sm" fill="#022045">$5.90B (est.)</text>

        {/* Eje X años */}
        {[
          { x: 96, year: '2024' },
          { x: 266, year: '2026' },
          { x: 436, year: '2028' },
          { x: 584, year: '2030*' },
        ].map((col) => (
          <g key={col.year}>
            <line x1={col.x} y1="208" x2={col.x} y2="214" stroke="#022045" strokeWidth="1" />
            <text x={col.x} y="230" textAnchor="middle" className="hs-svg-mono-xs" fill="#0F1D33">
              {col.year}
            </text>
          </g>
        ))}
      </svg>
      <figcaption className="hs-figure-caption">
        * Rango ilustrativo basado en estimaciones de industria (Research and Markets / Fact.MR / Mordor Intelligence) sobre sistemas globales de detección de fugas de agua. Las cifras corresponden a rangos publicados sujetos a alcance metodológico.
      </figcaption>
    </figure>
  )
}
