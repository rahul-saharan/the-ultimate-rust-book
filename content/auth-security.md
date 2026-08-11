<h1><span class="h1-kicker">The Crate Ecosystem</span>Authentication & Security</h1>

Rust prevents memory-safety bugs. It does nothing to stop you storing passwords in plain text, comparing tokens with `==`, or logging an API key. Those are *logic* bugs, and they're the ones that end up in incident reports.

This chapter covers the security work that comes up in almost every real service: hashing passwords, issuing and verifying tokens, handling secrets, and the handful of Rust-specific pitfalls that surprise people.

> [!warning] Use audited implementations; never invent cryptography
> Every algorithm in this chapter has a well-maintained, reviewed Rust crate. Writing your own password hash, token format, or encryption is how systems get broken — not because the maths is hard to look up, but because the implementation details (constant-time comparison, nonce reuse, padding, key derivation) are where the actual attacks live. The correct amount of original cryptography in an application is zero.

## Passwords: hash, never encrypt

```toml
[dependencies]
argon2 = "0.5"           # the current recommendation (Argon2id)
password-hash = "0.5"
# Alternatives: bcrypt = "0.15", scrypt = "0.11"
```

```rust,ignore
use argon2::password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;

fn hash_password(plain: &str) -> Result<String, argon2::password_hash::Error> {
    // A fresh random salt PER PASSWORD. This is what defeats rainbow tables
    // and stops two users with the same password having the same hash.
    let salt = SaltString::generate(&mut OsRng);

    // The output is a PHC string that embeds the algorithm, parameters,
    // salt, and hash — so you can change parameters later without a migration.
    Ok(Argon2::default().hash_password(plain.as_bytes(), &salt)?.to_string())
}

fn verify_password(plain: &str, stored: &str) -> bool {
    let Ok(parsed) = PasswordHash::new(stored) else {
        return false; // a malformed stored hash is a verification failure
    };
    // This comparison is constant-time internally — do not reimplement it.
    Argon2::default().verify_password(plain.as_bytes(), &parsed).is_ok()
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let stored = hash_password("correct horse battery staple")?;
    println!("stored: {stored}");
    // $argon2id$v=19$m=19456,t=2,p=1$<salt>$<hash>

    println!("correct password: {}", verify_password("correct horse battery staple", &stored));
    println!("wrong password:   {}", verify_password("hunter2", &stored));

    // The same password hashes differently every time, because the salt differs.
    let again = hash_password("correct horse battery staple")?;
    println!("hashes differ:    {}", stored != again);
    Ok(())
}
```

