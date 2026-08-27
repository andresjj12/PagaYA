const express = require("express");
const Wallet = require("../models/Wallet");
const Transaction = require("../models/Transaction");
const verificarToken = require("../middleware/auth.middleware");

const router = express.Router();


// ======================================================
// CONSULTAR BILLETERA
// GET /api/wallet
// ======================================================

router.get("/", verificarToken, async (req, res) => {
    try {

        const billetera = await Wallet.findOne({
            usuario: req.usuario.id
        });

        if (!billetera) {
            return res.status(404).json({
                message: "Billetera no encontrada"
            });
        }

        return res.status(200).json({
            message: "Billetera obtenida correctamente",
            billetera: {
                id: billetera._id,
                saldo: billetera.saldo,
                moneda: billetera.moneda,
                estado: billetera.estado
            }
        });

    } catch (error) {

        console.error("Error obteniendo billetera:", error);

        return res.status(500).json({
            message: "Error interno del servidor"
        });
    }
});


// ======================================================
// RECARGA DE PRUEBA
// POST /api/wallet/recharge
// ======================================================

router.post("/recharge", verificarToken, async (req, res) => {
    try {

        const { monto, descripcion } = req.body;

        // 1. Validar monto
        if (monto === undefined || monto === null) {
            return res.status(400).json({
                message: "El monto es obligatorio"
            });
        }

        const montoNumerico = Number(monto);

        if (!Number.isFinite(montoNumerico) || montoNumerico <= 0) {
            return res.status(400).json({
                message: "El monto debe ser un número mayor que 0"
            });
        }

        // 2. Buscar billetera
        const billetera = await Wallet.findOne({
            usuario: req.usuario.id
        });

        if (!billetera) {
            return res.status(404).json({
                message: "Billetera no encontrada"
            });
        }

        // 3. Verificar estado
        if (billetera.estado !== "activa") {
            return res.status(403).json({
                message: "La billetera no está activa"
            });
        }

        // 4. Saldo anterior
        const saldoAnterior = billetera.saldo;

        // 5. Nuevo saldo
        const saldoNuevo = saldoAnterior + montoNumerico;

        // 6. Actualizar billetera
        billetera.saldo = saldoNuevo;

        await billetera.save();

        // 7. Crear referencia
        const referencia = `REC-${Date.now()}-${Math.floor(
            Math.random() * 10000
        )}`;

        // 8. Registrar transacción
        const transaccion = await Transaction.create({
            usuario: req.usuario.id,
            billetera: billetera._id,
            tipo: "recarga",
            monto: montoNumerico,
            saldoAnterior,
            saldoNuevo,
            descripcion: descripcion || "Recarga de prueba",
            estado: "completada",
            referencia
        });

        // 9. Respuesta
        return res.status(201).json({
            message: "Recarga realizada correctamente",

            recarga: {
                monto: transaccion.monto,
                referencia: transaccion.referencia,
                estado: transaccion.estado
            },

            billetera: {
                id: billetera._id,
                saldoAnterior,
                saldoNuevo,
                moneda: billetera.moneda
            }
        });

    } catch (error) {

        console.error("Error realizando recarga:", error);

        return res.status(500).json({
            message: "Error interno del servidor"
        });
    }
});


// ======================================================
// HISTORIAL DE MOVIMIENTOS
// GET /api/wallet/transactions
// ======================================================

router.get("/transactions", verificarToken, async (req, res) => {
    try {

        const movimientos = await Transaction.find({
            usuario: req.usuario.id
        }).sort({ createdAt: -1 });

        return res.status(200).json({
            message: "Movimientos obtenidos correctamente",
            cantidad: movimientos.length,
            movimientos
        });

    } catch (error) {

        console.error("Error obteniendo movimientos:", error);

        return res.status(500).json({
            message: "Error interno del servidor"
        });
    }
});



// ======================================================
// REALIZAR PAGO
// POST /api/wallet/payment
// ======================================================

