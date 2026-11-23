import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { loadSettings } from './game/settings'
import { Simulation } from './game/simulation'
import './styles/index.css'

const simulation = new Simulation(loadSettings())

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App simulation={simulation} />
  </React.StrictMode>
)
