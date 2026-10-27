/**
 * Rutas de autenticación de la app.
 * Aquí se crean usuarios, se valida el login y se devuelve el JWT
 * para proteger las rutas de billetera y transacciones.
 */
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { rateLimit } = require("express-rate-limit");

const User = require("../models/User");
const Wallet = require("../models/Wallet");
const verificarToken = require("../middleware/auth.middleware");
const sqlSync = require("../services/sqlSync");
const passwordResetEmail = require("../services/passwordResetEmail");

const router = express.Router();

const passwordResetRequestLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
        message: "Demasiadas solicitudes. Intenta de nuevo más tarde."
    }
});

const passwordResetCompletionLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
        message: "Demasiados intentos. Solicita un enlace nuevo más tarde."
    }
});

const passwordResetAcceptedMessage =
    "Si el correo está registrado, recibirás instrucciones para restablecer tu contraseña.";

// ======================================================
// SOLICITAR RESTABLECIMIENTO DE CONTRASEÑA
// POST /api/auth/forgot-password
// ======================================================

router.post(
    "/forgot-password",
    passwordResetRequestLimit,
    async (req, res) => {
        const { email } = req.body || {};

        if (
            typeof email !== "string" ||
            email.length > 254 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
        ) {
            return res.status(400).json({
                message: "Ingresa un correo electrónico válido"
            });
        }

        try {
            passwordResetEmail.validateConfiguration();
        } catch (error) {
            console.error("Servicio de recuperación no configurado:", error.message);
            return res.status(503).json({
                message: "El servicio de recuperación no está disponible. Contacta al administrador."
            });
        }

        try {
            const usuario = await User.findOne({
                email: email.trim().toLowerCase()
            });

            if (!usuario) {
                return res.status(200).json({
                    message: passwordResetAcceptedMessage
                });
            }

            const token = crypto.randomBytes(32).toString("hex");
            const tokenHash = crypto
                .createHash("sha256")
                .update(token)
                .digest("hex");

            usuario.passwordResetTokenHash = tokenHash;
            usuario.passwordResetExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
            await usuario.save();

            try {
                await passwordResetEmail.sendPasswordResetEmail({
                    email: usuario.email,
                    name: usuario.nombre,
                    token
                });
            } catch (error) {
                console.error("Error enviando correo de recuperación:", error.message);

                try {
                    await User.updateOne(
                        {
                            _id: usuario._id,
                            passwordResetTokenHash: tokenHash
                        },
                        {
                            $unset: {
                                passwordResetTokenHash: 1,
                                passwordResetExpiresAt: 1
                            }
                        }
                    );
                } catch (cleanupError) {
                    console.error(
                        "Error limpiando token de recuperación no enviado:",
                        cleanupError.message
                    );
                }

                return res.status(503).json({
                    message: "No fue posible enviar el correo. Intenta de nuevo más tarde."
                });
            }

            return res.status(200).json({
                message: passwordResetAcceptedMessage
            });
        } catch (error) {
            console.error("Error solicitando recuperación de contraseña:", error);
            return res.status(500).json({
                message: "No fue posible procesar la solicitud"
            });
        }
    }
);

// ======================================================
// CAMBIAR CONTRASEÑA CON TOKEN
// POST /api/auth/reset-password
// ======================================================

