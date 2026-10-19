import { translate, type Language } from "./content.js";
import { resolveSchema, type ApiDocument, type Endpoint, type Schema } from "./catalog.js";

type Translation = readonly [string, string, string];

// Reviewed meanings, shared across endpoints. Context-specific meanings below
// prevent confusing population totals, record counts and similarly named codes.
const glossary: Record<string, Translation> = Object.fromEntries(`
data|Résultat demandé : objet unique ou liste.|Requested result: a single object or a list.|النتيجة المطلوبة: كائن واحد أو قائمة.
meta|Contexte du résultat : sources, dates, licence et pagination si applicable.|Result context: sources, dates, license and pagination where applicable.|سياق النتيجة: المصادر والتواريخ والرخصة وتقسيم الصفحات عند الاقتضاء.
status|État du service ; ok indique que le service répond.|Service state; ok means the service is responding.|حالة الخدمة؛ تعني ok أن الخدمة تستجيب.
service|Nom du service qui répond.|Name of the responding service.|اسم الخدمة التي تستجيب.
version|Version du logiciel, distincte du préfixe de l’API.|Software release version, separate from the API path version.|إصدار البرنامج، وهو مستقل عن إصدار مسار الواجهة.
timestamp|Date et heure de la réponse, au format ISO 8601.|Response date and time in ISO 8601 format.|تاريخ الإجابة ووقتها بصيغة ISO 8601.
request_id|Identifiant du traitement de cette requête, utile pour retrouver un problème.|Identifier for this request, useful when reporting a problem.|معرّف هذا الطلب، يفيد عند الإبلاغ عن مشكلة.
code|Identifiant MoroccoAPI de la ressource ; réutilisez-le dans les URL correspondantes.|MoroccoAPI resource identifier; use it in the corresponding resource URLs.|معرّف المورد في MoroccoAPI؛ استعمله في روابط المورد المناسبة.
hcp_code|Code du Haut-Commissariat au Plan (office statistique marocain). Conservez-le comme texte pour garder les zéros initiaux.|Code from HCP, Morocco’s national statistics office. Keep it as text to preserve leading zeros.|رمز المندوبية السامية للتخطيط، جهاز الإحصاء المغربي. احتفظ به كنص للحفاظ على الأصفار الأولى.
type|Nature de la ressource. Les valeurs possibles figurent ci-dessous.|Kind of resource. Possible values are listed below.|نوع المورد. تظهر القيم الممكنة أسفله.
name|Nom de la ressource, éventuellement réparti par langue.|Resource name, grouped by language where applicable.|اسم المورد، وقد يكون موزّعاً حسب اللغة.
names|Noms du jour férié dans les langues disponibles.|Holiday names in the available languages.|أسماء العطلة باللغات المتاحة.
ar|Valeur en arabe ; null si aucune traduction n’est fournie.|Arabic value; null when no translation is provided.|القيمة بالعربية؛ null عند غياب الترجمة.
fr|Valeur en français ; null si aucune traduction n’est fournie.|French value; null when no translation is provided.|القيمة بالفرنسية؛ null عند غياب الترجمة.
en|Valeur en anglais ; null si aucune traduction n’est fournie.|English value; null when no translation is provided.|القيمة بالإنجليزية؛ null عند غياب الترجمة.
dataset|Nom du jeu de données auquel appartient le résultat ou la source.|Name of the dataset for this result or source.|اسم مجموعة البيانات الخاصة بالنتيجة أو المصدر.
total|Nombre de résultats correspondant aux filtres, avant pagination ; pas la taille de cette page.|Number of matching records before pagination; not the size of this page.|عدد النتائج المطابقة للمرشحات قبل تقسيم الصفحات؛ وليس حجم هذه الصفحة.
license|Licence de réutilisation. mixed signifie des licences différentes : consultez chaque source.|Reuse license. mixed means licenses differ: inspect each source.|رخصة إعادة الاستخدام. تعني mixed وجود رخص مختلفة: راجع كل مصدر.
license_url|Lien vers les conditions de la licence ; null si aucune URL n’est fournie.|Link to the license terms; null when no URL is supplied.|رابط شروط الرخصة؛ null عند غياب الرابط.
retrieved_at|Date de récupération du fichier source par le projet ; pas la date des observations.|Date the project retrieved the source file; not the observation date.|تاريخ جلب المشروع لملف المصدر؛ وليس تاريخ رصد البيانات.
transformation_version|Version des règles de conversion du jeu de données ; distincte de l’API.|Version of the dataset conversion rules; separate from the API version.|إصدار قواعد تحويل مجموعة البيانات؛ مستقل عن إصدار الواجهة.
sources|Sources utilisées pour ce résultat, avec leurs producteurs et licences.|Sources used for this result, with their publishers and licenses.|المصادر المستخدمة لهذه النتيجة مع الجهات المنتجة والرخص.
producer|Organisme qui publie la donnée originale.|Organization publishing the original data.|الجهة التي تنشر البيانات الأصلية.
source_url|Page de présentation ou de publication de la source.|Source publication or dataset landing page.|صفحة نشر المصدر أو التعريف ببياناته.
resource_url|Lien vers le fichier ou la ressource utilisée.|Link to the actual file or resource used.|رابط الملف أو المورد المستخدم فعلياً.
source_updated_at|Dernière mise à jour annoncée par la source ; pas la date de récupération.|Last update reported by the source; not the retrieval date.|آخر تحديث معلن من المصدر؛ وليس تاريخ جلب الملف.
pagination|Informations pour parcourir une collection page par page.|Information for reading a collection one page at a time.|معلومات لتصفّح نتائج القائمة صفحة بصفحة.
limit|Nombre maximal demandé par page : 100 par défaut, 500 au maximum.|Requested maximum records per page: default 100, maximum 500.|العدد الأقصى المطلوب في الصفحة: 100 افتراضياً و500 كحد أقصى.
offset|Nombre de résultats ignorés avant cette page, après filtrage. La première page commence à 0.|Matching records skipped before this page, after filtering. The first page starts at 0.|عدد النتائج المتجاوزة قبل هذه الصفحة بعد التصفية. تبدأ الصفحة الأولى من 0.
count|Nombre de résultats effectivement présents dans cette page.|Number of records actually returned on this page.|عدد النتائج الموجودة فعلياً في هذه الصفحة.
has_more|true s’il reste une autre page de résultats.|true when another page of records remains.|تكون true إذا بقيت صفحة أخرى من النتائج.
next_offset|Valeur de offset pour la page suivante ; null à la fin. Gardez les mêmes filtres.|Use as offset for the next page; null at the end. Keep the same filters.|قيمة offset للصفحة التالية؛ null عند النهاية. احتفظ بالمرشحات نفسها.
error|Détails d’une requête échouée ; remplace data et meta.|Details of a failed request; replaces data and meta.|تفاصيل الطلب الفاشل؛ تحل محل data وmeta.
message|Explication lisible de l’erreur ; utilisez code pour la logique de votre application.|Human-readable error explanation; use code for application logic.|شرح مقروء للخطأ؛ استعمل code في منطق التطبيق.
administrative_type|province ou prefecture : deux catégories du même niveau administratif, sous une région.|province or prefecture: two categories at the same administrative level, below a region.|province (إقليم) أو prefecture (عمالة): فئتان في المستوى الإداري نفسه تحت الجهة.
region_code|Identifiant de la région parente, premier niveau administratif du Maroc.|Identifier of the parent region, Morocco’s first administrative level.|معرّف الجهة الأم، وهي المستوى الإداري الأول في المغرب.
province_code|Identifiant de la province ou préfecture parente, sous la région.|Identifier of the parent province or prefecture, below the region.|معرّف الإقليم أو العمالة الأم، تحت الجهة.
commune_code|Identifiant de la commune parente : collectivité locale urbaine ou rurale, pas nécessairement une ville.|Identifier of the parent commune: an urban or rural local authority, not necessarily a city.|معرّف الجماعة الأم: وحدة محلية حضرية أو قروية، وليست بالضرورة مدينة.
cercle_hcp_code|Code HCP du cercle parent dans le recensement 2024. Un cercle regroupe des communes ; ce champ n’est pas un annuaire actuel des cercles.|HCP code of the parent cercle in the 2024 census. A cercle groups communes; this field is not a current cercle directory.|رمز HCP للدائرة الأم في إحصاء 2024. تضم الدائرة جماعات؛ وهذا الحقل ليس سجلاً حالياً للدوائر.
prefecture_of_arrondissements_code|Identifiant du groupement administratif d’arrondissements parent, lorsqu’il existe.|Identifier of the parent administrative grouping of arrondissements, where one exists.|معرّف عمالة المقاطعات الأم، عند وجودها.
arrondissement_code|Identifiant d’une subdivision urbaine à l’intérieur d’une commune.|Identifier of an urban subdivision within a commune.|معرّف مقاطعة، وهي تقسيم حضري داخل جماعة.
moroccans|Nombre de résidents de nationalité marocaine dans le périmètre indiqué.|Number of residents with Moroccan nationality in the stated area.|عدد السكان ذوي الجنسية المغربية في النطاق المحدد.
foreigners|Nombre de résidents de nationalité étrangère dans le périmètre indiqué.|Number of foreign-national residents in the stated area.|عدد السكان ذوي الجنسية الأجنبية في النطاق المحدد.
urban|Population des zones classées urbaines par le recensement ; objet détaillé si présent.|Population in census-classified urban areas; a breakdown object where provided.|سكان المناطق المصنفة حضرية في الإحصاء؛ وقد يظهر تفصيلهم في كائن.
rural|Population des zones classées rurales par le recensement ; objet détaillé si présent.|Population in census-classified rural areas; a breakdown object where provided.|سكان المناطق المصنفة قروية في الإحصاء؛ وقد يظهر تفصيلهم في كائن.
population|Nombre total de résidents recensés dans cette unité administrative.|Total census residents in this administrative unit.|إجمالي السكان المحصيين في هذه الوحدة الإدارية.
year|Année à laquelle se rapporte l’observation, pas l’année de téléchargement.|Year described by the observation, not the download year.|السنة التي تصفها البيانات، وليست سنة تنزيلها.
households|Nombre de ménages recensés ; un ménage peut comprendre une ou plusieurs personnes.|Number of census households; a household may contain one or more people.|عدد الأسر المحصاة؛ قد تتكون الأسرة من شخص واحد أو عدة أشخاص.
geographic_level|national pour tout le Maroc, region pour une seule région. Ne pas additionner ces niveaux.|national covers Morocco; region covers one region. Do not add the two levels together.|national للمغرب كله، وregion لجهة واحدة. لا تجمع أرقام المستويين.
reference_year|Année décrite par les chiffres ou le registre, distincte de la publication et de la récupération.|Year described by the counts or registry, separate from publication and retrieval.|السنة التي تصفها الأرقام أو السجل، وهي مستقلة عن تاريخ النشر والجلب.
id|Identifiant de cet élément dans le jeu de données ; pas nécessairement un code officiel.|Identifier of this item in the dataset; not necessarily an official code.|معرّف هذا العنصر في مجموعة البيانات؛ ليس بالضرورة رمزاً رسمياً.
aliases|Autres noms de la même ressource, utiles pour la reconnaître ou la rechercher.|Alternative names for the same resource, useful for recognition or search.|أسماء أخرى للمورد نفسه تساعد في التعرّف عليه أو البحث عنه.
category|Catégorie de l’établissement ou du préfixe ; utilisez les valeurs publiées.|Facility or prefix category; use the published values.|فئة المؤسسة أو بادئة الهاتف؛ استعمل القيم المنشورة.
category_label|Libellé lisible de la catégorie de l’établissement.|Human-readable facility category label.|الاسم المقروء لفئة المؤسسة.
ownership|Statut public ou privé de l’établissement, tel que renseigné.|Public or private ownership of the facility, as recorded.|كون المؤسسة عمومية أو خاصة، حسب السجل.
last_service_event_date|Date de mise en service après travaux ou équipement, lorsqu’une annonce a été retrouvée. null ne signifie pas fermé ; une date ne garantit pas l’ouverture actuelle.|Matched commissioning date after rehabilitation or equipment. null does not mean closed; a date does not guarantee current operation.|تاريخ دخول الخدمة بعد التأهيل أو التجهيز عند العثور على إعلان مطابق. لا تعني null الإغلاق، ولا يضمن وجود تاريخ العمل حالياً.
location|Coordonnées géographiques de la source, lorsqu’elles sont disponibles.|Source geographic coordinates, where available.|إحداثيات الموقع الواردة في المصدر، عند توفرها.
latitude|Latitude WGS 84 en degrés décimaux : nord positif, sud négatif.|WGS 84 latitude in decimal degrees: positive north, negative south.|خط العرض وفق WGS 84 بالدرجات العشرية: موجب شمالاً وسالب جنوباً.
longitude|Longitude WGS 84 en degrés décimaux : est positif, ouest négatif.|WGS 84 longitude in decimal degrees: positive east, negative west.|خط الطول وفق WGS 84 بالدرجات العشرية: موجب شرقاً وسالب غرباً.
is_possible|Longueur compatible avec le plan téléphonique ; ne prouve pas que le numéro existe.|Length fits the numbering plan; does not prove the number exists.|طول الرقم متوافق مع مخطط الترقيم؛ لا يثبت وجود الرقم.
is_valid_format|Format reconnu par les métadonnées du parseur ; ne garantit ni attribution ni joignabilité.|Format matches the parser metadata; does not prove assignment or reachability.|الصيغة مطابقة لبيانات المحلل؛ لا تثبت تخصيص الرقم أو إمكانية الاتصال به.
is_allocated_range|Toujours inconnu ici : les préfixes ne constituent pas un registre officiel d’attribution.|Unknown here: the prefix dataset is not an official allocation registry.|غير معروف هنا: بيانات البادئات ليست سجلاً رسمياً لتخصيص الأرقام.
has_known_prefix|Un préfixe du numéro existe dans le jeu de données, indépendamment de sa validité.|A prefix matches the dataset, independently of number validity.|توجد بادئة مطابقة في البيانات، بصرف النظر عن صلاحية الرقم.
e164|Numéro international normalisé avec +212, indicatif du Maroc.|Normalized international number with +212, Morocco’s country calling code.|الرقم الدولي الموحد مع +212، رمز الاتصال بالمغرب.
national_number|Numéro au format national marocain, avec son zéro initial.|Number in Moroccan national format, including its leading zero.|الرقم بالصيغة الوطنية المغربية مع الصفر الأول.
number_type|Type reconnu par le parseur, par exemple mobile ou ligne fixe.|Parser-recognized type, such as mobile or fixed line.|النوع الذي يتعرف عليه المحلل، مثل الهاتف المحمول أو الثابت.
reason|Code expliquant le rejet d’un numéro ; null en l’absence de motif de rejet.|Code explaining why a number was rejected; null when there is no rejection reason.|رمز يوضح سبب رفض الرقم؛ null عند عدم وجود سبب للرفض.
matched_prefix|Préfixe le plus précis trouvé pour ce numéro.|Most specific prefix matched for this number.|البادئة الأكثر تحديداً المطابقة لهذا الرقم.
original_operator|Opérateur associé au préfixe dans la source ; pas nécessairement l’opérateur actuel.|Operator associated with the prefix in the source; may differ from the current operator.|المشغل المرتبط بالبادئة في المصدر؛ قد يختلف عن المشغل الحالي.
current_operator|Inconnu : la portabilité permet de changer d’opérateur en gardant le numéro.|Unknown: number portability allows changing operator without changing number.|غير معروف: تتيح قابلية نقل الرقم تغيير المشغل مع الاحتفاظ بالرقم.
geographic_area|Zone géographique associée au préfixe, pas la position réelle de l’appelant.|Area associated with the prefix, not the caller’s actual location.|المنطقة المرتبطة بالبادئة، وليست الموقع الفعلي للمتصل.
international_prefix|Forme internationale du préfixe, avec +212 à la place du zéro initial.|International form of the prefix, with +212 replacing the leading zero.|الصيغة الدولية للبادئة، باستبدال الصفر الأول بـ+212.
description|Description du préfixe dans les langues disponibles.|Prefix description in the available languages.|وصف البادئة باللغات المتاحة.
areas|Zones desservies selon la source, classées par langue ; pas des frontières administratives exactes.|Areas served according to the source, grouped by language; not precise administrative boundaries.|المناطق المخدومة حسب المصدر، موزّعة حسب اللغة؛ وليست حدوداً إدارية دقيقة.
prefix|Premiers chiffres d’un numéro au format national, zéro inclus.|Leading digits of a national-format number, including the zero.|الأرقام الأولى للرقم بالصيغة الوطنية، بما فيها الصفر.
mask|Gabarit : chaque X représente un chiffre restant, par exemple 06XXXXXXXX.|Pattern: each X is one remaining digit, for example 06XXXXXXXX.|نمط الرقم: كل X تمثل رقماً متبقياً، مثل 06XXXXXXXX.
area_code|Préfixe de la zone géographique associée, ou null.|Associated geographic area prefix, or null.|بادئة المنطقة الجغرافية المرتبطة، أو null.
more_specific_prefixes|Sous-préfixes plus longs qui précisent cette plage.|Longer sub-prefixes providing a more specific match.|بادئات فرعية أطول تعطي مطابقة أكثر تحديداً.
name_fr|Nom de l’établissement en français, tel que publié.|Facility name in French, as published.|اسم المؤسسة بالفرنسية كما نُشر.
name_ar|Nom de l’établissement en arabe, tel que publié.|Facility name in Arabic, as published.|اسم المؤسسة بالعربية كما نُشر.
address_fr|Adresse en français fournie par la source.|French address provided by the source.|العنوان بالفرنسية الوارد في المصدر.
address_ar|Adresse en arabe fournie par la source.|Arabic address provided by the source.|العنوان بالعربية الوارد في المصدر.
commune|Libellé source de la commune ou de l’arrondissement ; pas un identifiant MoroccoAPI.|Source label for the commune or arrondissement; not a MoroccoAPI identifier.|اسم الجماعة أو المقاطعة في المصدر؛ وليس معرّف MoroccoAPI.
province|Libellé source de la province ou préfecture, niveau situé sous la région.|Source label of the province or prefecture, the level below the region.|اسم الإقليم أو العمالة في المصدر، وهو مستوى تحت الجهة.
region|Nom source de la région, premier niveau administratif.|Source name of the region, the first administrative level.|اسم الجهة في المصدر، وهي المستوى الإداري الأول.
university_fr|Université de rattachement en français, pas le nom de chaque faculté.|Parent university in French, not the name of an individual faculty.|اسم الجامعة الأم بالفرنسية، وليس اسم كل كلية.
university_ar|Université de rattachement en arabe.|Parent university in Arabic.|اسم الجامعة الأم بالعربية.
establishment_fr|Nom français de l’établissement universitaire, par exemple une faculté ou une école.|French name of the university establishment, such as a faculty or school.|الاسم الفرنسي للمؤسسة الجامعية، مثل كلية أو مدرسة.
establishment_ar|Nom arabe de l’établissement universitaire.|Arabic name of the university establishment.|الاسم العربي للمؤسسة الجامعية.
abbreviation|Sigle publié pour l’établissement.|Published abbreviation for the establishment.|الاختصار المنشور لاسم المؤسسة.
city|Ville indiquée par la source ; pas nécessairement un code administratif.|City stated by the source; not necessarily an administrative code.|المدينة المذكورة في المصدر؛ ليست بالضرورة رمزاً إدارياً.
address|Adresse postale telle que publiée.|Postal address as published.|العنوان البريدي كما نُشر.
enrollment_2023_2024|Nombre d’étudiants pour l’année universitaire 2023-2024, pas l’effectif actuel.|Student enrollment for academic year 2023-2024, not current enrollment.|عدد الطلبة في السنة الجامعية 2023-2024، وليس العدد الحالي.
telephone|Numéro de téléphone publié ; disponibilité non vérifiée en temps réel.|Published telephone number; live availability is not verified.|رقم الهاتف المنشور؛ لم تُتحقق إتاحته لحظياً.
fax|Numéro de fax publié.|Published fax number.|رقم الفاكس المنشور.
date|Date civile au format AAAA-MM-JJ ; null si elle attend confirmation.|Calendar date in YYYY-MM-DD format; null if awaiting confirmation.|التاريخ المدني بصيغة YYYY-MM-DD؛ null إذا كان في انتظار التأكيد.
day|Rang du jour d’une fête de plusieurs jours : 1 pour le premier, 2 pour le second.|Day within a multi-day holiday: 1 for the first day, 2 for the second.|ترتيب اليوم في عطلة متعددة الأيام: 1 للأول و2 للثاني.
source_urls|Liens vers les publications justifiant cette fête et sa date.|Links to publications supporting this holiday and its date.|روابط المنشورات التي توثق العطلة وتاريخها.
reviewed_at|Date de dernière vérification des sources du calendrier.|Date the calendar sources were last reviewed.|تاريخ آخر مراجعة لمصادر التقويم.
scope|Périmètre couvert par le jeu de données ; ne présume pas une couverture universelle.|Scope covered by the dataset; does not imply universal coverage.|النطاق الذي تغطيه البيانات؛ لا يعني تغطية شاملة.
weekend_days|Jours de repos du calendrier dans meta ; dans data, nombre de jours de week-end sur la période.|Weekend day names in meta; in data, the number of weekend days in the interval.|أسماء أيام الراحة داخل meta؛ وداخل data عدد أيام نهاية الأسبوع في الفترة.
years|Années couvertes par le calendrier.|Years covered by the calendar.|السنوات التي يغطيها التقويم.
calendar_complete|true si toutes les dates nécessaires sont confirmées dans le calendrier demandé.|true when all required dates in the requested calendar are confirmed.|تكون true إذا تأكدت جميع التواريخ اللازمة في التقويم المطلوب.
pending_holiday_days|Nombre de jours fériés dont la date attend une confirmation officielle.|Number of holiday days whose dates await official confirmation.|عدد أيام العطل التي تنتظر تواريخها تأكيداً رسمياً.
limitations|Limites connues de la source ou de la couverture ; à lire avant d’utiliser les données.|Known source or coverage limitations; read before using the data.|القيود المعروفة للمصدر أو التغطية؛ اقرأها قبل استخدام البيانات.
is_weekend|true si la date est un samedi ou un dimanche dans ce calendrier.|true if the date is Saturday or Sunday in this calendar.|تكون true إذا كان التاريخ يوم سبت أو أحد في هذا التقويم.
is_holiday|true si férié, false si non férié, null si une date non confirmée empêche de conclure.|true for a holiday, false otherwise, null when an unconfirmed date prevents a conclusion.|true للعطلة وfalse لغيرها، وnull إذا منع تاريخ غير مؤكد من الحسم.
is_business_day|Jour ouvré hors week-end et jours fériés ; null si le calendrier ne permet pas de conclure.|Working day excluding weekends and holidays; null if the calendar cannot determine it.|يوم عمل باستثناء نهاية الأسبوع والعطل؛ null إذا تعذر الحسم من التقويم.
holidays|Fêtes connues correspondant à la date demandée.|Known holidays matching the requested date.|العطل المعروفة المطابقة للتاريخ المطلوب.
from|Début de la période couverte ou demandée, inclus.|Start of the covered or requested period, inclusive.|بداية الفترة المغطاة أو المطلوبة، وهي مشمولة.
to|Fin de la période couverte ou demandée, incluse.|End of the covered or requested period, inclusive.|نهاية الفترة المغطاة أو المطلوبة، وهي مشمولة.
inclusive|true : les dates de début et de fin sont toutes deux comptées.|true means both the start and end dates are counted.|تعني true أن تاريخ البداية وتاريخ النهاية محسوبان معاً.
calendar_days|Nombre de jours civils dans la période, bornes comprises.|Number of calendar days in the interval, including both endpoints.|عدد الأيام المدنية في الفترة، بما فيها البداية والنهاية.
holiday_weekdays|Nombre de jours fériés confirmés tombant hors week-end, pour éviter un double décompte.|Confirmed holidays falling outside the weekend, avoiding double counting.|عدد أيام العطل المؤكدة الواقعة خارج نهاية الأسبوع لتجنب الحساب مرتين.
business_days|Nombre exact de jours ouvrés ; null si des fêtes restent non confirmées.|Exact working-day count; null while holiday dates remain unconfirmed.|العدد الدقيق لأيام العمل؛ null ما دامت هناك عطل غير مؤكدة.
business_days_upper_bound|Maximum de jours ouvrés possible ; des confirmations peuvent réduire ce nombre.|Maximum possible working-day count; later confirmations may reduce it.|أقصى عدد ممكن لأيام العمل؛ قد تخفضه التأكيدات اللاحقة.
is_exact|true si le décompte est certain ; false si des dates restent à confirmer.|true when the count is certain; false when dates remain unconfirmed.|تكون true إذا كان العدد مؤكداً، وfalse إذا بقيت تواريخ غير مؤكدة.
ident|Identifiant OurAirports ; ce n’est pas nécessairement un code ICAO.|OurAirports identifier; not necessarily an ICAO code.|معرّف OurAirports؛ ليس بالضرورة رمز ICAO.
icao_code|Code ICAO de la source, normalement quatre lettres ; jamais déduit de ident.|Source ICAO code, normally four letters; never inferred from ident.|رمز ICAO في المصدر، عادة من أربعة أحرف؛ لا يُستنتج من ident.
iata_code|Code IATA à trois lettres utilisé notamment pour les billets et bagages.|Three-letter IATA code, commonly used on tickets and baggage.|رمز IATA من ثلاثة أحرف، يُستعمل خصوصاً في التذاكر والأمتعة.
municipality|Ville desservie selon la source ; pas forcément la commune où se situe physiquement l’aéroport.|Municipality served according to the source; may differ from the airport’s physical municipality.|المدينة المخدومة حسب المصدر؛ قد تختلف عن الجماعة التي يقع فيها المطار فعلياً.
iso_country|Code pays ISO à deux lettres ; MA désigne le Maroc.|Two-letter ISO country code; MA means Morocco.|رمز البلد ISO من حرفين؛ MA تعني المغرب.
iso_region|Code de subdivision ISO de la source ; distinct des identifiants MoroccoAPI.|Source ISO subdivision code; separate from MoroccoAPI identifiers.|رمز التقسيم ISO في المصدر؛ مستقل عن معرّفات MoroccoAPI.
scheduled_service|Desserte aérienne régulière signalée à la date du fichier ; pas une garantie de vols actuels.|Scheduled airline service reported at the snapshot date; not a guarantee of current flights.|وجود رحلات منتظمة حسب تاريخ الملف؛ لا يضمن وجود رحلات حالياً.
snapshot_date|Date de référence de la copie du jeu de données.|Reference date of the dataset snapshot.|التاريخ المرجعي لنسخة البيانات.
source_revision|Révision précise du fichier source utilisée pour cette copie.|Exact source file revision used for this snapshot.|المراجعة المحددة لملف المصدر المستخدمة في هذه النسخة.
source_record_count|Nombre de lignes dans la source, avant les éventuels filtres de l’API.|Number of source records before any API filters.|عدد السجلات في المصدر قبل مرشحات الواجهة.
city_code|Identifiant de la commune de rattachement dans la géographie HCP.|Identifier of the associated commune in HCP geography.|معرّف الجماعة المرتبطة في التقسيم الجغرافي لـHCP.
contact|Coordonnées de contact publiées par la source.|Contact details published by the source.|معلومات الاتصال المنشورة في المصدر.
phone_e164|Téléphone normalisé au format international ; le format ne garantit pas qu’il fonctionne.|Phone normalized to international format; valid formatting does not guarantee it works.|الهاتف بالصيغة الدولية الموحدة؛ صحة الصيغة لا تضمن أنه يعمل.
phone_status|Résultat de validation du format seulement ; le numéro peut être partagé ou non vérifié.|Format-validation result only; the number may be shared or unverified.|نتيجة فحص الصيغة فقط؛ قد يكون الرقم مشتركاً أو غير متحقق منه.
social_handles|Identifiants sociaux publics ; la plateforme n’est pas déduite.|Public social handles; the platform is not inferred.|معرّفات التواصل الاجتماعي العامة؛ لا تُستنتج المنصة.
opening_hours_text_fr|Horaires français du guide source ; vérifiez les horaires actuels auprès du musée.|French opening-hours text from the guide; check current hours with the museum.|نص أوقات العمل بالفرنسية في الدليل؛ تحقق من الأوقات الحالية لدى المتحف.
admission_text_fr|Extrait français des tarifs ; consultez le guide pour les réductions et gratuités.|French admission-fee excerpt; consult the guide for reductions and free entry.|مقتطف رسوم الدخول بالفرنسية؛ راجع الدليل للتخفيضات والإعفاءات.
coordinates|Coordonnées indisponibles dans la source admise ; aucune position n’est inventée.|Coordinates are absent from the admitted source; no location is invented.|الإحداثيات غير متوفرة في المصدر المعتمد؛ لا يتم اختلاق موقع.
operating_status|État d’exploitation connu par la source ; ne garantit pas l’ouverture actuelle.|Operating status known from the source; does not guarantee current opening.|حالة التشغيل المعروفة من المصدر؛ لا تضمن الفتح حالياً.
quality_flags|Problèmes de qualité identifiés, par exemple téléphone partagé ou travaux mentionnés.|Known quality issues, such as shared phones or mentions of building works.|مشاكل جودة معروفة، مثل هاتف مشترك أو الإشارة إلى أشغال.
source_version|Version ou édition du document source.|Version or edition of the source document.|إصدار أو طبعة وثيقة المصدر.
Nom du port|Nom du port tel que publié ; la clé française est conservée.|Port name as published; the French JSON key is preserved.|اسم الميناء كما نُشر؛ يُحتفظ بمفتاح JSON الفرنسي.
Type de ports|Catégorie de port indiquée dans la source.|Port category stated in the source.|فئة الميناء المذكورة في المصدر.
Connectivité|Indication de connectivité maritime fournie par la source.|Maritime connectivity information provided by the source.|معلومات الربط البحري الواردة في المصدر.
Etat|État du port décrit dans le fichier source ; pas un suivi en temps réel.|Port state described in the source file; not live monitoring.|حالة الميناء في ملف المصدر؛ ليست متابعة لحظية.
Nom|Nom du phare dans la source.|Lighthouse name in the source.|اسم المنارة في المصدر.
Region|Nom de la région dans la source, pas un code MoroccoAPI.|Source region name, not a MoroccoAPI code.|اسم الجهة في المصدر، وليس رمز MoroccoAPI.
Province|Nom de la province ou préfecture dans la source.|Source province or prefecture name.|اسم الإقليم أو العمالة في المصدر.
Ville|Ville associée au phare dans la source.|City associated with the lighthouse in the source.|المدينة المرتبطة بالمنارة في المصدر.
Date de mise en service|Année ou texte de mise en service tel que publié ; pas nécessairement une date ISO.|Commissioning year or text as published; not necessarily an ISO date.|سنة دخول الخدمة أو نصها كما نُشر؛ ليست بالضرورة تاريخ ISO.
Type du phare|Type de phare selon la classification source.|Lighthouse type according to the source classification.|نوع المنارة حسب تصنيف المصدر.
Caracteristique_rythme|Séquence lumineuse permettant aux navigateurs de reconnaître le phare.|Light-flash sequence used by navigators to identify the lighthouse.|تتابع الومضات الضوئية الذي يساعد الملاحين على تمييز المنارة.
Portee_mile|Portée lumineuse indiquée en milles marins ; 1 mille marin = 1,852 km. Le texte source est conservé s’il n’est pas numérique.|Reported light range in nautical miles; 1 nautical mile = 1.852 km. Non-numeric source text is preserved.|مدى الضوء بالأميال البحرية؛ الميل البحري = 1.852 كم. يُحفظ نص المصدر إذا لم يكن رقماً.
postal_code|Code postal à cinq chiffres, conservé comme texte ; ne pas le confondre avec un code HCP.|Five-digit postal code, kept as text; separate from an HCP administrative code.|رمز بريدي من خمسة أرقام يُحفظ كنص؛ يختلف عن الرمز الإداري HCP.
postal_codes|Codes postaux utilisés par les quartiers de cette ville.|Postal codes used by this city’s neighborhoods.|الرموز البريدية المستخدمة في أحياء هذه المدينة.
neighborhood_count|Nombre de quartiers recensés pour la ville dans le fichier postal de 2018.|Number of city neighborhoods in the 2018 postal file.|عدد أحياء المدينة المسجلة في ملف البريد لسنة 2018.
topic_code|Identifiant du thème World Bank, utilisable pour filtrer les indicateurs.|World Bank topic identifier, usable to filter indicators.|معرّف موضوع البنك الدولي، يمكن استعماله لتصفية المؤشرات.
topic|Nom complet du thème World Bank.|Full World Bank topic name.|الاسم الكامل لموضوع البنك الدولي.
unit|Unité de l’indicateur. Si null, consultez son nom et sa définition ; ne supposez pas un pourcentage.|Indicator unit. If null, check its name and definition; do not assume a percentage.|وحدة المؤشر. إذا كانت null فراجع الاسم والتعريف؛ لا تفترض أنها نسبة مئوية.
periodicity|Fréquence de publication des observations, par exemple annuelle.|Observation publication frequency, such as annual.|وتيرة نشر البيانات، مثل النشر السنوي.
first_year|Première année disponible pour cet indicateur.|First available year for this indicator.|أول سنة متاحة لهذا المؤشر.
last_year|Dernière année disponible pour cet indicateur.|Last available year for this indicator.|آخر سنة متاحة لهذا المؤشر.
value_count|Nombre d’observations disponibles pour cet indicateur.|Number of available observations for this indicator.|عدد المشاهدات المتاحة لهذا المؤشر.
indicator_count|Nombre d’indicateurs rattachés à ce thème.|Number of indicators associated with this topic.|عدد المؤشرات المرتبطة بهذا الموضوع.
source|Producteur original de l’indicateur, tel que crédité par la Banque mondiale.|Original indicator producer as credited by the World Bank.|المنتج الأصلي للمؤشر حسب نسبة المصدر لدى البنك الدولي.
citation_note|Mention d’attribution demandée lors de la réutilisation de l’indicateur.|Attribution note requested when reusing the indicator.|بيان نسبة المصدر المطلوب عند إعادة استخدام المؤشر.
definition|Définition de l’indicateur ; à lire avec son unité pour interpréter les chiffres.|Indicator definition; read with the unit to interpret its values.|تعريف المؤشر؛ اقرأه مع الوحدة لفهم الأرقام.
values|Observations des années demandées, de la plus ancienne à la plus récente. Les années sans valeur sont absentes, pas égales à zéro.|Observations for requested years, oldest first. Missing years are omitted, not zero.|مشاهدات السنوات المطلوبة من الأقدم للأحدث. تُحذف السنوات بلا قيمة ولا تُعدّ صفراً.
value|Valeur de l’indicateur pour l’année associée, dans l’unité de l’indicateur.|Indicator value for the associated year, in the indicator’s unit.|قيمة المؤشر للسنة المرتبطة، بوحدة المؤشر.
basin|Bassin hydraulique : territoire dont les eaux alimentent un même réseau, distinct d’une région administrative.|River basin: an area draining to the same water system, separate from an administrative region.|حوض مائي: مساحة تصب مياهها في الشبكة المائية نفسها، وهو مختلف عن الجهة الإدارية.
latest_level|Observation la plus récente disponible dans la copie locale ; pas une mesure en direct.|Latest observation available in the local snapshot; not a live measurement.|أحدث مشاهدة متاحة في النسخة المحلية؛ ليست قياساً مباشراً.
dam_id|Identifiant du barrage, réutilisable dans /dams/{id}.|Dam identifier, reusable in /dams/{id}.|معرّف السد، يمكن استعماله في /dams/{id}.
date_basis|source_calendar : date du calendrier source ; dashboard_headline : date de l’en-tête du tableau de bord.|source_calendar: source calendar date; dashboard_headline: dashboard heading date.|source_calendar: تاريخ تقويم المصدر؛ dashboard_headline: تاريخ عنوان لوحة البيانات.
capacity_mm3|Capacité du réservoir en millions de mètres cubes (Mm³) ; null si inconnue.|Reservoir capacity in million cubic metres (Mm³); null if unknown.|سعة الخزان بملايين الأمتار المكعبة (Mm³)؛ null إذا كانت غير معروفة.
volume_mm3|Volume d’eau stockée en millions de mètres cubes. 1 Mm³ = 1 000 000 m³.|Stored water in million cubic metres. 1 Mm³ = 1,000,000 m³.|حجم المياه المخزنة بملايين الأمتار المكعبة. 1 Mm³ = 1,000,000 m³.
filling_rate_pct|Taux de remplissage en pourcentage : 50 signifie 50 %, pas 0,5.|Filling percentage: 50 means 50%, not 0.5.|نسبة الملء المئوية: 50 تعني 50% وليس 0.5.
previous_year_filling_rate_pct|Taux de remplissage de l’année précédente indiqué par la source, ou null.|Previous-year filling percentage reported by the source, or null.|نسبة الملء للسنة السابقة كما وردت في المصدر، أو null.
source_id|Identifiant permettant de retrouver la source dans meta.sources.|Identifier linking this observation to an entry in meta.sources.|معرّف يربط هذه المشاهدة بمصدر داخل meta.sources.
source_ref|Repère de l’observation dans la source : feuille/ligne ou bassin/index.|Location of the observation in the source: sheet/row or basin/index.|موضع المشاهدة داخل المصدر: ورقة/سطر أو حوض/ترتيب.
sheet|Nom de la feuille du tableur source.|Source spreadsheet sheet name.|اسم ورقة ملف الجداول المصدر.
row|Numéro de ligne du tableur source, commençant à 1.|Source spreadsheet row number, starting at 1.|رقم السطر في ملف المصدر، بدءاً من 1.
basin_code|Code du bassin dans la source du tableau de bord, pas un code HCP.|Basin code in the source dashboard, not an HCP code.|رمز الحوض في لوحة المصدر، وليس رمز HCP.
dam_index|Position du barrage dans la liste du bassin source, à partir de 1 ; pas un identifiant stable.|Dam position in the source basin list, starting at 1; not a stable identifier.|ترتيب السد في قائمة حوض المصدر بدءاً من 1؛ ليس معرّفاً ثابتاً.
coverage|Périmètre géographique et temporel effectivement disponible.|Geographic and time coverage actually available.|النطاق الجغرافي والزمني المتاح فعلياً.
basins|Liste des bassins couverts par les observations.|Basins covered by the observations.|الأحواض التي تغطيها المشاهدات.
real_time|false : les observations sont historiques, sans mise à jour en direct.|false means observations are historical, without live updates.|تعني false أن المشاهدات تاريخية دون تحديث مباشر.
complete_national_coverage|false : le jeu de données ne couvre pas tous les barrages du Maroc.|false means the dataset does not cover every dam in Morocco.|تعني false أن البيانات لا تغطي جميع سدود المغرب.
grade|Intitulé du grade de la fonction publique, en français et en arabe.|Civil-service grade title, in French and Arabic.|اسم الدرجة في الوظيفة العمومية، بالفرنسية والعربية.
corps|Corps (cadre) auquel appartient le grade, tel que publié par le simulateur officiel.|Corps (cadre) the grade belongs to, as published by the official simulator.|الهيئة أو الإطار الذي تنتمي إليه الدرجة، كما ينشره المحاكي الرسمي.
net_monthly_salary_mad|Salaire net mensuel de référence en dirhams, simulé ; ce n’est pas un droit salarial officiel.|Simulated reference net monthly salary in dirhams; not an official salary entitlement.|الأجر الصافي الشهري المرجعي بالدرهم، ناتج عن محاكاة؛ وليس أجراً رسمياً مستحقاً.
reference_url|Page Wadifa Info qui détaille ce grade et la méthode de simulation.|Wadifa Info page detailing this grade and the simulation method.|صفحة وظيفة إنفو التي تفصّل هذه الدرجة وطريقة المحاكاة.
value_type|Nature des valeurs : simulated-reference signifie des montants simulés, pas des montants officiels.|Nature of the values: simulated-reference means simulated amounts, not official ones.|طبيعة القيم: تعني simulated-reference مبالغ ناتجة عن محاكاة وليست رسمية.
notice|Avertissement sur les paramètres de simulation ; à lire avant de réutiliser les montants.|Notice on the simulation settings; read it before reusing the amounts.|تنبيه حول إعدادات المحاكاة؛ يُقرأ قبل إعادة استعمال المبالغ.
`.trim().split("\n").map((line) => {
  const [key, fr, en, ar] = line.split("|");
  if (!key || !fr || !en || !ar) throw new Error(`Incomplete field translation: ${key}`);
  return [key, [fr, en, ar] as const];
}));

