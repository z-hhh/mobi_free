import { AnalyticsEngineDataset } from '@cloudflare/workers-types';

interface Env {
    ANALYTICS: AnalyticsEngineDataset;
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

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
    try {
        const data = await request.json() as AnalyticsPayload;

        // Basic validation
        if (!data.type || !data.version) {
            return new Response("Missing required fields: type, version", { status: 400 });
        }

        const point = {
            indexes: [data.version, data.type],
            blobs: [
                data.userAgent || request.headers.get("User-Agent") || "Unknown",
                data.errorDetails || "",
                data.deviceName || "",
            ],
            doubles: [
                data.duration || 0,
                data.metricValue || 0,
            ],
        };

        env.ANALYTICS.writeDataPoint(point);

        return new Response("OK", {
            status: 200,
            headers: { 'Content-Type': 'text/plain' }
        });
    } catch (err) {
        return new Response("Error processing analytics", { status: 500 });
    }
};
