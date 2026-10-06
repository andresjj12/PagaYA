/**
 * Conecta la app con MongoDB.
 * Si la conexión falla, la API no debería seguir con la ejecución
 * porque la mayoría de los datos de negocio viven ahí.
 */
const mongoose = require("mongoose");

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 5000
        });

        console.log("MongoDB conectado correctamente");
    } catch (error) {
        console.error("Error conectando a MongoDB:", error.message);
        process.exit(1);
    }
};

module.exports = connectDB;