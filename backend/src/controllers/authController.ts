import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../services/prisma';

export const AuthController = {
    /**
     * Signup - Create new user account
     * POST /api/auth/signup
     * Body: { email, password, name, organizationId }
     */
    async signup(req: Request, res: Response) {
        try {
            const { email, password, name, organizationId } = req.body;

            // Validation
            if (!email || !password || !name) {
                return res.status(400).json({ error: 'Email, password, and name are required' });
            }

            // Check if user already exists
            const existingUser = await prisma.appUser.findUnique({
                where: { email }
            });

            if (existingUser) {
                return res.status(409).json({ error: 'User already exists' });
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);

            // Create user
            const user = await prisma.appUser.create({
                data: {
                    email,
                    password: hashedPassword,
                    name,
                    organizationId: organizationId || null,
                    role: 'USER' // Default role
                }
            });

            // Return user without password
            const { password: _, ...userWithoutPassword } = user;

            res.status(201).json({
                success: true,
                user: userWithoutPassword,
                message: 'Account created successfully'
            });

        } catch (error: any) {
            console.error('[Auth] Signup error:', error);
            res.status(500).json({ error: error.message || 'Failed to create account' });
        }
    },

    /**
     * Login - Authenticate user
     * POST /api/auth/login
     * Body: { email, password }
     */
    async login(req: Request, res: Response) {
        try {
            const { email, password } = req.body;

            // Validation
            if (!email || !password) {
                return res.status(400).json({ error: 'Email and password are required' });
            }

            // Find user
            const user = await prisma.appUser.findUnique({
                where: { email },
                include: {
                    organization: true
                }
            });

            if (!user) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            // Verify password
            const isValidPassword = await bcrypt.compare(password, user.password);

            if (!isValidPassword) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            // Return user without password
            const { password: _, ...userWithoutPassword } = user;

            res.json({
                success: true,
                user: userWithoutPassword,
                message: 'Login successful'
            });

        } catch (error: any) {
            console.error('[Auth] Login error:', error);
            res.status(500).json({ error: error.message || 'Failed to login' });
        }
    },

    /**
     * Get current user session
     * GET /api/auth/me
     * Requires email in query params (simple auth without JWT for now)
     */
    async getCurrentUser(req: Request, res: Response) {
        try {
            const { email } = req.query;

            if (!email || typeof email !== 'string') {
                return res.status(400).json({ error: 'Email is required' });
            }

            const user = await prisma.appUser.findUnique({
                where: { email },
                include: {
                    organization: true
                }
            });

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Return user without password
            const { password: _, ...userWithoutPassword } = user;

            res.json({
                success: true,
                user: userWithoutPassword
            });

        } catch (error: any) {
            console.error('[Auth] Get current user error:', error);
            res.status(500).json({ error: error.message || 'Failed to get user' });
        }
    },

    /**
     * Logout (client-side only for now)
     * POST /api/auth/logout
     */
    async logout(req: Request, res: Response) {
        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    }
};
