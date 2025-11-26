// Script para crear organización y perfil de prueba
import { randomUUID } from 'crypto';

const API_URL = 'https://kipu-backend.onrender.com'; // Cambia a http://localhost:10000 si el backend corre local

async function createDemoData() {
    try {
        // 1. Crear organización demo
        console.log('Creando organización demo...');
        const orgResponse = await fetch(`${API_URL}/api/init-demo-data`);
        const orgData = await orgResponse.json();
        console.log('Organización:', orgData);

        const orgId = orgData.org?.id || orgData.id;

        // 2. Crear perfil SONISX
        console.log('Creando perfil SONISX...');
        const profile = {
            id: randomUUID(),
            name: 'SONISX',
            role: 'Productor',
            avatarColor: 'bg-gradient-to-br from-purple-600 to-pink-600',
            organizationId: orgId
        };

        const profileResponse = await fetch(`${API_URL}/api/profiles`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(profile)
        });

        const profileData = await profileResponse.json();
        console.log('Perfil creado:', profileData);

        console.log('\n✅ ¡Listo! Ahora puedes:');
        console.log('1. En la app, usa el código de organización: "demo"');
        console.log('2. Selecciona el perfil: "SONISX"');

    } catch (error) {
        console.error('Error:', error);
    }
}

createDemoData();
