"""Remove visitor addresses from Uvicorn access records before any handler sees them."""
import logging


class RedactClientAddress(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        # Uvicorn's HTTP implementations both emit this five-argument access record.
        # Drop unfamiliar formats rather than risk logging an unredacted address.
        if record.msg != '%s - "%s %s HTTP/%s" %d' or not isinstance(record.args, tuple) or len(record.args) != 5:
            return False
        record.args = ("[redacted]", *record.args[1:])
        return True


def configure_access_logging() -> None:
    logger = logging.getLogger("uvicorn.access")
    if not any(isinstance(item, RedactClientAddress) for item in logger.filters):
        logger.addFilter(RedactClientAddress())
