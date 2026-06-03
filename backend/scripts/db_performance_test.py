"""
Bài test tốc độ Database - CardioGuard AI
==========================================
Chạy: python -m scripts.db_performance_test
Hoặc: python scripts/db_performance_test.py

Kết quả bao gồm:
- Connection pool latency
- SELECT query execution time
- COUNT query (pagination) overhead
- Batch INSERT vs single INSERT
- Concurrent query throughput
- Index usage verification
"""

import asyncio
import statistics
import time
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import database, connect_db, disconnect_db


async def measure_query(query: str, values: dict = None, iterations: int = 100) -> dict:
    """Đo thời gian thực thi query trung bình."""
    times = []
    for _ in range(iterations):
        start = time.perf_counter()
        await database.fetch_all(query, values or {})
        elapsed = time.perf_counter() - start
        times.append(elapsed)
    return {
        "query": query[:80] + "..." if len(query) > 80 else query,
        "iterations": iterations,
        "avg_ms": statistics.mean(times) * 1000,
        "median_ms": statistics.median(times) * 1000,
        "p95_ms": sorted(times)[int(len(times) * 0.95)] * 1000,
        "p99_ms": sorted(times)[int(len(times) * 0.99)] * 1000,
        "min_ms": min(times) * 1000,
        "max_ms": max(times) * 1000,
    }


async def test_connection_pool():
    """Test 1: Connection pool latency."""
    print("\n" + "=" * 70)
    print("TEST 1: CONNECTION POOL LATENCY")
    print("=" * 70)

    result = await measure_query("SELECT 1", iterations=200)
    print(f"  SELECT 1 (heartbeat):")
    print(f"    Average:  {result['avg_ms']:.2f} ms")
    print(f"    Median:   {result['median_ms']:.2f} ms")
    print(f"    P95:      {result['p95_ms']:.2f} ms")
    print(f"    P99:      {result['p99_ms']:.2f} ms")
    return result


async def test_select_queries():
    """Test 2: SELECT query performance trên các bảng chính."""
    print("\n" + "=" * 70)
    print("TEST 2: SELECT QUERY PERFORMANCE")
    print("=" * 70)

    queries = [
        ("SELECT * FROM users WHERE email = :email LIMIT 1",
         {"email": "test@example.com"}),
        ("SELECT * FROM users WHERE role = :role LIMIT 50",
         {"role": "patient"}),
        ("SELECT * FROM sensor_data ORDER BY created_at DESC LIMIT 50",
         {}),
        ("SELECT * FROM sensor_data WHERE patient_id = :pid ORDER BY created_at DESC LIMIT 25",
         {"pid": "00000000-0000-0000-0000-000000000000"}),
        ("SELECT * FROM alerts ORDER BY created_at DESC LIMIT 100",
         {}),
        ("SELECT * FROM alerts WHERE is_resolved = FALSE AND severity = 'critical'",
         {}),
        ("SELECT * FROM doctor_patient WHERE doctor_id = :did",
         {"did": "00000000-0000-0000-0000-000000000000"}),
        ("SELECT * FROM appointments ORDER BY created_at DESC LIMIT 50",
         {}),
        ("SELECT * FROM chat_messages WHERE session_id = :sid ORDER BY created_at DESC LIMIT 50",
         {"sid": "00000000-0000-0000-0000-000000000000"}),
    ]

    results = []
    for query, values in queries:
        try:
            result = await measure_query(query, values, iterations=50)
            results.append(result)
            print(f"\n  Query: {result['query']}")
            print(f"    Avg: {result['avg_ms']:.2f} ms | Median: {result['median_ms']:.2f} ms | P95: {result['p95_ms']:.2f} ms")
        except Exception as e:
            print(f"\n  Query: {query[:60]}...")
            print(f"    ERROR: {e}")

    return results


