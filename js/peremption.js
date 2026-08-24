// ---------------------------------------------------------------------------
// Estimation des dates de péremption + code couleur du dashboard.
//
// COMMENT MODIFIER LA TABLE :
//   - chaque ligne = une règle { libelle, jours, motifs }
//   - "jours"   : durée de conservation estimée à partir d'aujourd'hui
//   - "motifs"  : morceaux de texte cherchés dans les catégories Open Food Facts.
//                 Toujours en minuscules et sans accents. Le français ET
//                 l'anglais sont couverts, car OFF renvoie parfois des tags
//                 anglais du type "en:canned-vegetables".
//   - "libelle" : sert AUSSI de nom de groupe sur le dashboard.
//
//   La PREMIÈRE règle qui correspond gagne : l'ordre compte.
//   Exemple : "Conserves" est placé avant "Légumes" pour qu'une boîte de
//   haricots soit estimée à 2 ans et non à 1 semaine.
// ---------------------------------------------------------------------------

export const REGLES = [
  // --- Longue conservation (en premier : prime sur la matière du produit) ---
  { libelle: "Conserves",                  jours: 730,  motifs: ["conserve", "canned", "bocal", "bocaux", "en boite"] },
  // "glace" seul attraperait "thés glacés" : on vise les vraies glaces.
  { libelle: "Surgelés",                   jours: 180,  motifs: ["surgel", "frozen", "glaces et sorbets", "creme glacee", "sorbet", "ice cream"] },

  // --- Épicerie sucrée / condiments ---
  { libelle: "Miel",                       jours: 1095, motifs: ["miel", "honey"] },
  // "epice" au singulier attraperait « Épicerie » : on garde le pluriel.
  { libelle: "Épices et aromates",         jours: 730,  motifs: ["epices", "spice", "aromate", "herbe aromatique", "poivre"] },
  { libelle: "Huiles et vinaigres",        jours: 540,  motifs: ["huile", "vinaigre", "oil", "vinegar"] },
  { libelle: "Confitures et tartinables",  jours: 365,  motifs: ["confiture", "tartiner", "tartinable", "jam", "spread", "compote"] },
  { libelle: "Sauces et condiments",       jours: 300,  motifs: ["sauce", "condiment", "moutarde", "ketchup", "mayonnaise"] },

  // --- Épicerie sèche ---
  { libelle: "Pâtes",                      jours: 365,  motifs: ["pates alimentaires", "pates seches", "pasta", "spaghetti", "macaroni", "nouille"] },
  { libelle: "Riz et céréales",            jours: 365,  motifs: ["riz", "rice", "semoule", "quinoa", "boulgour", "polenta"] },
  { libelle: "Légumes secs",               jours: 365,  motifs: ["legumineuse", "legume sec", "legumes secs", "lentille", "pois chiche", "haricot sec"] },
  { libelle: "Farines",                    jours: 270,  motifs: ["farine", "flour", "levure"] },
  { libelle: "Café et thé",                jours: 365,  motifs: ["cafe", "coffee", "tisane", "infusion", "the vert", "the noir", "thes"] },
  { libelle: "Céréales petit-déjeuner",    jours: 180,  motifs: ["cereales pour petit", "petit dejeuner", "breakfast cereal", "muesli", "flocon"] },
  { libelle: "Chocolat et confiserie",     jours: 270,  motifs: ["chocolat", "chocolate", "confiserie", "bonbon", "candy"] },
  { libelle: "Biscuits et gâteaux",        jours: 180,  motifs: ["biscuit", "gateau", "cookie", "cake"] },
  { libelle: "Apéritif",                   jours: 120,  motifs: ["chips", "aperitif", "snack", "crackers", "cacahuete"] },
  { libelle: "Boissons",                   jours: 240,  motifs: ["boisson", "jus de", "soda", "eaux", "eau de", "biere", "vin", "beverage", "drink"] },

  // Une fois les accents retirés, « sucrés » devient « sucres » : le motif
  // "sucre" attraperait donc « produits à tartiner sucrés » ou « snacks sucrés ».
  // D'où des motifs précis, et une place APRÈS tous les produits sucrés.
  { libelle: "Sucre et sel",               jours: 1095, motifs: ["sucre blanc", "sucre roux", "sucre de canne", "sucre en poudre", "sucre glace", "cassonade", "edulcorant", "sels", "sel de table", "fleur de sel", "salt"] },

  // --- Rayon frais : avant "Lait", car "produits laitiers" contient "lait" ---
  { libelle: "Yaourts et desserts lactés", jours: 21,   motifs: ["yaourt", "yogurt", "dessert lacte", "fromage blanc", "petit suisse", "skyr"] },
  { libelle: "Fromages",                   jours: 21,   motifs: ["fromage", "cheese"] },
  { libelle: "Crème",                      jours: 21,   motifs: ["creme fraiche", "creme liquide", "creme epaisse"] },
  { libelle: "Beurre et margarine",        jours: 45,   motifs: ["beurre", "butter", "margarine"] },
  { libelle: "Lait",                       jours: 90,   motifs: ["lait", "milk"] },
  { libelle: "Œufs",                       jours: 28,   motifs: ["oeuf", "egg"] },

  // --- Frais périssable ---
  { libelle: "Charcuterie",                jours: 10,   motifs: ["charcuterie", "saucisson", "rillette", "lardon", "chorizo"] },
  { libelle: "Jambon",                     jours: 7,    motifs: ["jambon", "ham"] },
  { libelle: "Plats préparés",             jours: 5,    motifs: ["plat prepare", "plat cuisine", "traiteur", "sandwich", "pizza"] },
  { libelle: "Viandes",                    jours: 4,    motifs: ["viande", "meat", "volaille", "poulet", "boeuf", "porc", "agneau"] },
  { libelle: "Poissons",                   jours: 2,    motifs: ["poisson", "fish", "saumon", "crevette", "fruits de mer"] },
  { libelle: "Pain et boulangerie",        jours: 3,    motifs: ["pain", "bread", "boulangerie", "baguette", "brioche", "viennoiserie"] },
  // Les salades sont listées dans la catégorie « Légumes » : elles doivent
  // donc passer avant, sinon elles héritent des 7 jours des légumes.
  { libelle: "Salades et herbes",          jours: 4,    motifs: ["salade", "salad", "herbe fraiche", "epinard", "mache"] },
  { libelle: "Fruits",                     jours: 7,    motifs: ["fruit", "pomme", "banane", "orange", "agrume"] },
  { libelle: "Légumes",                    jours: 7,    motifs: ["legume", "vegetable", "tomate", "carotte", "pomme de terre"] },
];