router.post("/reset-password", passwordResetCompletionLimit, async (req, res) => {
    const { token, password } = req.body || {};

    if (typeof token !== "string" || !/^[a-f0-9]{64}$/i.test(token)) {
        return res.status(400).json({
            message: "El enlace no es válido. Solicita uno nuevo."
        });
    }

    if (
        typeof password !== "string" ||
        password.length < 8 ||
        Buffer.byteLength(password, "utf8") > 72
    ) {
        return res.status(400).json({
            message: "La contraseña debe tener al menos 8 caracteres y no superar 72 bytes."
        });
    }

    try {
        const tokenHash = crypto
            .createHash("sha256")
            .update(token)
            .digest("hex");
        const passwordHash = await bcrypt.hash(password, 12);
        const usuario = await User.findOneAndUpdate(
            {
                passwordResetTokenHash: tokenHash,
                passwordResetExpiresAt: { $gt: new Date() }
            },
            {
                $set: { password: passwordHash },
                $unset: {
                    passwordResetTokenHash: 1,
                    passwordResetExpiresAt: 1
                }
            },
            {
                new: false,
                runValidators: true
            }
        );

        if (!usuario) {
            return res.status(400).json({
                message: "El enlace venció o ya fue utilizado. Solicita uno nuevo."
            });
        }

        return res.status(200).json({
            message: "Tu contraseña se actualizó correctamente"
        });
    } catch (error) {
        console.error("Error restableciendo contraseña:", error);
        return res.status(500).json({
            message: "No fue posible actualizar la contraseña"
        });
    }
});

// ======================================================
// REGISTRO DE USUARIO
// POST /api/auth/register
// ======================================================

router.post("/register", async (req, res) => {
    try {
        const {
            nombre,
            apellido,
            email,
            telefono,
            password
        } = req.body;

        // --------------------------------------------------
        // 1. Validar campos obligatorios
        // --------------------------------------------------

        if (!nombre || !apellido || !email || !telefono || !password) {
            return res.status(400).json({
                message: "Todos los campos son obligatorios"
            });
        }

        // --------------------------------------------------
        // 2. Validar contraseña
        // --------------------------------------------------

        if (password.length < 8) {
            return res.status(400).json({
                message: "La contraseña debe tener mínimo 8 caracteres"
            });
        }

        // --------------------------------------------------
        // 3. Normalizar correo
        // --------------------------------------------------

        const emailNormalizado = email.trim().toLowerCase();

        // --------------------------------------------------
        // 4. Comprobar si el correo ya existe
        // --------------------------------------------------

        const usuarioExistente = await User.findOne({
            email: emailNormalizado
        });

        if (usuarioExistente) {
            return res.status(409).json({
                message: "El correo electrónico ya está registrado"
            });
        }

        // --------------------------------------------------
        // 5. Encriptar contraseña
        // --------------------------------------------------

        const passwordHash = await bcrypt.hash(password, 12);

        // --------------------------------------------------
        // 6. Crear usuario
        // --------------------------------------------------

        const usuario = await User.create({
            nombre: nombre.trim(),
            apellido: apellido.trim(),
            email: emailNormalizado,
            telefono: telefono.trim(),
            password: passwordHash
        });

        // --------------------------------------------------
        // 7. Crear billetera automáticamente
        // --------------------------------------------------

        const billetera = await Wallet.create({
            usuario: usuario._id,
            saldo: 0,
            moneda: "COP",
            estado: "activa"
        });

        // --------------------------------------------------
        // 8. Espejar en SQL Server (best-effort)
        // --------------------------------------------------

        try {
            const usuarioSqlId = await sqlSync.insertUsuario(usuario);
            await sqlSync.insertBilletera(billetera, usuarioSqlId);
        } catch (error) {
            console.error(
                "Error replicando registro en SQL Server:",
                error.message
            );
        }

        // --------------------------------------------------
        // 9. Respuesta
        // --------------------------------------------------

        return res.status(201).json({
            message: "Usuario registrado correctamente",

            usuario: {
                id: usuario._id,
                nombre: usuario.nombre,
                apellido: usuario.apellido,
                email: usuario.email,
                telefono: usuario.telefono,
                rol: usuario.rol,
                estado: usuario.estado
            },

            billetera: {
                id: billetera._id,
                saldo: billetera.saldo,
                moneda: billetera.moneda,
                estado: billetera.estado
            }
        });

    } catch (error) {
        console.error("Error registrando usuario:", error);

        return res.status(500).json({
            message: "Error interno del servidor"
        });
    }
});


// ======================================================
// LOGIN DE USUARIO
// POST /api/auth/login
// ======================================================

