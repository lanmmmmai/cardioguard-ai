"""
Database Performance Test - Quick Version
Chạy: python scripts/db_perf_quick.py
"""
import asyncio
import time
import statistics
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import database, connect_db, disconnect_db

async def run():
    print("\n" + "="*60)
    print("  DATABASE PERFORMANCE TEST - QUICK")
    print("="*60)

    await connect_db()
    print("[OK] Database connected\n")

    # TEST 1: Connection latency
    print("--- TEST 1: Connection Latency (SELECT 1) ---")
    times = []
    for _ in range(50):
        start = time.perf_counter()
        await database.fetch_one("SELECT 1")
        times.append((time.perf_counter() - start) * 1000)
    print(f"  Avg: {statistics.mean(times):.2f} ms")
    print(f"  P95: {sorted(times)[47]:.2f} ms")
    print(f"  P99: {sorted(times)[49]:.2f} ms")

    # TEST 2: Simple SELECT
    print("\n--- TEST 2: Simple SELECT (50 iterations) ---")
    queries = [
        ("users BY email", "SELECT id, email, role FROM users LIMIT 1"),
        ("users BY role", "SELECT id, full_name, role FROM users WHERE role = 'patient' LIMIT 10"),
        ("sensor_data", "SELECT id, heart_rate, spo2 FROM sensor_data ORDER BY created_at DESC LIMIT 25"),
        ("alerts", "SELECT id, alert_type, severity FROM alerts ORDER BY created_at DESC LIMIT 50"),
    ]
    for name, q in queries:
        times = []
        for _ in range(50):
            start = time.perf_counter()
            await database.fetch_all(q)
            times.append((time.perf_counter() - start) * 1000)
        print(f"  {name:20s} -> Avg: {statistics.mean(times):.2f} ms | P95: {sorted(times)[47]:.2f} ms")

    # TEST 3: COUNT query (pagination overhead)
    print("\n--- TEST 3: COUNT Query Overhead ---")
    count_q = "SELECT COUNT(*)::int AS total FROM users WHERE status IS NOT NULL AND status != 'deleted'"
    times_count = []
    for _ in range(30):
        start = time.perf_counter()
        await database.fetch_val(count_q)
        times_count.append((time.perf_counter() - start) * 1000)
    print(f"  COUNT users: Avg {statistics.mean(times_count):.2f} ms | P95 {sorted(times_count)[28]:.2f} ms")

    # TEST 4: Concurrent queries
    print("\n--- TEST 4: Concurrent Queries ---")
    async def q():
        await database.fetch_all("SELECT id FROM users LIMIT 5")

    for conc in [1, 5, 10, 20]:
        start = time.perf_counter()
        await asyncio.gather(*[q() for _ in range(conc)])
        elapsed = (time.perf_counter() - start) * 1000
        qps = conc / (elapsed / 1000) if elapsed > 0 else 0
        print(f"  {conc:>3} concurrent: {elapsed:.1f} ms total | {qps:.0f} QPS")

    # TEST 5: Batch INSERT
    print("\n--- TEST 5: Batch INSERT vs Single INSERT ---")
    # Single
    times = []
    for _ in range(10):
        start = time.perf_counter()
        await database.execute("INSERT INTO audit_logs (id, action, entity_type, ip_address, created_at) VALUES (gen_random_uuid(), 'PERF_TEST', 'test', '127.0.0.1', NOW())")
        times.append((time.perf_counter() - start) * 1000)
    single_avg = statistics.mean(times)
    print(f"  Single INSERT:  {single_avg:.2f} ms")

    # Batch
    for bs in [5, 10, 25]:
        times = []
        for _ in range(5):
            rows = ", ".join(["(gen_random_uuid(), 'PERF_TEST', 'test', '127.0.0.1', NOW())" for _ in range(bs)])
            start = time.perf_counter()
            await database.execute(f"INSERT INTO audit_logs (id, action, entity_type, ip_address, created_at) VALUES {rows}")
            times.append((time.perf_counter() - start) * 1000)
        avg = statistics.mean(times)
        print(f"  Batch {bs:>2} rows:  {avg:.2f} ms ({avg/bs:.2f} ms/row, {single_avg/(avg/bs):.1f}x faster)")

    # Cleanup
    await database.execute("DELETE FROM audit_logs WHERE action = 'PERF_TEST'")

    # TEST 6: Index check
    print("\n--- TEST 6: Index Usage (EXPLAIN) ---")
    explain_q = [
        ("sensor_data.patient_id", "EXPLAIN SELECT * FROM sensor_data WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 25"),
        ("alerts.active_critical", "EXPLAIN SELECT * FROM alerts WHERE is_resolved = FALSE AND severity = 'critical'"),
        ("doctor_patient.doctor_id", "EXPLAIN SELECT * FROM doctor_patient WHERE doctor_id = $1"),
        ("users.email", "EXPLAIN SELECT * FROM users WHERE email = $1"),
    ]
    dummy_id = "00000000-0000-0000-0000-000000000000"
    for name, q in explain_q:
        result = await database.fetch_all(q, [dummy_id])
        plan = " ".join(str(r.get("QUERY PLAN","")) for r in result)
        uses_idx = "idx" in plan.lower() or "index" in plan.lower()
        has_seq = "seq scan" in plan.lower()
        status = "INDEX" if uses_idx else ("SEQ SCAN" if has_seq else "OK")
        print(f"  {name:30s} -> {status}")

    # TEST 7: Pagination overhead
    print("\n--- TEST 7: Pagination Overhead ---")
    # Without COUNT
    times_no = []
    for _ in range(20):
        start = time.perf_counter()
        await database.fetch_all("SELECT * FROM sensor_data ORDER BY created_at DESC LIMIT 50 OFFSET 0")
        times_no.append((time.perf_counter() - start) * 1000)
    # With COUNT (parallel)
    times_yes = []
    for _ in range(20):
        start = time.perf_counter()
        await asyncio.gather(
            database.fetch_val("SELECT COUNT(*)::int AS total FROM sensor_data"),
            database.fetch_all("SELECT * FROM sensor_data ORDER BY created_at DESC LIMIT 50 OFFSET 0"),
        )
        times_yes.append((time.perf_counter() - start) * 1000)
    avg_no = statistics.mean(times_no)
    avg_yes = statistics.mean(times_yes)
    print(f"  Without COUNT: {avg_no:.2f} ms")
    print(f"  With COUNT:    {avg_yes:.2f} ms")
    print(f"  Overhead:      {avg_yes-avg_no:.2f} ms ({(avg_yes-avg_no)/avg_no*100:.1f}%)")

    print("\n" + "="*60)
    print("  ALL TESTS COMPLETED")
    print("="*60)

    await disconnect_db()

asyncio.run(run())
