import type { Metadata } from "next";
import Link from "next/link";
import SearchField from "@/components/search/SearchField";
import { listPublishedProducts } from "@/lib/data/public-catalogue";
import {
  filterAndSortProjects,
  formatProjectPrice,
  normalizeProjectFilters,
  type ProjectSearchParams,
} from "@/lib/data/projects";
import styles from "@/components/projects/store.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Projects and Digital Resources",
  description:
    "Browse published Lexify School computer projects and digital learning resources.",
  openGraph: {
    type: "website",
    title: "Projects Store | Lexify School",
    description:
      "Explore published digital learning resources and computer projects.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Projects Store | Lexify School",
    description: "Explore published computer projects and resources.",
  },
};

type Props = { searchParams: Promise<ProjectSearchParams> };

export default async function ProjectsPage({ searchParams }: Props) {
  const filters = normalizeProjectFilters(await searchParams);
  // The shared read is already restricted to published products. Filtering and
  // sorting locally keeps search useful across the public descriptions and uses
  // the currently effective (including dated sale) price consistently.
  const publishedProducts = await listPublishedProducts();
  const products = filterAndSortProjects(publishedProducts, filters);

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <span className="section-kicker">Lexify projects store</span>
          <h1>Practical projects and useful digital resources</h1>
          <p>
            Browse published project details, software requirements, file types,
            licences and listed amounts. Catalogue filters and price sorting use
            the listed base amount; item pages show date-based sale pricing when
            available. A WhatsApp chat is an enquiry only and gives no download
            access.
          </p>
        </div>
      </section>

      <main className="page-content">
        <div className="container">
          <form
            action="/projects"
            className={styles.filterPanel}
            method="get"
            aria-label="Filter digital resources"
          >
            <SearchField
              id="projects-search"
              name="q"
              label="Search"
              defaultValue={filters.q}
              placeholder="Title, description, software or file type"
              maxLength={80}
              className={styles.filterControl}
            />
            <label className={styles.filterControl}>
              Software
              <input
                name="software"
                defaultValue={filters.software}
                placeholder="For example, Word"
                maxLength={60}
              />
            </label>
            <label className={styles.filterControl}>
              Difficulty
              <select name="difficulty" defaultValue={filters.difficulty}>
                <option value="">Any difficulty</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </label>
            <label className={styles.filterControl}>
              Maximum listed amount (KES)
              <input
                name="maxPrice"
                type="number"
                min="0"
                max="10000000"
                step="50"
                defaultValue={filters.maxPrice ?? ""}
                placeholder="Any"
              />
            </label>
            <label className={styles.filterControl}>
              Sort by
              <select name="sort" defaultValue={filters.sort}>
                <option value="featured">Featured first</option>
                <option value="title">Title (A–Z)</option>
                <option value="price-asc">Price (low to high)</option>
                <option value="price-desc">Price (high to low)</option>
              </select>
            </label>
            <div>
              <label className={styles.freeCheck}>
                <input
                  name="free"
                  type="checkbox"
                  value="on"
                  defaultChecked={filters.freeOnly}
                />
                Free resources only
              </label>
              <div className={styles.filterActions}>
                <button
                  className="button button--blue button--small"
                  type="submit"
                >
                  Apply filters
                </button>
                <Link
                  className="button button--line button--small"
                  href="/projects"
                >
                  Clear
                </Link>
              </div>
            </div>
          </form>

          <div className={styles.catalogueHeading}>
            <h2>Published resources</h2>
            <p>
              {products.length} matching{" "}
              {products.length === 1 ? "item" : "items"}; showing up to 60
              recent published listings
            </p>
          </div>

          {products.length ? (
            <div className={styles.cardGrid}>
              {products.map(product => {
                const title = String(product.title || "Untitled resource");
                const code = String(product.code || "");
                const fileTypes = Array.isArray(product.file_types)
                  ? (product.file_types as unknown[]).map(String)
                  : [];
                return (
                  <article
                    className={styles.catalogueCard}
                    key={String(product.id)}
                  >
                    {product.cover_image_url ? (
                      <img
                        className={styles.cardImage}
                        src={String(product.cover_image_url)}
                        alt={`${title} cover`}
                        loading="lazy"
                      />
                    ) : (
                      <div
                        className={styles.cardPlaceholder}
                        aria-hidden="true"
                      >
                        Lexify resource
                      </div>
                    )}
                    {product.featured ? (
                      <span className={styles.featuredPill}>Featured</span>
                    ) : null}
                    <h3 className={styles.cardTitle}>{title}</h3>
                    <p className={styles.cardDescription}>
                      {String(
                        product.short_description ||
                          product.description ||
                          "No description has been published for this resource."
                      )}
                    </p>
                    <div className={styles.cardMeta}>
                      {product.software_name ? (
                        <span className={styles.metaChip}>
                          {String(product.software_name)}
                          {product.software_version
                            ? ` ${String(product.software_version)}`
                            : ""}
                        </span>
                      ) : null}
                      {product.difficulty ? (
                        <span className={styles.metaChip}>
                          {String(product.difficulty)}
                        </span>
                      ) : null}
                      {fileTypes.map(fileType => (
                        <span className={styles.metaChip} key={fileType}>
                          {fileType}
                        </span>
                      ))}
                    </div>
                    <p className={styles.cardPrice}>
                      Listed amount: {formatProjectPrice(product)}
                    </p>
                    <Link
                      className={`button button--line button--small ${styles.cardLink}`}
                      href={`/projects/${encodeURIComponent(code.toLowerCase())}`}
                    >
                      View details
                    </Link>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyState} role="status">
              <h2>
                {publishedProducts.length
                  ? "No published resources match these filters"
                  : "No published resources are currently listed"}
              </h2>
              <p>
                {publishedProducts.length
                  ? "Try a broader search or clear one or more filters."
                  : "Published project listings will appear here when available. Draft and unpublished items are not shown."}
              </p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
