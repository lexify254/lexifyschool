import { whatsappHref } from "@/lib/whatsapp/links";
import { buildProjectInquiryMessage } from "@/lib/data/projects";
import styles from "./store.module.css";

type Props = {
  code: string;
  title: string;
  listedPrice: string;
};

export function ProjectInquiryAction({ code, title, listedPrice }: Props) {
  const href = whatsappHref(
    process.env.WHATSAPP_ADMIN_NUMBER,
    buildProjectInquiryMessage({ code, title, listedPrice })
  );

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
        or grant download access. Confirm availability, price, licence terms
        and any delivery arrangements directly with the seller.
      </p>
    </div>
  );
}
