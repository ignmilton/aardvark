'use client';

// Prevent static generation for this admin page
export async function getServerSideProps() {
  return { props: {} };
}

import { useState } from 'react';
import {
  Search,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { ModerationQueueItemComponent } from '@/components/admin/moderation-queue-item';
import { ReportDetailModal } from '@/components/admin/report-detail-modal';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  useModerationQueue,
  useAssignModeration,
  useAdminStats,
} from '@/hooks/use-moderation';
import {
  ModerationStatus,
} from '@aardvark/shared';
import type {
  ModerationQueueItem,
  ModerationQueueQuery,
} from '@aardvark/shared';

/**
 * Admin Moderation Queue Page
 * Displays and manages content awaiting moderation review
 */
export default function ModerationQueuePage() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') || undefined : undefined;

  // State
  const [selectedTab, setSelectedTab] = useState<ModerationStatus>(ModerationStatus.PENDING);
  const [selectedItem, setSelectedItem] = useState<ModerationQueueItem | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<ModerationQueueQuery>({
    page: 1,
    limit: 20,
    status: ModerationStatus.PENDING,
    sortBy: 'priority',
    sortOrder: 'desc',
  });

  // Hooks
  const { data: adminStats } = useAdminStats(token);
  const { data: queueData, isLoading } = useModerationQueue(
    { ...filters, status: selectedTab },
    token
  );
  const assignMutation = useAssignModeration(token);

  // Handlers
  const handleReviewItem = (item: ModerationQueueItem) => {
    setSelectedItem(item);
    setShowDetailModal(true);
  };

  const handleAssignToMe = async (item: ModerationQueueItem) => {
    try {
      await assignMutation.mutateAsync(item.id);
    } catch (error) {
      console.error('Failed to assign moderation item:', error);
    }
  };

  const handleFilterChange = (key: keyof ModerationQueueQuery, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const handlePageChange = (page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  };

  // Filter items by search query
  const filteredItems = queueData?.items.filter((item) => {
    if (!searchQuery) return true;
    return (
      item.contentId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.id.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* Sidebar */}
      <AdminSidebar
        pendingReports={adminStats?.moderation.pendingReports || 0}
        pendingQueue={queueData?.pagination.totalItems || 0}
      />

      {/* Main Content */}
      <div className="flex-1 p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Moderation Queue</h1>
            <p className="text-muted-foreground mt-1">
              Review and moderate flagged content
            </p>
          </div>

          {/* Stats Overview */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Pending</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {queueData?.pagination.totalItems || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Awaiting review
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Under Review</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {adminStats?.moderation.totalReports || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Being processed
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Resolved</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {adminStats?.moderation.resolvedReports || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Today
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Avg Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {adminStats?.moderation.averageResolutionTime || 0}m
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Resolution time
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Filters and Search */}
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <CardTitle>Queue Items</CardTitle>
                  <CardDescription>
                    {queueData?.pagination.totalItems || 0} items total
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by ID..."
                      className="pl-8 w-[250px]"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-4">
                <Button
                  variant={filters.priority === 'critical' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() =>
                    handleFilterChange(
                      'priority',
                      filters.priority === 'critical' ? undefined : 'critical'
                    )
                  }
                >
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Critical
                </Button>
                <Button
                  variant={filters.priority === 'high' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() =>
                    handleFilterChange(
                      'priority',
                      filters.priority === 'high' ? undefined : 'high'
                    )
                  }
                >
                  High Priority
                </Button>
                <Button
                  variant={filters.source === 'auto_flagged' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() =>
                    handleFilterChange(
                      'source',
                      filters.source === 'auto_flagged' ? undefined : 'auto_flagged'
                    )
                  }
                >
                  Auto-flagged
                </Button>
                <Button
                  variant={filters.assignedTo === 'unassigned' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() =>
                    handleFilterChange(
                      'assignedTo',
                      filters.assignedTo === 'unassigned' ? undefined : 'unassigned'
                    )
                  }
                >
                  Unassigned
                </Button>
              </div>

              {/* Status Tabs */}
              <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as ModerationStatus)}>
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="pending">Pending</TabsTrigger>
                  <TabsTrigger value="under_review">Under Review</TabsTrigger>
                  <TabsTrigger value="approved">Approved</TabsTrigger>
                  <TabsTrigger value="rejected">Rejected</TabsTrigger>
                </TabsList>

                <TabsContent value={selectedTab} className="space-y-4 mt-4">
                  {isLoading ? (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground">Loading queue items...</p>
                    </div>
                  ) : filteredItems && filteredItems.length > 0 ? (
                    <>
                      {filteredItems.map((item) => (
                        <ModerationQueueItemComponent
                          key={item.id}
                          item={item}
                          onReview={handleReviewItem}
                          onAssign={handleAssignToMe}
                        />
                      ))}

                      {/* Pagination */}
                      {queueData && queueData.pagination.totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 pt-4">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!queueData.pagination.hasPrevPage}
                            onClick={() => handlePageChange(filters.page! - 1)}
                          >
                            Previous
                          </Button>
                          <span className="text-sm text-muted-foreground">
                            Page {queueData.pagination.page} of{' '}
                            {queueData.pagination.totalPages}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!queueData.pagination.hasNextPage}
                            onClick={() => handlePageChange(filters.page! + 1)}
                          >
                            Next
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-12">
                      <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-lg font-medium">No items in queue</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {searchQuery
                          ? 'No items match your search criteria'
                          : 'All caught up! No pending moderation items.'}
                      </p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Guidelines Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Moderation Guidelines</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 text-sm">
                <div>
                  <h4 className="font-medium mb-2">Content to Remove:</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Hate speech or harassment</li>
                    <li>• Explicit sexual content</li>
                    <li>• Violence or graphic content</li>
                    <li>• Spam or misleading information</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Actions Available:</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Approve: Content is acceptable</li>
                    <li>• Remove: Delete the content</li>
                    <li>• Warn User: Issue a warning</li>
                    <li>• Ban User: Temporary or permanent ban</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedItem && (
        <ReportDetailModal
          isOpen={showDetailModal}
          onClose={() => setShowDetailModal(false)}
          queueItem={selectedItem}
          onResolve={async () => { setShowDetailModal(false); }}
        />
      )}
    </div>
  );
}
