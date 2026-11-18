import React from 'react'
import ReactDOM from 'react-dom/client'
import LandingPage from './LandingPage'

const openDashboard = (debug = false) => {
  window.location.assign(debug ? '/dashboard?debug=1' : '/dashboard')
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LandingPage onOpenDashboard={openDashboard} />
  </React.StrictMode>,
)
