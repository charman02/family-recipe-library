import boto3
from botocore.exceptions import ClientError

from app.config import settings

_SES_REGION = "us-west-2"


def send_password_reset_email(to_email: str, token: str) -> None:
    """Send a password-reset link via AWS SES.

    Uses the task's IAM role credentials automatically — no keys in config.
    Raises ClientError if SES rejects the send (caller logs and swallows it
    so the endpoint stays silent on success regardless of delivery outcome).
    """
    reset_url = f"{settings.app_url}/reset-password?token={token}"
    client = boto3.client("ses", region_name=_SES_REGION)
    client.send_email(
        Source=settings.sender_email,
        Destination={"ToAddresses": [to_email]},
        Message={
            "Subject": {"Data": "Reset your issei password"},
            "Body": {
                "Html": {
                    "Data": (
                        f"<p>Someone (hopefully you) requested a password reset for "
                        f"your issei account.</p>"
                        f"<p><a href=\"{reset_url}\">Reset my password</a></p>"
                        f"<p>This link expires in 1 hour. If you didn't request this, "
                        f"you can ignore this email — your password won't change.</p>"
                    )
                },
                "Text": {
                    "Data": (
                        f"Someone (hopefully you) requested a password reset for your "
                        f"issei account.\n\n"
                        f"Reset your password: {reset_url}\n\n"
                        f"This link expires in 1 hour. If you didn't request this, "
                        f"you can ignore this email."
                    )
                },
            },
        },
    )
