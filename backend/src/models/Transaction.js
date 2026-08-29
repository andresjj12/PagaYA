const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
    {
        usuario: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        billetera: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Wallet",
            required: true
        },

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

        monto: {
            type: Number,
            required: true,
            min: 0.01
        },

        saldoAnterior: {
            type: Number,
            required: true,
            min: 0
        },

        saldoNuevo: {
            type: Number,
            required: true,
            min: 0
        },

        descripcion: {
            type: String,
            trim: true,
            maxlength: 250
        },

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

        referencia: {
            type: String,
            trim: true,
            index: true
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