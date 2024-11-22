;; Academic Credential Verification System

;; Constants
(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-found (err u101))
(define-constant err-already-issued (err u102))
(define-constant err-unauthorized (err u103))
(define-constant err-revoked (err u104))

;; Data Maps
(define-map credentials
  { credential-id: uint }
  {
    institution: principal,
    recipient: principal,
    credential-hash: (buff 32),
    issuance-date: uint,
    is-revoked: bool
  }
)

(define-map institutions principal bool)

(define-map selective-disclosure
  { credential-id: uint, field: (string-ascii 20) }
  { value: (string-utf8 500) }
)

;; Variables
(define-data-var last-credential-id uint u0)

;; Private Functions
(define-private (is-owner)
  (is-eq tx-sender contract-owner)
)

(define-private (is-institution (institution principal))
  (default-to false (map-get? institutions institution))
)

;; Public Functions
(define-public (register-institution (institution principal))
  (begin
    (asserts! (is-owner) err-owner-only)
    (ok (map-set institutions institution true))
  )
)

(define-public (issue-credential (recipient principal) (credential-hash (buff 32)))
  (let
    (
      (new-id (+ (var-get last-credential-id) u1))
    )
    (asserts! (is-institution tx-sender) err-unauthorized)
    (asserts! (is-none (map-get? credentials { credential-id: new-id })) err-already-issued)
    (map-set credentials { credential-id: new-id }
      {
        institution: tx-sender,
        recipient: recipient,
        credential-hash: credential-hash,
        issuance-date: block-height,
        is-revoked: false
      }
    )
    (var-set last-credential-id new-id)
    (ok new-id)
  )
)

(define-public (revoke-credential (credential-id uint))
  (let
    (
      (credential (unwrap! (map-get? credentials { credential-id: credential-id }) err-not-found))
    )
    (asserts! (is-eq (get institution credential) tx-sender) err-unauthorized)
    (ok (map-set credentials { credential-id: credential-id }
      (merge credential { is-revoked: true })))
  )
)

(define-public (add-selective-disclosure (credential-id uint) (field (string-ascii 20)) (value (string-utf8 500)))
  (let
    (
      (credential (unwrap! (map-get? credentials { credential-id: credential-id }) err-not-found))
    )
    (asserts! (is-eq (get recipient credential) tx-sender) err-unauthorized)
    (ok (map-set selective-disclosure { credential-id: credential-id, field: field } { value: value }))
  )
)

;; Read-only Functions
(define-read-only (verify-credential (credential-id uint) (credential-hash (buff 32)))
  (match (map-get? credentials { credential-id: credential-id })
    credential (ok (and
      (is-eq (get credential-hash credential) credential-hash)
      (not (get is-revoked credential))
    ))
    err-not-found
  )
)

(define-read-only (get-credential-info (credential-id uint))
  (map-get? credentials { credential-id: credential-id })
)

(define-read-only (get-selective-disclosure (credential-id uint) (field (string-ascii 20)))
  (map-get? selective-disclosure { credential-id: credential-id, field: field })
)

