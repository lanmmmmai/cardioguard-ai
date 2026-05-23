def detect_abnormal(data):
    alerts = []

    if data.heart_rate > 120:
        alerts.append({
            "alert_type": "HIGH_HEART_RATE",
            "message": "Nhịp tim quá cao",
            "severity": "high"
        })

    if data.heart_rate < 50:
        alerts.append({
            "alert_type": "LOW_HEART_RATE",
            "message": "Nhịp tim quá thấp",
            "severity": "high"
        })

    if data.spo2 < 92:
        alerts.append({
            "alert_type": "LOW_SPO2",
            "message": "Nồng độ SpO2 thấp",
            "severity": "high"
        })

    if data.systolic_bp > 140 or data.diastolic_bp > 90:
        alerts.append({
            "alert_type": "HIGH_BLOOD_PRESSURE",
            "message": "Huyết áp cao",
            "severity": "medium"
        })

    if data.ecg_value > 0.8 or data.ecg_value < -0.8:
        alerts.append({
            "alert_type": "ABNORMAL_ECG",
            "message": "Tín hiệu ECG bất thường",
            "severity": "high"
        })

    return alerts