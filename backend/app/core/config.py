from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Cogniitec AI School ERP"
    environment: str = "development"
    debug: bool = True
    api_v1_prefix: str = "/api/v1"
    cors_origins: str = "http://localhost:5173"
    backend_base_url: str = "http://localhost:8000"  # must be publicly reachable for PayU to redirect back to
    frontend_base_url: str = "http://localhost:5173"

    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db_name: str = "cogniitec_school_erp"

    jwt_secret_key: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    aws_access_key_id: str | None = None
    aws_secret_access_key: str | None = None
    aws_region: str = "ap-south-1"
    s3_bucket_name: str = "cogniitec-school-erp-files"
    s3_key_prefix: str = ""  # e.g. "cogniitec-ai-school-erp" — prepended to every object key
    s3_presigned_url_expire_seconds: int = 3600

    gemini_api_key: str | None = None
    gemini_model_name: str = "gemini-3.5-flash-lite"

    # PayU (India) payment gateway.
    # Checkout (classic hosted-checkout hash flow) + Refund v1 (postservice.php,
    # command=cancel_refund_transaction) both authenticate with key+salt.
    payu_merchant_key: str | None = None
    payu_merchant_salt: str | None = None
    payu_base_url: str = "https://test.payu.in/_payment"  # switch to https://secure.payu.in/_payment for production
    payu_postservice_url: str = "https://test.payu.in/merchant/postservice.php?form=2"  # prod: https://info.payu.in/merchant/postservice.php?form=2
    # OAuth client credentials — issued separately from key/salt, used by
    # PayU's newer OAuth-secured API families (e.g. Payouts). Not used by the
    # checkout or v1 refund flow implemented here; stored so they're ready if
    # a future integration needs them. Test token endpoint:
    # https://uat-accounts.payu.in/oauth/token (prod: https://accounts.payu.in/oauth/token)
    payu_client_id: str | None = None
    payu_client_secret: str | None = None
    payu_oauth_token_url: str = "https://uat-accounts.payu.in/oauth/token"

    super_admin_email: str = "superadmin@cogniitec.com"
    super_admin_password: str = "change-me"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
