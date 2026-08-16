# Rollback guidance — 20260816000002

The migration is transactional; a failed apply rolls back automatically.

Prefer a forward fix. Existing `checkout_idempotency` rows are financial audit evidence and must not be deleted. If an emergency client rollback is unavoidable, a reviewed migration may temporarily re-grant the exact nine-argument `process_checkout_v1` signature to `authenticated`; doing so removes retry/duplicate protection and is not production-safe. Do not drop the wrapper or idempotency table while any deployed client can retry an in-flight checkout request.
