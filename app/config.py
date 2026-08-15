from pydantic_settings import BaseSettings
from pydantic import ConfigDict


class Settings(BaseSettings):
    database_url: str
    jwt_secret: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days
    cloudinary_cloud_name: str = ""
    cloudinary_api_key: str = ""
    cloudinary_api_secret: str = ""
    # Comma-separated allowed frontend origins for CORS. Set in the deploy env
    # (e.g. the Vercel URL) so adding a frontend host needs no code change.
    # Local dev is always allowed.
    cors_origins: str = ""
    # OpenRouter, for structuring a spoken/pasted recipe into fields. Optional by
    # design: with no key the parse endpoint reports that the model is unavailable and
    # the client falls back to its local parser, so /add keeps working exactly as it did
    # before this existed. Server-side only — a key in the frontend bundle would be
    # readable by anyone who opens /assets/index-*.js and could be used to spend credits.
    openrouter_api_key: str = ""
    # Cheap and fast beats clever here: this is bounded extraction against a fixed
    # schema, not reasoning. Overridable per-deploy without a code change.
    openrouter_model: str = ""
    # Sent as HTTP-Referer for attribution on OpenRouter's dashboard. Cosmetic.
    openrouter_referer: str = ""
    # SES — password-reset emails. sender_email must be a verified SES identity.
    sender_email: str = ""
    # Frontend URL used to build the reset link in the email.
    app_url: str = "https://issei.app"

    model_config = ConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        defaults = [
            "http://localhost:5173",
        ]
        extra = [o.strip() for o in self.cors_origins.split(",") if o.strip()]
        seen, out = set(), []
        for o in defaults + extra:
            if o not in seen:
                seen.add(o)
                out.append(o)
        return out


settings = Settings()
