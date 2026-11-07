/* Notes — guide d'utilisation (formation en chapitres) + « À propos » dans Réglages. */
(function () {
  "use strict";
  var M = /[?&]noanim=1/.test(location.search) ? null : (window.Motion || null);
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  function canAnim() { return !!M && !reduce.matches; }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  var KEY = "notes2m01.guide";
  var st = { done: [], last: null };
  try { var raw = JSON.parse(localStorage.getItem(KEY) || "null"); if (raw && Array.isArray(raw.done)) st = { done: raw.done, last: raw.last || null }; } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }

  var DISCLAIMER = "Application non officielle. Résultats indicatifs : seul ton bulletin fait foi.";

  /* ---------- Icônes ---------- */
  var IC = {
    share: "<svg viewBox='0 0 24 24'><path d='M12 3v12M7.5 7.5 12 3l4.5 4.5'/><path d='M6 11H5v9h14v-9h-1'/></svg>",
    add: "<svg viewBox='0 0 24 24'><rect x='4' y='4' width='16' height='16' rx='4'/><path d='M12 8.5v7M8.5 12h7'/></svg>",
    home: "<svg viewBox='0 0 24 24'><path d='M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z'/></svg>",
    plus: "<svg viewBox='0 0 24 24'><circle cx='12' cy='12' r='9'/><path d='M12 8v8M8 12h8'/></svg>",
    sliders: "<svg viewBox='0 0 24 24'><path d='M4 7h9M19 7h1M4 17h1M11 17h9'/><circle cx='16' cy='7' r='2.5'/><circle cx='8' cy='17' r='2.5'/></svg>",
    check: "<svg viewBox='0 0 24 24'><path d='M5 12.5l4.2 4.2L19 7'/></svg>",
    doc: "<svg viewBox='0 0 24 24'><path d='M7 3h7l4 4v14H7z'/><path d='M14 3v4h4M9.5 13h5M9.5 17h5'/></svg>",
    refresh: "<svg viewBox='0 0 24 24'><path d='M20 12a8 8 0 1 1-2.5-5.8'/><path d='M20 4v5h-5'/></svg>",
    wifi: "<svg viewBox='0 0 24 24'><path d='M3 9a14 14 0 0 1 18 0M6 12.5a9.5 9.5 0 0 1 12 0M9 16a5 5 0 0 1 6 0'/><circle cx='12' cy='19' r='.8'/><path d='M4 4l16 16'/></svg>",
    wave: "<svg viewBox='0 0 24 24'><path d='M3 9v6M7 6v12M12 3v18M17 6v12M21 9v6'/></svg>"
  };
  function ic(k) { return "<i class='gd-ic'>" + IC[k] + "</i>"; }
  function tabs(active) {
    return "<div class='gd-tabs'>" + [["dash", "Accueil", "home"], ["add", "Ajouter", "plus"], ["set", "Réglages", "sliders"]].map(function (t) {
      return "<span class='gd-tab" + (t[0] === active ? " on" : "") + "'>" + ic(t[2]) + "<b>" + t[1] + "</b></span>";
    }).join("") + "</div>";
  }
  function metric(label, val, unit, pct, mark) {
    return "<div class='gd-m'><small>" + label + "</small><b>" + val + " <u>" + unit + "</u></b><div class='gd-bar'><i style='width:" + pct + "%'></i>" +
      (mark ? "<s style='left:" + mark + "%'></s>" : "") + "</div></div>";
  }

  /* ---------- Illustrations ---------- */
  var V = {
    install: function () {
      return "<div class='gd-flow'><div class='gd-tile pulse'>" + ic("share") + "<b>Partager</b></div><span class='gd-arrow'>›</span>" +
        "<div class='gd-tile'>" + ic("add") + "<b>Sur l'écran d'accueil</b></div><span class='gd-arrow'>›</span>" +
        "<div class='gd-tile'><img src='icon-180.png' alt=''><b>Notes</b></div></div>" +
        "<p class='gd-cap'>Dans Safari, pas dans Moodle</p>";
    },
    config: function () {
      var ok = function (t) { return "<div class='gd-r'><b>" + t + "</b>" + IC.check + "</div>"; };
      return "<div class='gd-list'>" + ok("Ton gymnase") + ok("2e année") + ok("Allemand · Anglais") + ok("OS Économie et droit") +
        "<div class='gd-r off'><span><b>OS Latin</b><small>Tu as déjà le latin en L3</small></span></div></div>";
    },
    add: function () {
      return "<div class='gd-form'><div class='gd-f'><small>Branche</small><span>Mathématiques (renforcé)</span></div>" +
        "<div class='gd-2'><div class='gd-f hl'><small>Note (1 à 6)</small><span>4.75</span></div><div class='gd-f'><small>Date</small><span>06.11.2026</span></div></div>" +
        "<div class='gd-chips'><span>× 1</span><span class='on'>× 0.5</span><span>× 1/3</span><span>× 0.25</span></div>" +
        "<span class='gd-btn'>Ajouter</span></div>" + tabs("add");
    },
    edit: function () {
      return "<div class='gd-notes'><div class='gd-n'><b>5.5</b><span>Physique OS · Test C</span><i><em>Modifier</em><em class='red'>Supprimer</em></i></div>" +
        "<div class='gd-n'><b class='crit'>3.5</b><span>Histoire · Droits de l'homme</span><i><em>Modifier</em><em class='red conf'>Confirmer ?</em></i></div></div>" +
        "<p class='gd-cap'>Une seconde touche confirme la suppression</p>";
    },
    promo: function () {
      return "<div class='gd-pr'><span class='gd-pill'>Promotion assurée</span>" +
        metric("Total des notes", "32.0", "/ 66", 48, 67) + metric("Groupe FR + L2/L3 + maths + OS", "19.0", "/ 24", 79, 67) + metric("Notes inférieures à 4", "1", "/ 4 max", 20) + "</div>";
    },
    bars: function () {
      var vals = [["Fr.", 4, "w"], ["All.", 3.5, "c"], ["Angl.", 4.5, "g"], ["Maths", 5.5, "g"], ["OS", 5, "g"], ["Hist.", 4.5, "g"], ["Art", 6, "g"]];
      var Y = function (v) { return 118 - (v - 1) / 5 * 96; }, x0 = 22, sl = 38, out = "";
      out += "<line x1='14' x2='292' y1='" + Y(4) + "' y2='" + Y(4) + "' class='thr'/>";
      vals.forEach(function (b, i) {
        var x = x0 + i * sl, y = Y(b[1]);
        out += "<g class='b " + b[2] + "'><rect x='" + x + "' y='" + y + "' width='24' height='" + (118 - y) + "' rx='5'/><text x='" + (x + 12) + "' y='" + (y - 4) + "' class='v'>" + b[1] + "</text><text x='" + (x + 12) + "' y='134' class='l'>" + b[0] + "</text></g>";
      });
      return "<svg viewBox='0 0 300 142' class='gd-svg'>" + out + "<text x='296' y='" + (Y(4) - 3) + "' class='t' text-anchor='end'>4</text></svg>" +
        "<div class='gd-legend'><span class='g'>≥ 4.5</span><span class='w'>4</span><span class='c'>&lt; 4</span></div>";
    },
    card: function () {
      return "<div class='gd-card'><div class='gd-ch'><b>Mathématiques</b><small>5 pér.</small></div><div class='gd-cb'><span class='big'>4.5</span>" +
        "<svg viewBox='0 0 96 36' width='86' height='32'><line x1='0' x2='96' y1='20' y2='20' class='thr'/><path d='M4 28 L26 22 L50 24 L72 12 L92 9' class='ln'/><circle cx='92' cy='9' r='3' class='pt'/></svg></div>" +
        "<small>moy. exacte <b>4.67</b></small><small>4 notes sur 6 min.</small><small>objectif 5.5 · <b>−0.83</b></small><em>Voir le détail ›</em></div>";
    },
    watch: function () {
      return "<div class='gd-seg'><span class='on'>Année</span><span>Semestre 1</span><span>Semestre 2</span></div>" +
        "<div class='gd-alert'><b>Français</b> : moy. 4.00, proche du seuil de 4</div>" +
        "<svg viewBox='0 0 280 64' class='gd-svg line'><line x1='6' x2='274' y1='38' y2='38' class='thr'/><path d='M8 50 C50 46 70 30 110 34 S190 18 230 22 S262 14 272 12' class='ln'/><circle cx='272' cy='12' r='3.5' class='pt'/></svg>";
    },
    round: function () {
      var it = [["4.24", "4"], ["4.25", "4.5"], ["4.74", "4.5"], ["4.75", "5"]];
      return "<div class='gd-rd'>" + it.map(function (i) { return "<div><b>" + i[0] + "</b><i>→</i><span>" + i[1] + "</span></div>"; }).join("") + "</div>" +
        "<p class='gd-cap'>Arrondi au demi-point, vers le haut dès x,25 et x,75</p>";
    },
    tp: function () {
      return "<div class='gd-tpbar'><span style='flex:75'>Tests 75 %</span><span class='tp' style='flex:25'>TP 25 %</span></div>" +
        "<div class='gd-chips'><span>coef × 1</span><span class='on'>coef × 0.5</span><span>coef × 0.25</span></div>" +
        "<p class='gd-cap'>Une note × 0.5 compte moitié moins</p>";
    },
    os: function () {
      return "<div class='gd-os'><div class='bx'><small>Physique OS · 2,5 pér.</small><b>4.88</b></div><i>+</i><div class='bx'><small>Applications des maths · 2 pér.</small><b>5.00</b></div></div>" +
        "<div class='gd-os res'><div class='bx'><small>Note d'OS (moyenne pondérée)</small><b>4.93 → 5</b></div></div>";
    },
    settings: function () {
      return "<div class='gd-set'><div class='gd-sr'><b>Physique</b><small>3 pér. · objectif 5.5 · TP 25 %</small></div>" +
        "<div class='gd-sf'><span>Périodes</span><em>3</em></div><div class='gd-sf'><span>Objectif</span><em>5.5</em></div>" +
        "<div class='gd-sf'><span>Part des TP (%)</span><em>25</em></div><div class='gd-sf'><span>Compte pour la promotion</span><i class='gd-sw'><u></u></i></div></div>";
    },
    backup: function () {
      return "<div class='gd-bk'><div class='gd-file'>" + ic("doc") + "<b>notes-sauvegarde.json</b></div>" +
        "<div class='gd-bkb'><span class='gd-btn'>Exporter</span><span class='gd-btn ghost'>Importer un fichier</span></div></div>" +
        "<p class='gd-cap'>Fichiers · AirDrop · e-mail</p>";
    },
    sync: function () {
      return "<div class='gd-sy'><div class='ph'><u></u><small>iPhone</small></div><div class='code'><small>Ton code</small><b class='mono'>K7QM-2XRT-9WPD-4HNC</b><span class='gd-lock'>chiffré avec ton code</span></div><div class='ph'><u></u><small>Autre appareil</small></div></div>";
    },
    tips: function () {
      var r = function (k, t) { return "<div class='gd-tp'>" + ic(k) + "<span>" + t + "</span></div>"; };
      return "<div class='gd-tips'>" + r("refresh", "App pas à jour ? Ferme-la complètement, rouvre-la deux fois") + r("wifi", "« Hors connexion » : tes notes restent sur le téléphone") + r("wave", "Vibrations : Réglages → Retours haptiques") + "</div>";
    }
  };

  /* ---------- Contenu ---------- */
  var CH = [
    { t: "Prise en main", d: "4 min", s: [
      { t: "Installe l'app", v: "install", p: [
        "Ouvre le lien dans <b>Safari</b> (pas dans Moodle ni dans une autre app), touche <b>Partager</b>, puis <b>Sur l'écran d'accueil</b> et <b>Ajouter</b>.",
        "Ouvre ensuite <b>Notes</b> depuis ton écran d'accueil : c'est là que tes notes seront enregistrées. Celles saisies dans Safari ne se retrouvent pas dans l'icône."] },
      { t: "Fais la configuration", v: "config", p: [
        "Réponds aux questions : gymnase, année, langues (L2 et L3), option spécifique, niveau de maths, discipline artistique, et option complémentaire en 3e.",
        "L'app crée tes branches avec leurs périodes. Les choix impossibles sont grisés, avec la raison. Tu pourras tout changer dans <b>Réglages → Modifier mon profil</b>."] },
      { t: "Ajoute une note", v: "add", p: [
        "Touche <b>Ajouter</b> en bas, choisis la branche, tape la note (de 1 à 6, décimales possibles, par exemple 4.75) et la date.",
        "Choisis le <b>coefficient</b> avec les boutons (× 0.5, × 1/3…) ou tape-le toi-même, puis le type <b>Test</b> ou <b>TP</b> et un intitulé si tu veux. Touche <b>Ajouter</b> : une coche confirme.",
        "<span class='note'>Pas encore de notes ? Sur le tableau de bord vide, touche « Voir avec des notes d'exemple » pour essayer l'app avec des notes fictives, non enregistrées.</span>"] },
      { t: "Modifie ou supprime une note", v: "edit", p: [
        "Dans <b>Dernières notes</b> (et dans le détail d'une branche), <b>Modifier</b> rouvre le formulaire déjà rempli.",
        "<b>Supprimer</b> demande une seconde touche (« Confirmer ? ») pour éviter les fausses manœuvres."] }
    ] },
    { t: "Comprendre le tableau de bord", d: "3 min", s: [
      { t: "Le verdict de promotion", v: "promo", p: [
        "En haut, un verdict : <b>Promotion assurée</b>, <b>Marge faible</b>, <b>Cas limite</b> ou <b>En danger</b>, calculé sur toutes tes notes.",
        "Trois indicateurs : le <b>total des notes</b> (au moins 4 × le nombre de notes), le <b>groupe</b> français + L2/L3 + maths + OS (au moins 16) et le nombre de <b>notes sous 4</b> (4 au maximum). Le trait noir marque le seuil.",
        "<span class='note'>En 3e année, il n'y a pas de verdict : le certificat dépend aussi des examens.</span>"] },
      { t: "Les moyennes par branche", v: "bars", p: [
        "Chaque barre est la <b>note de bulletin</b> d'une branche, arrondie au demi-point. Le trait pointillé marque le 4.",
        "<b>Vert</b> dès 4.5, <b>orange</b> pour 4, <b>rouge</b> sous 4. Si tu as fixé un objectif, il apparaît en pointillés gris. Touche une barre pour ouvrir le détail de la branche."] },
      { t: "Les cartes et le détail", v: "card", p: [
        "Chaque carte montre la <b>note de bulletin</b> (le gros chiffre), la moyenne exacte, le nombre de notes saisies sur le minimum conseillé et l'écart avec ton objectif.",
        "Touche une carte : le détail affiche année, semestre 1 et semestre 2, la courbe et toutes les notes. Sous 4, l'app indique la note à viser au prochain test pour remonter à 4."] },
      { t: "Alertes, graphique et périodes", v: "watch", p: [
        "<b>À surveiller</b> liste les branches sous 4 ou proches du seuil. Le graphique suit l'évolution de la moyenne générale, ou d'une seule branche (menu au-dessus).",
        "Les boutons <b>Année</b>, <b>Semestre 1</b> et <b>Semestre 2</b> filtrent tout le tableau de bord. Règle la date de fin du semestre 1 dans Réglages."] }
    ] },
    { t: "Règles de calcul", d: "1 min", s: [
      { t: "Moyenne et arrondi", v: "round", p: [
        "Ta moyenne est <b>cumulée depuis septembre</b> : ce n'est pas la moyenne de deux semestres. La note de bulletin est arrondie au <b>demi-point</b>, vers le haut dès x,25 et x,75."] },
      { t: "Coefficients et TP", v: "tp", p: [
        "Chaque note a un <b>coefficient</b>. Dans les branches de sciences, les <b>TP comptent pour 25 %</b> et les tests pour 75 % par défaut : le canton ne fixe pas cette part, change-la dans Réglages si ton prof fait autrement."] },
      { t: "Options à deux parties", v: "os", p: [
        "Certaines options (physique et applications des maths, biologie et chimie, philosophie et psychologie) mélangent leurs deux parties selon leurs périodes, puis arrondissent <b>une seule fois</b>.",
        "Le minimum de notes est <b>périodes + 1</b> : l'app te prévient s'il t'en manque. <span class='note'>Vérifie toujours avec le vade-mecum de ton gymnase.</span>"] }
    ] },
    { t: "Gérer tes données", d: "3 min", s: [
      { t: "Réglages par branche", v: "settings", p: [
        "Dans <b>Réglages</b>, touche une branche pour régler ses <b>périodes</b>, ton <b>objectif</b>, la <b>part des TP</b> et l'interrupteur <b>Compte pour la promotion</b> (utile si ton gymnase ne compte pas l'informatique).",
        "Pour changer d'année, de langue ou d'option, utilise <b>Modifier mon profil</b>."] },
      { t: "Sauvegarde : exporter et importer", v: "backup", p: [
        "Tes notes sont dans la mémoire de l'app, sur ton téléphone. <b>Si tu supprimes l'icône, elles disparaissent.</b>",
        "<b>Réglages → Sauvegarde → Exporter</b> crée un fichier à garder (Fichiers, AirDrop, e-mail). <b>Importer un fichier</b> remplace les notes de l'appareil par celles du fichier."] },
      { t: "Synchroniser plusieurs appareils", v: "sync", p: [
        "<b>Réglages → Synchronisation → Activer la synchronisation</b> affiche un code de 16 caractères. Sur ton autre appareil, touche <b>J'ai déjà un code</b> et tape-le.",
        "Tes notes sont chiffrées avec ce code : personne d'autre ne peut les lire. <b>Garde-le précieusement et ne le partage pas</b> : il ne peut pas être récupéré."] },
      { t: "Vibrations et dépannage", v: "tips", p: [
        "Coupe ou remets les vibrations dans <b>Réglages → Retours haptiques</b> (iOS 18 ou plus récent). Pour que le clavier vibre aussi : réglages de l'iPhone → Sons et vibrations → Retour clavier.",
        "Si l'app ne semble pas à jour, ferme-la complètement (balaie-la vers le haut) et rouvre-la <b>deux fois</b>. « Hors connexion » veut dire que le réseau ou le serveur n'est pas disponible : tes notes restent sur ton téléphone et se synchroniseront plus tard."] }
    ] }
  ];

  /* ---------- Affichage ---------- */
  var root = null, view = "list", c = 0, s = 0, dir = 1, onClose = null;

  function allDone() { return CH.every(function (_, i) { return st.done.indexOf(i) >= 0; }); }
  function doneCount() { return CH.filter(function (_, i) { return st.done.indexOf(i) >= 0; }).length; }
  function haptic(k) { if (window.FX) window.FX.haptic(k); }

  function paint() {
    var h = "", b;
    if (view === "list") {
      var n = doneCount(), resume = st.last && !allDone();
      h = "<div class='gd-top'><span></span><button type='button' class='link' data-gd='close'>Fermer</button></div>" +
        "<div class='gd-body'><h1 class='ob-title'>Guide d'utilisation</h1><p class='ob-sub'>" + CH.length + " chapitres, environ 10 minutes.</p>" +
        "<div class='gd-prog'><i style='width:" + Math.round(n / CH.length * 100) + "%'></i></div><p class='gd-count'>" + n + " sur " + CH.length + " chapitres terminés</p>" +
        "<div class='gd-chs'>" + CH.map(function (ch, i) {
          var d = st.done.indexOf(i) >= 0;
          return "<button type='button' class='gd-chr" + (d ? " is-ok" : "") + "' data-gd='chapter' data-i='" + i + "'><span class='gd-num'>" + (d ? IC.check : i + 1) + "</span>" +
            "<span class='ob-txt'><span class='ob-n'>" + ch.t + "</span><small>" + ch.s.length + " étapes · " + ch.d + "</small></span><span class='gd-go'>›</span></button>";
        }).join("") + "</div></div>" +
        "<div class='gd-foot'><button type='button' class='btn' data-gd='start'>" + (allDone() ? "Revoir depuis le début" : resume ? "Reprendre" : "Commencer") + "</button></div>";
    } else if (view === "step") {
      var ch = CH[c], stp = ch.s[s], last = s === ch.s.length - 1;
      h = "<div class='gd-top'><button type='button' class='link' data-gd='list'>‹ Chapitres</button>" +
        "<div class='gd-dots' aria-hidden='true'>" + ch.s.map(function (_, i) { return "<i class='" + (i === s ? "on" : i < s ? "past" : "") + "'></i>"; }).join("") + "</div>" +
        "<button type='button' class='link' data-gd='close'>Fermer</button></div>" +
        "<div class='gd-body'><p class='gd-kick'>Chapitre " + (c + 1) + " · " + ch.t + " · Étape " + (s + 1) + " sur " + ch.s.length + "</p>" +
        "<div class='gd-vis' aria-hidden='true'>" + V[stp.v]() + "</div>" +
        "<h1 class='gd-title'>" + stp.t + "</h1><div class='gd-text'>" + stp.p.map(function (t) { return t.indexOf("<span class='note'>") === 0 ? "<p class='note'>" + t.replace(/^<span class='note'>|<\/span>$/g, "") + "</p>" : "<p>" + t + "</p>"; }).join("") + "</div></div>" +
        "<div class='gd-foot'>" + (s > 0 || c > 0 ? "<button type='button' class='btn-ghost' data-gd='prev'>Précédent</button>" : "") +
        "<button type='button' class='btn' data-gd='next'>" + (last ? "Terminer le chapitre" : "Suivant") + "</button></div>";
      st.last = { c: c, s: s }; save();
    } else {
      var lastCh = c === CH.length - 1;
      h = "<div class='gd-top'><span></span><button type='button' class='link' data-gd='close'>Fermer</button></div>" +
        "<div class='gd-body'><div class='gd-done'><svg viewBox='0 0 24 24' aria-hidden='true'><circle cx='12' cy='12' r='10'/><path d='M7 12.5l3.2 3.2L17 9'/></svg>" +
        "<h1 class='gd-title'>" + (allDone() ? "Formation terminée" : "Chapitre terminé") + "</h1>" +
        "<p class='ob-sub'>" + (allDone() ? "Tu connais maintenant toutes les fonctions de l'app. Tu peux rouvrir ce guide quand tu veux dans Réglages." : "« " + CH[c].t + " » est fait. " + (lastCh ? "" : "Suite : « " + CH[c + 1].t + " ».")) + "</p></div></div>" +
        "<div class='gd-foot'>" + (allDone() ? "<button type='button' class='btn' data-gd='close'>Terminer</button>" :
          (lastCh ? "<button type='button' class='btn' data-gd='list'>Retour à la liste</button>" :
            "<button type='button' class='btn-ghost' data-gd='list'>Liste</button><button type='button' class='btn' data-gd='nextch'>Chapitre suivant</button>")) + "</div>";
    }
    root.innerHTML = h;
    root.scrollTop = 0;
    b = $(".gd-body", root);
    if (canAnim() && b) {
      M.animate(b, { opacity: [0, 1], x: [dir * 34, 0] }, { type: "spring", stiffness: 340, damping: 30 });
      var kids = $$(".gd-vis > *, .gd-chr, .gd-done > *", b);
      if (kids.length) M.animate(kids, { opacity: [0, 1], y: [12, 0], scale: [0.96, 1] }, { delay: M.stagger(0.045, { startDelay: 0.08 }), type: "spring", stiffness: 360, damping: 28 });
    }
  }

  function go(v, d) { view = v; dir = d || 1; paint(); }

  function open(opts) {
    if (root) return;
    opts = opts || {};
    onClose = opts.onClose || null;
    root = document.createElement("div");
    root.className = "gd"; root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true"); root.setAttribute("aria-label", "Guide d'utilisation");
    document.body.appendChild(root);
    document.body.classList.add("gd-open");
    root.addEventListener("click", function (e) {
      var t = e.target.closest("[data-gd]"); if (!t) return;
      var a = t.dataset.gd;
      if (a === "close") return close();
      if (a === "list") return go("list", -1);
      if (a === "chapter") { c = parseInt(t.dataset.i, 10); s = 0; return go("step", 1); }
      if (a === "start") {
        var l = st.last && !allDone() ? st.last : { c: 0, s: 0 };
        c = Math.min(CH.length - 1, l.c); s = Math.min(CH[c].s.length - 1, l.s); return go("step", 1);
      }
      if (a === "prev") { if (s > 0) { s--; } else if (c > 0) { c--; s = CH[c].s.length - 1; } return go("step", -1); }
      if (a === "next") {
        if (s < CH[c].s.length - 1) { s++; return go("step", 1); }
        if (st.done.indexOf(c) < 0) st.done.push(c);
        st.last = c < CH.length - 1 ? { c: c + 1, s: 0 } : null; save(); haptic("success");
        return go("done", 1);
      }
      if (a === "nextch") { c++; s = 0; return go("step", 1); }
    });
    if (canAnim()) M.animate(root, { opacity: [0, 1], y: [24, 0] }, { type: "spring", stiffness: 320, damping: 30 });
    if (opts.start) {
      var l = st.last && !allDone() ? st.last : { c: 0, s: 0 };
      c = Math.min(CH.length - 1, l.c); s = Math.min(CH[c].s.length - 1, l.s); view = "step";
    } else view = "list";
    dir = 1; paint();
  }

  function close() {
    var el = root; if (!el) return;
    var completed = allDone(), cb = onClose, gone = false;
    root = null; onClose = null;
    function done() { if (gone) return; gone = true; el.remove(); document.body.classList.remove("gd-open"); refreshEntry(); if (cb) cb({ completed: completed }); }
    if (canAnim()) { M.animate(el, { opacity: [1, 0], y: [0, 24] }, { duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }).then(done); setTimeout(done, 450); }
    else done();
  }

  /* ---------- Réglages : entrée du guide + « À propos » ---------- */
  function refreshEntry() {
    var el = document.getElementById("gd-sum"), b = document.getElementById("gd-open"); if (!el || !b) return;
    var n = doneCount();
    el.textContent = "Une formation en " + CH.length + " chapitres : notes, tableau de bord, règles de calcul, sauvegarde. " + (n ? n + " sur " + CH.length + " terminés." : "");
    b.textContent = n === CH.length ? "Revoir le guide" : n || st.last ? "Continuer le guide" : "Ouvrir le guide";
  }
  function mountSettings() {
    var host = document.getElementById("set-block"); if (!host) return;
    if (!document.getElementById("gd-open")) {
      var a = document.createElement("div"); a.className = "backup";
      a.innerHTML = "<h3>Guide d'utilisation</h3><p class='muted small' id='gd-sum'></p><div class='btns'><button type='button' class='btn' id='gd-open'>Ouvrir le guide</button></div>";
      host.insertBefore(a, host.firstChild);
      document.getElementById("gd-open").addEventListener("click", function () { open({}); });
    }
    if (!document.getElementById("about")) {
      var d = document.createElement("div"); d.className = "backup about"; d.id = "about";
      d.innerHTML = "<h3>À propos</h3>" +
        "<p class='muted small'><b>" + DISCLAIMER.split(". ")[0] + ".</b> " + DISCLAIMER.split(". ")[1] + "</p>" +
        "<p class='muted small'><b>Tes données.</b> Tes notes et ton profil restent sur ton téléphone : l'app n'a pas de compte et ne collecte aucune donnée personnelle. Si tu supprimes l'icône, ils sont effacés, pense donc à exporter une sauvegarde.</p>" +
        "<p class='muted small'>La synchronisation est facultative : elle envoie une copie chiffrée avec ton code, que personne d'autre ne peut lire. Cette copie est stockée chez Cloudflare. Le site est hébergé par GitHub, qui peut enregistrer des données techniques de connexion comme tout site web.</p>" +
        "<p class='gd-copy'>©mutter</p>";
      host.appendChild(d);
    }
    refreshEntry();
  }

  window.Guide = { open: open, allDone: allDone, disclaimer: DISCLAIMER, progress: doneCount };
  mountSettings();
})();
