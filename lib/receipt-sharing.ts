export function receiptShareMessage(receiptNumber:string,familyName:string,amount:string){return `IPSM Music School receipt ${receiptNumber}\nFamily: ${familyName}\nAmount: ${amount}\n\nThe receipt PDF has been downloaded. Please attach it to this WhatsApp message.`}
export function whatsappShareUrl(message:string){return `https://wa.me/?text=${encodeURIComponent(message)}`}
export function isShareCancellation(error:unknown){return error instanceof DOMException&&error.name==="AbortError"}
