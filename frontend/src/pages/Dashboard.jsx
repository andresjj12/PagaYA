import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

function Dashboard() {
    const navigate = useNavigate();

    const [user, setUser] = useState(
        JSON.parse(localStorage.getItem("user") || "{}")
    );

    const [wallet, setWallet] = useState(
        JSON.parse(localStorage.getItem("wallet") || "null")
    );

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        cargarPerfil();
    }, []);

    const cargarPerfil = async () => {
        try {
            setLoading(true);
            setError("");

            const data = await api.profile();

            if (data.usuario) {
                setUser(data.usuario);

                localStorage.setItem(
                    "user",
                    JSON.stringify(data.usuario)
                );
            }

            if (data.billetera) {
                setWallet(data.billetera);

                localStorage.setItem(
                    "wallet",
                    JSON.stringify(data.billetera)
                );
            }

        } catch (error) {
            console.error("Error cargando perfil:", error);

            setError(
                error.message || "No se pudo cargar la información"
            );

            // Si el token ya no es válido
            if (
                error.message?.toLowerCase().includes("token") ||
                error.message?.toLowerCase().includes("autoriz")
            ) {
                logout();
            }

        } finally {
            setLoading(false);
        }
    };

    const logout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        localStorage.removeItem("wallet");

        navigate("/");
    };

    const formatoSaldo = (saldo) => {
        return new Intl.NumberFormat("es-CO", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }).format(saldo || 0);
    };

    return (
        <div className="dashboard">

            <header className="dashboard-header">

                <div>
                    <strong>PagaYA</strong>
                </div>

                <button
                    className="logout-button"
                    onClick={logout}
                >
                    Cerrar sesión
                </button>

            </header>

            <main className="dashboard-content">

                <section className="welcome">

                    <p>Bienvenido</p>

                    <h1>
                        {user.nombre || "Usuario"}{" "}
                        {user.apellido || ""}
                    </h1>

                </section>

                {error && (
                    <div className="error-message">
                        {error}
                    </div>
                )}

                <section className="balance-card">

                    <p>Saldo disponible</p>

                    {loading ? (
                        <h2>
                            Cargando...
                        </h2>
                    ) : (
                        <h2>
                            ${formatoSaldo(wallet?.saldo)}{" "}
                            {wallet?.moneda || "COP"}
                        </h2>
                    )}

                    <div className="wallet-status">
                        ●{" "}
                        {wallet?.estado === "activa"
                            ? "Billetera activa"
                            : "Billetera inactiva"}
                    </div>

                </section>

                <section className="actions">

                    <button>
                        💵 Recargar
                    </button>

                    <button>
                        💸 Realizar pago
                    </button>

                    <button>
                        📜 Historial
                    </button>

                </section>

                <section className="transactions">

                    <h2>
                        Últimas transacciones
                    </h2>

                    <div className="empty-state">

                        <p>
                            Próximamente mostraremos tus
                            transacciones.
                        </p>

                    </div>

                </section>

            </main>

        </div>
    );
}

export default Dashboard;