async def test_count_queries():
    """Test 3: COUNT query overhead cho pagination."""
    print("\n" + "=" * 70)
    print("TEST 3: COUNT QUERY (PAGINATION OVERHEAD)")
    print("=" * 70)

    count_queries = [
        ("SELECT COUNT(*)::int AS total FROM users WHERE status IS NOT NULL AND status != 'deleted'",
         {}),
        ("SELECT COUNT(*)::int AS total FROM sensor_data",
         {}),
        ("SELECT COUNT(*)::int AS total FROM alerts WHERE is_resolved = FALSE",
         {}),
        ("SELECT COUNT(*)::int AS total FROM appointments",
         {}),
    ]

    results = []
    for query, values in count_queries:
        try:
            result = await measure_query(query, values, iterations=50)
            results.append(result)
            print(f"\n  {result['query']}")
            print(f"    Avg: {result['avg_ms']:.2f} ms | Median: {result['median_ms']:.2f} ms | P95: {result['p95_ms']:.2f} ms")
        except Exception as e:
            print(f"\n  COUNT query ERROR: {e}")

    return results


async def test_batch_insert():
    """Test 4: Batch INSERT vs single INSERT."""
    print("\n" + "=" * 70)
    print("TEST 4: BATCH INSERT vs SINGLE INSERT")
    print("=" * 70)

    # Test single inserts
    single_times = []
    for _ in range(20):
        start = time.perf_counter()
        await database.execute(
            """INSERT INTO audit_logs (id, user_id, action, entity_type, ip_address, created_at)
               VALUES (gen_random_uuid(), NULL, 'PERF_TEST', 'benchmark', '127.0.0.1', NOW())"""
        )
        elapsed = time.perf_counter() - start
        single_times.append(elapsed)

    avg_single = statistics.mean(single_times) * 1000
    print(f"  Single INSERT (20 iterations):")
    print(f"    Average: {avg_single:.2f} ms per INSERT")

    # Test batch insert
    batch_sizes = [5, 10, 25]
    batch_results = []

    for batch_size in batch_sizes:
        batch_times = []
        for _ in range(5):
            rows = []
            for j in range(batch_size):
                rows.append(
                    f"(gen_random_uuid(), NULL, 'PERF_TEST_BATCH', 'benchmark', '127.0.0.1', NOW())"
                )
            values_sql = ", ".join(rows)

            start = time.perf_counter()
            await database.execute(
                f"""INSERT INTO audit_logs (id, user_id, action, entity_type, ip_address, created_at)
                    VALUES {values_sql}"""
            )
            elapsed = time.perf_counter() - start
            batch_times.append(elapsed)

        avg_batch = statistics.mean(batch_times) * 1000
        per_row = avg_batch / batch_size
        speedup = avg_single / per_row if per_row > 0 else 0
        batch_results.append({
            "batch_size": batch_size,
            "avg_ms": avg_batch,
            "per_row_ms": per_row,
            "speedup": speedup,
        })
        print(f"\n  Batch INSERT ({batch_size} rows):")
        print(f"    Total:    {avg_batch:.2f} ms")
        print(f"    Per row:  {per_row:.2f} ms")
        print(f"    Speedup:  {speedup:.1f}x vs single")

    # Cleanup
    await database.execute("DELETE FROM audit_logs WHERE action IN ('PERF_TEST', 'PERF_TEST_BATCH')")

    return {"single_avg_ms": avg_single, "batch_results": batch_results}


async def test_concurrent_queries():
    """Test 5: Concurrent query throughput."""
    print("\n" + "=" * 70)
    print("TEST 5: CONCURRENT QUERY THROUGHPUT")
    print("=" * 70)

    async def single_query():
        start = time.perf_counter()
        await database.fetch_all("SELECT * FROM users LIMIT 10")
        return time.perf_counter() - start

    concurrency_levels = [1, 5, 10, 20]
    results = []

    for concurrency in concurrency_levels:
        times = []
        for _ in range(3):  # 3 rounds
            start = time.perf_counter()
            tasks = [single_query() for _ in range(concurrency)]
            await asyncio.gather(*tasks)
            total_elapsed = time.perf_counter() - start
            times.append(total_elapsed)

        avg_time = statistics.mean(times) * 1000
        qps = concurrency / (avg_time / 1000) if avg_time > 0 else 0
        results.append({
            "concurrency": concurrency,
            "avg_ms": avg_time,
            "qps": qps,
        })
        print(f"\n  Concurrency: {concurrency:>3} queries")
        print(f"    Total time: {avg_time:.2f} ms | Throughput: {qps:.1f} QPS")

    return results


