'use client';

import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  Search,
  AlertTriangle,
  Ban,
  CheckCircle,
  MoreVertical,
  Eye,
  UserX,
} from 'lucide-react';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { UserActionModal } from '@/components/admin/user-action-modal';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useUserBans,
  useLiftBan,
  useAdminStats,
} from '@/hooks/use-moderation';
import { getInitials, formatRelativeDate } from '@/lib/utils';
import type {
  UserBan,
  UserRole,
  AccountStatus,
} from '@aardvark/shared';

/**
 * User data structure (extended from shared types)
 */
interface AdminUserView {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: UserRole;
  accountStatus: AccountStatus;
  emailVerified: boolean;
  warningCount: number;
  banCount: number;
  activeBan: UserBan | null;
  lastLoginAt: Date | null;
  createdAt: Date;
}

/**
 * Admin User Management Page
 * View users, manage bans, warnings, and user actions
 */
export default function UserManagementPage() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') || undefined : undefined;

  // State
  const [selectedTab, setSelectedTab] = useState<'all' | 'banned' | 'warnings'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [, setActionType] = useState<'ban' | 'warn' | 'view'>('view');
  const [page] = useState(1);
  const limit = 20;
  const [users, setUsers] = useState<AdminUserView[]>([]);
  const [, setUsersLoading] = useState(true);

  // Hooks
  const { data: adminStats } = useAdminStats(token);
  const { data: bansData, isLoading: bansLoading } = useUserBans(
    { page, limit, isActive: true },
    token
  );
  const liftBanMutation = useLiftBan(token);

  // Fetch users from API
  useEffect(() => {
    async function loadUsers() {
      setUsersLoading(true);
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const response = await fetch(
          `${API_URL}/users/admin/list?page=${page}&limit=${limit}&search=${encodeURIComponent(searchQuery)}`,
          { headers },
        );
        if (!response.ok) throw new Error('Failed to fetch users');
        const { data } = await response.json();
        setUsers((data || []).map((u: any) => ({
          ...u,
          lastLoginAt: u.lastLoginAt ? new Date(u.lastLoginAt) : null,
          createdAt: new Date(u.createdAt),
        })));
      } catch (error) {
        console.error('Failed to load users:', error);
        setUsers([]);
      } finally {
        setUsersLoading(false);
      }
    }
    loadUsers();
  }, [page, searchQuery, token]);

  // Handlers
  const handleUserAction = (userId: string, action: 'ban' | 'warn' | 'view') => {
    setSelectedUserId(userId);
    setActionType(action);
    setShowActionModal(true);
  };

  const handleLiftBan = async (banId: string) => {
    try {
      await liftBanMutation.mutateAsync(banId);
    } catch (error) {
      console.error('Failed to lift ban:', error);
    }
  };

  // Users are already filtered server-side via search param
  const filteredUsers = users;

  // Get status badge variant
  const getStatusBadge = (status: AccountStatus) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">Active</Badge>;
      case 'suspended':
        return <Badge variant="warning">Suspended</Badge>;
      case 'banned':
        return <Badge variant="destructive">Banned</Badge>;
      case 'pending_verification':
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getRoleBadge = (role: UserRole) => {
    const colors = {
      admin: 'bg-red-100 text-red-800',
      moderator: 'bg-purple-100 text-purple-800',
      author: 'bg-blue-100 text-blue-800',
      reader: 'bg-gray-100 text-gray-800',
      guest: 'bg-gray-50 text-gray-600',
    };
    return (
      <Badge variant="outline" className={colors[role]}>
        {role.charAt(0).toUpperCase() + role.slice(1)}
      </Badge>
    );
  };

  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* Sidebar */}
      <AdminSidebar
        pendingReports={adminStats?.moderation.pendingReports || 0}
        pendingQueue={adminStats?.moderation.pendingReports || 0}
      />

      {/* Main Content */}
      <div className="flex-1 p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
            <p className="text-muted-foreground mt-1">
              Manage users, bans, warnings, and account status
            </p>
          </div>

          {/* Stats Overview */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">1,234</div>
                <p className="text-xs text-muted-foreground mt-1">
                  +56 this week
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Active Bans</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {bansData?.total || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Currently banned
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Warnings Issued</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">48</div>
                <p className="text-xs text-muted-foreground mt-1">
                  This month
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Suspended</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">12</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Temporary suspensions
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Tabs */}
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <CardTitle>User Directory</CardTitle>
                  <CardDescription>Search and manage platform users</CardDescription>
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users..."
                    className="pl-8 w-[300px]"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as any)}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="all">All Users</TabsTrigger>
                  <TabsTrigger value="banned">Banned Users</TabsTrigger>
                  <TabsTrigger value="warnings">Recent Warnings</TabsTrigger>
                </TabsList>

                {/* All Users Tab */}
                <TabsContent value="all" className="space-y-4 mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Warnings</TableHead>
                        <TableHead>Last Active</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={user.avatarUrl || undefined} />
                                <AvatarFallback>
                                  {getInitials(user.displayName || user.username)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium">{user.username}</div>
                                <div className="text-sm text-muted-foreground">
                                  {user.email}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{getRoleBadge(user.role)}</TableCell>
                          <TableCell>{getStatusBadge(user.accountStatus)}</TableCell>
                          <TableCell>
                            {user.warningCount > 0 ? (
                              <Badge variant="warning">{user.warningCount}</Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {user.lastLoginAt
                                ? formatRelativeDate(user.lastLoginAt)
                                : 'Never'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {formatRelativeDate(user.createdAt)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem
                                  onClick={() => handleUserAction(user.id, 'view')}
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleUserAction(user.id, 'warn')}
                                >
                                  <AlertTriangle className="h-4 w-4 mr-2" />
                                  Issue Warning
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleUserAction(user.id, 'ban')}
                                  className="text-red-600"
                                >
                                  <Ban className="h-4 w-4 mr-2" />
                                  Ban User
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {filteredUsers.length === 0 && (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground">No users found</p>
                    </div>
                  )}
                </TabsContent>

                {/* Banned Users Tab */}
                <TabsContent value="banned" className="space-y-4 mt-4">
                  {bansLoading ? (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground">Loading banned users...</p>
                    </div>
                  ) : bansData && bansData.items.length > 0 ? (
                    <div className="space-y-3">
                      {bansData.items.map((ban: any) => (
                        <Card key={ban.id}>
                          <CardContent className="pt-6">
                            <div className="flex items-start justify-between">
                              <div className="space-y-2 flex-1">
                                <div className="flex items-center gap-3">
                                  <Badge
                                    variant={
                                      ban.type === 'permanent'
                                        ? 'destructive'
                                        : 'warning'
                                    }
                                  >
                                    {ban.type === 'permanent'
                                      ? 'Permanent Ban'
                                      : 'Temporary Ban'}
                                  </Badge>
                                  <Badge variant="outline">{ban.scope}</Badge>
                                </div>

                                <div>
                                  <p className="font-medium">User ID: {ban.userId}</p>
                                  <p className="text-sm text-muted-foreground mt-1">
                                    Reason: {ban.reason}
                                  </p>
                                </div>

                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                  <span>
                                    Issued:{' '}
                                    {formatDistanceToNow(new Date(ban.startsAt), {
                                      addSuffix: true,
                                    })}
                                  </span>
                                  {ban.expiresAt && (
                                    <span>
                                      Expires:{' '}
                                      {formatDistanceToNow(new Date(ban.expiresAt), {
                                        addSuffix: true,
                                      })}
                                    </span>
                                  )}
                                </div>

                                {ban.appealStatus !== 'none' && (
                                  <Badge
                                    variant={
                                      ban.appealStatus === 'approved'
                                        ? 'success'
                                        : ban.appealStatus === 'denied'
                                        ? 'destructive'
                                        : 'secondary'
                                    }
                                  >
                                    Appeal: {ban.appealStatus}
                                  </Badge>
                                )}
                              </div>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleLiftBan(ban.id)}
                                disabled={!ban.isActive}
                              >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Lift Ban
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-lg font-medium">No active bans</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        All users are in good standing
                      </p>
                    </div>
                  )}
                </TabsContent>

                {/* Warnings Tab */}
                <TabsContent value="warnings" className="space-y-4 mt-4">
                  <div className="text-center py-12">
                    <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-lg font-medium">Warnings History</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      View and manage user warnings
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Ban/Warning Guidelines */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Moderation Guidelines</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3 text-sm">
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Warning
                  </h4>
                  <p className="text-muted-foreground">
                    For minor violations or first-time offenses. User is notified
                    and given a chance to improve.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Ban className="h-4 w-4 text-orange-500" />
                    Temporary Ban
                  </h4>
                  <p className="text-muted-foreground">
                    For repeated violations. Duration varies based on severity
                    (1-30 days typical).
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <UserX className="h-4 w-4 text-red-500" />
                    Permanent Ban
                  </h4>
                  <p className="text-muted-foreground">
                    For severe violations or repeated offenses. User account is
                    permanently disabled.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* User Action Modal */}
      {selectedUserId && (
        <UserActionModal
          isOpen={showActionModal}
          onClose={() => setShowActionModal(false)}
          userId={selectedUserId}
          username={users.find(u => u.id === selectedUserId)?.username || ''}
          onWarn={async () => { setShowActionModal(false); }}
          onBan={async () => { setShowActionModal(false); }}
        />
      )}
    </div>
  );
}
