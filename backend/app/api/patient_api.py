from fastapi import APIRouter
from app.schemas.patient_schema import PatientCreate
from app.core.database import database

router = APIRouter()


@router.post("/patients")
async def create_patient(patient: PatientCreate):

    query = """
    INSERT INTO patients(
        full_name,
        age,
        gender,
        phone,
        address,
        medical_history
    )
    VALUES (
        :full_name,
        :age,
        :gender,
        :phone,
        :address,
        :medical_history
    )
    """

    await database.execute(
        query=query,
        values={
            "full_name": patient.full_name,
            "age": patient.age,
            "gender": patient.gender,
            "phone": patient.phone,
            "address": patient.address,
            "medical_history": patient.medical_history
        }
    )

    return {
        "message": "Patient created successfully"
    }


@router.get("/patients")
async def get_patients():

    query = """
    SELECT * FROM patients
    ORDER BY created_at DESC
    """

    patients = await database.fetch_all(query)

    return patients