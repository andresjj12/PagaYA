const express = require("express");
const crypto = require("crypto");

const Wallet = require("../models/Wallet");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const verificarToken = require("../middleware/auth.middleware");
const sqlSync = require("../services/sqlSync");

const router = express.Router();

// ======================================================
// GENERAR REFERENCIA
// ======================================================

function generarReferencia(prefijo) {
    return `${prefijo}-${crypto
        .randomBytes(8)
        .toString("hex")
        .toUpperCase()}`;
}

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
// RECARGA
// POST /api/wallet/recharge
// ======================================================

router.post("/recharge", verificarToken, async (req, res) => {
    const session = await Wallet.startSession();

    try {
        const {
            monto,
            descripcion
        } = req.body;

        if (monto === undefined || monto === null || monto === "") {
            return res.status(400).json({
                message: "El monto es obligatorio"
            });
        }

        const montoNumerico = Number(monto);

        if (
            !Number.isFinite(montoNumerico) ||
            montoNumerico <= 0
        ) {
            return res.status(400).json({
                message: "El monto debe ser un número mayor que 0"
            });
        }

        const billetera = await Wallet.findOne({
            usuario: req.usuario.id
        });

        if (!billetera) {
            return res.status(404).json({
                message: "Billetera no encontrada"
            });
        }

        if (billetera.estado !== "activa") {
            return res.status(403).json({
                message: "La billetera no está activa"
            });
        }

        const saldoAnterior = billetera.saldo;
        const referencia = generarReferencia("REC");

        session.startTransaction();

        const billeteraActualizada =
            await Wallet.findOneAndUpdate(
                {
                    _id: billetera._id,
                    estado: "activa"
                },
                {
                    $inc: {
                        saldo: montoNumerico
                    }
                },
                {
                    new: true,
                    session
                }
            );

        if (!billeteraActualizada) {
            await session.abortTransaction();

            return res.status(400).json({
                message: "No se pudo actualizar la billetera"
            });
        }

        const saldoNuevo = billeteraActualizada.saldo;

        const [transaccion] = await Transaction.create(
            [
                {
                    usuario: req.usuario.id,
                    billetera: billetera._id,
                    tipo: "recarga",
                    monto: montoNumerico,
                    saldoAnterior,
                    saldoNuevo,
                    descripcion:
                        descripcion?.trim() ||
                        "Recarga desde PagaYA",
                    estado: "completada",
                    referencia
                }
            ],
            {
                session
            }
        );

        await session.commitTransaction();

        try {
            const usuarioSqlId = await sqlSync.getUsuarioSqlId(req.usuario.id);
            const billeteraSqlId = await sqlSync.getBilleteraSqlId(billetera._id);

            if (usuarioSqlId && billeteraSqlId) {
                await sqlSync.insertTransaccion(transaccion, usuarioSqlId, billeteraSqlId);
                await sqlSync.updateSaldoBilletera(billetera._id, saldoNuevo);
            }
        } catch (error) {
            console.error("Error replicando recarga en SQL Server:", error.message);
        }

        return res.status(201).json({
            message: "Recarga realizada correctamente",

            recarga: {
                monto: transaccion.monto,
                referencia: transaccion.referencia,
                estado: transaccion.estado
            },

            billetera: {
                id: billeteraActualizada._id,
                saldoAnterior,
                saldoNuevo,
                moneda: billeteraActualizada.moneda
            }
        });
    } catch (error) {
        try {
            await session.abortTransaction();
        } catch (abortError) {
            console.error(
                "Error cancelando recarga:",
                abortError
            );
        }

        console.error(
            "Error realizando recarga:",
            error
        );

        return res.status(500).json({
            message: "No se pudo realizar la recarga"
        });
    } finally {
        await session.endSession();
    }
});

// ======================================================
// REALIZAR PAGO
// POST /api/wallet/payment
// ======================================================