const privateFacilities: Record<string, Translation> = {
  clinics: ["cliniques", "clinics", "المصحات"],
  dental_practices: ["cabinets dentaires", "dental practices", "عيادات طب الأسنان"],
  medical_practices: ["cabinets médicaux", "medical practices", "العيادات الطبية"],
  radiology_practices: ["cabinets de radiologie", "radiology practices", "عيادات الأشعة"],
  hemodialysis_centres: ["centres d’hémodialyse", "hemodialysis centres", "مراكز تصفية الدم"],
  physiotherapy_centres: ["centres de kinésithérapie", "physiotherapy centres", "مراكز العلاج الطبيعي"],
  analysis_laboratories: ["laboratoires d’analyses", "analysis laboratories", "مختبرات التحاليل"],
  pharmacies: ["pharmacies", "pharmacies", "الصيدليات"],
  infirmaries: ["infirmeries", "infirmaries", "عيادات التمريض"],
};

export function fieldMeaning(key: string, path: string, endpoint: Endpoint, language: Language): string | undefined {
  const t = (value: Translation) => translate(value, language);
  const facility = privateFacilities[key];
  if (facility) return t([
    `Nombre d’établissements privés (${facility[0]}). null signifie qu’aucun détail n’est publié pour ce niveau.`,
    `Number of private ${facility[1]}. null means no breakdown is published for this level.`,
    `عدد المؤسسات الخاصة من نوع ${facility[2]}. تعني null عدم نشر تفصيل لهذا المستوى.`,
  ]);
  if (key === "Latitude") key = "latitude";
  if (key === "Longitude") key = "longitude";
  if (path.startsWith("error.") && key === "code") return t(["Code stable de l’erreur, par exemple RESOURCE_NOT_FOUND ; à utiliser dans votre logique.", "Stable error code, such as RESOURCE_NOT_FOUND; use it in application logic.", "رمز ثابت للخطأ، مثل RESOURCE_NOT_FOUND؛ استعمله في منطق التطبيق."]);
  if (!path.startsWith("meta.") && endpoint.group === "Population" && key === "total") return t(["Nombre total de résidents recensés dans le périmètre et l’année indiqués.", "Total census residents for the stated area and year.", "إجمالي السكان المحصيين في النطاق والسنة المحددين."]);
  if (endpoint.group === "Telecom" && key === "hcp_code") return t(["null : aucun rattachement HCP vérifié n’est fourni pour ces zones téléphoniques.", "null: no verified HCP administrative mapping is provided for these phone areas.", "null: لا يتوفر ربط إداري مؤكد مع HCP لهذه المناطق الهاتفية."]);
  if (endpoint.group === "Telecom" && key === "code") return t(["Identifiant de l’opérateur dans un objet opérateur ; préfixe national dans une zone téléphonique.", "Operator identifier inside an operator object; national prefix inside a phone area.", "معرّف المشغل داخل كائن المشغل؛ وبادئة وطنية داخل المنطقة الهاتفية."]);
  if (endpoint.group === "World Bank" && key === "code" && !path.startsWith("error.")) return t(["Code de l’indicateur World Bank, par exemple IT.NET.USER.ZS ; conservez les points et majuscules.", "World Bank indicator code, such as IT.NET.USER.ZS; preserve dots and case.", "رمز مؤشر البنك الدولي، مثل IT.NET.USER.ZS؛ احتفظ بالنقاط وحالة الأحرف."]);
  if (endpoint.group === "Holidays" && key === "status") return t(["fixed : date civile fixe ; confirmed : date religieuse confirmée ; pending_confirmation : date non encore confirmée.", "fixed: fixed calendar date; confirmed: confirmed religious date; pending_confirmation: date not yet confirmed.", "fixed: تاريخ مدني ثابت؛ confirmed: تاريخ ديني مؤكد؛ pending_confirmation: تاريخ لم يُؤكد بعد."]);
  if (endpoint.group === "Holidays" && key === "type") return t(["national : fête civile nationale ; religious : fête religieuse dont la date peut attendre l’annonce officielle.", "national: national civic holiday; religious: religious holiday whose date may await an official announcement.", "national: عطلة وطنية مدنية؛ religious: عطلة دينية قد ينتظر تاريخها إعلاناً رسمياً."]);
  if (endpoint.group === "Postal codes" && key === "type") return t(["locality : lieu à code unique hors villes multicode ; neighborhood : quartier d’une ville ayant plusieurs codes.", "locality: a single-code place outside multi-code cities; neighborhood: a district in a city with several postal codes.", "locality: مكان برمز واحد خارج المدن متعددة الرموز؛ neighborhood: حي داخل مدينة لها عدة رموز بريدية."]);
  if (endpoint.group === "Postal codes" && key === "commune_code") return t(["Correspondance exacte du nom de localité avec une commune de la même province. null sans correspondance et pour tous les quartiers.", "Exact locality-name match to a commune in the same province. null without a match and for every neighborhood.", "مطابقة تامة لاسم المكان مع جماعة في الإقليم نفسه. تكون null عند غياب المطابقة ولجميع الأحياء."]);
  if (endpoint.group === "Postal codes" && key === "city" && endpoint.shortPath === "/postal-codes") return t(["Ville multicode à laquelle appartient le quartier ; null pour une localité autonome.", "Multi-code city containing the neighborhood; null for a standalone locality.", "المدينة متعددة الرموز التي ينتمي إليها الحي؛ null للمكان المستقل."]);
  if (endpoint.group === "Airports" && key === "id") return t(["Identifiant numérique persistant OurAirports, même si les codes de l’aéroport changent.", "Persistent numeric OurAirports ID, retained when airport codes change.", "معرّف OurAirports رقمي دائم، يبقى حتى عند تغير رموز المطار."]);
  if (endpoint.group === "Airports" && key === "type") return t(["Catégorie source de l’aérodrome : taille, héliport, fermé, etc. Ce n’est pas un statut de vol.", "Source airfield category: size, heliport, closed, etc. This is not a flight status.", "فئة المطار في المصدر: الحجم أو مهبط مروحيات أو مغلق وغيرها. ليست حالة رحلة."]);
  if (endpoint.group === "Health" && key === "region_code") return t(["Identifiant de la région ; null pour une ligne représentant l’ensemble du Maroc.", "Region identifier; null for a row representing all of Morocco.", "معرّف الجهة؛ null للسطر الذي يمثل المغرب كله."]);
  const meaning = glossary[key];
  return meaning ? t(meaning) : undefined;
}

