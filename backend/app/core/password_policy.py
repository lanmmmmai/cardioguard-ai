import re


PASSWORD_PATTERN = re.compile(r"^(?=.*[A-Z])(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,72}$")
PASSWORD_POLICY_MESSAGE = (
    "Password must be between 8 and 72 characters and include uppercase, letters, numbers and special characters"
)


def validate_password(value: str) -> str:
    if not PASSWORD_PATTERN.fullmatch(value):
        raise ValueError(PASSWORD_POLICY_MESSAGE)
    if len(value.encode("utf-8")) > 72:
        raise ValueError("Password cannot be longer than 72 bytes due to security hashing constraints")
    return value
