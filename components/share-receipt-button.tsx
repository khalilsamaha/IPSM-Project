"use client";

import { useState } from "react";
import {
  isShareCancellation,
  receiptShareMessage,
  whatsappShareUrl,
} from "@/lib/receipt-sharing";

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

  async function audit(method: string) {
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

  async function share() {
    if (pending) return;
    setPending(true);
    setStatus("Preparing receipt PDF…");
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
      const message = receiptShareMessage(receiptNumber, familyName, amount);

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await audit("native_file_share");
        try {
          await navigator.share({
            files: [file],
            title: `Receipt ${receiptNumber}`,
            text: message,
          });
          setStatus(
            "Share sheet closed. Select WhatsApp and confirm the recipient to complete delivery.",
          );
        } catch (error) {
          setStatus(
            isShareCancellation(error)
              ? "Sharing cancelled."
              : "The native share failed. Please try again.",
          );
        }
        return;
      }

      const objectUrl = URL.createObjectURL(file);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = file.name;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);

      await audit("whatsapp_fallback");
      const popup = window.open(
        whatsappShareUrl(message, phone),
        "_blank",
        "noopener,noreferrer",
      );
      setStatus(
        popup
          ? "The PDF was downloaded and WhatsApp opened. Attach the downloaded PDF before sending."
          : "The PDF was downloaded, but the WhatsApp popup was blocked.",
      );
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Unable to share receipt.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={share}
        disabled={pending}
        className="rounded border border-emerald-600 px-4 py-2 font-medium text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Preparing WhatsApp share…" : "Share via WhatsApp"}
      </button>
      {status ? (
        <span
          role="status"
          className="max-w-sm text-xs text-muted-foreground"
        >
          {status}
        </span>
      ) : null}
    </span>
  );
}
