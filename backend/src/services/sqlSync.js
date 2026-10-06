/**
 * Replica parte del estado de MongoDB en SQL Server.
 * Esto sirve para tener un segundo sistema de almacenamiento para
 * reporting y consistencia, aunque MongoDB sigue siendo la fuente
 * de verdad de la aplicación.
 */
const { sql, getSQLPool } = require("../config/sqlserver");

// ======================================================
// ESPEJO SQL SERVER (Azure)
// Cada función replica en SQL una operación ya realizada
// en MongoDB. MongoDB es la fuente de verdad.
// ======================================================

// ======================================================
// INSERTAR USUARIO
// ======================================================

async function insertUsuario(usuario) {
    const pool = getSQLPool();
    const request = new sql.Request(pool);

    request.input("mongo_id", sql.NVarChar(24), usuario._id.toString());
    request.input("nombre", sql.NVarChar(100), usuario.nombre);
    request.input("apellido", sql.NVarChar(100), usuario.apellido);
    request.input("email", sql.NVarChar(150), usuario.email);
    request.input("telefono", sql.NVarChar(30), usuario.telefono);
    request.input("password", sql.NVarChar(255), usuario.password);
    request.input("rol", sql.NVarChar(20), usuario.rol);
    request.input("estado", sql.NVarChar(20), usuario.estado);
    request.input("created_at", sql.DateTime2, usuario.createdAt);
    request.input("updated_at", sql.DateTime2, usuario.updatedAt);

    const result = await request.query(`
        INSERT INTO dbo.Usuarios (
            mongo_id,
            nombre,
            apellido,
            email,
            telefono,
            password,
            rol,
            estado,
            created_at,
            updated_at
        )
        OUTPUT INSERTED.id
        VALUES (
            @mongo_id,
            @nombre,
            @apellido,
            @email,
            @telefono,
            @password,
            @rol,
            @estado,
            @created_at,
            @updated_at
        );
    `);

    return result.recordset[0].id;
}

// ======================================================
// INSERTAR BILLETERA
// ======================================================

async function insertBilletera(billetera, usuarioSqlId) {
    const pool = getSQLPool();
    const request = new sql.Request(pool);

    request.input("mongo_id", sql.NVarChar(24), billetera._id.toString());
    request.input("usuario_id", sql.Int, usuarioSqlId);
    request.input("saldo", sql.Decimal(18, 2), billetera.saldo);
    request.input("moneda", sql.NVarChar(10), billetera.moneda);
    request.input("estado", sql.NVarChar(20), billetera.estado);
    request.input("created_at", sql.DateTime2, billetera.createdAt);
    request.input("updated_at", sql.DateTime2, billetera.updatedAt);

    const result = await request.query(`
        INSERT INTO dbo.Billeteras (
            mongo_id,
            usuario_id,
            saldo,
            moneda,
            estado,
            created_at,
            updated_at
        )
        OUTPUT INSERTED.id
        VALUES (
            @mongo_id,
            @usuario_id,
            @saldo,
            @moneda,
            @estado,
            @created_at,
            @updated_at
        );
    `);

    return result.recordset[0].id;
}

// ======================================================
// INSERTAR TRANSACCIÓN
// ======================================================

async function insertTransaccion(transaccion, usuarioSqlId, billeteraSqlId) {
    const pool = getSQLPool();
    const request = new sql.Request(pool);

    request.input("mongo_id", sql.NVarChar(24), transaccion._id.toString());
    request.input("usuario_id", sql.Int, usuarioSqlId);
    request.input("billetera_id", sql.Int, billeteraSqlId);
    request.input("tipo", sql.NVarChar(30), transaccion.tipo);
    request.input("monto", sql.Decimal(18, 2), transaccion.monto);
    request.input("saldo_anterior", sql.Decimal(18, 2), transaccion.saldoAnterior);
    request.input("saldo_nuevo", sql.Decimal(18, 2), transaccion.saldoNuevo);
    request.input("descripcion", sql.NVarChar(250), transaccion.descripcion || null);
    request.input("estado", sql.NVarChar(20), transaccion.estado);
    request.input("referencia", sql.NVarChar(100), transaccion.referencia || null);
    request.input("created_at", sql.DateTime2, transaccion.createdAt);
    request.input("updated_at", sql.DateTime2, transaccion.updatedAt);

    await request.query(`
        INSERT INTO dbo.Transacciones (
            mongo_id,
            usuario_id,
            billetera_id,
            tipo,
            monto,
            saldo_anterior,
            saldo_nuevo,
            descripcion,
            estado,
            referencia,
            created_at,
            updated_at
        )
        VALUES (
            @mongo_id,
            @usuario_id,
            @billetera_id,
            @tipo,
            @monto,
            @saldo_anterior,
            @saldo_nuevo,
            @descripcion,
            @estado,
            @referencia,
            @created_at,
            @updated_at
        );
    `);
}

// ======================================================
// ACTUALIZAR SALDO DE BILLETERA
// ======================================================

async function updateSaldoBilletera(mongoId, saldoNuevo) {
    const pool = getSQLPool();
    const request = new sql.Request(pool);

    request.input("mongo_id", sql.NVarChar(24), mongoId.toString());
    request.input("saldo", sql.Decimal(18, 2), saldoNuevo);
    request.input("updated_at", sql.DateTime2, new Date());

    await request.query(`
        UPDATE dbo.Billeteras
        SET saldo = @saldo,
            updated_at = @updated_at
        WHERE mongo_id = @mongo_id;
    `);
}

// ======================================================
// BUSCAR ID SQL DE USUARIO POR MONGO_ID
// ======================================================

async function getUsuarioSqlId(mongoId) {
    const pool = getSQLPool();
    const request = new sql.Request(pool);

    request.input("mongo_id", sql.NVarChar(24), mongoId.toString());

    const result = await request.query(`
        SELECT id FROM dbo.Usuarios WHERE mongo_id = @mongo_id;
    `);

    return result.recordset.length
        ? result.recordset[0].id
        : null;
}

// ======================================================
// BUSCAR ID SQL DE BILLETERA POR MONGO_ID
// ======================================================

async function getBilleteraSqlId(mongoId) {
    const pool = getSQLPool();
    const request = new sql.Request(pool);

    request.input("mongo_id", sql.NVarChar(24), mongoId.toString());

    const result = await request.query(`
        SELECT id FROM dbo.Billeteras WHERE mongo_id = @mongo_id;
    `);

    return result.recordset.length
        ? result.recordset[0].id
        : null;
}

module.exports = {
    insertUsuario,
    insertBilletera,
    insertTransaccion,
    updateSaldoBilletera,
    getUsuarioSqlId,
    getBilleteraSqlId
};
