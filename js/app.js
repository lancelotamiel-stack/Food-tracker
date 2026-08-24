// ---------------------------------------------------------------------------
// Composant Alpine principal : état de l'application et actions de l'interface.
//
// Trois écrans, un seul visible à la fois (propriété `ecran`) :
//   "dashboard"  : tableau de bord — statistiques, recherche, liste groupée
//   "scan"       : la caméra
//   "formulaire" : l'ajout d'un produit (scanné ou manuel)
//
// Trois surcouches, indépendantes de l'écran courant :
//   `panneau`   : feuille glissante du bas (sauvegarde)
//   `dialogue`  : confirmation bloquante (remplace confirm())
//   `notifs`    : messages passagers (remplacent alert() quand rien n'est bloquant)
// ---------------------------------------------------------------------------

import { CLES, lire, ecrire, identifiant } from "./stockage.js";
import { chercherProduit } from "./openfoodfacts.js";
import {
  estimer,
  dansNJours,
  decaler,
  joursRestants,
  urgenceDe,
  texteEcheance,
  JOURS_DEFAUT,
  JOURS_DEFAUT_MANUEL,
  CATEGORIE_MANUELLE,
  REGLES,
} from "./peremption.js";
import { iconeDe } from "./icones.js";
import { demarrerScan, arreterScan } from "./scanner.js";
import { exporterFichier, lireFichier } from "./sauvegarde.js";

// Formulaire vide : sert aussi bien à l'ajout manuel qu'au produit scanné.
function formulaireVide() {
  return {
    code: null,        // code-barres, ou null si ajout manuel
    nom: "",
    marque: "",
    quantite: "",
    categorie: CATEGORIE_MANUELLE,
    image: "",
    peremption: dansNJours(JOURS_DEFAUT_MANUEL),
    explication: "",   // d'où vient la date proposée
    source: "",        // message affiché en haut du formulaire
  };
}

// Les quatre filtres du tableau de bord. Chaque tuile de statistique en
// active un : le compteur affiché et la liste filtrée utilisent donc
// exactement le même test, ils ne peuvent pas diverger.
const FILTRES = {
  tous:    { libelle: "En stock",      detail: "produits",      teinte: "total",  test: () => true },
  semaine: { libelle: "Cette semaine", detail: "à consommer",   teinte: "proche",
             test: (p) => { const j = joursRestants(p.peremption); return j >= 0 && j < 7; } },
  entames: { libelle: "Entamés",       detail: "déjà ouverts",  teinte: "urgent",
             test: (p) => Number(p.niveau) < 100 },
  perimes: { libelle: "Périmés",       detail: "à trier",       teinte: "perime",
             test: (p) => joursRestants(p.peremption) < 0 },
};

