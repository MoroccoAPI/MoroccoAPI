const origin = "https://moroccoapi.dev";
const escape = (value: string): string => value.replace(/[&<>"']/g, (character) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
export const absoluteUrl = (path: string): string => `${origin}${path}`;
export const jsonLd = (value: unknown): string => JSON.stringify(value).replace(/</g, "\\u003c");

export function seoHead(options: {
  title: string; description: string; path: string; language: string;
  alternates?: { language: string; path: string }[]; article?: boolean;
}): string {
  const { title, description, path, language, alternates = [], article = false } = options;
  const url = absoluteUrl(path);
  const image = absoluteUrl("/assets/moroccoapi-logo.png");
  const locale = { fr: "fr_FR", en: "en_US", ar: "ar_MA" }[language] ?? "en_US";
  const structured = article ? {
    "@context": "https://schema.org", "@type": "TechArticle", headline: title, description,
    url, inLanguage: language, mainEntityOfPage: url,
    isPartOf: { "@type": "WebSite", name: "MoroccoAPI", url: origin },
    about: { "@type": "SoftwareApplication", name: "MoroccoAPI", applicationCategory: "DeveloperApplication", operatingSystem: "Any" },
  } : {
    "@context": "https://schema.org", "@type": "WebSite", name: "MoroccoAPI", url,
    description, inLanguage: language, sameAs: "https://github.com/MoroccoAPI/MoroccoAPI",
  };
  return `<title>${escape(title)}</title>
<meta name="description" content="${escape(description)}"><meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="${escape(url)}">
${alternates.map((alternate) => `<link rel="alternate" hreflang="${escape(alternate.language)}" href="${escape(absoluteUrl(alternate.path))}">`).join("\n")}
<meta property="og:site_name" content="MoroccoAPI"><meta property="og:type" content="${article ? "article" : "website"}">
<meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}">
<meta property="og:url" content="${escape(url)}"><meta property="og:locale" content="${locale}">
<meta property="og:image" content="${image}"><meta property="og:image:alt" content="MoroccoAPI">
<meta name="twitter:card" content="summary"><meta name="twitter:title" content="${escape(title)}">
<meta name="twitter:description" content="${escape(description)}"><meta name="twitter:image" content="${image}">
<script type="application/ld+json">${jsonLd(structured)}</script>`;
}
