import { useEffect, useState, useRef } from 'react';
import { api } from '../api';

interface NotificationBellProps {
  user: any;
  onNavigateTab: (tab: string) => void;
}

export function NotificationBell({ user, onNavigateTab }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'notifications' | 'announcements'>('notifications');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filterUnreadOnly, setFilterUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Announcement compose form state (Admin / HR)
  const [departments, setDepartments] = useState<any[]>([]);
  const [showCompose, setShowCompose] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newPriority, setNewPriority] = useState<'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');
  const [newDeptId, setNewDeptId] = useState<string>('');
  const [fanOut, setFanOut] = useState(true);
  const [publishing, setPublishing] = useState(false);

  const drawerRef = useRef<HTMLDivElement>(null);
  const canPublish = user?.role === 'CLIENT_SUPER_ADMIN' || user?.role === 'HR_ADMIN';

  const fetchUnreadCount = async () => {
    try {
      const res = await api.getUnreadNotificationCount();
      setUnreadCount(res.unreadCount || 0);
    } catch {
      // ignore background poll errors
    }
  };

  const fetchNotifications = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getNotifications({
        isRead: filterUnreadOnly ? false : undefined,
        limit: 50,
      });
      setNotifications(res.data || []);
      setUnreadCount(res.unreadCount || 0);
    } catch (err: any) {
      setError(err?.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnnouncements = async () => {
    try {
      const res = await api.getAnnouncements();
      setAnnouncements(res || []);
    } catch {
      // ignore
    }
  };

  // Initial load and periodic unread count refresh
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 25000);
    return () => clearInterval(interval);
  }, []);

  // Fetch departments for composer if Admin/HR
  useEffect(() => {
    if (canPublish) {
      api.getDepartments().then(setDepartments).catch(() => {});
    }
  }, [canPublish]);

  // Load data when opening drawer or changing subtab/filter
  useEffect(() => {
    if (isOpen) {
      if (activeSubTab === 'notifications') {
        fetchNotifications();
      } else {
        fetchAnnouncements();
      }
    }
  }, [isOpen, activeSubTab, filterUnreadOnly]);

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date() } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // ignore
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  };

  const handleNavigate = (actionUrl?: string, notificationId?: string) => {
    if (notificationId) {
      handleMarkAsRead(notificationId);
    }
    if (!actionUrl) return;

    // Match actionUrl to tab
    const cleanUrl = actionUrl.replace('/', '');
    const validTabs = ['ess', 'onboarding', 'employees', 'shifts', 'attendance', 'leaves', 'payroll', 'offboarding', 'reports'];
    if (validTabs.includes(cleanUrl)) {
      onNavigateTab(cleanUrl);
      setIsOpen(false);
    }
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    setPublishing(true);
    try {
      await api.createAnnouncement({
        title: newTitle.trim(),
        content: newContent.trim(),
        priority: newPriority,
        targetDepartmentId: newDeptId || undefined,
        fanOutNotifications: fanOut,
      });

      setNewTitle('');
      setNewContent('');
      setNewPriority('NORMAL');
      setNewDeptId('');
      setShowCompose(false);
      fetchAnnouncements();
      fetchUnreadCount();
    } catch (err: any) {
      alert(err.message || 'Failed to publish announcement');
    } finally {
      setPublishing(false);
    }
  };

  const handleDeactivateAnnouncement = async (id: string) => {
    if (!confirm('Are you sure you want to deactivate this announcement?')) return;
    try {
      await api.deactivateAnnouncement(id);
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === id ? { ...a, isActive: false } : a)),
      );
    } catch (err: any) {
      alert(err.message || 'Failed to deactivate');
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'LEAVE_STATUS':
        return '🌴';
      case 'ATTENDANCE_ALERT':
        return '📍';
      case 'PAYSLIP_RELEASED':
        return '💰';
      case 'SHIFT_ASSIGNED':
        return '⏱️';
      case 'CLEARANCE_TASK':
        return '🚪';
      case 'ANNOUNCEMENT':
        return '📢';
      default:
        return 'ℹ️';
    }
  };

  const formatTimestamp = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const diffMs = Date.now() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      {/* Top Header Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        title="Notifications & Announcements"
        style={{
          background: isOpen ? '#1e293b' : 'transparent',
          border: '1px solid #334155',
          borderRadius: '8px',
          padding: '6px 10px',
          color: '#f8fafc',
          cursor: 'pointer',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '14px',
          transition: 'all 0.15s ease',
        }}
      >
        <span style={{ fontSize: '16px' }}>🔔</span>
        {unreadCount > 0 && (
          <span
            style={{
              background: '#ef4444',
              color: 'white',
              fontSize: '11px',
              fontWeight: 700,
              padding: '1px 6px',
              borderRadius: '999px',
              minWidth: '18px',
              textAlign: 'center',
              boxShadow: '0 0 8px rgba(239, 68, 68, 0.6)',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Backdrop overlay for drawer */}
      {isOpen && (
        <div
          className="modal-backdrop-smooth"
          onClick={() => setIsOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            zIndex: 1000,
            backdropFilter: 'blur(3px)',
          }}
        />
      )}

      {/* Slide-over Drawer / Dropdown Panel */}
      {isOpen && (
        <div
          ref={drawerRef}
          className="drawer-slide-smooth"
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            width: '420px',
            maxWidth: '92vw',
            background: '#ffffff',
            boxShadow: '-8px 0 24px rgba(0, 0, 0, 0.25)',
            zIndex: 1001,
            display: 'flex',
            flexDirection: 'column',
            color: '#1e293b',
          }}
        >
          {/* Drawer Header */}
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#0f172a',
              color: '#f8fafc',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>🔔</span>
              <span style={{ fontWeight: 700, fontSize: '15px' }}>Activity & Alerts</span>
              {unreadCount > 0 && (
                <span
                  style={{
                    background: '#ef4444',
                    color: 'white',
                    fontSize: '11px',
                    padding: '2px 7px',
                    borderRadius: '999px',
                    fontWeight: 600,
                  }}
                >
                  {unreadCount} unread
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {unreadCount > 0 && activeSubTab === 'notifications' && (
                <button
                  onClick={handleMarkAllRead}
                  style={{
                    background: '#1e293b',
                    color: '#94a3b8',
                    border: '1px solid #334155',
                    borderRadius: '4px',
                    padding: '3px 8px',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '20px',
                  cursor: 'pointer',
                  lineHeight: 1,
                  padding: '2px 6px',
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Subtabs Bar */}
          <div
            style={{
              display: 'flex',
              background: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              padding: '0 16px',
            }}
          >
            <button
              onClick={() => setActiveSubTab('notifications')}
              style={{
                flex: 1,
                padding: '12px 8px',
                border: 'none',
                background: 'none',
                borderBottom: activeSubTab === 'notifications' ? '2px solid #2563eb' : '2px solid transparent',
                color: activeSubTab === 'notifications' ? '#2563eb' : '#64748b',
                fontWeight: activeSubTab === 'notifications' ? 700 : 500,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <span>Alerts</span>
              {unreadCount > 0 && (
                <span
                  style={{
                    background: '#2563eb',
                    color: 'white',
                    fontSize: '10px',
                    padding: '1px 5px',
                    borderRadius: '999px',
                  }}
                >
                  {unreadCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveSubTab('announcements')}
              style={{
                flex: 1,
                padding: '12px 8px',
                border: 'none',
                background: 'none',
                borderBottom: activeSubTab === 'announcements' ? '2px solid #2563eb' : '2px solid transparent',
                color: activeSubTab === 'announcements' ? '#2563eb' : '#64748b',
                fontWeight: activeSubTab === 'announcements' ? 700 : 500,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <span>📢 Announcements</span>
              {announcements.filter((a) => a.isActive).length > 0 && (
                <span
                  style={{
                    background: '#e2e8f0',
                    color: '#334155',
                    fontSize: '10px',
                    padding: '1px 5px',
                    borderRadius: '999px',
                  }}
                >
                  {announcements.filter((a) => a.isActive).length}
                </span>
              )}
            </button>
          </div>

          {/* Body Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            {/* SUBTAB 1: NOTIFICATIONS */}
            {activeSubTab === 'notifications' && (
              <div>
                {/* Filter toggle */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '12px',
                  }}
                >
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    Showing {notifications.length} notifications
                  </span>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#475569', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={filterUnreadOnly}
                      onChange={(e) => setFilterUnreadOnly(e.target.checked)}
                    />
                    Unread only
                  </label>
                </div>

                {loading && (
                  <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8', fontSize: '13px' }}>
                    Loading alerts...
                  </div>
                )}

                {error && (
                  <div style={{ padding: '12px', background: '#fef2f2', color: '#b91c1c', borderRadius: '6px', fontSize: '13px', marginBottom: '12px' }}>
                    {error}
                  </div>
                )}

                {!loading && notifications.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎉</div>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: '#475569' }}>All caught up!</div>
                    <div style={{ fontSize: '12px', marginTop: '4px' }}>No {filterUnreadOnly ? 'unread' : ''} notifications at this time.</div>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => !n.isRead && handleMarkAsRead(n.id)}
                      style={{
                        padding: '12px',
                        borderRadius: '8px',
                        background: n.isRead ? '#ffffff' : '#f0f9ff',
                        border: n.isRead ? '1px solid #e2e8f0' : '1px solid #bae6fd',
                        boxShadow: n.isRead ? 'none' : '0 2px 4px rgba(14, 165, 233, 0.08)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        <span style={{ fontSize: '18px', marginTop: '1px' }}>{getTypeIcon(n.type)}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ fontWeight: n.isRead ? 600 : 700, fontSize: '13px', color: '#0f172a' }}>
                              {n.title}
                            </div>
                            <span style={{ fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                              {formatTimestamp(n.createdAt)}
                            </span>
                          </div>

                          <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px', lineHeight: 1.4 }}>
                            {n.message}
                          </div>

                          {/* Bottom action row */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
                            {n.actionUrl ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleNavigate(n.actionUrl, n.id);
                                }}
                                style={{
                                  background: '#2563eb',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  padding: '3px 8px',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <span>Open View</span>
                                <span>→</span>
                              </button>
                            ) : <div />}

                            {!n.isRead && (
                              <button
                                onClick={(e) => handleMarkAsRead(n.id, e)}
                                title="Mark as read"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#0284c7',
                                  fontSize: '11px',
                                  cursor: 'pointer',
                                  padding: '2px 4px',
                                  fontWeight: 600,
                                }}
                              >
                                ✓ Mark read
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SUBTAB 2: ANNOUNCEMENTS */}
            {activeSubTab === 'announcements' && (
              <div>
                {/* Admin/HR Broadcast composer toggle */}
                {canPublish && (
                  <div style={{ marginBottom: '16px' }}>
                    {!showCompose ? (
                      <button
                        onClick={() => setShowCompose(true)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          background: '#0f172a',
                          color: '#f8fafc',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                        }}
                      >
                        <span>📢</span>
                        <span>Broadcast New Announcement</span>
                      </button>
                    ) : (
                      <form
                        onSubmit={handleCreateAnnouncement}
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #cbd5e1',
                          borderRadius: '8px',
                          padding: '14px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                          <span style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>
                            Compose Broadcast Notice
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowCompose(false)}
                            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '14px' }}
                          >
                            ✕
                          </button>
                        </div>

                        <div style={{ marginBottom: '8px' }}>
                          <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '3px' }}>
                            Title *
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g., Company Town Hall or Holiday Notice"
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '6px 8px',
                              border: '1px solid #cbd5e1',
                              borderRadius: '4px',
                              fontSize: '12px',
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                          <div>
                            <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '3px' }}>
                              Priority
                            </label>
                            <select
                              value={newPriority}
                              onChange={(e) => setNewPriority(e.target.value as any)}
                              style={{
                                width: '100%',
                                padding: '6px',
                                border: '1px solid #cbd5e1',
                                borderRadius: '4px',
                                fontSize: '12px',
                              }}
                            >
                              <option value="NORMAL">Normal</option>
                              <option value="HIGH">High</option>
                              <option value="URGENT">Urgent 🔴</option>
                            </select>
                          </div>

                          <div>
                            <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '3px' }}>
                              Target Scope
                            </label>
                            <select
                              value={newDeptId}
                              onChange={(e) => setNewDeptId(e.target.value)}
                              style={{
                                width: '100%',
                                padding: '6px',
                                border: '1px solid #cbd5e1',
                                borderRadius: '4px',
                                fontSize: '12px',
                              }}
                            >
                              <option value="">All Company</option>
                              {departments.map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div style={{ marginBottom: '8px' }}>
                          <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '3px' }}>
                            Content / Details *
                          </label>
                          <textarea
                            required
                            rows={3}
                            placeholder="Type announcement message here..."
                            value={newContent}
                            onChange={(e) => setNewContent(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '6px 8px',
                              border: '1px solid #cbd5e1',
                              borderRadius: '4px',
                              fontSize: '12px',
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>

                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#475569', marginBottom: '10px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={fanOut}
                            onChange={(e) => setFanOut(e.target.checked)}
                          />
                          <span>Fan out in-app notifications to eligible employees</span>
                        </label>

                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            onClick={() => setShowCompose(false)}
                            style={{
                              padding: '5px 10px',
                              background: '#e2e8f0',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '11px',
                              cursor: 'pointer',
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={publishing}
                            style={{
                              padding: '5px 14px',
                              background: '#2563eb',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: publishing ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {publishing ? 'Broadcasting...' : 'Broadcast'}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}

                {/* Announcements list */}
                {announcements.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>📢</div>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: '#475569' }}>No announcements</div>
                    <div style={{ fontSize: '12px', marginTop: '4px' }}>There are currently no active company announcements.</div>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {announcements.map((a) => (
                    <div
                      key={a.id}
                      style={{
                        padding: '14px',
                        borderRadius: '8px',
                        background: '#ffffff',
                        border: a.priority === 'URGENT' ? '2px solid #f87171' : '1px solid #e2e8f0',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        opacity: a.isActive ? 1 : 0.6,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background:
                                a.priority === 'URGENT'
                                  ? '#fee2e2'
                                  : a.priority === 'HIGH'
                                  ? '#ffedd5'
                                  : '#e0f2fe',
                              color:
                                a.priority === 'URGENT'
                                  ? '#b91c1c'
                                  : a.priority === 'HIGH'
                                  ? '#c2410c'
                                  : '#0369a1',
                            }}
                          >
                            {a.priority}
                          </span>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>
                            {a.targetDepartment ? `🏢 ${a.targetDepartment.name}` : '🌐 Company-wide'}
                          </span>
                        </div>

                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                          {formatTimestamp(a.createdAt)}
                        </span>
                      </div>

                      <div style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a', marginBottom: '6px' }}>
                        {a.title}
                      </div>

                      <div style={{ fontSize: '12px', color: '#334155', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                        {a.content}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
                        <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                          By: {a.createdBy?.email || 'HR Admin'}
                        </span>

                        {canPublish && a.isActive && (
                          <button
                            onClick={() => handleDeactivateAnnouncement(a.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#ef4444',
                              fontSize: '11px',
                              cursor: 'pointer',
                              padding: '2px 4px',
                            }}
                          >
                            Deactivate
                          </button>
                        )}
                        {!a.isActive && (
                          <span style={{ fontSize: '10px', color: '#94a3b8', fontStyle: 'italic' }}>
                            (Inactive)
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
