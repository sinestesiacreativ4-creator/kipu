-- ============================================================
-- SOLUCIÓN TEMPORAL: POLÍTICAS PERMISIVAS PARA DESARROLLO
-- ============================================================
-- Este script hace las políticas RLS muy permisivas temporalmente
-- para permitir que el registro y login funcionen sin problemas.
-- Una vez que todo funcione, puedes aplicar políticas más estrictas.

-- 1. ELIMINAR TODAS las políticas existentes de app_users
DROP POLICY IF EXISTS "Users can view users in their org" ON app_users;
DROP POLICY IF EXISTS "Users can update their own data" ON app_users;
DROP POLICY IF EXISTS "Admins can insert users in their org" ON app_users;

-- 2. CREAR políticas PERMISIVAS temporales para app_users
-- Permitir a cualquier usuario autenticado leer cualquier fila de app_users
CREATE POLICY "Allow authenticated users to read app_users"
ON app_users FOR SELECT
TO authenticated
USING (true);

-- Permitir a cualquier usuario autenticado insertar en app_users
-- (necesario para el registro)
CREATE POLICY "Allow authenticated users to insert app_users"
ON app_users FOR INSERT
TO authenticated
WITH CHECK (true);

-- Permitir a usuarios actualizar su propia fila
CREATE POLICY "Allow users to update their own app_user"
ON app_users FOR UPDATE
TO authenticated
USING (id = auth.uid());

-- 3. ASEGURAR que organizations también sea permisiva
DROP POLICY IF EXISTS "Allow all for organizations" ON organizations;

CREATE POLICY "Allow authenticated to read organizations"
ON organizations FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated to insert organizations"
ON organizations FOR INSERT
TO authenticated
WITH CHECK (true);

-- 4. ASEGURAR que profiles y recordings también sean permisivas
DROP POLICY IF EXISTS "Users can view profiles in their org" ON profiles;
DROP POLICY IF EXISTS "Users can manage profiles in their org" ON profiles;

CREATE POLICY "Allow authenticated to manage profiles"
ON profiles FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view recordings in their org" ON recordings;
DROP POLICY IF EXISTS "Users can manage recordings in their org" ON recordings;

CREATE POLICY "Allow authenticated to manage recordings"
ON recordings FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ============================================================
-- LISTO: Ahora las políticas son permisivas y no bloquearán
-- el registro ni el acceso a datos.
-- ============================================================
