const sql = require("mssql");
require("dotenv").config();

const SQL_ENABLED = process.env.SQL_ENABLED !== "false";

const baseConfig = {
    server: process.env.SQL_SERVER,
    port: Number(process.env.SQL_PORT),
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    options: {
        encrypt: process.env.SQL_ENCRYPT === "true",
        trustServerCertificate:
            process.env.SQL_TRUST_SERVER_CERTIFICATE === "true"
    }
};

let mainPool;
let backupPool;

async function connectSQLServer() {
    if (!SQL_ENABLED) {
        console.log("🛑 SQL Server deshabilitado (SQL_ENABLED=false)");
        return {
            mainPool: null,
            backupPool: null
        };
    }

    try {
        // ==========================================
        // CONEXIÓN A LA BASE PRINCIPAL
        // ==========================================

        mainPool = await new sql.ConnectionPool({
            ...baseConfig,
            database: process.env.SQL_DATABASE
        }).connect();

        console.log("✅ Conexión exitosa con SQL Server");
        console.log(`📦 Base principal: ${process.env.SQL_DATABASE}`);
        console.log(`👤 Usuario: ${process.env.SQL_USER}`);
        console.log(`🔌 Puerto: ${process.env.SQL_PORT}`);


        // ==========================================
        // CONEXIÓN A LA BASE DE RESPALDO (OPCIONAL)
        // ==========================================

        if (process.env.SQL_BACKUP_DATABASE) {
            try {
                backupPool = await new sql.ConnectionPool({
                    ...baseConfig,
                    database: process.env.SQL_BACKUP_DATABASE
                }).connect();

                console.log("✅ Conexión exitosa con la base de respaldo");
                console.log(`💾 Base de respaldo: ${process.env.SQL_BACKUP_DATABASE}`);
            } catch (error) {
                backupPool = null;

                console.warn("⚠️ No se pudo conectar con la base de respaldo:");
                console.warn(error.message);
                console.warn("   Continuando sin la base de respaldo.");
            }
        }

        return {
            mainPool,
            backupPool
        };

    } catch (error) {
        console.error("❌ Error conectando con SQL Server:");
        console.error(error.message);

        throw error;
    }
}


// ==========================================
// OBTENER CONEXIÓN PRINCIPAL
// ==========================================

function getSQLPool() {
    if (!mainPool) {
        throw new Error(
            "SQL Server principal todavía no está conectado"
        );
    }

    return mainPool;
}


// ==========================================
// OBTENER CONEXIÓN DE RESPALDO
// ==========================================

function getBackupPool() {
    if (!backupPool) {
        throw new Error(
            "SQL Server Backup todavía no está conectado"
        );
    }

    return backupPool;
}


module.exports = {
    sql,
    connectSQLServer,
    getSQLPool,
    getBackupPool
};