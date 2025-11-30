import axios from 'axios';

const API_URL = 'http://localhost:3001/api';

async function setup() {
    try {
        // 1. Signup
        const email = `test${Date.now()}@example.com`;
        const password = 'password123';
        console.log(`Creating user ${email}...`);

        const signupRes = await axios.post(`${API_URL}/auth/signup`, {
            email,
            password,
            name: 'Test User'
        });

        const user = signupRes.data.user;
        console.log('User created:', user.id);

        // 2. Create Org
        console.log('Creating org...');
        const orgRes = await axios.post(`${API_URL}/organizations`, {
            name: 'Test Org',
            slug: `test-org-${Date.now()}`,
            userId: user.id
        });

        const org = orgRes.data;
        console.log('Org created:', org.id);

        console.log('SETUP_COMPLETE');
        console.log(JSON.stringify({ userId: user.id, orgId: org.id }));

    } catch (error: any) {
        console.error('Setup failed:', error.response?.data || error.message);
    }
}

setup();
