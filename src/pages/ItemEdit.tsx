'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useUi } from '@hit/ui-kit';
import { Save, Copy, Check } from 'lucide-react';
import { vaultApi } from '../services/vault-api';
import type { InsertVaultItem } from '../schema/vault';
import { extractOtpCode } from '../utils/otp-extractor';

interface Props {
  itemId?: string;
  onNavigate?: (path: string) => void;
}

type TwoFactorType = 'off' | 'qr' | 'phone';

export function ItemEdit({ itemId, onNavigate }: Props) {
  const { Page, Card, Button, Input, Alert, Select } = useUi();
  const [loading, setLoading] = useState(!!itemId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [formData, setFormData] = useState<Partial<InsertVaultItem>>({
    title: '',
    username: '',
    url: '',
    tags: [],
  });
  const [password, setPassword] = useState('');
  const [twoFactorType, setTwoFactorType] = useState<TwoFactorType>('off');
  const [globalPhoneNumber, setGlobalPhoneNumber] = useState<string | null>(null);
  const [phoneCopied, setPhoneCopied] = useState(false);
  const [pollingSms, setPollingSms] = useState(false);
  const [otpCode, setOtpCode] = useState<string | null>(null);
  const [latestMessageTime, setLatestMessageTime] = useState<Date | null>(null);
  const [qrCodeInput, setQrCodeInput] = useState('');
  const [qrCodePasteMode, setQrCodePasteMode] = useState(false);
  const [userPhoneNumber, setUserPhoneNumber] = useState('');
  const [sendingSmsRequest, setSendingSmsRequest] = useState(false);
  const lastPollTimeRef = useRef<Date | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const navigate = (path: string) => {
    if (onNavigate) onNavigate(path);
    else if (typeof window !== 'undefined') window.location.href = path;
  };

  useEffect(() => {
    if (itemId) {
      loadItem();
    }
    loadGlobalPhoneNumber();
  }, [itemId]);

  useEffect(() => {
    // Cleanup polling on unmount
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  async function loadItem() {
    try {
      setLoading(true);
      const item = await vaultApi.getItem(itemId!);
      setFormData({
        title: item.title,
        username: item.username || '',
        url: item.url || '',
        tags: item.tags || [],
      });
      // Note: Password and 2FA type would need to be loaded from revealed secrets
      // For now, we'll handle them separately
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load item'));
    } finally {
      setLoading(false);
    }
  }

  async function loadGlobalPhoneNumber() {
    try {
      const result = await vaultApi.getGlobalPhoneNumber();
      setGlobalPhoneNumber(result.phoneNumber);
    } catch (err) {
      // Silently fail - global phone number may not be set
      console.error('Failed to load global phone number:', err);
    }
  }

  async function copyPhoneNumber() {
    if (!globalPhoneNumber) return;
    try {
      await navigator.clipboard.writeText(globalPhoneNumber);
      setPhoneCopied(true);
      setTimeout(() => setPhoneCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy phone number:', err);
    }
  }

  async function sendSmsRequest() {
    if (!itemId) {
      setError(new Error('Please save the item first before requesting SMS 2FA'));
      return;
    }

    if (!userPhoneNumber.trim()) {
      setError(new Error('Please enter your phone number'));
      return;
    }

    try {
      setSendingSmsRequest(true);
      setError(null);
      await vaultApi.requestSms2fa(itemId, userPhoneNumber.trim());
      // After sending SMS request, start polling for the response
      await startSmsPolling();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to send SMS request'));
    } finally {
      setSendingSmsRequest(false);
    }
  }

  async function startSmsPolling() {
    if (pollingSms) return;
    
    setPollingSms(true);
    setOtpCode(null);
    setLatestMessageTime(null);
    lastPollTimeRef.current = new Date();

    // Poll every 2 seconds
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const since = lastPollTimeRef.current?.toISOString();
        const result = await vaultApi.getLatestSmsMessages(since);
        
        // Check each message for OTP code
        for (const msg of result.messages) {
          try {
            const revealResult = await vaultApi.revealSmsMessage(msg.id);
            const code = extractOtpCode(revealResult.body);
            if (code) {
              setOtpCode(code);
              setLatestMessageTime(new Date(msg.receivedAt));
              setPollingSms(false);
              if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
              }
              return;
            }
            // Update latest message time even if no code extracted
            if (msg.receivedAt) {
              setLatestMessageTime(new Date(msg.receivedAt));
            }
          } catch (err) {
            console.error('Failed to reveal SMS message:', err);
          }
        }
        
        lastPollTimeRef.current = new Date();
      } catch (err) {
        console.error('Failed to poll SMS messages:', err);
      }
    }, 2000);

    // Stop polling after 5 minutes
    setTimeout(() => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      setPollingSms(false);
    }, 5 * 60 * 1000);
  }

  function formatTimeAgo(date: Date | null): string {
    if (!date) return '';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffSecs < 60) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${Math.floor(diffHours / 24)} day${Math.floor(diffHours / 24) > 1 ? 's' : ''} ago`;
  }

  async function handleQrCodePaste() {
    if (!qrCodeInput.trim()) return;
    
    // If no itemId, we'll save it when the item is created
    if (!itemId) {
      // Store QR code input to be saved with the item
      setQrCodePasteMode(true);
      return;
    }
    
    try {
      setSaving(true);
      await vaultApi.importTotp(itemId, qrCodeInput.trim());
      setQrCodeInput('');
      setQrCodePasteMode(false);
      setTwoFactorType('qr');
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to import QR code'));
    } finally {
      setSaving(false);
    }
  }

  async function handlePasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      setQrCodeInput(text);
      setQrCodePasteMode(true);
    } catch (err) {
      console.error('Failed to read clipboard:', err);
      setError(new Error('Failed to read clipboard. Please paste manually.'));
    }
  }

  function stopSmsPolling() {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setPollingSms(false);
  }

  async function handleSave() {
    if (!formData.title?.trim()) {
      setError(new Error('Title is required'));
      return;
    }
    if (!formData.url?.trim()) {
      setError(new Error('URL is required for Login items'));
      return;
    }
    try {
      setSaving(true);
      // Stop polling if active
      stopSmsPolling();
      
      const itemData: any = {
        ...formData,
        password: password, // Will be encrypted on backend
      };
      
      let savedItem;
      if (itemId) {
        savedItem = await vaultApi.updateItem(itemId, itemData);
      } else {
        savedItem = await vaultApi.createItem(itemData as InsertVaultItem);
      }
      
      // If QR code was pasted but item didn't exist, import it now
      if (qrCodeInput.trim() && savedItem.id) {
        try {
          await vaultApi.importTotp(savedItem.id, qrCodeInput.trim());
        } catch (err) {
          console.error('Failed to import TOTP after save:', err);
          // Don't fail the save if TOTP import fails
        }
      }
      
      navigate('/vault/personal');
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to save item'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Page title="Loading..." description="">
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      </Page>
    );
  }

  return (
    <Page
      title={itemId ? 'Edit Item' : 'New Item'}
      description="Enter the credential information"
    >
      {error && (
        <Alert variant="error" title="Error">
          {error.message}
        </Alert>
      )}

      <Card>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-sm font-medium">Title</label>
            <Input
              value={formData.title || ''}
              onChange={(value: string) => setFormData({ ...formData, title: value })}
              placeholder="e.g., GitHub Account"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Username</label>
            <Input
              value={formData.username || ''}
              onChange={(value: string) => setFormData({ ...formData, username: value })}
              placeholder="username or email"
            />
          </div>

          <div>
            <label className="text-sm font-medium">URL *</label>
            <Input
              value={formData.url || ''}
              onChange={(value: string) => setFormData({ ...formData, url: value })}
              placeholder="https://example.com"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Password</label>
            <Input
              type="password"
              value={password}
              onChange={(value: string) => setPassword(value)}
              placeholder="Enter password"
            />
          </div>

          <div>
            <label className="text-sm font-medium">2FA</label>
            <Select
              value={twoFactorType}
              onChange={(value: string) => {
                const newType = value as TwoFactorType;
                setTwoFactorType(newType);
                if (newType !== 'phone') {
                  stopSmsPolling();
                  setOtpCode(null);
                }
              }}
              options={[
                { value: 'off', label: 'Off' },
                { value: 'qr', label: 'QR Code' },
                { value: 'phone', label: 'Phone Number' },
              ]}
            />
          </div>

          {twoFactorType === 'phone' && (
            <div className="p-4 bg-secondary rounded-md space-y-3">
              {globalPhoneNumber ? (
                <>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Registered Phone Number
                    </label>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-sm font-mono bg-background px-2 py-1 rounded">
                        {globalPhoneNumber}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={copyPhoneNumber}
                        title="Copy to clipboard"
                      >
                        {phoneCopied ? (
                          <Check size={16} className="text-green-600" />
                        ) : (
                          <Copy size={16} />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Copy this number and use it for 2FA setup on the website
                    </p>
                  </div>

                  {itemId && (
                    <div>
                      <label className="text-sm font-medium">
                        Your Phone Number (E.164 format)
                      </label>
                      <Input
                        value={userPhoneNumber}
                        onChange={(value: string) => setUserPhoneNumber(value)}
                        placeholder="+1234567890"
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Enter your phone number to receive 2FA code requests
                      </p>
                    </div>
                  )}
                  
                  {!pollingSms && !otpCode && (
                    <div className="flex gap-2">
                      {itemId && userPhoneNumber.trim() && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={sendSmsRequest}
                          disabled={sendingSmsRequest}
                        >
                          {sendingSmsRequest ? 'Sending...' : 'Send SMS Request'}
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={startSmsPolling}
                      >
                        Start Waiting for SMS
                      </Button>
                    </div>
                  )}
                  
                  {pollingSms && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        {latestMessageTime 
                          ? `Waiting for SMS message... Last message: ${formatTimeAgo(latestMessageTime)}`
                          : 'Waiting for SMS message...'}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={stopSmsPolling}
                      >
                        Stop Polling
                      </Button>
                    </div>
                  )}
                  
                  {otpCode && (
                    <div className="p-3 bg-background rounded-md border-2 border-green-500">
                      <label className="text-sm font-medium text-green-600">
                        OTP Code Received
                        {latestMessageTime && (
                          <span className="text-xs font-normal text-muted-foreground ml-2">
                            ({formatTimeAgo(latestMessageTime)})
                          </span>
                        )}
                      </label>
                      <div className="flex items-center gap-2 mt-2">
                        <code className="text-2xl font-mono font-bold">
                          {otpCode}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(otpCode);
                            setPhoneCopied(true);
                            setTimeout(() => setPhoneCopied(false), 2000);
                          }}
                        >
                          <Copy size={16} />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <Alert variant="warning" title="No Phone Number Configured">
                  A global admin must configure a phone number in the vault settings.
                </Alert>
              )}
            </div>
          )}

          {twoFactorType === 'qr' && (
            <div className="p-4 bg-secondary rounded-md space-y-3">
              <div>
                <label className="text-sm font-medium">QR Code / TOTP Secret</label>
                <p className="text-sm text-muted-foreground mt-1 mb-2">
                  Paste the TOTP secret URI (otpauth://totp/...) or base32 secret
                </p>
                <div className="flex gap-2">
                  <Input
                    value={qrCodeInput}
                    onChange={(value: string) => setQrCodeInput(value)}
                    placeholder="otpauth://totp/... or paste secret"
                    className="flex-1"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handlePasteFromClipboard}
                  >
                    Paste from Clipboard
                  </Button>
                </div>
                {qrCodeInput && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleQrCodePaste}
                    disabled={saving || !itemId}
                    className="mt-2"
                  >
                    Import TOTP Secret
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => navigate('/vault/personal')}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={saving || !formData.title?.trim() || !formData.url?.trim()}
            >
              <Save size={16} className="mr-2" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </Card>
    </Page>
  );
}

export default ItemEdit;
