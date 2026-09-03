// STUB. The module that lived here is a tenant integration of the operating repository and is not
// part of the public primitive. The original (5438 lines) exported the names below; each one
// throws with this path when used, so the kernel keeps its shape and a caller sees exactly what
// is absent. See docs/PUBLISHING.md, section "The primitive profile".
const excluded = (name) => new Proxy(function excluded() {}, {
  apply() { throw new Error('excluded from the public primitive: functions/_lib/oip_articles.js#' + name); },
  construct() { throw new Error('excluded from the public primitive: functions/_lib/oip_articles.js#' + name); },
  get(_t, p) { if (p === 'then' || p === Symbol.toPrimitive || p === Symbol.iterator || p === Symbol.toStringTag) return undefined; throw new Error('excluded from the public primitive: functions/_lib/oip_articles.js#' + name + '.' + String(p)); },
});
export const OIP_CANONICAL_SENTENCE = excluded("OIP_CANONICAL_SENTENCE");
export const OIP_PRIMER_ARTICLES = excluded("OIP_PRIMER_ARTICLES");
export const OIP_REVIEW_QUESTIONS = excluded("OIP_REVIEW_QUESTIONS");
export const PHILOSOPHY_REVIEW_QUESTIONS = excluded("PHILOSOPHY_REVIEW_QUESTIONS");
export const TOTAL_STRUCTURE_SHELF = excluded("TOTAL_STRUCTURE_SHELF");
export const articleMachineShape = excluded("articleMachineShape");
export const buildCorpusArticleBundle = excluded("buildCorpusArticleBundle");
export const buildOipArticle = excluded("buildOipArticle");
export const buildOipArticleBundle = excluded("buildOipArticleBundle");
export const buildOipVoxelGraph = excluded("buildOipVoxelGraph");
export const formatOipArticleBundleMarkdown = excluded("formatOipArticleBundleMarkdown");
export const insertOipArticleVersion = excluded("insertOipArticleVersion");
export const isOipArticleSlug = excluded("isOipArticleSlug");
export const listDynamicOipArticles = excluded("listDynamicOipArticles");
export const listOipArticleSummaries = excluded("listOipArticleSummaries");
export const loadDynamicOipArticle = excluded("loadDynamicOipArticle");
export const loadPrimerBody = excluded("loadPrimerBody");
export const oipModelOperatingRuleMarkdown = excluded("oipModelOperatingRuleMarkdown");
export const oipNotFirewallMarkdown = excluded("oipNotFirewallMarkdown");
export const oipPublishGate = excluded("oipPublishGate");
export const oipReviewArticleSlugs = excluded("oipReviewArticleSlugs");
export const parseOipArticleSlug = excluded("parseOipArticleSlug");
export const rawOipArticleBody = excluded("rawOipArticleBody");
export const recentOipReviewHistory = excluded("recentOipReviewHistory");
export const reviewQuestionsFor = excluded("reviewQuestionsFor");
export const shelfFor = excluded("shelfFor");
