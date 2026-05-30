import re


PASSWORD_PATTERN = re.compile(r"^(?=.*[A-Z])(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$")
PASSWORD_POLICY_MESSAGE = (
    "Password must be at least 8 characters and include uppercase, letters, numbers and special characters"
)


def validate_password(value: str) -> str:
    if not PASSWORD_PATTERN.fullmatch(value):
        raise ValueError(PASSWORD_POLICY_MESSAGE)
    return value