export interface DocumentedField { path: string; schema: Schema; meaning: string | undefined; example: string | undefined }

/** Include every object child, array item and union branch, deduplicated by path. */
export function responseFields(schema: Schema, spec: ApiDocument, endpoint: Endpoint, language: Language): DocumentedField[] {
  const result = new Map<string, DocumentedField>();
  function visit(value: Schema, path: string, ancestors: Set<Schema>) {
    value = resolveSchema(value, spec);
    if (ancestors.has(value)) return;
    const next = new Set(ancestors).add(value);
    for (const [key, child] of Object.entries(value.properties ?? {})) {
      const childPath = path ? `${path}.${key}` : key;
      if (!result.has(childPath)) result.set(childPath, {
        path: childPath, schema: child,
        meaning: fieldMeaning(key, childPath, endpoint, language),
        example: ["/regions", "/regions/{code}"].includes(endpoint.shortPath) && key === "code"
          ? translate(["Rabat-Salé-Kénitra : code = \"rabat-sale-kenitra\", hcp_code = \"04\". Les deux identifient la même région dans des systèmes différents.", "Rabat-Salé-Kénitra: code = \"rabat-sale-kenitra\", hcp_code = \"04\". They identify the same region in two different systems.", "جهة الرباط-سلا-القنيطرة: code = \"rabat-sale-kenitra\" وhcp_code = \"04\". يحددان الجهة نفسها في نظامين مختلفين."], language)
          : undefined,
      });
      visit(child, childPath, next);
    }
    if (value.items) visit(value.items, `${path}[]`, next);
    for (const choice of value.anyOf ?? value.oneOf ?? []) visit(choice, path, next);
  }
  visit(schema, "", new Set());
  return [...result.values()];
}

