# CMS & Email System

## CMS (Content Management System)

Dành riêng cho admin, quản lý nội dung qua API `/api/cms/*`.

### Modules

CMS hỗ trợ các module (tables) động: `domain_links`, `email_templates`, `email_functions`, và các data tables CRUD.

### Domain Links

Quản lý SEO meta tags cho từng đường dẫn. Khi crawler/social network request, server inject Open Graph tags vào HTML.

```
GET /api/cms/domain-links/resolve?path=/some-page
→ { title, description, image_url, domain }
```

| Endpoint | Mô tả |
|----------|-------|
| GET `/api/cms/domain-links/resolve` | Resolve path → SEO data |
| POST `/api/cms/domain-links/upload-image` | Upload preview image (5MB, PNG/JPG/WebP) |
| GET `/api/cms/domain-links/images/{file_name}` | Serve uploaded image |

### Data Tables (Generic CRUD)

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/api/cms/{module}` | List records (search, filter, sort, pagination) |
| GET | `/api/cms/{module}/{id}` | Get record |
| POST | `/api/cms/{module}` | Create record |
| PUT | `/api/cms/{module}/{id}` | Update record |
| DELETE | `/api/cms/{module}/{id}` | Delete record |
| GET | `/api/cms/{module}/export-csv` | Export CSV (max 200 rows) |
| POST | `/api/cms/{module}/import-csv` | Import CSV (transactional) |

**Restricted modules (read-only for CRUD):** users, patients, alerts, sensor_data, prescriptions, medical_records, reports

### Email Functions & Templates

Quản lý định nghĩa email functions và templates.

| Endpoint | Mô tả |
|----------|-------|
| GET/POST `/api/cms/email-functions` | List/create functions |
| PUT `/api/cms/email-functions/{id}` | Update function |
| GET `/api/cms/email-templates` | List templates |
| POST `/api/cms/email-templates` | Create template |
| PUT `/api/cms/email-templates/{id}` | Update template |
| DELETE `/api/cms/email-templates/{id}` | Delete template |
| PATCH `/api/cms/email-templates/{id}/activate` | Activate/deactivate |

## Email System

### Architecture

```
Admin UI → Email API → Brevo API (primary)
                      → SMTP (fallback, dev mode)
```

### Endpoints

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/api/email/templates` | List templates |
| POST | `/api/email/templates` | Create template |
| POST | `/api/email/preview` | Preview rendered HTML |
| POST | `/api/email/send` | Send email (template hoặc raw) |
| GET | `/api/email/logs` | Email logs (search, filter, pagination) |
| POST | `/api/email/logs/{id}/retry` | Retry failed email |
| GET | `/api/email/export-logs` | Export logs CSV (max 1000 rows) |
| POST | `/api/email/import-recipients` | Parse CSV recipients |
| GET | `/api/email/variables` | Danh sách template variables |

### Template Variables

Các biến có thể dùng trong template HTML:

| Variable | Mô tả |
|----------|-------|
| `{{full_name}}` | Tên người nhận |
| `{{otp_code}}` | Mã OTP |
| `{{email}}` | Email người nhận |
| `{{login_url}}` | URL đăng nhập |
| `{{site_name}}` | Tên hệ thống |
| `{{year}}` | Năm hiện tại |

### Email Flow

```
Send Request
  → Tìm active template theo email_type
  → Render HTML (thay variables)
  → Gửi qua Brevo API
    → Nếu lỗi: fallback SMTP (dev only)
  → Ghi log vào email_logs
```
