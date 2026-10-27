const nodemailer = require("nodemailer");

let transporter;

const validateConfiguration = () => {
    const port = Number(process.env.SMTP_PORT);

    if (
        !process.env.SMTP_HOST ||
        !Number.isInteger(port) ||
        port < 1 ||
        port > 65535 ||
        !process.env.SMTP_USER ||
        !process.env.SMTP_PASSWORD ||
        !process.env.MAIL_FROM
    ) {
        throw new Error("La configuración SMTP está incompleta");
    }

    if (!process.env.FRONTEND_URL) {
        throw new Error("FRONTEND_URL no está configurada");
    }

    let frontendUrl;

    try {
        frontendUrl = new URL(process.env.FRONTEND_URL);
    } catch {
        throw new Error("FRONTEND_URL no es válida");
    }

    if (!["http:", "https:"].includes(frontendUrl.protocol)) {
        throw new Error("FRONTEND_URL debe usar HTTP o HTTPS");
    }

    return { port, frontendUrl };
};

const getTransporter = (port) => {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port,
            secure: process.env.SMTP_SECURE === "true",
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD
            }
        });
    }

    return transporter;
};

const escapeHtml = (value) =>
    value.replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;"
    })[character]);

const sendPasswordResetEmail = async ({ email, name, token }) => {
    const { port, frontendUrl } = validateConfiguration();
    frontendUrl.hash = `/restablecer-clave?token=${encodeURIComponent(token)}`;

    const resetUrl = frontendUrl.toString();
    const safeName = escapeHtml(name || "cliente");
    const safeUrl = escapeHtml(resetUrl);

    await getTransporter(port).sendMail({
        from: process.env.MAIL_FROM,
        to: email,
        subject: "Restablece tu contraseña de PagaYA",
        text: [
            `Hola ${name || "cliente"},`,
            "",
            "Recibimos una solicitud para cambiar la contraseña de tu cuenta de PagaYA.",
            `Usa este enlace dentro de los próximos 30 minutos: ${resetUrl}`,
            "",
            "Si no solicitaste este cambio, puedes ignorar este mensaje."
        ].join("\n"),
        html: `
            <div style="font-family:Arial,sans-serif;color:#283442;line-height:1.6;max-width:560px;margin:0 auto">
                <h1 style="color:#087f5b;font-size:22px">PagaYA</h1>
                <p>Hola ${safeName},</p>
                <p>Recibimos una solicitud para cambiar la contraseña de tu cuenta.</p>
                <p style="margin:28px 0">
                    <a href="${safeUrl}" style="background:#087f5b;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold">
                        Restablecer contraseña
                    </a>
                </p>
                <p>El enlace vence en 30 minutos y solo se puede usar una vez.</p>
                <p>Si no solicitaste este cambio, ignora este correo. Tu contraseña no cambiará.</p>
            </div>
        `
    });
};

module.exports = {
    sendPasswordResetEmail,
    validateConfiguration
};
