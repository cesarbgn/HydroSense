import React, { useCallback, useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import LandingPage from './landing/LandingPage'
import './index.css'

type ViewMode = 'landing' | 'dashboard'

function resolveView(): ViewMode {
  const path = window.location.pathname.replace(/\/+$/, '') || '/'
  const params = new URLSearchParams(window.location.search)
  if (
    path.endsWith('/dashboard') ||
    path.endsWith('/app') ||
    params.get('dashboard') === '1' ||
    params.get('debug') === '1'
  ) {
    return 'dashboard'
  }
  return 'landing'
}

function Root() {
  const [view, setView] = useState<ViewMode>(resolveView)

  useEffect(() => {
    const syncFromLocation = () => setView(resolveView())
    window.addEventListener('popstate', syncFromLocation)
    return () => window.removeEventListener('popstate', syncFromLocation)
  }, [])

  useEffect(() => {
    document.title =
      view === 'landing'
        ? 'HydroSense — Monitoreo vibroacústico de tuberías'
        : 'HydroSense — Dashboard operativo'
  }, [view])

  const openDashboard = useCallback((debug = false) => {
    const nextUrl = debug ? '/dashboard?debug=1' : '/dashboard'
    window.history.pushState({}, '', nextUrl)
    setView('dashboard')
    window.scrollTo(0, 0)
  }, [])

  const openLanding = useCallback(() => {
    window.history.pushState({}, '', '/')
    setView('landing')
    window.scrollTo(0, 0)
  }, [])

  if (view === 'landing') {
    return <LandingPage onOpenDashboard={openDashboard} />
  }

  return <App onVolverInicio={openLanding} />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
