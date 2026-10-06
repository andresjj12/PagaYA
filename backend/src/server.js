/**
 * Punto de entrada de la API de PagaYA.
 * Aquí se arma la app, se registran los endpoints y se valida
 * que las dependencias críticas (MongoDB y SQL Server) estén listas
 * antes de dejar la API disponible para el frontend.
 */
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./config/database");
const { connectSQLServer } = require("./config/sqlserver");

const authRoutes = require("./routes/auth.routes");
const walletRoutes = require("./routes/wallet.routes");

const app = express();

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/wallet", walletRoutes);

app.get("/", (req, res) => {
    res.json({
        message: "API PagaYA funcionando correctamente",
        status: "OK"
    });
});

async function startServer() {
    try {
        // Conectar MongoDB
        await connectDB();

        // Conectar SQL Server
        await connectSQLServer();

        // Iniciar servidor
        app.listen(PORT, () => {
            console.log(
                `Servidor PagaYA ejecutándose en http://localhost:${PORT}`
            );
        });

    } catch (error) {
        console.error("❌ No se pudo iniciar el servidor:");
        console.error(error.message);

        process.exit(1);
    }
}

startServer();