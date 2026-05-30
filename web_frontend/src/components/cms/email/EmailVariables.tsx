import React from 'react';

// Danh sách biến động được hỗ trợ (hiển thị reference)
const VARIABLES = [
  { name: 'full_name',        syntax: '{{full_name}}',        desc: 'Họ và tên người nhận' },
  { name: 'otp',              syntax: '{{otp}}',              desc: 'Mã OTP 6 chữ số' },
  { name: 'doctor_name',      syntax: '{{doctor_name}}',      desc: 'Tên bác sĩ phụ trách' },
  { name: 'heart_rate',       syntax: '{{heart_rate}}',       desc: 'Nhịp tim (bpm)' },
  { name: 'spo2',             syntax: '{{spo2}}',             desc: 'Độ bão hòa oxy (%)' },
  { name: 'alert_message',    syntax: '{{alert_message}}',    desc: 'Nội dung cảnh báo' },
  { name: 'hospital_name',    syntax: '{{hospital_name}}',    desc: 'Tên hệ thống (tự động)' },
  { name: 'current_date',     syntax: '{{current_date}}',     desc: 'Ngày giờ hiện tại (tự động)' },
  { name: 'email',            syntax: '{{email}}',            desc: 'Địa chỉ email người nhận' },
  { name: 'appointment_date', syntax: '{{appointment_date}}', desc: 'Ngày hẹn khám' },
  { name: 'medication_name',  syntax: '{{medication_name}}',  desc: 'Tên thuốc' },
  { name: 'patient_name',     syntax: '{{patient_name}}',     desc: 'Tên bệnh nhân' },
];

interface EmailVariablesProps {
  /** Khi click vào variable, copy vào clipboard */
  onInsert?: (syntax: string) => void;
}

export const EmailVariables: React.FC<EmailVariablesProps> = ({ onInsert }) => {
  const [copied, setCopied] = React.useState<string | null>(null);

  const handleCopy = (syntax: string) => {
    navigator.clipboard.writeText(syntax).catch(() => {});
    setCopied(syntax);
    setTimeout(() => setCopied(null), 1500);
    onInsert?.(syntax);
  };

  return (
    <div className="email-variables-panel">
      <div className="email-variables-header">
        <h3 className="email-variables-title">Biến động hỗ trợ</h3>
        <p className="email-variables-subtitle">
          Sao chép và dán vào HTML để tự động điền dữ liệu khi gửi email.
        </p>
      </div>
      <div className="email-variables-grid">
        {VARIABLES.map((v) => (
          <button
            key={v.name}
            type="button"
            className="email-variable-card"
            onClick={() => handleCopy(v.syntax)}
            title={`Click để sao chép ${v.syntax}`}
          >
            <div className="email-variable-syntax">
              {copied === v.syntax ? '✓ Đã sao chép!' : v.syntax}
            </div>
            <div className="email-variable-desc">{v.desc}</div>
          </button>
        ))}
      </div>

      <div className="email-variables-example">
        <h4>Ví dụ sử dụng</h4>
        <pre className="email-variables-code">{`<p>Xin chào <strong>{{full_name}}</strong>,</p>
<p>Mã OTP của bạn là: <strong>{{otp}}</strong></p>
<p>Nhịp tim hiện tại: {{heart_rate}} bpm</p>
<p>Ngày: {{current_date}}</p>`}</pre>
      </div>
    </div>
  );
};
