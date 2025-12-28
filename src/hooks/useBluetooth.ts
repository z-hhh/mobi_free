import { useEffect, useRef, useState } from 'react';

/**
 * Debug logging utility with timestamp and log level
 */
const createLogger = (module: string) => ({
  debug: (message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${module}] DEBUG: ${message}`, data || '');
  },
  info: (message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    console.info(`[${timestamp}] [${module}] INFO: ${message}`, data || '');
  },
  warn: (message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] [${module}] WARN: ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [${module}] ERROR: ${message}`, error || '');
  },
});

const logger = createLogger('useBluetooth');

/**
 * Custom hook for managing Bluetooth connections
 * Provides connection state management, device discovery, and error handling
 */
export const useBluetooth = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'disconnected' | 'error'>('idle');
  
  const bluetoothDeviceRef = useRef<any>(null);
  const bluetoothServerRef = useRef<any>(null);
  const gattCharacteristicRef = useRef<any>(null);
  const scanAbortControllerRef = useRef<AbortController | null>(null);

  /**
   * Initialize Bluetooth with error handling
   */
  useEffect(() => {
    logger.info('useBluetooth hook mounted');
    
    // Check if Bluetooth is supported
    if (!navigator.bluetooth) {
      const errorMsg = 'Bluetooth API is not supported in this browser';
      logger.error(errorMsg);
      setError(errorMsg);
      setConnectionStatus('error');
      return;
    }

    logger.info('Bluetooth API is available');

    return () => {
      logger.info('useBluetooth hook unmounting, cleaning up...');
      // Cleanup on unmount
      if (scanAbortControllerRef.current) {
        scanAbortControllerRef.current.abort();
      }
    };
  }, []);

  /**
   * Scan for available Bluetooth devices
   */
  const scanDevices = async (filters?: any[]) => {
    try {
      logger.info('Starting Bluetooth device scan', { filters });
      setIsScanning(true);
      setError(null);
      scanAbortControllerRef.current = new AbortController();

      const options = filters ? { filters } : { acceptAllDevices: true };
      
      logger.debug('Scan options:', options);

      const device = await navigator.bluetooth!.requestDevice({
        ...options,
        optionalServices: ['generic_access', 'generic_attribute'],
      });

      logger.info('Device selected', { 
        name: device.name, 
        id: device.id,
        paired: device.paired,
      });

      bluetoothDeviceRef.current = device;
      setDevices([device]);
      setIsScanning(false);
      
      return device;
    } catch (err: any) {
      logger.error('Error during device scan', {
        message: err.message,
        name: err.name,
        stack: err.stack,
      });
      setIsScanning(false);
      setError(err.message || 'Failed to scan for devices');
      setConnectionStatus('error');
      throw err;
    }
  };

  /**
   * Connect to a Bluetooth device
   */
  const connect = async (device?: any) => {
    try {
      const targetDevice = device || bluetoothDeviceRef.current;
      
      if (!targetDevice) {
        const errorMsg = 'No device selected. Please scan for devices first.';
        logger.error(errorMsg);
        setError(errorMsg);
        setConnectionStatus('error');
        throw new Error(errorMsg);
      }

      logger.info('Attempting to connect to device', {
        deviceName: targetDevice.name,
        deviceId: targetDevice.id,
      });
      
      setConnectionStatus('connecting');
      setError(null);

      // Connect to GATT server
      logger.debug('Requesting GATT server connection');
      const server = await targetDevice.gatt.connect();
      bluetoothServerRef.current = server;
      
      logger.info('Connected to GATT server', {
        deviceName: targetDevice.name,
        connected: server.connected,
      });

      setIsConnected(true);
      setConnectionStatus('connected');
      
      // Listen for disconnection
      if (targetDevice.gatt.onconnectionstatechanged) {
        targetDevice.addEventListener('gattserverdisconnected', handleDisconnection);
        logger.debug('Registered disconnection listener');
      }

      return server;
    } catch (err: any) {
      logger.error('Connection failed', {
        message: err.message,
        name: err.name,
        code: err.code,
        stack: err.stack,
      });
      setIsConnected(false);
      setConnectionStatus('error');
      setError(err.message || 'Failed to connect to device');
      throw err;
    }
  };

  /**
   * Handle device disconnection
   */
  const handleDisconnection = () => {
    logger.warn('Device disconnected unexpectedly');
    setIsConnected(false);
    setConnectionStatus('disconnected');
    setError('Device disconnected');
    bluetoothServerRef.current = null;
    gattCharacteristicRef.current = null;
  };

  /**
   * Disconnect from Bluetooth device
   */
  const disconnect = async () => {
    try {
      logger.info('Initiating disconnect sequence');
      
      if (bluetoothDeviceRef.current?.gatt?.connected) {
        logger.debug('Disconnecting from GATT server');
        bluetoothDeviceRef.current.gatt.disconnect();
        logger.info('Successfully disconnected from device');
      } else {
        logger.warn('Device was not connected');
      }

      setIsConnected(false);
      setConnectionStatus('disconnected');
      bluetoothServerRef.current = null;
      gattCharacteristicRef.current = null;
      setError(null);
    } catch (err: any) {
      logger.error('Error during disconnect', {
        message: err.message,
        stack: err.stack,
      });
      setError(err.message || 'Failed to disconnect');
      setConnectionStatus('error');
      throw err;
    }
  };

  /**
   * Write data to a Bluetooth characteristic
   */
  const writeCharacteristic = async (
    serviceUUID: string,
    characteristicUUID: string,
    data: ArrayBuffer | ArrayBufferView
  ) => {
    try {
      if (!isConnected || !bluetoothServerRef.current) {
        const errorMsg = 'Device is not connected';
        logger.error(errorMsg);
        setError(errorMsg);
        throw new Error(errorMsg);
      }

      logger.debug('Writing to characteristic', {
        service: serviceUUID,
        characteristic: characteristicUUID,
        dataLength: data.byteLength,
      });

      const service = await bluetoothServerRef.current.getPrimaryService(serviceUUID);
      const characteristic = await service.getCharacteristic(characteristicUUID);
      
      await characteristic.writeValue(data);
      
      logger.info('Successfully wrote to characteristic', {
        service: serviceUUID,
        characteristic: characteristicUUID,
      });
    } catch (err: any) {
      logger.error('Error writing to characteristic', {
        message: err.message,
        serviceUUID,
        characteristicUUID,
        stack: err.stack,
      });
      setError(err.message || 'Failed to write to characteristic');
      setConnectionStatus('error');
      throw err;
    }
  };

  /**
   * Read data from a Bluetooth characteristic
   */
  const readCharacteristic = async (
    serviceUUID: string,
    characteristicUUID: string
  ) => {
    try {
      if (!isConnected || !bluetoothServerRef.current) {
        const errorMsg = 'Device is not connected';
        logger.error(errorMsg);
        setError(errorMsg);
        throw new Error(errorMsg);
      }

      logger.debug('Reading from characteristic', {
        service: serviceUUID,
        characteristic: characteristicUUID,
      });

      const service = await bluetoothServerRef.current.getPrimaryService(serviceUUID);
      const characteristic = await service.getCharacteristic(characteristicUUID);
      const value = await characteristic.readValue();
      
      logger.info('Successfully read from characteristic', {
        service: serviceUUID,
        characteristic: characteristicUUID,
        dataLength: value.byteLength,
      });

      return value;
    } catch (err: any) {
      logger.error('Error reading from characteristic', {
        message: err.message,
        serviceUUID,
        characteristicUUID,
        stack: err.stack,
      });
      setError(err.message || 'Failed to read from characteristic');
      setConnectionStatus('error');
      throw err;
    }
  };

  /**
   * Listen for notifications from a characteristic
   */
  const startNotifications = async (
    serviceUUID: string,
    characteristicUUID: string,
    onNotification: (value: DataView) => void
  ) => {
    try {
      if (!isConnected || !bluetoothServerRef.current) {
        const errorMsg = 'Device is not connected';
        logger.error(errorMsg);
        setError(errorMsg);
        throw new Error(errorMsg);
      }

      logger.debug('Starting notifications for characteristic', {
        service: serviceUUID,
        characteristic: characteristicUUID,
      });

      const service = await bluetoothServerRef.current.getPrimaryService(serviceUUID);
      const characteristic = await service.getCharacteristic(characteristicUUID);
      
      await characteristic.startNotifications();
      
      characteristic.addEventListener('characteristicvaluechanged', (event: any) => {
        logger.debug('Received notification', {
          service: serviceUUID,
          characteristic: characteristicUUID,
          dataLength: event.target.value.byteLength,
        });
        onNotification(event.target.value);
      });

      logger.info('Successfully started notifications', {
        service: serviceUUID,
        characteristic: characteristicUUID,
      });

      return characteristic;
    } catch (err: any) {
      logger.error('Error starting notifications', {
        message: err.message,
        serviceUUID,
        characteristicUUID,
        stack: err.stack,
      });
      setError(err.message || 'Failed to start notifications');
      setConnectionStatus('error');
      throw err;
    }
  };

  /**
   * Stop listening for notifications
   */
  const stopNotifications = async (
    serviceUUID: string,
    characteristicUUID: string
  ) => {
    try {
      if (!bluetoothServerRef.current) {
        logger.warn('No active server connection to stop notifications');
        return;
      }

      logger.debug('Stopping notifications for characteristic', {
        service: serviceUUID,
        characteristic: characteristicUUID,
      });

      const service = await bluetoothServerRef.current.getPrimaryService(serviceUUID);
      const characteristic = await service.getCharacteristic(characteristicUUID);
      
      await characteristic.stopNotifications();
      
      logger.info('Successfully stopped notifications', {
        service: serviceUUID,
        characteristic: characteristicUUID,
      });
    } catch (err: any) {
      logger.error('Error stopping notifications', {
        message: err.message,
        serviceUUID,
        characteristicUUID,
        stack: err.stack,
      });
      setError(err.message || 'Failed to stop notifications');
      throw err;
    }
  };

  /**
   * Clear error state
   */
  const clearError = () => {
    logger.debug('Clearing error state');
    setError(null);
  };

  /**
   * Get current connection info
   */
  const getConnectionInfo = () => ({
    isConnected,
    device: bluetoothDeviceRef.current ? {
      name: bluetoothDeviceRef.current.name,
      id: bluetoothDeviceRef.current.id,
      paired: bluetoothDeviceRef.current.paired,
    } : null,
    status: connectionStatus,
  });

  return {
    // State
    isConnected,
    isScanning,
    devices,
    error,
    connectionStatus,

    // Methods
    scanDevices,
    connect,
    disconnect,
    writeCharacteristic,
    readCharacteristic,
    startNotifications,
    stopNotifications,
    clearError,
    getConnectionInfo,
  };
};
