import asyncio
import os
import sys
import time
import subprocess
import requests
import shutil
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = REPO_ROOT / "backend"
STORAGE_ROOT = BACKEND_DIR / "storage"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import os
os.environ["DATABASE_URL"] = os.getenv("TEST_DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/test_db")

from app.main import app
from app.core.database import database
from app.core.security import hash_password

async def setup_database():
    print("Connecting to database to setup test security users...")
    await database.connect()
    
    # Test emails
    emails = [
        "t_pat_uncomp@cardioguard.ai",
        "t_pat_comp@cardioguard.ai",
        "t_doc_uncomp@cardioguard.ai",
        "t_doc_comp_unver@cardioguard.ai",
        "t_doc_verified@cardioguard.ai",
        "t_admin_sec@cardioguard.ai"
    ]
    
    # Clean up test users
    placeholders = ", ".join(f":e{i}" for i in range(len(emails)))
    cleanup_dict = {f"e{i}": email for i, email in enumerate(emails)}
    
    # Delete from profiles first due to foreign keys
    user_ids = await database.fetch_all(
        f"SELECT id::text as id FROM users WHERE email IN ({placeholders})",
        cleanup_dict
    )
    for row in user_ids:
        uid = row["id"]
        await database.execute("DELETE FROM doctor_profiles WHERE user_id = :uid", {"uid": uid})
        await database.execute("DELETE FROM patient_profiles WHERE user_id = :uid", {"uid": uid})
        await database.execute("DELETE FROM patients WHERE user_id = :uid OR id = :uid", {"uid": uid})
        
    await database.execute(f"DELETE FROM users WHERE email IN ({placeholders})", cleanup_dict)
    
    pw_hash = hash_password("TestPassword123")
    
    # Insert Test Patient Uncompleted
    await database.execute(
        """
        INSERT INTO users (full_name, email, password_hash, role, status, profile_completed, is_verified)
        VALUES ('Test Patient Uncompleted', 't_pat_uncomp@cardioguard.ai', :pw_hash, 'patient', 'pending_profile', FALSE, FALSE)
        """,
        {"pw_hash": pw_hash}
    )
    
    # Insert Test Patient Completed
    await database.execute(
        """
        INSERT INTO users (full_name, email, password_hash, role, status, profile_completed, is_verified)
        VALUES ('Test Patient Completed', 't_pat_comp@cardioguard.ai', :pw_hash, 'patient', 'active', TRUE, FALSE)
        """,
        {"pw_hash": pw_hash}
    )
    # Also insert a patient_profile and patients record for sync
    pat_comp_id = await database.fetch_val("SELECT id::text FROM users WHERE email = 't_pat_comp@cardioguard.ai'")
    await database.execute(
        """
        INSERT INTO patient_profiles (user_id, full_name, phone, gender, date_of_birth, address, profile_completed)
        VALUES (:uid, 'Test Patient Completed', '0123456789', 'male', '1990-01-01', 'Hanoi', TRUE)
        """,
        {"uid": pat_comp_id}
    )
    await database.execute(
        """
        INSERT INTO patients (id, user_id, full_name, age, gender, phone, address)
        VALUES (:uid, :uid, 'Test Patient Completed', 36, 'male', '0123456789', 'Hanoi')
        """,
        {"uid": pat_comp_id}
    )

    # Insert Test Doctor Uncompleted
    await database.execute(
        """
        INSERT INTO users (full_name, email, password_hash, role, status, profile_completed, is_verified)
        VALUES ('Test Doctor Uncompleted', 't_doc_uncomp@cardioguard.ai', :pw_hash, 'doctor', 'pending_profile', FALSE, FALSE)
        """,
        {"pw_hash": pw_hash}
    )

    # Insert Test Doctor Completed Unverified
    await database.execute(
        """
        INSERT INTO users (full_name, email, password_hash, role, status, profile_completed, is_verified)
        VALUES ('Test Doctor Completed Unverified', 't_doc_comp_unver@cardioguard.ai', :pw_hash, 'doctor', 'pending_verification', TRUE, FALSE)
        """,
        {"pw_hash": pw_hash}
    )
    doc_unver_id = await database.fetch_val("SELECT id::text FROM users WHERE email = 't_doc_comp_unver@cardioguard.ai'")
    await database.execute(
        """
        INSERT INTO doctor_profiles (user_id, full_name, phone, address, specialty, license_number, license_certificate_url, cccd_front_url, cccd_back_url, is_verified, status)
        VALUES (:uid, 'Test Doctor Completed Unverified', '0987654321', 'HCM', 'Cardiology', 'LIC-11111', '/files/download/doctor-documents/dummy-license.png', '/files/download/identity-documents/dummy-front.png', '/files/download/identity-documents/dummy-back.png', FALSE, 'pending_verification')
        """,
        {"uid": doc_unver_id}
    )

    # Insert Test Doctor Verified
    await database.execute(
        """
        INSERT INTO users (full_name, email, password_hash, role, status, profile_completed, is_verified)
        VALUES ('Test Doctor Verified', 't_doc_verified@cardioguard.ai', :pw_hash, 'doctor', 'active', TRUE, TRUE)
        """,
        {"pw_hash": pw_hash}
    )
    doc_ver_id = await database.fetch_val("SELECT id::text FROM users WHERE email = 't_doc_verified@cardioguard.ai'")
    await database.execute(
        """
        INSERT INTO doctor_profiles (user_id, full_name, phone, address, specialty, license_number, license_certificate_url, cccd_front_url, cccd_back_url, is_verified, status)
        VALUES (:uid, 'Test Doctor Verified', '0987654322', 'HCM', 'Cardiology', 'LIC-22222', '/files/download/doctor-documents/verified-license.png', '/files/download/identity-documents/verified-front.png', '/files/download/identity-documents/verified-back.png', TRUE, 'active')
        """,
        {"uid": doc_ver_id}
    )

    # Insert Test Admin
    await database.execute(
        """
        INSERT INTO users (full_name, email, password_hash, role, status, profile_completed, is_verified)
        VALUES ('Test Admin Security', 't_admin_sec@cardioguard.ai', :pw_hash, 'admin', 'active', TRUE, TRUE)
        """,
        {"pw_hash": pw_hash}
    )
    
    print("Database seeding completed. Disconnecting DB...")
    await database.disconnect()

