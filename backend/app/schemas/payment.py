from pydantic import BaseModel, Field

from app.core.enums import PaymentStatus


class PayUInitiateRequest(BaseModel):
    invoice_id: str
    amount: float = Field(..., gt=0, description="Amount in rupees to collect for this invoice")
    return_path: str = Field(
        default="/parent/fees",
        description="Frontend path to bounce back to after payment (e.g. '/parent/fees' or '/student/fees')",
    )


class PayUInitiateResponse(BaseModel):
    """Everything the frontend needs to auto-submit an HTML form POST to
    PayU's hosted checkout page — PayU's classic flow is a browser redirect
    via form POST, not a JS SDK modal."""

    payment_id: str  # local Payment document id
    invoice_id: str
    action_url: str  # PayU's hosted payment page URL to POST the form to
    key: str
    txnid: str
    amount: str  # PayU expects amount as a string with 2 decimals
    productinfo: str
    firstname: str
    email: str
    phone: str
    surl: str  # success callback URL (our backend)
    furl: str  # failure callback URL (our backend)
    hash: str


class PayUCallbackResult(BaseModel):
    payment_id: str
    status: PaymentStatus
    invoice_id: str
    invoice_status: str
    redirect_url: str


class PayURefundRequest(BaseModel):
    payment_id: str
    amount: float = Field(..., gt=0, description="Refund amount in rupees — full or partial")
    reason: str | None = None


class PayURefundResponse(BaseModel):
    payment_id: str
    status: PaymentStatus  # REFUND_PENDING once PayU accepts the request
    refund_token: str
    refund_request_id: str | None
    message: str