<figure class="diagram">
<svg viewBox="0 0 640 250" role="img" aria-label="A password is combined with a fresh random salt and a slow memory-hard hash to produce a PHC string, and verification re-hashes the candidate with the stored salt">
  <style>
    .au-h { font: 700 12px var(--font-sans); }
    .au-m { font: 600 10px var(--font-mono); fill: var(--text); }
    .au-c { font: 11px var(--font-sans); fill: var(--text-mute); }
    .au-in { fill: var(--blue-soft); stroke: var(--blue); stroke-width: 1.5; }
    .au-slow { fill: var(--rust-100); stroke: var(--rust-500); stroke-width: 2; }
    .au-store { fill: var(--green-soft); stroke: var(--green); stroke-width: 1.5; }
    .au-salt { fill: var(--purple-soft); stroke: var(--purple); stroke-width: 1.5; }
  </style>
  <text x="20" y="18" class="au-h" fill="var(--text-mute)">Registration — hash once, store the whole PHC string</text>
  <rect x="20" y="28" width="110" height="30" rx="4" class="au-in"/><text x="30" y="48" class="au-m">"hunter2"</text>
  <rect x="20" y="66" width="110" height="30" rx="4" class="au-salt"/><text x="30" y="86" class="au-m">fresh salt</text>
  <text x="20" y="112" class="au-c">new random salt EVERY time</text>
  <rect x="180" y="40" width="150" height="44" rx="4" class="au-slow"/>
  <text x="192" y="60" class="au-m">Argon2id</text>
  <text x="192" y="76" class="au-c">~200ms, memory-hard</text>
  <rect x="380" y="34" width="240" height="56" rx="4" class="au-store"/>
  <text x="390" y="52" class="au-m">$argon2id$v=19$m=19456,</text>
  <text x="390" y="66" class="au-m">t=2,p=1$&lt;salt&gt;$&lt;hash&gt;</text>
  <text x="390" y="82" class="au-c">params + salt + hash, all in one string</text>
  <path d="M132 45 L176 55" stroke="var(--blue)" stroke-width="1.8" marker-end="url(#arr-au)"/>
  <path d="M132 81 L176 69" stroke="var(--purple)" stroke-width="1.8" marker-end="url(#arr-au2)"/>
  <path d="M332 62 L376 62" stroke="var(--rust-500)" stroke-width="2.5" marker-end="url(#arr-au3)"/>
  <text x="20" y="150" class="au-h" fill="var(--text-mute)">Login — re-hash the candidate with the STORED salt, then compare</text>
  <rect x="20" y="160" width="110" height="30" rx="4" class="au-in"/><text x="30" y="180" class="au-m">candidate</text>
  <rect x="180" y="160" width="150" height="30" rx="4" class="au-slow"/><text x="192" y="180" class="au-m">Argon2id (same params)</text>
  <rect x="380" y="160" width="240" height="30" rx="4" class="au-store"/>
  <text x="390" y="180" class="au-m">constant-time compare → bool</text>
  <path d="M132 175 L176 175" stroke="var(--blue)" stroke-width="1.8" marker-end="url(#arr-au)"/>
  <path d="M332 175 L376 175" stroke="var(--rust-500)" stroke-width="2.5" marker-end="url(#arr-au3)"/>
  <text x="20" y="216" class="au-c">The salt and parameters are read back OUT of the stored string — that is why you can raise the cost later</text>
  <text x="20" y="232" class="au-c">without a migration: old hashes keep verifying with their own recorded parameters.</text>
  <defs>
    <marker id="arr-au" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--blue)"/></marker>
    <marker id="arr-au2" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--purple)"/></marker>
    <marker id="arr-au3" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="var(--rust-500)"/></marker>
  </defs>
</svg>
<figcaption>The stored <b>PHC string</b> carries the algorithm, parameters, and salt alongside the hash — so verification is self-describing and the cost can be raised later.</figcaption>
</figure>

| Algorithm | Verdict | Notes |
|---|---|---|
| **Argon2id** | ✅ the current recommendation | memory-hard; winner of the Password Hashing Competition |
| **scrypt** | ✅ fine | memory-hard; well established |
| **bcrypt** | ✅ acceptable | battle-tested; 72-byte input limit |
| PBKDF2 | ⚠️ only for compliance | weak against GPUs; use a high iteration count |
| SHA-256 / SHA-512 | ❌ **never** for passwords | far too fast — billions of guesses per second |
| MD5 / SHA-1 | ❌ broken | do not use for anything |
| encryption (AES) | ❌ wrong tool | encryption is reversible; hashing must not be |

> [!key] Password hashing must be *slow* on purpose
> A general-purpose hash like SHA-256 is designed to be fast, which means an attacker with a GPU can try billions of candidates per second against a leaked database. Argon2 and bcrypt are deliberately slow and **memory-hard**, so each guess costs real time and RAM. That's the entire point — and it's why "we hashed the passwords with SHA-256" is still a breach. Tune the parameters so verification takes roughly 100–500ms on your hardware.

> [!mistake] Storing an encrypted password instead of a hash
> Encryption is reversible by design, so an attacker who gets your database *and* your key gets every plaintext password — and users reuse passwords across sites, so that's a much larger incident than your own service. A hash cannot be reversed even with full access to your code and configuration. There is no legitimate reason for a service to be able to recover a user's password; "email me my password" is a red flag, not a feature.