async def test_index_usage():
    """Test 6: Verify index usage cho các query quan trọng."""
    print("\n" + "=" * 70)
    print("TEST 6: INDEX USAGE VERIFICATION")
    print("=" * 70)

    explain_queries = [
        "EXPLAIN ANALYZE SELECT * FROM sensor_data WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 25",
        "EXPLAIN ANALYZE SELECT * FROM alerts WHERE is_resolved = FALSE AND severity = 'critical'",
        "EXPLAIN ANALYZE SELECT * FROM doctor_patient WHERE doctor_id = $1",
        "EXPLAIN ANALYZE SELECT * FROM users WHERE email = $1",
        "EXPLAIN ANALYZE SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100",
    ]

    for query in explain_queries:
        try:
            result = await database.fetch_all(query, ["00000000-0000-0000-0000-000000000000"])
            # Extract key info from EXPLAIN output
            plan_lines = [str(row.get("QUERY PLAN", "")) for row in result]
            plan_text = "\n".join(plan_lines)

            uses_index = any(
                keyword in plan_text.lower()
                for keyword in ["index", "idx_", "bitmap"]
            )
            has_seq_scan = "seq scan" in plan_text.lower()

            print(f"\n  Query: {query[:70]}...")
            if uses_index:
                print(f"    Status: INDEX USED")
            elif has_seq_scan:
                print(f"    Status: SEQ SCAN (consider adding index)")
            else:
                print(f"    Status: OK")

            # Show first few lines of plan
            for line in plan_lines[:3]:
                if line.strip():
                    print(f"    {line.strip()}")
        except Exception as e:
            print(f"\n  Query: {query[:60]}...")
            print(f"    ERROR: {e}")


async def test_pagination_overhead():
    """Test 7: So sánh thời gian có/không có COUNT query."""
    print("\n" + "=" * 70)
    print("TEST 7: PAGINATION OVERHEAD (COUNT vs NO COUNT)")
    print("=" * 70)

    # Without COUNT (old behavior)
    times_no_count = []
    for _ in range(30):
        start = time.perf_counter()
        await database.fetch_all(
            "SELECT * FROM sensor_data ORDER BY created_at DESC LIMIT 50 OFFSET 0"
        )
        elapsed = time.perf_counter() - start
        times_no_count.append(elapsed)

    # With COUNT (new behavior)
    times_with_count = []
    for _ in range(30):
        start = time.perf_counter()
        await asyncio.gather(
            database.fetch_val("SELECT COUNT(*)::int AS total FROM sensor_data"),
            database.fetch_all("SELECT * FROM sensor_data ORDER BY created_at DESC LIMIT 50 OFFSET 0"),
        )
        elapsed = time.perf_counter() - start
        times_with_count.append(elapsed)

    avg_no_count = statistics.mean(times_no_count) * 1000
    avg_with_count = statistics.mean(times_with_count) * 1000
    overhead = avg_with_count - avg_no_count
    overhead_pct = (overhead / avg_no_count * 100) if avg_no_count > 0 else 0

    print(f"\n  WITHOUT COUNT (old):  {avg_no_count:.2f} ms avg")
    print(f"  WITH COUNT (new):    {avg_with_count:.2f} ms avg")
    print(f"  Overhead:            {overhead:.2f} ms ({overhead_pct:.1f}%)")
    print(f"\n  Verdict: COUNT query song song thêm ~{overhead_pct:.0f}% thời gian")


async def main():
    print("\n" + "#" * 70)
    print("#  DATABASE PERFORMANCE TEST - CardioGuard AI")
    print("#  " + time.strftime("%Y-%m-%d %H:%M:%S"))
    print("#" * 70)

    try:
        await connect_db()
        print("\n[OK] Database connected")

        # Run all tests
        await test_connection_pool()
        await test_select_queries()
        await test_count_queries()
        await test_batch_insert()
        await test_concurrent_queries()
        await test_index_usage()
        await test_pagination_overhead()

        print("\n" + "=" * 70)
        print("ALL TESTS COMPLETED SUCCESSFULLY")
        print("=" * 70)

    except Exception as e:
        print(f"\n[FATAL ERROR] {e}")
        import traceback
        traceback.print_exc()
    finally:
        await disconnect_db()
        print("\n[OK] Database disconnected")


if __name__ == "__main__":
    asyncio.run(main())