router.post("/payment", verificarToken, async (req, res) => {
    try {

        const { monto, descripcion } = req.body;

        // 1. Validar que exista el monto
        if (monto === undefined || monto === null) {
            return res.status(400).json({
                message: "El monto es obligatorio"
            });
        }

        // 2. Convertir el monto a número
        const montoNumerico = Number(monto);

        // 3. Validar el monto
        if (!Number.isFinite(montoNumerico) || montoNumerico <= 0) {
            return res.status(400).json({
                message: "El monto debe ser un número mayor que 0"
            });
        }

        // 4. Buscar la billetera del usuario autenticado
        const billetera = await Wallet.findOne({
            usuario: req.usuario.id
        });

        if (!billetera) {
            return res.status(404).json({
                message: "Billetera no encontrada"
            });
        }

        // 5. Verificar que la billetera esté activa
        if (billetera.estado !== "activa") {
            return res.status(403).json({
                message: "La billetera no está activa"
            });
        }

        // 6. Verificar que haya saldo suficiente
        if (montoNumerico > billetera.saldo) {
            return res.status(400).json({
                message: "Saldo insuficiente"
            });
        }

        // 7. Guardar saldo anterior
        const saldoAnterior = billetera.saldo;

        // 8. Calcular nuevo saldo
        const saldoNuevo = saldoAnterior - montoNumerico;

       
        // 9. Actualizar billetera de forma segura
const billeteraActualizada = await Wallet.findOneAndUpdate(
    {
        _id: billetera._id,
        saldo: { $gte: montoNumerico },
        estado: "activa"
    },
    {
        $inc: { saldo: -montoNumerico }
    },
    {
        new: true
    }
);

if (!billeteraActualizada) {
    return res.status(400).json({
        message: "El saldo cambió o es insuficiente para realizar el pago"
    });
}

        // 10. Crear referencia
        const referencia = `PAY-${Date.now()}-${Math.floor(
            Math.random() * 10000
        )}`;

        // 11. Registrar movimiento
        const transaccion = await Transaction.create({
            usuario: req.usuario.id,
            billetera: billetera._id,
            tipo: "pago",
            monto: montoNumerico,
            saldoAnterior,
            saldoNuevo: billeteraActualizada.saldo,
            descripcion: descripcion || "Pago PagaYA",
            estado: "completada",
            referencia
        });

        // 12. Responder
        return res.status(201).json({
            message: "Pago realizado correctamente",

            pago: {
                monto: transaccion.monto,
                referencia: transaccion.referencia,
                estado: transaccion.estado
            },

            billetera: {
                id: billetera._id,
                saldoAnterior,
                saldoNuevo: billeteraActualizada.saldo,
                moneda: billetera.moneda
            }
        });

    } catch (error) {

        console.error("Error realizando pago:", error);

        return res.status(500).json({
            message: "Error interno del servidor"
        });
    }
});

// ======================================================
// CONSULTAR MOVIMIENTO POR REFERENCIA
// GET /api/wallet/transactions/:referencia
// ======================================================

router.get("/transactions/:referencia", verificarToken, async (req, res) => {
    try {

        const { referencia } = req.params;

        // Buscar la transacción del usuario autenticado
        const transaccion = await Transaction.findOne({
            referencia,
            usuario: req.usuario.id
        });

        if (!transaccion) {
            return res.status(404).json({
                message: "Movimiento no encontrado"
            });
        }

        return res.status(200).json({
            message: "Movimiento obtenido correctamente",
            movimiento: transaccion
        });

    } catch (error) {

        console.error("Error obteniendo movimiento:", error);

        return res.status(500).json({
            message: "Error interno del servidor"
        });
    }
});


// ======================================================
// CONSULTAR COMPROBANTE DE PAGO
// GET /api/wallet/transactions/:referencia/receipt
// ======================================================

router.get(
    "/transactions/:referencia/receipt",
    verificarToken,
    async (req, res) => {
        try {
            const { referencia } = req.params;

            const transaccion = await Transaction.findOne({
                referencia,
                usuario: req.usuario.id
            });

            if (!transaccion) {
                return res.status(404).json({
                    message: "Comprobante no encontrado"
                });
            }

            return res.status(200).json({
                message: "Comprobante obtenido correctamente",
                comprobante: {
                    tipo: transaccion.tipo.toUpperCase(),
                    estado: transaccion.estado.toUpperCase(),
                    referencia: transaccion.referencia,
                    monto: transaccion.monto,
                    moneda: "COP",
                    saldoAnterior: transaccion.saldoAnterior,
                    saldoNuevo: transaccion.saldoNuevo,
                    descripcion: transaccion.descripcion,
                    fecha: transaccion.createdAt
                }
            });

        } catch (error) {
            console.error("Error obteniendo comprobante:", error);

            return res.status(500).json({
                message: "Error interno del servidor"
            });
        }
    }
);


// ======================================================
// EXPORTAR RUTAS
// ======================================================

module.exports = router;