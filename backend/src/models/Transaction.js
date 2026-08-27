const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
    {
        // Usuario propietario del movimiento
        usuario: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        // Billetera relacionada
        billetera: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Wallet",
            required: true
        },

        // Tipo de operación
        tipo: {
            type: String,
            enum: [
                "ingreso",
                "pago",
                "transferencia_enviada",
                "transferencia_recibida",
                "retiro",
                "recarga"
            ],
            required: true
        },

        // Valor de la operación
        monto: {
            type: Number,
            required: true,
            min: 0.01
        },

        // Saldo antes de la operación
        saldoAnterior: {
            type: Number,
            required: true,
            min: 0
        },

        // Saldo después de la operación
        saldoNuevo: {
            type: Number,
            required: true,
            min: 0
        },

        // Descripción del movimiento
        descripcion: {
            type: String,
            trim: true,
            maxlength: 250
        },

        // Estado de la operación
        estado: {
            type: String,
            enum: [
                "pendiente",
                "completada",
                "cancelada",
                "rechazada"
            ],
            default: "completada"
        },

        // Referencia única de la operación
        referencia: {
            type: String,
            unique: true,
            sparse: true
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model(
    "Transaction",
    transactionSchema
);