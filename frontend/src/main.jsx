// Inicio la aplicación React dentro del elemento root de index.html.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Cargo los estilos generales antes de renderizar los componentes.
import './index.css'
import App from './App.jsx'

// StrictMode me ayuda a detectar prácticas problemáticas durante el desarrollo.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
