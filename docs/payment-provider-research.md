# Payment provider implementation notes

These implementation notes were collected from the providers' official documentation on 27 October 2026. They inform the adapter design only; no live provider credentials or merchant configuration are included.

## Paystack

- API requests use HTTPS at `https://api.paystack.co` and authenticate with the merchant secret key in `Authorization: Bearer …`. For KES, amounts are sent in the currency subunit (multiply whole shillings by 100); the adapter must not send a KES integer as a whole-shilling amount. [API reference](https://paystack.com/docs/api/)
- Paystack webhook events carry `x-paystack-signature`, an HMAC-SHA512 signature of the raw request body using the secret key. The handler must preserve the exact raw bytes, verify the signature before processing, be idempotent, and return HTTP 200 promptly. The current documentation describes live retries every 3 minutes for the first 4 attempts and then hourly up to 72 hours; test-mode retries hourly up to 10 hours. [Webhooks](https://paystack.com/docs/payments/webhooks/)
- `POST /refund` accepts the transaction reference or ID. An optional partial refund amount is also in the currency subunit. A queued refund response is not evidence that the refund has completed; the local ledger should remain in a pending/refund-request state until reconciled. [Refund API](https://paystack.com/docs/api/refund/)

## PesaPal API 3.0

- Register the public IPN endpoint before submitting orders. The registration response returns an `ipn_id`, which must be supplied as `notification_id` on each order request. Use the provider's sandbox base when in test mode and production base only when explicitly configured. [Register IPN](https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/registeripnurl)
- Submit orders with a unique merchant reference limited to 50 characters and the permitted characters, currency, amount, description, callback URL, IPN ID and billing address. The response contains a provider `order_tracking_id` and `redirect_url`. The callback and IPN indicate identifiers but do **not** establish payment status. [Submit Order Request](https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/submitorderrequest)
- Query `GetTransactionStatus` using the callback/IPN `OrderTrackingId`; reconcile its `merchant_reference`, currency and amount with the local pending payment. Activate value only when provider status is `COMPLETED` / status code `1`. A PesaPal IPN should return the provider's required JSON acknowledgement with status 200 after processing. [Get Transaction Status](https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/gettransactionstatus)
- A refund request requires the original payment confirmation code, amount, username and remarks. It is restricted to completed transactions; PesaPal permits one refund request per payment and describes card partial refunds versus mobile-money full refunds. A successful API response means the request is received for merchant/finance processing, not that funds have already returned. [Refund Request](https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/refund-request)

## Configuration consequences

Provider secrets stay server-side. Test mode is the default; live mode must be blocked until a live secret, merchant-approved public callback/IPN URLs and the selected provider are configured. Payment completion must be determined by signed Paystack webhooks plus server verification, or by PesaPal status verification from its callback/IPN—not by a browser redirect alone.

## Checkout and token details confirmed in the provider browser pages

- Paystack checkout initialization is a server-authenticated `POST /transaction/initialize`; its response provides the authorization URL and unique reference. `GET /transaction/verify/:reference` returns the provider transaction status and amount in subunits. Reconcile the reference, KES currency, exact expected amount and a `success` status before activating value. [Transaction API](https://paystack.com/docs/api/transaction/)
- PesaPal API 3.0 token generation is `POST /api/Auth/RequestToken` on the selected sandbox or production base using `consumer_key` and `consumer_secret`. The bearer token is documented as valid for at most five minutes, so the adapter should refresh it when expired and never persist it in browser storage. [Authentication](https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/authentication)