document.addEventListener("alpine:init", () => {
  Alpine.data("inventaire", () => ({
    produits: [],
    historique: [],

    ecran: "dashboard",
    messageScan: "",
    scanActif: false,
    codeManuel: "",
    form: formulaireVide(),

    // Tableau de bord
    recherche: "",
    filtre: "tous",
    replies: [],        // noms des catégories repliées
    defile: false,      // l'en-tête se dessine une bordure dès qu'on défile

    // Surcouches
    theme: "auto",
    panneau: null,
    dialogue: null,
    notifs: [],
    prochaineNotif: 1,

    // --- Cycle de vie ------------------------------------------------------

    init() {
      this.produits = lire(CLES.inventaire, []);
      this.historique = lire(CLES.historique, []);
      this.theme = lire(CLES.theme, "auto");
      this.appliquerTheme();
    },

    // Appelée après CHAQUE modification : c'est la persistance.
    sauvegarder() {
      ecrire(CLES.inventaire, this.produits);
      ecrire(CLES.historique, this.historique);
    },

    // --- Thème -------------------------------------------------------------

    // "auto" suit le réglage du système : dans ce cas, aucun attribut n'est
    // posé et la media-query prefers-color-scheme décide seule.
    appliquerTheme() {
      const racine = document.documentElement;
      if (this.theme === "auto") racine.removeAttribute("data-theme");
      else racine.setAttribute("data-theme", this.theme);
    },

    basculerTheme() {
      const suite = { auto: "clair", clair: "sombre", sombre: "auto" };
      this.theme = suite[this.theme] || "auto";
      ecrire(CLES.theme, this.theme);
      this.appliquerTheme();
      const noms = { auto: "Thème automatique", clair: "Thème clair", sombre: "Thème sombre" };
      this.notifier(noms[this.theme]);
    },

    // --- Statistiques ------------------------------------------------------

    // Un compteur par filtre, calculé en une seule passe sur l'inventaire.
    get stats() {
      const compteurs = { tous: 0, semaine: 0, entames: 0, perimes: 0 };
      for (const produit of this.produits) {
        for (const cle of Object.keys(FILTRES)) {
          if (FILTRES[cle].test(produit)) compteurs[cle] += 1;
        }
      }
      return compteurs;
    },

    // Les quatre tuiles, prêtes à afficher.
    get tuiles() {
      const compteurs = this.stats;
      return Object.keys(FILTRES).map((cle) => ({
        cle: cle,
        libelle: FILTRES[cle].libelle,
        detail: FILTRES[cle].detail,
        teinte: FILTRES[cle].teinte,
        valeur: compteurs[cle],
      }));
    },

    get nombreCategories() {
      return new Set(this.produits.map((p) => p.categorie || "Autres")).size;
    },

    get libelleFiltre() {
      return (FILTRES[this.filtre] || FILTRES.tous).libelle;
    },

    activerFiltre(cle) {
      // Retaper la tuile déjà active revient à tout réafficher.
      this.filtre = this.filtre === cle ? "tous" : cle;
    },

    reinitialiserVue() {
      this.filtre = "tous";
      this.recherche = "";
    },

    get vueFiltree() {
      return this.filtre !== "tous" || this.recherche.trim() !== "";
    },

    // --- Liste -------------------------------------------------------------

    // Inventaire après application du filtre actif ET de la recherche.
    get produitsVisibles() {
      const test = (FILTRES[this.filtre] || FILTRES.tous).test;
      const mots = this.recherche.trim().toLowerCase();
      return this.produits.filter((produit) => {
        if (!test(produit)) return false;
        if (mots === "") return true;
        const cible = [produit.nom, produit.marque, produit.categorie, produit.quantite]
          .filter(Boolean).join(" ").toLowerCase();
        return cible.includes(mots);
      });
    },

    // Produits regroupés par catégorie.
    // Dans un groupe : péremption la plus proche en premier.
    // Entre groupes : le groupe contenant le produit le plus urgent en premier.
    get groupes() {
      const parCategorie = new Map();
      for (const produit of this.produitsVisibles) {
        const nom = produit.categorie || "Autres";
        if (!parCategorie.has(nom)) parCategorie.set(nom, []);
        parCategorie.get(nom).push(produit);
      }

      const groupes = [];
      for (const [nom, produits] of parCategorie) {
        groupes.push({
          nom: nom,
          icone: iconeDe(nom),
          produits: produits.slice().sort(parEcheance),
        });
      }
      groupes.sort((a, b) => parEcheance(a.produits[0], b.produits[0]));
      return groupes;
    },

    // Bandeau du haut : tout ce qui périme dans les 7 jours, périmés inclus.
    get alertes() {
      return this.produits
        .filter((p) => joursRestants(p.peremption) < 7)
        .sort(parEcheance);
    },

    basculerGroupe(nom) {
      this.replies = this.replies.includes(nom)
        ? this.replies.filter((n) => n !== nom)
        : this.replies.concat(nom);
    },

    estReplie(nom) {
      return this.replies.includes(nom);
    },

    urgence(produit) {
      return urgenceDe(produit.peremption);
    },

    echeance(produit) {
      return texteEcheance(produit.peremption);
    },

    // "2026-09-12" → "12 sept." : la pastille de date reste courte.
    dateCourte(dateISO) {
      const m = String(dateISO || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m) return "date ?";
      const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
    },

    // --- Modification d'un produit ----------------------------------------

    // Chaque changement de niveau alimente l'historique (invisible dans l'app,
    // mais conservé pour des statistiques ultérieures).
    changerNiveau(produit, nouveauNiveau) {
      const ancienNiveau = produit.niveau;
      if (nouveauNiveau === ancienNiveau) return;

      this.historique.push({
        code: produit.code || null,
        id: produit.id,
        nom: produit.nom,
        ancienNiveau: ancienNiveau,
        nouveauNiveau: nouveauNiveau,
        date: new Date().toISOString(),
      });

      produit.niveau = nouveauNiveau;
      this.sauvegarder();

      if (nouveauNiveau === 0) {
        this.notifier("« " + produit.nom + " » est vide — à supprimer ?");
      }
    },

    // Correction de la date directement depuis la carte du produit.
    changerDate(produit, nouvelleDate) {
      if (!nouvelleDate) return;
      produit.peremption = nouvelleDate;
      this.sauvegarder();
      this.notifier("Date mise à jour : " + this.echeance(produit), "succes");
    },

    async supprimer(produit) {
      const confirme = await this.demanderConfirmation(
        "Supprimer ce produit ?",
        "« " + produit.nom + " » sera retiré de l'inventaire. L'historique, lui, est conservé.",
        "Supprimer"
      );
      if (!confirme) return;

      this.produits = this.produits.filter((p) => p.id !== produit.id);
      this.sauvegarder();
      this.notifier("« " + produit.nom + " » supprimé", "succes");
    },

    // --- Scan --------------------------------------------------------------

    async ouvrirScan() {
      this.ecran = "scan";
      this.codeManuel = "";
      this.scanActif = false;
      this.messageScan = "Démarrage de la caméra…";

      // On attend que l'écran soit affiché : html5-qrcode a besoin d'un
      // conteneur visible pour dimensionner l'aperçu vidéo.
      await this.$nextTick();

      try {
        await demarrerScan("lecteur", (code) => this.traiterCode(code));
        this.scanActif = true;
        this.messageScan = "Visez le code-barres du produit.";
      } catch (erreur) {
        this.scanActif = false;
        this.messageScan =
          "Caméra indisponible (" + erreur.message + "). Saisissez le code à la main.";
      }
    },

    async fermerScan() {
      await arreterScan();
      this.scanActif = false;
      this.ecran = "dashboard";
    },

    // Point d'entrée commun au scan et à la saisie manuelle du code.
    async traiterCode(code) {
      const codeNettoye = String(code || "").trim();
      if (!/^\d{6,14}$/.test(codeNettoye)) {
        this.messageScan = "Code-barres non reconnu : " + codeNettoye;
        return;
      }

      await arreterScan(); // un code lu suffit, on libère la caméra
      this.scanActif = false;
      this.messageScan = "Recherche sur Open Food Facts…";

      let fiche = null;
      let messageReseau = "";
      try {
        fiche = await chercherProduit(codeNettoye);
      } catch (erreur) {
        messageReseau = "Open Food Facts injoignable (" + erreur.message + ").";
      }

      this.preparerFormulaire(codeNettoye, fiche, messageReseau);
    },

    // --- Formulaire d'ajout ------------------------------------------------

    // Prépare le formulaire à partir de la fiche trouvée (ou de son absence).
    preparerFormulaire(code, fiche, messageReseau) {
      const form = formulaireVide();
      form.code = code;

      if (fiche) {
        const estimation = estimer(fiche.categories);
        form.nom = fiche.nom;
        form.marque = fiche.marque;
        form.quantite = fiche.quantite;
        form.image = fiche.image;
        form.categorie = estimation.categorie;
        form.peremption = estimation.date;
        form.explication = estimation.explication;
        form.source = fiche.depuisCache
          ? "Fiche déjà connue (cache local)."
          : "Fiche trouvée sur Open Food Facts.";
        // Base collaborative : le nom peut être vide malgré une fiche existante.
        if (form.nom === "") {
          form.source += " Nom absent de la fiche, à saisir.";
        }
      } else {
        form.peremption = dansNJours(JOURS_DEFAUT);
        form.explication =
          "Aucune catégorie connue → " + JOURS_DEFAUT + " jours par défaut.";
        form.source = messageReseau
          ? messageReseau + " Saisissez le produit à la main."
          : "Produit inconnu d'Open Food Facts. Saisissez-le à la main.";
      }

      this.form = form;
      this.ecran = "formulaire";
    },

    // Ajout d'un produit sans code-barres (fruits, vrac, boulangerie…).
    async ouvrirFormulaireManuel() {
      await arreterScan();
      this.scanActif = false;
      const form = formulaireVide();
      form.explication =
        "Produit sans code-barres → " + JOURS_DEFAUT_MANUEL + " jours par défaut.";
      form.source = "Ajout manuel : renseignez au moins un nom et une date.";
      this.form = form;
      this.ecran = "formulaire";
    },

    // Boutons de correction rapide de la date, en un tap.
    decalerPeremption(jours) {
      this.form.peremption = decaler(this.form.peremption, jours);
    },

    // Suggestions du champ Catégorie : les libellés connus, plus les
    // catégories déjà utilisées dans l'inventaire (saisies libres comprises).
    get categoriesConnues() {
      const noms = REGLES.map((r) => r.libelle)
        .concat(this.produits.map((p) => p.categorie))
        .filter(Boolean);
      return Array.from(new Set(noms)).sort((a, b) => a.localeCompare(b, "fr"));
    },

    get apercuEcheanceForm() {
      return texteEcheance(this.form.peremption);
    },

    validerFormulaire() {
      const nom = this.form.nom.trim();
      if (nom === "") {
        this.notifier("Le nom du produit est obligatoire.", "erreur");
        return;
      }

      this.produits.push({
        id: identifiant(),
        code: this.form.code || null,
        nom: nom,
        marque: this.form.marque.trim(),
        quantite: this.form.quantite.trim(),
        categorie: this.form.categorie.trim() || "Autres",
        image: this.form.image,
        peremption: this.form.peremption || dansNJours(JOURS_DEFAUT),
        niveau: 100, // un produit entamé se règle ensuite avec le curseur
        ajouteLe: new Date().toISOString(),
      });

      this.sauvegarder();
      this.form = formulaireVide();
      this.ecran = "dashboard";
      // Un produit ajouté doit rester visible : on lève filtre et recherche.
      this.reinitialiserVue();
      this.notifier("« " + nom + " » ajouté à l'inventaire", "succes");
    },

    annulerFormulaire() {
      this.form = formulaireVide();
      this.ecran = "dashboard";
    },

    // --- Sauvegarde JSON ---------------------------------------------------

    exporterJSON() {
      exporterFichier(this.produits, this.historique);
      this.panneau = null;
      this.notifier("Fichier de sauvegarde téléchargé", "succes");
    },

    async importerJSON(evenement) {
      const fichier = evenement.target.files && evenement.target.files[0];
      if (!fichier) return;

      try {
        const donnees = await lireFichier(fichier);
        const confirme = await this.demanderConfirmation(
          "Remplacer l'inventaire ?",
          "L'inventaire actuel (" + this.produits.length + " produit(s)) sera remplacé " +
          "par le contenu du fichier (" + donnees.inventaire.length + " produit(s)).",
          "Remplacer"
        );
        if (confirme) {
          this.produits = donnees.inventaire;
          this.historique = donnees.historique;
          this.sauvegarder();
          this.reinitialiserVue();
          this.panneau = null;
          this.notifier(donnees.inventaire.length + " produit(s) importé(s)", "succes");
        }
      } catch (erreur) {
        this.notifier("Import impossible : " + erreur.message, "erreur");
      } finally {
        // Remise à zéro : permet de réimporter deux fois le même fichier.
        evenement.target.value = "";
      }
    },

    // --- Surcouches : dialogue et notifications ----------------------------

    // Équivalent de confirm(), mais non bloquant et à notre charte.
    // La promesse est résolue par repondreDialogue(), depuis les boutons.
    demanderConfirmation(titre, texte, libelleAction) {
      return new Promise((resoudre) => {
        this.dialogue = {
          titre: titre,
          texte: texte,
          libelleAction: libelleAction || "Confirmer",
          resoudre: resoudre,
        };
      });
    },

    repondreDialogue(reponse) {
      const enCours = this.dialogue;
      this.dialogue = null;
      if (enCours) enCours.resoudre(reponse);
    },

    // type : "info" (défaut), "succes" ou "erreur".
    notifier(texte, type) {
      const id = this.prochaineNotif++;
      this.notifs.push({ id: id, texte: texte, type: type || "info" });
      setTimeout(() => {
        this.notifs = this.notifs.filter((n) => n.id !== id);
      }, 3200);
    },
  }));
});

// Tri par date de péremption croissante ; les produits sans date passent après.
function parEcheance(a, b) {
  return cleDeTri(a) - cleDeTri(b);
}

// joursRestants renvoie Infinity si la date manque : on le remplace par une
// grande valeur finie, sinon la soustraction donnerait NaN.
function cleDeTri(produit) {
  const jours = joursRestants(produit && produit.peremption);
  return Number.isFinite(jours) ? jours : 99999;
}
