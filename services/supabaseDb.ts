import { createClient } from '@supabase/supabase-js';
import { UserProfile, Recording, Organization } from '../types';

// Supabase credentials
const SUPABASE_URL = 'https://xchupaikazvkwivxqcfn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjaHVwYWlrYXp2a3dpdnhxY2ZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2ODM0NTYsImV4cCI6MjA3OTI1OTQ1Nn0.I-AQdSjDAEwVFJuF7BHGj3TA3kBcwat_WCUd8qd6rNg';

// ID de la organización demo (temporal hasta que implementemos auth)
const DEMO_ORG_ID = '00000000-0000-0000-0000-000000000001';

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const supabaseDb = {
    // =============== ORGANIZATIONS ===============
    async getOrganization(id: string): Promise<Organization | null> {
        try {
            const { data, error } = await supabase
                .from('organizations')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;

            return data ? {
                id: data.id,
                name: data.name,
                subdomain: data.subdomain,
                logoUrl: data.logo_url,
                createdAt: data.created_at ? new Date(data.created_at).getTime() : undefined
            } : null;
        } catch (error) {
            console.error('[Supabase] Error getting organization:', error);
            return null;
        }
    },

    async getOrganizationBySlug(slug: string): Promise<Organization | null> {
        try {
            const { data, error } = await supabase
                .from('organizations')
                .select('*')
                .eq('slug', slug)
                .single();

            if (error) throw error;

            return data ? {
                id: data.id,
                name: data.name,
                subdomain: data.subdomain,
                slug: data.slug,
                logoUrl: data.logo_url,
                createdAt: data.created_at ? new Date(data.created_at).getTime() : undefined
            } : null;
        } catch (error) {
            console.error('[Supabase] Error getting organization by slug:', error);
            return null;
        }
    },

    // =============== PROFILES ===============
    async getProfiles(organizationId: string = DEMO_ORG_ID): Promise<UserProfile[]> {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('organization_id', organizationId)
                .order('name');

            if (error) throw error;

            // Map DB snake_case to TS camelCase
            return (data || []).map(p => ({
                id: p.id,
                name: p.name,
                role: p.role,
                avatarColor: p.avatar_color,
                organizationId: p.organization_id
            }));
        } catch (error) {
            console.error('[Supabase] Error getting profiles:', error);
            return [];
        }
    },

    async addProfile(profile: UserProfile): Promise<void> {
        try {
            // Map TS camelCase to DB snake_case
            const dbProfile = {
                id: profile.id,
                name: profile.name,
                role: profile.role,
                avatar_color: profile.avatarColor,
                organization_id: profile.organizationId
            };

            const { error } = await supabase
                .from('profiles')
                .upsert(dbProfile, { onConflict: 'id' });

            if (error) throw error;
            console.log('[Supabase] Saved profile:', profile.name);
        } catch (error: any) {
            console.error('[Supabase] Error saving profile:', error);
            alert(`Error al guardar perfil: ${error.message || JSON.stringify(error)}`);
            throw error;
        }
    },

    async deleteProfile(id: string): Promise<void> {
        try {
            const { error } = await supabase
                .from('profiles')
                .delete()
                .eq('id', id);

            if (error) throw error;
            console.log('[Supabase] Deleted profile:', id);
        } catch (error: any) {
            console.error('[Supabase] Error deleting profile:', error);
            alert(`Error al eliminar perfil: ${error.message || JSON.stringify(error)}`);
            throw error;
        }
    },

    // =============== RECORDINGS ===============
    async getRecordings(userId: string, organizationId: string = DEMO_ORG_ID): Promise<Recording[]> {
        try {
            const { data, error } = await supabase
                .from('recordings')
                .select('*')
                .eq('user_id', userId)
                .eq('organization_id', organizationId)
                .order('created_at_ts', { ascending: false });

            if (error) throw error;
            console.log('[Supabase] Loaded', data?.length || 0, 'recordings for user:', userId);

            // Map DB snake_case to TS camelCase
            return (data || []).map(r => ({
                id: r.id,
                userId: r.user_id,
                organizationId: r.organization_id,
                audioBase64: r.audio_base64,
                audioUrl: r.audio_url,
                duration: r.duration,
                createdAt: r.created_at_ts,
                status: r.status,
                markers: r.markers,
                analysis: r.analysis
            }));
        } catch (error) {
            console.error('[Supabase] Error getting recordings:', error);
            return [];
        }
    },

    async uploadAudio(
        file: Blob,
        path: string,
        onProgress?: (progress: number) => void
    ): Promise<string | null> {
        const MAX_RETRIES = 3;
        let attempt = 0;

        while (attempt < MAX_RETRIES) {
            try {
                attempt++;
                console.log(`[Supabase] Upload attempt ${attempt}/${MAX_RETRIES} for ${path}`);

                // Simulate progress for now (Supabase doesn't expose native progress)
                if (onProgress) {
                    onProgress(0);
                    const progressInterval = setInterval(() => {
                        onProgress(Math.min(90, attempt * 30));
                    }, 500);

                    setTimeout(() => clearInterval(progressInterval), 2000);
                }

                const { data, error } = await supabase.storage
                    .from('recordings')
                    .upload(path, file, {
                        cacheControl: '3600',
                        upsert: true
                    });

                if (error) {
                    // Check if it's a retryable error
                    if (error.message?.includes('timeout') ||
                        error.message?.includes('network') ||
                        error.message?.includes('fetch')) {

                        if (attempt < MAX_RETRIES) {
                            console.warn(`[Supabase] Retrying upload due to: ${error.message}`);
                            await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
                            continue;
                        }
                    }
                    throw error;
                }

                if (onProgress) onProgress(100);

                const { data: { publicUrl } } = supabase.storage
                    .from('recordings')
                    .getPublicUrl(path);

                console.log('[Supabase] Upload successful:', publicUrl);
                return publicUrl;

            } catch (error: any) {
                console.error(`[Supabase] Upload attempt ${attempt} failed:`, error);

                if (attempt >= MAX_RETRIES) {
                    console.error('[Supabase] All upload attempts failed');
                    return null;
                }
            }
        }

        return null;
    },

    async saveRecording(recording: Recording, audioBlob?: Blob, onProgress?: (progress: number) => void): Promise<void> {
        try {
            let audioUrl = recording.audioUrl;
            let audioBase64 = recording.audioBase64;

            // Si hay un Blob, subirlo a Storage
            if (audioBlob) {
                const fileName = `${recording.organizationId}/${recording.id}.webm`;
                const uploadedUrl = await this.uploadAudio(audioBlob, fileName, onProgress);

                if (uploadedUrl) {
                    audioUrl = uploadedUrl;
                    audioBase64 = null; // Ya no guardamos base64 si tenemos URL
                    console.log('[Supabase] Audio uploaded to storage:', audioUrl);
                }
            }

            // Map TS camelCase to DB snake_case
            const dbRecording = {
                id: recording.id,
                user_id: recording.userId,
                organization_id: recording.organizationId,
                audio_base64: audioBase64, // Será null si se subió a storage
                audio_url: audioUrl,
                duration: recording.duration,
                created_at_ts: recording.createdAt,
                status: recording.status,
                markers: recording.markers,
                analysis: recording.analysis
            };

            const { error } = await supabase
                .from('recordings')
                .upsert(dbRecording, { onConflict: 'id' });

            if (error) throw error;
            console.log('[Supabase] Saved recording:', recording.id);
        } catch (error: any) {
            console.error('[Supabase] Error saving recording:', error);
            alert(`Error al guardar grabación: ${error.message || JSON.stringify(error)}`);
            throw error;
        }
    },

    async updateRecordingAnalysis(id: string, analysis: any, status: string): Promise<void> {
        try {
            const { error } = await supabase
                .from('recordings')
                .update({
                    analysis: analysis,
                    status: status
                })
                .eq('id', id);

            if (error) throw error;
            console.log('[Supabase] Updated recording analysis:', id);
        } catch (error: any) {
            console.error('[Supabase] Error updating analysis:', error);
            alert(`Error al actualizar análisis: ${error.message || JSON.stringify(error)}`);
            throw error;
        }
    },

    async deleteRecording(id: string): Promise<void> {
        try {
            const { error } = await supabase
                .from('recordings')
                .delete()
                .eq('id', id);

            if (error) throw error;
            console.log('[Supabase] Deleted recording:', id);
        } catch (error) {
            console.error('[Supabase] Error deleting recording:', error);
            throw error;
        }
    },

    // =============== UTILITIES ===============
    // Exportar el ID de org demo para usar en toda la app temporalmente
    getDemoOrgId: () => DEMO_ORG_ID,

    // Export supabase client for direct storage access
    supabase
};
