-- ============================================
-- SOLUCIÓN RÁPIDA: Políticas Permisivas para Bucket 'recordings'
-- ============================================
-- Este script configura políticas que permiten acceso tanto a usuarios
-- autenticados como anónimos (usando la clave anon)

-- 1. ELIMINAR políticas existentes
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public downloads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Allow all operations" ON storage.objects;

-- 2. CREAR política permisiva para TODOS los usuarios (anon + authenticated)

-- Permitir INSERT (subida) para TODOS
CREATE POLICY "Allow all uploads"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'recordings');

-- Permitir SELECT (lectura) para TODOS
CREATE POLICY "Allow all downloads"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'recordings');

-- Permitir UPDATE para TODOS
CREATE POLICY "Allow all updates"
ON storage.objects
FOR UPDATE
TO public
USING (bucket_id = 'recordings');

-- Permitir DELETE para TODOS
CREATE POLICY "Allow all deletes"
ON storage.objects
FOR DELETE
TO public
USING (bucket_id = 'recordings');

-- ============================================
-- VERIFICACIÓN
-- ============================================

-- Ver las políticas creadas
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'objects'
AND policyname LIKE '%Allow all%';

-- ============================================
-- ALTERNATIVA MÁS SIMPLE (Si lo anterior no funciona)
-- ============================================

-- Desactivar RLS completamente para el bucket
-- ⚠️ ADVERTENCIA: Esto permite acceso sin restricciones
-- Solo para desarrollo/pruebas

-- Descomentar la siguiente línea si quieres desactivar RLS:
-- ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;

-- Para reactivar RLS después:
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
