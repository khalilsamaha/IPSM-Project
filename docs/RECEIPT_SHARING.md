# Receipt sharing

Sharing is always initiated by a user click on a payment receipt. The client fetches the authenticated A5 PDF, validates that it is a PDF `File`, and uses Web Share only when the browser reports file support. The share sheet receives the file and concise receipt context. Cancellation is reported as cancellation—not delivery.

Otherwise the PDF is downloaded and a generic WhatsApp text share is opened. WhatsApp cannot attach that local download automatically, so the message explicitly asks the operator to attach it. No family telephone number is targeted and no message is sent automatically.

The initiation endpoint records `receipt_share_initiated`, actor, timestamp, payment ID, receipt number and `native_file_share` or `whatsapp_fallback`. WhatsApp initiation also sets `sharedByWhatsappAt`; this means initiated, never confirmed delivery. Existing email and download workflows remain available.
