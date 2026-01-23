import packageJson from '../../package.json';

const APP_VERSION = packageJson.version;

// Enable analytics only on Cloudflare Pages build (CF_PAGES=1)
declare const __CF_PAGES__: boolean;
const ANALYTICS_ENABLED = typeof __CF_PAGES__ !== 'undefined' && __CF_PAGES__;

// Debug log - remove after testing
console.log('[Analytics] __CF_PAGES__:', typeof __CF_PAGES__ !== 'undefined' ? __CF_PAGES__ : 'undefined');
console.log('[Analytics] ANALYTICS_ENABLED:', ANALYTICS_ENABLED);

interface AnalyticsData {
    userAgent?: string;
    errorDetails?: string;
    deviceName?: string;
    duration?: number;
    metricValue?: number;
    [key: string]: any;
}

export const logEvent = async (type: string, data: AnalyticsData = {}) => {
    console.log('[Analytics] logEvent called:', type, 'enabled:', ANALYTICS_ENABLED);

    // Skip analytics if not enabled
    if (!ANALYTICS_ENABLED) {
        return;
    }

    try {
        const payload = {
            type,
            version: APP_VERSION,
            ...data,
        };

        fetch('/api/analytics', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            keepalive: true,
        }).catch(err => console.error("Analytics error:", err));

    } catch (e) {
        console.warn("Failed to log analytics event", e);
    }
};
