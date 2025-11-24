import { useState, useEffect } from 'react';
import { createClient, User, Session } from '@supabase/supabase-js';
import { AppUser } from '../types';

const SUPABASE_URL = 'https://xchupaikazvkwivxqcfn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjaHVwYWlrYXp2a3dpdnhxY2ZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2ODM0NTYsImV4cCI6MjA3OTI1OTQ1Nn0.I-AQdSjDAEwVFJuF7BHGj3TA3kBcwat_WCUd8qd6rNg';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export function useAuth() {
    const [user, setUser] = useState<User | null>(null);
    const [appUser, setAppUser] = useState<AppUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [session, setSession] = useState<Session | null>(null);

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchAppUser(session.user.id);
            } else {
                setLoading(false);
            }
        });

        // Listen for auth changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchAppUser(session.user.id);
            } else {
                setAppUser(null);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const fetchAppUser = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('app_users')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) throw error;

            if (data) {
                setAppUser({
                    id: data.id,
                    email: data.email,
                    organizationId: data.organization_id,
                    role: data.role,
                    fullName: data.full_name,
                    createdAt: data.created_at ? new Date(data.created_at).getTime() : undefined,
                    lastLogin: data.last_login ? new Date(data.last_login).getTime() : undefined,
                });
            }
        } catch (error) {
            console.error('Error fetching app user:', error);
        } finally {
            setLoading(false);
        }
    };

    const signUp = async (email: string, password: string, organizationName: string, fullName?: string) => {
        try {
            // 1. Create auth user
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: 'https://kipu-4n1y6vsqd-alexandrade-s-os-projects.vercel.app'
                }
            });

            if (authError) throw authError;
            if (!authData.user) throw new Error('No user returned from signup');

            // 2. Create organization
            const { data: orgData, error: orgError } = await supabase
                .from('organizations')
                .insert([{ name: organizationName }])
                .select()
                .single();

            if (orgError) throw orgError;

            // 3. Create app_user (first user is admin)
            const { error: userError } = await supabase
                .from('app_users')
                .insert([
                    {
                        id: authData.user.id,
                        email: email,
                        organization_id: orgData.id,
                        role: 'admin',
                        full_name: fullName,
                    },
                ]);

            if (userError) throw userError;

            return { success: true };
        } catch (error: any) {
            console.error('Signup error:', error);
            return {
                success: false,
                error: `[${error.code || 'UNKNOWN'}] ${error.message}` +
                    (error.details ? ` (${error.details})` : '') +
                    (error.hint ? ` Hint: ${error.hint}` : '')
            };
        }
    };

    const signIn = async (email: string, password: string) => {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            // Update last login
            if (data.user) {
                await supabase
                    .from('app_users')
                    .update({ last_login: new Date().toISOString() })
                    .eq('id', data.user.id);
            }

            return { success: true };
        } catch (error: any) {
            console.error('Signin error:', error);
            return {
                success: false,
                error: `[${error.code || 'UNKNOWN'}] ${error.message}` +
                    (error.details ? ` (${error.details})` : '') +
                    (error.hint ? ` Hint: ${error.hint}` : '')
            };
        }
    };

    const signInWithGoogle = async () => {
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin
                }
            });

            if (error) throw error;
            return { success: true };
        } catch (error: any) {
            console.error('Google signin error:', error);
            return {
                success: false,
                error: `[${error.code || 'UNKNOWN'}] ${error.message}`
            };
        }
    };

    const signOut = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) console.error('Signout error:', error);
    };

    return {
        user,
        appUser,
        loading,
        session,
        signUp,
        signIn,
        signInWithGoogle,
        signOut,
    };
}
