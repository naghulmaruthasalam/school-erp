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

    # --- Copilot (study + teaching assistant for student / parent / teacher logins) ---
    # Roles that get the Copilot (every login by default; remove a role here to switch it off for that role)
    # (their profiles are already defined in app/copilot/profiles.py).
    # Curriculum source (a link to the syllabus JSON/CSV/ZIP, e.g. a pre-signed S3 URL). Private/internal addresses
    # and plain http are refused unless this is switched on (local development only).
    curriculum_allow_private_urls: bool = False
    curriculum_fetch_max_mb: int = 50
    curriculum_fetch_timeout_seconds: int = 30
    copilot_enabled_roles: str = "STUDENT,PARENT,TEACHER,PRINCIPAL,SCHOOL_ADMIN,SUPER_ADMIN"
    # "gemini" (uses GEMINI_API_KEY / GEMINI_MODEL_NAME above) or "openai".
    copilot_llm_provider: str = "gemini"
    openai_api_key: str | None = None
    openai_model: str = "gpt-4o-mini"
    copilot_messages_per_minute: int = 20
    # Riyah voice: speech-to-text uses the chat model (audio in); text-to-speech uses this model (Gemini) or OpenAI's tts-1.
    gemini_tts_model: str = "gemini-2.5-flash-preview-tts"
    gemini_tts_voice: str = "Kore"
    riyah_max_audio_mb: int = 8
    # Chromium/Chrome/Edge executable for PDF export (falls back to the COPILOT_CHROMIUM_PATH environment variable, then Playwright's own)
    copilot_chromium_path: str | None = None
    copilot_max_history_messages: int = 30
    # Cap on curriculum text (syllabus outline + attached document text) sent to the model per message.
    copilot_max_context_chars: int = 60000

    # --- Progress alerts (student progress -> parents, teachers, principal; teacher performance -> principal) ---
    progress_pass_percent: float = 40  # a mark below this is a low-marks alert
    progress_drop_points: float = 20  # a mark this many points below the student's earlier average is an alert
    progress_good_percent: float = 85  # at or above this: a good-progress note
    progress_attendance_percent: float = 75  # month-to-date attendance below this is an alert
    progress_homework_score_percent: float = 50  # AI homework score below this is an alert
    progress_class_avg_percent: float = 50  # a class average below this is flagged to the principal
    progress_class_gap_points: float = 15  # a class this far below the school's average is flagged
    progress_feedback_days: int = 3  # submissions waiting longer than this for the teacher's feedback are flagged
    progress_scan_interval_minutes: int = 360  # background scan + weekly summary; 0 switches the background job off

    # How long a locally-served file link (used when S3 isn't configured) stays valid.
    local_file_url_expire_seconds: int = 3600
    # Where uploads are kept when S3 isn't configured. Default: backend/uploads (inside the code folder).
    # Point it outside the code folder so files survive replacing the folder with a newer build.
    local_uploads_dir: str | None = None

    # Outbound email (password-reset OTPs). Leave smtp_host empty to only log messages.
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_use_tls: bool = True
    smtp_from: str = "Cogniitec School ERP <no-reply@cogniitec.com>"

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

    super_admin_username: str = "superadmin"
    super_admin_email: str = "superadmin@cogniitec.com"
    super_admin_password: str = "change-me"

    @property
    def copilot_roles(self) -> set[str]:
        return {r.strip().upper() for r in self.copilot_enabled_roles.split(",") if r.strip()}

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
