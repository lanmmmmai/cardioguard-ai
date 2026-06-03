/**
 * Mục đích: Trung tâm điều khiển AI dành cho bác sĩ. Cho phép bác sĩ chọn bệnh nhân
 *           (hoặc xem tất cả) và tương tác với AI qua ChatWindow để phân tích lâm sàng,
 *           tóm tắt và phát hiện bất thường.
 * Luồng xử lý: 1. Tải danh sách bệnh nhân khi khởi tạo → 2. Người dùng chọn bệnh nhân từ
 *             thanh bên → 3. Thông tin bệnh nhân được chọn được truyền làm ngữ cảnh cho
 *             ChatWindow → 4. Bác sĩ gửi truy vấn (ví dụ: "tóm tắt bệnh nhân nguy cơ cao").
 * Quan hệ:
 *   - Component ChatWindow cho hội thoại AI
 *   - AuthContext cho access token
 *   - Kiểu Patient từ types.ts
 */
import React, { useState, useEffect } from 'react';
import { Patient } from '../types';
import { Bot, Users, Activity, FileText } from 'lucide-react';
import { ChatWindow } from '../components/chat/ChatWindow';
import { useAuth } from '../auth/AuthContext';
import { API_URL } from '../config';

/**
 * Trang chatbot chính cho bác sĩ. Hiển thị thanh bên chọn bệnh nhân và
 * ChatWindow cho các truy vấn lâm sàng hỗ trợ AI.
 */
export const DoctorChatbot: React.FC = () => {
  const { accessToken } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  useEffect(() => {
    const fetchPatients = async () => {
      try {
        const res = await fetch(`${API_URL}/patients`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        const data = await res.json();
        setPatients(data || []);
      } catch (err) {
        console.error(err);
      }
    };
    fetchPatients();
  }, [accessToken]);

  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  return (
    <div className="doctor-chatbot-page">
      <div className="page-header">
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Bot size={28} style={{ color: 'var(--color-primary)' }} />
          AI Command Center
        </h1>
        <p className="page-subtitle">Trợ lý phân tích dữ liệu, tóm tắt bệnh án và phát hiện bất thường.</p>
      </div>

      <div className="chatbot-layout doctor-layout">
        <div className="chatbot-side-col">
          <div className="panel patient-selector-panel">
            <h3 className="panel-title"><Users size={16}/> Chọn bệnh nhân để phân tích</h3>
            <div className="patient-list-compact mt-3">
              <div 
                className={`patient-row-compact ${selectedPatientId === null ? 'active' : ''}`}
                onClick={() => setSelectedPatientId(null)}
              >
                <span>Tất cả bệnh nhân (Tổng quan)</span>
              </div>
              {patients.map(p => (
                <div 
                  key={p.id}
                  className={`patient-row-compact ${selectedPatientId === p.id ? 'active' : ''}`}
                  onClick={() => setSelectedPatientId(p.id)}
                >
                  <div className="avatar-mini">{p.full_name.charAt(0)}</div>
                  <div className="p-info">
                    <div className="p-name">{p.full_name}</div>
                    <div className="p-meta">{p.id.substring(0,8)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {selectedPatientId && (
            <div className="panel info-panel mt-4">
              <div className="info-panel-header">
                <FileText size={20} className="text-secondary" />
                <h3>Bệnh án tóm tắt</h3>
              </div>
              <div className="mt-3">
                <p className="text-sm text-muted mb-2">Bệnh nhân: <strong>{selectedPatient?.full_name}</strong></p>
                <button className="btn btn-secondary w-full text-sm">
                  <Activity size={14} /> Yêu cầu AI Phân tích nhanh
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="chatbot-main-col">
          <div className="panel chat-panel">
            <ChatWindow 
              role="doctor" 
              contextData={{ 
                focus_patient: selectedPatient || "All patients",
                request_type: "clinical_analysis"
              }} 
              placeholder="Ví dụ: Tóm tắt tình trạng của bệnh nhân nguy cơ cao nhất hiện tại..."
            />
          </div>
        </div>
      </div>
    </div>
  );
};
