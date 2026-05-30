# =============================================================================
# CardioGuard AI - Module Dự Đoán Nguy Cơ Bệnh Tim
# File: train_model.py
# Mô tả: Đọc dữ liệu, huấn luyện mô hình RandomForest, lưu model ra file .pkl
#
# Hướng dẫn chạy trên macOS (Terminal):
#   1. Cài thư viện:
#      pip install pandas scikit-learn joblib
#
#   2. Di chuyển vào thư mục ai_model:
#      cd /path/to/cardioguard-ai/ai_model
#
#   3. Chạy file:
#      python train_model.py
# =============================================================================

import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
import joblib
import os

# -----------------------------------------------------------
# 1. Đọc dữ liệu từ file CSV
# -----------------------------------------------------------
# Lấy đường dẫn thư mục chứa file train_model.py
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(BASE_DIR, "heart_disease_clean.csv")

print("=" * 60)
print("  CardioGuard AI - Huấn luyện mô hình dự đoán bệnh tim")
print("=" * 60)
print(f"\n📂 Đọc dữ liệu từ: {CSV_PATH}")

df = pd.read_csv(CSV_PATH)
print(f"✅ Tải thành công! Số lượng mẫu: {len(df)} dòng, {len(df.columns)} cột")
print(f"\nPhân bố nhãn target:\n{df['target'].value_counts().to_string()}")
print("  (0 = Không có nguy cơ, 1 = Có nguy cơ bệnh tim)")

# -----------------------------------------------------------
# 2. Tách dữ liệu đầu vào (X) và nhãn (y)
# -----------------------------------------------------------
# Các cột đặc trưng sức khỏe dùng để dự đoán
FEATURE_COLUMNS = [
    "age",       # Tuổi
    "sex",       # Giới tính (1=Nam, 0=Nữ)
    "cp",        # Loại đau ngực (1-4)
    "trestbps",  # Huyết áp tâm thu khi nghỉ (mmHg)
    "chol",      # Cholesterol huyết thanh (mg/dl)
    "fbs",       # Đường huyết đói > 120 mg/dl (1=Đúng, 0=Sai)
    "restecg",   # Kết quả điện tâm đồ lúc nghỉ (0-2)
    "thalach",   # Nhịp tim tối đa đạt được
    "exang",     # Đau thắt ngực do gắng sức (1=Có, 0=Không)
    "oldpeak",   # ST depression so với nghỉ
    "slope",     # Độ dốc đoạn ST cao nhất
    "ca",        # Số mạch máu lớn phát hiện qua fluoroscopy (0-3)
    "thal",      # Loại thalassemia (3=Bình thường, 6=Khiếm khuyết cố định, 7=Khiếm khuyết có thể hồi phục)
]

X = df[FEATURE_COLUMNS]   # Dữ liệu đầu vào
y = df["target"]           # Nhãn mục tiêu (0 hoặc 1)

print(f"\n📊 Đặc trưng đầu vào (X): {X.shape[1]} cột")
print(f"🎯 Nhãn đầu ra (y): cột 'target'")

# -----------------------------------------------------------
# 3. Chia dữ liệu train/test theo tỷ lệ 80/20
# -----------------------------------------------------------
X_train, X_test, y_train, y_test = train_test_split(
    X, y,
    test_size=0.2,        # 20% dữ liệu dành cho kiểm thử
    random_state=42,      # Cố định seed để kết quả có thể tái tạo
    stratify=y            # Đảm bảo tỷ lệ nhãn cân bằng trong cả 2 tập
)

print(f"\n✂️  Chia dữ liệu:")
print(f"   Train: {len(X_train)} mẫu | Test: {len(X_test)} mẫu")

# -----------------------------------------------------------
# 4. Huấn luyện mô hình RandomForestClassifier
# -----------------------------------------------------------
print("\n🤖 Đang huấn luyện mô hình RandomForestClassifier...")

model = RandomForestClassifier(
    n_estimators=200,      # Số lượng cây quyết định trong rừng
    max_depth=10,          # Độ sâu tối đa của mỗi cây
    min_samples_split=5,   # Số mẫu tối thiểu để phân nhánh
    random_state=42,       # Cố định kết quả ngẫu nhiên
    n_jobs=-1              # Dùng tất cả CPU core để tăng tốc
)

model.fit(X_train, y_train)
print("✅ Huấn luyện hoàn tất!")

# -----------------------------------------------------------
# 5. Đánh giá mô hình trên tập kiểm thử
# -----------------------------------------------------------
y_pred = model.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)

print(f"\n{'=' * 60}")
print(f"  KẾT QUẢ ĐÁNH GIÁ MÔ HÌNH")
print(f"{'=' * 60}")
print(f"\n🎯 Accuracy (Độ chính xác): {accuracy * 100:.2f}%")
print(f"\n📋 Classification Report:")
print(classification_report(
    y_test, y_pred,
    target_names=["Không có nguy cơ (0)", "Có nguy cơ bệnh tim (1)"]
))

# In ra độ quan trọng của từng đặc trưng
print("🔑 Mức độ quan trọng của các đặc trưng:")
importances = pd.Series(model.feature_importances_, index=FEATURE_COLUMNS)
importances_sorted = importances.sort_values(ascending=False)
for feat, score in importances_sorted.items():
    bar = "█" * int(score * 50)
    print(f"   {feat:<12}: {score:.4f}  {bar}")

# -----------------------------------------------------------
# 6. Lưu model vào file .pkl
# -----------------------------------------------------------
MODEL_PATH = os.path.join(BASE_DIR, "heart_disease_model.pkl")
joblib.dump(model, MODEL_PATH)

print(f"\n💾 Model đã được lưu tại: {MODEL_PATH}")
print("\n🚀 Tiếp theo: Chạy 'python app.py' để khởi động API dự đoán.")
print("=" * 60)
