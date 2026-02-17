'use client';

import { useState } from 'react';
import { AdminLayout } from '@/components/admin/admin-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DollarSign, Shield, Bell } from 'lucide-react';

interface MonetizationSettings {
  creditsPerAdView: number;
  dailyAdLimit: number;
  authorRevenueShare: number;
  minimumPayout: number;
}

interface ModerationSettings {
  warningThreshold: number;
  autoFlagThreshold: number;
}

interface NotificationSettings {
  emailBatchInterval: number;
  pushCooldown: number;
}

export default function AdminSettingsPage() {
  const [monetization, setMonetization] = useState<MonetizationSettings>({
    creditsPerAdView: 5,
    dailyAdLimit: 10,
    authorRevenueShare: 70,
    minimumPayout: 50,
  });

  const [moderation, setModeration] = useState<ModerationSettings>({
    warningThreshold: 3,
    autoFlagThreshold: 5,
  });

  const [notifications, setNotifications] = useState<NotificationSettings>({
    emailBatchInterval: 24,
    pushCooldown: 30,
  });

  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const handleSave = (section: string) => {
    // TODO: Wire up to backend API when admin settings endpoint is implemented
    setSaveMessage(`${section} settings saved locally. Backend persistence not yet implemented.`);
    setTimeout(() => setSaveMessage(null), 3000);
  };

  return (
    <AdminLayout
      title="Settings"
      description="Platform configuration and feature management"
    >
      <div className="space-y-6">
        {saveMessage && (
          <div className="p-3 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-200">
            {saveMessage}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Monetization Settings
            </CardTitle>
            <CardDescription>
              Configure credit rates, ad limits, and pricing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Credits per Ad View</label>
                <Input
                  type="number"
                  value={monetization.creditsPerAdView}
                  onChange={(e) => setMonetization(prev => ({ ...prev, creditsPerAdView: +e.target.value }))}
                  min={1}
                  max={50}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Daily Ad Limit</label>
                <Input
                  type="number"
                  value={monetization.dailyAdLimit}
                  onChange={(e) => setMonetization(prev => ({ ...prev, dailyAdLimit: +e.target.value }))}
                  min={1}
                  max={100}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Author Revenue Share (%)</label>
                <Input
                  type="number"
                  value={monetization.authorRevenueShare}
                  onChange={(e) => setMonetization(prev => ({ ...prev, authorRevenueShare: +e.target.value }))}
                  min={0}
                  max={100}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Minimum Payout ($)</label>
                <Input
                  type="number"
                  value={monetization.minimumPayout}
                  onChange={(e) => setMonetization(prev => ({ ...prev, minimumPayout: +e.target.value }))}
                  min={1}
                />
              </div>
            </div>
            <Button onClick={() => handleSave('Monetization')}>Save Monetization Settings</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Moderation Settings
            </CardTitle>
            <CardDescription>
              Configure content moderation rules and thresholds
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Warning Threshold (Strikes)</label>
                <Input
                  type="number"
                  value={moderation.warningThreshold}
                  onChange={(e) => setModeration(prev => ({ ...prev, warningThreshold: +e.target.value }))}
                  min={1}
                  max={10}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Auto-flag Reports Threshold</label>
                <Input
                  type="number"
                  value={moderation.autoFlagThreshold}
                  onChange={(e) => setModeration(prev => ({ ...prev, autoFlagThreshold: +e.target.value }))}
                  min={1}
                  max={50}
                />
              </div>
            </div>
            <Button onClick={() => handleSave('Moderation')}>Save Moderation Settings</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notification Settings
            </CardTitle>
            <CardDescription>
              Configure system-wide notification preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Email Notification Batch Interval (hours)</label>
                <Input
                  type="number"
                  value={notifications.emailBatchInterval}
                  onChange={(e) => setNotifications(prev => ({ ...prev, emailBatchInterval: +e.target.value }))}
                  min={1}
                  max={168}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Push Notification Cooldown (minutes)</label>
                <Input
                  type="number"
                  value={notifications.pushCooldown}
                  onChange={(e) => setNotifications(prev => ({ ...prev, pushCooldown: +e.target.value }))}
                  min={5}
                  max={1440}
                />
              </div>
            </div>
            <Button onClick={() => handleSave('Notification')}>Save Notification Settings</Button>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
