// API Service - Communicate with Backend (No Supabase)

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const api = {
    // =============== ORGANIZATIONS ===============

    async getOrganizationBySlug(slug: string) {
        const response = await fetch(`${API_URL}/api/organizations/${slug}`);
        if (!response.ok) {
            if (response.status === 404) return null;
            throw new Error('Error fetching organization');
        }
        return response.json();
    },

    async createOrganization(name: string, slug: string) {
        const response = await fetch(`${API_URL}/api/organizations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, slug })
        });
        if (!response.ok) throw new Error('Error creating organization');
        const data = await response.json();
        return data.organization; // Return the organization object directly
    },

    // =============== PROFILES ===============

    async getProfiles(organizationId: string) {
        // Correct route: /api/organizations/:id/profiles
        const response = await fetch(`${API_URL}/api/organizations/${organizationId}/profiles`);
        if (!response.ok) throw new Error('Error fetching profiles');
        return response.json();
    },

    async createProfile(profile: any) {
        const response = await fetch(`${API_URL}/api/profiles`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(profile)
        });
        if (!response.ok) throw new Error('Error creating profile');
        return response.json();
    },

    async deleteProfile(id: string) {
        const response = await fetch(`${API_URL}/api/profiles/${id}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error('Error deleting profile');
        return response.json();
    },

    // =============== RECORDINGS ===============

    async getRecordings(userId: string, organizationId: string) {
        const response = await fetch(`${API_URL}/api/recordings/${userId}/${organizationId}`);
        if (!response.ok) throw new Error('Error fetching recordings');
        return response.json();
    },

    async deleteRecording(id: string) {
        const response = await fetch(`${API_URL}/api/recordings/${id}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error('Error deleting recording');
        return response.json();
    },

    // =============== UTILITIES ===============

    async healthCheck() {
        try {
            const response = await fetch(`${API_URL}/health`);
            return response.ok;
        } catch {
            return false;
        }
    }
};
