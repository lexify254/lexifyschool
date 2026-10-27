import type { Metadata } from "next";
import Link from "next/link";
import { listPublishedProducts } from "@/lib/data/public-catalogue";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Projects and Digital Resources",
  description: "Browse published Lexify School computer projects and digital learning resources.",
  openGraph: { type: "website", title: "Projects Store | Lexify School", description: "Explore reviewed digital learning resources and computer projects." },
  twitter: { card: "summary_large_image", title: "Projects Store | Lexify School", description: "Explore published computer projects and resources." },
};
type Search = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const money = (amount: unknown) => new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(Number(amount) || 0);

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const q = first(params.q) ?? "";
  const software = first(params.software) ?? "";
  const difficulty = first(params.difficulty) ?? "";
  const max = Number(first(params.maxPrice) ?? "");
  const freeOnly = first(params.free) === "on";
  const products = await listPublishedProducts({ q, software, difficulty, maxPrice: Number.isFinite(max) && max > 0 ? max : undefined, freeOnly });
  return <>
    <section className="page-hero"><div className="container"><span className="section-kicker">Lexify projects store</span><h1>Practical projects and useful digital resources</h1><p>Browse administrator-reviewed resources with clear software requirements, file types, licences and access details. Paid files are delivered through a signed, expiring download after a verified purchase.</p></div></section>
    <main className="page-content"><div className="container">
      <form action="/projects" className="filter-panel" method="get" aria-label="Filter digital resources">
        <label className="filter-control"><span>Search</span><input name="q" defaultValue={q} placeholder="Title or description" maxLength={80} /></label>
        <label className="filter-control"><span>Software</span><input name="software" defaultValue={software} placeholder="For example, Word" maxLength={60} /></label>
        <label className="filter-control"><span>Difficulty</span><select name="difficulty" defaultValue={difficulty}><option value="">Any difficulty</option><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label>
        <label className="filter-control"><span>Maximum price (KES)</span><input name="maxPrice" type="number" min="1" step="50" defaultValue={max || ""} placeholder="Any" /></label>
        <label className="filter-check"><input name="free" type="checkbox" defaultChecked={freeOnly} /><span>Free resources only</span></label>
        <button className="button button--blue" type="submit">Apply filters</button><Link className="button button--line" href="/projects">Clear</Link>
      </form>
      <div className="catalogue-heading"><h2>Published resources</h2><p>{products.length} currently available</p></div>
      {products.length ? <div className="card-grid">{products.map((product) => <article className="catalogue-card" key={String(product.id)}>
        {product.cover_image_url ? <img className="catalogue-card__image" src={String(product.cover_image_url)} alt={`${String(product.title)} cover`} loading="lazy" /> : <div className="catalogue-card__icon" aria-hidden="true">▤</div>}
        {product.featured ? <span className="featured-pill">Featured</span> : null}<h3>{String(product.title)}</h3><p>{String(product.short_description || "Digital resource details are available on the product page.")}</p>
        <div className="catalogue-card__meta">{product.software_name ? <span>{String(product.software_name)}{product.software_version ? ` ${String(product.software_version)}` : ""}</span> : <span>Software requirements listed on details page</span>}{product.difficulty ? <span>{String(product.difficulty)}</span> : null}</div>
        <div className="catalogue-card__meta"><strong>{product.is_free ? "Free" : product.sale_price_kes ? money(product.sale_price_kes) : money(product.price_kes)}</strong>{Array.isArray(product.file_types) && product.file_types.length ? <span>{(product.file_types as string[]).join(", ")}</span> : null}</div>
        <Link className="button button--line button--small" href={`/projects/${encodeURIComponent(String(product.code).toLowerCase())}`}>View resource</Link>
      </article>)}</div> : <div className="empty-state"><h2>No published resources yet</h2><p>Items appear here after an administrator verifies the content, licence, malware scan status and price. Drafts and private downloads are not exposed in the public catalogue.</p><Link className="button button--blue" href="/signup/guest">Create a guest account</Link></div>}
    </div></main>
  </>;
}
