'use client';

import { useState } from 'react';
import { AdminLayout } from '@/components/admin/admin-layout';
import { ReportDetailModal } from '@/components/admin/report-detail-modal';
import { useModeration } from '@/hooks/use-moderation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye } from 'lucide-react';
import type { ModerationQueueItem, ModerationAction } from '@aardvark/shared';

export default function AdminReportsPage() {
  const { reports, isLoading, resolveReport } = useModeration();
  const [selectedItem, setSelectedItem] = useState<ModerationQueueItem | null>(null);

  const handleResolve = async (action: ModerationAction, reason: string) => {
    if (selectedItem) {
      await resolveReport(selectedItem.id, action, reason);
      setSelectedItem(null);
    }
  };

  return (
    <AdminLayout
      title="Reports"
      description="Manage user-submitted reports"
      pendingReports={reports?.filter((r: ModerationQueueItem) => r.status === 'pending').length ?? 0}
    >
      <div className="space-y-4">
        {isLoading ? (
          <p className="text-muted-foreground">Loading reports...</p>
        ) : reports?.length === 0 ? (
          <p className="text-muted-foreground">No reports to review</p>
        ) : (
          reports?.map((item: ModerationQueueItem) => (
            <Card key={item.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">{item.source.replace(/_/g, ' ')}</CardTitle>
                <Badge
                  variant={
                    item.status === 'pending'
                      ? 'default'
                      : item.status === 'approved'
                        ? 'secondary'
                        : 'outline'
                  }
                >
                  {item.status}
                </Badge>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {item.contentType} reported
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedItem(item)}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Review
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <ReportDetailModal
        queueItem={selectedItem ?? undefined}
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        onResolve={handleResolve}
      />
    </AdminLayout>
  );
}
