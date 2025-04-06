from passlib.context import CryptContext
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Handle bcrypt compatibility issue
try:
    # Setup password hashing context with error handling for bcrypt version issues
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    
    # Test that it works
    test_hash = pwd_context.hash("test")
    pwd_context.verify("test", test_hash)
    
    logger.info("Password hashing initialized successfully")
except Exception as e:
    logger.warning(f"Error initializing bcrypt with CryptContext: {str(e)}")
    logger.warning("Falling back to basic bcrypt")
    
    # Fallback to direct bcrypt if passlib has issues
    import bcrypt
    
    # Create a custom context that mimics CryptContext but uses bcrypt directly
    class CustomBcryptContext:
        def hash(self, password: str) -> str:
            """Hash a password using bcrypt"""
            if isinstance(password, str):
                password = password.encode('utf-8')
            return bcrypt.hashpw(password, bcrypt.gensalt()).decode('utf-8')
        
        def verify(self, password: str, hash: str) -> bool:
            """Verify a password against a hash"""
            if isinstance(password, str):
                password = password.encode('utf-8')
            if isinstance(hash, str):
                hash = hash.encode('utf-8')
            try:
                return bcrypt.checkpw(password, hash)
            except Exception as e:
                logger.error(f"Error verifying password: {str(e)}")
                return False
    
    pwd_context = CustomBcryptContext()
    logger.info("Using fallback bcrypt implementation")

class Hash:
    @staticmethod
    def bcrypt(password: str) -> str:
        """
        Hash a password using bcrypt
        """
        try:
            return pwd_context.hash(password)
        except Exception as e:
            logger.error(f"Error hashing password: {str(e)}")
            raise
        
    @staticmethod
    def verify_user(plain_password: str, hashed_password: str) -> bool:
        """
        Verify a password against a hash
        """
        try:
            # Add better error handling
            if not plain_password or not hashed_password:
                logger.warning("Missing password or hash in verify_user")
                return False
                
            return pwd_context.verify(plain_password, hashed_password)
        except Exception as e:
            logger.error(f"Error verifying password: {str(e)}")
            return False

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against a hash
    """
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception as e:
        logger.error(f"Error in verify_password: {str(e)}")
        return False
