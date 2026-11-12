/* Notes — guide d'utilisation (formation en chapitres) + « À propos » dans Réglages. */
(function () {
  "use strict";
  // Animations d'entrée (remises en v44) : IOSMotion.animate ne fait rien avec ?noanim=1 ou « Réduire les animations ».
  function A(t, kf, o) { return window.IOSMotion ? window.IOSMotion.animate(t, kf, o) : Promise.resolve(); }
  function ST(step, o) { return window.IOSMotion ? window.IOSMotion.stagger(step, o) : 0; }
  function canAnim() { return !!(window.IOSMotion && window.IOSMotion.canAnim()); }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  var KEY = "notes2m01.guide";
  var st = { done: [], last: null };
  try { var raw = JSON.parse(localStorage.getItem(KEY) || "null"); if (raw && Array.isArray(raw.done)) st = { done: raw.done, last: raw.last || null }; } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }

  var DISCLAIMER = "Application non officielle. Résultats indicatifs : seul ton bulletin fait foi.";

  /* ---------- Icônes ---------- */
  function lu(n) { return window.Icons.svg(n); }   // banque d'icônes (icons.js, Lucide)
  var IC = { share: lu("share"), add: lu("addhome"), home: lu("home"), plus: lu("add"), sliders: lu("settings"), check: lu("check"), doc: lu("doc"),
    refresh: lu("sync"), wifi: lu("wifioff"), wave: lu("wave"), camera: lu("camera"), bell: lu("bell"), people: lu("people"), phone: lu("phone") };
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
        "<div class='gd-2'><div class='gd-f gd-hl'><small>Note (1 à 6)</small><span>4.75</span></div><div class='gd-f'><small>Date</small><span>06.11.2026</span></div></div>" +
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
      return "<div class='gd-os'><div class='bx'><small>Physique OS · 2.5 pér.</small><b>4.88</b></div><i>+</i><div class='bx'><small>Applications des maths · 2 pér.</small><b>5.00</b></div></div>" +
        "<div class='gd-os res'><div class='bx'><small>Note d'OS (moyenne pondérée)</small><b>4.93 → 5</b></div></div>";
    },
    settings: function (hl) {
      var row = function (k, label, val) { return "<div class='gd-sf" + (hl === k ? " gd-hl" : "") + "'><span>" + label + "</span>" + val + "</div>"; };
      return "<div class='gd-set'><div class='gd-sr'><b>Physique</b><small>3 pér. · objectif 5.5 · TP 25 %</small></div>" +
        row("per", "Périodes", "<em>3</em>") + row("goal", "Objectif", "<em>5.5</em>") + row("tp", "Part des TP (%)", "<em>25</em>") +
        row("count", "Compte pour la promotion", "<i class='gd-sw'><u></u></i>") + "</div>";
    },
    profil: function () {
      var r = function (l, v) { return "<div class='gd-r'><b>" + l + "</b><small class='gd-val'>" + v + " ›</small></div>"; };
      return "<div class='gd-list'>" + r("Gymnase", "Bugnon") + r("Classe", "2M01") + r("Troisième langue", "Anglais") + r("Option spécifique", "Économie et droit") + r("Mathématiques", "Standard") + "</div>" +
        "<p class='gd-cap'>Chaque ligne s'enregistre tout de suite</p>";
    },
    year: function () {
      return "<div class='gd-set gd-pad'><b class='gd-h'>Année scolaire</b><small class='gd-mut'>Tes notes de l'année sont classées, rien n'est supprimé</small>" +
        "<span class='gd-btn'>Passer en 3e année</span></div>";
    },
    ta: function () {
      return "<div class='gd-notes'><div class='gd-n'><b>4.5</b><span>TA Vocabulaire · 3 ETA · en points</span></div>" +
        "<div class='gd-n gd-sub'><b>12 / 20</b><span>Chapitre 1</span></div><div class='gd-n gd-sub'><b>20 / 20</b><span>Chapitre 2</span></div><div class='gd-n gd-sub'><b>4 / 10</b><span>Chapitre 3</span></div></div>" +
        "<p class='gd-cap'>Un TA compte comme une seule note de coefficient 1</p>";
    },
    tapts: function () {
      var it = [["0 %", "1"], ["60 %", "4"], ["80 %", "5"], ["100 %", "6"]];
      return "<div class='gd-rd'>" + it.map(function (x) { return "<div><b>" + x[0] + "</b><i>→</i><span>" + x[1] + "</span></div>"; }).join("") + "</div>" +
        "<p class='gd-cap'>Exemple avec 60 % des points pour avoir 4</p>";
    },
    photos: function () {
      return "<div class='gd-form'><div class='gd-thumbs'><i></i><i></i><i></i></div><span class='gd-btn ghost'>" + "Ajouter une page</span></div>" +
        "<div class='gd-tips'><div class='gd-tp'>" + ic("camera") + "<span>Les photos restent sur cet appareil</span></div></div>";
    },
    detail: function () {
      return "<div class='gd-card gd-wide'><div class='gd-cb'><span class='big'>4.5</span>" +
        "<svg viewBox='0 0 96 36' width='120' height='44'><line x1='0' x2='96' y1='20' y2='20' class='thr'/><path d='M4 28 L26 22 L50 24 L72 12 L92 9' class='ln'/><circle cx='92' cy='9' r='3' class='pt'/></svg></div>" +
        "<small><b>Moyenne de l'année</b></small><small>exacte 4.67 · 4 notes</small><small>Objectif 5.5 : <b>−0.83</b></small></div>" +
        "<div class='gd-notes'><div class='gd-n'><b>5</b><span>Test chap. 3 · 06.11.2026 · coef 1 · 2 photos</span></div></div>";
    },
    scrub: function () {
      return tabs("add") + "<p class='gd-cap'>Appui long, glisse, relâche sur l'onglet voulu</p>";
    },
    notif: function () {
      return "<div class='gd-banner'><img src='icon-180.png' alt=''><span><b>Nouvelle note · Français</b><small>Note : 4.5 · Moyenne : 4.17</small></span></div>" +
        "<div class='gd-tips'><div class='gd-tp'>" + ic("bell") + "<span>Réglages → Synchronisation → Activer les notifications</span></div></div>";
    },
    parents: function () {
      return "<div class='gd-flow'><div class='gd-tile'><img src='icon-180.png' alt=''><b>Installer Notes</b></div><span class='gd-arrow'>›</span>" +
        "<div class='gd-tile pulse'>" + ic("people") + "<b>Entrer le code</b></div><span class='gd-arrow'>›</span>" +
        "<div class='gd-tile'>" + ic("bell") + "<b>Activer les notifications</b></div></div>" +
        "<p class='gd-cap'>Même app, même code que l'élève</p>";
    },
    mute: function () {
      return "<div class='gd-set'><div class='gd-sf gd-hl'><span>Tout couper</span><i class='gd-sw'><u></u></i></div></div>" +
        "<div class='gd-sy'><div class='code'><span class='gd-lock'>message chiffré avec le code</span></div></div>";
    },
    semestre: function () {
      return "<div class='gd-set gd-pad'><small class='gd-mut'>Fin du semestre 1</small><div class='gd-f gd-hl'><span>22.01.2027</span></div></div>" +
        "<div class='gd-seg'><span>Année</span><span class='on'>Semestre 1</span><span>Semestre 2</span></div>";
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
        "Ouvre le lien dans <b>Safari</b>, touche <b>Partager</b>, puis <b>Sur l'écran d'accueil</b> et <b>Ajouter</b>.",
        "Ouvre ensuite toujours l'app par son icône <b>Notes</b> : ce que tu saisis dans Safari ne se retrouve pas dans l'app installée."] },
      { t: "Fais la configuration", v: "config", p: [
        "Choisis ton gymnase, ton année, tes langues, ton option spécifique, ton niveau de maths et ta discipline artistique (et l'option complémentaire en 3e).",
        "L'app crée tes branches avec leurs périodes. Un choix impossible est grisé, avec la raison. Tu pourras tout changer plus tard dans <b>Réglages → Profil</b>."] },
      { t: "Ajoute une note", v: "add", p: [
        "Touche <b>Ajouter</b> en bas, choisis la branche, tape la note (de 1 à 6, par exemple 4.75) et la date.",
        "Règle le <b>coefficient</b> (boutons × 1, × 0.5, × 1/3, × 0.25, ou tape-le) et le type <b>Test</b>, <b>TP</b> ou <b>TA</b>, puis touche <b>Ajouter</b>. Un court écran confirme la note, puis tu reviens à l'Accueil."] },
      { t: "Un TA et ses ETA", v: "ta", p: [
        "Un <b>TA</b> (travail assimilé) regroupe des petites évaluations, les <b>ETA</b>. Choisis le type <b>TA</b>, puis un TA existant ou <b>+ Nouveau TA…</b>, et saisis l'ETA.",
        "À la création, <b>Noter en points</b> te fait saisir des points obtenus et des points max au lieu d'une note. Dans la liste, le TA se déplie : tu y ajoutes un ETA, tu le renommes ou tu le supprimes."] },
      { t: "Photographie ton test", v: "photos", p: [
        "Dans le formulaire, <b>Photographier le test</b> ouvre le scanner : cadre la feuille entière, l'app repère ses bords et prend la page toute seule quand tu ne bouges plus, puis la redresse. Présente la page suivante, ou touche <b>Terminé</b>. Le bouton rond prend la page à la main, et <b>Choisir une photo</b> passe par ta photothèque.",
        "Ensuite, touche la note dans le détail de la branche pour revoir les pages en plein écran, en ajouter ou en supprimer.",
        "<span class='note'>Les photos restent sur cet appareil : elles ne sont ni synchronisées ni dans la sauvegarde. Changer d'iPhone ou supprimer l'icône de l'app les fait perdre. La note, elle, est toujours tapée à la main.</span>"] },
      { t: "Corrige ou supprime", v: "edit", p: [
        "Dans <b>Dernières notes</b> ou dans le détail d'une branche : <b>Modifier</b> rouvre la note, <b>Supprimer</b> demande une seconde touche (« Confirmer ? »). Supprimer une note supprime aussi ses photos."] }
    ] },
    { t: "Lire le tableau de bord", d: "3 min", s: [
      { t: "Le verdict de promotion", v: "promo", p: [
        "Le verdict (<b>Promotion assurée</b>, <b>Marge faible</b>, <b>Cas limite</b> ou <b>En danger</b>) vérifie trois règles : total des notes, groupe français + L2/L3 + maths + OS d'au moins 16, et 4 notes sous 4 au maximum. Tant qu'une branche n'a aucune note, il reste sur <b>Verdict incomplet</b>.",
        "<span class='note'>En 3e année, ce verdict est remplacé par celui du certificat de maturité (étape suivante).</span>"] },
      { t: "En 3e : le certificat de maturité", v: "promo", p: [
        "En 3e, l'en-tête montre une pastille (<b>Bonne voie</b>, <b>Serré</b> ou <b>Compliqué</b>, puis <b>Maturité réussie</b> ou <b>non réussie</b> quand tous les examens sont saisis) et trois jauges : le <b>total des 14 notes avec double compensation</b> (seuil 56), le <b>total des examens</b> (seuil 38.5) et les <b>notes sous 4</b> (4 au maximum).",
        "Les examens se saisissent dans le <b>détail de chaque branche</b> : entre l'écrit et l'oral, et lis la <b>note minimale</b> à viser pour avoir 4 dans la branche.",
        "Chimie, physique et la discipline artistique gardent leur <b>note de 2e</b>. Pour la corriger, va dans <b>Réglages → Notes reprises de 2e</b>."] },
      { t: "Tes branches", v: "bars", p: [
        "Chaque barre montre la <b>note de bulletin</b>, arrondie : <b>vert</b> dès 4.5, <b>orange</b> pour 4, <b>rouge</b> sous 4.",
        "Sur téléphone, la liste <b>Branches</b> se lit comme l'app Bourse : une ligne par branche avec une <b>mini-courbe</b> (verte si ta moyenne monte, rouge si elle baisse), la note de bulletin et une <b>pastille</b> qui montre l'effet de ta dernière note (+0.17, −0.30…). Elle suit la période choisie en haut. Touche une ligne pour ouvrir le détail."] },
      { t: "Le détail d'une branche", v: "detail", p: [
        "En haut : ta <b>moyenne exacte</b> et sa variation depuis la première note. Les boutons <b>S1</b>, <b>S2</b> et <b>Année</b> changent la période ; <b>glisse le doigt le long de la courbe</b>, comme dans l'app Bourse : une barre au-dessus de la courbe montre la date et ta moyenne à ce moment-là ; lève le doigt pour la faire disparaître. Dessous, les chiffres clés (bulletin, plus haute et plus basse note, semestres, objectif). Le <b>+</b> en haut à droite ajoute une note dans cette branche.",
        "Plus bas : les notes de la plus récente à la plus ancienne, chacune avec son effet sur ta moyenne (+0.17, −0.30…). <b>Touche une note</b> pour voir Modifier, Supprimer et ses photos. Un TA se déplie pour montrer ses ETA."] },
      { t: "Alertes et périodes", v: "watch", p: [
        "<b>À surveiller</b> liste les branches en difficulté. Les boutons <b>Année</b>, <b>Semestre 1</b> et <b>Semestre 2</b> filtrent tout le tableau de bord."] },
      { t: "La barre du bas", v: "scrub", p: [
        "Un appui court change d'onglet. Un <b>appui long</b> fait grossir la pastille : glisse-la sans lever le doigt et relâche sur l'onglet voulu.",
        "Si tu relâches le doigt bien au-dessus de la barre, rien ne change. Un <b>balayage rapide</b> sur la barre passe à l'onglet voisin, et toucher l'onglet déjà ouvert revient au début (Réglages revient à sa page principale).",
        "La barre reste toujours en bas, sauf dans le détail d'une branche, où elle s'efface (le chevron ou un glissement depuis le bord gauche te ramène). La <b>loupe</b> à droite cherche une branche : touche-la pour ouvrir son détail, ou <b>+</b> pour y ajouter une note. Un chiffre rouge sur Accueil compte les branches sous 4 et un point rouge sur Réglages signale une synchronisation en erreur."] }
    ] },
    { t: "Règles de calcul", d: "2 min", s: [
      { t: "Moyenne et arrondi", v: "round", p: [
        "La moyenne est <b>cumulée depuis septembre</b>. La note de bulletin est arrondie au <b>demi-point</b>, vers le haut dès x,25 et x,75."] },
      { t: "TP et options à deux parties", v: "tp", p: [
        "Les <b>TP</b> comptent pour 25 % par défaut. Une option à deux parties (par exemple physique et applications des maths) mélange ses parties selon leurs périodes, puis arrondit une seule fois.",
        "<span class='note'>Le détail est dans Réglages → Comment les moyennes sont calculées.</span>"] },
      { t: "La note d'un TA", v: "tapts", p: [
        "Un TA compte comme <b>une seule note de coefficient 1</b>, quel que soit le nombre d'ETA. Sans points, sa note est la moyenne des ETA, arrondie au demi-point.",
        "En points, l'app additionne tous les points et applique le <b>% du 4</b> du TA (60 % par défaut, de 10 à 90) : 0 % donne 1, ce pourcentage donne 4, 100 % donne 6, en ligne droite entre ces repères."] }
    ] },
    { t: "Les réglages", d: "4 min", s: [
      { t: "Ton profil", v: "profil", p: [
        "<b>Réglages → Profil</b> : chaque ligne (gymnase, classe, langues, option spécifique, maths, discipline artistique, et option complémentaire en 3e) ouvre une liste et <b>s'enregistre tout de suite</b>.",
        "Changer de langue, d'option ou de discipline artistique <b>supprime les notes de l'ancienne branche</b> : l'app te le demande d'abord et te propose d'exporter une sauvegarde. Changer de niveau de maths garde tes notes."] },
      { t: "Passer à l'année suivante", v: "year", p: [
        "L'année ne se change pas dans le profil : touche <b>Réglages → Année scolaire → Passer en 2e (ou 3e) année</b>.",
        "Tes notes de l'année sont <b>classées dans « Années précédentes »</b> (rien n'est supprimé), les moyennes repartent de zéro et les dates de semestre avancent d'un an. En passant en 3e, tu choisis ton option complémentaire, et les notes de 2e de chimie, physique et arts sont reprises pour le certificat.",
        "<b>Annuler le dernier passage</b> remet tout comme avant."] },
      { t: "Objectif", v: "settings:goal", p: [
        "Dans <b>Réglages → Branches</b>, touche une branche, puis règle son <b>Objectif</b> : la moyenne que tu vises.",
        "Le tableau de bord et le détail de la branche affichent alors ton écart, et une alerte apparaît si tu es nettement en dessous."] },
      { t: "Part des TP et périodes", v: "settings:tp", p: [
        "<b>Part des TP (%)</b> : 25 par défaut ; mets la valeur de ton prof, ou 0 pour que les TP comptent comme des notes ordinaires.",
        "<b>Périodes</b> : le nombre de périodes par semaine. Il fixe le minimum de notes conseillé (périodes + 1) et le poids de chaque partie dans une option à deux parties. Corrige-le seulement si ton horaire diffère de la grille officielle."] },
      { t: "Compte pour la promotion", v: "settings:count", p: [
        "Cet interrupteur ajoute ou retire la branche du verdict de promotion. Utile si ton gymnase ne compte pas une branche, par exemple l'informatique en 2e."] },
      { t: "Fin du semestre 1", v: "semestre", p: [
        "Indique la date de fin du semestre 1 de ton gymnase. Elle sépare les notes des boutons <b>Semestre 1</b> et <b>Semestre 2</b>."] },
      { t: "Sauvegarde", v: "backup", p: [
        "<b>Exporter</b> crée un fichier de toutes tes notes, TA et réglages (Fichiers, AirDrop). <b>Importer un fichier</b> remplace ce qu'il y a sur l'appareil.",
        "<b>Supprimer l'icône efface les notes</b> : exporte régulièrement. Les photos des tests ne sont pas dans la sauvegarde."] },
      { t: "Synchronisation", v: "sync", p: [
        "<b>Activer la synchronisation</b> donne un code de 16 caractères. Sur ton autre appareil, touche <b>J'ai déjà un code</b> et tape-le.",
        "Les notes sont chiffrées avec ce code : garde-le précieusement, il ne peut pas être récupéré. Toute personne qui a le code voit et peut modifier les notes."] },
      { t: "Vibrations et dépannage", v: "tips", p: [
        "<b>Retours haptiques</b> active ou coupe les vibrations. Si l'app ne semble pas à jour, ferme-la complètement et rouvre-la deux fois.",
        "« Hors connexion » : tes notes restent sur le téléphone et se synchroniseront plus tard. Téléphone couché : l'app demande de le remettre à la verticale."] }
    ] },
    { t: "Avec tes parents", d: "2 min", s: [
      { t: "Les notifications", v: "notif", p: [
        "Les appareils reliés au même code peuvent recevoir une <b>notification</b> quand une note (ou un ETA) est ajoutée, et à chaque changement de verdict. Elle indique la branche, la note et la moyenne.",
        "Sur chaque appareil qui veut les recevoir : <b>Réglages → Synchronisation → Activer les notifications</b>. Sur iPhone, l'app doit être sur l'écran d'accueil (iOS 16.4 ou plus). L'appareil qui ajoute la note ne reçoit rien."] },
      { t: "Installer l'app chez un parent", v: "parents", p: [
        "Ton parent ouvre le même lien et installe l'app sur son téléphone. À l'écran de bienvenue, il touche <b>J'ai déjà mes notes sur un autre appareil</b> et tape <b>ton code de synchronisation</b>.",
        "Il active ensuite les notifications dans Réglages → Synchronisation. Il voit les mêmes notes que toi et peut aussi en ajouter : dans ce cas, c'est toi qui es prévenu."] },
      { t: "Tout couper et confidentialité", v: "mute", p: [
        "<b>Tout couper</b> (Réglages → Synchronisation) arrête les notifications pour <b>tous</b> les appareils du code, jusqu'à ce que quelqu'un le réactive. <b>Désactiver sur cet appareil</b> ne concerne que le téléphone en main.",
        "Le message est chiffré avec le code : le serveur ne peut pas le lire. Si un téléphone n'arrive pas à le déchiffrer, la notification dit seulement « Nouvelle note »."] }
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
        "<div class='gd-body'><h1 class='ob-title'>Guide d'utilisation</h1><p class='ob-sub'>" + CH.length + " chapitres, environ 15 minutes. Tu peux t'arrêter et reprendre quand tu veux.</p>" +
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
        "<div class='gd-vis' aria-hidden='true'>" + V[stp.v.split(":")[0]](stp.v.split(":")[1]) + "</div>" +
        "<h1 class='gd-title'>" + stp.t + "</h1><div class='gd-text'>" + stp.p.map(function (t) { return t.indexOf("<span class='note'>") === 0 ? "<p class='note'>" + t.replace(/^<span class='note'>|<\/span>$/g, "") + "</p>" : "<p>" + t + "</p>"; }).join("") + "</div></div>" +
        "<div class='gd-foot'>" + (s > 0 || c > 0 ? "<button type='button' class='btn-ghost' data-gd='prev'>Précédent</button>" : "") +
        "<button type='button' class='btn' data-gd='next'>" + (last ? "Terminer le chapitre" : "Suivant") + "</button></div>";
      st.last = { c: c, s: s }; save();
    } else {
      var lastCh = c === CH.length - 1;
      h = "<div class='gd-top'><span></span><button type='button' class='link' data-gd='close'>Fermer</button></div>" +
        "<div class='gd-body'><div class='gd-done'>" + lu("done") + "" +
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
      A(b, { opacity: [0, 1], x: [dir * 34, 0] }, { type: "spring", stiffness: 340, damping: 30 });
      var kids = $$(".gd-vis > *, .gd-chr, .gd-done > *", b);
      if (kids.length) A(kids, { opacity: [0, 1], y: [12, 0], scale: [0.96, 1] }, { delay: ST(0.045, { startDelay: 0.08 }), type: "spring", stiffness: 360, damping: 28 });
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
    A(root, { opacity: [0, 1], y: [24, 0] }, { type: "spring", stiffness: 320, damping: 30 });
    if (opts.start) {
      var l = st.last && !allDone() ? st.last : { c: 0, s: 0 };
      c = Math.min(CH.length - 1, l.c); s = Math.min(CH[c].s.length - 1, l.s); view = "step";
    } else view = "list";
    dir = 1; paint();
  }

  function close() {
    var el = root; if (!el) return;
    var completed = allDone(), cb = onClose;
    root = null; onClose = null;
    var closed = false;
    function done() { if (closed) return; closed = true; el.remove(); if (!root) document.body.classList.remove("gd-open"); refreshEntry(); if (cb) cb({ completed: completed }); }
    if (canAnim()) { el.style.pointerEvents = "none"; A(el, { opacity: [1, 0], y: [0, 24] }, { duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }).then(done); setTimeout(done, 450); }
    else done();
  }

  /* ---------- Réglages : entrée du guide + « À propos » ---------- */
  function refreshEntry() {
    var el = document.getElementById("gd-sum"), b = document.getElementById("gd-open"); if (!el || !b) return;
    var n = doneCount();
    el.textContent = "Une formation en " + CH.length + " chapitres : notes, TA et photos, tableau de bord, règles de calcul, réglages, notifications aux parents. " + (n ? n + " sur " + CH.length + " terminés." : "");
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
        "<p class='muted small'><b>Tes données.</b> Tes notes, tes TA et ton profil restent sur ton téléphone : l'app n'a pas de compte et ne collecte aucune donnée personnelle. Si tu supprimes l'icône, ils sont effacés, pense donc à exporter une sauvegarde.</p>" +
        "<p class='muted small'><b>Photos des tests.</b> Elles restent sur l'appareil qui les a prises : elles ne sont ni synchronisées ni dans la sauvegarde.</p>" +
        "<p class='muted small'><b>Synchronisation et notifications.</b> Elles sont facultatives. La synchronisation envoie une copie chiffrée avec ton code, que personne d'autre ne peut lire ; les notifications passent par le même serveur, chiffrées avec le même code, puis par le service de notifications d'Apple ou de Google. La copie est stockée chez Cloudflare. Le site est hébergé par GitHub, qui peut enregistrer des données techniques de connexion comme tout site web.</p>" +
        "<p class='muted small'><b>Icônes et scanner.</b> Icônes Lucide (licence ISC). Détection de la feuille par Scanic (licence MIT), exécutée sur ton téléphone.</p>" +
        "<p class='gd-copy'>©louis mutter</p>";
      host.appendChild(d);
    }
    refreshEntry();
  }

  window.Guide = { open: open, allDone: allDone, disclaimer: DISCLAIMER, progress: doneCount };
  mountSettings();
})();
