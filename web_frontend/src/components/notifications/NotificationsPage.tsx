/**
 * Tệp: CardioGuard AI – Trung tâm thông báo & Cấu hình tuỳ chọn nhận thông báo
 * Mục đích: Hiển thị giao diện người dùng để xem danh sách thông báo (phân trang, lọc theo
 *           trạng thái, danh mục, độ nghiêm trọng) và tuỳ chỉnh các tuỳ chọn nhận thông báo.
 * Luồng xử lý:
 *   1. Lấy trạng thái thông báo và tuỳ chọn nhận từ NotificationProvider context.
 *   2. Cập nhật tuỳ chọn bằng cách gọi updatePreferences động (với micro-animations toggles).
 *   3. Hiển thị danh sách thông báo phân loại theo màu sắc severity và category biểu tượng.
 *   4. Đi kèm Medical Disclaimer cho các thông báo lâm sàng/AI.
 * Quan hệ:
 *   - Sử dụng: useNotifications (NotificationProvider)
 *   - Tích hợp: trong App.tsx làm trang đích của vai trò /notifications
 */

import React, { useState, useEffect } from 'react';
import { useNotifications } from './NotificationProvider';
import { 
  Bell, 
  Settings, 
  Shield, 
  Heart, 
  Calendar, 
  FileText, 
  MessageSquare, 
  Activity, 
  Check, 
  Eye, 
  ExternalLink
} from 'lucide-react';
import { useLocale } from '../../i18n/locale';
import { Notification, NotificationPreferences } from '../../services/notificationsService';