## Constant-time comparison

This is the Rust-specific trap. Comparing secrets with `==` leaks information through timing.

```rust
/// Compare two byte slices in time that does not depend on WHERE they differ.
/// This is what `subtle::ConstantTimeEq` does properly — shown here to make
/// the idea concrete, not as a replacement for the crate.
fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false; // length is not usually secret
    }
    // OR together every difference, then check once. No early exit.
    let mut diff = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}

fn main() {
    let secret = b"super-secret-token";

    println!("match:    {}", constant_time_eq(secret, b"super-secret-token"));
    println!("mismatch: {}", constant_time_eq(secret, b"super-secret-tokeX"));
    println!("length:   {}", constant_time_eq(secret, b"short"));

    // Why == is a problem: it returns as soon as it finds a difference.
    // An attacker measuring response times learns how many leading bytes
    // were correct, and can recover the token one byte at a time.
    let wrong_early = b"Xuper-secret-token"; // differs at byte 0
    let wrong_late = b"super-secret-tokeX";  // differs at byte 17
    println!("\n== is fast to reject {:?} and slower for {:?}",
             &wrong_early[..1], &wrong_late[16..]);
    println!("that timing difference is the vulnerability");
}
```

```toml
[dependencies]
subtle = "2"        # ConstantTimeEq — use this in real code
```

```rust,ignore
use subtle::ConstantTimeEq;

fn tokens_match(provided: &[u8], expected: &[u8]) -> bool {
    // Returns a Choice, which resists compiler optimizations that would
    // reintroduce a branch. `.into()` converts it to bool at the end.
    provided.ct_eq(expected).into()
}
```

> [!warning] `==` on a secret is a real vulnerability, not a theoretical one
> Rust's `==` on slices short-circuits at the first differing byte. Over enough requests, an attacker measures the difference and recovers an API key, session token, or HMAC one byte at a time. Timing attacks over a network are practical — this is not paranoia. Use `subtle::ConstantTimeEq` for **any** comparison where one side is a secret: tokens, HMACs, password-reset codes, webhook signatures. Password *verification* through Argon2 already does this internally.

## Random values for secrets

```rust,ignore
use rand::distributions::Alphanumeric;
use rand::{thread_rng, Rng};

fn session_token() -> String {
    // thread_rng() is a CSPRNG (ChaCha12) seeded from the OS — suitable for secrets.
    // 32 alphanumeric characters is ~190 bits of entropy. Plenty.
    thread_rng().sample_iter(&Alphanumeric).take(32).map(char::from).collect()
}

fn raw_key() -> [u8; 32] {
    let mut key = [0u8; 32];
    thread_rng().fill(&mut key);
    key
}

fn main() {
    println!("token: {}", session_token());
    println!("key:   {:02x?}", raw_key());
    // For IDs that need to be unique rather than secret, use uuid:
    // uuid::Uuid::new_v4().to_string()
}
```

| Need | Use | Don't use |
|---|---|---|
| a session token | `rand::thread_rng()` + `Alphanumeric` | `SmallRng`, a timestamp, a counter |
| a password salt | the hashing crate's `SaltString::generate(&mut OsRng)` | a fixed salt, or the username |
| an encryption key | `OsRng`, or the cipher crate's keygen | a password directly (derive it first) |
| a nonce / IV | the cipher crate's generator | a counter you reuse, ever |
| a unique ID (not secret) | `uuid::Uuid::new_v4()` | an incrementing integer in a URL |
| a CSRF token | `thread_rng()` + `Alphanumeric` | anything predictable |

> [!mistake] A seeded or "small" generator for a secret
> `SmallRng` and `StdRng::seed_from_u64(n)` are **predictable** — that's their purpose. If a token comes from a seeded generator, the seed is the secret, and a seed derived from the current time has maybe 30 bits of real entropy. Use `thread_rng()` or `OsRng` for anything security-relevant, and never let "I need reproducible tests" leak a seeded generator into production code. See [rand](#/ch/rand-crate).

