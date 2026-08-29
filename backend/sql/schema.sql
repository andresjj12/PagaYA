-- ======================================================
-- ESQUEMA PagaYA - Azure SQL Database
-- Tablas espejo de MongoDB (Usuarios, Billeteras, Transacciones)
-- ======================================================

IF OBJECT_ID('dbo.Usuarios', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Usuarios (
        id INT IDENTITY(1,1) PRIMARY KEY,
        mongo_id NVARCHAR(24) NOT NULL UNIQUE,
        nombre NVARCHAR(100) NOT NULL,
        apellido NVARCHAR(100) NOT NULL,
        email NVARCHAR(150) NOT NULL,
        telefono NVARCHAR(30) NOT NULL,
        password NVARCHAR(255) NOT NULL,
        rol NVARCHAR(20) NOT NULL,
        estado NVARCHAR(20) NOT NULL,
        created_at DATETIME2 NOT NULL,
        updated_at DATETIME2 NOT NULL
    );
END
GO

IF OBJECT_ID('dbo.Billeteras', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Billeteras (
        id INT IDENTITY(1,1) PRIMARY KEY,
        mongo_id NVARCHAR(24) NOT NULL UNIQUE,
        usuario_id INT NOT NULL,
        saldo DECIMAL(18,2) NOT NULL,
        moneda NVARCHAR(10) NOT NULL,
        estado NVARCHAR(20) NOT NULL,
        created_at DATETIME2 NOT NULL,
        updated_at DATETIME2 NOT NULL,
        CONSTRAINT FK_Billeteras_Usuarios
            FOREIGN KEY (usuario_id) REFERENCES dbo.Usuarios(id)
    );
END
GO

IF OBJECT_ID('dbo.Transacciones', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Transacciones (
        id INT IDENTITY(1,1) PRIMARY KEY,
        mongo_id NVARCHAR(24) NOT NULL,
        usuario_id INT NOT NULL,
        billetera_id INT NOT NULL,
        tipo NVARCHAR(30) NOT NULL,
        monto DECIMAL(18,2) NOT NULL,
        saldo_anterior DECIMAL(18,2) NOT NULL,
        saldo_nuevo DECIMAL(18,2) NOT NULL,
        descripcion NVARCHAR(250) NULL,
        estado NVARCHAR(20) NOT NULL,
        referencia NVARCHAR(100) NULL,
        created_at DATETIME2 NOT NULL,
        updated_at DATETIME2 NOT NULL,
        CONSTRAINT FK_Transacciones_Usuarios
            FOREIGN KEY (usuario_id) REFERENCES dbo.Usuarios(id),
        CONSTRAINT FK_Transacciones_Billeteras
            FOREIGN KEY (billetera_id) REFERENCES dbo.Billeteras(id)
    );
END
GO
