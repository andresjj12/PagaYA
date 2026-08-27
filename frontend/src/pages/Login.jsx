import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../services/api";

function Login() {
    const navigate = useNavigate();

    const [form, setForm] = useState({
        email: "",
        password: ""
    });

    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setForm({
            ...form,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        setError("");
        setLoading(true);

        try {
            const data = await api.login(form);

            // El backend devuelve "token"
            if (!data.token) {
                throw new Error("El servidor no devolvió un token");
            }

            // Guardar sesión
            localStorage.setItem("token", data.token);

            // El backend devuelve "usuario", no "user"
            if (data.usuario) {
                localStorage.setItem(
                    "user",
                    JSON.stringify(data.usuario)
                );
            }

            // Guardar billetera
            if (data.billetera) {
                localStorage.setItem(
                    "wallet",
                    JSON.stringify(data.billetera)
                );
            }

            navigate("/dashboard");

        } catch (error) {
            console.error("Error en login:", error);

            setError(
                error.message || "No fue posible iniciar sesión"
            );

        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">

            <div className="auth-card">

                <div className="brand">
                    <div className="brand-icon">₱</div>

                    <h1>PagaYA</h1>

                    <p>
                        Tu dinero, más fácil.
                    </p>
                </div>

                <h2>
                    Iniciar sesión
                </h2>

                {error && (
                    <div className="error-message">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>

                    <label htmlFor="email">
                        Correo electrónico
                    </label>

                    <input
                        id="email"
                        type="email"
                        name="email"
                        value={form.email}
                        onChange={handleChange}
                        placeholder="correo@ejemplo.com"
                        autoComplete="email"
                        required
                    />

                    <label htmlFor="password">
                        Contraseña
                    </label>

                    <input
                        id="password"
                        type="password"
                        name="password"
                        value={form.password}
                        onChange={handleChange}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        required
                    />

                    <button
                        type="submit"
                        className="primary-button"
                        disabled={loading}
                    >
                        {loading
                            ? "Ingresando..."
                            : "Iniciar sesión"}
                    </button>

                </form>

                <p className="auth-footer">
                    ¿No tienes una cuenta?{" "}

                    <Link to="/registro">
                        Crear cuenta
                    </Link>
                </p>

            </div>

        </div>
    );
}

export default Login;