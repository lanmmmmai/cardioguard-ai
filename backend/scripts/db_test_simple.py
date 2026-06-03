import asyncio
import time
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

async def run():
    from app.core.database import database, connect_db, disconnect_db

    await connect_db()
    print("=" * 60)
    print("  DATABASE PERFORMANCE TEST - CardioGuard AI")
    print("=" * 60)
    print()

    # Warmup connection
    for _ in range(3):
        await database.fetch_one("SELECT 1")

    # TEST 1: Connection latency (warm)
    print("--- 1. CONNECTION LATENCY (SELECT 1 x10) ---")
    times = []
    for _ in range(10):
        t = time.perf_counter()
        await database.fetch_one("SELECT 1")
        times.append((time.perf_counter() - t) * 1000)
    times.sort()
    print(f"  Avg: {sum(times)/len(times):.1f} ms | P50: {times[5]:.1f} ms | P95: {times[9]:.1f} ms")

    # TEST 2: Simple queries (10 each)
    print("\n--- 2. SELECT QUERY PERFORMANCE (x10 each) ---")
    queries = [
        ("users BY email",       "SELECT id, email, role FROM users LIMIT 1"),
        ("users BY role",        "SELECT id, full_name, role FROM users WHERE role = 'patient' LIMIT 10"),
        ("COUNT users",          "SELECT COUNT(*)::int AS total FROM users"),
        ("sensor_data",          "SELECT id, heart_rate, spo2 FROM sensor_data ORDER BY created_at DESC LIMIT 25"),
        ("alerts",               "SELECT id, alert_type, severity FROM alerts ORDER BY created_at DESC LIMIT 50"),
        ("doctor_patient",       "SELECT doctor_id, patient_id FROM doctor_patient LIMIT 10"),
    ]
    for name, q in queries:
        times = []
        for _ in range(10):
            t = time.perf_counter()
            await database.fetch_all(q)
            times.append((time.perf_counter() - t) * 1000)
        times.sort()
        print(f"  {name:25s} | Avg: {sum(times)/len(times):7.1f} ms | P95: {times[9]:7.1f} ms")

    # TEST 3: Pagination overhead
    print("\n--- 3. PAGINATION OVERHEAD (x5) ---")
    times_no = []
    for _ in range(5):
        t = time.perf_counter()
        await database.fetch_all("SELECT * FROM sensor_data ORDER BY created_at DESC LIMIT 50 OFFSET 0")
        times_no.append((time.perf_counter() - t) * 1000)

    times_yes = []
    for _ in range(5):
        t = time.perf_counter()
        await asyncio.gather(
            database.fetch_val("SELECT COUNT(*)::int AS total FROM sensor_data"),
            database.fetch_all("SELECT * FROM sensor_data ORDER BY created_at DESC LIMIT 50 OFFSET 0"),
        )
        times_yes.append((time.perf_counter() - t) * 1000)

    avg_no = sum(times_no) / len(times_no)
    avg_yes = sum(times_yes) / len(times_yes)
    print(f"  Without COUNT: {avg_no:.1f} ms")
    print(f"  With COUNT:    {avg_yes:.1f} ms")
    print(f"  Overhead:      {avg_yes - avg_no:.1f} ms ({(avg_yes - avg_no) / avg_no * 100:.0f}%)")

    # TEST 4: Concurrent
    print("\n--- 4. CONCURRENT QUERIES ---")
    async def sq():
        await database.fetch_all("SELECT id FROM users LIMIT 5")

    for c in [1, 5, 10]:
        t = time.perf_counter()
        await asyncio.gather(*[sq() for _ in range(c)])
        elapsed = (time.perf_counter() - t) * 1000
        qps = c / (elapsed / 1000) if elapsed > 0 else 0
        print(f"  {c:>2} concurrent: {elapsed:>6.1f} ms | {qps:>5.0f} QPS")

    # TEST 5: Batch INSERT
    print("\n--- 5. BATCH INSERT ---")
    times = []
    for _ in range(5):
        t = time.perf_counter()
        await database.execute("INSERT INTO audit_logs (id, action, entity_type, ip_address, created_at) VALUES (gen_random_uuid(), 'PERF_TEST', 'test', '127.0.0.1', NOW())")
        times.append((time.perf_counter() - t) * 1000)
    single = sum(times) / len(times)
    print(f"  Single: {single:.1f} ms")

    for bs in [5, 10, 25]:
        times = []
        for _ in range(3):
            vals = ", ".join(["(gen_random_uuid(), 'PERF_TEST', 'test', '127.0.0.1', NOW())" for _ in range(bs)])
            t = time.perf_counter()
            await database.execute(f"INSERT INTO audit_logs (id, action, entity_type, ip_address, created_at) VALUES {vals}")
            times.append((time.perf_counter() - t) * 1000)
        avg = sum(times) / len(times)
        print(f"  Batch {bs:>2}: {avg:.1f} ms ({avg/bs:.1f} ms/row, {single/(avg/bs):.0f}x faster)")
    await database.execute("DELETE FROM audit_logs WHERE action = 'PERF_TEST'")

    # TEST 6: Index verification
    print("\n--- 6. INDEX VERIFICATION ---")
    dummy = "00000000-0000-0000-0000-000000000000"
    explain_q = [
        ("sensor_data(patient_id)",    f"EXPLAIN SELECT * FROM sensor_data WHERE patient_id = '{dummy}' ORDER BY created_at DESC LIMIT 25"),
        ("alerts(critical)",           "EXPLAIN SELECT * FROM alerts WHERE is_resolved = FALSE AND severity = 'critical'"),
        ("doctor_patient(doctor_id)",  f"EXPLAIN SELECT * FROM doctor_patient WHERE doctor_id = '{dummy}'"),
        ("users(email)",               "EXPLAIN SELECT * FROM users WHERE email = 'x'"),
        ("users(role,status)",         "EXPLAIN SELECT * FROM users WHERE role = 'patient' AND status = 'active'"),
    ]
    for name, q in explain_q:
        result = await database.fetch_all(q)
        plan = " ".join(str(row[0]) for row in result)
        has_idx = "idx" in plan.lower() or "index" in plan.lower() or "bitmap" in plan.lower()
        has_seq = "seq scan" in plan.lower()
        status = "INDEX" if has_idx else ("SEQ SCAN" if has_seq else "OK")
        print(f"  {name:30s} -> {status}")

    print("\n" + "=" * 60)
    print("  ALL TESTS COMPLETED")
    print("=" * 60)

    await disconnect_db()

asyncio.run(run())
