# Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      PAGE LOAD                              │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    Generate/Load User ID
                    Store in localStorage
                            ↓
                    Check IndexedDB for existing data
                            ↓
                ┌───────────┴───────────┐
                ↓                       ↓
        Has Secret Key?            No Secret Key
                │                       │
                ↓                       │
        Auto-fill input field           │
        Disable input                   │
        Enable Start button             │
                │                       │
                └───────────┬───────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              USER CLICKS "USE CREDIT" CHECKBOX              │
└─────────────────────────────────────────────────────────────┘
                            ↓
                 Show Loading Indicator
                            ↓
                 Call: Check Registration API
                            ↓
                ┌───────────┴───────────┐
                ↓                       ↓
         Is Registered?            Not Registered?
                │                       │
                │                       │
    ┌───────────┴───────────┐          │
    ↓                       ↓          ↓
Show Secret Key      Already Has   ┌──────────────────┐
Input Field          Secret Key?   │  Show Register   │
    │                       │       │  Popup (Email)   │
    │                       ↓       └──────────────────┘
    │               Auto-validate           │
    │               that key                │
    │                       │               │
    └───────────┬───────────┘               │
                ↓                           ↓
        Show "Forgot Key?"          User Enters Email
        Button                              │
                                            ↓
                                    Validate Email Format
                                            │
                                            ↓
                                    Call: Register API
                                            │
                                ┌───────────┴───────────┐
                                ↓                       ↓
                            Success?                 Failed?
                                │                       │
                                ↓                       │
                        ┌──────────────┐               │
                        │ Email Sent   │               │
                        │ Confirmation │               │
                        └──────────────┘               │
                                │                       │
                                ↓                       ↓
                        Show Success:          Show Error Message
                        "Check your email"              │
                        "Key sent to [email]"           ↓
                                │                  ┌─────────────┐
                                │                  │ Show Retry  │
                                │                  │ Button      │
                                │                  └─────────────┘
                                │                       │
                                ↓                       ↓
                        Close Popup              User Clicks Retry
                        (after 2-3 sec)                 │
                                │                       ↓
                                ↓               Call: Register API again
                        Show Secret Key                 │
                        Input Field                     │
                                │                       │
                                └───────────┬───────────┘
                                            ↓
┌─────────────────────────────────────────────────────────────┐
│              USER PASTES SECRET KEY                         │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    Validate Format
                    (starts with sk_?)
                            │
                ┌───────────┴───────────┐
                ↓                       ↓
          Valid Format?           Invalid Format?
                │                       │
                ↓                       ↓
        Show Inline              Show Error:
        Loading...               "Invalid format"
                │                       │
                ↓                       ↓
        Call: Validate API       Clear Input
                │                Focus Input
    ┌───────────┴───────────┐
    ↓                       ↓
Valid Key?              Invalid Key?
    │                       │
    ↓                       ↓
Get Real User ID     Show Error:
Get Credits          "Invalid secret key"
    │                       │
    ↓                       ↓
Update IndexedDB:    Show "Forgot Key?"
- real user_id       Link
- secret_key                │
- credits                   │
    │                       ↓
    ↓               Clear Input
Update localStorage  Focus Input
Replace temp_user_id        │
    │                       │
    ↓                       │
Disable Input Field         │
Show Success Icon           │
    │                       │
    ↓                       │
Display Credits Badge       │
"X credits remaining"       │
    │                       │
    ↓                       │
Enable "Start" Button       │
    │                       │
    └───────────┬───────────┘
                ↓
┌─────────────────────────────────────────────────────────────┐
│              FORGOT KEY FLOW                                │
└─────────────────────────────────────────────────────────────┘
                ↓
        User Clicks "Forgot Key?"
                ↓
        ┌──────────────────────┐
        │ Show Forgot Key      │
        │ Popup                │
        │                      │
        │ Email: [_________]   │
        │                      │
        │ [Send New Key]       │
        │                      │
        │ Info: "Enter the     │
        │ email you used       │
        │ for registration"    │
        └──────────────────────┘
                ↓
        User Enters Email
                ↓
        Validate Email Format
                │
    ┌───────────┴───────────┐
    ↓                       ↓
Valid Email?          Invalid Email?
    │                       │
    ↓                       ↓
Call: Reset API      Show Error:
Body: {              "Invalid email"
  user_id: temp_id   Keep popup open
  email: email       Focus email input
}                           │
    │                       │
    └───────────┬───────────┘
                ↓
        ┌───────────────────┐
        │ API Response      │
        └───────────────────┘
                │
    ┌───────────┴───────────┐
    ↓                       ↓
