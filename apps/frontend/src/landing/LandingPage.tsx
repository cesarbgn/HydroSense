import React from 'react'
import Prototype3DViewer from './Prototype3DViewer'
import { MarketTrajectoryDiagram } from './TechnicalDiagrams'
import './landing.css'

export interface LandingPageProps {
  onOpenDashboard: (debug?: boolean) => void
}

export default function LandingPage({ onOpenDashboard }: LandingPageProps) {
  const handleDashboardClick = (event: React.MouseEvent<HTMLAnchorElement>, debug = false) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    onOpenDashboard(debug)
  }

  return (
    <div className="hs-landing">
      {/* NAVEGACIÓN FLOTANTE EN CÁPSULA */}
      <header className="hs-header">
        <div className="hs-navbar-pill">
          <a href="#hero" className="hs-brand" aria-label="Inicio HydroSense">
            <img
              src="/hydrosense-horizontal.svg"
              alt="HydroSense"
              className="hs-brand__logo"
              width={138}
              height={26}
            />
          </a>

          <nav className="hs-nav" aria-label="Navegación de secciones">
            <a href="#problema">El problema</a>
            <a href="#guadalajara">Guadalajara</a>
            <a href="#como-funciona">Prototipo</a>
            <a href="#mercado">Mercado</a>
          </nav>

          <div className="hs-navbar-actions">
            <a
              href="/dashboard"
              className="hs-nav-btn-login"
              onClick={(e) => handleDashboardClick(e, false)}
            >
              Iniciar sesión
            </a>
          </div>
        </div>
      </header>

      <main>
        {/* =================================================================
            01. HERO FULL-BLEED VISUAL
           ================================================================= */}
        <section id="hero" className="hs-hero">
          <img
            src="/landing/hero-fullbleed.jpg"
            alt="Líneas hidráulicas presurizadas instrumentadas con sensores acústicos externos en laboratorio"
            className="hs-hero__bg-img"
            width={1408}
            height={768}
            loading="eager"
            fetchPriority="high"
          />
          <div className="hs-hero__scrim" aria-hidden="true" />

          <div className="hs-container hs-hero__content">
            <div className="hs-hero__grid">
              <div className="hs-hero__left">
                <div className="hs-hero__eyebrow hs-mono">
                  <span className="hs-eyebrow-white">MONITOREO HIDRÁULICO</span>
                  <span className="hs-eyebrow-cyan">INTELIGENTE</span>
                </div>

                <h1 className="hs-hero__title">
                  El agua no debería perderse antes de llegar a nosotros.
                </h1>
              </div>

              <div className="hs-hero__right">
                <p className="hs-hero__subtitle">
                  HydroSense utiliza sensores piezoeléctricos y un transductor de presión
                  para identificar patrones asociados a posibles fugas de agua y activar alertas en
                  tiempo real.
                </p>

                <div className="hs-hero__actions">
                  <a
                    href="/dashboard"
                    className="hs-hero-cta-primary"
                    onClick={(e) => handleDashboardClick(e, false)}
                  >
                    Explorar dashboard
                    <span aria-hidden="true">↗</span>
                  </a>

                  <a href="#problema" className="hs-hero-cta-secondary">
                    Conocer el proyecto
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =================================================================
            02. EL PROBLEMA
           ================================================================= */}
        <section id="problema" className="hs-section hs-section--ice-band">
          <div className="hs-container">
            <div className="hs-section-head">
              <div className="hs-section-index hs-mono">EL PROBLEMA</div>
              <div>
                <h2 className="hs-section-title">
                  El agua se pierde. Los recursos también.
                </h2>
              </div>
            </div>

            <div className="hs-problem-layout">
              <div className="hs-problem-editorial">
                <p className="hs-section-lead">
                  Las fugas en redes hidráulicas desperdician agua tratada, energía de bombeo y
                  recursos de mantenimiento.
                </p>
              </div>

              <div className="hs-indicators" aria-label="Indicadores de pérdidas de agua">
                <article className="hs-indicator-row">
                  <div>
                    <div className="hs-indicator-row__value">126,000 millones m³</div>
                  </div>
                  <div>
                    <p className="hs-indicator-row__desc">
                      Agua no contabilizada al año en el mundo.
                    </p>
                    <p className="hs-indicator-row__source hs-mono">
                      FUENTE: Liemberger &amp; Wyatt (2019), International Water Association (IWA) / Banco Mundial.
                    </p>
                  </div>
                </article>

                <article className="hs-indicator-row">
                  <div>
                    <div className="hs-indicator-row__value">USD $39,000 millones</div>
                  </div>
                  <div>
                    <p className="hs-indicator-row__desc">
                      Valor económico anual estimado del agua no facturada.
                    </p>
                    <p className="hs-indicator-row__source hs-mono">
                      FUENTE: Banco Mundial / International Water Association (IWA) Water Loss Specialist Group.
                    </p>
                  </div>
                </article>

                <article className="hs-indicator-row">
                  <div>
                    <div className="hs-indicator-row__value">40–46%</div>
                  </div>
                  <div>
                    <p className="hs-indicator-row__desc">
                      Pérdidas estimadas en redes públicas de agua en México.
                    </p>
                    <p className="hs-indicator-row__source hs-mono">
                      FUENTE: CONAGUA / Instituto Mexicano para la Competitividad (IMCO) / UNAM.
                    </p>
                  </div>
                </article>
              </div>
            </div>
          </div>
        </section>

        {/* =================================================================
            EL CONTEXTO LOCAL · GUADALAJARA
           ================================================================= */}
        <section id="guadalajara" className="hs-section hs-section--white">
          <div className="hs-container">
            <div className="hs-section-head">
              <div className="hs-section-index hs-mono">EL CONTEXTO LOCAL · GUADALAJARA</div>
              <div>
                <h2 className="hs-section-title">
                  Guadalajara también pierde el agua que necesita.
                </h2>
              </div>
            </div>

            <div className="hs-gdl-layout">
              <div className="hs-gdl-copy">
                <p className="hs-gdl-lead">
                  La Zona Metropolitana de Guadalajara enfrenta una presión creciente sobre sus
                  recursos hídricos. Mientras miles de personas experimentan problemas de
                  abastecimiento, una parte importante del agua que ingresa a la red se pierde antes
                  de llegar a los usuarios.
                </p>

                <div className="hs-gdl-callout">
                  <h3>Cada fuga prolonga el problema.</h3>
                  <p>
                    El agua desperdiciada reduce la disponibilidad del recurso, incrementa los costos
                    operativos y agrava la presión sobre la infraestructura hidráulica.
                  </p>
                  <strong className="hs-gdl-closing">
                    Detectar a tiempo también es conservar agua.
                  </strong>
                </div>
              </div>

              <aside className="hs-gdl-stat-card" aria-label="Pérdidas en Guadalajara en 2024">
                <span className="hs-gdl-stat-card__kicker hs-mono">
                  ZONA METROPOLITANA DE GUADALAJARA · 2024
                </span>
                <div className="hs-gdl-stat-card__value">
                  36.8<span>%</span>
                </div>
                <p className="hs-gdl-stat-card__desc">
                  Durante 2024, el 36.8% del agua suministrada a la Zona Metropolitana de
                  Guadalajara se perdió antes de llegar a los usuarios, incluyendo fugas y otras
                  pérdidas en la red.
                </p>
              </aside>
            </div>
          </div>
        </section>

        {/* =================================================================
            03. CÓMO FUNCIONA
           ================================================================= */}
        <section id="como-funciona" className="hs-section hs-section--white">
          <div className="hs-container">
            <div className="hs-hardware-feature">
              <div className="hs-hardware-feature__media">
                <Prototype3DViewer />
              </div>
              <div className="hs-hardware-feature__body">
                <span className="hs-section-index hs-mono">
                  ESPECIFICACIONES DEL PROTOTIPO
                </span>
                <div className="hs-tech-tags">
                  <span className="hs-tech-tag">ESP32</span>
                  <span className="hs-tech-tag">Raspberry Pi 4</span>
                  <span className="hs-tech-tag">Coral TPU</span>
                  <span className="hs-tech-tag">MQTT</span>
                  <span className="hs-tech-tag">Socket.IO</span>
                  <span className="hs-tech-tag">300–2000 Hz</span>
                  <span className="hs-tech-tag">PVC de 1&quot;</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =================================================================
            04. MERCADO E IMPACTO
           ================================================================= */}
        <section id="mercado" className="hs-section hs-section--ice-band">
          <div className="hs-container">
            <div className="hs-section-head">
              <div className="hs-section-index hs-mono">MERCADO E IMPACTO</div>
              <div>
                <h2 className="hs-section-title">
                  Un mercado impulsado por pérdidas reales.
                </h2>
                <p className="hs-section-lead" style={{ marginTop: '14px' }}>
                  La detección de fugas representa una oportunidad tecnológica en México y el
                  mercado global.
                </p>
              </div>
            </div>

            <div className="hs-market-grid">
              <div className="hs-market-tiers">
                <article className="hs-market-tier">
                  <div className="hs-market-tier__head">
                    <span className="hs-market-tier__tag hs-mono">TAM</span>
                    <span className="hs-market-tier__figure">USD $4.17 B</span>
                  </div>
                  <p>Mercado global de detección de fugas de agua, estimación 2024.</p>
                  <p className="hs-market-tier__source hs-mono">
                    ESTIMACIÓN DE MERCADO: Research and Markets / Mordor Intelligence (2024).
                  </p>
                </article>

                <article className="hs-market-tier">
                  <div className="hs-market-tier__head">
                    <span className="hs-market-tier__tag hs-mono">PROYECCIÓN</span>
                    <span className="hs-market-tier__figure">USD $5.90–6.80 B</span>
                  </div>
                  <p>Tamaño estimado del mercado hacia 2030.</p>
                  <p className="hs-market-tier__source hs-mono">
                    PROYECCIÓN DE MERCADO: Research and Markets / Fact.MR (2024–2030, CAGR est. 6.2–7.2%).
                  </p>
                </article>

                <article className="hs-market-tier">
                  <div className="hs-market-tier__head">
                    <span className="hs-market-tier__tag hs-mono">MÉXICO Y LATAM</span>
                    <span className="hs-market-tier__figure">35–46%</span>
                  </div>
                  <p>
                    Pérdidas estimadas de agua en redes de distribución mexicanas, según las fuentes
                    citadas.
                  </p>
                  <p className="hs-market-tier__source hs-mono">
                    DATOS DE REPORTES: CONAGUA / IMCO (México: 40–46%) · BID / OCDE (Latam: 35–45%).
                  </p>
                </article>
              </div>

              <div className="hs-market-right">
                <MarketTrajectoryDiagram />
              </div>
            </div>
          </div>
        </section>

        {/* =================================================================
            05. DASHBOARD (FONDO #022045)
           ================================================================= */}
        <section id="acceso-dashboard" className="hs-closing">
          <div className="hs-container">
            <div className="hs-closing__body">
              <div className="hs-closing__grid">
                <div>
                  <span className="hs-closing__eyebrow hs-mono">HYDROSENSE / PLATAFORMA</span>
                  <h2 className="hs-closing__title">El sistema, en funcionamiento.</h2>
                  <p className="hs-closing__lead">
                    Consulta las lecturas, revisa alertas y supervisa los actuadores desde la
                    plataforma.
                  </p>
                </div>

                <div className="hs-closing__actions">
                  <a
                    href="/dashboard"
                    className="hs-cta-large"
                    onClick={(e) => handleDashboardClick(e, false)}
                  >
                    <span>Entrar al dashboard</span>
                    <span className="hs-cta-large__arrow" aria-hidden="true">↗</span>
                  </a>

                  <a
                    href="/dashboard?debug=1"
                    className="hs-cta-debug hs-mono"
                    onClick={(e) => handleDashboardClick(e, true)}
                  >
                    Ver monitoreo técnico ↗
                  </a>
                </div>
              </div>

              <figure className="hs-closing-preview">
                <img
                  src="/landing/dashboard-preview.png"
                  alt="Captura real del dashboard de HydroSense mostrando presión, vibración piezoeléctrica, conectividad y gráfica en tiempo real"
                  width={1024}
                  height={538}
                  loading="lazy"
                />
              </figure>
            </div>

            <footer className="hs-footer">
              <img
                src="/hydrosense-horizontal-dark.svg"
                alt="HydroSense"
                className="hs-footer__logo"
                width={138}
                height={26}
              />
              <span className="hs-footer__meta">
                Detección vibroacústica de fugas de agua.
              </span>
              <span className="hs-footer__meta hs-mono">Expo Ingenierías · 2026</span>
            </footer>
          </div>
        </section>
      </main>
    </div>
  )
}
