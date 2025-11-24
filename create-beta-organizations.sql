-- =============================================================================
-- CREAR 3 ORGANIZACIONES PARA BETA TESTING
-- =============================================================================
-- Cada organización tendrá su propio código de acceso (slug)
-- Para ejecutar: copia y pega en Supabase SQL Editor

-- Insertar 3 organizaciones de prueba
INSERT INTO organizations (id, name, slug, logo_url, created_at)
VALUES 
    -- Organización 1
    (
        gen_random_uuid(),
        'Beta Tester 1',
        'beta1',
        '/kipu_logo.png',
        NOW()
    ),
    
    -- Organización 2
    (
        gen_random_uuid(),
        'Beta Tester 2',
        'beta2',
        '/kipu_logo.png',
        NOW()
    ),
    
    -- Organización 3
    (
        gen_random_uuid(),
        'Beta Tester 3',
        'beta3',
        '/kipu_logo.png',
        NOW()
    )
ON CONFLICT (slug) DO NOTHING;

-- Verificar las organizaciones creadas
SELECT 
    name,
    slug AS "Código de Acceso",
    created_at AS "Fecha de Creación"
FROM organizations
WHERE slug IN ('beta1', 'beta2', 'beta3')
ORDER BY created_at DESC;

-- =============================================================================
-- CÓDIGOS DE ACCESO PARA BETA TESTERS:
-- =============================================================================
-- 
-- Para acceder a cada organización en https://kipu-lemon.vercel.app:
-- 
-- 1. Beta Tester 1 → Código: beta1
-- 2. Beta Tester 2 → Código: beta2
-- 3. Beta Tester 3 → Código: beta3
--
-- Cada organización tendrá sus propios:
-- - Perfiles de usuario separados
-- - Grabaciones aisladas
-- - Datos independientes
-- =============================================================================