Success?                Failed?
    │                       │
    ↓                       ↓
New Key Sent         ┌──────────────┐
    │                │ Error Types: │
    │                ├──────────────┤
    │                │ 1. Email not │
    │                │    found     │
    │                │ 2. Network   │
    │                │    error     │
    │                │ 3. Rate      │
    │                │    limited   │
    │                └──────────────┘
    │                       │
    ↓                       ↓
Show Success:        Show Error Message
"New secret key      Based on error type:
sent to [email]!"    
                     • "Email not found.
Check your inbox       Please register first"
and paste below"     
                     • "Network error.
    │                  Please try again"
    │                
    │                • "Too many attempts.
    │                  Try again in 1 hour"
    │                       │
    ↓                       ↓
Close Popup          ┌─────────────┐
(after 2-3 sec)      │ Show Retry  │
    │                │ Button      │
    │                └─────────────┘
    ↓                       │
Clear Input Field           ↓
Enable Input         User Clicks Retry
Focus Input                 │
    │                       ↓
    │                Call: Reset API again
    │                       │
    └───────────┬───────────┘
                ↓
        User Receives Email
                ↓
        User Pastes New Secret Key
                ↓
        → Goes to "Validate Key" flow above
                ↓
┌─────────────────────────────────────────────────────────────┐
│              USER CLICKS "START" BUTTON                     │
└─────────────────────────────────────────────────────────────┘
                ↓
        Get Secret Key from:
        - Input field OR
        - IndexedDB
                ↓
        Validate Secret Key exists
                │
    ┌───────────┴───────────┐
    ↓                       ↓
Has Secret Key?        No Secret Key?
    │                       │
    ↓                       ↓
Disable Button       Show Error:
"Processing..."      "Enter secret key first"
    │                       │
    ↓                       ↓
Make API Call        Stay on current screen
Headers: {                  │
  X-Secret-Key: key         │
}                           │
    │                       │
    ↓                       │
┌─────────────────┐         │
│  API Response   │         │
└─────────────────┘         │
        │                   │
    ┌───┴───────────────────┴─┐
    ↓               ↓         ↓
Success?        Auth Error? Credit Error?
    │               │         │
    ↓               ↓         ↓
Get Result    Status 401  Status 402
Credits: X    "Invalid    "Insufficient
    │         secret key"  credits"
    ↓               │         │
Update            Clear     Show Error:
IndexedDB:        All Data  "No credits
- credits         │         remaining.
- last_used       ↓         Purchase more"
    │         Show Error:       │
    ↓         "Re-authenticate  ↓
Update        required"     Disable Button
UI Badge          │         Show link to
"X credits        ↓         purchase credits
remaining"    Enable Input      │
    │         Clear Secret      │
    ↓         Show Checkbox     │
Display       Uncheck box       │
Results           │             │
    │             │             │
    └─────────────┴─────────────┘
                  ↓
          Enable Start Button
          "Start" (ready again)
                  │
                  ↓
        ┌─────────────────┐
        │ If credits = 0: │
        │ - Show warning  │
        │ - Disable Start │
        │ - Show "Buy"    │
        └─────────────────┘
```

---

## 🔄 Retry Flow Details

### **Registration Email Retry**
```
Registration API Call
        ↓
    ┌───────┴───────┐
    ↓               ↓
Success          Failed
    │               │
    │               ↓
    │         Show Error Message
    │               ↓
    │         ┌──────────────────┐
    │         │  Error UI:       │
    │         │  ✗ [Error text]  │
    │         │  [Retry Button]  │
    │         │  [Close Button]  │
    │         └──────────────────┘
    │               │
    │         ┌─────┴─────┐
    │         ↓           ↓
    │     Retry?       Close?
    │         │           │
    │         ↓           ↓
    │   Same email    Close popup
    │   → API Call    Return to
    │         │        main screen
    │         │           │
    └─────────┴───────────┘
```

### **Forgot Key Email Retry**
```
Reset API Call
        ↓
    ┌───────┴───────┐
    ↓               ↓
