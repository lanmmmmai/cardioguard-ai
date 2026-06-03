-- Xóa ràng buộc khóa ngoại cũ trên bảng ai_recommendations nếu tồn tại để chuẩn bị tạo lại
ALTER TABLE ai_recommendations DROP CONSTRAINT IF EXISTS ai_recommendations_patient_id_fkey;
-- Tạo lại ràng buộc khóa ngoại cho cột patient_id tham chiếu đến bảng users, tự động xóa dữ liệu liên quan khi người dùng bị xóa
ALTER TABLE ai_recommendations ADD CONSTRAINT ai_recommendations_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE;
