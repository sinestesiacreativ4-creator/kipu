-- Script SQL para crear organización demo
-- Ejecutar este SQL en tu base de datos PostgreSQL

INSERT INTO "Organization" (id, name, slug, "createdAt")
VALUES (
    gen_random_uuid(),
    'Asesorías Étnicas Demo',
    'demo',
    NOW()
)
ON CONFLICT (slug) DO NOTHING;
