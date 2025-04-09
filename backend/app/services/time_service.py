import datetime
import pytz
import logging
from typing import Optional, Union

logger = logging.getLogger(__name__)

class TimeService:
    """
    Centralized service for handling timestamps across the application.
    Ensures consistent time formatting and timezone handling.
    """
    
    def __init__(self, timezone: str = 'UTC'):
        self.timezone = pytz.timezone(timezone)
        logger.info(f"TimeService initialized with timezone: {timezone}")
    
    def get_current_time(self) -> datetime.datetime:
        """
        Get the current time in UTC with timezone information.
        Returns a timezone-aware datetime object.
        """
        return datetime.datetime.now(datetime.timezone.utc)
    
    def get_current_timestamp(self) -> str:
        """
        Get the current time as an ISO 8601 formatted string in UTC.
        """
        return self.get_current_time().isoformat()
    
    def format_timestamp(self, timestamp: Union[datetime.datetime, str, None]) -> str:
        """
        Format a timestamp to ISO 8601 format with timezone information.
        
        Args:
            timestamp: Datetime object or ISO string or None
            
        Returns:
            ISO 8601 formatted timestamp string with timezone
        """
        if timestamp is None:
            return self.get_current_timestamp()
            
        if isinstance(timestamp, str):
            try:
                # Parse the string to a datetime object
                if timestamp.endswith('Z'):
                    # Handle UTC 'Z' suffix by replacing with +00:00
                    timestamp = timestamp[:-1] + '+00:00'
                
                # Parse the string to datetime
                timestamp = datetime.datetime.fromisoformat(timestamp)
            except (ValueError, TypeError) as e:
                logger.error(f"Error parsing timestamp '{timestamp}': {str(e)}")
                return self.get_current_timestamp()
        
        # Ensure timestamp is timezone aware
        if timestamp.tzinfo is None:
            timestamp = timestamp.replace(tzinfo=datetime.timezone.utc)
            
        return timestamp.isoformat()
    
    def parse_timestamp(self, timestamp_str: str) -> datetime.datetime:
        """
        Parse an ISO timestamp string into a datetime object.
        
        Args:
            timestamp_str: ISO formatted timestamp string
            
        Returns:
            Timezone-aware datetime object
        """
        try:
            # Handle 'Z' suffix for UTC time
            if timestamp_str.endswith('Z'):
                timestamp_str = timestamp_str[:-1] + '+00:00'
                
            dt = datetime.datetime.fromisoformat(timestamp_str)
            
            # Ensure timezone awareness
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=datetime.timezone.utc)
                
            return dt
        except (ValueError, TypeError) as e:
            logger.error(f"Error parsing timestamp string '{timestamp_str}': {str(e)}")
            # Return current time as fallback
            return self.get_current_time()
            
    def convert_to_utc(self, dt: datetime.datetime) -> datetime.datetime:
        """Convert any datetime to UTC timezone"""
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=datetime.timezone.utc)
        return dt.astimezone(datetime.timezone.utc)
        
    def timestamp_to_unix(self, timestamp: Union[datetime.datetime, str]) -> int:
        """Convert a timestamp to Unix time (seconds since epoch)"""
        if isinstance(timestamp, str):
            timestamp = self.parse_timestamp(timestamp)
        return int(timestamp.timestamp())
    
    def debug_timestamp(self, timestamp: Union[datetime.datetime, str, None]) -> dict:
        """Generate debug info for a timestamp to help diagnose issues"""
        if timestamp is None:
            timestamp = self.get_current_time()
            
        if isinstance(timestamp, str):
            try:
                parsed = self.parse_timestamp(timestamp)
            except Exception as e:
                return {"error": f"Could not parse: {str(e)}"}
        else:
            parsed = timestamp
            
        # Ensure timezone awareness
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=datetime.timezone.utc)
            
        return {
            "original": str(timestamp),
            "iso": parsed.isoformat(),
            "utc": parsed.astimezone(datetime.timezone.utc).isoformat(),
            "unix": int(parsed.timestamp()),
            "tzname": str(parsed.tzinfo),
            "formatted": self.format_timestamp(parsed)
        }

# Global instance for use throughout the application
time_service = TimeService()
