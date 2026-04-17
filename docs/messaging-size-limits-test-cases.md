# Messaging size-limit test cases (Twilio 30019 prevention)

Use these to manually exercise the **preflight** logic (encoding, segments, media count/size thresholds) and to simulate carrier-size failures (Twilio error **30019**).

## Quick notes

- **GSM-7 vs UCS-2**: emojis, accented characters, and non‑Latin alphabets trigger **UCS-2** and dramatically reduce per-segment capacity.
- **Best deliverability**: keep SMS under ~**320 chars** (≈2 segments) and keep MMS attachments small (recommended **300–600 KB** each).

## Text-only cases (copy/paste)

### 1) SAFE: short GSM-7

```
Hi! Just confirming your appointment for tomorrow at 9am.
```

Expected: SAFE (GSM-7, 1 segment)

### 2) WARNING: UCS-2 due to emoji

```
Hi 😊 Just confirming your appointment for tomorrow at 9am.
```

Expected: WARNING (UCS-2 detected)

### 3) WARNING: long GSM-7 (>320 chars)

Paste the following and then add a little extra if needed:

```
This is a long confirmation message to validate segment counting and warning thresholds. Please read carefully: we are confirming your cleaning appointment for tomorrow morning. If you need to reschedule, reply with a new date and time. If you have a gate code, please send it. Thank you for choosing us!
```

Expected: WARNING once you cross ~320 characters total.

### 4) BLOCK: >6 segments (GSM-7)

Send a message consisting of **1071** "a" characters (that’s 7 GSM-7 segments at 153/segment).

PowerShell generator:

```powershell
$msg = "a" * 1071
$msg.Length
$msg
```

Expected: BLOCK (segments > 6)

### 5) UCS-2 long / segment growth

Send **300** emoji characters:

```powershell
$msg = "😀" * 300
$msg.Length
$msg
```

Expected: WARNING or BLOCK depending on segment threshold (UCS-2, many segments).

## MMS attachment cases (you’ll need sample files)

These tests depend on the file sizes you upload in the UI.

### Recommended local files to prepare

- **small.jpg**: ~200 KB (SAFE)
- **medium.jpg**: ~450 KB (WARNING)
- **large.jpg**: ~750 KB (BLOCK)
- **doc.pdf**: ~300 KB (WARNING for non-image)
- **big.pdf**: ~450 KB (BLOCK for non-image)

You can create dummy files in PowerShell to hit a size target (these won’t be valid images, but are useful for testing size thresholds if your upload pipeline allows them):

```powershell
# 200 KB
fsutil file createnew small.jpg 204800

# 450 KB
fsutil file createnew medium.jpg 460800

# 750 KB
fsutil file createnew large.jpg 768000

# 300 KB
fsutil file createnew doc.pdf 307200

# 450 KB
fsutil file createnew big.pdf 460800
```

If your upload pipeline validates image headers, use real images (e.g. export from an editor) and check sizes in File Explorer.

### 6) SAFE: single small image (<=300 KB)

- Body: empty or short text
- Attach: `small.jpg`

Expected: SAFE

### 7) WARNING: medium image (301–600 KB)

- Attach: `medium.jpg` (~450 KB)

Expected: WARNING (“Large image … may fail”)

### 8) BLOCK: large image (>600 KB)

- Attach: `large.jpg` (~750 KB)

Expected: BLOCK (“Image is too large …”)

### 9) WARNING/BLOCK by attachment count

- Attach **2 images**: WARNING (multiple attachments)
- Attach **4 images**: BLOCK (too many attachments)

Expected: WARNING at 2–3, BLOCK at 4+

### 10) BLOCK by total attachment size (>1000 KB)

- Attach enough media so the total exceeds ~1 MB.
  - Example: 3 images of ~400 KB each.

Expected: BLOCK (“Total attachment size is too large.”)

## Simulating Twilio error 30019 locally

If you can trigger it naturally, great (carrier-dependent). Otherwise, to test the UX flow, add a temporary dev-only toggle to throw a fake Twilio error with `code: 30019` from your transport boundary.

Example error object shape:

```js
{
  code: 30019,
  status: 400,
  message: "Content size exceeds carrier limit",
  moreInfo: "https://www.twilio.com/docs/errors/30019"
}
```

