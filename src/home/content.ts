export const homeContent = {
  en: {
    name: "English", languageLabel: "Page language", homeLabel: "MoroccoAPI home", light: "Light mode", dark: "Dark mode",
    seoTitle: "MoroccoAPI: Morocco’s open data API",
    description: "Free JSON API for Moroccan geography, population, postal codes, schools, health and more. No API key. Documentation in English, French and Arabic.",
    eyebrow: "Open data. Built together.", title: "Morocco’s open data,", titleAccent: "ready to build with.",
    intro: "A community-built API that makes Moroccan public datasets easier to discover and use. One consistent JSON format, clear documentation, and a source behind every dataset.",
    explore: "Explore the API", contribute: "Contribute on GitHub", openSource: "Open source", arrow: "→",
    start: "Start with geography.", geography: "Regions, provinces, and communes.", names: "Arabic and French names included.",
    firstRequest: "Your first request", response: "See the JSON response", footer: "An independent community project.", releases: "Releases", status: "API status",
  },
  fr: {
    name: "Français", languageLabel: "Langue de la page", homeLabel: "Accueil MoroccoAPI", light: "Mode clair", dark: "Mode sombre",
    seoTitle: "MoroccoAPI: API des données ouvertes du Maroc",
    description: "API JSON gratuite : géographie, population, codes postaux, écoles et santé au Maroc. Sans clé API. Documentation en français, anglais et arabe.",
    eyebrow: "Données ouvertes. Un projet collectif.", title: "Les données du Maroc,", titleAccent: "prêtes pour vos projets.",
    intro: "Une API communautaire pour découvrir et utiliser les données publiques marocaines. Un format JSON cohérent, une documentation claire et une source pour chaque jeu de données.",
    explore: "Explorer l’API", contribute: "Contribuer sur GitHub", openSource: "Code ouvert", arrow: "→",
    start: "Commencez par la géographie.", geography: "Régions, provinces et communes.", names: "Noms en arabe et en français inclus.",
    firstRequest: "Votre première requête", response: "Voir la réponse JSON", footer: "Un projet communautaire indépendant.", releases: "Versions", status: "État de l’API",
  },
  ar: {
    name: "العربية", languageLabel: "لغة الصفحة", homeLabel: "الرئيسية: MoroccoAPI", light: "الوضع الفاتح", dark: "الوضع الداكن",
    seoTitle: "MoroccoAPI: واجهة البيانات المفتوحة للمغرب",
    description: "واجهة JSON مجانية لبيانات المغرب: التقسيم الإداري والسكان والرموز البريدية والتعليم والصحة. دون مفتاح API. توثيق بالعربية والفرنسية والإنجليزية.",
    eyebrow: "بيانات مفتوحة. بجهود مشتركة.", title: "بيانات المغرب المفتوحة،", titleAccent: "جاهزة لمشاريعك.",
    intro: "واجهة مجتمعية لاكتشاف البيانات العمومية المغربية واستخدامها. صيغة JSON موحّدة، وتوثيق واضح، ومصدر لكل مجموعة بيانات.",
    explore: "استكشف الواجهة", contribute: "ساهم على GitHub", openSource: "مفتوح المصدر", arrow: "←",
    start: "ابدأ بالتقسيم الإداري.", geography: "الجهات والأقاليم والجماعات.", names: "الأسماء بالعربية والفرنسية متاحة.",
    firstRequest: "طلبك الأول", response: "اعرض إجابة JSON", footer: "مشروع مجتمعي مستقل.", releases: "الإصدارات", status: "حالة الواجهة",
  },
} as const;

export type HomeLanguage = keyof typeof homeContent;
export const homeUrl = (language: HomeLanguage): string => language === "en" ? "/" : `/${language}`;
