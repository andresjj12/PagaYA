import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../services/api";

function ResetPassword() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get("token") || "";
    const [password, setPassword] = useState("");
    const [confirmation, setConfirmation] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError("");
        setSuccess("");

        if (password !== confirmation) {
            setError("Las contraseñas no coinciden.");
            return;
        }

        setLoading(true);

        try {
            const response = await api.resetPassword({ token, password });
            setSuccess(response.message);
            setPassword("");
            setConfirmation("");
        } catch (requestError) {
            setError(
                requestError.message ||
                "No fue posible actualizar la contraseña."
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

                <h2>Crear nueva contraseña</h2>
                <p className="reset-page-description">
                    Elige una contraseña segura de al menos 8 caracteres.
                </p>

                {!token && (
                    <div className="reset-feedback reset-feedback-error" role="alert">
                        El enlace no es válido. Solicita uno nuevo para continuar.
                    </div>
                )}

                {error && (
                    <div className="reset-feedback reset-feedback-error" role="alert">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="reset-feedback reset-feedback-success" role="status">
                        {success}
                    </div>
                )}

                {token && !success && (
                    <form onSubmit={handleSubmit}>
                        <div className="field-group">
                            <label htmlFor="new-password">Nueva contraseña</label>
                            <input
                                id="new-password"
                                type="password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                autoComplete="new-password"
                                minLength={8}
                                maxLength={72}
                                required
                            />
                        </div>

                        <div className="field-group">
                            <label htmlFor="confirm-password">
                                Confirmar contraseña
                            </label>
                            <input
                                id="confirm-password"
                                type="password"
                                value={confirmation}
                                onChange={(event) => setConfirmation(event.target.value)}
                                autoComplete="new-password"
                                minLength={8}
                                maxLength={72}
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            className="primary-button"
                            disabled={loading}
                        >
                            {loading ? "Actualizando..." : "Guardar contraseña"}
                        </button>
                    </form>
                )}

                <div className="auth-links">
                    <Link to="/" className="forgot-password-link">
                        <span>Volver al inicio de sesión</span>
                    </Link>
                </div>
            </main>
        </div>
    );
}

export default ResetPassword;