async def cleanup_database():
    print("Connecting to database for final test data cleanup...")
    await database.connect()
    emails = [
        "t_pat_uncomp@cardioguard.ai",
        "t_pat_comp@cardioguard.ai",
        "t_doc_uncomp@cardioguard.ai",
        "t_doc_comp_unver@cardioguard.ai",
        "t_doc_verified@cardioguard.ai",
        "t_admin_sec@cardioguard.ai"
    ]
    placeholders = ", ".join(f":e{i}" for i in range(len(emails)))
    cleanup_dict = {f"e{i}": email for i, email in enumerate(emails)}
    
    user_ids = await database.fetch_all(
        f"SELECT id::text as id FROM users WHERE email IN ({placeholders})",
        cleanup_dict
    )
    for row in user_ids:
        uid = row["id"]
        await database.execute("DELETE FROM doctor_profiles WHERE user_id = :uid", {"uid": uid})
        await database.execute("DELETE FROM patient_profiles WHERE user_id = :uid", {"uid": uid})
        await database.execute("DELETE FROM patients WHERE user_id = :uid OR id = :uid", {"uid": uid})
        
    await database.execute(f"DELETE FROM users WHERE email IN ({placeholders})", cleanup_dict)
    await database.disconnect()
    print("Cleanup database completed.")

