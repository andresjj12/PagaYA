const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User");

const login = async (req, res) => {
    try {
        const {
            email,
            password
        } = req.body;

        // ==========================================
        // VALIDAR CAMPOS
        // ==========================================

        if (!email || !password) {
            return res.status(400).json({
                message:
                    "El correo y la contraseña son obligatorios"
            });
        }

        const emailLimpio =
            email.trim().toLowerCase();

        // ==========================================
        // BUSCAR USUARIO
        // ==========================================

        const usuario =
            await User.findOne({
                email: emailLimpio
            });

        if (!usuario) {
            return res.status(401).json({
                message:
                    "Credenciales incorrectas"
            });
        }

        // ==========================================
        // CONTRASEÑA
        // ==========================================

        const passwordCorrecta =
            await bcrypt.compare(
                password,
                usuario.password
            );

        if (!passwordCorrecta) {
            return res.status(401).json({
                message:
                    "Credenciales incorrectas"
            });
        }

        // ==========================================
        // ESTADO
        // ==========================================

        if (
            usuario.estado !==
            "activo"
        ) {
            return res.status(403).json({
                message:
                    "El usuario se encuentra inactivo"
            });
        }

        // ==========================================
        // JWT
        // ==========================================

        const token =
            jwt.sign(
                {
                    id:
                        usuario._id,

                    email:
                        usuario.email,

                    rol:
                        usuario.rol
                },

                process.env.JWT_SECRET,

                {
                    expiresIn:
                        process.env.JWT_EXPIRES_IN ||
                        "8h"
                }
            );

        // ==========================================
        // RESPUESTA
        // ==========================================

        return res.status(200).json({
            message:
                "Inicio de sesión exitoso",

            token,

            usuario: {
                id:
                    usuario._id,

                nombre:
                    usuario.nombre,

                apellido:
                    usuario.apellido,

                email:
                    usuario.email,

                telefono:
                    usuario.telefono,

                rol:
                    usuario.rol,

                estado:
                    usuario.estado
            }
        });
    } catch (error) {
        console.error(
            "Error en login:",
            error
        );

        return res.status(500).json({
            message:
                "Error interno del servidor"
        });
    }
};

module.exports = {
    login
};