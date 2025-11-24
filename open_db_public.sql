-- ============================================================
-- MODO PÚBLICO: ELIMINAR BARRERAS DE AUTENTICACIÓN
-- ============================================================

-- 1. Habilitar acceso a la tabla 'organizations' para todos (anon)
DROP POLICY IF EXISTS "Allow authenticated to read organizations" ON organizations;
DROP POLICY IF EXISTS "Allow authenticated to insert organizations" ON organizations;
DROP POLICY IF EXISTS "Public read organizations" ON organizations;
DROP POLICY IF EXISTS "Public insert organizations" ON organizations;

CREATE POLICY "Public read organizations"
ON organizations FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Public insert organizations"
ON organizations FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- 2. Habilitar acceso a 'profiles' para todos
DROP POLICY IF EXISTS "Allow authenticated to manage profiles" ON profiles;
DROP POLICY IF EXISTS "Public manage profiles" ON profiles;

CREATE POLICY "Public manage profiles"
ON profiles FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- 3. Habilitar acceso a 'recordings' para todos
DROP POLICY IF EXISTS "Allow authenticated to manage recordings" ON recordings;
DROP POLICY IF EXISTS "Public manage recordings" ON recordings;

CREATE POLICY "Public manage recordings"
ON recordings FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- 4. Insertar una Organización Pública por defecto (si no existe)
INSERT INTO organizations (id, name, created_at)
VALUES ('00000000-0000-0000-0000-000000000000', 'Organización Pública', NOW())
ON CONFLICT (id) DO NOTHING;
