-- ========================================
-- FASE 2: AUTENTICACIÓN Y USUARIOS
-- ========================================

-- 1. Crear tabla de usuarios de la aplicación
-- Vincula usuarios de Supabase Auth (auth.users) con organizaciones
CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member', -- 'admin' o 'member'
  full_name TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP
);

-- 2. Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_app_users_organization_id ON app_users(organization_id);
CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users(email);

-- 3. Row Level Security
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de seguridad para app_users
-- Los usuarios solo pueden ver usuarios de su propia organización
CREATE POLICY "Users can view users in their org"
ON app_users FOR SELECT
USING (
  organization_id = (
    SELECT organization_id 
    FROM app_users 
    WHERE id = auth.uid()
  )
);

-- Los usuarios solo pueden actualizar su propio registro
CREATE POLICY "Users can update their own data"
ON app_users FOR UPDATE
USING (id = auth.uid());

-- Solo admins pueden insertar nuevos usuarios en su organización
CREATE POLICY "Admins can insert users in their org"
ON app_users FOR INSERT
WITH CHECK (
  organization_id = (
    SELECT organization_id 
    FROM app_users 
    WHERE id = auth.uid() AND role = 'admin'
  )
  OR NOT EXISTS (SELECT 1 FROM app_users WHERE id = auth.uid()) -- Permite el primer usuario
);

-- 5. Actualizar políticas de profiles para usar auth
DROP POLICY IF EXISTS "Allow all for profiles" ON profiles;

CREATE POLICY "Users can view profiles in their org"
ON profiles FOR SELECT
USING (
  organization_id = (
    SELECT organization_id 
    FROM app_users 
    WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can manage profiles in their org"
ON profiles FOR ALL
USING (
  organization_id = (
    SELECT organization_id 
    FROM app_users 
    WHERE id = auth.uid()
  )
)
WITH CHECK (
  organization_id = (
    SELECT organization_id 
    FROM app_users 
    WHERE id = auth.uid()
  )
);

-- 6. Actualizar políticas de recordings para usar auth
DROP POLICY IF EXISTS "Allow all for recordings" ON recordings;

CREATE POLICY "Users can view recordings in their org"
ON recordings FOR SELECT
USING (
  organization_id = (
    SELECT organization_id 
    FROM app_users 
    WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can manage recordings in their org"
ON recordings FOR ALL
USING (
  organization_id = (
    SELECT organization_id 
    FROM app_users 
    WHERE id = auth.uid()
  )
)
WITH CHECK (
  organization_id = (
    SELECT organization_id 
    FROM app_users 
    WHERE id = auth.uid()
  )
);

-- 7. Función auxiliar para obtener el organization_id del usuario actual
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT organization_id 
    FROM app_users 
    WHERE id = auth.uid()
  );
END;
$$;

-- ========================================
-- LISTO: Base de datos preparada para Auth
-- ========================================
