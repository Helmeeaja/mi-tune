import React from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/manrope'
import './index.css'
import App from './App.jsx'
import { applySettings, readSettings } from './lib/preferences.js'

applySettings(readSettings())
createRoot(document.getElementById('root')).render(<App />)
