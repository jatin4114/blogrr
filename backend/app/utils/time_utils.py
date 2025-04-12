from datetime import datetime, timezone, timedelta
import pytz
import logging
import re
from typing import Optional, Union, Dict, Any

logger = logging.getLogger(__name__)

class TimeUtil:
    """Utility class for handling time-related operations across the application."""
    
    # Common timestamp formats we might encounter
    COMMON_FORMATS = [
        "%Y-%m-%dT%H:%M:%S.%fZ",         # ISO format with milliseconds and Z
        "%Y-%m-%dT%H:%M:%S.%f%z",        # ISO format with milliseconds and timezone
        "%Y-%m-%dT%H:%M:%S%z",           # ISO format with timezone
        "%Y-%m-%dT%H:%M:%SZ",            # ISO format with Z
        "%Y-%m-%d %H:%M:%S.%f",          # SQL-like format with milliseconds
        "%Y-%m-%d %H:%M:%S",             # SQL-like format
        "%Y/%m/%d %H:%M:%S",             # Slash-separated date
        "%d-%m-%Y %H:%M:%S",             # European format
        "%m/%d/%Y %H:%M:%S"              # US format
    ]
    
    @staticmethod
    def now() -> datetime:
        """Get current UTC time as timezone-aware datetime"""
        return datetime.now(timezone.utc)
    
    @staticmethod
    def utc_timestamp() -> str:
        """Get current UTC time as ISO 8601 string"""
        return TimeUtil.now().isoformat()
    
    @staticmethod
    def parse_timestamp(timestamp_str: str) -> Optional[datetime]:
        """
        Parse timestamp string to datetime, trying multiple formats.
        Always returns a timezone-aware datetime with UTC timezone.
        """
        if not timestamp_str:
            return None
            
        # If timestamp is already a datetime
        if isinstance(timestamp_str, datetime):
            return TimeUtil.to_utc(timestamp_str)
            
        # Try to parse 'Z' at the end (UTC indicator)
        if timestamp_str.endswith('Z'):
            timestamp_str = timestamp_str[:-1] + '+00:00'
            
        # Try to parse the timestamp using the common formats
        for fmt in TimeUtil.COMMON_FORMATS:
            try:
                dt = datetime.strptime(timestamp_str, fmt)
                # Add UTC timezone if not present
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                return dt
            except ValueError:
                continue
        
        # Try to parse as ISO format (most flexible)
        try:
            dt = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
            return TimeUtil.to_utc(dt)
        except ValueError:
            pass
            
        # Try with dateutil as a last resort
        try:
            from dateutil import parser
            dt = parser.parse(timestamp_str)
            return TimeUtil.to_utc(dt)
        except Exception:
            logger.warning(f"Failed to parse timestamp: {timestamp_str}")
            return None
            
    @staticmethod
    def to_utc(dt: datetime) -> datetime:
        """Convert datetime to UTC timezone"""
        if dt is None:
            return None
            
        # Add UTC timezone if not present
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        elif dt.tzinfo != timezone.utc:
            dt = dt.astimezone(timezone.utc)
            
        return dt
        
    @staticmethod
    def to_iso(dt: Optional[datetime] = None) -> str:
        """Convert datetime to ISO 8601 string in UTC timezone"""
        if dt is None:
            dt = TimeUtil.now()
        
        # Convert to UTC if not already
        dt = TimeUtil.to_utc(dt)
        
        # Return ISO format
        return dt.isoformat()
        
    @staticmethod
    def datetime_for_db(timestamp: Union[str, datetime, None] = None) -> datetime:
        """
        Prepare a timestamp for database storage.
        Always returns a UTC datetime without timezone info.
        """
        if timestamp is None:
            dt = TimeUtil.now()
        elif isinstance(timestamp, str):
            dt = TimeUtil.parse_timestamp(timestamp) or TimeUtil.now()
        else:
            dt = TimeUtil.to_utc(timestamp)
            
        # Remove timezone info for database storage (PostgreSQL will treat it as UTC)
        return dt.replace(tzinfo=None)
        
    @staticmethod
    def validate_timestamp(timestamp: Union[str, datetime, None]) -> bool:
        """Validate if a timestamp is valid"""
        if timestamp is None:
            return False
            
        if isinstance(timestamp, datetime):
            return True
            
        return TimeUtil.parse_timestamp(timestamp) is not None
        
    @staticmethod
    def get_local_time(dt: Union[datetime, str], timezone_str: str = "UTC") -> datetime:
        """Convert UTC datetime to local time in specified timezone"""
        if isinstance(dt, str):
            dt = TimeUtil.parse_timestamp(dt)
            
        if dt is None:
            return None
            
        try:
            local_tz = pytz.timezone(timezone_str)
            return dt.astimezone(local_tz)
        except Exception as e:
            logger.error(f"Error converting to timezone {timezone_str}: {str(e)}")
            return dt
            
    @staticmethod
    def format_for_human(dt: Union[datetime, str, None], timezone_str: str = "UTC") -> str:
        """Format datetime for human-readable display in specified timezone"""
        if dt is None:
            return ""
            
        if isinstance(dt, str):
            dt = TimeUtil.parse_timestamp(dt)
            
        if dt is None:
            return ""
            
        # Convert to specified timezone
        try:
            local_dt = TimeUtil.get_local_time(dt, timezone_str)
            # Format: "Jan 15, 2023 at 14:30"
            return local_dt.strftime("%b %d, %Y at %H:%M")
        except Exception as e:
            logger.error(f"Error formatting datetime: {str(e)}")
            return str(dt)
