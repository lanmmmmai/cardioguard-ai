from pydantic import BaseModel


class PatientCreate(BaseModel):
    full_name: str
    age: int
    gender: str
    phone: str
    address: str
    medical_history: str