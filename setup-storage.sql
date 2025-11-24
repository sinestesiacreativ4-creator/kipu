-- =============================================================================
-- CONFIGURAR SUPABASE STORAGE PARA GRABACIONES LARGAS
-- =============================================================================

-- 1. Crear un bucket público llamado 'recordings'
INSERT INTO storage.buckets (id, name, public)
VALUES ('recordings', 'recordings', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Política para PERMITIR SUBIR archivos (INSERT) a cualquier usuario autenticado o anonimo (para beta)
CREATE POLICY "Permitir subir grabaciones a todos"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'recordings' );

-- 3. Política para PERMITIR LEER archivos (SELECT) a todos
CREATE POLICY "Permitir leer grabaciones a todos"
ON storage.objects FOR SELECT
USING ( bucket_id = 'recordings' );

-- 4. Agregar columna audio_url a la tabla recordings (si no existe)
ALTER TABLE recordings 
ADD COLUMN IF NOT EXISTS audio_url TEXT;

-- 5. Hacer opcional audio_base64 (para nuevas grabaciones que usen URL)
ALTER TABLE recordings 
ALTER COLUMN audio_base64 DROP NOT NULL;

-- =============================================================================
-- NOTA:
-- Esto permite subir archivos de audio grandes al bucket 'recordings'
-- y guardar solo la URL en la base de datos, evitando timeouts.
-- =============================================================================