def get_tokens(base_url):
    users = {
        "pat_uncomp": ("t_pat_uncomp@cardioguard.ai", "patient"),
        "pat_comp": ("t_pat_comp@cardioguard.ai", "patient"),
        "doc_uncomp": ("t_doc_uncomp@cardioguard.ai", "doctor"),
        "doc_comp_unver": ("t_doc_comp_unver@cardioguard.ai", "doctor"),
        "doc_ver": ("t_doc_verified@cardioguard.ai", "doctor"),
        "admin": ("t_admin_sec@cardioguard.ai", "admin")
    }
    
    tokens = {}
    user_ids = {}
    for key, (email, role) in users.items():
        res = requests.post(f"{base_url}/auth/login", json={
            "email": email,
            "password": "TestPassword123",
            "expected_role": role
        })
        assert res.status_code == 200, f"Login failed for {email}: {res.text}"
        data = res.json()
        tokens[key] = data["access_token"]
        user_ids[key] = data["user"]["id"]
    return tokens, user_ids

def run_tests_on_server():
    base_url = "http://127.0.0.1:8005/api"
    print("Obtaining user tokens...")
    tokens, user_ids = get_tokens(base_url)
    
    # ----------------------------------------------------
    # TEST 1: Uncompleted patient can access patient-scoped clinical API (GET /alerts)
    # ----------------------------------------------------
    headers = {"Authorization": f"Bearer {tokens['pat_uncomp']}"}
    res = requests.get(f"{base_url}/alerts", headers=headers)
    assert res.status_code == 200, f"Expected 200 for uncompleted patient, got {res.status_code}: {res.text}"
    assert res.json()["items"] == [], f"Unexpected alerts data for uncompleted patient: {res.text}"
    print("✓ Test 1 Passed: Uncompleted patient can access patient-scoped clinical API.")
    
    # ----------------------------------------------------
    # TEST 2: Completed patient allows clinical API (GET /alerts)
    # ----------------------------------------------------
    headers = {"Authorization": f"Bearer {tokens['pat_comp']}"}
    res = requests.get(f"{base_url}/alerts", headers=headers)
    assert res.status_code == 200, f"Expected 200 for completed patient, got {res.status_code}: {res.text}"
    print("✓ Test 2 Passed: Completed patient allowed to access clinical API.")

    # ----------------------------------------------------
    # TEST 3: Unverified doctor blocks clinical API (GET /patients)
    # ----------------------------------------------------
    headers = {"Authorization": f"Bearer {tokens['doc_comp_unver']}"}
    res = requests.get(f"{base_url}/patients", headers=headers)
    assert res.status_code == 403, f"Expected 403 for unverified doctor, got {res.status_code}: {res.text}"
    assert "chưa được ban quản trị phê duyệt" in res.json()["detail"].lower(), f"Unexpected error message: {res.text}"
    print("✓ Test 3 Passed: Unverified doctor blocked from clinical API with 403.")

    # ----------------------------------------------------
    # TEST 4: Verified doctor allows clinical API (GET /patients)
    # ----------------------------------------------------
    headers = {"Authorization": f"Bearer {tokens['doc_ver']}"}
    res = requests.get(f"{base_url}/patients", headers=headers)
    assert res.status_code == 200, f"Expected 200 for verified doctor, got {res.status_code}: {res.text}"
    print("✓ Test 4 Passed: Verified doctor allowed to access clinical API.")

    # ----------------------------------------------------
    # TEST 5: File upload validation (block non-images)
    # ----------------------------------------------------
    headers = {"Authorization": f"Bearer {tokens['doc_uncomp']}"}
    files = {"file": ("test.txt", b"Hello World", "text/plain")}
    data = {"file_type": "cccd_front"}
    res = requests.post(f"{base_url}/files/upload", headers=headers, files=files, data=data)
    assert res.status_code == 400, f"Expected 400 for text upload, got {res.status_code}: {res.text}"
    assert "chỉ chấp nhận các định dạng ảnh" in res.json()["detail"].lower(), f"Unexpected upload validation message: {res.text}"
    print("✓ Test 5 Passed: Uploading non-image file blocked with 400.")

    # ----------------------------------------------------
    # TEST 6: File Download Permissions
    # ----------------------------------------------------
    doc_unver_uid = user_ids["doc_comp_unver"]
    target_rel_dir = f"identity-documents/{doc_unver_uid}/cccd-front"
    target_dir = os.path.join(STORAGE_ROOT, target_rel_dir)
    os.makedirs(target_dir, exist_ok=True)
    
    dummy_file_path = os.path.join(target_dir, "test_doc.jpg")
    with open(dummy_file_path, "wb") as f:
        f.write(b"fake image data")
        
    download_url = f"{base_url}/files/download/{target_rel_dir}/test_doc.jpg"
    
    # Case A: Owner doctor downloading (Allowed)
    headers = {"Authorization": f"Bearer {tokens['doc_comp_unver']}"}
    res = requests.get(download_url, headers=headers)
    assert res.status_code == 200, f"Owner doctor should be able to download: {res.status_code} - {res.text}"
    
    # Case B: Admin downloading (Allowed)
    headers = {"Authorization": f"Bearer {tokens['admin']}"}
    res = requests.get(download_url, headers=headers)
    assert res.status_code == 200, f"Admin should be able to download: {res.status_code} - {res.text}"
    
    # Case C: Other patient downloading (Blocked 403)
    headers = {"Authorization": f"Bearer {tokens['pat_comp']}"}
    res = requests.get(download_url, headers=headers)
    assert res.status_code == 403, f"Other users should be blocked: {res.status_code} - {res.text}"
    print("✓ Test 6 Passed: File download checks passed (Owner allowed, Admin allowed, Others blocked).")

    # ----------------------------------------------------
    # TEST 7: Admin verification action (Verify / Reject)
    # ----------------------------------------------------
    doc_unver_uid = user_ids["doc_comp_unver"]
    headers = {"Authorization": f"Bearer {tokens['admin']}"}
    
    # Action verify
    verify_url = f"{base_url}/admin/doctors/{doc_unver_uid}/verify"
    res = requests.patch(verify_url, headers=headers, json={"verification_note": "Tài liệu rất rõ ràng, đồng ý phê duyệt."})
    assert res.status_code == 200, f"Admin verification failed: {res.status_code} - {res.text}"
    
    # Check status again
    status_url = f"{base_url}/doctor/verification-status"
    headers_doc = {"Authorization": f"Bearer {tokens['doc_comp_unver']}"}
    res = requests.get(status_url, headers=headers_doc)
    assert res.status_code == 200, f"Get status failed: {res.text}"
    status_data = res.json()
    assert status_data["is_verified"] is True, f"Doctor should be verified: {status_data}"
    assert status_data["status"] == "active", f"Doctor status should be active: {status_data}"
    print("✓ Test 7 Passed: Admin doctor verification workflow completed successfully.")

