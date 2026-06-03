"""
CardioGuard AI - Mô-đun huấn luyện mô hình

Mục đích:
    Huấn luyện bộ phân loại RandomForest trên dữ liệu bệnh tim đã được làm sạch và xuất
    mô hình đã huấn luyện (heart_disease_model.pkl) cùng với siêu dữ liệu đánh giá.

Luồng xử lý:
    1. Đọc file heart_disease_clean.csv chứa 13 đặc trưng sức khỏe và cột mục tiêu.
    2. Chia dữ liệu theo tỷ lệ 80/20 (train/test) có phân tầng theo nhãn mục tiêu.
    3. Huấn luyện mô hình RandomForestClassifier (200 cây, độ sâu tối đa = 10) trên tập huấn luyện.
    4. Đánh giá mô hình trên tập kiểm thử (accuracy, precision, recall, F1, AUC-ROC).
    5. Xuất phân tích mức độ quan trọng của các đặc trưng.
    6. Lưu mô hình dưới dạng .pkl và lưu siêu dữ liệu dưới dạng .json cho máy chủ API.

Mối quan hệ:
    - ai_model/heart_disease_clean.csv: Tập dữ liệu đầu vào được sử dụng bởi tập lệnh này.
    - ai_model/app.py: Sử dụng các file .pkl và siêu dữ liệu được tạo ra ở đây.
    - ai_model/heart_disease_model.pkl: Mô hình đã được tuần tự hóa.
    - ai_model/model_metadata.json: Các chỉ số huấn luyện và phiên bản sklearn.
"""

import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report, precision_score, recall_score, f1_score, roc_auc_score
import joblib
import os
import json
import sklearn

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
# 2. Tách dữ liệu đầu vào (X) và nhãn mục tiêu (y)
# -----------------------------------------------------------
# Các cột đặc trưng sức khỏe được sử dụng để dự đoán
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

X = df[FEATURE_COLUMNS]   # Dữ liệu đầu vào chứa các đặc trưng
y = df["target"]           # Nhãn mục tiêu cần dự đoán (0 hoặc 1)

print(f"\n📊 Đặc trưng đầu vào (X): {X.shape[1]} cột")
print(f"🎯 Nhãn đầu ra (y): cột 'target'")

# -----------------------------------------------------------
# 3. Chia dữ liệu thành tập huấn luyện và tập kiểm thử theo tỷ lệ 80/20
# -----------------------------------------------------------
X_train, X_test, y_train, y_test = train_test_split(
    X, y,
    test_size=0.2,        # 20% dữ liệu dành cho kiểm thử
    random_state=42,      # Cố định seed để kết quả có thể tái tạo
    stratify=y            # Đảm bảo tỷ lệ nhãn cân bằng trong cả hai tập
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
    min_samples_split=5,   # Số lượng mẫu tối thiểu để phân nhánh
    random_state=42,       # Cố định kết quả ngẫu nhiên để tái tạo
    n_jobs=-1              # Sử dụng tất cả các lõi CPU để tăng tốc
)

model.fit(X_train, y_train)
print("✅ Huấn luyện hoàn tất!")

# -----------------------------------------------------------
# 5. Đánh giá mô hình trên tập kiểm thử
# -----------------------------------------------------------
y_pred = model.predict(X_test)
y_prob = model.predict_proba(X_test)[:, 1]

accuracy = accuracy_score(y_test, y_pred)
precision = precision_score(y_test, y_pred)
recall = recall_score(y_test, y_pred)
f1 = f1_score(y_test, y_pred)
auc_roc = roc_auc_score(y_test, y_prob)

print(f"\n{'=' * 60}")
print(f"  KẾT QUẢ ĐÁNH GIÁ MÔ HÌNH")
print(f"{'=' * 60}")
print(f"\n🎯 Accuracy (Độ chính xác): {accuracy * 100:.2f}%")
print(f"🎯 Precision (Độ chính xác dự đoán dương tính): {precision * 100:.2f}%")
print(f"🎯 Recall (Độ nhạy): {recall * 100:.2f}%")
print(f"🎯 F1-Score (Điểm F1): {f1 * 100:.2f}%")
print(f"🎯 AUC-ROC Score: {auc_roc:.4f}")
print(f"\n📋 Classification Report:")
print(classification_report(
    y_test, y_pred,
    target_names=["Không có nguy cơ (0)", "Có nguy cơ bệnh tim (1)"]
))

# In ra mức độ quan trọng của từng đặc trưng
print("🔑 Mức độ quan trọng của các đặc trưng:")
# Chuyển đổi mảng feature_importances thành chuỗi Series có gắn nhãn để dễ đọc
importances = pd.Series(model.feature_importances_, index=FEATURE_COLUMNS)
# Sắp xếp giảm dần để các đặc trưng quan trọng nhất xuất hiện đầu tiên
importances_sorted = importances.sort_values(ascending=False)
# Hiển thị biểu đồ thanh ngang đơn giản sử dụng ký tự Unicode — mỗi thanh rộng 50 ký tự
for feat, score in importances_sorted.items():
    bar = "█" * int(score * 50)
    print(f"   {feat:<12}: {score:.4f}  {bar}")

# -----------------------------------------------------------
# 6. Lưu mô hình và siêu dữ liệu
# -----------------------------------------------------------
MODEL_PATH = os.path.join(BASE_DIR, "heart_disease_model.pkl")
joblib.dump(model, MODEL_PATH)

METADATA_PATH = os.path.join(BASE_DIR, "model_metadata.json")
# Tổng hợp các chỉ số đánh giá cùng với phiên bản sklearn để máy chủ API
# có thể cảnh báo về sự không tương thích phiên bản khi khởi động
metadata = {
    "scikit_learn_version": sklearn.__version__,
    "accuracy": float(accuracy),
    "precision": float(precision),
    "recall": float(recall),
    "f1_score": float(f1),
    "auc_roc": float(auc_roc)
}
with open(METADATA_PATH, "w", encoding="utf-8") as f:
    json.dump(metadata, f, indent=4, ensure_ascii=False)

print(f"\n💾 Model đã được lưu tại: {MODEL_PATH}")
print(f"💾 Metadata đã được lưu tại: {METADATA_PATH}")
print("\n🚀 Tiếp theo: Chạy 'python app.py' để khởi động API dự đoán.")
print("=" * 60)
