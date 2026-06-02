-- =============================================================================
-- CardioGuard AI — Role Security & Onboarding Profiles Migration
-- =============================================================================

-- 1. Alter users table to add status/verification columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 2. Create doctor_profiles table
CREATE TABLE IF NOT EXISTS doctor_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone TEXT,
    gender TEXT,
    date_of_birth DATE,
    address TEXT,
    specialty TEXT,
    position TEXT,
    workplace TEXT,
    experience_years INTEGER,
    license_number TEXT,
    license_issued_date DATE,
    license_issued_by TEXT,
    license_certificate_url TEXT,
    cccd_front_url TEXT,
    cccd_back_url TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    verification_note TEXT,
    status TEXT DEFAULT 'pending_profile',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_doctor_profile_user UNIQUE (user_id)
);

-- 3. Create patient_profiles table
CREATE TABLE IF NOT EXISTS patient_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone TEXT,
    gender TEXT,
    date_of_birth DATE,
    address TEXT,
    blood_type TEXT,
    medical_history TEXT,
    allergies TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    avatar_url TEXT,
    profile_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_patient_profile_user UNIQUE (user_id)
);

-- 4. Create trigger to update updated_at for doctor_profiles
CREATE OR REPLACE FUNCTION update_doctor_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_doctor_profiles_updated_at ON doctor_profiles;
CREATE TRIGGER trigger_update_doctor_profiles_updated_at
BEFORE UPDATE ON doctor_profiles
FOR EACH ROW
EXECUTE FUNCTION update_doctor_profiles_updated_at();

-- 5. Create trigger to update updated_at for patient_profiles
CREATE OR REPLACE FUNCTION update_patient_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_patient_profiles_updated_at ON patient_profiles;
CREATE TRIGGER trigger_update_patient_profiles_updated_at
BEFORE UPDATE ON patient_profiles
FOR EACH ROW
EXECUTE FUNCTION update_patient_profiles_updated_at();
