import React from 'react'
import ReactDOM from 'react-dom/client'
import { Recordings } from './Recordings'

ReactDOM.createRoot(document.getElementById('app') as HTMLElement).render(
  <React.StrictMode>
    <Recordings />
  </React.StrictMode>
)
