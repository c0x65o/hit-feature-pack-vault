'use client';

import React, { useState, useEffect } from 'react';
import { useUi, type BreadcrumbItem } from '@hit/ui-kit';
import { Save, Trash2, AlertCircle, Mail, Copy, RefreshCw, Lock as LockIcon, Settings, Activity } from 'lucide-react';
import { vaultApi } from '../services/vault-api';
import type { VaultSmsNumber, VaultSmsMessage, VaultWebhookLog } from '../schema/vault';
import { extractOtpCode } from '../utils/otp-extractor';

interface Props {
  onNavigate?: (path: string) => void;
}

export function VaultSetup({ onNavigate }: Props) {
  const { Page, Card, Button, Input, Alert } = useUi();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [currentPhoneNumber, setCurrentPhoneNumber] = useState<string | null>(null);
  const [smsNumbers, setSmsNumbers] = useState<VaultSmsNumber[]>([]);
  const [selectedSmsNumberId, setSelectedSmsNumberId] = useState<string | null>(null);
  const [messages, setMessages] = useState<VaultSmsMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [revealedMessages, setRevealedMessages] = useState<Map<string, string>>(new Map());
  const [webhookLogs, setWebhookLogs] = useState<VaultWebhookLog[]>([]);
  const [loadingWebhookLogs, setLoadingWebhookLogs] = useState(false);

  const navigate = (path: string) => {
    if (onNavigate) onNavigate(path);
    else if (typeof window !== 'undefined') window.location.href = path;
  };

  useEffect(() => {
    loadData();
    loadWebhookLogs();
  }, []);

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
      const [phoneResult, numbers] = await Promise.all([
        vaultApi.getGlobalPhoneNumber(),
        vaultApi.getSmsNumbers(),
      ]);
      setCurrentPhoneNumber(phoneResult.phoneNumber);
      setPhoneNumber(phoneResult.phoneNumber || '');
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

  async function handleSave() {
    if (!phoneNumber.trim()) {
      setError(new Error('Phone number is required'));
      return;
    }

    // Basic phone number validation (E.164 format)
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phoneNumber.trim())) {
      setError(new Error('Phone number must be in E.164 format (e.g., +1234567890)'));
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await vaultApi.setGlobalPhoneNumber(phoneNumber.trim());
      setCurrentPhoneNumber(phoneNumber.trim());
      await loadData(); // Reload to refresh SMS numbers
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to save phone number'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete the phone number? This will disable SMS 2FA for all vault items.')) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await vaultApi.deleteGlobalPhoneNumber();
      setCurrentPhoneNumber(null);
      setPhoneNumber('');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to delete phone number'));
    } finally {
      setSaving(false);
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

  async function handleCopyPhoneNumber() {
    if (currentPhoneNumber) {
      await navigator.clipboard.writeText(currentPhoneNumber);
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
      description="Configure project SMS 2FA phone number and view inbox for debugging"
    >
      {error && (
        <Alert variant="error" title="Error">
          {error.message}
        </Alert>
      )}

      <div className="space-y-6">
        {/* Phone Number Configuration */}
        <Card>
          <div className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">Project SMS 2FA Number</h2>
            
            <div>
              <label className="text-sm font-medium">Phone Number</label>
              <p className="text-xs text-muted-foreground mt-1 mb-2">
                Enter the phone number in E.164 format (e.g., +1234567890).
                This number will be used for receiving 2FA codes for all vault items.
                Supports F-Droid (Android phone) or Twilio integrations.
              </p>
              <div className="flex items-center gap-2">
                <Input
                  value={phoneNumber}
                  onChange={(value: string) => setPhoneNumber(value)}
                  placeholder="+1234567890"
                  className="flex-1"
                />
                {currentPhoneNumber && (
                  <Button
                    variant="secondary"
                    onClick={handleCopyPhoneNumber}
                    title="Copy phone number"
                  >
                    <Copy size={16} />
                  </Button>
                )}
              </div>
            </div>

            {currentPhoneNumber && (
              <Alert variant="info" title="Current Configuration">
                <p className="text-sm mt-2">
                  Current phone number: <code className="font-mono">{currentPhoneNumber}</code>
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Configure F-Droid or Twilio to send webhooks to:{' '}
                  <code className="font-mono text-xs">
                    {typeof window !== 'undefined' 
                      ? `${window.location.origin}/api/vault/sms/webhook/inbound`
                      : '/api/vault/sms/webhook/inbound'}
                  </code>
                  <br />
                  <span className="mt-1 block">
                    For F-Droid: Set Authorization header to <code className="font-mono">Bearer {'<API_KEY>'}</code> or use X-API-Key header.
                  </span>
                </p>
              </Alert>
            )}

            {!currentPhoneNumber && (
              <Alert variant="warning" title="No Phone Number Configured">
                <p className="text-sm mt-2">
                  No phone number is currently configured. Users will not be able to use SMS 2FA until a phone number is set up.
                </p>
              </Alert>
            )}

            <div className="flex justify-end gap-2">
              {currentPhoneNumber && (
                <Button
                  variant="secondary"
                  onClick={handleDelete}
                  disabled={saving}
                >
                  <Trash2 size={16} className="mr-2" />
                  Delete
                </Button>
              )}
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={saving || !phoneNumber.trim()}
              >
                <Save size={16} className="mr-2" />
                {saving ? 'Saving...' : 'Save'}
              </Button>
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
                        const messageBody = isRevealed ? revealedBody : '••••••••';
                        const otpCode = isRevealed && revealedBody ? extractOtpCode(revealedBody) : null;

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
                            
                            {otpCode && (
                              <div className="mb-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-md border-2 border-green-500">
                                <div className="flex items-center justify-between mb-2">
                                  <label className="text-sm font-medium text-green-600 dark:text-green-400">
                                    OTP Code Detected
                                  </label>
                                  <span className="text-xs text-muted-foreground">
                                    {formatTimeAgo(msg.receivedAt)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <code className="text-2xl font-mono font-bold">
                                    {otpCode}
                                  </code>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => navigator.clipboard.writeText(otpCode)}
                                    title="Copy OTP code"
                                  >
                                    <Copy size={16} />
                                  </Button>
                                </div>
                              </div>
                            )}
                            
                            <div className="text-sm font-mono bg-white dark:bg-gray-800 p-2 rounded border">
                              {messageBody}
                            </div>
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
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{log.method}</span>
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            log.success
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                              : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                          }`}>
                            {log.statusCode || 'N/A'}
                          </span>
                          {log.processingTimeMs && (
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
                    {log.body && Object.keys(log.body).length > 0 && (
                      <details className="mt-2">
                        <summary className="text-xs text-muted-foreground cursor-pointer">
                          View request body
                        </summary>
                        <pre className="text-xs mt-2 p-2 bg-white dark:bg-gray-800 rounded border overflow-x-auto">
                          {JSON.stringify(log.body, null, 2)}
                        </pre>
                      </details>
                    )}
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

