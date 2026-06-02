import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Mail, 
  Bot, 
  Database, 
  Save, 
  RefreshCw, 
  Sliders, 
  Cpu, 
  CheckCircle,
  AlertTriangle
} from 'lucide-react';

export const SystemSettings: React.FC = () => {
  // 1. Biological Threshold States
  const [minHr, setMinHr] = useState<number>(50);
  const [maxHr, setMaxHr] = useState<number>(120);
  const [minSpo2, setMinSpo2] = useState<number>(92);
  const [maxSysBp, setMaxSysBp] = useState<number>(140);
  const [maxDiaBp, setMaxDiaBp] = useState<number>(90);

  // 2. Platform URL States
  const [apiUrl, setApiUrl] = useState<string>('https://cardioguard-ai-a26e.onrender.com');
  const [wsUrl, setWsUrl] = useState<string>('wss://cardioguard-ai-a26e.onrender.com/ws/realtime');

  // 3. Notification Automation States
  const [emailAlertEnabled, setEmailAlertEnabled] = useState<boolean>(true);
  const [otpVerifyRequired, setOtpVerifyRequired] = useState<boolean>(true);

  // 4. AI Engine States
  const [aiModel, setAiModel] = useState<string>('gpt-4o');
  const [aiPersonality, setAiPersonality] = useState<string>('clinical');

  // 5. Operation Diagnostics mock/status states
  const [dbStatus, setDbStatus] = useState<'healthy' | 'checking'>('healthy');
  const [sensorGatewayStatus, setSensorGatewayStatus] = useState<'active' | 'checking'>('active');

  // UI state
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [showSuccessBanner, setShowSuccessBanner] = useState<boolean>(false);

  // Load settings from localStorage on init
  useEffect(() => {
    const savedMinHr = localStorage.getItem('settings_min_hr');
    const savedMaxHr = localStorage.getItem('settings_max_hr');
    const savedMinSpo2 = localStorage.getItem('settings_min_spo2');
    const savedMaxSysBp = localStorage.getItem('settings_max_sys_bp');
    const savedMaxDiaBp = localStorage.getItem('settings_max_dia_bp');
    const savedApiUrl = localStorage.getItem('settings_api_url');
    const savedWsUrl = localStorage.getItem('settings_ws_url');
    const savedEmailAlert = localStorage.getItem('settings_email_alert');
    const savedOtpVerify = localStorage.getItem('settings_otp_verify');
    const savedAiModel = localStorage.getItem('settings_ai_model');
    const savedAiPersonality = localStorage.getItem('settings_ai_personality');

    if (savedMinHr) setMinHr(Number(savedMinHr));
    if (savedMaxHr) setMaxHr(Number(savedMaxHr));
    if (savedMinSpo2) setMinSpo2(Number(savedMinSpo2));
    if (savedMaxSysBp) setMaxSysBp(Number(savedMaxSysBp));
    if (savedMaxDiaBp) setMaxDiaBp(Number(savedMaxDiaBp));
    if (savedApiUrl) setApiUrl(savedApiUrl);
    if (savedWsUrl) setWsUrl(savedWsUrl);
    if (savedEmailAlert) setEmailAlertEnabled(savedEmailAlert === 'true');
    if (savedOtpVerify) setOtpVerifyRequired(savedOtpVerify === 'true');
    if (savedAiModel) setAiModel(savedAiModel);
    if (savedAiPersonality) setAiPersonality(savedAiPersonality);
  }, []);

  const handleSave = () => {
    setIsSaving(true);
    
    // Simulate save processing
    setTimeout(() => {
      localStorage.setItem('settings_min_hr', String(minHr));
      localStorage.setItem('settings_max_hr', String(maxHr));
      localStorage.setItem('settings_min_spo2', String(minSpo2));
      localStorage.setItem('settings_max_sys_bp', String(maxSysBp));
      localStorage.setItem('settings_max_dia_bp', String(maxDiaBp));
      localStorage.setItem('settings_api_url', apiUrl);
      localStorage.setItem('settings_ws_url', wsUrl);
      localStorage.setItem('settings_email_alert', String(emailAlertEnabled));
      localStorage.setItem('settings_otp_verify', String(otpVerifyRequired));
      localStorage.setItem('settings_ai_model', aiModel);
      localStorage.setItem('settings_ai_personality', aiPersonality);

      setIsSaving(false);
      setShowSuccessBanner(true);

      // Auto dismiss success banner after 4 seconds
      setTimeout(() => {
        setShowSuccessBanner(false);
      }, 4000);
    }, 1200);
  };

  const handleResetDiagnostics = () => {
    setDbStatus('checking');
    setSensorGatewayStatus('checking');
    setTimeout(() => {
      setDbStatus('healthy');
      setSensorGatewayStatus('active');
    }, 1500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Banner thông báo thành công */}
      {showSuccessBanner && (
        <div className="alert-strip success" style={{
          borderLeft: '3px solid #10b981',
          background: 'rgba(16, 185, 129, 0.08)',
          padding: '16px',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          animation: 'pulse-halo 2s infinite'
        }}>
          <CheckCircle size={20} style={{ color: '#10b981' }} />
          <div className="alert-strip-body">
            <strong style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>Thành công!</strong>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '2px 0 0' }}>
              Cấu hình hệ thống CardioGuard AI đã được lưu trữ cục bộ thành công.
            </p>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid-2-3">
        {/* Left Column: Config settings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Section 1: Biological thresholds */}
          <section className="panel">
            <h3 className="metric-title" style={{ color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
              <ShieldAlert size={18} /> Ngưỡng Báo Động Sinh Học (Lâm Sàng)
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              <div style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Phạm vi Nhịp tim lý tưởng (BPM)</span>
                  <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>{minHr} - {maxHr} BPM</span>
                </label>
                <div style={{ display: 'flex', gap: '12px', marginTop: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Min:</span>
                  <input 
                    type="range" 
                    min="40" 
                    max="80" 
                    value={minHr} 
                    onChange={(e) => setMinHr(Number(e.target.value))}
                    style={{ flex: 1, accentColor: 'var(--color-primary)' }}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Max:</span>
                  <input 
                    type="range" 
                    min="100" 
                    max="180" 
                    value={maxHr} 
                    onChange={(e) => setMaxHr(Number(e.target.value))}
                    style={{ flex: 1, accentColor: 'var(--color-primary)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>Ngưỡng cảnh báo SpO2 tối thiểu (%)</span>
                  </label>
                  <select 
                    className="form-control" 
                    value={minSpo2} 
                    onChange={(e) => setMinSpo2(Number(e.target.value))}
                    style={{ marginTop: '6px' }}
                  >
                    <option value={90}>Dưới 90% (Nguy hiểm)</option>
                    <option value={92}>Dưới 92% (Khuyên dùng)</option>
                    <option value={94}>Dưới 94% (Nhẹ)</option>
                    <option value={95}>Dưới 95%</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Huyết áp tâm thu tối đa (Systolic BP)</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    value={maxSysBp}
                    onChange={(e) => setMaxSysBp(Number(e.target.value))}
                    style={{ marginTop: '6px' }}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Huyết áp tâm trương tối đa (Diastolic BP)</label>
                <input 
                  type="number" 
                  className="form-control" 
                  value={maxDiaBp}
                  onChange={(e) => setMaxDiaBp(Number(e.target.value))}
                  style={{ marginTop: '6px', maxWidth: '48.5%' }}
                />
              </div>

            </div>
          </section>

          {/* Section 2: Platform Connections */}
          <section className="panel">
            <h3 className="metric-title" style={{ color: 'var(--color-spo2)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
              <Sliders size={18} /> Cấu Hình Môi Trường & Địa Chỉ Server
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              <div className="form-group">
                <label>Địa chỉ API Gateway (HTTP URL)</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  style={{ marginTop: '6px' }}
                />
              </div>

              <div className="form-group">
                <label>Địa chỉ WebSocket Endpoint (WS URL)</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={wsUrl}
                  onChange={(e) => setWsUrl(e.target.value)}
                  style={{ marginTop: '6px' }}
                />
              </div>

              <div className="alert-strip low" style={{ marginTop: '0.5rem' }}>
                <div className="alert-strip-body">
                  <div className="alert-strip-desc" style={{ fontSize: '0.75rem' }}>
                    <AlertTriangle size={12} style={{ display: 'inline', marginRight: '4px' }} />
                    <strong>Lưu ý kỹ thuật:</strong> Cấu hình API/WS tại đây hiện chỉ lưu trữ cục bộ để phục vụ UI Debugging. Ứng dụng thực tế sẽ sử dụng biến môi trường (VITE_API_URL) được nhúng từ lúc Build. Để thay đổi nguồn gốc server thực sự, vui lòng cập nhật file .env và Build lại dự án.
                  </div>
                </div>
              </div>

            </div>
          </section>

          {/* Action Save button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button 
              type="button" 
              className="btn btn-primary" 
              onClick={handleSave} 
              disabled={isSaving}
              style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem' }}
            >
              {isSaving ? (
                <>
                  <RefreshCw className="profile-spin" size={18} />
                  Đang lưu cấu hình...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Lưu Cấu Hình Hệ Thống
                </>
              )}
            </button>
          </div>

        </div>

        {/* Right Column: AI & Notifications */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Section 3: Notification Toggles */}
          <section className="panel" style={{ height: 'fit-content' }}>
            <h3 className="metric-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
              <Mail size={18} style={{ color: 'var(--color-warning)' }} /> Tự Động Hóa Thông Báo
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block' }}>Email Cảnh Báo Lâm Sàng</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Gửi mail tự động cho bác sĩ khi nhịp tim/SpO2 vượt ngưỡng.</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={emailAlertEnabled}
                  onChange={(e) => setEmailAlertEnabled(e.target.checked)}
                  style={{ width: '38px', height: '20px', cursor: 'pointer', accentColor: 'var(--color-primary)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--glass-border)', paddingTop: '1.15rem' }}>
                <div>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block' }}>Yêu Cầu Xác Thực OTP</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Bắt buộc xác thực tài khoản bệnh nhân qua OTP Email.</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={otpVerifyRequired}
                  onChange={(e) => setOtpVerifyRequired(e.target.checked)}
                  style={{ width: '38px', height: '20px', cursor: 'pointer', accentColor: 'var(--color-primary)' }}
                />
              </div>

            </div>
          </section>

          {/* Section 4: AI Settings */}
          <section className="panel" style={{ height: 'fit-content' }}>
            <h3 className="metric-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
              <Bot size={18} style={{ color: 'var(--color-bp)' }} /> Trợ Lý Ảo AI Engine
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
              
              <div className="form-group">
                <label>Mô hình ngôn ngữ lớn (LLM Model)</label>
                <select 
                  className="form-control" 
                  value={aiModel} 
                  onChange={(e) => setAiModel(e.target.value)}
                  style={{ marginTop: '6px' }}
                >
                  <option value="gpt-4o">GPT-4o (Khuyên dùng - Độ chính xác cao)</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Tốc độ phản hồi nhanh)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Tính cách Phản hồi AI (Tone)</label>
                <select 
                  className="form-control" 
                  value={aiPersonality} 
                  onChange={(e) => setAiPersonality(e.target.value)}
                  style={{ marginTop: '6px' }}
                >
                  <option value="clinical">Chuyên gia lâm sàng (Nghiêm túc, chính xác)</option>
                  <option value="friendly">Tư vấn viên (Thân thiện, giải thích chi tiết)</option>
                  <option value="standard">Thông thường (Ngắn gọn)</option>
                </select>
              </div>

            </div>
          </section>

          {/* Section 5: System Diagnostics */}
          <section className="panel" style={{ height: 'fit-content' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 className="metric-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <Cpu size={18} style={{ color: '#8b5cf6' }} /> Trạng Thái Hệ Thống
              </h3>
              <button 
                type="button" 
                onClick={handleResetDiagnostics}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}
                title="Làm mới trạng thái"
              >
                <RefreshCw size={12} className={dbStatus === 'checking' ? 'profile-spin' : ''} /> Làm mới
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.85rem' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Database size={14} /> Cơ sở dữ liệu (Supabase)
                </span>
                {dbStatus === 'healthy' ? (
                  <span className="patient-status normal" style={{ fontSize: '0.75rem', padding: '2px 8px' }}>Khỏe mạnh</span>
                ) : (
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Đang kiểm tra...</span>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--glass-border)', paddingTop: '0.8rem' }}>
                <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Cpu size={14} /> IoT Gateway (Sensor telemetry)
                </span>
                {sensorGatewayStatus === 'active' ? (
                  <span className="patient-status normal" style={{ fontSize: '0.75rem', padding: '2px 8px' }}>Nhận tín hiệu</span>
                ) : (
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Đang kiểm tra...</span>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--glass-border)', paddingTop: '0.8rem' }}>
                <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={14} /> Tường lửa & Rate Limit (Bảo mật)
                </span>
                <span className="patient-status normal" style={{ fontSize: '0.75rem', padding: '2px 8px' }}>An toàn</span>
              </div>

            </div>
          </section>

        </div>
      </div>

    </div>
  );
};
export default SystemSettings;
