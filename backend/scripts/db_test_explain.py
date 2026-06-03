import asyncio
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from app.core.database import database, connect_db, disconnect_db

async def run():
    await connect_db()
    dummy = "00000000-0000-0000-0000-000000000000"
    explain_q = [
        ("sensor_data(patient_id)",    "EXPLAIN SELECT * FROM sensor_data WHERE patient_id = '" + dummy + "' ORDER BY created_at DESC LIMIT 25"),
        ("alerts(critical)",           "EXPLAIN SELECT * FROM alerts WHERE is_resolved = FALSE AND severity = 'critical'"),
        ("doctor_patient(doctor_id)",  "EXPLAIN SELECT * FROM doctor_patient WHERE doctor_id = '" + dummy + "'"),
        ("users(email)",               "EXPLAIN SELECT * FROM users WHERE email = 'x'"),
        ("users(role,status)",         "EXPLAIN SELECT * FROM users WHERE role = 'patient' AND status = 'active'"),
    ]
    print("--- 6. INDEX VERIFICATION ---")
    for name, q in explain_q:
        result = await database.fetch_all(q)
        plan = " ".join(str(row[0]) for row in result)
        has_idx = "idx" in plan.lower() or "index" in plan.lower() or "bitmap" in plan.lower()
        has_seq = "seq scan" in plan.lower()
        status = "INDEX" if has_idx else ("SEQ SCAN" if has_seq else "OK")
        print("  {:30s} -> {}".format(name, status))
    await disconnect_db()

asyncio.run(run())
