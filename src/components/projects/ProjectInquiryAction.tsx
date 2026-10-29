import { buildWhatsAppHandoffHref } from "@/lib/whatsapp/handoff";
import styles from "./store.module.css";

type Props = {
  productId: string;
  contactAvailable: boolean;
};

export function ProjectInquiryAction({ productId, contactAvailable }: Props) {
  const href = contactAvailable
    ? buildWhatsAppHandoffHref("product", productId)
    : null;

  return (
    <div>
      {href ? (
        <a
          className="button button--gold"
          href={href}
          target="_blank"
          rel="noopener noreferrer"
        >
          Ask the seller on WhatsApp
        </a>
      ) : (
        <p className={styles.inquiryUnavailable} role="status">
          WhatsApp enquiries are temporarily unavailable. Contact options and
          downloads are not available from this page.
        </p>
      )}
      <p className={styles.inquiryNote}>
        This opens an enquiry only. A chat does not confirm a sale or payment,
        or grant download access. Confirm availability, price, licence terms and
        any delivery arrangements directly with the seller.
      </p>
    </div>
  );
}
