import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";

function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setMessage("");
        setError("");
        setLoading(true);

        try {
            const response = await api.requestPasswordReset(email.trim());
            setMessage(response.message);
        } catch (requestError) {
            setError(
                requestError.message ||
                "No fue posible enviar la solicitud. Intenta de nuevo."
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <span className="shape" aria-hidden="true"></span>
            <span className="shape-two" aria-hidden="true"></span>
            <span className="shape-three" aria-hidden="true"></span>

            <main className="auth-card password-reset-card">
                <div className="brand" aria-label="Logo de PagaYA">
                    <div className="brand-wordmark">
                        <span className="brand-paga">Paga</span>
                        <span className="brand-ya">Ya</span>
                    </div>
                </div>

                <div className="reset-page-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                        <rect x="4" y="6" width="16" height="12" rx="2" />
                        <path d="m5 8 7 5 7-5" />
                    </svg>
                </div>

                <h2>Recuperar contraseña</h2>
                <p className="reset-page-description">
                    Ingresa el correo asociado a tu cuenta. Te enviaremos las
                    instrucciones para crear una nueva contraseña.
                </p>

                {message && (
                    <div className="reset-feedback reset-feedback-success" role="status">
                        {message}
                    </div>
                )}

                {error && (
                    <div className="reset-feedback reset-feedback-error" role="alert">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="field-group">
                        <label htmlFor="recovery-email">Correo electrónico</label>
                        <input
                            id="recovery-email"
                            type="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            placeholder="tu@correo.com"
                            autoComplete="email"
                            maxLength={254}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="primary-button"
                        disabled={loading}
                    >
                        {loading ? "Enviando..." : "Enviar instrucciones"}
                    </button>
                </form>

                <div className="auth-links">
                    <Link to="/" className="forgot-password-link">
                        <span>Volver al inicio de sesión</span>
                    </Link>
                </div>
            </main>
        </div>
    );
}

export default ForgotPassword;
