import { AnalyticsEngineDataset } from '@cloudflare/workers-types';

interface Env {
    ANALYTICS: AnalyticsEngineDataset;
    ASSETS: { fetch: (request: Request) => Promise<Response> };
}

interface AnalyticsPayload {
    type: string;
    version: string;
    userAgent?: string;
    errorDetails?: string;
    deviceName?: string;
    duration?: number;
    metricValue?: number;
}


export default {
    async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
        const url = new URL(request.url);

        // Debug: Log available bindings
        // console.log("Env keys:", Object.keys(env));

        // API Route: /api/analytics
        if (url.pathname === '/api/analytics' && request.method === 'POST') {
            try {
                const data = await request.json() as AnalyticsPayload;

                // Basic validation
                if (!data.type || !data.version) {
                    return new Response("Missing required fields: type, version", { status: 400 });
                }

                const point = {
                    indexes: [data.version, data.type], // For filtering/grouping
                    blobs: [
                        data.userAgent || request.headers.get("User-Agent") || "Unknown", // standard blob 1
                        data.errorDetails || "", // standard blob 2
                        data.deviceName || "",   // standard blob 3
                    ],
                    doubles: [
                        data.duration || 0,      // standard double 1
                        data.metricValue || 0,   // standard double 2
                    ],
                };

                env.ANALYTICS.writeDataPoint(point);

                // Add CORS headers if needed, though usually same-origin is fine
                return new Response("OK", {
                    status: 200,
                    headers: { 'Content-Type': 'text/plain' }
                });
            } catch (err) {
                return new Response("Error processing analytics", { status: 500 });
            }
        }

        // Fallback: Serve Static Assets
        // env.ASSETS is automatically provided by Workers with Assets
        return env.ASSETS.fetch(request);
    }
};
