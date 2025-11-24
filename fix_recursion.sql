-- ============================================================
-- CORRECCIÓN DE ERROR DE RECURSIÓN INFINITA (RLS)
-- ============================================================

-- 1. Asegurar que la función auxiliar existe y es segura (SECURITY DEFINER)
-- Esto permite leer la organización del usuario saltándose las políticas RLS
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT organization_id 
    FROM app_users 
    WHERE id = auth.uid()
  );
END;
$$;

-- 2. Eliminar la política que causa el bucle infinito
DROP POLICY IF EXISTS "Users can view users in their org" ON app_users;

-- 3. Crear la política corregida
-- Permite ver tu propio usuario (condición base) O usuarios de tu misma org (usando la función segura)
CREATE POLICY "Users can view users in their org"
ON app_users FOR SELECT
USING (
  id = auth.uid() 
  OR 
  organization_id = get_user_org_id()
);

-- 4. Corregir también las otras políticas para usar la función segura y mejorar rendimiento

-- Profiles
DROP POLICY IF EXISTS "Users can view profiles in their org" ON profiles;
CREATE POLICY "Users can view profiles in their org"
ON profiles FOR SELECT
USING ( organization_id = get_user_org_id() );

DROP POLICY IF EXISTS "Users can manage profiles in their org" ON profiles;
CREATE POLICY "Users can manage profiles in their org"
ON profiles FOR ALL
USING ( organization_id = get_user_org_id() )
WITH CHECK ( organization_id = get_user_org_id() );

-- Recordings
DROP POLICY IF EXISTS "Users can view recordings in their org" ON recordings;
CREATE POLICY "Users can view recordings in their org"
ON recordings FOR SELECT
USING ( organization_id = get_user_org_id() );

DROP POLICY IF EXISTS "Users can manage recordings in their org" ON recordings;
CREATE POLICY "Users can manage recordings in their org"
ON recordings FOR ALL
USING ( organization_id = get_user_org_id() )
WITH CHECK ( organization_id = get_user_org_id() );
