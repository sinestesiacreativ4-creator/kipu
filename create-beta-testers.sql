-- =============================================================================
-- CREAR PERFILES DE BETA TESTERS
-- =============================================================================
-- Este script crea 3 perfiles de prueba en la organización Asesorías Étnicas
-- Para ejecutar: copia y pega en Supabase SQL Editor

-- Asegurarse de que la organización existe
DO $$
DECLARE
    org_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
    -- Insertar 3 perfiles de beta testers
    INSERT INTO profiles (id, name, role, avatar_color, organization_id, created_at)
    VALUES 
        (
            gen_random_uuid(),
            'Carolina Morales',
            'Coordinadora Comunidad',
            'bg-blue-600',
            org_id,
            NOW()
        ),
        (
            gen_random_uuid(),
            'Miguel Ángel Torres',
            'Asesor Legal',
            'bg-green-700',
            org_id,
            NOW()
        ),
        (
            gen_random_uuid(),
            'Paula Rodríguez',
            'Documentalista',
            'bg-amber-600',
            org_id,
            NOW()
        )
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE 'Beta testers creados exitosamente';
END $$;

-- Verificar los perfiles creados
SELECT 
    name,
    role,
    avatar_color,
    created_at
FROM profiles
WHERE organization_id = '00000000-0000-0000-0000-000000000001'
ORDER BY created_at DESC
LIMIT 3;

-- =============================================================================
-- NOTAS:
-- =============================================================================
-- Los 3 perfiles de prueba son:
-- 1. Carolina Morales - Coordinadora Comunidad (azul)
-- 2. Miguel Ángel Torres - Asesor Legal (verde)
-- 3. Paula Rodríguez - Documentalista (amarillo)
--
-- Estos perfiles están asociados a la organización con ID:
-- 00000000-0000-0000-0000-000000000001 (Asesorías Étnicas)
-- =============================================================================
