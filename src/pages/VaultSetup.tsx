'use client';

import React, { useState, useEffect } from 'react';
import type { BreadcrumbItem } from '@hit/ui-kit';
import { useUi } from '@hit/ui-kit';
import { Copy, RefreshCw, Lock as LockIcon, Settings, Activity, Mail, Phone, Check, Edit2, X, ChevronDown, Wifi, WifiOff, CheckCircle2 } from 'lucide-react';
import { vaultApi } from '../services/vault-api';
import type { VaultSmsNumber, VaultSmsMessage, VaultWebhookLog } from '../schema/vault';
import { extractOtpWithConfidence } from '../utils/otp-extractor';
import { useOtpSubscription, getGlobalWsStatus, subscribeGlobalWsStatus, isWebSocketAvailable } from '../hooks/useOtpSubscription';

interface Props {
  onNavigate?: (path: string) => void;
}

export function VaultSetup({ onNavigate }: Props) {
  const { Page, Card, Button, Alert, Input } = useUi();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [smsNumbers, setSmsNumbers] = useState<VaultSmsNumber[]>([]);
  const [selectedSmsNumberId, setSelectedSmsNumberId] = useState<string | null>(null);
  const [messages, setMessages] = useState<VaultSmsMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [revealedMessages, setRevealedMessages] = useState<Map<string, string>>(new Map());
  const [webhookLogs, setWebhookLogs] = useState<VaultWebhookLog[]>([]);
  const [loadingWebhookLogs, setLoadingWebhookLogs] = useState(false);
  const [webhookApiKey, setWebhookApiKey] = useState<string | null>(null);
  const [generatingApiKey, setGeneratingApiKey] = useState(false);
  const [expandedLogSections, setExpandedLogSections] = useState<Set<string>>(new Set());
  
  // Email configuration state
  const [globalEmailAddress, setGlobalEmailAddress] = useState<string | null>(null);
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  
  // Email messages state
  const [emailMessages, setEmailMessages] = useState<Array<{
    id: string;
    from: string;
    to: string;
    subject: string | null;
    receivedAt: Date;
  }>>([]);
  const [loadingEmailMessages, setLoadingEmailMessages] = useState(false);
  const [expandedEmailId, setExpandedEmailId] = useState<string | null>(null);
  
  // WebSocket-based OTP subscription - this establishes the connection and enables real-time updates
  const otpSubscription = useOtpSubscription({
    type: 'all',
    enabled: true, // Always listen for incoming OTP messages
    onOtpReceived: async (result) => {
      // When OTP is received via WebSocket, refresh SMS messages if needed
      console.log('[VaultSetup] Real-time OTP received:', result.notification.type, result.code);
      if (result.notification.type === 'sms' && selectedSmsNumberId) {
        loadMessages(selectedSmsNumberId);
      }
      // Note: Email inbox is not auto-refreshed - user can manually refresh if needed
    },
  });
  
  // Use the same WebSocket status approach as the dashboard shell
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>(getGlobalWsStatus());
  
  useEffect(() => {
    const unsubscribe = subscribeGlobalWsStatus((status) => {
      setWsStatus(status);
    });
    return unsubscribe;
  }, []);

  const wsAvailable = isWebSocketAvailable();

  const navigate = (path: string) => {
    if (onNavigate) onNavigate(path);
    else if (typeof window !== 'undefined') window.location.href = path;
  };

  useEffect(() => {
    loadData();
    loadWebhookLogs();
    loadWebhookApiKey();
    loadGlobalEmailAddress();
  }, []);

  useEffect(() => {
    // Load email messages when global email is configured
    if (globalEmailAddress) {
      loadEmailMessages();
    } else {
      setEmailMessages([]);
    }
  }, [globalEmailAddress]);

  useEffect(() => {
    if (selectedSmsNumberId) {
      loadMessages(selectedSmsNumberId);
      
      // Auto-refresh messages every 5 seconds to catch new webhook messages
      const interval = setInterval(() => {
        loadMessages(selectedSmsNumberId);
      }, 5000);
      
      return () => clearInterval(interval);
    } else {
      setMessages([]);
    }
  }, [selectedSmsNumberId]);

  async function loadData() {
    try {
      setLoading(true);
      const numbers = await vaultApi.getSmsNumbers();
      setSmsNumbers(numbers);
      if (numbers.length > 0) {
        setSelectedSmsNumberId(numbers[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load setup data'));
    } finally {
      setLoading(false);
    }
  }

  function formatTimeAgo(date: Date | string): string {
    const now = new Date();
    const msgDate = typeof date === 'string' ? new Date(date) : date;
    const diffMs = now.getTime() - msgDate.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    
    if (diffSecs < 60) {
      return `${diffSecs} sec${diffSecs !== 1 ? 's' : ''} old`;
    } else if (diffMins < 60) {
      return `${diffMins} min${diffMins !== 1 ? 's' : ''} old`;
    } else {
      const diffHours = Math.floor(diffMins / 60);
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} old`;
    }
  }

  async function loadMessages(smsNumberId: string) {
    try {
      setLoadingMessages(true);
      const msgs = await vaultApi.getSmsMessages(smsNumberId);
      setMessages(msgs);
      
      // Automatically reveal the most recent message if it's within 5 minutes
      if (msgs.length > 0) {
        const mostRecent = msgs[0];
        const receivedAt = new Date(mostRecent.receivedAt);
        const now = new Date();
        const diffMs = now.getTime() - receivedAt.getTime();
        const diffMins = diffMs / (1000 * 60);
        
        // If message is within 5 minutes, try to reveal it (handleRevealMessage checks if already revealed)
        if (diffMins <= 5) {
          await handleRevealMessage(mostRecent.id);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load messages'));
    } finally {
      setLoadingMessages(false);
    }
  }

  async function loadWebhookLogs() {
    try {
      setLoadingWebhookLogs(true);
      const result = await vaultApi.getWebhookLogs({ limit: 50 });
      setWebhookLogs(result.items);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load webhook logs'));
    } finally {
      setLoadingWebhookLogs(false);
    }
  }

  async function loadWebhookApiKey() {
    try {
      const result = await vaultApi.getWebhookApiKey();
      setWebhookApiKey(result.apiKey);
    } catch (err) {
      console.error('Failed to load webhook API key:', err);
    }
  }

  async function handleGenerateApiKey() {
    if (!confirm('Generate a new API key? The old key will be invalidated and you will need to update F-Droid and Power Automate configurations.')) {
      return;
    }

    try {
      setGeneratingApiKey(true);
      setError(null);
      const result = await vaultApi.generateWebhookApiKey();
      setWebhookApiKey(result.apiKey);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to generate API key'));
    } finally {
      setGeneratingApiKey(false);
    }
  }

  async function handleRevealMessage(messageId: string) {
    if (revealedMessages.has(messageId)) {
      return;
    }

    try {
      const result = await vaultApi.revealSmsMessage(messageId);
      setRevealedMessages(prev => new Map(prev).set(messageId, result.body));
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to reveal message'));
    }
  }

  async function loadGlobalEmailAddress() {
    try {
      const result = await vaultApi.getGlobalEmailAddress();
      setGlobalEmailAddress(result.emailAddress);
      setEmailInput(result.emailAddress || '');
    } catch (err) {
      console.error('Failed to load global email address:', err);
    }
  }

  async function saveGlobalEmailAddress() {
    if (!emailInput.trim()) {
      return;
    }

    try {
      setSavingEmail(true);
      setError(null);
      await vaultApi.setGlobalEmailAddress(emailInput.trim());
      setGlobalEmailAddress(emailInput.trim());
      setEditingEmail(false);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to save email address'));
    } finally {
      setSavingEmail(false);
    }
  }

  async function deleteGlobalEmailAddress() {
    if (!confirm('Remove the global 2FA email address?')) {
      return;
    }

    try {
      setSavingEmail(true);
      setError(null);
      await vaultApi.deleteGlobalEmailAddress();
      setGlobalEmailAddress(null);
      setEmailInput('');
      setEditingEmail(false);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to delete email address'));
    } finally {
      setSavingEmail(false);
    }
  }

  async function loadEmailMessages() {
    try {
      setLoadingEmailMessages(true);
      const result = await vaultApi.getLatestEmailMessages();
      setEmailMessages(result.messages);
      
      // Automatically reveal the most recent message if it's within 5 minutes
      if (result.messages.length > 0) {
        const mostRecent = result.messages[0];
        const receivedAt = new Date(mostRecent.receivedAt);
        const now = new Date();
        const diffMs = now.getTime() - receivedAt.getTime();
        const diffMins = diffMs / (1000 * 60);
        
        // If message is within 5 minutes, try to reveal it
        if (diffMins <= 5) {
          await handleRevealMessage(mostRecent.id);
        }
      }
    } catch (err) {
      console.error('Failed to load email messages:', err);
    } finally {
      setLoadingEmailMessages(false);
    }
  }


  if (loading) {
    return (
      <Page title="Setup" description="Loading...">
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      </Page>
    );
  }

  const breadcrumbs: BreadcrumbItem[] = [
    { label: 'Vault', href: '/vault/personal', icon: <LockIcon size={14} /> },
    { label: 'Setup', icon: <Settings size={14} /> },
  ];

  return (
    <Page
      title="Setup"
      breadcrumbs={breadcrumbs}
      onNavigate={navigate}
      description="Configure webhooks for SMS (F-Droid) and Email (Power Automate) forwarding"
    >
      {error && (
        <Alert variant="error" title="Error">
          {error.message}
        </Alert>
      )}

      {/* Prominent OTP Notification */}
      {otpSubscription.otpCode && (
        <Card className="border-2 border-green-500 bg-green-50 dark:bg-green-900/20">
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 size={24} className="text-green-600 dark:text-green-400" />
                <div>
                  <h3 className="text-lg font-semibold text-green-900 dark:text-green-100">
                    OTP Code Received
                  </h3>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    {otpSubscription.latestNotification?.type === 'email' ? 'Email' : 'SMS'} from {otpSubscription.latestNotification?.from}
                    {otpSubscription.latestNotification?.subject && ` - ${otpSubscription.latestNotification.subject}`}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  otpSubscription.clearOtp();
                }}
              >
                <X size={16} />
              </Button>
            </div>
            
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-1">
                <div className="flex items-baseline gap-3">
                  <code className="text-4xl font-mono font-bold text-green-900 dark:text-green-100">
                    {otpSubscription.otpCode}
                  </code>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(otpSubscription.otpCode!);
                    }}
                    className="flex items-center gap-2"
                  >
                    <Copy size={16} />
                    Copy
                  </Button>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className={`text-xs font-medium px-2 py-1 rounded ${
                    otpSubscription.otpConfidence === 'high'
                      ? 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200'
                      : otpSubscription.otpConfidence === 'medium'
                        ? 'bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200'
                        : 'bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200'
                  }`}>
                    {otpSubscription.otpConfidence} confidence
                  </span>
                  {otpSubscription.latestNotification?.receivedAt && (
                    <span className="text-xs text-muted-foreground">
                      {new Date(otpSubscription.latestNotification.receivedAt).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {otpSubscription.fullMessage && (
              <div className="mt-4 pt-4 border-t border-green-200 dark:border-green-800">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const key = 'otp-full-message';
                    const isExpanded = expandedLogSections.has(key);
                    const newSet = new Set(expandedLogSections);
                    if (isExpanded) {
                      newSet.delete(key);
                    } else {
                      newSet.add(key);
                    }
                    setExpandedLogSections(newSet);
                  }}
                  className="text-green-700 dark:text-green-300 hover:text-green-900 dark:hover:text-green-100"
                >
                  <ChevronDown 
                    size={14} 
                    className={`mr-2 transition-transform duration-200 ${expandedLogSections.has('otp-full-message') ? 'rotate-180' : ''}`}
                  />
                  {expandedLogSections.has('otp-full-message') ? 'Hide' : 'Show'} Full Message
                </Button>
                {expandedLogSections.has('otp-full-message') && (
                  <div className="mt-2 p-3 bg-white dark:bg-gray-800 rounded border text-sm font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {otpSubscription.fullMessage}
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      )}

      <div className="space-y-6">
        {/* Connection Status */}
        <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border">
          <div className="flex items-center gap-2">
            {wsStatus === 'connected' ? (
              <>
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
                <Wifi size={18} className="text-green-500" />
                <span className="text-sm font-medium text-green-600 dark:text-green-400">
                  WebSocket Connected
                </span>
              </>
            ) : !wsAvailable ? (
              <>
                <span className="relative flex h-3 w-3">
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-gray-400"></span>
                </span>
                <WifiOff size={18} className="text-gray-400" />
                <span className="text-sm font-medium text-gray-500">
                  WebSocket Unavailable
                </span>
              </>
            ) : (
              <>
                <span className="relative flex h-3 w-3">
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-gray-400"></span>
                </span>
                <WifiOff size={18} className="text-gray-400" />
                <span className="text-sm font-medium text-gray-500">
                  Disconnected
                </span>
              </>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {wsStatus === 'connected' 
              ? 'OTP codes will appear instantly when received'
              : 'Waiting for connection...'}
          </span>
        </div>

        {/* 2FA Settings */}
        <Card>
          <div className="p-6 space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <Mail size={20} />
                2FA Email Address
              </h2>
              <p className="text-sm text-muted-foreground">
                Configure the email address used for receiving 2FA codes. When adding vault items with email-based 2FA, 
                incoming emails to this address will be matched for OTP extraction.
              </p>
            </div>

            <div className="space-y-3">
              {editingEmail ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={emailInput}
                    onChange={(value: string) => setEmailInput(value)}
                    placeholder="operations@yourcompany.com"
                    className="flex-1"
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={saveGlobalEmailAddress}
                    disabled={savingEmail || !emailInput.trim()}
                  >
                    {savingEmail ? 'Saving...' : <Check size={16} />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingEmail(false);
                      setEmailInput(globalEmailAddress || '');
                    }}
                  >
                    <X size={16} />
                  </Button>
                </div>
              ) : globalEmailAddress ? (
                <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border">
                  <div className="flex items-center gap-2">
                    <Mail size={16} className="text-muted-foreground" />
                    <code className="text-sm font-mono">{globalEmailAddress}</code>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingEmail(true)}
                    >
                      <Edit2 size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={deleteGlobalEmailAddress}
                      className="text-red-500 hover:text-red-600"
                    >
                      <X size={16} />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <Alert variant="info" title="No Email Address Configured">
                    <p className="text-sm mt-2">
                      Set up a 2FA email address to enable email-based OTP code extraction.
                    </p>
                  </Alert>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setEditingEmail(true)}
                  >
                    <Mail size={16} className="mr-2" />
                    Configure Email Address
                  </Button>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                When you add a vault item with "Email" 2FA, the system will poll for incoming emails matching 
                this address and automatically extract OTP codes.
              </p>
            </div>
          </div>
        </Card>

        {/* Email Inbox */}
        {globalEmailAddress && (
          <Card>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Mail size={20} />
                  Email Inbox (Debug)
                </h2>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={loadEmailMessages}
                  disabled={loadingEmailMessages}
                >
                  <RefreshCw size={16} className={`mr-2 ${loadingEmailMessages ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>

              <p className="text-sm text-muted-foreground">
                Emails matching <code className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">{globalEmailAddress}</code> will appear here.
              </p>

              {loadingEmailMessages ? (
                <div className="text-center py-4 text-muted-foreground">Loading emails...</div>
              ) : emailMessages.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  No email messages received yet
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {emailMessages.map(msg => {
                    const revealedBody = revealedMessages.get(msg.id);
                    const isRevealed = !!revealedBody;
                    const otpResult = isRevealed && revealedBody ? extractOtpWithConfidence(revealedBody) : null;
                    const showFullMessage = expandedEmailId === msg.id;

                    return (
                      <div
                        key={msg.id}
                        className="p-3 border rounded-lg bg-gray-50 dark:bg-gray-900"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="text-sm flex-1">
                            <div className="font-medium">From: {msg.from}</div>
                            {msg.subject && (
                              <div className="text-muted-foreground text-xs mt-0.5">
                                Subject: {msg.subject}
                              </div>
                            )}
                            <div className="text-muted-foreground text-xs mt-1">
                              {new Date(msg.receivedAt).toLocaleString()}
                            </div>
                          </div>
                          {!isRevealed && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRevealMessage(msg.id)}
                            >
                              Reveal
                            </Button>
                          )}
                        </div>
                        
                        {otpResult && otpResult.code && (
                          <div className={`mb-2 p-3 rounded-md border-2 ${
                            otpResult.confidence === 'high' 
                              ? 'bg-green-50 dark:bg-green-900/20 border-green-500' 
                              : otpResult.confidence === 'medium'
                                ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500'
                                : 'bg-gray-50 dark:bg-gray-800 border-gray-400'
                          }`}>
                            <div className="flex items-center justify-between mb-2">
                              <label className={`text-sm font-medium ${
                                otpResult.confidence === 'high' 
                                  ? 'text-green-600 dark:text-green-400' 
                                  : otpResult.confidence === 'medium'
                                    ? 'text-yellow-600 dark:text-yellow-400'
                                    : 'text-gray-600 dark:text-gray-400'
                              }`}>
                                OTP Code Detected ({otpResult.confidence} confidence)
                              </label>
                              <span className="text-xs text-muted-foreground">
                                {formatTimeAgo(msg.receivedAt)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <code className="text-2xl font-mono font-bold">
                                {otpResult.code}
                              </code>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigator.clipboard.writeText(otpResult.code!)}
                                title="Copy OTP code"
                              >
                                <Copy size={16} />
                              </Button>
                            </div>
                          </div>
                        )}
                        
                        {isRevealed && (
                          <div className="space-y-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setExpandedEmailId(showFullMessage ? null : msg.id)}
                            >
                              {showFullMessage ? 'Hide Full Message' : 'Show Full Message'}
                            </Button>
                            
                            {showFullMessage && (
                              <div className="text-sm font-mono bg-white dark:bg-gray-800 p-2 rounded border max-h-48 overflow-y-auto whitespace-pre-wrap">
                                {revealedBody}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Webhook Configuration */}
        <Card>
          <div className="p-6 space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-2">Webhook Configuration</h2>
              <p className="text-sm text-muted-foreground">
                Configure F-Droid (SMS) or Power Automate (Email) to forward messages to these webhooks.
                Phone numbers and email addresses don't need to be pre-configured - any message sent to the webhook will be stored.
              </p>
            </div>

            {/* SMS Webhook */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-md font-semibold">SMS Webhook (F-Droid)</h3>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const url = typeof window !== 'undefined' 
                      ? `${window.location.origin}/api/vault/sms/webhook/inbound`
                      : '/api/vault/sms/webhook/inbound';
                    navigator.clipboard.writeText(url);
                  }}
                >
                  <Copy size={16} className="mr-2" />
                  Copy URL
                </Button>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border">
                <code className="text-sm font-mono break-all">
                  {typeof window !== 'undefined' 
                    ? `${window.location.origin}/api/vault/sms/webhook/inbound`
                    : '/api/vault/sms/webhook/inbound'}
                </code>
              </div>
              
              <div className="space-y-2">
                <p className="text-sm font-medium">F-Droid Setup Instructions:</p>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Install an SMS forwarding app from F-Droid (e.g., "SMS Forwarder")</li>
                  <li>Configure the app to POST JSON to the webhook URL above</li>
                  <li>Set the Authorization header: <code className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">Bearer {'<SHARED_API_KEY>'}</code> or use <code className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">X-API-Key</code> header (use the shared API key shown below)</li>
                  <li>Use the following JSON format:</li>
                </ol>
                <pre className="text-xs bg-gray-900 dark:bg-gray-950 text-gray-100 p-3 rounded overflow-x-auto">
{`{
  "from": "+1234567890",
  "to": "+0987654321",
  "body": "Your OTP code is 123456",
  "timestamp": "2024-01-01T12:00:00Z"
}`}
                </pre>
              </div>
            </div>

            {/* Email Webhook */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-md font-semibold">Email Webhook (Power Automate)</h3>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const url = typeof window !== 'undefined' 
                      ? `${window.location.origin}/api/vault/email/webhook/inbound`
                      : '/api/vault/email/webhook/inbound';
                    navigator.clipboard.writeText(url);
                  }}
                >
                  <Copy size={16} className="mr-2" />
                  Copy URL
                </Button>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border">
                <code className="text-sm font-mono break-all">
                  {typeof window !== 'undefined' 
                    ? `${window.location.origin}/api/vault/email/webhook/inbound`
                    : '/api/vault/email/webhook/inbound'}
                </code>
              </div>
              
              <div className="space-y-2">
                <p className="text-sm font-medium">Power Automate Setup Instructions:</p>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Create a Power Automate flow triggered by "When a new email arrives"</li>
                  <li>Add an HTTP action to POST to the webhook URL above</li>
                  <li>Set the Authorization header: <code className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">Bearer {'<SHARED_API_KEY>'}</code> or use <code className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">X-API-Key</code> header (use the shared API key shown below)</li>
                  <li>Set Content-Type to <code className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">application/json</code></li>
                  <li>Use the following JSON format in the body:</li>
                </ol>
                <pre className="text-xs bg-gray-900 dark:bg-gray-950 text-gray-100 p-3 rounded overflow-x-auto">
{`{
  "from": "sender@example.com",
  "to": "recipient@example.com",
  "subject": "Email Subject",
  "body": "Email body text or HTML",
  "timestamp": "2024-01-01T12:00:00Z"
}`}
                </pre>
                <p className="text-xs text-muted-foreground mt-2">
                  <strong>Note:</strong> Map Power Automate email fields:
                  <br />• <code className="font-mono">from</code> = From (Email Address)
                  <br />• <code className="font-mono">to</code> = To (Email Address)
                  <br />• <code className="font-mono">subject</code> = Subject
                  <br />• <code className="font-mono">body</code> = Body (or Body HTML)
                </p>
              </div>
            </div>

            {/* API Key Configuration */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-md font-semibold">Shared API Key</h3>
                <div className="flex gap-2">
                  {webhookApiKey && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(webhookApiKey);
                      }}
                    >
                      <Copy size={16} className="mr-2" />
                      Copy Key
                    </Button>
                  )}
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleGenerateApiKey}
                    disabled={generatingApiKey}
                  >
                    {generatingApiKey ? 'Generating...' : webhookApiKey ? 'Regenerate' : 'Generate'}
                  </Button>
                </div>
              </div>
              
              {webhookApiKey ? (
                <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border">
                  <code className="text-sm font-mono break-all">{webhookApiKey}</code>
                </div>
              ) : (
                <Alert variant="warning" title="No API Key Configured">
                  <p className="text-sm mt-2">
                    Generate an API key to secure your webhooks. This key is shared between F-Droid (SMS) and Power Automate (Email) webhooks.
                  </p>
                </Alert>
              )}
              
              <p className="text-xs text-muted-foreground">
                Use this API key in the <code className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">Authorization: Bearer {'<API_KEY>'}</code> header or <code className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">X-API-Key</code> header for both webhooks.
              </p>
            </div>
          </div>
        </Card>

        {/* SMS Inbox for Debugging */}
        {smsNumbers.length > 0 && (
          <Card>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">SMS Inbox (Debug)</h2>
                {selectedSmsNumberId && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => selectedSmsNumberId && loadMessages(selectedSmsNumberId)}
                    disabled={loadingMessages}
                  >
                    <RefreshCw size={16} className={`mr-2 ${loadingMessages ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                )}
              </div>

              {smsNumbers.length > 1 && (
                <div>
                  <label className="text-sm font-medium">Select SMS Number</label>
                  <select
                    value={selectedSmsNumberId || ''}
                    onChange={(e) => setSelectedSmsNumberId(e.target.value || null)}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                  >
                    {smsNumbers.map(num => (
                      <option key={num.id} value={num.id}>
                        {num.phoneNumber} ({num.vaultId ? 'Vault-specific' : 'Global'})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {selectedSmsNumberId && (
                <div className="space-y-2">
                  {loadingMessages ? (
                    <div className="text-center py-4 text-muted-foreground">Loading messages...</div>
                  ) : messages.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">
                      No messages received yet
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {messages.map(msg => {
                        const revealedBody = revealedMessages.get(msg.id);
                        const isRevealed = !!revealedBody;
                        const otpResult = isRevealed && revealedBody ? extractOtpWithConfidence(revealedBody) : null;
                        const showFullMessage = expandedEmailId === `sms-${msg.id}`;

                        return (
                          <div
                            key={msg.id}
                            className="p-3 border rounded-lg bg-gray-50 dark:bg-gray-900"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="text-sm">
                                <div className="font-medium">From: {msg.fromNumber}</div>
                                <div className="text-muted-foreground text-xs mt-1">
                                  {new Date(msg.receivedAt).toLocaleString()}
                                </div>
                              </div>
                              {!isRevealed && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRevealMessage(msg.id)}
                                >
                                  Reveal
                                </Button>
                              )}
                            </div>
                            
                            {otpResult && otpResult.code && (
                              <div className={`mb-2 p-3 rounded-md border-2 ${
                                otpResult.confidence === 'high' 
                                  ? 'bg-green-50 dark:bg-green-900/20 border-green-500' 
                                  : otpResult.confidence === 'medium'
                                    ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500'
                                    : 'bg-gray-50 dark:bg-gray-800 border-gray-400'
                              }`}>
                                <div className="flex items-center justify-between mb-2">
                                  <label className={`text-sm font-medium ${
                                    otpResult.confidence === 'high' 
                                      ? 'text-green-600 dark:text-green-400' 
                                      : otpResult.confidence === 'medium'
                                        ? 'text-yellow-600 dark:text-yellow-400'
                                        : 'text-gray-600 dark:text-gray-400'
                                  }`}>
                                    OTP Code Detected ({otpResult.confidence} confidence)
                                  </label>
                                  <span className="text-xs text-muted-foreground">
                                    {formatTimeAgo(msg.receivedAt)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <code className="text-2xl font-mono font-bold">
                                    {otpResult.code}
                                  </code>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => navigator.clipboard.writeText(otpResult.code!)}
                                    title="Copy OTP code"
                                  >
                                    <Copy size={16} />
                                  </Button>
                                </div>
                              </div>
                            )}
                            
                            {isRevealed && (
                              <div className="space-y-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setExpandedEmailId(showFullMessage ? null : `sms-${msg.id}`)}
                                >
                                  {showFullMessage ? 'Hide Full Message' : 'Show Full Message'}
                                </Button>
                                
                                {showFullMessage && (
                                  <div className="text-sm font-mono bg-white dark:bg-gray-800 p-2 rounded border max-h-48 overflow-y-auto whitespace-pre-wrap">
                                    {revealedBody}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Webhook Logs */}
        <Card>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Activity size={20} />
                Webhook Logs
              </h2>
              <Button
                variant="secondary"
                size="sm"
                onClick={loadWebhookLogs}
                disabled={loadingWebhookLogs}
              >
                <RefreshCw size={16} className={`mr-2 ${loadingWebhookLogs ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>

            <p className="text-sm text-muted-foreground">
              View all incoming webhook requests for debugging. This includes successful requests, failed requests, and validation errors.
            </p>

            {loadingWebhookLogs ? (
              <div className="text-center py-4 text-muted-foreground">Loading webhook logs...</div>
            ) : webhookLogs.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                No webhook logs yet
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {webhookLogs.map(log => (
                  <div
                    key={log.id}
                    className={`p-3 border rounded-lg ${
                      log.success
                        ? 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800'
                        : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="text-sm flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{log.method}</span>
                          {/* Badge to distinguish email vs SMS webhooks */}
                          {log.url?.includes('/email/webhook') ? (
                            <span className="px-2 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-medium">
                              Email
                            </span>
                          ) : log.url?.includes('/sms/webhook') ? (
                            <span className="px-2 py-0.5 rounded text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 font-medium">
                              SMS
                            </span>
                          ) : null}
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            log.success
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                              : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                          }`}>
                            {log.statusCode || 'N/A'}
                          </span>
                          {log.processingTimeMs !== null && log.processingTimeMs !== undefined && (
                            <span className="text-xs text-muted-foreground">
                              {log.processingTimeMs}ms
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {new Date(log.receivedAt).toLocaleString()}
                        </div>
                        {log.fromNumber && (
                          <div className="text-xs text-muted-foreground mt-1">
                            From: {log.fromNumber} → To: {log.toNumber || 'N/A'}
                          </div>
                        )}
                        {log.messageSid && (
                          <div className="text-xs text-muted-foreground mt-1 font-mono">
                            SID: {log.messageSid}
                          </div>
                        )}
                        {log.error && (
                          <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                            Error: {log.error}
                          </div>
                        )}
                        {log.ip && (
                          <div className="text-xs text-muted-foreground mt-1">
                            IP: {log.ip}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 space-y-2">
                      {log.headers && Object.keys(log.headers).length > 0 && (() => {
                        const headersKey = `${log.id}-headers`;
                        const isExpanded = expandedLogSections.has(headersKey);
                        return (
                          <div className="border-t border-gray-200 dark:border-gray-700 pt-2">
                            <button
                              onClick={() => {
                                const newSet = new Set(expandedLogSections);
                                if (isExpanded) {
                                  newSet.delete(headersKey);
                                } else {
                                  newSet.add(headersKey);
                                }
                                setExpandedLogSections(newSet);
                              }}
                              className="flex items-center gap-2 w-full text-left text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <ChevronDown 
                                size={14} 
                                className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                              />
                              View request headers
                            </button>
                            {isExpanded && (
                              <div className="mt-2 animate-in slide-in-from-top-2 duration-200">
                                <pre className="text-xs p-2 bg-white dark:bg-gray-800 rounded border overflow-x-auto">
                                  {JSON.stringify(log.headers, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      {log.body && Object.keys(log.body).length > 0 && (() => {
                        const bodyKey = `${log.id}-body`;
                        const isExpanded = expandedLogSections.has(bodyKey);
                        return (
                          <div className="border-t border-gray-200 dark:border-gray-700 pt-2">
                            <button
                              onClick={() => {
                                const newSet = new Set(expandedLogSections);
                                if (isExpanded) {
                                  newSet.delete(bodyKey);
                                } else {
                                  newSet.add(bodyKey);
                                }
                                setExpandedLogSections(newSet);
                              }}
                              className="flex items-center gap-2 w-full text-left text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <ChevronDown 
                                size={14} 
                                className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                              />
                              View request body
                            </button>
                            {isExpanded && (
                              <div className="mt-2 animate-in slide-in-from-top-2 duration-200">
                                <pre className="text-xs p-2 bg-white dark:bg-gray-800 rounded border overflow-x-auto">
                                  {JSON.stringify(log.body, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      {log.rawBody && (() => {
                        const rawBodyKey = `${log.id}-raw-body`;
                        const isExpanded = expandedLogSections.has(rawBodyKey);
                        return (
                          <div className="border-t border-gray-200 dark:border-gray-700 pt-2">
                            <button
                              onClick={() => {
                                const newSet = new Set(expandedLogSections);
                                if (isExpanded) {
                                  newSet.delete(rawBodyKey);
                                } else {
                                  newSet.add(rawBodyKey);
                                }
                                setExpandedLogSections(newSet);
                              }}
                              className="flex items-center gap-2 w-full text-left text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <ChevronDown 
                                size={14} 
                                className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                              />
                              View raw request data
                            </button>
                            {isExpanded && (
                              <div className="mt-2 animate-in slide-in-from-top-2 duration-200">
                                <pre className="text-xs p-2 bg-white dark:bg-gray-800 rounded border overflow-x-auto font-mono whitespace-pre-wrap break-words">
                                  {log.rawBody}
                                </pre>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </Page>
  );
}

export default VaultSetup;

