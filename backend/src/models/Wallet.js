/**
 * Representa la billetera de cada usuario.
 * Es el saldo principal de la app y el punto central de las
 * recargas, pagos y transferencias.
 */
const mongoose = require("mongoose");

const walletSchema = new mongoose.Schema(
    {
        usuario: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true
        },

        saldo: {
            type: Number,
            default: 0,
            min: 0
        },

        moneda: {
            type: String,
            default: "COP"
        },

        estado: {
            type: String,
            enum: ["activa", "bloqueada", "inactiva"],
            default: "activa"
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Wallet", walletSchema);