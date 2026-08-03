"use client";

import { useMemo, useState } from "react";
import {
  isLikelyMobileBrowser,
  isShareCancellation,
  receiptShareMessage,
  whatsappShareUrl,
} from "@/lib/receipt-sharing";

function downloadFile(file: File) {
  const objectUrl = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = file.name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
}

export function ShareReceiptButton({
  paymentId,
  receiptNumber,
  familyName,
  amount,
  phone,
}: {
  paymentId: string;
  receiptNumber: string;
  familyName: string;
  amount: string;
  phone?: string | null;
}) {
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);
  const [preparedFile, setPreparedFile] = useState<File | null>(null);
  const [showWhatsAppLink, setShowWhatsAppLink] = useState(false);
  const message = useMemo(
    () => receiptShareMessage(receiptNumber, familyName, amount),
    [amount, familyName, receiptNumber],
  );
  const whatsappHref = useMemo(
    () => whatsappShareUrl(message, phone),
    [message, phone],
  );

  async function audit(method: "native_file_share" | "whatsapp_fallback") {
    const response = await fetch(`/api/receipts/${paymentId}/share`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ method }),
    });
    if (!response.ok) {
      throw new Error(
        response.status === 401
          ? "Authentication required."
          : "Could not record share initiation.",
      );
    }
  }

  function enableFallback(file: File, reason?: string) {
    downloadFile(file);
    setShowWhatsAppLink(true);
    setStatus(
      reason
        ? `${reason} The PDF was downloaded. Open WhatsApp below and attach the downloaded file.`
        : "The PDF was downloaded. Open WhatsApp below and attach the downloaded file before sending.",
    );
    void audit("whatsapp_fallback").catch(() => {
      setStatus((current) => `${current} Share auditing could not be recorded.`);
    });
  }

  async function prepareReceipt() {
    setPending(true);
    setStatus("Preparing receipt PDF…");
    setShowWhatsAppLink(false);
    try {
      const response = await fetch(`/api/receipts/${paymentId}?layout=a5`);
      if (!response.ok) {
        throw new Error(
          response.status === 401
            ? "Authentication required."
            : response.status === 404
              ? "Receipt not found."
              : "Could not download receipt.",
        );
      }
      const blob = await response.blob();
      if (!blob.type.includes("pdf")) {
        throw new Error("The receipt response was not a PDF.");
      }

      const file = new File([blob], `${receiptNumber}.pdf`, {
        type: "application/pdf",
      });
      setPreparedFile(file);

      const mobile = isLikelyMobileBrowser(navigator.userAgent);
      const nativeFileShare = Boolean(
        mobile &&
        navigator.share &&
        navigator.canShare?.({ files: [file] }),
      );

      if (nativeFileShare) {
        setStatus("Receipt ready. Click “Open phone share sheet” to choose WhatsApp and send the PDF.");
      } else {
        enableFallback(file);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to prepare receipt.");
    } finally {
      setPending(false);
    }
  }

  async function openNativeShare() {
    if (!preparedFile || !navigator.share) {
      await prepareReceipt();
      return;
    }

    // Do not await the audit request before navigator.share: awaiting would consume
    // the browser's transient user activation and cause NotAllowedError.
    void audit("native_file_share").catch(() => undefined);
    try {
      await navigator.share({
        files: [preparedFile],
        title: `Receipt ${receiptNumber}`,
        text: `IPSM receipt for ${familyName}, ${amount}.`,
      });
      setStatus("The phone share sheet closed. Delivery is only complete after WhatsApp confirms sending.");
    } catch (error) {
      if (isShareCancellation(error)) {
        setStatus("Sharing cancelled.");
        return;
      }
      enableFallback(preparedFile, "The native share was unavailable.");
    }
  }

  const mobileNativeReady = Boolean(
    preparedFile &&
    typeof navigator !== "undefined" &&
    isLikelyMobileBrowser(navigator.userAgent) &&
    navigator.share &&
    navigator.canShare?.({ files: [preparedFile] }),
  );

  return (
    <span className="inline-flex max-w-md flex-col items-start gap-2">
      <button
        type="button"
        onClick={mobileNativeReady ? openNativeShare : prepareReceipt}
        disabled={pending}
        className="rounded border border-emerald-600 px-4 py-2 font-medium text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending
          ? "Preparing WhatsApp share…"
          : mobileNativeReady
            ? "Open phone share sheet"
            : "Share via WhatsApp"}
      </button>

      {showWhatsAppLink ? (
        <a
          className="rounded bg-emerald-600 px-4 py-2 text-sm font-bold text-white"
          href={whatsappHref}
          target="_blank"
          rel="noreferrer"
        >
          Open WhatsApp message
        </a>
      ) : null}

      {status ? (
        <span role="status" className="text-xs text-muted-foreground">
          {status}
        </span>
      ) : null}
    </span>
  );
}
