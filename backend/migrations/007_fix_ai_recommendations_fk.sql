ALTER TABLE ai_recommendations DROP CONSTRAINT IF EXISTS ai_recommendations_patient_id_fkey;
ALTER TABLE ai_recommendations ADD CONSTRAINT ai_recommendations_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE;