Success          Failed
    │               │
    │               ↓
    │         Check Error Type
    │               │
    │         ┌─────┴─────────────┐
    │         ↓                   ↓
    │   Network/Server      Email Not Found
    │   Error                     │
    │         │                   ↓
    │         ↓             Show Error:
    │   ┌──────────────┐   "Email not registered"
    │   │  Error UI:   │         │
    │   │  ✗ Failed    │         ↓
    │   │  [Retry]     │   ┌──────────────┐
    │   │  [Close]     │   │ [Register]   │
    │   └──────────────┘   │ [Close]      │
    │         │             └──────────────┘
    │    ┌────┴────┐              │
    │    ↓         ↓              ↓
    │  Retry?   Close?      Register?
    │    │         │              │
    │    ↓         ↓              ↓
    │  Same     Close        Open Register
    │  email    popup        Popup
    │    │         │              │
    └────┴─────────┴──────────────┘
```

---

## 📊 Error Handling States

### **Registration Errors**
```
┌──────────────────────────────────────┐
│ Error Type       │ User Action       │
├──────────────────┼───────────────────┤
│ Network Error    │ Retry available   │
│ Server Error     │ Retry available   │
│ Invalid Email    │ Fix + retry       │
│ Email Exists     │ Show "Use Forgot  │
│                  │ Key instead"      │
│ Rate Limited     │ Show wait time    │
│                  │ No retry for 1hr  │
└──────────────────────────────────────┘
```

### **Forgot Key Errors**
```
┌──────────────────────────────────────┐
│ Error Type       │ User Action       │
├──────────────────┼───────────────────┤
│ Network Error    │ Retry available   │
│ Server Error     │ Retry available   │
│ Email Not Found  │ Show Register btn │
│ Invalid Email    │ Fix + retry       │
│ Rate Limited     │ Show wait time    │
│                  │ No retry for 1hr  │
└──────────────────────────────────────┘
```

---

## 🎯 Key Flow Improvements

### **1. Email Delivery Confirmation**
```
After Registration/Reset:
    ↓
Show Success Message:
"✓ Email sent to [email]"
    ↓
Show Info Box:
┌────────────────────────────┐
│ • Check your inbox         │
│ • Check spam folder        │
│ • Email may take 1-2 mins  │
│                            │
│ Didn't receive?            │
│ [Resend Email]             │
└────────────────────────────┘
```

### **2. Resend Email Flow**
```
User Clicks "Resend Email"
    ↓
Check Last Send Time
    │
┌───┴───────────┐
↓               ↓
< 60 seconds?  > 60 seconds?
    │               │
    ↓               ↓
Show Message:  Call API again
"Please wait   Same endpoint
60 seconds"    Same email
    │               │
    ↓               ↓
Show Timer:    Show Success
"Resend in     Update timer
XX seconds"    
    │               │
    └───────┬───────┘
            ↓
    Enable Resend after timer
```

### **3. Multiple Retry Attempts Tracking**
```
Attempt 1: Immediate retry available
    ↓
Attempt 2: Immediate retry available
    ↓
Attempt 3: Show warning
    ↓
    "Multiple failures detected"
    "Check your email/internet"
    [Try Again] [Contact Support]
    ↓
Attempt 4+: Rate limited by backend
    ↓
    "Too many attempts"
    "Try again in 1 hour"
    [OK]
```

---

## 🔔 User Feedback Messages

### **Success Messages**
```
Registration Success:
"✓ Registration successful!"
"Secret key sent to [email]"
"Check your inbox and paste below"

Reset Success:
"✓ New secret key sent!"
"Check [email] for your new key"

Validation Success:
"✓ Authenticated successfully!"
"[X] credits remaining"
```

### **Error Messages with Actions**
```
Network Error:
"✗ Connection failed"
"Check your internet and try again"
[Retry]

Email Not Found:
"✗ Email not registered"
"Please register first or check your email"
[Register] [Try Again]

Rate Limited:
"✗ Too many attempts"
"Please wait 60 minutes before trying again"
"Next attempt available at: [TIME]"
[OK]

Invalid Format:
"✗ Invalid secret key format"
"Key should start with 'sk_'"
[OK]
```

---

## 📱 UI State Transitions

```
State: INITIAL
    ↓ (checkbox checked)
State: LOADING
    ↓ (API response)
┌───────┴────────┐
↓                ↓
State:         State:
REGISTERED     NOT_REGISTERED
    ↓                ↓
State:         State:
INPUT_KEY      SHOW_REGISTER_POPUP
    ↓                ↓
State:         State:
VALIDATING     REGISTERING
    ↓                ↓
┌───┴────┐     ┌─────┴──────┐
↓        ↓     ↓            ↓
State:  State: State:       State:
VALID   ERROR  EMAIL_SENT   ERROR
    ↓        ↓     ↓            ↓
State:  State: State:       State:
READY   RETRY  WAIT_KEY     RETRY
```