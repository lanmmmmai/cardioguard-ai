from pydantic import BaseModel, EmailStr
from datetime import date
from typing import Optional

class PatientProfileUpdate(BaseModel):
    full_name: str
    phone: Optional[str] = None
    gender: Optional[str] = None
    date_of_birth: Optional[date] = None
    address: Optional[str] = None
    blood_type: Optional[str] = None
    medical_history: Optional[str] = None
    allergies: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    avatar_url: Optional[str] = None

class DoctorProfileUpdate(BaseModel):
    full_name: str
    gender: Optional[str] = None
    date_of_birth: Optional[date] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    specialty: str
    position: Optional[str] = None
    workplace: Optional[str] = None
    experience_years: Optional[int] = None
    license_number: str
    license_issued_date: Optional[date] = None
    license_issued_by: Optional[str] = None
    license_certificate_url: str
    cccd_front_url: str
    cccd_back_url: str
    avatar_url: Optional[str] = None

class DoctorVerificationAction(BaseModel):
    verification_note: Optional[str] = None
