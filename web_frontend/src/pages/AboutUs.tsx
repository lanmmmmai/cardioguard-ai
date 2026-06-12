import React, { useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, Mail, Phone, MapPin, Calendar, User, Eye, X } from 'lucide-react';
import { useLocale } from '../i18n/locale';

interface Article {
  id: string;
  title: string;
  slug: string;
  content: string;
  summary?: string;
  category?: string;
  author_name?: string;
  created_at: string;
}

const SUPPORT_PHONE = '0382683221';
const SUPPORT_EMAIL = 'lanmmmmai@gmail.com';

export const AboutUs: React.FC = () => {
  const { locale } = useLocale();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  const handleBack = () => {
    window.history.back();
  };

  const isVi = locale === 'vi';

  useEffect(() => {
    fetch('/api/public/articles')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch articles');
        return res.json();
      })
      .then((data) => {
        setArticles(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="role-page-stack" style={{ maxWidth: '1000px', margin: '2rem auto', padding: '0 1.5rem' }}>
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <div>
          <h1 className="page-title" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
            {isVi ? 'Giới thiệu CardioGuard AI' : 'About CardioGuard AI'}
          </h1>
          <p className="page-subtitle">
            {isVi 
              ? 'Hệ thống AI giám sát điện tâm đồ, SpO2, huyết áp và cảnh báo sớm biến cố tim mạch'
              : 'AI-powered clinical monitoring system for real-time ECG, SpO2, and cardiac emergencies'}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
        {/* Company Info Panel */}
        <section className="panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <h3 className="metric-title" style={{ color: 'var(--color-primary)', fontSize: '1.2rem', fontWeight: 700 }}>
            {isVi ? 'Thông Tin Công Ty & Giải Pháp' : 'Company & Solution Overview'}
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6 }}>
            {isVi 
              ? 'CardioGuard AI là một giải pháp y tế số tiên tiến kết hợp thiết bị đeo thông minh IoT và thuật toán học sâu để theo dõi chỉ số sinh tồn liên tục. Chúng tôi hướng tới việc giảm thiểu rủi ro biến cố tim mạch, phát hiện té ngã thời gian thực và kết nối trực tuyến nhanh nhất giữa bệnh nhân và đội ngũ bác sĩ chuyên khoa.'
              : 'CardioGuard AI is a cutting-edge digital health platform combining wearable IoT telemetry and deep learning algorithms. We aim to mitigate cardiac event risks, detect physical falls in real-time, and establish instant online linkages between clinical patients and specialized cardiologists.'}
          </p>

          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
            gap: '1.5rem', 
            borderTop: '1px solid var(--glass-border)', 
            paddingTop: '1.5rem',
            marginTop: '0.5rem'
          }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{ 
                color: 'var(--color-primary)', 
                background: 'var(--color-primary-glow)', 
                padding: '10px', 
                borderRadius: '10px' 
              }}>
                <MapPin size={20} />
              </div>
              <div>
                <strong style={{ color: 'var(--text-primary)', display: 'block', fontSize: '0.9rem', marginBottom: '4px' }}>
                  {isVi ? 'Địa chỉ trụ sở' : 'Office Address'}
                </strong>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  {isVi 
                    ? 'Tòa nhà Vincom Tây Mỗ, Đại lộ Thăng Long, Nam Từ Liêm, Hà Nội' 
                    : 'Vincom Tay Mo Building, Thang Long Ave, Nam Tu Liem, Hanoi'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{ 
                color: 'var(--color-spo2)', 
                background: 'var(--color-spo2-glow)', 
                padding: '10px', 
                borderRadius: '10px' 
              }}>
                <Phone size={20} />
              </div>
              <div>
                <strong style={{ color: 'var(--text-primary)', display: 'block', fontSize: '0.9rem', marginBottom: '4px' }}>
                  {isVi ? 'Số điện thoại hỗ trợ' : 'Customer Hotline'}
                </strong>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  {SUPPORT_PHONE} (24/7 Support)
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{ 
                color: 'var(--color-bp)', 
                background: 'var(--color-bp-glow)', 
                padding: '10px', 
                borderRadius: '10px' 
              }}>
                <Mail size={20} />
              </div>
              <div>
                <strong style={{ color: 'var(--text-primary)', display: 'block', fontSize: '0.9rem', marginBottom: '4px' }}>
                  {isVi ? 'Hòm thư điện tử' : 'Email Inquiry'}
                </strong>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  {SUPPORT_EMAIL}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Articles Section */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <h3 className="metric-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.2rem', fontWeight: 700 }}>
            <BookOpen size={22} style={{ color: 'var(--color-spo2)' }} />
            {isVi ? 'Bài viết Y khoa & Hướng dẫn Sức khỏe' : 'Clinical Library & Health Guidance'}
          </h3>

          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              {isVi ? 'Đang tải bài viết y khoa...' : 'Loading clinical database...'}
            </div>
          ) : articles.length === 0 ? (
            <div className="panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              {isVi ? 'Chưa có bài viết nào được đăng tải.' : 'No articles published yet.'}
            </div>
          ) : (
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
              gap: '1.5rem' 
            }}>
              {articles.map((article) => (
                <div 
                  key={article.id} 
                  className="panel" 
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    justifyContent: 'space-between', 
                    padding: '1.5rem',
                    transition: 'var(--transition-smooth)',
                    border: '1px solid var(--glass-border)',
                    height: '100%'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="patient-status normal" style={{ 
                        fontSize: '0.75rem', 
                        padding: '4px 8px', 
                        borderRadius: '6px', 
                        fontWeight: 600,
                        background: 'rgba(3, 105, 161, 0.1)',
                        color: 'var(--color-primary)'
                      }}>
                        {article.category || (isVi ? 'Chung' : 'General')}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={12} />
                        {new Date(article.created_at).toLocaleDateString(isVi ? 'vi-VN' : 'en-US')}
                      </span>
                    </div>

                    <h4 style={{ 
                      fontSize: '1rem', 
                      fontWeight: 700, 
                      color: 'var(--text-primary)', 
                      lineHeight: 1.4,
                      margin: 0
                    }}>
                      {article.title}
                    </h4>

                    <p style={{ 
                      fontSize: '0.85rem', 
                      color: 'var(--text-secondary)', 
                      lineHeight: 1.5,
                      margin: 0,
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {article.summary || (isVi ? 'Không có tóm tắt.' : 'No summary available.')}
                    </p>
                  </div>

                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    borderTop: '1px solid var(--glass-border)',
                    paddingTop: '1rem',
                    marginTop: '1rem'
                  }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <User size={12} />
                      {article.author_name || (isVi ? 'Bác sĩ CardioGuard' : 'CardioGuard Doctor')}
                    </span>
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      style={{ 
                        padding: '6px 12px', 
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                      onClick={() => setSelectedArticle(article)}
                    >
                      <Eye size={12} />
                      {isVi ? 'Đọc bài' : 'Read'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '0.5rem', flexWrap: 'wrap' }}>
          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={handleBack}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <ArrowLeft size={16} />
            {isVi ? 'Quay lại' : 'Back'}
          </button>
        </div>
      </div>

      {/* Article Reader Modal */}
      {selectedArticle && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '1.5rem',
          backdropFilter: 'blur(8px)'
        }}>
          <div className="panel" style={{
            maxWidth: '750px',
            width: '100%',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            padding: '2rem',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <button 
              type="button"
              style={{
                position: 'absolute',
                top: '1.5rem',
                right: '1.5rem',
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer'
              }}
              onClick={() => setSelectedArticle(null)}
            >
              <X size={24} />
            </button>

            <div style={{ overflowY: 'auto', paddingRight: '10px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '1rem' }}>
                <span className="patient-status normal" style={{ 
                  fontSize: '0.75rem', 
                  padding: '4px 8px', 
                  borderRadius: '6px', 
                  fontWeight: 600,
                  background: 'rgba(3, 105, 161, 0.1)',
                  color: 'var(--color-primary)'
                }}>
                  {selectedArticle.category || (isVi ? 'Chung' : 'General')}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Calendar size={12} />
                  {new Date(selectedArticle.created_at).toLocaleDateString(isVi ? 'vi-VN' : 'en-US')}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <User size={12} />
                  {selectedArticle.author_name || (isVi ? 'Bác sĩ CardioGuard' : 'CardioGuard Doctor')}
                </span>
              </div>

              <h2 style={{ 
                fontSize: '1.5rem', 
                fontWeight: 800, 
                color: 'var(--text-primary)', 
                lineHeight: 1.3,
                marginBottom: '1.5rem'
              }}>
                {selectedArticle.title}
              </h2>

              <div 
                className="article-rich-content"
                style={{ 
                  fontSize: '0.95rem', 
                  color: 'var(--text-secondary)', 
                  lineHeight: 1.7
                }}
                dangerouslySetInnerHTML={{ __html: selectedArticle.content }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1rem' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setSelectedArticle(null)}
              >
                {isVi ? 'Đóng' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AboutUs;
