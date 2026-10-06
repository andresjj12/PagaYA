// En este archivo conecto las pantallas de React y defino sus rutas.
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";

import "./App.css";

function ProtectedRoute({ children }) {
    // Reviso el token guardado para restringir el acceso al panel.
    const token = localStorage.getItem("token");

    if (!token) {
        return <Navigate to="/" replace />;
    }

    return children;
}

function App() {
    return (
        <HashRouter>
            <Routes>
                {/* La ruta principal muestra el formulario para ingresar. */}
                <Route path="/" element={<Login />} />

                {/* Aquí registro usuarios nuevos y protejo el panel privado. */}
                <Route
                    path="/registro"
                    element={<Register />}
                />

                <Route
                    path="/dashboard"
                    element={
                        <ProtectedRoute>
                            <Dashboard />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="*"
                    element={<Navigate to="/" replace />}
                />

            </Routes>

        </HashRouter>
    );
}

export default App;