import asyncio
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from app.core.database import database, connect_db, disconnect_db

async def run():
    await connect_db()
    print("--- TABLE SIZES ---")
    r = await database.fetch_all("""
        SELECT relname, n_live_tup::int as rows
        FROM pg_stat_user_tables
        ORDER BY n_live_tup DESC
    """)
    for row in r:
        print("  {:30s} {:>10,} rows".format(row[0], row[1]))

    print("\n--- INDEX LIST ---")
    r = await database.fetch_all("""
        SELECT indexname, tablename
        FROM pg_indexes
        WHERE schemaname = 'public'
        ORDER BY tablename, indexname
    """)
    for row in r:
        print("  {:40s} on {}".format(row[0], row[1]))

    print("\n--- DETAILED EXPLAIN (with actual rows) ---")
    dummy = "00000000-0000-0000-0000-000000000000"
    explain_q = [
        ("sensor_data(patient_id)",    "EXPLAIN ANALYZE SELECT * FROM sensor_data WHERE patient_id = '" + dummy + "' ORDER BY created_at DESC LIMIT 25"),
        ("alerts(critical)",           "EXPLAIN ANALYZE SELECT * FROM alerts WHERE is_resolved = FALSE AND severity = 'critical'"),
        ("doctor_patient(doctor_id)",  "EXPLAIN ANALYZE SELECT * FROM doctor_patient WHERE doctor_id = '" + dummy + "'"),
        ("users(email)",               "EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'x'"),
        ("users(role)",                "EXPLAIN ANALYZE SELECT * FROM users WHERE role = 'patient' AND status = 'active'"),
    ]
    for name, q in explain_q:
        result = await database.fetch_all(q)
        plan = "\n".join(str(row[0]) for row in result)
        print("\n  {}:".format(name))
        for line in plan.split("\n"):
            print("    " + line)

    await disconnect_db()

asyncio.run(run())
