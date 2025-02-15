# app/core/hashing.py

from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class Hash:
    @staticmethod
    def bcrypt(password: str):
        return pwd_context.hash(password)

    @staticmethod
    def verify_user(plain_password: str, hashed_password: str):
        try:
            return pwd_context.verify(plain_password, hashed_password)
        except Exception as e:
            print(f"Error verifying password: {str(e)}")
            return False

def verify_password(plain_password: str, hashed_password: str):
    return Hash.verify_user(plain_password, hashed_password)