export const NotificationsPage: React.FC = () => {
  const { locale } = useLocale();
  const { 
    notifications, 
    unreadCount, 
    preferences, 
    loading, 
    fetchNotifications, 
    markAsRead, 
    markAllAsRead, 
    updatePreferences 
  } = useNotifications();

  // Trạng thái bộ lọc
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [page, setPage] = useState<number>(1);
  const itemsPerPage = 15;

  // Lấy dữ liệu khi tab hoặc bộ lọc thay đổi
  useEffect(() => {
    fetchNotifications(100, 0); // Lấy 100 thông báo gần nhất để lọc local
  }, [fetchNotifications]);

  // Bộ lọc cục bộ để phản hồi UI cực nhanh
  const filteredNotifications = notifications.filter((notif) => {
    if (activeTab === 'unread' && notif.is_read) return false;
    if (selectedCategory !== 'all' && notif.category !== selectedCategory) return false;
    if (selectedSeverity !== 'all' && notif.severity !== selectedSeverity) return false;
    return true;
  });

  // Phân trang
  const paginatedNotifications = filteredNotifications.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );
  
  const totalPages = Math.ceil(filteredNotifications.length / itemsPerPage);

  // Nhãn danh mục tiếng Việt/tiếng Anh
  const categoryLabels: Record<string, { vi: string; en: string; icon: any }> = {
    health: { vi: 'Sức khỏe', en: 'Health', icon: Heart },
    appointment: { vi: 'Lịch hẹn', en: 'Appointment', icon: Calendar },
    record: { vi: 'Bệnh án & Đơn thuốc', en: 'Medical Record', icon: FileText },
    chat: { vi: 'Tin nhắn', en: 'Message', icon: MessageSquare },
    system: { vi: 'Hệ thống', en: 'System', icon: Activity },
    security: { vi: 'Bảo mật', en: 'Security', icon: Shield },
  };

  // Icon biểu diễn cho category
  const getCategoryIcon = (category: string) => {
    const config = categoryLabels[category];
    if (config) {
      const IconComp = config.icon;
      return <IconComp size={16} />;
    }
    return <Bell size={16} />;
  };

  // Tên category hiển thị theo locale
  const getCategoryLabel = (category: string) => {
    return categoryLabels[category]?.[locale] || category;
  };

  // Trả về nhãn severity
  const getSeverityLabel = (severity: string) => {
    const labels: Record<string, { vi: string; en: string }> = {
      critical: { vi: 'Khẩn cấp', en: 'Critical' },
      warning: { vi: 'Cảnh báo', en: 'Warning' },
      success: { vi: 'Thành công', en: 'Success' },
      info: { vi: 'Thông tin', en: 'Info' },
    };
    return labels[severity]?.[locale] || severity;
  };



  // Trình kích hoạt toggle preferences
  const handlePreferenceToggle = async (key: keyof NotificationPreferences) => {
    if (!preferences) return;
    const updatedVal = !preferences[key];
    await updatePreferences({ [key]: updatedVal });
  };

  const handleActionClick = (notif: Notification) => {
    if (!notif.is_read) {
      markAsRead(notif.id).catch(() => {});
    }
    if (notif.action_url) {
      window.location.hash = notif.action_url;
    }
  };

  return (
    <div className="notifications-page-container" style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
      {/* Tiêu đề & Action nhanh */}
      <div 
        className="glass-panel" 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '20px 24px',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            {locale === 'en' ? 'Activity & Medical Notification Center' : 'Trung tâm thông báo hoạt động & y tế'}
          </h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            {locale === 'en' 
              ? `You have ${unreadCount} unread notifications.` 
              : `Bạn có ${unreadCount} thông báo chưa đọc.`}
          </p>
        </div>
        {unreadCount > 0 && (
          <button 
            type="button" 
            className="btn btn-outline" 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              padding: '10px 18px',
              fontSize: '0.85rem',
              borderColor: 'var(--color-primary-glow)'
            }}
            onClick={markAllAsRead}
          >
            <Check size={16} />
            {locale === 'en' ? 'Mark all as read' : 'Đánh dấu tất cả đã đọc'}
          </button>
        )}
      </div>

      {/* Layout Grid 2 Cột */}
      <div 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: 'minmax(0, 1fr) 320px', 
          gap: '24px',
          alignItems: 'start'
        }}
        className="notifications-grid-layout"
      >
        {/* Cột trái: Danh sách thông báo */}
        <div className="flex-col gap-16">
          {/* Bộ lọc thanh công cụ */}
          <div 
            className="glass-panel" 
            style={{ 
              padding: '16px 20px', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '16px'
            }}
          >
            {/* Tabs chính */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px', gap: '20px' }}>
              <button
                type="button"
                style={{
                  background: 'none',
                  border: 'none',
                  color: activeTab === 'all' ? 'var(--color-primary)' : 'var(--text-secondary)',
                  fontWeight: activeTab === 'all' ? 700 : 500,
                  cursor: 'pointer',
                  padding: '4px 8px',
                  position: 'relative',
                  fontSize: '0.9rem',
                }}
                onClick={() => { setActiveTab('all'); setPage(1); }}
              >
                {locale === 'en' ? 'All Notifications' : 'Tất cả thông báo'}
                {activeTab === 'all' && (
                  <span style={{ position: 'absolute', bottom: '-11px', left: 0, right: 0, height: '2px', background: 'var(--color-primary)' }} />
                )}
              </button>
              <button
                type="button"
                style={{
                  background: 'none',
                  border: 'none',
                  color: activeTab === 'unread' ? 'var(--color-primary)' : 'var(--text-secondary)',
                  fontWeight: activeTab === 'unread' ? 700 : 500,
                  cursor: 'pointer',
                  padding: '4px 8px',
                  position: 'relative',
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                onClick={() => { setActiveTab('unread'); setPage(1); }}
              >
                {locale === 'en' ? 'Unread' : 'Chưa đọc'}
                {unreadCount > 0 && (
                  <span 
                    style={{ 
                      background: 'var(--color-critical)', 
                      color: 'white', 
                      borderRadius: '10px', 
                      padding: '2px 6px', 
                      fontSize: '0.7rem',
                      fontWeight: 800
                    }}
                  >
                    {unreadCount}
                  </span>
                )}
                {activeTab === 'unread' && (
                  <span style={{ position: 'absolute', bottom: '-11px', left: 0, right: 0, height: '2px', background: 'var(--color-primary)' }} />
                )}
              </button>
            </div>

            {/* Bộ lọc dropdowns */}
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  {locale === 'en' ? 'Category' : 'Danh mục'}
                </span>
                <select
                  value={selectedCategory}
                  onChange={(e) => { setSelectedCategory(e.target.value); setPage(1); }}
                  className="input-field"
                  style={{ width: '180px', height: '36px', padding: '0 8px', fontSize: '0.85rem' }}
                >
                  <option value="all">{locale === 'en' ? 'All Categories' : 'Tất cả danh mục'}</option>
                  <option value="health">{locale === 'en' ? 'Medical / Health' : 'Y tế / Sức khỏe'}</option>
                  <option value="appointment">{locale === 'en' ? 'Appointments' : 'Lịch hẹn'}</option>
                  <option value="record">{locale === 'en' ? 'Medical Records' : 'Hồ sơ bệnh án'}</option>
                  <option value="chat">{locale === 'en' ? 'Messages' : 'Tin nhắn'}</option>
                  <option value="system">{locale === 'en' ? 'System Alerts' : 'Cảnh báo hệ thống'}</option>
                  <option value="security">{locale === 'en' ? 'Security & Account' : 'Bảo mật tài khoản'}</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  {locale === 'en' ? 'Severity' : 'Mức độ'}
                </span>
                <select
                  value={selectedSeverity}
                  onChange={(e) => { setSelectedSeverity(e.target.value); setPage(1); }}
                  className="input-field"
                  style={{ width: '180px', height: '36px', padding: '0 8px', fontSize: '0.85rem' }}
                >
                  <option value="all">{locale === 'en' ? 'All Severities' : 'Tất cả mức độ'}</option>
                  <option value="critical">{locale === 'en' ? 'Critical (Red)' : 'Khẩn cấp (Đỏ)'}</option>
                  <option value="warning">{locale === 'en' ? 'Warning (Orange)' : 'Cảnh báo (Cam)'}</option>
                  <option value="success">{locale === 'en' ? 'Success (Green)' : 'Thành công (Xanh lá)'}</option>
                  <option value="info">{locale === 'en' ? 'Information (Blue)' : 'Thông tin (Xanh dương)'}</option>
                </select>
              </div>
            </div>
          </div>

          {/* List thông báo */}
          <div className="flex-col gap-12" style={{ width: '100%' }}>
            {loading ? (
              <div className="glass-panel text-center" style={{ padding: '48px' }}>
                <div className="skeleton m-auto-12" style={{ width: '48px', height: '48px', borderRadius: '50%' }} />
                <div className="skeleton m-auto-12" style={{ width: '150px', height: '18px' }} />
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
                  {locale === 'en' ? 'Loading notifications...' : 'Đang tải danh sách thông báo...'}
                </p>
              </div>
            ) : paginatedNotifications.length === 0 ? (
              <div className="glass-panel text-center" style={{ padding: '48px' }}>
                <div style={{ fontSize: '3rem', color: 'var(--text-muted)', marginBottom: '16px' }}>📭</div>
                <h3 style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 700 }}>
                  {locale === 'en' ? 'No Notifications Found' : 'Không tìm thấy thông báo nào'}
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '8px' }}>
                  {locale === 'en' 
                    ? 'No notifications match your current filter settings.' 
                    : 'Không có thông báo nào phù hợp với bộ lọc hiện tại của bạn.'}
                </p>
              </div>
            ) : (
              paginatedNotifications.map((notif) => {
                const isAIWarning = notif.type === 'health_warning' || (notif.message && notif.message.includes('AI'));
                
                return (
                  <div
                    key={notif.id}
                    className="glass-panel"
                    style={{
                      padding: '16px 20px',
                      display: 'flex',
                      gap: '16px',
                      position: 'relative',
                      borderLeft: `4px solid var(--color-${notif.severity}, var(--color-info))`,
                      opacity: notif.is_read ? 0.75 : 1,
                      transition: 'all 0.25s ease',
                      cursor: notif.action_url ? 'pointer' : 'default',
                    }}
                    onClick={() => handleActionClick(notif)}
                  >
                    {/* Icon danh mục & Unread Dot */}
                    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <div 
                        style={{ 
                          width: '36px', 
                          height: '36px', 
                          borderRadius: '10px', 
                          background: 'var(--hover-bg, rgba(255, 255, 255, 0.05))',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: `var(--color-${notif.severity}, var(--text-primary))`
                        }}
                      >
                        {getCategoryIcon(notif.category)}
                      </div>
                      {!notif.is_read && (
                        <span 
                          style={{ 
                            width: '8px', 
                            height: '8px', 
                            borderRadius: '50%', 
                            background: 'var(--color-critical)',
                            boxShadow: '0 0 6px rgba(239, 68, 68, 0.8)'
                          }} 
                        />
                      )}
                    </div>

                    {/* Nội dung thông báo */}
                    <div style={{ flexGrow: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 750, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                            {notif.title}
                          </span>
                          <span 
                            style={{ 
                              fontSize: '0.7rem', 
                              padding: '2px 8px', 
                              borderRadius: '6px', 
                              background: `var(--color-${notif.severity}-glow, rgba(59,130,246,0.1))`,
                              color: `var(--color-${notif.severity}, var(--text-primary))`,
                              fontWeight: 700
                            }}
                          >
                            {getSeverityLabel(notif.severity)}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            • {getCategoryLabel(notif.category)}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {new Date(notif.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}{' '}
                          {new Date(notif.created_at).toLocaleDateString('vi-VN')}
                        </span>
                      </div>

                      <div style={{ marginTop: '6px', color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.45' }}>
                        {notif.message}
                      </div>

                      {/* Nút hành động và liên kết nhanh */}
                      {notif.action_url && (
                        <div style={{ marginTop: '10px', display: 'flex', gap: '12px' }}>
                          <button
                            type="button"
                            className="btn btn-primary"
                            style={{ 
                              padding: '6px 12px', 
                              fontSize: '0.75rem', 
                              borderRadius: '6px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleActionClick(notif);
                            }}
                          >
                            <ExternalLink size={12} />
                            {locale === 'en' ? 'View Details' : 'Xem chi tiết'}
                          </button>
                        </div>
                      )}

                      {/* Hiển thị thêm Medical Disclaimer nếu đây là cảnh báo tự động do AI sinh ra */}
                      {isAIWarning && (
                        <div 
                          style={{ 
                            marginTop: '12px', 
                            padding: '10px 14px', 
                            borderRadius: '8px', 
                            background: 'rgba(245, 158, 11, 0.04)', 
                            borderLeft: '2px solid var(--color-warning)',
                            fontSize: '0.75rem',
                            color: 'var(--text-secondary)',
                            fontStyle: 'italic',
                            lineHeight: '1.4'
                          }}
                        >
                          ⚠️ <strong>{locale === 'en' ? 'Medical Reference Disclaimer:' : 'Lưu ý tham chiếu y khoa:'}</strong>{' '}
                          {locale === 'en' 
                            ? 'This is a reference analysis from the AI assistant. It does not replace professional medical diagnosis, advice, or treatment.' 
                            : 'Đây là phân tích tham khảo từ trợ lý AI, không thay thế cho chẩn đoán, tư vấn hoặc điều trị y khoa chuyên nghiệp.'}
                        </div>
                      )}
                    </div>

                    {/* Nút Mark Read bên phải */}
                    {!notif.is_read && (
                      <button
                        type="button"
                        className="btn btn-outline"
                        style={{
                          alignSelf: 'center',
                          padding: '6px',
                          borderRadius: '50%',
                          minHeight: 'auto',
                          width: '32px',
                          height: '32px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderColor: 'var(--glass-border)'
                        }}
                        title={locale === 'en' ? 'Mark as read' : 'Đánh dấu đã đọc'}
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(notif.id);
                        }}
                      >
                        <Eye size={14} />
                      </button>
                    )}
                  </div>
                );
              })
            )}

            {/* Phân trang UI */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                >
                  {locale === 'en' ? 'Previous' : 'Trước'}
                </button>
                <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {locale === 'en' ? `Page ${page} of ${totalPages}` : `Trang ${page} trên ${totalPages}`}
                </span>
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={page === totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                >
                  {locale === 'en' ? 'Next' : 'Sau'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Cột phải: Cấu hình tuỳ chọn nhận thông báo */}
        <div className="glass-panel" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px' }}>
            <Settings size={18} style={{ color: 'var(--color-primary)' }} />
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {locale === 'en' ? 'Notification Settings' : 'Cấu hình nhận thông báo'}
            </h3>
          </div>

          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
            {locale === 'en' 
              ? 'Select which categories you want to receive notifications for. Critical medical updates cannot be turned off.' 
              : 'Chọn danh mục thông báo bạn muốn nhận. Các cập nhật y tế khẩn cấp sẽ luôn được gửi.'}
          </p>

          {!preferences ? (
            <div className="skeleton" style={{ height: '180px', width: '100%' }} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {(Object.keys(preferences) as Array<keyof NotificationPreferences>).map((key) => {
                const isHealth = key === 'health';
                return (
                  <div 
                    key={key} 
                    style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      padding: '8px 0',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ color: 'var(--text-secondary)' }}>
                        {getCategoryIcon(key)}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 650, color: 'var(--text-primary)' }}>
                          {getCategoryLabel(key)}
                        </span>
                        {isHealth && (
                          <span style={{ fontSize: '0.65rem', color: 'var(--color-critical)', fontWeight: 600 }}>
                            {locale === 'en' ? 'Always enabled' : 'Luôn bật'}
                          </span>
                        )}
                      </div>
                    </div>

                    <label 
                      className="switch-container" 
                      style={{ 
                        position: 'relative', 
                        display: 'inline-block', 
                        width: '38px', 
                        height: '20px',
                        cursor: isHealth ? 'not-allowed' : 'pointer',
                        opacity: isHealth ? 0.6 : 1
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isHealth ? true : preferences[key]}
                        disabled={isHealth}
                        onChange={() => handlePreferenceToggle(key)}
                        style={{ opacity: 0, width: 0, height: 0 }}
                      />
                      <span
                        className="slider-round"
                        style={{
                          position: 'absolute',
                          cursor: isHealth ? 'not-allowed' : 'pointer',
                          top: 0, left: 0, right: 0, bottom: 0,
                          backgroundColor: (isHealth || preferences[key]) ? 'var(--color-primary)' : 'var(--glass-border, #ccc)',
                          transition: '0.3s',
                          borderRadius: '20px',
                        }}
                      >
                        <span
                          style={{
                            position: 'absolute',
                            content: '""',
                            height: '14px', width: '14px',
                            left: (isHealth || preferences[key]) ? '20px' : '3px',
                            bottom: '3px',
                            backgroundColor: 'white',
                            transition: '0.3s',
                            borderRadius: '50%',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                          }}
                        />
                      </span>
                    </label>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
