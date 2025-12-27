/**
 * Vault Hooks
 * Exported individually for tree-shaking
 */
export type OtpNotification = {
    messageId: string;
    type: 'sms' | 'email';
    from: string;
    to: string;
    subject?: string;
    receivedAt: string;
};
export type UseOtpSubscriptionOptions = {
    type?: 'sms' | 'email' | 'all';
    toFilter?: string;
    onOtpReceived?: (result: any) => void;
    enabled?: boolean;
    keepListening?: boolean;
    skipMessageId?: string | null;
    minReceivedAt?: Date | string | null;
};
export type UseOtpSubscriptionResult = {
    isListening: boolean;
    connectionType: 'websocket' | 'disconnected';
    otpCode: string | null;
    otpConfidence: 'high' | 'medium' | 'low' | 'none';
    fullMessage: string | null;
    latestNotification: OtpNotification | null;
    startListening: () => void;
    stopListening: () => void;
    clearOtp: () => void;
    error: Error | null;
};
export declare function useOtpSubscription(opts?: UseOtpSubscriptionOptions): UseOtpSubscriptionResult;
export declare function getGlobalWsStatus(): 'connecting' | 'connected' | 'disconnected' | 'error';
export declare function subscribeGlobalWsStatus(_listener: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void): () => void;
export declare function getGlobalOtpConnectionType(): 'websocket' | 'disconnected';
export declare function subscribeGlobalOtpConnectionType(_listener: (t: 'websocket' | 'disconnected') => void): () => void;
export declare function getWebSocketStatus(): Promise<'connected' | 'connecting' | 'disconnected' | 'error' | 'unavailable'>;
export declare function isWebSocketAvailable(): boolean;
export declare function ensureVaultRealtimeConnection(): Promise<() => void>;
//# sourceMappingURL=index.d.ts.map