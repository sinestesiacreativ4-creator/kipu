import { useState, useEffect } from 'react';
import { AppUser } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:10000';

interface AuthResponse {
    success: boolean;
    user?: AppUser;
    error?: string;
    message?: string;
}

export function useAuth() {
    const [appUser, setAppUser] = useState<AppUser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check if user is logged in (from localStorage)
        const storedUser = localStorage.getItem('app_user');
        if (storedUser) {
            try {
                const user: AppUser = JSON.parse(storedUser);
                setAppUser(user);
            } catch (error) {
                console.error('Error parsing stored user:', error);
                localStorage.removeItem('app_user');
            }
        }
        setLoading(false);
    }, []);

    const signUp = async (email: string, password: string, organizationName: string, fullName?: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const response = await fetch(`${API_URL}/api/auth/signup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email,
                    password,
                    name: fullName || email.split('@')[0],
                    organizationId: null // Will be created by backend if needed
                }),
            });

            const data: AuthResponse = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Signup failed');
            }

            if (data.user) {
                setAppUser(data.user);
                localStorage.setItem('app_user', JSON.stringify(data.user));
            }

            return { success: true };
        } catch (error: any) {
            console.error('Signup error:', error);
            return {
                success: false,
                error: error.message || 'An error occurred during signup'
            };
        }
    };

    const signIn = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const response = await fetch(`${API_URL}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email, password

                }),
            });

            const data: AuthResponse = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Login failed');
            }

            if (data.user) {
                setAppUser(data.user);
                localStorage.setItem('app_user', JSON.stringify(data.user));
            }

            return { success: true };
        } catch (error: any) {
            console.error('Signin error:', error);
            return {
                success: false,
                error: error.message || 'Invalid email or password'
            };
        }
    };

    const signOut = async () => {
        try {
            await fetch(`${API_URL}/api/auth/logout`, {
                method: 'POST',
            });
        } catch (error) {
            console.error('Signout error:', error);
        } finally {
            setAppUser(null);
            localStorage.removeItem('app_user');
        }
    };

    return {
        user: appUser, // For backward compatibility
        appUser,
        loading,
        session: appUser ? { user: appUser } : null, // Mock session for compatibility
        signUp,
        signIn,
        signInWithGoogle: async () => ({ success: false, error: 'Google auth not implemented' }), // Placeholder
        signOut,
    };
}