router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        // --------------------------------------------------
        // 1. Validar campos
        // --------------------------------------------------

        if (!email || !password) {
            return res.status(400).json({
                message: "El correo y la contraseña son obligatorios"
            });
        }

        // --------------------------------------------------
        // 2. Normalizar correo
        // --------------------------------------------------

        const emailNormalizado = email.trim().toLowerCase();

        // --------------------------------------------------
        // 3. Buscar usuario
        // --------------------------------------------------

        const usuario = await User.findOne({
            email: emailNormalizado
        });

        if (!usuario) {
            return res.status(401).json({
                message: "Credenciales incorrectas"
            });
        }

        // --------------------------------------------------
        // 4. Verificar contraseña
        // --------------------------------------------------

        const passwordCorrecta = await bcrypt.compare(
            password,
            usuario.password
        );

        if (!passwordCorrecta) {
            return res.status(401).json({
                message: "Credenciales incorrectas"
            });
        }

        // --------------------------------------------------
        // 5. Verificar estado del usuario
        // --------------------------------------------------

        if (usuario.estado !== "activo") {
            return res.status(403).json({
                message: "El usuario se encuentra inactivo"
            });
        }

        // --------------------------------------------------
        // 6. Verificar JWT_SECRET
        // --------------------------------------------------

        if (!process.env.JWT_SECRET) {
            console.error("JWT_SECRET no está configurado");

            return res.status(500).json({
                message: "Configuración de seguridad incompleta"
            });
        }

        // --------------------------------------------------
        // 7. Crear JWT
        // --------------------------------------------------

        const token = jwt.sign(
            {
                id: usuario._id.toString(),
                email: usuario.email,
                rol: usuario.rol
            },
            process.env.JWT_SECRET,
            {
                expiresIn: process.env.JWT_EXPIRES_IN || "8h"
            }
        );

        // --------------------------------------------------
        // 8. Buscar billetera
        // --------------------------------------------------

        const billetera = await Wallet.findOne({
            usuario: usuario._id
        });

        // --------------------------------------------------
        // 9. Respuesta
        // --------------------------------------------------

        return res.status(200).json({
            message: "Inicio de sesión exitoso",

            token,

            usuario: {
                id: usuario._id,
                nombre: usuario.nombre,
                apellido: usuario.apellido,
                email: usuario.email,
                telefono: usuario.telefono,
                rol: usuario.rol,
                estado: usuario.estado
            },

            billetera: billetera
                ? {
                    id: billetera._id,
                    saldo: billetera.saldo,
                    moneda: billetera.moneda,
                    estado: billetera.estado
                }
                : null
        });

    } catch (error) {
        console.error("Error en login:", error);

        return res.status(500).json({
            message: "Error interno del servidor"
        });
    }
});


// ======================================================
// PERFIL DEL USUARIO AUTENTICADO
// GET /api/auth/profile
// ======================================================

router.get("/profile", verificarToken, async (req, res) => {
    try {

        // --------------------------------------------------
        // 1. Buscar usuario
        // --------------------------------------------------

        const usuario = await User.findById(req.usuario.id)
            .select("-password");

        if (!usuario) {
            return res.status(404).json({
                message: "Usuario no encontrado"
            });
        }

        // --------------------------------------------------
        // 2. Buscar billetera
        // --------------------------------------------------

        const billetera = await Wallet.findOne({
            usuario: usuario._id
        });

        // --------------------------------------------------
        // 3. Respuesta
        // --------------------------------------------------

        return res.status(200).json({
            message: "Perfil obtenido correctamente",

            usuario,

            billetera: billetera
                ? {
                    id: billetera._id,
                    saldo: billetera.saldo,
                    moneda: billetera.moneda,
                    estado: billetera.estado
                }
                : null
        });

    } catch (error) {
        console.error("Error obteniendo perfil:", error);

        return res.status(500).json({
            message: "Error interno del servidor"
        });
    }
});


module.exports = router;