/* ============================================================
   DONNÉES DE LA PAGE « SYSTÈME » ET TABLE DES RENVOIS
   Texte repris tel quel du référentiel validé (CYTHEREA_REFERENTIEL.md,
   sections 2, 3, 4, 5 et 6). Aucune information réservée au maître de
   campagne : ce fichier est public sur GitHub.

   Chaque entrée possède :
     id      identifiant d'ancre, route /systeme/<id>
     termes  mots qui deviennent des liens partout sur le site
             (retirer un terme ici = plus de lien pour ce mot)
     enfants lieux nommés, lunes, stations, seuils rattachés
   Chargé AVANT script.js.
   ============================================================ */
const SYSTEME = {
 "fiche": [
  [
   "Désignation",
   "Cytherea, Cythonis-VII"
  ],
  [
   "Segmentum, secteur, sous-secteur",
   "Obscurus, Vharnaal, Cythonis"
  ],
  [
   "Côté de la Cicatrix",
   "Imperium Nihilus"
  ],
  [
   "Étoile",
   "Naine jaune de classe G, vieillissante"
  ],
  [
   "Corps",
   "11 planètes, 4 lunes, 1 station, 2 champs d'astéroïdes, 2 seuils warp"
  ],
  [
   "Grade de dîme",
   "Solutio Extremis"
  ],
  [
   "Population civile",
   "~103,4 milliards"
  ],
  [
   "Population militaire et administrative",
   "~265 millions"
  ],
  [
   "Chœur astropathique",
   "Choralis Cytherea, sur Occludus Rha"
  ],
  [
   "Flotte système",
   "Escadre de Picket Cytherea, basée à Voidhold"
  ],
  [
   "Autorité planétaire",
   "Conseil Système, sur Cytherea Prime"
  ],
  [
   "Autorité spirituelle",
   "Cardinal d'Ossiana"
  ]
 ],
 "corps": [
  {
   "id": "etoile",
   "num": "",
   "genre": "Étoile",
   "nom": "L'étoile",
   "type": "Naine jaune de classe G, vieillissante, luminosité déclinante",
   "pop": null,
   "classe": null,
   "termes": [],
   "lore": [
    "Une naine jaune qui décline. Elle a brûlé longtemps et brûlera longtemps encore, mais les instruments d'Occludus Rha enregistrent depuis six siècles une baisse de luminosité si lente qu'aucune génération d'observateurs n'en verra la fin. Les archives Mechanicus la classent en déclin normal. Sur Cytherea Prime, dans les strates basses de la ruche, personne ne voit jamais le ciel, et cela n'a donc aucune importance. Sur Masalis, les agriculteurs allongent les cycles de récolte d'une semaine tous les cinquante ans, sans savoir pourquoi, en suivant des almanachs qu'ils n'ont pas écrits."
   ],
   "enfants": []
  },
  {
   "id": "ceinture-kharvos",
   "num": "",
   "genre": "Champ d'astéroïdes",
   "nom": "Ceinture de Kharvos",
   "type": "Cordon de débris entre l'étoile et la première orbite",
   "pop": "~200 000 clandestins",
   "classe": "Non recensé",
   "termes": [
    "Ceinture de Kharvos"
   ],
   "lore": [
    "Un cordon de débris rocheux tendu entre l'étoile et la première orbite, trop irrégulier pour porter un nom d'anneau et trop dense pour qu'on le traverse sans navigateur. Officiellement, rien n'y vit. Officieusement, deux cent mille personnes y survivent dans des habitats creusés à même les astéroïdes, mineurs illégaux, contrebandiers, fugitifs de Frostmark Carcer qui ont réussi une évasion que personne ne croit possible. L'Escadre de Picket y mène une patrouille par an, la même semaine, avec la même trajectoire, et ne trouve jamais rien. Cet arrangement convient à tout le monde."
   ],
   "enfants": []
  },
  {
   "id": "kharvos",
   "num": "I",
   "genre": "Planète",
   "nom": "Kharvos",
   "type": "Monde sans fonction",
   "pop": "Aucune",
   "classe": "Dead World",
   "termes": [
    "Kharvos"
   ],
   "lore": [
    "Une bille de fer et de cendre à cuire au bord de l'étoile. Face jour à huit cents degrés, face nuit gelée, rien entre les deux qu'une ligne de crépuscule permanent large de quelques kilomètres où le métal se fissure et se ressoude à chaque rotation. Aucune atmosphère, aucune eau, aucun minerai qui vaille le coût d'une descente. Les registres de l'Administratum notent Kharvos comme <em>inhabitée, inhabitable, sans dîme</em>. C'est l'entrée la plus courte de tout le dossier système."
   ],
   "enfants": []
  },
  {
   "id": "cytherea-prime",
   "num": "II",
   "genre": "Planète",
   "nom": "Cytherea Prime",
   "type": "Monde-ruche, capitale du système",
   "pop": "~52 Md civils, ~180 M militaires et administratifs",
   "classe": "Hive World, Populous Extremis",
   "termes": [
    "Cytherea Prime",
    "Flèche Primaire"
   ],
   "lore": [
    "Cinquante-deux milliards d'êtres humains empilés sous un ciel jaune sale.",
    "Les flèches-hive percent la couche de smog à onze kilomètres d'altitude, et à ces hauteurs-là l'air est clair, presque froid. On y trouve les palais du Conseil, les résidences des familles industrielles, les jardins sous dôme où poussent des plantes venues de Masalis. Sous les flèches, la ruche descend. Strate après strate, l'espace se comprime, la lumière disparaît, les noms des quartiers cessent d'apparaître sur les cartes officielles. Au niveau du sol, il n'y a plus de sol : seulement des kilomètres de fondations habitées, chauffées par les rejets thermiques des générateurs, où naissent et meurent des gens dont l'Administratum ignore l'existence.",
    "C'est un monde qui fonctionne. Mal, brutalement, mais il fonctionne. La dîme part chaque année, les manufactorum tournent, les Arbites maintiennent l'ordre avec une efficacité proportionnelle à leur brutalité.",
    "Et à deux cent soixante kilomètres de la Flèche Primaire, dans une zone que personne ne visitait, le Mechanicus a foré."
   ],
   "enfants": [
    {
     "id": "plaine-de-verre",
     "genre": "Lieu",
     "nom": "La Plaine de Verre",
     "type": "Région vitrifiée, emplacement du Nœud",
     "termes": [
      "Plaine de Verre",
      "Nœud de Résonance"
     ],
     "lore": [
      "Le forage a duré onze ans. La vitrification a duré neuf secondes.",
      "Ce qui était une plaine de roche et de poussière est aujourd'hui une étendue de verre noir sur trois cents kilomètres, lisse comme une eau figée, réfléchissant un ciel qu'elle est seule sur cette planète à pouvoir montrer. Marcher dessus produit un son qui ne correspond pas au pas. Il arrive une fraction de seconde trop tard, et il ne vient pas d'en dessous.",
      "Au centre, le puits d'excavation reste ouvert. Les échafaudages du Mechanicus sont encore en place, intacts, abandonnés en pleine opération. Le Nœud de Résonance est en bas. On ne le voit pas depuis la surface. On l'entend."
     ],
     "enfants": []
    },
    {
     "id": "trone-fer-blanc",
     "genre": "Lieu",
     "nom": "Le Trône de Fer-Blanc",
     "type": "Siège du Conseil Système",
     "termes": [
      "Trône de Fer-Blanc"
     ],
     "lore": [
      "Au sommet de la Flèche Primaire, une salle circulaire de fer poli, blanchi par dix siècles de polissage rituel. Douze fauteuils. Au centre, un puits ouvert qui plonge sur trois kilomètres dans le corps de la ruche, et d'où monte en permanence un souffle d'air chaud chargé du bruit de cinquante-deux milliards de vies.",
      "Le Conseil siège autour de ce puits depuis la fondation de la colonie. La tradition veut que chaque conseiller se tienne au bord avant de voter. Personne n'a jamais expliqué pourquoi. Depuis l'éveil du Nœud, trois conseillers ont demandé que le puits soit scellé. La motion a été rejetée deux fois."
     ],
     "enfants": []
    },
    {
     "id": "cytherea-minor",
     "num": "II.a",
     "genre": "Lune",
     "nom": "Cytherea Minor",
     "type": "Lune industrielle, défenses orbitales",
     "pop": "~900 M civils, ~12 M militaires et administratifs",
     "classe": "Moderate",
     "termes": [
      "Cytherea Minor"
     ],
     "lore": [
      "Une lune industrielle qui vit dans l'ombre de sa planète-mère et le sait. Neuf cents millions d'habitants dans des hab-dômes soudés à la roche, employés aux batteries de macro-canons, aux chantiers de radoub mineur, aux stations d'écoute orbitale. On y naît voidsman ou artilleur, rarement autre chose. La vue depuis les dômes donne sur Cytherea Prime, immense, jaune, occupant un tiers du ciel. Les habitants de Minor appellent cela <em>la Mère</em>, et le mot n'est jamais affectueux."
     ],
     "enfants": []
    },
    {
     "id": "voidhold",
     "num": "",
     "genre": "Station orbitale",
     "nom": "Voidhold",
     "type": "Chantier naval, seul chantier de construction du sous-secteur",
     "pop": "~9 M civils, ~90 000 militaires et administratifs",
     "classe": "Low, industrielle",
     "termes": [
      "Voidhold"
     ],
     "lore": [
      "Neuf millions de personnes vivant dans une structure qui n'a jamais touché une planète.",
      "Voidhold est le seul chantier du sous-secteur capable de construire une coque neuve. Les autres réparent, rapiècent, prolongent la vie de vaisseaux plus vieux que les dynasties qui les commandent. Ici, on construit encore. Trois cales sèches flottantes, des gabarits longs de kilomètres, des ateliers où travaillent des lignées de voidsmen qui n'ont pas vu de gravité naturelle depuis six générations.",
      "Depuis la Cicatrix, cette capacité est devenue la chose la plus précieuse du sous-secteur. Vharn Solace le sait. La Maison Vherrin, qui contrôle un tiers du trafic de radoub, le sait mieux encore."
     ],
     "enfants": []
    },
    {
     "id": "seuil-aquila",
     "num": "",
     "genre": "Seuil warp",
     "nom": "Seuil de l'Aquila",
     "type": "Point de translation principal, entrée civile",
     "pop": null,
     "classe": null,
     "termes": [
      "Seuil de l'Aquila"
     ],
     "lore": [
      "Le point de translation Mandeville principal, en bordure de système, aligné sur l'approche de Voidhold. Une balise astropathique y tourne en permanence, entretenue par un détachement de l'Escadre de Picket, et c'est par là que passe tout ce qui entre légalement dans Cytherea. Deux frégates y stationnent en rotation.",
      "Depuis l'ouverture de la Cicatrix, le trafic a chuté de sept dixièmes. Les officiers de picket passent leurs quarts à surveiller un point de l'espace où plus rien n'émerge."
     ],
     "enfants": [],
     "ref": "Cythonis-VII/Threshold-Prime"
    }
   ],
   "ref": "Cythonis-VII/II"
  },
  {
   "id": "solferrum",
   "num": "III",
   "genre": "Planète",
   "nom": "Solferrum",
   "type": "Monde minier",
   "pop": "~1,4 Md civils, ~3 M militaires et administratifs",
   "classe": "Moderate",
   "termes": [
    "Solferrum"
   ],
   "lore": [
    "Un monde foré jusqu'à l'os. Un milliard quatre cents millions d'habitants dont l'existence entière tourne autour de sept trous dans le sol.",
    "Sans Solferrum, Draev Kolt cesse de forger. Sans Draev Kolt, le sous-secteur cesse de s'armer. Personne sur Solferrum n'a jamais reçu de remerciement pour cela."
   ],
   "enfants": [
    {
     "id": "gueules-solferrum",
     "genre": "Lieu",
     "nom": "Les Gueules de Solferrum",
     "type": "Puits d'extraction",
     "termes": [
      "Gueules de Solferrum"
     ],
     "lore": [
      "Sept puits à ciel ouvert, si vastes qu'on les distingue depuis l'orbite comme des taches sombres sur un disque rouge. Chacun descend en spirale sur des kilomètres, ceinturé de plateformes, de rails, de grues à contrepoids qui remontent le minerai par convois de mille tonnes. Le bruit ne s'arrête jamais. La poussière non plus.",
      "Les mineurs disent que les Gueules avalent plus d'hommes qu'elles ne rendent de minerai. Les registres de la milice minière ne contredisent pas cette affirmation, ils la classent simplement sous <em>pertes opérationnelles acceptables</em>."
     ],
     "enfants": []
    }
   ]
  },
  {
   "id": "masalis",
   "num": "IV",
   "genre": "Planète",
   "nom": "Masalis",
   "type": "Monde agricole",
   "pop": "~8 Md civils, ~9 M militaires et administratifs",
   "classe": "Populous, rurale",
   "termes": [
    "Masalis"
   ],
   "lore": [
    "Des steppes à perte de vue, sous un ciel plus large que partout ailleurs dans le système. Huit milliards d'agriculteurs cultivant des céréales-void sur des exploitations grandes comme des provinces, élevant du bétail vaticinatoire dont les troupeaux sont conduits par des bergers à cheval et surveillés par des augures orbitaux.",
    "C'est le monde le plus paisible de Cytherea, et le plus étroitement contrôlé. La dîme agricole ne souffre aucun retard. La milice de Masalis n'a jamais combattu d'ennemi extérieur, elle a en revanche réprimé quatorze émeutes de la faim en trois siècles, ce qui est le paradoxe permanent d'un monde-grenier impérial.",
    "Depuis huit ans, Masalis compense le déficit de Hesper. Les quotas ont augmenté de dix-huit pour cent. Les rations locales ont diminué d'autant."
   ],
   "enfants": []
  },
  {
   "id": "vulkanis-rho",
   "num": "V",
   "genre": "Planète",
   "nom": "Vulkanis Rho",
   "type": "Monde industriel militarisé",
   "pop": "~31 Md civils, ~60 M militaires et administratifs",
   "classe": "Populous Extremis",
   "termes": [
    "Vulkanis Rho"
   ],
   "lore": [
    "Trente et un milliards d'ouvriers sous un plafond de fumée qui n'a pas laissé passer la lumière du soleil depuis mille deux cents ans.",
    "Vulkanis Rho n'est pas un monde-forge au sens Mechanicus du terme, c'est un monde industriel militarisé sous supervision Mechanicus. La distinction compte pour les prêtres d'Occludus Rha, elle ne compte pour personne d'autre. Ce qui compte, c'est que Vulkanis produit : lasguns, blindage, munitions, moteurs, pièces de coque expédiées à Voidhold par navettes-cargo qui décollent toutes les onze minutes.",
    "Le monde est organisé en districts-manufactorum, chacun gouverné par un Overseer et chacun en compétition permanente avec les autres pour les quotas. Cette compétition est encouragée. Elle produit du rendement, et elle empêche les districts de s'entendre."
   ],
   "enfants": [
    {
     "id": "cendre-basse",
     "num": "V.a",
     "genre": "Lune",
     "nom": "Cendre-Basse",
     "type": "Lune-fonderie",
     "pop": "~60 M civils",
     "classe": "Low",
     "termes": [
      "Cendre-Basse"
     ],
     "lore": [
      "Une lune-fonderie, soixante millions d'habitants, ciel en permanence rougi par les rejets thermiques de la planète-mère. On y traite ce que Vulkanis Rho ne peut pas traiter en gravité : alliages coulés en orbite, composants de haute précision, tout ce qui exige le vide. Les ouvriers de Cendre-Basse se considèrent supérieurs à ceux de la planète. Les ouvriers de la planète les considèrent comme des ouvriers de Vulkanis qui ont simplement de la chance."
     ],
     "enfants": []
    }
   ]
  },
  {
   "id": "occludus-rha",
   "num": "VI",
   "genre": "Planète",
   "nom": "Occludus Rha",
   "type": "Monde Mechanicus",
   "pop": "~2 M civils, ~400 000 militaires et administratifs",
   "classe": "Low, spécialisée",
   "termes": [
    "Occludus Rha",
    "Choralis Cytherea",
    "Magos Dominus"
   ],
   "lore": [
    "Deux millions d'âmes, dont moins de la moitié sont encore entièrement humaines.",
    "Occludus Rha ne produit rien. C'est un monde de données. Des tours-temples s'élèvent sur des plateaux balayés par le vent, chacune contenant des archives cogitées remontant à la colonisation du système, chacune desservie par des cohortes de servitors et des prêtres-augures qui passent leur vie à interroger, indexer, préserver. Le silence y est une règle liturgique.",
    "C'est d'ici qu'est partie l'expédition. Un Magos Explorator, une escorte de Skitarii, onze années de forage sous la Plaine de Verre, et un rapport final qui tient en quatre mots dans les registres : <em>contact établi, opération suspendue</em>.",
    "Le Choralis Cytherea occupe la tour-temple la plus au nord. Cent quarante Astropathes y dorment et y rêvent sous surveillance conjointe du Mechanicus et de l'Ecclesiarchie, deux autorités qui ne se font pas confiance et qui gardent donc chacune un œil sur l'autre. Le Chœur n'a rien signalé le jour de l'éveil. Le registre de cette journée existe, il est scellé, et le Magos Dominus a refusé deux demandes de consultation."
   ],
   "enfants": [],
   "ref": "Cythonis-VII/VI, Cognis-Thala Sub-Registry"
  },
  {
   "id": "ossiana",
   "num": "VII",
   "genre": "Planète",
   "nom": "Ossiana",
   "type": "Monde religieux",
   "pop": "~11 Md civils, ~2 M militaires et administratifs",
   "classe": "Populous, cultuelle",
   "termes": [
    "Ossiana"
   ],
   "lore": [
    "Onze milliards de fidèles sur un monde de montagnes.",
    "L'Ecclesiarchie tient Ossiana depuis quatre mille ans et en a fait le centre spirituel du sous-secteur. Les pics sont creusés en cathédrales, les vallées remplies de villes-pèlerinages, et la population permanente est indissociable de la population de passage : on vient à Ossiana pour un pèlerinage de six mois, on y reste vingt ans, on y meurt. Le clergé y voit une preuve de la puissance de la foi. Les registres démographiques y voient une croissance nette de deux pour cent par décennie qu'il faut bien nourrir."
   ],
   "enfants": [
    {
     "id": "cathedrale-saint-vhalen",
     "genre": "Lieu",
     "nom": "La Cathédrale-Montagne de Saint Vhalen",
     "type": "Siège du Cardinal d'Ossiana",
     "termes": [
      "Cathédrale-Montagne de Saint Vhalen",
      "Cardinal d'Ossiana",
      "Saint Vhalen"
     ],
     "lore": [
      "Trois mille mètres de roche creusée sur toute sa hauteur. La voie d'escaliers qui monte au sommet compte quarante jours de marche, sans abri, sans ravitaillement organisé, sous un climat qui se dégrade avec l'altitude. L'Ecclesiarchie ne compte pas les morts, elle compte les arrivées.",
      "Au sommet, une nef ouverte aux vents, et le siège du Cardinal d'Ossiana, plus haute autorité religieuse de tout le sous-secteur Cythonis. Le Cardinal réside ici et non à Vharn Solace, ce qui signifie que le pouvoir spirituel du sous-secteur siège à quatre systèmes de son pouvoir temporel. Cette anomalie dure depuis huit cents ans et personne n'a intérêt à la corriger."
     ],
     "enfants": []
    },
    {
     "id": "lacrima",
     "num": "VII.a",
     "genre": "Lune",
     "nom": "Lacrima",
     "type": "Lune-sanctuaire",
     "pop": "~80 000 civils",
     "classe": "Minimal",
     "termes": [
      "Lacrima"
     ],
     "lore": [
      "Une lune, un sanctuaire, quatre-vingt mille prêtres. Une chapelle unique taillée dans la roche nue, où chaque pèlerin en route pour Ossiana doit faire halte, se confesser, recevoir l'autorisation de descendre. Ceux à qui on la refuse repartent. Personne ne dit ce qui motive un refus."
     ],
     "enfants": []
    }
   ]
  },
  {
   "id": "naogeth",
   "num": "VIII",
   "genre": "Planète",
   "nom": "Naogeth",
   "type": "Monde-ruche mort",
   "pop": "Aucune (estimée à ~90 M au cataclysme)",
   "classe": "Mundus Damnatus",
   "termes": [
    "Naogeth"
   ],
   "lore": [
    "Une ruche morte, en orbite huit, que personne n'a le droit de regarder.",
    "Naogeth fut la jumelle de Cytherea Prime, colonisée en même temps, bâtie sur le même modèle, peuplée par les mêmes vagues de migration. Nonante millions d'habitants au moment du cataclysme. L'Ecclesiarchie n'a jamais publié ce qui s'est produit. Elle a publié le décret qui a suivi.",
    "Le Décret d'Interdiction Lachrymae classe Naogeth <em>mundus damnatus</em> : terrain sanctifié par le deuil, où toute présence non autorisée constitue une infraction sanctifiée. Six siècles plus tard, la superstition a remplacé le décret. Les pilleurs les plus désespérés du système évitent Naogeth par réflexe, sans savoir pourquoi, et ce réflexe a valu à la Ruche Sépulcre six cents ans de solitude parfaite.",
    "C'est là que les Éveillés se sont relevés. Personne ne les a vus venir, parce que personne ne regardait."
   ],
   "enfants": [
    {
     "id": "ruche-sepulcre",
     "genre": "Lieu",
     "nom": "La Ruche Sépulcre",
     "type": "Ruche morte de Naogeth",
     "termes": [
      "Ruche Sépulcre"
     ],
     "lore": [],
     "enfants": [
      {
       "id": "parvis-mort",
       "genre": "Lieu",
       "nom": "Le Parvis Mort",
       "type": "Esplanade d'entrée de la ruche",
       "termes": [
        "Parvis Mort"
       ],
       "lore": [
        "L'esplanade d'entrée de la Ruche Sépulcre, autrefois place de marché pour cinquante millions de personnes. Aujourd'hui, une étendue de rockcrete fissuré sous l'ombre de la façade principale, jonchée de véhicules abandonnés en pleine circulation, portières ouvertes, moteurs rongés. Le terrain est plat, dégagé, sans couvert. Ce qui arrive par là est vu de loin. Ce qui sort par là aussi."
       ],
       "enfants": []
      },
      {
       "id": "strates-basses",
       "genre": "Lieu",
       "nom": "Les Strates Basses",
       "type": "Profondeurs de la ruche",
       "termes": [
        "Strates Basses"
       ],
       "lore": [
        "Le ventre. Des corridors superposés sur des kilomètres de profondeur, effondrés par endroits, noyés d'obscurité ailleurs, où le moindre son revient trois fois avant de mourir. Les cartes pré-cataclysme existent, elles ne correspondent plus. Quelque chose a modifié la géométrie des niveaux inférieurs, méthodiquement, en creusant des galeries qui ne mènent nulle part que l'esprit humain reconnaisse.",
        "C'est de là que les Éveillés remontent."
       ],
       "enfants": []
      },
      {
       "id": "coeur-mecanique",
       "genre": "Lieu",
       "nom": "Le Cœur Mécanique",
       "type": "Ancien complexe générateur",
       "termes": [
        "Cœur Mécanique"
       ],
       "lore": [
        "L'ancien complexe générateur au centre de la ruche. Réacteurs éteints depuis six cents ans, tours de refroidissement crevées, passerelles suspendues au-dessus de puits dont personne n'a mesuré le fond.",
        "Les réacteurs sont éteints. Le complexe, lui, fonctionne. Les lumières de signalisation tournent, les portes blindées répondent, la ventilation souffle un air tiède dans des couloirs vides. Aucun relevé n'a identifié la source d'énergie. Le Magos Dominus a qualifié ce fait d'<em>anomalie de faible priorité</em> dans son rapport, huit mois avant que le forage de la Plaine de Verre n'atteigne le Nœud."
       ],
       "enfants": []
      }
     ]
    }
   ],
   "ref": "Cythonis-VII/VIII, accès restreint"
  },
  {
   "id": "bastion-ashkar",
   "num": "IX",
   "genre": "Planète",
   "nom": "Bastion Ashkar",
   "type": "Monde-garnison",
   "pop": "~600 000 civils, ~132 000 militaires",
   "classe": "Militaire",
   "termes": [
    "Bastion Ashkar"
   ],
   "lore": [
    "Un monde entier consacré à une guerre qui n'est jamais venue.",
    "Six cent mille civils, cent trente-deux mille soldats, et rien d'autre. Pas d'industrie propre, pas d'agriculture au-delà de la subsistance, pas de population native. Ashkar existe pour caserner, entraîner et projeter. Le régiment qui y stationne se renouvelle par recrutement sur Cytherea Prime et Vulkanis Rho, tous les vingt ans, sans interruption depuis la fondation."
   ],
   "enfants": [
    {
     "id": "redoute-ashkar",
     "genre": "Lieu",
     "nom": "La Redoute d'Ashkar",
     "type": "Fortification de garnison",
     "termes": [
      "Redoute d'Ashkar"
     ],
     "lore": [
      "Murailles étagées, champs de tir couvrant l'horizon sur trente kilomètres, silos de défense enfoncés dans la roche mère, casemates redondantes, dépôts de munitions dimensionnés pour un siège de deux ans. Conçue pour tenir contre une invasion planétaire.",
      "Jamais utilisée. Entretenue depuis cinq cent septante ans par des hommes dont aucun n'a vu de combat, qui polissent des canons qui n'ont jamais tiré, qui répètent des manœuvres pour un ennemi théorique. On appelle cela, dans le reste du système, <em>la garnison qui attend</em>. Le terme n'est pas moqueur. Plus maintenant."
     ],
     "enfants": []
    },
    {
     "id": "seuil-ashkar",
     "num": "",
     "genre": "Seuil warp",
     "nom": "Seuil Ashkar",
     "type": "Point de translation militaire, non cartographié",
     "pop": null,
     "classe": null,
     "termes": [
      "Seuil Ashkar"
     ],
     "lore": [
      "Le second point de translation, non cartographié sur les routes civiles, réservé au Munitorum et à la Marine Impériale. Aligné sur Bastion Ashkar, surveillé directement par la garnison. Peu de trafic, un contrôle strict, et l'avantage stratégique évident d'exister sans figurer sur les cartes commerciales du sous-secteur."
     ],
     "enfants": [],
     "ref": "Cythonis-VII/Threshold-Secundus"
    }
   ],
   "ref": "Cythonis-VII/IX, coordonnées classifiées Munitorum"
  },
  {
   "id": "tarn-voidus",
   "num": "X",
   "genre": "Planète",
   "nom": "Tarn Voidus",
   "type": "Géante gazeuse",
   "pop": "Aucune",
   "classe": "Sans fonction",
   "termes": [
    "Tarn Voidus"
   ],
   "lore": [
    "Une géante gazeuse aux anneaux fracturés, tempêtes permanentes, aucune fonction, aucune population. Sa masse capture des débris depuis des millions d'années, ce qui explique le Champ de Tarn et fait de son voisinage la zone la plus dangereuse à naviguer du système."
   ],
   "enfants": [
    {
     "id": "echos-shard",
     "num": "X.a",
     "genre": "Lune",
     "nom": "Echo's Shard",
     "type": "Lune fracturée",
     "pop": "~40 000 civils",
     "classe": "Minimal",
     "termes": [
      "Echo's Shard"
     ],
     "lore": [
      "Une lune brisée par les marées gravitationnelles de sa planète-mère, fendue de crevasses profondes de plusieurs kilomètres."
     ],
     "enfants": [
      {
       "id": "faille-echo",
       "genre": "Lieu",
       "nom": "La Faille d'Écho",
       "type": "Crevasse à résonance acoustique",
       "termes": [
        "Faille d'Écho"
       ],
       "lore": [
        "La plus vaste des crevasses d'Echo's Shard. Sa géométrie produit une résonance acoustique naturelle : un son émis à une extrémité revient, amplifié, transformé, plusieurs minutes plus tard. Le phénomène est documenté depuis deux cent trente ans, étudié par une petite station de techno-augures, classé comme curiosité géologique sans intérêt stratégique.",
        "Le rapport de la station daté de six jours après l'éveil du Nœud signale que la Faille a commencé à émettre sans qu'aucun son n'y ait été introduit. Le rapport a été transmis à Occludus Rha. Il n'a reçu aucune réponse."
       ],
       "enfants": []
      }
     ]
    },
    {
     "id": "champ-tarn",
     "num": "",
     "genre": "Champ d'astéroïdes",
     "nom": "Champ de Tarn",
     "type": "Débris capturés aux points trojans de Tarn Voidus",
     "pop": "Aucune",
     "classe": "Non recensé",
     "termes": [
      "Champ de Tarn"
     ],
     "lore": [
      "Débris rocheux et glacés capturés aux points trojans de Tarn Voidus. Navigation dangereuse, aucune installation permanente, mais des équipes de récupération y opèrent par saison : le champ contient des épaves anciennes, certaines antérieures à la fondation de la colonie, dont aucune n'a jamais été identifiée avec certitude."
     ],
     "enfants": []
    }
   ]
  },
  {
   "id": "frostmark-carcer",
   "num": "XI",
   "genre": "Planète",
   "nom": "Frostmark Carcer",
   "type": "Colonie pénale",
   "pop": "~14 M condamnés, ~200 000 gardiens",
   "classe": "Pénale",
   "termes": [
    "Frostmark Carcer",
    "Frostmark"
   ],
   "lore": [
    "Quatorze millions de condamnés sur un monde de glace, gardés par deux cent mille hommes qui n'ont pas besoin de murs.",
    "Frostmark n'a pas d'enceinte. Le climat suffit : moins soixante en surface, tempêtes de neige durant des mois, aucun abri hors des complexes. La colonie pénale s'étend dans les ruines d'une ancienne colonie minière abandonnée, et les prisonniers y survivent en groupes, dans des bâtiments qu'ils entretiennent eux-mêmes, sous une administration qui compte les corps une fois par an et ajuste ses registres en conséquence.",
    "L'ancienne station de veille, en orbite, sert de siège administratif. Elle observe le bord du système, ce qui était sa fonction d'origine, et n'a rien détecté d'anormal depuis l'éveil. C'est ce que dit le rapport."
   ],
   "enfants": []
  }
 ],
 "institutions": [
  [
   "Conseil Système de Cytherea",
   "Cytherea Prime",
   "Gouvernement planétaire et systémique, 12 sièges"
  ],
  [
   "Maison Vherrin",
   "Voidhold",
   "Dynastie marchande, environ un tiers du trafic du chantier naval, trois générations"
  ],
  [
   "Magos Dominus d'Occludus Rha",
   "Occludus Rha",
   "Autorité Mechanicus locale"
  ],
  [
   "Cardinal d'Ossiana",
   "Ossiana",
   "Autorité spirituelle du sous-secteur"
  ],
  [
   "Escadre de Picket Cytherea",
   "Voidhold",
   "3 frégates Cobra, 2 destroyers, 1 transport"
  ],
  [
   "Garnison d'Ashkar",
   "Bastion Ashkar",
   "Un régiment complet de garde planétaire"
  ],
  [
   "Adeptus Arbites",
   "Cytherea Prime",
   "Precinct-Fortress"
  ]
 ],
 "decrets": [
  [
   "Décret d'Interdiction Lachrymae",
   "Naogeth déclarée <em>mundus damnatus</em>, accès interdit",
   "Ecclesiarchie"
  ],
  [
   "Interdit de navigation Kelmoradh",
   "Route warp vers Kelmoradh proscrite",
   "Vharn Solace"
  ],
  [
   "Classification Solutio Extremis",
   "Grade de dîme, réquisition prioritaire",
   "Munitorum sous-sectoriel"
  ]
 ],
 "sousSecteur": {
  "termes": [
   "sous-secteur Cythonis",
   "Cythonis"
  ],
  "intro": [
   "Le sous-secteur n'a pas été détruit par l'ouverture de la Cicatrix Maledictum, il a été oublié. Les tempêtes warp ont coupé les routes vers le reste du secteur Vharnaal, laissant sept systèmes livrés à eux-mêmes. L'Imperium n'a rien envoyé depuis, et n'a probablement rien à envoyer."
  ],
  "position": [
   [
    "Segmentum",
    "Obscurus"
   ],
   [
    "Secteur",
    "Vharnaal"
   ],
   [
    "Côté de la Cicatrix",
    "Imperium Nihilus"
   ],
   [
    "Capitale",
    "Vharn Solace, système Solace"
   ],
   [
    "Gouverneur",
    "Lord Sous-secteur Ivaine Corvusk"
   ],
   [
    "Systèmes",
    "7"
   ],
   [
    "Communications",
    "Dégradées en permanence, aucune liaison fiable avec Terra"
   ],
   [
    "Dernier contact avec le secteur Vharnaal",
    "Environ 9 ans standard"
   ],
   [
    "Trafic warp",
    "En chute d'environ 70 % depuis la Cicatrix"
   ]
  ],
  "compte": {
   "intro": "Trois dépendances convergentes :",
   "points": [
    "Draev Kolt ne peut pas forger sans le minerai de Solferrum. L'industrie militaire du sous-secteur dépend d'une seule chaîne d'approvisionnement.",
    "Hesper ne suffit plus à nourrir. Masalis comble le déficit. Sans Cytherea, Solace affame ses propres mondes en deux ans.",
    "Voidhold est le seul chantier capable de construire des coques neuves. Les autres ne font que réparer."
   ],
   "conclusion": "Cytherea produit, nourrit et construit. Vharn Solace administre. C'est la capitale qui dépend de Cytherea, pas l'inverse, et tout le monde à Solace le sait sans jamais le dire à voix haute."
  },
  "systemes": [
   {
    "id": "vharn-solace",
    "genre": "Système",
    "nom": "Vharn Solace",
    "type": "Capitale sous-sectorielle, siège administratif",
    "pop": "~40 Md",
    "classe": "Actif, autorité affaiblie",
    "termes": [
     "Vharn Solace",
     "Solace",
     "Ivaine Corvusk",
     "Lord Corvusk"
    ],
    "lore": [
     "Vharn Solace porte le titre mais plus la puissance. Monde civilisé aux vieilles institutions, siège du Gouverneur Sous-sectoriel et du tribunal des Arbites, avec des palais administratifs conçus pour gérer un sous-secteur connecté au reste de l'Imperium. Depuis la Cicatrix, Solace administre un territoire dont elle ne peut plus faire remonter la dîme nulle part. Le Munitorum local continue de collecter, d'entreposer, de comptabiliser. Les entrepôts débordent. Personne ne vient chercher."
    ],
    "enfants": []
   },
   {
    "id": "draev-kolt",
    "genre": "Système",
    "nom": "Draev Kolt",
    "type": "Monde-forge militarisé",
    "pop": "~28 Md",
    "classe": "Actif, exsangue",
    "termes": [
     "Draev Kolt"
    ],
    "lore": [
     "Draev Kolt est le monde-forge du sous-secteur, plus ancien et plus lourd que Vulkanis Rho, mais épuisé. Ses filons se tarissent, ses manufactorum tournent à capacité réduite, et son Fabricator Locum dépend désormais du minerai de Solferrum pour maintenir la production. C'est ce lien qui a donné à Cytherea son poids politique réel : Draev Kolt ne peut pas forger sans Cytherea."
    ],
    "enfants": []
   },
   {
    "id": "hesper",
    "genre": "Système",
    "nom": "Hesper",
    "type": "Monde agricole, grenier du sous-secteur",
    "pop": "~6 Md",
    "classe": "Actif, rendement en chute",
    "termes": [
     "Hesper"
    ],
    "lore": [
     "Hesper nourrit le sous-secteur, ou l'a fait. Deux mauvaises récoltes consécutives et une infestation de rouille-void ont fait chuter le rendement de près d'un tiers. Masalis compense le déficit depuis huit ans."
    ],
    "enfants": []
   },
   {
    "id": "anselms-reach",
    "genre": "Système",
    "nom": "Anselm's Reach",
    "type": "Nœud de transit, relais warp",
    "pop": "~800 M",
    "classe": "Actif, saturé",
    "termes": [
     "Anselm's Reach",
     "Anselm Waystation"
    ],
    "lore": [
     "Anselm's Reach est le carrefour. Système pauvre en ressources mais riche en points de translation stables, trois seuils Mandeville distincts, ce qui en fait le passage obligé de tout trafic interne au sous-secteur. Sa station-relais, l'Anselm Waystation, est le seul endroit où l'on trouve encore des Navigateurs disponibles à la location. Saturée en permanence depuis la Cicatrix."
    ],
    "enfants": []
   },
   {
    "id": "vorn-tessine",
    "genre": "Système",
    "nom": "Vorn Tessine",
    "type": "Monde civilisé mineur",
    "pop": "~4 Md",
    "classe": "Actif, replié",
    "termes": [
     "Vorn Tessine"
    ],
    "lore": [
     "Vorn Tessine s'est refermée sur elle-même. Monde civilisé au climat tempéré, autrefois destination de villégiature pour la noblesse du sous-secteur, aujourd'hui gouverné par un conseil de familles qui a cessé de répondre aux convocations de Solace. Rien d'ouvertement séditieux, juste un silence poli qui dure depuis six ans."
    ],
    "enfants": []
   },
   {
    "id": "kelmoradh",
    "genre": "Système",
    "nom": "Kelmoradh",
    "type": "Système mort",
    "pop": "Aucune",
    "classe": "Silence depuis 60 ans",
    "termes": [
     "Kelmoradh"
    ],
    "lore": [
     "Kelmoradh ne répond plus. Système frontalier de trois mondes, colonisé tardivement, qui a cessé toute transmission astropathique il y a environ soixante ans standard, bien avant la Cicatrix. Deux expéditions envoyées, aucune revenue. Classé <em>Perdita</em> dans les registres de Solace, routes marquées d'un interdit de navigation."
    ],
    "enfants": []
   }
  ],
  "routes": [
   [
    "Voie Aquilarum",
    "Solace, Anselm's Reach, Cytherea",
    "4 à 7 semaines",
    "Route principale, stable"
   ],
   [
    "Voie Ferrique",
    "Cytherea, Anselm's Reach, Draev Kolt",
    "3 à 6 semaines",
    "Stable, trafic industriel lourd"
   ],
   [
    "Voie Messis",
    "Hesper, Anselm's Reach, Cytherea",
    "5 à 9 semaines",
    "Instable, retards fréquents"
   ],
   [
    "Passe de Tessine",
    "Anselm's Reach, Vorn Tessine",
    "2 à 4 semaines",
    "Ouverte, peu utilisée"
   ],
   [
    "Voie Kelmoradh",
    "Anselm's Reach, Kelmoradh",
    "Inconnue",
    "Interdit de navigation"
   ],
   [
    "Corridor Vharnaal",
    "Cythonis vers le reste du secteur",
    "Aucune",
    "Coupé depuis la Cicatrix"
   ]
  ],
  "routesNote": [
   "Tout passe par Anselm's Reach. C'est la faiblesse structurelle du sous-secteur : un seul carrefour, et s'il tombe, les six autres systèmes deviennent six îles séparées."
  ]
 }
};

/* Personnages : nom tel qu'il apparaît dans les textes -> bloc Dirigeant de la faction */
const PERSONNAGES = {"necrons": ["Szareth"], "red-choir": ["Vortak"], "treizieme-cantique": ["Sigrim le Fourbe", "Sigrim"], "custodes": ["Aelric"], "krieg": ["Kessler"]};
