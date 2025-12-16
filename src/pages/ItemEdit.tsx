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

  async function startSmsPolling() {
    if (pollingSms) return;
    
    setPollingSms(true);
    setOtpCode(null);
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
              setPollingSms(false);
              if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
              }
              return;
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

  function stopSmsPolling() {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setPollingSms(false);
  }

  async function handleSave() {
    try {
      setSaving(true);
      // Stop polling if active
      stopSmsPolling();
      
      const itemData = {
        ...formData,
        // Note: Password and 2FA settings would need to be encrypted and stored in secretBlobEncrypted
        // This is a simplified version - actual implementation would need proper encryption
      };
      
      if (itemId) {
        await vaultApi.updateItem(itemId, itemData);
      } else {
        await vaultApi.createItem(itemData as InsertVaultItem);
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
            <label className="text-sm font-medium">URL</label>
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
                  
                  {!pollingSms && !otpCode && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={startSmsPolling}
                    >
                      Start Waiting for SMS
                    </Button>
                  )}
                  
                  {pollingSms && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Waiting for SMS message...
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
            <div className="p-4 bg-secondary rounded-md">
              <label className="text-sm font-medium">QR Code</label>
              <p className="text-sm text-muted-foreground mt-2">
                Upload a QR code image or paste the TOTP secret URI
              </p>
              {/* QR code upload/input would go here */}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => navigate('/vault/personal')}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} disabled={saving || !formData.title}>
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
