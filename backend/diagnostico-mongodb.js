require("dotenv").config();

const mongoose = require("mongoose");

const User = require("./src/models/User");
const Wallet = require("./src/models/Wallet");
const Transaction = require("./src/models/Transaction");

async function diagnosticar() {
    try {
        console.log("🔄 Conectando con MongoDB...");

        await mongoose.connect(process.env.MONGODB_URI);

        console.log("✅ MongoDB conectado correctamente");
        console.log("");

        // ==========================================
        // USUARIOS
        // ==========================================

        const usuarios = await User.find()
            .select("_id nombre apellido email telefono rol estado createdAt updatedAt")
            .lean();

        console.log("======================================");
        console.log("             USUARIOS");
        console.log("======================================");

        console.table(
            usuarios.map(usuario => ({
                MongoId: usuario._id.toString(),
                Nombre: `${usuario.nombre} ${usuario.apellido}`,
                Email: usuario.email,
                Telefono: usuario.telefono,
                Rol: usuario.rol,
                Estado: usuario.estado,
                CreatedAt: usuario.createdAt,
                UpdatedAt: usuario.updatedAt
            }))
        );

        // ==========================================
        // BILLETERAS
        // ==========================================

        const billeteras = await Wallet.find()
            .select("_id usuario saldo moneda estado createdAt updatedAt")
            .lean();

        console.log("");
        console.log("======================================");
        console.log("             BILLETERAS");
        console.log("======================================");

        console.table(
            billeteras.map(billetera => ({
                MongoId: billetera._id.toString(),
                UsuarioMongoId: billetera.usuario
                    ? billetera.usuario.toString()
                    : null,
                Saldo: billetera.saldo,
                Moneda: billetera.moneda,
                Estado: billetera.estado,
                CreatedAt: billetera.createdAt,
                UpdatedAt: billetera.updatedAt
            }))
        );

        // ==========================================
        // TRANSACCIONES
        // ==========================================

        const transacciones = await Transaction.find()
            .select(
                "_id usuario billetera tipo monto saldoAnterior saldoNuevo descripcion estado referencia createdAt updatedAt"
            )
            .lean();

        console.log("");
        console.log("======================================");
        console.log("          TRANSACCIONES");
        console.log("======================================");

        console.table(
            transacciones.map(transaccion => ({
                MongoId: transaccion._id.toString(),
                UsuarioMongoId: transaccion.usuario
                    ? transaccion.usuario.toString()
                    : null,
                BilleteraMongoId: transaccion.billetera
                    ? transaccion.billetera.toString()
                    : null,
                Tipo: transaccion.tipo,
                Monto: transaccion.monto,
                SaldoAnterior: transaccion.saldoAnterior,
                SaldoNuevo: transaccion.saldoNuevo,
                Descripcion: transaccion.descripcion,
                Estado: transaccion.estado,
                Referencia: transaccion.referencia,
                CreatedAt: transaccion.createdAt,
                UpdatedAt: transaccion.updatedAt
            }))
        );

        // ==========================================
        // RESUMEN
        // ==========================================

        console.log("");
        console.log("======================================");
        console.log("              RESUMEN");
        console.log("======================================");

        console.log(`👤 Usuarios:       ${usuarios.length}`);
        console.log(`💰 Billeteras:     ${billeteras.length}`);
        console.log(`💳 Transacciones:  ${transacciones.length}`);

        console.log("======================================");

        await mongoose.disconnect();

        console.log("");
        console.log("🔌 Conexión con MongoDB cerrada");
        console.log("✅ Diagnóstico terminado");

    } catch (error) {

        console.error("");
        console.error("❌ Error durante el diagnóstico:");
        console.error(error);

        try {
            await mongoose.disconnect();
        } catch (e) {
            // No hacer nada
        }

        process.exit(1);
    }
}

diagnosticar();