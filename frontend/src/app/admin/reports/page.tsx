'use client';

import { useState } from 'react';
import { AdminLayout } from '@/components/admin/admin-layout';
import { ReportDetailModal } from '@/components/admin/report-detail-modal';
import { useModeration } from '@/hooks/use-moderation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye } from 'lucide-react';
import type { Report, ModerationAction } from '@aardvark/shared';

export default function AdminReportsPage() {
  const { reports, isLoading, resolveReport } = useModeration();
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  const handleResolve = async (action: ModerationAction, reason: string) => {
    if (selectedReport) {
      await resolveReport(selectedReport.id, action, reason);
      setSelectedReport(null);
    }
  };

  return (
    <AdminLayout
      title="Reports"
      description="Manage user-submitted reports"
      pendingReports={reports?.filter((r: Report) => r.status === 'pending').length ?? 0}
    >
      <div className="space-y-4">
        {isLoading ? (
          <p className="text-muted-foreground">Loading reports...</p>
        ) : reports?.length === 0 ? (
          <p className="text-muted-foreground">No reports to review</p>
        ) : (
          reports?.map((report: Report) => (
            <Card key={report.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">{report.reason}</CardTitle>
                <Badge
                  variant={
                    report.status === 'pending'
                      ? 'default'
                      : report.status === 'resolved'
                        ? 'secondary'
                        : 'outline'
                  }
                >
                  {report.status}
                </Badge>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {report.contentType} reported
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedReport(report)}
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
        report={selectedReport ?? undefined}
        isOpen={!!selectedReport}
        onClose={() => setSelectedReport(null)}
        onResolve={handleResolve}
      />
    </AdminLayout>
  );
}