// Utilisé quand aucune règle ne correspond (produit scanné mal catégorisé).
export const JOURS_DEFAUT = 30;

// Utilisé pour un ajout 100 % manuel : ce sont surtout des produits frais
// (fruits, vrac, boulangerie), donc une estimation courte est plus prudente.
export const JOURS_DEFAUT_MANUEL = 7;

export const CATEGORIE_INCONNUE = "Autres";
export const CATEGORIE_MANUELLE = "Divers";

// Minuscules, sans accents : permet de comparer le texte d'Open Food Facts
// à nos motifs sans se soucier de la casse, des accents ni des tirets des tags.
export function normaliser(texte) {
  return String(texte)
    .toLowerCase()
    .replace(/œ/g, "oe")          // le "œ" collé
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")      // accents (marques diacritiques)
    .replace(/[-_:]/g, " ");           // tags OFF du type "en:canned-vegetables"
}

// Renvoie la première règle correspondant à une des catégories, sinon null.
export function trouverRegle(categories) {
  if (!Array.isArray(categories) || categories.length === 0) return null;
  const textes = categories.filter((c) => typeof c === "string").map(normaliser);
  if (textes.length === 0) return null;
  for (const regle of REGLES) {
    for (const motif of regle.motifs) {
      if (textes.some((t) => t.includes(motif))) return regle;
    }
  }
  return null;
}

// Estimation complète à partir des catégories Open Food Facts.
// Renvoie la catégorie d'affichage, la date proposée et une explication lisible.
export function estimer(categories) {
  const regle = trouverRegle(categories);
  if (regle) {
    return {
      categorie: regle.libelle,
      jours: regle.jours,
      date: dansNJours(regle.jours),
      explication: "Estimation : " + regle.libelle + " → " + formatDuree(regle.jours) + ".",
    };
  }
  return {
    categorie: CATEGORIE_INCONNUE,
    jours: JOURS_DEFAUT,
    date: dansNJours(JOURS_DEFAUT),
    explication: "Catégorie non reconnue → valeur par défaut de " + formatDuree(JOURS_DEFAUT) + ".",
  };
}

// Date au format "AAAA-MM-JJ" (celui attendu par <input type="date">).
// On se cale sur midi pour éviter les décalages aux changements d'heure.
export function dansNJours(n) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return formatISO(d);
}

export function formatISO(d) {
  const mois = String(d.getMonth() + 1).padStart(2, "0");
  const jour = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + mois + "-" + jour;
}

// Décale une date "AAAA-MM-JJ" de N jours (boutons « +1 semaine », etc.).
export function decaler(dateISO, n) {
  const d = enDate(dateISO);
  if (!d) return dansNJours(n);
  d.setDate(d.getDate() + n);
  return formatISO(d);
}

// "AAAA-MM-JJ" → objet Date locale à midi. null si la chaîne est invalide.
function enDate(dateISO) {
  if (typeof dateISO !== "string") return null;
  const m = dateISO.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
}

// Nombre de jours avant péremption (négatif = déjà périmé).
// Infinity si la date est absente : évite les fausses alertes.
export function joursRestants(dateISO) {
  const cible = enDate(dateISO);
  if (!cible) return Infinity;
  const aujourdhui = new Date();
  aujourdhui.setHours(12, 0, 0, 0);
  return Math.round((cible - aujourdhui) / 86400000);
}

// Les 4 états de couleur du dashboard.
export function urgenceDe(dateISO) {
  const j = joursRestants(dateISO);
  if (j < 0) return "perime";
  if (j < 3) return "urgent";
  if (j < 7) return "proche";
  return "ok";
}

// Petit texte lisible pour le bandeau d'alerte.
export function texteEcheance(dateISO) {
  const j = joursRestants(dateISO);
  if (j === Infinity) return "sans date";
  if (j < 0) return "périmé depuis " + (-j) + " j";
  if (j === 0) return "aujourd'hui";
  if (j === 1) return "demain";
  return "dans " + j + " j";
}

function formatDuree(jours) {
  if (jours >= 365) return Math.round((jours / 365) * 10) / 10 + " an(s)";
  if (jours >= 30) return Math.round(jours / 30) + " mois";
  if (jours >= 7) return Math.round(jours / 7) + " semaine(s)";
  return jours + " jour(s)";
}
