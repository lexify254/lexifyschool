import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProjectInquiryAction } from "@/components/projects/ProjectInquiryAction";
import styles from "@/components/projects/store.module.css";
import {
  buildProjectInquiryMessage,
  formatProjectPrice,
  getProjectPriceKes,
} from "@/lib/data/projects";
import { getPublishedProduct } from "@/lib/data/public-catalogue";
import { whatsappHref } from "@/lib/whatsapp/links";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getPublishedProduct(slug);
  if (!product) {
    return {
      title: "Resource not found",
      robots: { index: false, follow: false },
    };
  }
  const title = String(product.title || "Digital resource");
  const description = String(
    product.short_description ||
      product.description ||
      `View published information about ${title} on the Lexify School projects store.`
  ).slice(0, 155);
  const origin = process.env.NEXT_PUBLIC_SITE_URL;
  const path = `/projects/${encodeURIComponent(slug)}`;
  const canonical = origin ? new URL(path, origin).toString() : undefined;
  const image = product.cover_image_url
    ? [String(product.cover_image_url)]
    : undefined;

  return {
    title,
    description,
    alternates: canonical ? { canonical } : undefined,
    openGraph: {
      type: "website",
      title: `${title} | Lexify School`,
      description,
      url: canonical,
      images: image,
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | Lexify School`,
      description,
      images: image,
    },
  };
}

function listedValue(value: unknown): string {
  return typeof value === "string" && value.trim() ? value : "Not listed";
}

export default async function ProjectDetailPage({ params }: Props) {
  const { slug } = await params;
  const product = await getPublishedProduct(slug);
  if (!product) notFound();

  const title = String(product.title || "Digital resource");
  const code = String(product.code || slug);
  const description = String(
    product.short_description ||
      product.description ||
      "No additional description has been published."
  );
  const fileTypes = Array.isArray(product.file_types)
    ? (product.file_types as unknown[]).map(String).join(", ") || "Not listed"
    : "Not listed";
  const software = product.software_name
    ? `${String(product.software_name)}${product.software_version ? ` ${String(product.software_version)}` : ""}`
    : "Not listed";
  const now = new Date();
  const listedPrice = formatProjectPrice(product, now);
  const currentPriceKes = getProjectPriceKes(product, now);
  const contactAvailable = Boolean(
    whatsappHref(
      process.env.WHATSAPP_ADMIN_NUMBER,
      buildProjectInquiryMessage({ code, title, listedPrice })
    )
  );

  return (
    <main className="page-content">
      <div className="container">
        <p className="breadcrumb">
          <Link href="/projects">Projects store</Link>{" "}
          <span aria-hidden="true">/</span> {title}
        </p>

        <section className={styles.detailLayout}>
          <div className={styles.detailMedia}>
            {product.preview_url ? (
              <img
                src={String(product.preview_url)}
                alt={`Preview of ${title}`}
              />
            ) : product.cover_image_url ? (
              <img
                src={String(product.cover_image_url)}
                alt={`${title} cover`}
              />
            ) : (
              <div className={styles.detailPlaceholder} aria-hidden="true">
                Lexify resource
              </div>
            )}
          </div>

          <div className={styles.detailCopy}>
            <span className="section-kicker">Published digital resource</span>
            <h1>{title}</h1>
            <p className={styles.detailDescription}>{description}</p>
            <p className={styles.detailPrice}>
              <span className="sr-only">Current listed price: </span>
              {listedPrice}
            </p>

            <dl className={styles.detailsList}>
              <dt>Software</dt>
              <dd>{software}</dd>
              <dt>File types</dt>
              <dd>{fileTypes}</dd>
              <dt>Difficulty</dt>
              <dd>{listedValue(product.difficulty)}</dd>
              <dt>Licence</dt>
              <dd>{listedValue(product.licence_type)}</dd>
              <dt>Listing code</dt>
              <dd>{code}</dd>
            </dl>

            <p className={styles.inquiryNote}>
              {product.is_free === true
                ? "The published listing marks this resource as free; ask the team to confirm availability and how access is arranged."
                : `The current listed amount is ${listedPrice}. It is informational only and is not a completed order or payment.`}
            </p>

            <section
              className={styles.inquiry}
              aria-labelledby="project-inquiry-title"
            >
              <h2 id="project-inquiry-title">Ask about this resource</h2>
              <p>
                Contact Lexify School about availability, the current listed
                price, licence terms or possible delivery arrangements.
              </p>
              <ProjectInquiryAction
                productId={String(product.id)}
                contactAvailable={contactAvailable}
              />
            </section>
          </div>
        </section>

        <section
          className={styles.inquiry}
          aria-labelledby="listing-info-title"
        >
          <h2 id="listing-info-title">About this listing</h2>
          <p>
            This page displays published catalogue information only. A WhatsApp
            conversation is an enquiry; it does not confirm availability or
            create download access. Confirm any terms directly with the seller;
            digital files remain private until an access grant is issued.
          </p>
        </section>
      </div>
      <span className="sr-only">
        Current listed price in KES: {currentPriceKes}
      </span>
    </main>
  );
}
