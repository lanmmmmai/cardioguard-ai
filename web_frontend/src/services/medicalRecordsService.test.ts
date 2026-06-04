import { describe, expect, it, vi, beforeEach } from 'vitest';
import { medicalRecordsService } from './medicalRecordsService';

describe('medicalRecordsService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockContext = {
    accessToken: 'test-token',
    currentUserId: 'doctor-1',
    role: 'doctor' as const,
  };

  it('getDoctorAssignedPatients() trả về mảng ID bệnh nhân duy nhất', async () => {
    const mockPatientsResponse = {
      items: [
        { id: 'pat-1', full_name: 'Patient A' },
        { id: 'pat-2', full_name: 'Patient B' },
        { id: 'pat-1', full_name: 'Patient A' }, // Trùng lặp
      ],
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(mockPatientsResponse),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await medicalRecordsService.getDoctorAssignedPatients(mockContext, 'doctor-1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual(['pat-1', 'pat-2']);
  });

  it('getDoctorMedicalRecords() lọc và làm giàu (enrich) thông tin bệnh án cho bác sĩ', async () => {
    const mockRecords = {
      items: [
        { id: 'rec-1', patient_id: 'pat-1', doctor_id: 'doctor-1', chief_complaint: 'Đau ngực', status: 'draft' },
        { id: 'rec-2', patient_id: 'pat-2', doctor_id: 'doctor-2', chief_complaint: 'Ho khan', status: 'signed' },
      ],
    };

    const mockPatients = {
      items: [
        { id: 'pat-1', full_name: 'Patient A', phone: '123' },
        { id: 'pat-2', full_name: 'Patient B', phone: '456' },
      ],
    };

    const mockDoctors = {
      items: [
        { id: 'doctor-1', full_name: 'Doctor A', specialty: 'cardiology' },
        { id: 'doctor-2', full_name: 'Doctor B', specialty: 'pulmonology' },
      ],
    };

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      let data = {};
      if (url.includes('/medical-records')) data = mockRecords;
      else if (url.includes('/patients')) data = mockPatients;
      else if (url.includes('/admin/doctors')) data = mockDoctors;
      else if (url.includes('/doctor/profile')) data = { full_name: 'Doctor A', specialty: 'cardiology' };

      return Promise.resolve({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(data),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await medicalRecordsService.getDoctorMedicalRecords(mockContext, 'doctor-1');

    expect(result.length).toBe(1);
    expect(result[0].id).toBe('rec-1');
    expect(result[0].patient_profile?.full_name).toBe('Patient A');
    expect(result[0].doctor_profile?.specialty).toBe('cardiology');
  });

  it('getPatientMedicalRecords() chỉ trả về các bệnh án có trạng thái đã ký/khóa và được phép hiển thị cho bệnh nhân', async () => {
    const mockRecords = [
      { id: 'rec-1', patient_id: 'pat-1', doctor_id: 'doctor-1', status: 'signed', is_visible_to_patient: true },
      { id: 'rec-2', patient_id: 'pat-1', doctor_id: 'doctor-1', status: 'draft', is_visible_to_patient: false },
      { id: 'rec-3', patient_id: 'pat-1', doctor_id: 'doctor-1', status: 'locked', is_visible_to_patient: true },
    ];

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      let data: any = {};
      if (url.includes('/medical-records')) data = mockRecords;
      else if (url.includes('/patient/profile')) data = { full_name: 'Patient A' };
      else if (url.includes('/patients/me/doctors')) data = { items: [{ id: 'doctor-1', full_name: 'Doctor A' }] };

      return Promise.resolve({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(data),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const patientContext = { accessToken: 'token', currentUserId: 'pat-1', role: 'patient' as const };
    const result = await medicalRecordsService.getPatientMedicalRecords(patientContext, 'pat-1');

    expect(result.length).toBe(2);
    expect(result.map(r => r.id)).toEqual(['rec-1', 'rec-3']);
  });

  it('createMedicalRecord() gửi POST request tạo bệnh án nháp', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: 'rec-new', patient_id: 'pat-1', status: 'draft' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const payload = {
      patient_id: 'pat-1',
      chief_complaint: 'Đau đầu',
      specialty: 'general' as any,
    };

    const result = await medicalRecordsService.createMedicalRecord(mockContext, payload);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, calledOptions] = fetchMock.mock.calls[0];
    expect(calledOptions.method).toBe('POST');
    expect(JSON.parse(calledOptions.body).chief_complaint).toBe('Đau đầu');
    expect(result.id).toBe('rec-new');
  });

  it('updateMedicalRecord() ném lỗi khi cố sửa đổi bệnh án đã ký', async () => {
    const mockRecord = { id: 'rec-1', status: 'signed' };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(mockRecord),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      medicalRecordsService.updateMedicalRecord(mockContext, 'rec-1', { chief_complaint: 'Sửa đổi' })
    ).rejects.toThrow('Bệnh án đã ký, cần tạo bản bổ sung/chỉnh sửa thay vì sửa trực tiếp.');
  });

  it('signMedicalRecord() cập nhật trạng thái đã ký và gửi notification', async () => {
    const mockSignedResponse = {
      id: 'rec-1',
      patient_id: 'pat-1',
      status: 'signed',
      is_visible_to_patient: true,
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(mockSignedResponse),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await medicalRecordsService.signMedicalRecord(mockContext, 'rec-1');

    expect(result.status).toBe('signed');
    expect(result.is_visible_to_patient).toBe(true);
    // 2 calls: 1 for patching record, 1 for patient notification
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