router.post("/payment", verificarToken, async (req, res) => {
    const session = await Wallet.startSession();

    try {
        const {
            monto,
            descripcion
        } = req.body;

        if (monto === undefined || monto === null || monto === "") {
            return res.status(400).json({
                message: "El monto es obligatorio"
            });
        }

        const montoNumerico = Number(monto);

        if (
            !Number.isFinite(montoNumerico) ||
            montoNumerico <= 0
        ) {
            return res.status(400).json({
                message: "El monto debe ser un número mayor que 0"
            });
        }

        const billetera = await Wallet.findOne({
            usuario: req.usuario.id
        });

        if (!billetera) {
            return res.status(404).json({
                message: "Billetera no encontrada"
            });
        }

        if (billetera.estado !== "activa") {
            return res.status(403).json({
                message: "La billetera no está activa"
            });
        }

        const saldoAnterior = billetera.saldo;
        const referencia = generarReferencia("PAY");

        session.startTransaction();

        const billeteraActualizada =
            await Wallet.findOneAndUpdate(
                {
                    _id: billetera._id,
                    saldo: {
                        $gte: montoNumerico
                    },
                    estado: "activa"
                },
                {
                    $inc: {
                        saldo: -montoNumerico
                    }
                },
                {
                    new: true,
                    session
                }
            );

        if (!billeteraActualizada) {
            await session.abortTransaction();

            return res.status(400).json({
                message:
                    "Saldo insuficiente o la billetera no está activa"
            });
        }

        const saldoNuevo = billeteraActualizada.saldo;

        const [transaccion] = await Transaction.create(
            [
                {
                    usuario: req.usuario.id,
                    billetera: billetera._id,
                    tipo: "pago",
                    monto: montoNumerico,
                    saldoAnterior,
                    saldoNuevo,
                    descripcion:
                        descripcion?.trim() ||
                        "Pago PagaYA",
                    estado: "completada",
                    referencia
                }
            ],
            {
                session
            }
        );

        await session.commitTransaction();

        try {
            const usuarioSqlId = await sqlSync.getUsuarioSqlId(req.usuario.id);
            const billeteraSqlId = await sqlSync.getBilleteraSqlId(billetera._id);

            if (usuarioSqlId && billeteraSqlId) {
                await sqlSync.insertTransaccion(transaccion, usuarioSqlId, billeteraSqlId);
                await sqlSync.updateSaldoBilletera(billetera._id, saldoNuevo);
            }
        } catch (error) {
            console.error("Error replicando pago en SQL Server:", error.message);
        }

        return res.status(201).json({
            message: "Pago realizado correctamente",

            pago: {
                monto: transaccion.monto,
                referencia: transaccion.referencia,
                estado: transaccion.estado
            },

            billetera: {
                id: billeteraActualizada._id,
                saldoAnterior,
                saldoNuevo,
                moneda: billeteraActualizada.moneda
            }
        });
    } catch (error) {
        try {
            await session.abortTransaction();
        } catch (abortError) {
            console.error(
                "Error cancelando pago:",
                abortError
            );
        }

        console.error(
            "Error realizando pago:",
            error
        );

        return res.status(500).json({
            message: "No se pudo realizar el pago"
        });
    } finally {
        await session.endSession();
    }
});

// ======================================================
// HISTORIAL
// GET /api/wallet/transactions
// ======================================================

router.get(
    "/transactions",
    verificarToken,
    async (req, res) => {
        try {
            const movimientos =
                await Transaction.find({
                    usuario: req.usuario.id
                }).sort({
                    createdAt: -1
                });

            return res.status(200).json({
                message:
                    "Movimientos obtenidos correctamente",

                cantidad:
                    movimientos.length,

                movimientos
            });
        } catch (error) {
            console.error(
                "Error obteniendo movimientos:",
                error
            );

            return res.status(500).json({
                message: "Error interno del servidor"
            });
        }
    }
);

// ======================================================
// TRANSFERENCIA
// POST /api/wallet/transfer
// ======================================================

