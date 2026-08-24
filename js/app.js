// ---------------------------------------------------------------------------
// Composant Alpine principal : état de l'application et actions de l'interface.
//
// Trois écrans, un seul visible à la fois (propriété `ecran`) :
//   "dashboard"  : la liste des produits groupés par catégorie
//   "scan"       : la caméra
//   "formulaire" : l'ajout d'un produit (scanné ou manuel)
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
} from "./peremption.js";
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

document.addEventListener("alpine:init", () => {
  Alpine.data("inventaire", () => ({
    produits: [],
    historique: [],

    ecran: "dashboard",
    messageScan: "",
    codeManuel: "",
    form: formulaireVide(),

    // --- Cycle de vie ------------------------------------------------------

    init() {
      this.produits = lire(CLES.inventaire, []);
      this.historique = lire(CLES.historique, []);
    },

    // Appelée après CHAQUE modification : c'est la persistance.
    sauvegarder() {
      ecrire(CLES.inventaire, this.produits);
      ecrire(CLES.historique, this.historique);
    },

    // --- Dashboard ---------------------------------------------------------

    // Produits regroupés par catégorie.
    // Dans un groupe : péremption la plus proche en premier.
    // Entre groupes : le groupe contenant le produit le plus urgent en premier.
    get groupes() {
      const parCategorie = new Map();
      for (const produit of this.produits) {
        const nom = produit.categorie || "Autres";
        if (!parCategorie.has(nom)) parCategorie.set(nom, []);
        parCategorie.get(nom).push(produit);
      }

      const groupes = [];
      for (const [nom, produits] of parCategorie) {
        groupes.push({ nom, produits: produits.slice().sort(parEcheance) });
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

    urgence(produit) {
      return urgenceDe(produit.peremption);
    },

    echeance(produit) {
      return texteEcheance(produit.peremption);
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
    },

    // Correction de la date directement depuis la carte du produit.
    changerDate(produit, nouvelleDate) {
      if (!nouvelleDate) return;
      produit.peremption = nouvelleDate;
      this.sauvegarder();
    },

    supprimer(produit) {
      if (!confirm("Supprimer « " + produit.nom + " » de l'inventaire ?")) return;
      this.produits = this.produits.filter((p) => p.id !== produit.id);
      this.sauvegarder();
    },

    // --- Scan --------------------------------------------------------------

    async ouvrirScan() {
      this.ecran = "scan";
      this.codeManuel = "";
      this.messageScan = "Démarrage de la caméra…";

      // On attend que l'écran soit affiché : html5-qrcode a besoin d'un
      // conteneur visible pour dimensionner l'aperçu vidéo.
      await this.$nextTick();

      try {
        await demarrerScan("lecteur", (code) => this.traiterCode(code));
        this.messageScan = "Visez le code-barres.";
      } catch (erreur) {
        this.messageScan =
          "Caméra indisponible (" + erreur.message + "). Saisissez le code à la main.";
      }
    },

    async fermerScan() {
      await arreterScan();
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
      const form = formulaireVide();
      form.explication =
        "Produit sans code-barres → " + JOURS_DEFAUT_MANUEL + " jours par défaut.";
      form.source = "Ajout manuel.";
      this.form = form;
      this.ecran = "formulaire";
    },

    // Boutons de correction rapide de la date, en un tap.
    decalerPeremption(jours) {
      this.form.peremption = decaler(this.form.peremption, jours);
    },

    validerFormulaire() {
      const nom = this.form.nom.trim();
      if (nom === "") {
        alert("Le nom du produit est obligatoire.");
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
    },

    annulerFormulaire() {
      this.form = formulaireVide();
      this.ecran = "dashboard";
    },

    // --- Sauvegarde JSON ---------------------------------------------------

    exporterJSON() {
      exporterFichier(this.produits, this.historique);
    },

    async importerJSON(evenement) {
      const fichier = evenement.target.files && evenement.target.files[0];
      if (!fichier) return;

      try {
        const donnees = await lireFichier(fichier);
        const message =
          "Remplacer l'inventaire actuel (" + this.produits.length + " produit(s)) " +
          "par le contenu du fichier (" + donnees.inventaire.length + " produit(s)) ?";
        if (confirm(message)) {
          this.produits = donnees.inventaire;
          this.historique = donnees.historique;
          this.sauvegarder();
        }
      } catch (erreur) {
        alert("Import impossible : " + erreur.message);
      } finally {
        // Remise à zéro : permet de réimporter deux fois le même fichier.
        evenement.target.value = "";
      }
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
