import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedProduct } from "@/lib/data/public-catalogue";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };
const money = (amount: unknown) => new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(Number(amount) || 0);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getPublishedProduct(slug);
  if (!product) return { title: "Resource not found", robots: { index: false, follow: false } };
  const title = String(product.title);
  const description = String(product.short_description || product.description || `View ${title} on the Lexify School projects store.`).slice(0, 155);
  const origin = process.env.NEXT_PUBLIC_SITE_URL;
  const path = `/projects/${encodeURIComponent(slug)}`;
  return { title, description, alternates: origin ? { canonical: new URL(path, origin).toString() } : undefined, openGraph: { type: "website", title: `${title} | Lexify School`, description, url: origin ? new URL(path, origin).toString() : undefined, images: product.cover_image_url ? [{ url: String(product.cover_image_url) }] : undefined }, twitter: { card: "summary_large_image", title: `${title} | Lexify School`, description, images: product.cover_image_url ? [String(product.cover_image_url)] : undefined } };
}

export default async function ProjectDetailPage({ params }: Props) {
  const { slug } = await params;
  const product = await getPublishedProduct(slug);
  if (!product) notFound();
  const saleActive = product.sale_price_kes != null && (!product.sale_starts_at || new Date(String(product.sale_starts_at)) <= new Date()) && (!product.sale_ends_at || new Date(String(product.sale_ends_at)) >= new Date());
  const price = product.is_free ? "Free" : money(saleActive ? product.sale_price_kes : product.price_kes);
  return <main className="page-content"><div className="container">
    <p className="breadcrumb"><Link href="/projects">Projects store</Link> <span aria-hidden="true">/</span> {String(product.title)}</p>
    <section className="product-detail">
      <div className="product-detail__media">{product.preview_url ? <img src={String(product.preview_url)} alt={`Watermarked preview of ${String(product.title)}`} /> : product.cover_image_url ? <img src={String(product.cover_image_url)} alt={`${String(product.title)} cover`} /> : <div className="product-detail__placeholder" aria-hidden="true">Lexify Resource</div>}</div>
      <div className="product-detail__copy"><span className="section-kicker">Digital resource</span><h1>{String(product.title)}</h1><p>{String(product.short_description || product.description || "No additional description has been published.")}</p>
        <p className="product-detail__price">{price}</p>
        <dl className="details-list">{product.software_name ? <><dt>Software</dt><dd>{String(product.software_name)}{product.software_version ? ` ${String(product.software_version)}` : ""}</dd></> : null}{Array.isArray(product.file_types) && product.file_types.length ? <><dt>File types</dt><dd>{(product.file_types as string[]).join(", ")}</dd></> : null}{product.difficulty ? <><dt>Difficulty</dt><dd>{String(product.difficulty)}</dd></> : null}{product.licence_type ? <><dt>Licence</dt><dd>{String(product.licence_type)}</dd></> : null}{typeof product.access_days === "number" ? <><dt>Access period</dt><dd>{product.access_days} days</dd></> : null}{typeof product.download_limit === "number" ? <><dt>Download limit</dt><dd>{product.download_limit}</dd></> : null}</dl>
        <Link className="button button--gold" href={`/login?next=${encodeURIComponent(`/projects/${slug}`)}`}>{product.is_free ? "Sign in to download" : "Sign in to purchase"}</Link><p className="muted">The original project file is kept private. Eligible purchasers receive a limited, expiring download link after payment verification.</p>
      </div>
    </section>
    <section className="section-block"><h2 className="section-title">Before you buy</h2><ul className="content-list"><li>Check the listed software and version requirements.</li><li>Review the published licence and permitted use.</li><li>Project files are scanned before publication; macro-enabled files display an additional safety warning.</li><li>Downloads are limited to the purchased entitlement and expire according to the published access rules.</li></ul></section>
  </div></main>;
}