## JSON Web Tokens

```toml
[dependencies]
jsonwebtoken = "9"
serde = { version = "1", features = ["derive"] }
```

```rust,ignore
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
struct Claims {
    sub: String,   // subject — the user id
    exp: usize,    // expiry, as a Unix timestamp. REQUIRED.
    iat: usize,    // issued at
    role: String,  // your own claims
}

fn issue(secret: &[u8], user_id: &str, role: &str) -> jsonwebtoken::errors::Result<String> {
    let now = chrono::Utc::now();
    let claims = Claims {
        sub: user_id.to_string(),
        // Short expiry. A leaked token is valid until it expires.
        exp: (now + chrono::Duration::minutes(15)).timestamp() as usize,
        iat: now.timestamp() as usize,
        role: role.to_string(),
    };
    encode(&Header::new(Algorithm::HS256), &claims, &EncodingKey::from_secret(secret))
}

fn verify(secret: &[u8], token: &str) -> jsonwebtoken::errors::Result<Claims> {
    // Validation checks the signature AND the expiry. Pin the algorithm
    // explicitly — see the warning below.
    let mut validation = Validation::new(Algorithm::HS256);
    validation.set_required_spec_claims(&["exp", "sub"]);
    decode::<Claims>(token, &DecodingKey::from_secret(secret), &validation).map(|d| d.claims)
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let secret = b"a-long-random-secret-from-the-environment";

    let token = issue(secret, "user-7", "admin")?;
    println!("token: {token}");
    println!("verified: {:?}", verify(secret, &token)?);

    // A token signed with a different key is rejected.
    println!("wrong key: {:?}", verify(b"different-secret", &token).is_err());
    Ok(())
}
```

> [!warning] Always pin the algorithm when verifying a JWT
> The `alg` field lives *inside the token*, which the attacker controls. A verifier that trusts it can be fed `alg: none` (no signature at all) or tricked into treating an RSA public key as an HMAC secret — both are classic, real JWT vulnerabilities. `Validation::new(Algorithm::HS256)` pins it, which is why `jsonwebtoken` requires you to name an algorithm rather than inferring one. Never write a verifier that reads `alg` from the token to decide how to check it.

> [!key] A JWT cannot be revoked — that's the trade-off
> The appeal of a JWT is that verification needs no database lookup. The cost is that you cannot invalidate one before it expires: a logged-out user's token still verifies, and so does a fired employee's. The standard mitigations are **short expiry** (5–15 minutes) plus a longer-lived **refresh token** that *is* stored server-side and can be revoked. If you find yourself building a token deny-list, you've reinvented sessions with extra steps — and plain server-side sessions may simply be the better design.

| Token type | Revocable | Needs a lookup | Good for |
|---|---|---|---|
| server-side session id | ✅ yes | yes | web apps; the simple, safe default |
| JWT access token | ❌ no | no | short-lived, stateless API auth |
| refresh token (stored) | ✅ yes | yes | issuing new access tokens |
| API key (hashed in the DB) | ✅ yes | yes | machine-to-machine |
| signed cookie | ❌ no | no | non-sensitive state |

## Hashing, HMAC, and encryption

```rust,ignore
use hmac::{Hmac, Mac};
use sha2::{Digest, Sha256};

type HmacSha256 = Hmac<Sha256>;

fn checksum(data: &[u8]) -> String {
    // SHA-256 for INTEGRITY (has this file changed?) — never for passwords.
    let digest = Sha256::digest(data);
    hex::encode(digest)
}

fn sign_webhook(secret: &[u8], payload: &[u8]) -> Vec<u8> {
    let mut mac = HmacSha256::new_from_slice(secret).expect("any key length is valid");
    mac.update(payload);
    mac.finalize().into_bytes().to_vec()
}

fn verify_webhook(secret: &[u8], payload: &[u8], signature: &[u8]) -> bool {
    let mut mac = HmacSha256::new_from_slice(secret).expect("valid key");
    mac.update(payload);
    // verify_slice is constant-time. Do NOT compute and compare with ==.
    mac.verify_slice(signature).is_ok()
}

fn main() {
    println!("sha256: {}", checksum(b"hello world"));

    let secret = b"webhook-signing-secret";
    let payload = br#"{"event":"payment.succeeded"}"#;
    let sig = sign_webhook(secret, payload);

    println!("valid signature:   {}", verify_webhook(secret, payload, &sig));
    println!("tampered payload:  {}", verify_webhook(secret, br#"{"event":"hacked"}"#, &sig));
}
```