router.post(
    "/transfer",
    verificarToken,
    async (req, res) => {
        const session = await Wallet.startSession();

        try {
            const {
                identificador,
                monto,
                descripcion
            } = req.body;

            // ------------------------------------------
            // IDENTIFICADOR
            // ------------------------------------------

            if (
                !identificador ||
                !identificador.trim()
            ) {
                return res.status(400).json({
                    message:
                        "El correo o número de teléfono del destinatario es obligatorio"
                });
            }

            const identificadorLimpio =
                identificador.trim();

            // ------------------------------------------
            // MONTO
            // ------------------------------------------

            if (
                monto === undefined ||
                monto === null ||
                monto === ""
            ) {
                return res.status(400).json({
                    message: "El monto es obligatorio"
                });
            }

            const montoNumerico = Number(monto);

            if (
                !Number.isFinite(montoNumerico) ||
                montoNumerico <= 0
            ) {
                return res.status(400).json({
                    message:
                        "El monto debe ser un número mayor que 0"
                });
            }

            // ------------------------------------------
            // DESTINATARIO
            // ------------------------------------------

            const destinatario =
                await User.findOne({
                    $or: [
                        {
                            email:
                                identificadorLimpio.toLowerCase()
                        },
                        {
                            telefono:
                                identificadorLimpio
                        }
                    ]
                });

            if (!destinatario) {
                return res.status(404).json({
                    message:
                        "No encontramos una cuenta asociada a ese correo o número de teléfono"
                });
            }

            // ------------------------------------------
            // EVITAR AUTO TRANSFERENCIA
            // ------------------------------------------

            if (
                destinatario._id.toString() ===
                req.usuario.id.toString()
            ) {
                return res.status(400).json({
                    message:
                        "No puedes transferir dinero a tu propia cuenta"
                });
            }

            // ------------------------------------------
            // ESTADO DESTINATARIO
            // ------------------------------------------

            if (
                destinatario.estado !==
                "activo"
            ) {
                return res.status(403).json({
                    message:
                        "La cuenta del destinatario no está activa"
                });
            }

            // ------------------------------------------
            // BILLETERA REMITENTE
            // ------------------------------------------

            const billeteraRemitente =
                await Wallet.findOne({
                    usuario: req.usuario.id
                });

            if (!billeteraRemitente) {
                return res.status(404).json({
                    message:
                        "No se encontró tu billetera"
                });
            }

            // ------------------------------------------
            // BILLETERA DESTINATARIO
            // ------------------------------------------

            const billeteraDestinatario =
                await Wallet.findOne({
                    usuario: destinatario._id
                });

            if (!billeteraDestinatario) {
                return res.status(404).json({
                    message:
                        "El destinatario no tiene una billetera disponible"
                });
            }

            // ------------------------------------------
            // ESTADO BILLETERAS
            // ------------------------------------------

            if (
                billeteraRemitente.estado !==
                "activa"
            ) {
                return res.status(403).json({
                    message:
                        "Tu billetera no está activa"
                });
            }

            if (
                billeteraDestinatario.estado !==
                "activa"
            ) {
                return res.status(403).json({
                    message:
                        "La billetera del destinatario no está activa"
                });
            }

            // ------------------------------------------
            // MONEDA
            // ------------------------------------------

            if (
                billeteraRemitente.moneda !==
                billeteraDestinatario.moneda
            ) {
                return res.status(400).json({
                    message:
                        "Las billeteras utilizan monedas diferentes"
                });
            }

            const saldoAnteriorRemitente =
                billeteraRemitente.saldo;

            const saldoAnteriorDestinatario =
                billeteraDestinatario.saldo;

            const referencia =
                generarReferencia("TRF");

            // ------------------------------------------
            // INICIAR TRANSACCIÓN
            // ------------------------------------------

            session.startTransaction();

            // ------------------------------------------
            // DESCONTAR REMITENTE
            // ------------------------------------------

            const remitenteActualizado =
                await Wallet.findOneAndUpdate(
                    {
                        _id:
                            billeteraRemitente._id,

                        saldo: {
                            $gte:
                                montoNumerico
                        },

                        estado: "activa"
                    },
                    {
                        $inc: {
                            saldo:
                                -montoNumerico
                        }
                    },
                    {
                        new: true,
                        session
                    }
                );

            if (!remitenteActualizado) {
                await session.abortTransaction();

                return res.status(400).json({
                    message:
                        "Saldo insuficiente o la billetera no está activa"
                });
            }

            // ------------------------------------------
            // ACREDITAR DESTINATARIO
            // ------------------------------------------

            const destinatarioActualizado =
                await Wallet.findOneAndUpdate(
                    {
                        _id:
                            billeteraDestinatario._id,

                        estado: "activa"
                    },
                    {
                        $inc: {
                            saldo:
                                montoNumerico
                        }
                    },
                    {
                        new: true,
                        session
                    }
                );

            if (!destinatarioActualizado) {
                throw new Error(
                    "No se pudo acreditar al destinatario"
                );
            }

            // ------------------------------------------
            // CREAR MOVIMIENTO REMITENTE
            // ------------------------------------------

            const [transaccionEnviada] = await Transaction.create(
                [
                    {
                        usuario:
                            req.usuario.id,

                        billetera:
                            billeteraRemitente._id,

                        tipo:
                            "transferencia_enviada",

                        monto:
                            montoNumerico,

                        saldoAnterior:
                            saldoAnteriorRemitente,

                        saldoNuevo:
                            remitenteActualizado.saldo,

                        descripcion:
                            descripcion?.trim() ||
                            `Transferencia a ${destinatario.nombre} ${destinatario.apellido}`,

                        estado:
                            "completada",

                        referencia
                    }
                ],
                {
                    session
                }
            );

            // ------------------------------------------
            // CREAR MOVIMIENTO DESTINATARIO
            // ------------------------------------------

            const [transaccionRecibida] = await Transaction.create(
                [
                    {
                        usuario:
                            destinatario._id,

                        billetera:
                            billeteraDestinatario._id,

                        tipo:
                            "transferencia_recibida",

                        monto:
                            montoNumerico,

                        saldoAnterior:
                            saldoAnteriorDestinatario,

                        saldoNuevo:
                            destinatarioActualizado.saldo,

                        descripcion:
                            descripcion?.trim() ||
                            `Transferencia recibida`,

                        estado:
                            "completada",

                        referencia
                    }
                ],
                {
                    session
                }
            );

            // ------------------------------------------
            // CONFIRMAR
            // ------------------------------------------

            await session.commitTransaction();

            try {
                const remitenteSqlId = await sqlSync.getUsuarioSqlId(req.usuario.id);
                const remitenteBilleteraSqlId = await sqlSync.getBilleteraSqlId(billeteraRemitente._id);

                if (remitenteSqlId && remitenteBilleteraSqlId) {
                    await sqlSync.insertTransaccion(transaccionEnviada, remitenteSqlId, remitenteBilleteraSqlId);
                    await sqlSync.updateSaldoBilletera(billeteraRemitente._id, remitenteActualizado.saldo);
                }

                const destinatarioSqlId = await sqlSync.getUsuarioSqlId(destinatario._id);
                const destinatarioBilleteraSqlId = await sqlSync.getBilleteraSqlId(billeteraDestinatario._id);

                if (destinatarioSqlId && destinatarioBilleteraSqlId) {
                    await sqlSync.insertTransaccion(transaccionRecibida, destinatarioSqlId, destinatarioBilleteraSqlId);
                    await sqlSync.updateSaldoBilletera(billeteraDestinatario._id, destinatarioActualizado.saldo);
                }
            } catch (error) {
                console.error("Error replicando transferencia en SQL Server:", error.message);
            }

            return res.status(201).json({
                message:
                    "Transferencia realizada correctamente",

                transferencia: {
                    monto:
                        montoNumerico,

                    referencia,

                    estado:
                        "completada",

                    destinatario: {
                        nombre:
                            destinatario.nombre,

                        apellido:
                            destinatario.apellido,

                        email:
                            destinatario.email
                    }
                },

                billetera: {
                    id:
                        remitenteActualizado._id,

                    saldoAnterior:
                        saldoAnteriorRemitente,

                    saldoNuevo:
                        remitenteActualizado.saldo,

                    moneda:
                        remitenteActualizado.moneda
                }
            });
        } catch (error) {
            try {
                await session.abortTransaction();
            } catch (abortError) {
                console.error(
                    "Error cancelando transferencia:",
                    abortError
                );
            }

            console.error(
                "Error realizando transferencia:",
                error
            );

            return res.status(500).json({
                message:
                    "No se pudo completar la transferencia"
            });
        } finally {
            await session.endSession();
        }
    }
);

