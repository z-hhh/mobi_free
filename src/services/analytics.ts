import packageJson from '../../package.json';

const APP_VERSION = packageJson.version;

interface AnalyticsData {
    userAgent?: string;
    errorDetails?: string;
    deviceName?: string;
    duration?: number;
    metricValue?: number;
    [key: string]: any;
}

export const logEvent = async (type: string, data: AnalyticsData = {}) => {
    try {
        const payload = {
            type,
            version: APP_VERSION,
            ...data,
        };

        // Fire and forget, don't await strictly unless debugging
        // Use keepalive: true to ensure request survives page navigations
        fetch('/api/analytics', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            keepalive: true,
        }).catch(err => console.error("Analytics error:", err));

    } catch (e) {
        // Fail silently to not impact user experience
        console.warn("Failed to log analytics event", e);
    }
};
