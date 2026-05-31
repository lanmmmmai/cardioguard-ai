# Wiring Notes

## ESP32-S3 SuperMini + MAX30102

Use I2C for MAX30102.

Record the final pin mapping here once hardware is assembled:

| MAX30102 | ESP32-S3 SuperMini | Notes |
| --- | --- | --- |
| VIN | TBD | Confirm module voltage requirement before wiring. |
| GND | GND | Shared ground. |
| SDA | TBD | I2C data. |
| SCL | TBD | I2C clock. |
| INT | TBD | Optional interrupt pin. |

## ESP32-S3 SuperMini + AD8232

Use ADC for ECG output.

| AD8232 | ESP32-S3 SuperMini | Notes |
| --- | --- | --- |
| 3.3V | 3.3V | Confirm board module input range. |
| GND | GND | Shared ground. |
| OUTPUT | TBD ADC | ECG analog signal. |
| LO+ | TBD GPIO | Optional leads-off detection. |
| LO- | TBD GPIO | Optional leads-off detection. |

## Device Status Inputs

Track these once the hardware design is fixed:

- Battery voltage input
- Charging status input, if available
- Button input, if needed
- Status LED, if needed