// ======================================================
// CONSULTAR MOVIMIENTO
// GET /api/wallet/transactions/:referencia
// ======================================================

router.get(
    "/transactions/:referencia",
    verificarToken,
    async (req, res) => {
        try {
            const {
                referencia
            } = req.params;

            const transaccion =
                await Transaction.findOne({
                    referencia,
                    usuario:
                        req.usuario.id
                });

            if (!transaccion) {
                return res.status(404).json({
                    message:
                        "Movimiento no encontrado"
                });
            }

            return res.status(200).json({
                message:
                    "Movimiento obtenido correctamente",

                movimiento:
                    transaccion
            });
        } catch (error) {
            console.error(
                "Error obteniendo movimiento:",
                error
            );

            return res.status(500).json({
                message:
                    "Error interno del servidor"
            });
        }
    }
);

// ======================================================
// COMPROBANTE
// GET /api/wallet/transactions/:referencia/receipt
// ======================================================

router.get(
    "/transactions/:referencia/receipt",
    verificarToken,
    async (req, res) => {
        try {
            const {
                referencia
            } = req.params;

            const transaccion =
                await Transaction.findOne({
                    referencia,
                    usuario:
                        req.usuario.id
                });

            if (!transaccion) {
                return res.status(404).json({
                    message:
                        "Comprobante no encontrado"
                });
            }

            return res.status(200).json({
                message:
                    "Comprobante obtenido correctamente",

                comprobante: {
                    tipo:
                        transaccion.tipo.toUpperCase(),

                    estado:
                        transaccion.estado.toUpperCase(),

                    referencia:
                        transaccion.referencia,

                    monto:
                        transaccion.monto,

                    moneda:
                        transaccion.billetera?.moneda ||
                        "COP",

                    saldoAnterior:
                        transaccion.saldoAnterior,

                    saldoNuevo:
                        transaccion.saldoNuevo,

                    descripcion:
                        transaccion.descripcion,

                    fecha:
                        transaccion.createdAt
                }
            });
        } catch (error) {
            console.error(
                "Error obteniendo comprobante:",
                error
            );

            return res.status(500).json({
                message:
                    "Error interno del servidor"
            });
        }
    }
);

module.exports = router;