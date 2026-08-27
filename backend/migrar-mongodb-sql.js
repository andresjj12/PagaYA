require("dotenv").config();

const mongoose = require("mongoose");
const sql = require("mssql");

const User = require("./src/models/User");
const Wallet = require("./src/models/Wallet");
const Transaction = require("./src/models/Transaction");

const sqlConfig = {
    server: process.env.SQL_SERVER,
    port: Number(process.env.SQL_PORT),
    database: process.env.SQL_DATABASE,
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    options: {
        encrypt: process.env.SQL_ENCRYPT === "true",
        trustServerCertificate:
            process.env.SQL_TRUST_SERVER_CERTIFICATE === "true"
    }
};

async function migrar() {
    let pool;
    let mongoConectado = false;

    try {

        // ==========================================
        // CONECTAR MONGODB
        // ==========================================

        console.log("🔄 Conectando con MongoDB...");

        await mongoose.connect(process.env.MONGODB_URI);

        mongoConectado = true;

        console.log("✅ MongoDB conectado");

        // ==========================================
        // CONECTAR SQL SERVER
        // ==========================================

        console.log("🔄 Conectando con SQL Server...");

        pool = await sql.connect(sqlConfig);

        console.log("✅ SQL Server conectado");
        console.log(`📦 Base destino: ${process.env.SQL_DATABASE}`);

        // ==========================================
        // LEER DATOS DE MONGODB
        // ==========================================

        const usuarios = await User.find()
            .sort({ createdAt: 1 })
            .lean();

        const billeteras = await Wallet.find()
            .sort({ createdAt: 1 })
            .lean();

        const transacciones = await Transaction.find()
            .sort({ createdAt: 1 })
            .lean();

        console.log("");
        console.log("======================================");
        console.log("       DATOS A MIGRAR");
        console.log("======================================");
        console.log(`👤 Usuarios:       ${usuarios.length}`);
        console.log(`💰 Billeteras:     ${billeteras.length}`);
        console.log(`💳 Transacciones:  ${transacciones.length}`);
        console.log("======================================");

        // ==========================================
        // INICIAR TRANSACCIÓN SQL
        // ==========================================

        const transaction = new sql.Transaction(pool);

        await transaction.begin();

        try {

            // ======================================
            // MAPAS DE RELACIÓN
            // ======================================

            const usuarioMap = new Map();
            const billeteraMap = new Map();

            // ======================================
            // INSERTAR USUARIOS
            // ======================================

            console.log("");
            console.log("👤 Migrando usuarios...");

            for (const usuario of usuarios) {

                const request = new sql.Request(transaction);

                request.input(
                    "mongo_id",
                    sql.NVarChar(24),
                    usuario._id.toString()
                );

                request.input(
                    "nombre",
                    sql.NVarChar(100),
                    usuario.nombre
                );

                request.input(
                    "apellido",
                    sql.NVarChar(100),
                    usuario.apellido
                );

                request.input(
                    "email",
                    sql.NVarChar(150),
                    usuario.email
                );

                request.input(
                    "telefono",
                    sql.NVarChar(30),
                    usuario.telefono
                );

                request.input(
                    "password",
                    sql.NVarChar(255),
                    usuario.password
                );

                request.input(
                    "rol",
                    sql.NVarChar(20),
                    usuario.rol
                );

                request.input(
                    "estado",
                    sql.NVarChar(20),
                    usuario.estado
                );

                request.input(
                    "created_at",
                    sql.DateTime2,
                    usuario.createdAt
                );

                request.input(
                    "updated_at",
                    sql.DateTime2,
                    usuario.updatedAt
                );

                const result = await request.query(`
                    INSERT INTO dbo.Usuarios (
                        mongo_id,
                        nombre,
                        apellido,
                        email,
                        telefono,
                        password,
                        rol,
                        estado,
                        created_at,
                        updated_at
                    )
                    OUTPUT INSERTED.id
                    VALUES (
                        @mongo_id,
                        @nombre,
                        @apellido,
                        @email,
                        @telefono,
                        @password,
                        @rol,
                        @estado,
                        @created_at,
                        @updated_at
                    );
                `);

                const sqlId = result.recordset[0].id;

                usuarioMap.set(
                    usuario._id.toString(),
                    sqlId
                );

                console.log(
                    `   ✅ ${usuario.email} → SQL id ${sqlId}`
                );
            }

            // ======================================
            // INSERTAR BILLETERAS
            // ======================================

            console.log("");
            console.log("💰 Migrando billeteras...");

            for (const billetera of billeteras) {

                const usuarioMongoId =
                    billetera.usuario.toString();

                const usuarioSqlId =
                    usuarioMap.get(usuarioMongoId);

                if (!usuarioSqlId) {
                    throw new Error(
                        `No se encontró el usuario SQL para la billetera ${billetera._id}`
                    );
                }

                const request = new sql.Request(transaction);

                request.input(
                    "mongo_id",
                    sql.NVarChar(24),
                    billetera._id.toString()
                );

                request.input(
                    "usuario_id",
                    sql.Int,
                    usuarioSqlId
                );

                request.input(
                    "saldo",
                    sql.Decimal(18, 2),
                    billetera.saldo
                );

                request.input(
                    "moneda",
                    sql.NVarChar(10),
                    billetera.moneda
                );

                request.input(
                    "estado",
                    sql.NVarChar(20),
                    billetera.estado
                );

                request.input(
                    "created_at",
                    sql.DateTime2,
                    billetera.createdAt
                );

                request.input(
                    "updated_at",
                    sql.DateTime2,
                    billetera.updatedAt
                );

                const result = await request.query(`
                    INSERT INTO dbo.Billeteras (
                        mongo_id,
                        usuario_id,
                        saldo,
                        moneda,
                        estado,
                        created_at,
                        updated_at
                    )
                    OUTPUT INSERTED.id
                    VALUES (
                        @mongo_id,
                        @usuario_id,
                        @saldo,
                        @moneda,
                        @estado,
                        @created_at,
                        @updated_at
                    );
                `);

                const sqlId = result.recordset[0].id;

                billeteraMap.set(
                    billetera._id.toString(),
                    sqlId
                );

                console.log(
                    `   ✅ Billetera ${billetera._id} → SQL id ${sqlId}`
                );
            }

            // ======================================
            // INSERTAR TRANSACCIONES
            // ======================================

            console.log("");
            console.log("💳 Migrando transacciones...");

            for (const transaccion of transacciones) {

                const usuarioMongoId =
                    transaccion.usuario.toString();

                const billeteraMongoId =
                    transaccion.billetera.toString();

                const usuarioSqlId =
                    usuarioMap.get(usuarioMongoId);

                const billeteraSqlId =
                    billeteraMap.get(billeteraMongoId);

                if (!usuarioSqlId) {
                    throw new Error(
                        `No se encontró usuario SQL para transacción ${transaccion._id}`
                    );
                }

                if (!billeteraSqlId) {
                    throw new Error(
                        `No se encontró billetera SQL para transacción ${transaccion._id}`
                    );
                }

                const request = new sql.Request(transaction);

                request.input(
                    "mongo_id",
                    sql.NVarChar(24),
                    transaccion._id.toString()
                );

                request.input(
                    "usuario_id",
                    sql.Int,
                    usuarioSqlId
                );

                request.input(
                    "billetera_id",
                    sql.Int,
                    billeteraSqlId
                );

                request.input(
                    "tipo",
                    sql.NVarChar(30),
                    transaccion.tipo
                );

                request.input(
                    "monto",
                    sql.Decimal(18, 2),
                    transaccion.monto
                );

                request.input(
                    "saldo_anterior",
                    sql.Decimal(18, 2),
                    transaccion.saldoAnterior
                );

                request.input(
                    "saldo_nuevo",
                    sql.Decimal(18, 2),
                    transaccion.saldoNuevo
                );

                request.input(
                    "descripcion",
                    sql.NVarChar(250),
                    transaccion.descripcion || null
                );

                request.input(
                    "estado",
                    sql.NVarChar(20),
                    transaccion.estado
                );

                request.input(
                    "referencia",
                    sql.NVarChar(100),
                    transaccion.referencia || null
                );

                request.input(
                    "created_at",
                    sql.DateTime2,
                    transaccion.createdAt
                );

                request.input(
                    "updated_at",
                    sql.DateTime2,
                    transaccion.updatedAt
                );

                await request.query(`
                    INSERT INTO dbo.Transacciones (
                        mongo_id,
                        usuario_id,
                        billetera_id,
                        tipo,
                        monto,
                        saldo_anterior,
                        saldo_nuevo,
                        descripcion,
                        estado,
                        referencia,
                        created_at,
                        updated_at
                    )
                    VALUES (
                        @mongo_id,
                        @usuario_id,
                        @billetera_id,
                        @tipo,
                        @monto,
                        @saldo_anterior,
                        @saldo_nuevo,
                        @descripcion,
                        @estado,
                        @referencia,
                        @created_at,
                        @updated_at
                    );
                `);

                console.log(
                    `   ✅ Transacción ${transaccion._id}`
                );
            }

            // ======================================
            // CONFIRMAR
            // ======================================

            await transaction.commit();

            console.log("");
            console.log("======================================");
            console.log("✅ MIGRACIÓN COMPLETADA");
            console.log("======================================");

        } catch (error) {

            await transaction.rollback();

            console.error("");
            console.error("❌ Error durante la migración.");
            console.error("↩️ Se revirtieron todos los cambios de SQL Server.");
            console.error(error.message);

            throw error;
        }

    } catch (error) {

        console.error("");
        console.error("❌ ERROR GENERAL");
        console.error(error.message);

        process.exitCode = 1;

    } finally {

        if (mongoConectado) {
            await mongoose.disconnect();
            console.log("🔌 MongoDB desconectado");
        }

        if (pool) {
            await pool.close();
            console.log("🔌 SQL Server desconectado");
        }
    }
}

migrar();