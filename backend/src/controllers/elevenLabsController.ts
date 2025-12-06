import { Request, Response, Router } from 'express';

const router = Router();

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_AGENT_ID = process.env.ELEVENLABS_AGENT_ID || 'agent_5601kbtkdkghejj91hg2qr1gmty1';

export const ElevenLabsController = {
    /**
     * Get a signed URL for ElevenLabs Conversational AI
     * This is required for private agents
     * POST /api/elevenlabs/signed-url
     */
    async getSignedUrl(req: Request, res: Response) {
        try {
            if (!ELEVENLABS_API_KEY) {
                return res.status(500).json({
                    success: false,
                    error: 'ElevenLabs API key not configured',
                    message: 'Please set ELEVENLABS_API_KEY in environment variables'
                });
            }

            const agentId = req.body.agentId || ELEVENLABS_AGENT_ID;

            console.log('[ElevenLabs] Getting signed URL for agent:', agentId);

            // Call ElevenLabs API to get signed URL
            const response = await fetch(
                `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
                {
                    method: 'GET',
                    headers: {
                        'xi-api-key': ELEVENLABS_API_KEY,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[ElevenLabs] Error getting signed URL:', response.status, errorText);
                return res.status(response.status).json({
                    success: false,
                    error: 'Failed to get signed URL from ElevenLabs',
                    message: errorText
                });
            }

            const data = await response.json();
            console.log('[ElevenLabs] Got signed URL successfully');

            res.json({
                success: true,
                signedUrl: data.signed_url
            });

        } catch (error: any) {
            console.error('[ElevenLabs] Error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: error.message
            });
        }
    },

    /**
     * Health check for ElevenLabs integration
     * GET /api/elevenlabs/status
     */
    async getStatus(req: Request, res: Response) {
        res.json({
            success: true,
            configured: !!ELEVENLABS_API_KEY,
            agentId: ELEVENLABS_AGENT_ID ? ELEVENLABS_AGENT_ID.substring(0, 10) + '...' : null
        });
    }
};

// Routes
router.post('/elevenlabs/signed-url', ElevenLabsController.getSignedUrl);
router.get('/elevenlabs/status', ElevenLabsController.getStatus);

export default router;