async def main():
    await setup_database()
    
    # Launch uvicorn subprocess
    cmd = [
        sys.executable,
        "-m", "uvicorn",
        "app.main:app",
        "--host", "127.0.0.1",
        "--port", "8005"
    ]
    print(f"Launching uvicorn server: {' '.join(cmd)}")
    proc = subprocess.Popen(cmd, cwd=str(BACKEND_DIR))
    
    # Wait for server
    started = False
    for i in range(60):
        if proc.poll() is not None:
            print(f"Uvicorn exited early with code {proc.poll()}")
            break
        try:
            res = requests.get("http://127.0.0.1:8005/health", timeout=2)
            if res.status_code == 200:
                started = True
                break
        except requests.exceptions.RequestException:
            time.sleep(1)
            
    if not started:
        proc.terminate()
        await cleanup_database()
        raise RuntimeError("Uvicorn failed to start.")
        
    try:
        run_tests_on_server()
        print("\n★ ALL SECURITY & PROFILE TESTS PASSED SUCCESSFULLY! ★\n")
    finally:
        print("Stopping uvicorn server...")
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
        
        # Cleanup files created during tests
        test_doc_dir = os.path.join(STORAGE_ROOT, "identity-documents")
        for folder in os.listdir(test_doc_dir):
            if folder not in ("dummy-front.png", "dummy-back.png", "verified-front.png", "verified-back.png"):
                full_f = os.path.join(test_doc_dir, folder)
                if os.path.isdir(full_f):
                    shutil.rmtree(full_f)
                    
        await cleanup_database()

if __name__ == "__main__":
    asyncio.run(main())
