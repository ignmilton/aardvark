'use client';

import { useState } from 'react';
import { AdminLayout } from '@/components/admin/admin-layout';
import { UserActionModal } from '@/components/admin/user-action-modal';
import { useUserManagement } from '@/hooks/use-user-management';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search, Shield } from 'lucide-react';
import type { BanType, BanScope } from '@aardvark/shared';

export default function AdminUsersPage() {
  const { users, isLoading, searchUsers, warnUser, banUser } = useUserManagement();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<{ id: string; username: string } | null>(null);

  const handleSearch = () => {
    searchUsers(searchQuery);
  };

  const handleWarn = async (reason: string) => {
    if (selectedUser) {
      await warnUser(selectedUser.id, reason);
      setSelectedUser(null);
    }
  };

  const handleBan = async (type: BanType, scope: BanScope, reason: string, durationDays?: number) => {
    if (selectedUser) {
      await banUser(selectedUser.id, type, scope, reason, durationDays);
      setSelectedUser(null);
    }
  };

  return (
    <AdminLayout
      title="User Management"
      description="Search and manage platform users"
    >
      <div className="flex gap-2 mb-6">
        <Input
          placeholder="Search users by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="max-w-md"
        />
        <Button onClick={handleSearch}>
          <Search className="h-4 w-4 mr-2" />
          Search
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Username</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                Loading...
              </TableCell>
            </TableRow>
          ) : users?.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                No users found
              </TableCell>
            </TableRow>
          ) : (
            users?.map((user: { id: string; username: string; email: string; role: string; status: string; createdAt: string }) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.username}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Badge variant="outline">{user.role}</Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={user.status === 'active' ? 'default' : 'destructive'}
                  >
                    {user.status}
                  </Badge>
                </TableCell>
                <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedUser({ id: user.id, username: user.username })}
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Actions
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {selectedUser && (
        <UserActionModal
          isOpen={!!selectedUser}
          onClose={() => setSelectedUser(null)}
          userId={selectedUser.id}
          username={selectedUser.username}
          onWarn={handleWarn}
          onBan={handleBan}
        />
      )}
    </AdminLayout>
  );
}
