'use client';

import { AdminLayout } from '@/components/admin/admin-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Settings, DollarSign, Shield, Bell } from 'lucide-react';

export default function AdminSettingsPage() {
  return (
    <AdminLayout
      title="Settings"
      description="Platform configuration and feature management"
    >
      <div className="space-y-6">
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
                <Input type="number" defaultValue={5} min={1} max={50} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Daily Ad Limit</label>
                <Input type="number" defaultValue={10} min={1} max={100} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Author Revenue Share (%)</label>
                <Input type="number" defaultValue={70} min={0} max={100} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Minimum Payout ($)</label>
                <Input type="number" defaultValue={50} min={1} />
              </div>
            </div>
            <Button>Save Monetization Settings</Button>
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
                <Input type="number" defaultValue={3} min={1} max={10} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Auto-flag Reports Threshold</label>
                <Input type="number" defaultValue={5} min={1} max={50} />
              </div>
            </div>
            <Button>Save Moderation Settings</Button>
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
                <Input type="number" defaultValue={24} min={1} max={168} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Push Notification Cooldown (minutes)</label>
                <Input type="number" defaultValue={30} min={5} max={1440} />
              </div>
            </div>
            <Button>Save Notification Settings</Button>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