export const concepts: Partial<Record<string, Translation>> = {
  Education: [
    "Le collégial est le secondaire inférieur ; le qualifiant est le secondaire supérieur. BTS signifie Brevet de technicien supérieur, une formation technique postsecondaire. CPGE signifie Classes préparatoires aux grandes écoles : préparation aux concours d’entrée d’écoles supérieures. Une université regroupe plusieurs établissements (facultés, écoles, instituts).",
    "Collégial means lower secondary (middle school); qualifiant means upper secondary (high school). BTS is a postsecondary higher-technician diploma. CPGE are preparatory classes for competitive entrance to higher-education schools. A university contains several establishments, such as faculties, schools and institutes.",
    "التعليم collégial هو الثانوي الإعدادي، وqualifiant هو الثانوي التأهيلي. BTS شهادة تقني عالٍ في تكوين تقني بعد الثانوي. CPGE أقسام تحضيرية لمباريات ولوج المدارس العليا. تضم الجامعة عدة مؤسسات مثل الكليات والمدارس والمعاهد.",
  ],
  "Administrative geography": [
    "Une région regroupe des provinces et préfectures, qui contiennent des communes urbaines ou rurales. Certaines communes sont divisées en arrondissements. Exemple : Casablanca est une commune de la région Casablanca-Settat ; un arrondissement n’est pas une région. Le HCP est l’office statistique national ; RGPH désigne son recensement de la population.",
    "A region contains provinces and prefectures, which contain urban or rural communes (local authorities). Some communes are divided into arrondissements (urban districts). For example, Casablanca is a commune within the Casablanca-Settat region; an arrondissement is not a region. HCP is Morocco’s national statistics office; RGPH is its population census.",
    "تضم الجهة أقاليم وعمالات، وتضم هذه جماعات حضرية أو قروية. بعض الجماعات مقسّمة إلى مقاطعات. مثلاً: الدار البيضاء جماعة داخل جهة الدار البيضاء-سطات؛ والمقاطعة ليست جهة. HCP هي المندوبية السامية للتخطيط، وRGPH هو الإحصاء العام للسكان والسكنى.",
  ],
  Population: [
    "RGPH est le recensement de la population réalisé par le HCP, l’office statistique marocain. Un résident n’est pas nécessairement de nationalité marocaine. Exemple de lecture : 100 résidents, dont 95 Marocains et 5 étrangers, donnent un total de 100 ; ne les additionnez pas une seconde fois. Cet exemple est illustratif.",
    "RGPH is the population census run by HCP, Morocco’s statistics office. A resident is not necessarily a Moroccan citizen. Reading example: 100 residents, including 95 Moroccan nationals and 5 foreign nationals, means a total of 100; do not add them again. These figures are illustrative.",
    "RGPH هو الإحصاء العام للسكان الذي تنجزه المندوبية السامية للتخطيط HCP. المقيم ليس بالضرورة مغربي الجنسية. مثال توضيحي: 100 مقيم، منهم 95 مغربياً و5 أجانب، يعني مجموعاً من 100؛ لا تجمعهم مرة ثانية. الأرقام توضيحية.",
  ],
  Water: ["Exemple illustratif : 50 Mm³ stockés pour une capacité de 100 Mm³ correspondent à un remplissage de 50 %. Les observations disponibles sont historiques, et ne couvrent pas tous les barrages.", "Illustrative example: 50 Mm³ stored in a 100 Mm³ reservoir means 50% full. Available observations are historical and do not cover every dam.", "مثال توضيحي: تخزين 50 مليون م³ في خزان سعته 100 مليون م³ يعني نسبة ملء 50%. المشاهدات المتاحة تاريخية ولا تغطي جميع السدود."],
  "Postal codes": ["Un code postal sert à acheminer le courrier ; un code HCP identifie une unité administrative. Une ville peut avoir plusieurs codes postaux, répartis par quartier. Le fichier décrit septembre 2018.", "A postal code routes mail; an HCP code identifies an administrative area. A city can have several postal codes, one for each neighborhood. This file describes September 2018.", "الرمز البريدي يوجّه البريد؛ أما رمز HCP فيحدد وحدة إدارية. قد تكون للمدينة عدة رموز بريدية موزعة حسب الأحياء. يصف الملف شتنبر 2018."],
  Holidays: ["Le calendrier commun de l’administration publique utilise samedi et dimanche comme week-end. Les fêtes religieuses peuvent attendre une confirmation officielle : null signifie inconnu, pas un jour ouvré garanti. Les calendriers d’entreprises peuvent différer.", "The common public-administration calendar uses Saturday and Sunday as weekends. Religious holidays may await official confirmation: null means unknown, not a guaranteed working day. Business calendars may differ.", "يعتمد التقويم المشترك للإدارة العمومية السبت والأحد للراحة الأسبوعية. قد تنتظر العطل الدينية تأكيداً رسمياً: null تعني غير معروف، وليس يوم عمل مضموناً. قد تختلف تقاويم الشركات."],
};
