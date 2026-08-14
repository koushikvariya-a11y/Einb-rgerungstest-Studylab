# Security Specification: Firebase Rules and Data Invariants

## 1. Data Invariants
- **Identity Invariant**: A user's profile and attempts can only be read, created, updated, or deleted by the authenticated user whose `request.auth.uid` matches the `{userId}` in the document path (`/users/{userId}`). No cross-user access is permitted.
- **Verification Invariant**: Users must be authenticated and email verified (where applicable / standard) before performing writes, or at least authenticated dynamically via popup.
- **Id Integrity**: Document IDs must be valid alphanumeric strings/hashes under `isValidId()` to prevent path poisoning or Denial of Wallet attacks.
- **Schema and Type Invariant**: All profile updates and attempt updates must strictly adhere to the expected property types (e.g., boolean `isCorrect`, numeric `practiceIndex`), and have exact mandatory fields on creation. Correct server temporal alignment must be forced for timestamps where possible.

---

## 2. The "Dirty Dozen" Payloads (Threat Matrix)

### Threat 1: Identity Spoofing (Create profile as someone else)
- **Path**: `/users/attacker_uid`
- **Authenticated User**: `victim_uid`
- **Payload**: `{"userId": "victim_uid", "selectedState": "Berlin", "practiceIndex": 0, "updatedAt": "request.time"}`
- **Expected Outcome**: `PERMISSION_DENIED`

### Threat 2: Auth Bypass (Write profile when unauthenticated)
- **Path**: `/users/victim_uid`
- **Authenticated User**: Unauthenticated (`request.auth == null`)
- **Payload**: `{"userId": "victim_uid", "selectedState": "Bayern", "practiceIndex": 12, "updatedAt": "request.time"}`
- **Expected Outcome**: `PERMISSION_DENIED`

### Threat 3: Data Integrity Violations (Profile practiceIndex type poison)
- **Path**: `/users/victim_uid`
- **Authenticated User**: `victim_uid`
- **Payload**: `{"userId": "victim_uid", "selectedState": "Bayern", "practiceIndex": "eleven", "updatedAt": "request.time"}`
- **Expected Outcome**: `PERMISSION_DENIED`

### Threat 4: Shadow Update / Ghost Fields (Profile update with unauthorized fields)
- **Path**: `/users/victim_uid`
- **Authenticated User**: `victim_uid`
- **Payload**: `{"userId": "victim_uid", "selectedState": "Bayern", "practiceIndex": 12, "updatedAt": "request.time", "isAdminRole": true}`
- **Expected Outcome**: `PERMISSION_DENIED`

### Threat 5: Immutable Fields Mutation (Change userId after creation)
- **Path**: `/users/victim_uid`
- **Authenticated User**: `victim_uid`
- **Existing Document**: `{"userId": "victim_uid", "selectedState": "Bayern", "practiceIndex": 12, "updatedAt": "someTime"}`
- **Incoming Payload**: `{"userId": "attacker_uid", "selectedState": "Bayern", "practiceIndex": 15, "updatedAt": "request.time"}`
- **Expected Outcome**: `PERMISSION_DENIED`

### Threat 6: Missing Mandatories on Profile Create
- **Path**: `/users/victim_uid`
- **Authenticated User**: `victim_uid`
- **Payload**: `{"userId": "victim_uid", "selectedState": "Berlin"}` (missing `practiceIndex` and `updatedAt`)
- **Expected Outcome**: `PERMISSION_DENIED`

### Threat 7: Path Poisoning (Create profile with huge or malicious path symbol)
- **Path**: `/users/a_very_long_path_id_poisoning_payload_containing_special_chars_$$$`
- **Authenticated User**: `victim_uid`
- **Payload**: `{"userId": "victim_uid", "selectedState": "Bayern", "practiceIndex": 1, "updatedAt": "request.time"}`
- **Expected Outcome**: `PERMISSION_DENIED`

### Threat 8: Cross-User Attempt Snooping (Read someone else's attempts)
- **Path**: `/users/victim_uid/attempts/q1`
- **Authenticated User**: `attacker_uid`
- **Expected Outcome**: `PERMISSION_DENIED`

### Threat 9: Attempt Identity Fraud (Create attempt in victim's subcollection)
- **Path**: `/users/victim_uid/attempts/q10`
- **Authenticated User**: `attacker_uid`
- **Payload**: `{"questionId": 10, "selectedIdx": 2, "isCorrect": true, "timestamp": "request.time"}`
- **Expected Outcome**: `PERMISSION_DENIED`

### Threat 10: Type Poisoning in Attempt (Boolean as string)
- **Path**: `/users/victim_uid/attempts/q15`
- **Authenticated User**: `victim_uid`
- **Payload**: `{"questionId": 15, "selectedIdx": 1, "isCorrect": "yes", "timestamp": "request.time"}`
- **Expected Outcome**: `PERMISSION_DENIED`

### Threat 11: Range Violation in Attempt (Negative Index)
- **Path**: `/users/victim_uid/attempts/q20`
- **Authenticated User**: `victim_uid`
- **Payload**: `{"questionId": 20, "selectedIdx": -5, "isCorrect": false, "timestamp": "request.time"}`
- **Expected Outcome**: `PERMISSION_DENIED`

### Threat 12: Anonymous blanket attempts scanning (Insecure query)
- **Path**: `/users/victim_uid/attempts`
- **Authenticated User**: Unauthenticated
- **Expected Outcome**: `PERMISSION_DENIED`

---

## 3. Test Runner Outline & Execution
Testing rules via local emulation or unit tests confirms rule security mathematically. Standard firestore tests will run inside our app setup and error boundaries on client runtime checks.
