'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useUi, type BreadcrumbItem } from '@hit/ui-kit';
import { Eye, EyeOff, Copy, Edit, Check, RefreshCw, Key, FileText, Lock, Mail, MessageSquare } from 'lucide-react';
import { vaultApi } from '../services/vault-api';
import type { VaultItem } from '../schema/vault';
import { extractOtpWithConfidence } from '../utils/otp-extractor';

interface Props {
  itemId: string;
  onNavigate?: (path: string) => void;
}

export function ItemDetail({ itemId, onNavigate }: Props) {
  const { Page, Card, Button, Alert } = useUi();
  const [item, setItem] = useState<VaultItem | null>(null);
  const [revealed, setRevealed] = useState<{ password?: string; secret?: string; notes?: string; totpSecret?: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [totpCode, setTotpCode] = useState<string | null>(null);
  const [totpExpiresAt, setTotpExpiresAt] = useState<Date | null>(null);
  const [copied, setCopied] = useState<{ [key: string]: boolean }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // Email OTP state
  const [globalEmailAddress, setGlobalEmailAddress] = useState<string | null>(null);
  const [emailCopied, setEmailCopied] = useState(false);
  const [pollingEmail, setPollingEmail] = useState(false);
  const [emailOtpCode, setEmailOtpCode] = useState<string | null>(null);
  const [emailOtpConfidence, setEmailOtpConfidence] = useState<'high' | 'medium' | 'low' | 'none'>('none');
  const [emailOtpFullMessage, setEmailOtpFullMessage] = useState<string | null>(null);
  const [showFullEmailMessage, setShowFullEmailMessage] = useState(false);
  const [latestEmailMessageTime, setLatestEmailMessageTime] = useState<Date | null>(null);
  const pollingEmailIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastEmailPollTimeRef = useRef<Date | null>(null);

  const navigate = (path: string) => {
    if (onNavigate) onNavigate(path);
    else if (typeof window !== 'undefined') window.location.href = path;
  };

  useEffect(() => {
    if (itemId) {
      loadItem();
    }
    loadGlobalEmailAddress();
    
    // Cleanup polling on unmount
    return () => {
      if (pollingEmailIntervalRef.current) {
        clearInterval(pollingEmailIntervalRef.current);
      }
    };
  }, [itemId]);

  useEffect(() => {
    // Auto-refresh TOTP code every 30 seconds
    if (revealed?.totpSecret) {
      generateTotpCode();
      const interval = setInterval(() => {
        generateTotpCode();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [revealed?.totpSecret]);

  async function loadItem() {
    try {
      setLoading(true);
      const itemData = await vaultApi.getItem(itemId);
      setItem(itemData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load item'));
    } finally {
      setLoading(false);
    }
  }

  async function loadGlobalEmailAddress() {
    try {
      const result = await vaultApi.getGlobalEmailAddress();
      setGlobalEmailAddress(result.emailAddress);
    } catch (err) {
      console.error('Failed to load global email address:', err);
    }
  }

  async function copyEmailAddress() {
    if (!globalEmailAddress) return;
    try {
      await navigator.clipboard.writeText(globalEmailAddress);
      setEmailCopied(true);
      setTimeout(() => setEmailCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy email address:', err);
    }
  }

  async function startEmailPolling() {
    if (pollingEmail || !item || !globalEmailAddress) return;
    
    // Check if item username matches global email address
    if (item.username?.toLowerCase() !== globalEmailAddress.toLowerCase()) {
      setError(new Error('Item username does not match configured email address'));
      return;
    }
    
    setPollingEmail(true);
    setEmailOtpCode(null);
    setEmailOtpConfidence('none');
    setEmailOtpFullMessage(null);
    setShowFullEmailMessage(false);
    setLatestEmailMessageTime(null);
    lastEmailPollTimeRef.current = new Date();

    // Poll every 2 seconds
    pollingEmailIntervalRef.current = setInterval(async () => {
      try {
        const since = lastEmailPollTimeRef.current?.toISOString();
        const result = await vaultApi.getLatestEmailMessages({ 
          since,
          email: globalEmailAddress 
        });
        
        // Check each message for OTP code
        for (const msg of result.messages) {
          try {
            const revealResult = await vaultApi.revealSmsMessage(msg.id);
            const otpResult = extractOtpWithConfidence(revealResult.body);
            if (otpResult.code) {
              setEmailOtpCode(otpResult.code);
              setEmailOtpConfidence(otpResult.confidence);
              setEmailOtpFullMessage(otpResult.fullMessage);
              setLatestEmailMessageTime(new Date(msg.receivedAt));
              setPollingEmail(false);
              if (pollingEmailIntervalRef.current) {
                clearInterval(pollingEmailIntervalRef.current);
                pollingEmailIntervalRef.current = null;
              }
              return;
            }
            // Update latest message time even if no code extracted
            if (msg.receivedAt) {
              setLatestEmailMessageTime(new Date(msg.receivedAt));
            }
          } catch (err) {
            console.error('Failed to reveal email message:', err);
          }
        }
        
        lastEmailPollTimeRef.current = new Date();
      } catch (err) {
        console.error('Failed to poll email messages:', err);
      }
    }, 2000);

    // Stop polling after 5 minutes
    setTimeout(() => {
      if (pollingEmailIntervalRef.current) {
        clearInterval(pollingEmailIntervalRef.current);
        pollingEmailIntervalRef.current = null;
      }
      setPollingEmail(false);
    }, 5 * 60 * 1000);
  }

  function stopEmailPolling() {
    if (pollingEmailIntervalRef.current) {
      clearInterval(pollingEmailIntervalRef.current);
      pollingEmailIntervalRef.current = null;
    }
    setPollingEmail(false);
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

  async function handleReveal() {
    if (!item) return;
    try {
      const revealedData = await vaultApi.revealItem(item.id);
      setRevealed(revealedData);
      // Don't auto-show - user must click eye icon to reveal
      setShowPassword(false);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to reveal item'));
    }
  }

  async function generateTotpCode() {
    if (!item || !revealed?.totpSecret) return;
    try {
      const result = await vaultApi.generateTotpCode(item.id);
      setTotpCode(result.code);
      setTotpExpiresAt(new Date(result.expiresAt));
    } catch (err) {
      console.error('Failed to generate TOTP code:', err);
    }
  }

  async function handleCopy(field: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied({ ...copied, [field]: true });
      setTimeout(() => {
        setCopied({ ...copied, [field]: false });
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to copy'));
    }
  }

  function getItemIcon() {
    if (!item) return <Lock size={20} />;
    switch (item.type) {
      case 'api_key':
        return <Key size={20} />;
      case 'secure_note':
        return <FileText size={20} />;
      default:
        return <Lock size={20} />;
    }
  }

  if (loading) {
    return (
      <Page title="Loading..." description="">
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      </Page>
    );
  }

  const breadcrumbs: BreadcrumbItem[] = [
    { label: 'Vault', href: '/vault/personal', icon: <Lock size={14} /> },
    ...(item?.folderId ? [{ label: 'Folder', href: `/vault/folders/${item.folderId}` }] : []),
    { label: item?.title || 'Item' },
  ];

  return (
    <Page
      title={item?.title || 'Item not found'}
      description={item?.url || ''}
      breadcrumbs={breadcrumbs}
      onNavigate={navigate}
      actions={
        item ? (
          <Button variant="primary" onClick={() => navigate(`/vault/items/${item.id}/edit`)}>
            <Edit size={16} className="mr-2" />
            Edit
          </Button>
        ) : undefined
      }
    >
      {error && (
        <Alert variant="error" title="Error">
          {error.message}
        </Alert>
      )}

      {!item && (
        <Card>
          <div className="p-6 text-center text-muted-foreground">
            Item not found
          </div>
        </Card>
      )}

      {item && (
        <div className="space-y-4">
          <Card>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                {getItemIcon()}
                <div className="flex-1">
                  <h2 className="text-xl font-semibold">{item.title}</h2>
                </div>
              </div>

              {item.url && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">URL</label>
                  <div className="flex items-center gap-2 mt-1">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline flex-1"
                    >
                      {item.url}
                    </a>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy('url', item.url!)}
                    >
                      {copied.url ? (
                        <Check size={16} className="text-green-600" />
                      ) : (
                        <Copy size={16} />
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {item.username && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Username</label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-sm font-mono bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-2 rounded flex-1">
                      {item.username}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy('username', item.username!)}
                    >
                      {copied.username ? (
                        <Check size={16} className="text-green-600" />
                      ) : (
                        <Copy size={16} />
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {item.type === 'credential' && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Password</label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-sm font-mono bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-2 rounded flex-1">
                      {revealed?.password && showPassword ? revealed.password : '••••••••'}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        if (!revealed?.password) {
                          await handleReveal();
                          setShowPassword(true);
                        } else {
                          setShowPassword(!showPassword);
                        }
                      }}
                    >
                      {revealed?.password && showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </Button>
                    {revealed?.password && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy('password', revealed.password!)}
                      >
                        {copied.password ? (
                          <Check size={16} className="text-green-600" />
                        ) : (
                          <Copy size={16} />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {item.type === 'api_key' && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Secret / Key</label>
                  <div className="relative mt-1">
                    {revealed?.secret || revealed?.password ? (
                      <>
                        <textarea
                          value={showPassword ? (revealed.secret || revealed.password) : '•'.repeat(Math.max((revealed.secret || revealed.password || '').length, 50))}
                          readOnly
                          className="w-full px-3 py-2 border rounded-md min-h-[200px] font-mono text-sm bg-secondary"
                          style={{
                            ...(showPassword ? {} : { 
                              caretColor: 'transparent',
                            })
                          }}
                        />
                        <div className="absolute top-2 right-2 flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowPassword(!showPassword)}
                            title={showPassword ? 'Hide key' : 'Show key'}
                          >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopy('secret', revealed.secret || revealed.password!)}
                            title="Copy key"
                          >
                            {copied.secret ? (
                              <Check size={16} className="text-green-600" />
                            ) : (
                              <Copy size={16} />
                            )}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <textarea
                          value="••••••••"
                          readOnly
                          className="w-full px-3 py-2 border rounded-md min-h-[200px] font-mono text-sm bg-secondary"
                        />
                        <div className="absolute top-2 right-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleReveal}
                            title="Reveal secret"
                          >
                            <Eye size={16} />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {revealed?.totpSecret && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">2FA Code (TOTP)</label>
                  <div className="flex items-center gap-2 mt-1">
                    {totpCode ? (
                      <>
                        <code className="text-2xl font-mono font-bold bg-secondary px-4 py-2 rounded">
                          {totpCode}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={generateTotpCode}
                          title="Refresh code"
                        >
                          <RefreshCw size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopy('totp', totpCode)}
                        >
                          {copied.totp ? (
                            <Check size={16} className="text-green-600" />
                          ) : (
                            <Copy size={16} />
                          )}
                        </Button>
                      </>
                    ) : (
                      <Button variant="secondary" onClick={generateTotpCode}>
                        Generate TOTP Code
                      </Button>
                    )}
                  </div>
                  {totpExpiresAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Expires in {Math.ceil((totpExpiresAt.getTime() - Date.now()) / 1000)}s
                    </p>
                  )}
                </div>
              )}

              {item.type === 'credential' && item.username && globalEmailAddress && 
               item.username.toLowerCase() === globalEmailAddress.toLowerCase() && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">2FA Code (Email)</label>
                  <div className="mt-1 space-y-3">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                        <Mail size={14} />
                        2FA Email Address
                      </label>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-sm font-mono bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-2 rounded flex-1">
                          {globalEmailAddress}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={copyEmailAddress}
                        >
                          {emailCopied ? (
                            <Check size={16} className="text-green-600" />
                          ) : (
                            <Copy size={16} />
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        When the service sends a 2FA code to this email, it will be automatically detected.
                      </p>
                    </div>
                    
                    {!pollingEmail && !emailOtpCode && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={startEmailPolling}
                      >
                        <Mail size={16} className="mr-2" />
                        Start Waiting for Email
                      </Button>
                    )}
                    
                    {pollingEmail && (
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-muted-foreground animate-pulse">
                          Waiting for email message...
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={stopEmailPolling}
                        >
                          Stop
                        </Button>
                      </div>
                    )}
                    
                    {emailOtpCode && (
                      <div className={`p-3 bg-secondary rounded-md border-2 ${
                        emailOtpConfidence === 'high' 
                          ? 'border-green-500' 
                          : emailOtpConfidence === 'medium' 
                            ? 'border-yellow-500' 
                            : 'border-gray-400'
                      }`}>
                        <label className={`text-sm font-medium ${
                          emailOtpConfidence === 'high' 
                            ? 'text-green-600' 
                            : emailOtpConfidence === 'medium' 
                              ? 'text-yellow-600' 
                              : 'text-gray-600'
                        }`}>
                          OTP Code Received ({emailOtpConfidence} confidence)
                        </label>
                        <div className="flex items-center gap-2 mt-2">
                          <code className="text-2xl font-mono font-bold">
                            {emailOtpCode}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopy('emailOtp', emailOtpCode)}
                          >
                            {copied.emailOtp ? (
                              <Check size={16} className="text-green-600" />
                            ) : (
                              <Copy size={16} />
                            )}
                          </Button>
                        </div>
                        
                        {emailOtpConfidence !== 'high' && emailOtpFullMessage && (
                          <div className="mt-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowFullEmailMessage(!showFullEmailMessage)}
                            >
                              {showFullEmailMessage ? 'Hide Full Message' : 'Show Full Message'}
                            </Button>
                            {showFullEmailMessage && (
                              <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
                                {emailOtpFullMessage}
                              </div>
                            )}
                          </div>
                        )}
                        
                        {latestEmailMessageTime && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Received {formatTimeAgo(latestEmailMessageTime)}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {(revealed?.notes || item.type === 'secure_note') && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    {item.type === 'secure_note' ? 'Content' : 'Notes'}
                  </label>
                  {revealed?.notes ? (
                    <div className="mt-1 p-3 bg-secondary rounded text-sm whitespace-pre-wrap">
                      {revealed.notes}
                    </div>
                  ) : (
                    <Button variant="secondary" onClick={handleReveal}>
                      <Eye size={16} className="mr-2" />
                      Reveal Note
                    </Button>
                  )}
                </div>
              )}

              {item.tags && item.tags.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Tags</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {item.tags.map(tag => (
                      <span key={tag} className="px-2 py-1 bg-secondary rounded-md text-sm">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </Page>
  );
}

export default ItemDetail;
