import React from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/600.css'
import '@fontsource/jetbrains-mono/700.css'
import '@fontsource/jetbrains-mono/800.css'
import App from './App.jsx'
import './index.css'

// Ask the browser to make our offline data (cached app shell + IndexedDB notes)
// durable, so it isn't evicted under storage pressure. Usually auto-granted for
// installed PWAs — this keeps the app usable even if the host disappears.
if (navigator.storage?.persist) {
  navigator.storage.persist().catch(() => {})
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