| Task | Crate | Notes |
|---|---|---|
| password hashing | `argon2`, `bcrypt`, `scrypt` | deliberately slow |
| general hashing / checksums | `sha2`, `blake3` | `blake3` is much faster |
| message authentication | `hmac` + `sha2` | verify with `verify_slice`, not `==` |
| symmetric encryption | `aes-gcm`, `chacha20poly1305` | **authenticated** encryption — always AEAD |
| TLS | `rustls` | pure Rust; cross-compiles cleanly |
| signatures | `ed25519-dalek`, `ring` | |
| constant-time comparison | `subtle` | |
| zeroing memory | `zeroize` | |
| key derivation from a password | `argon2`, `hkdf` | never use the password as a key directly |

> [!warning] Never reuse a nonce with the same key
> AEAD ciphers like AES-GCM and ChaCha20-Poly1305 require a **unique** nonce per encryption under a given key. Reusing one doesn't just weaken the encryption — for GCM it can leak the authentication key and allow forgery of *any* message. Use the crate's nonce generator, or a counter you are certain never repeats (including across restarts and replicas). This is the single most common way otherwise-correct encryption code gets broken.

## Handling secrets in memory

```rust
/// A newtype that refuses to print its contents. The pattern matters more
/// than the type: Debug is derived automatically all over a codebase, and
/// `#[instrument]` captures arguments — so a plain String WILL end up in logs.
#[derive(Clone)]
struct Secret(String);

impl Secret {
    fn new(value: impl Into<String>) -> Self {
        Secret(value.into())
    }

    /// Deliberately explicit and slightly awkward to call — every use is
    /// visible in a code review.
    fn expose(&self) -> &str {
        &self.0
    }
}

// Redact in both Debug and Display, or one of them will leak.
impl std::fmt::Debug for Secret {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(f, "Secret(***)")
    }
}

impl std::fmt::Display for Secret {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(f, "***")
    }
}

#[derive(Debug)]
struct Config {
    host: String,
    api_key: Secret, // derived Debug on Config is now safe
}

fn main() {
    let config = Config {
        host: "api.example.com".into(),
        api_key: Secret::new("sk-live-abc123-very-secret"),
    };

    // The whole struct can be logged safely.
    println!("{config:?}");
    println!("{}", config.api_key);

    // Getting the real value requires saying so.
    println!("first 7 chars: {}", &config.api_key.expose()[..7]);
}
```

```toml
[dependencies]
secrecy = "0.10"     # SecretString with redacted Debug and zeroing on drop
zeroize = "1"        # overwrite memory when a value is dropped
```

> [!best] Wrap every secret in a redacting newtype from day one
> `#[derive(Debug)]` is applied reflexively, and `tracing`'s `#[instrument]` captures arguments automatically — so a `String` holding an API key will reach your log aggregator eventually, where it's retained, replicated, and searchable. A newtype with a manual `Debug` makes that structurally impossible, and the deliberately-awkward `expose()` method means every real use is greppable. `secrecy::SecretString` gives you this plus memory zeroing on drop. See [Observability](#/ch/observability).

> [!note] Zeroing memory helps less than you'd hope
> `zeroize` overwrites a secret when it's dropped, which genuinely reduces the window in a core dump or a heap-inspection attack. But it can't help once the value has been `clone()`d, moved, swapped to disk, or captured in a `String` that reallocated and left a copy behind. Treat it as defence in depth — worth using for keys, not a reason to relax anywhere else.

