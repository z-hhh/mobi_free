export { };

declare global {
    interface Navigator {
        bluetooth: Bluetooth;
    }

    interface Bluetooth {
        /**
         * Bluefy Browser specific API
         * Allows webapp developers to manage device's display dimming preferences.
         * @param enabled If true, screen dimming is enabled (default behavior). If false, screen stays on.
         */
        setScreenDimEnabled?: (enabled: boolean) => void;

        /**
         * Bluefy Browser specific API
         * Allows to monitor and handle changes when the applications goes to the background.
         */
        addEventListener?: (
            type: "backgroundstatechanged",
            listener: (this: Bluetooth, ev: Event) => any,
            options?: boolean | AddEventListenerOptions
        ) => void;
    }
}