## The checklist

| Check | Because |
|---|---|
| passwords hashed with Argon2/bcrypt/scrypt, never SHA-256 | fast hashes are crackable at GPU speed |
| a fresh random salt per password | defeats rainbow tables and reveals nothing about reuse |
| secrets compared with `subtle::ConstantTimeEq` | `==` leaks the answer through timing |
| tokens from `thread_rng()`/`OsRng`, never a seeded generator | predictability is total compromise |
| JWT algorithm pinned when verifying | `alg: none` and key-confusion attacks |
| JWT expiry short, with revocable refresh tokens | a JWT can't be revoked |
| AEAD encryption (`aes-gcm`, `chacha20poly1305`) | unauthenticated encryption is malleable |
| never reuse a nonce with a key | catastrophic for GCM |
| secrets in a redacting newtype | `Debug` and `#[instrument]` leak by default |
| secrets from the environment, never the binary | `strings ./app` finds them |
| `rustls` over `native-tls`/OpenSSL | pure Rust, cross-compiles, smaller attack surface |
| `cargo deny check advisories` on a schedule | new CVEs land against shipped code |
| `#![forbid(unsafe_code)]` where you can | memory safety becomes compiler-enforced |
| SQL via parameters, never string formatting | injection |
| rate limiting on auth endpoints | credential stuffing and brute force |

> [!key] Most Rust security incidents are not memory bugs
> The borrow checker gives you memory safety for free, and it's easy to mistake that for security. The vulnerabilities that actually get exploited in Rust services are the same ones as everywhere else: SQL injection from `format!`-built queries, secrets in logs, missing authorization checks, tokens compared with `==`, dependencies with known advisories, and rate limits nobody added. Rust removes one large class of bug and leaves every other class untouched.

## Summary

- **Never write your own cryptography.** Every algorithm here has an audited crate.
- **Hash passwords** with **Argon2id** (or bcrypt/scrypt) and a fresh random salt each time. SHA-256 is far too fast; encryption is the wrong tool entirely.
- Compare secrets with **`subtle::ConstantTimeEq`** — `==` short-circuits and leaks the answer through timing over the network.
- Generate secrets with **`thread_rng()`/`OsRng`**; a seeded or `SmallRng` generator is predictable by design.
- **Pin the JWT algorithm** when verifying, and remember a **JWT cannot be revoked** — short expiry plus a stored refresh token, or just use server-side sessions.
- Use **AEAD** ciphers, and **never reuse a nonce** with the same key.
- Wrap secrets in a **redacting newtype** — `#[derive(Debug)]` and `#[instrument]` leak them otherwise.
- Prefer **`rustls`** to OpenSSL: pure Rust, smaller attack surface, and it cross-compiles.
- The bugs that bite Rust services are **not memory bugs** — they're injection, logging, authorization, and unpatched dependencies.

> [!exercise] Try it yourself
> 1. Hash the same password twice with `argon2` and confirm the outputs differ. Then verify both against the original plaintext.
> 2. Time the constant-time comparison above against `==` on a 32-byte secret differing at byte 0 versus byte 31, over a million iterations. Which one shows a difference?
> 3. Write a `Secret` newtype, put it in a struct with `#[derive(Debug)]`, and confirm the value never appears. Then remove the manual `Debug` and see what leaks.
> 4. Issue a JWT with a 2-second expiry, verify it, sleep 3 seconds, and verify again. What error do you get?
> 5. Sign a payload with HMAC-SHA256, then verify a tampered version. Now write the buggy version that computes the HMAC and compares with `==`, and explain the vulnerability.
> 6. Run `cargo deny check advisories` on a real project. Then check whether any dependency pulls in `openssl` rather than `rustls`.

Next: a completely different kind of crate — building interactive terminal interfaces with **ratatui**.
