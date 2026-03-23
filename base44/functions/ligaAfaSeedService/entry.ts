import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const ZONA_A = [
    { name: 'Boca Juniors', code: 'BOC', group: 'A' },
    { name: 'Independiente', code: 'IND', group: 'A' },
    { name: 'San Lorenzo', code: 'SLO', group: 'A' },
    { name: 'Vélez Sarsfield', code: 'VEL', group: 'A' },
    { name: 'Deportivo Riestra', code: 'RIE', group: 'A' },
    { name: 'Talleres', code: 'TAL', group: 'A' },
    { name: 'Instituto', code: 'INS', group: 'A' },
    { name: 'Platense', code: 'PLA', group: 'A' },
    { name: 'Estudiantes LP', code: 'EDL', group: 'A' },
    { name: 'Gimnasia Mendoza', code: 'GME', group: 'A' },
    { name: 'Lanús', code: 'LAN', group: 'A' },
    { name: "Newell's Old Boys", code: 'NEW', group: 'A' },
    { name: 'Defensa y Justicia', code: 'DYJ', group: 'A' },
    { name: 'Central Córdoba SdE', code: 'CCO', group: 'A' },
    { name: 'Unión', code: 'UNI', group: 'A' },
];

const ZONA_B = [
    { name: 'River Plate', code: 'RIV', group: 'B' },
    { name: 'Racing Club', code: 'RAC', group: 'B' },
    { name: 'Huracán', code: 'HUR', group: 'B' },
    { name: 'Barracas Central', code: 'BAR', group: 'B' },
    { name: 'Belgrano', code: 'BEL', group: 'B' },
    { name: 'Estudiantes RC', code: 'ERC', group: 'B' },
    { name: 'Argentinos Juniors', code: 'ARG', group: 'B' },
    { name: 'Tigre', code: 'TIG', group: 'B' },
    { name: 'Gimnasia LP', code: 'GLP', group: 'B' },
    { name: 'Independiente Rivadavia', code: 'IRV', group: 'B' },
    { name: 'Banfield', code: 'BAN', group: 'B' },
    { name: 'Rosario Central', code: 'ROS', group: 'B' },
    { name: 'Aldosivi', code: 'ALD', group: 'B' },
    { name: 'Atlético Tucumán', code: 'ATU', group: 'B' },
    { name: 'Sarmiento', code: 'SAR', group: 'B' },
];

const ALL_TEAMS = [...ZONA_A, ...ZONA_B];

// Fecha 10 fixtures
const FECHA_10 = [
    ['IND', 'RAC', '2026-04-05T18:00:00Z'],
    ['TAL', 'BOC', '2026-04-05T20:15:00Z'],
    ['INS', 'DYJ', '2026-04-05T22:30:00Z'],
    ['UNI', 'RIE', '2026-04-06T16:00:00Z'],
    ['SLO', 'EDL', '2026-04-06T18:15:00Z'],
    ['CCO', 'NEW', '2026-04-06T20:30:00Z'],
    ['GME', 'VEL', '2026-04-06T22:45:00Z'],
    ['LAN', 'PLA', '2026-04-07T16:00:00Z'],
    ['RIV', 'BEL', '2026-04-07T18:15:00Z'],
    ['ALD', 'ERC', '2026-04-07T18:15:00Z'],
    ['BAR', 'SAR', '2026-04-07T20:30:00Z'],
    ['GLP', 'HUR', '2026-04-07T20:30:00Z'],
    ['ROS', 'ATU', '2026-04-07T22:45:00Z'],
    ['TIG', 'IRV', '2026-04-07T22:45:00Z'],
    ['ARG', 'BAN', '2026-04-05T16:00:00Z'],
];

// Fecha 11 fixtures
const FECHA_11 = [
    ['VEL', 'LAN', '2026-04-12T16:00:00Z'],
    ['NEW', 'GME', '2026-04-12T18:15:00Z'],
    ['EDL', 'CCO', '2026-04-12T20:30:00Z'],
    ['RIE', 'SLO', '2026-04-12T22:45:00Z'],
    ['DYJ', 'UNI', '2026-04-13T16:00:00Z'],
    ['BOC', 'INS', '2026-04-13T20:30:00Z'],
    ['IND', 'TAL', '2026-04-14T16:00:00Z'],
    ['BAN', 'TIG', '2026-04-12T16:00:00Z'],
    ['IRV', 'ROS', '2026-04-12T18:15:00Z'],
    ['ATU', 'GLP', '2026-04-12T20:30:00Z'],
    ['HUR', 'BAR', '2026-04-12T22:45:00Z'],
    ['SAR', 'ALD', '2026-04-13T18:15:00Z'],
    ['ERC', 'RIV', '2026-04-13T16:00:00Z'],
    ['BEL', 'RAC', '2026-04-14T18:15:00Z'],
    ['BOC', 'RIV', '2026-04-13T20:30:00Z'],
];

// ── Real player data from PlanetaGranDT Apertura 2026 ──
// Format: [full_name, position (GK/DEF/MID/FWD), price_in_game_units]
// Prices scaled from ARS cotización: max ~7M ARS → 18pts, min 300k → 4pts
// Scale: Math.max(4, Math.min(18, Math.round(ars / 400000)))
// Top ~16 players per team selected for fantasy relevance

const PLAYERS_BY_CODE = {
    BOC: [
        ['Marchesín, Agustín', 'GK', 15],
        ['Paredes, Leandro', 'MID', 18],
        ['Ascacíbar, Santiago', 'MID', 16],
        ['Herrera, Ander', 'MID', 13],
        ['Romero, Ángel', 'MID', 14],
        ['Velasco, Alan', 'MID', 14],
        ['Zenón, Kevin', 'MID', 12],
        ['Merentiel, Miguel Ángel', 'FWD', 17],
        ['Cavani, Edinson', 'FWD', 15],
        ['Palacios, Carlos', 'FWD', 15],
        ['Zeballos, Exequiel', 'FWD', 15],
        ['Bareiro, Adam', 'FWD', 14],
        ['Giménez, Milton', 'FWD', 14],
        ['Costa, Ayrton', 'DEF', 15],
        ['Battaglia, Rodrigo', 'DEF', 14],
        ['Blanco, Lautaro', 'DEF', 12],
    ],
    RIV: [
        ['Armani, Franco', 'GK', 16],
        ['Quintero, Juan Fernando', 'MID', 17],
        ['Páez, Kendry', 'MID', 16],
        ['Moreno, Aníbal', 'MID', 15],
        ['Castaño, Kevin', 'MID', 12],
        ['Galoppo, Giuliano', 'MID', 11],
        ['Vera, Fausto', 'MID', 11],
        ['Meza, Maximiliano', 'MID', 10],
        ['Colidio, Facundo', 'FWD', 15],
        ['Driussi, Sebastián', 'FWD', 16],
        ['Salas, Maximiliano', 'FWD', 15],
        ['Martínez Quarta, Lucas', 'DEF', 16],
        ['Montiel, Gonzalo', 'DEF', 15],
        ['Acuña, Marcos', 'DEF', 11],
        ['Bustos, Fabricio', 'DEF', 11],
        ['Díaz, Paulo', 'DEF', 10],
    ],
    RAC: [
        ['Cambeses, Facundo', 'GK', 16],
        ['Carboni, Valentín', 'MID', 17],
        ['Sosa, Santiago', 'MID', 14],
        ['Miljevic, Matko', 'MID', 13],
        ['Zaracho, Matías', 'MID', 11],
        ['Zuculini, Bruno', 'MID', 9],
        ['Fernández, Adrián', 'MID', 8],
        ['Rodríguez, Baltasar', 'MID', 8],
        ['Martínez, Adrián', 'FWD', 18],
        ['Vergara, Duván', 'FWD', 12],
        ['Solari, Santiago', 'FWD', 11],
        ['Conechny, Tomás', 'FWD', 10],
        ['Pizarro, Damián', 'FWD', 9],
        ['Martirena, Gastón', 'DEF', 12],
        ['Rojas, Gabriel', 'DEF', 13],
        ['Di Césare, Marco', 'DEF', 10],
    ],
    IND: [
        ['Rey, Rodrigo', 'GK', 13],
        ['Malcorra, Ignacio', 'MID', 14],
        ['Marcone, Iván', 'MID', 10],
        ['Mancuello, Federico', 'MID', 8],
        ['Cabral, Luciano', 'MID', 6],
        ['Fernández, Rodrigo', 'MID', 5],
        ['Lomónaco, Kevin', 'DEF', 16],
        ['Valdéz, Sebastián', 'DEF', 9],
        ['Arias, Santiago', 'DEF', 9],
        ['Godoy, Leonardo', 'DEF', 7],
        ['Freire, Nicolás', 'DEF', 6],
        ['Ávalos, Gabriel', 'FWD', 14],
        ['Montiel, Santiago', 'FWD', 14],
        ['Pussetto, Ignacio', 'FWD', 12],
        ['Abaldo, Matías', 'FWD', 9],
        ['Gutiérrez, Maximiliano', 'FWD', 4],
    ],
    VEL: [
        ['Marchiori, Tomás', 'GK', 14],
        ['Lanzini, Manuel', 'MID', 13],
        ['Robertone, Lucas', 'MID', 12],
        ['Aliendro, Rodrigo', 'MID', 10],
        ['Valdés, Diego', 'MID', 6],
        ['Romero, Braian', 'FWD', 14],
        ['Pizzini, Francisco', 'FWD', 10],
        ['Machuca, Imanol', 'FWD', 8],
        ['Monzón, Florián', 'FWD', 7],
        ['Pellegrini, Matías', 'FWD', 6],
        ['Magallán, Lisandro', 'DEF', 10],
        ['Mammana, Emanuel', 'DEF', 10],
        ['García, Joaquín', 'DEF', 8],
        ['Gómez, Elías', 'DEF', 8],
        ['Quirós, Aarón', 'DEF', 8],
        ['Montero, Álvaro', 'GK', 6],
    ],
    TAL: [
        ['Herrera, Guido', 'GK', 13],
        ['Cristaldo, Franco', 'MID', 13],
        ['Sforza, Juan Sebastián', 'MID', 11],
        ['Galarza, Matías Alejandro', 'MID', 10],
        ['Ortegoza, Ulises', 'MID', 7],
        ['Cáceres, Mateo', 'MID', 5],
        ['Valoyes, Diego', 'FWD', 13],
        ['Lima Morais, Rick', 'FWD', 9],
        ['Martínez, Ronaldo', 'FWD', 9],
        ['Barticciotto, Bruno', 'FWD', 6],
        ['Palomino, José Luis', 'DEF', 8],
        ['Catalán, Matías', 'DEF', 10],
        ['Schott, Augusto', 'DEF', 6],
        ['Vigo, Alex', 'DEF', 5],
        ['Báez, Gabriel', 'DEF', 4],
        ['Guth, Rodrigo', 'DEF', 4],
    ],
    EDL: [
        ['Muslera, Fernando', 'GK', 14],
        ['Palacios, Tiago', 'MID', 14],
        ['Farías, Facundo', 'MID', 12],
        ['Neves, Gabriel', 'MID', 11],
        ['Piovi, Ezequiel', 'MID', 10],
        ['Castro, Alexis', 'MID', 9],
        ['Sosa, José', 'MID', 7],
        ['Carrillo, Guido', 'FWD', 17],
        ['Gaich, Adolfo', 'FWD', 12],
        ['Cetré, Edwuin', 'FWD', 11],
        ['Alario, Lucas', 'FWD', 12],
        ['Aguirre, Brian', 'FWD', 10],
        ['González Pirez, Leandro', 'DEF', 10],
        ['Mancuso, Eros', 'DEF', 10],
        ['Meza, Eric', 'DEF', 10],
        ['Palacios, Tomás', 'DEF', 10],
    ],
    LAN: [
        ['Losada, Nahuel', 'GK', 13],
        ['Moreno, Marcelino', 'MID', 15],
        ['Cardozo, Agustín', 'MID', 10],
        ['Carrera, Ramiro', 'MID', 8],
        ['Peña Biafore, Felipe', 'MID', 7],
        ['Loaiza, Raúl', 'MID', 6],
        ['Medina, Agustín', 'MID', 6],
        ['Salvio, Eduardo', 'FWD', 13],
        ['Castillo, Rodrigo', 'FWD', 13],
        ['Bou, Walter', 'FWD', 12],
        ['Aquino, Dylan', 'FWD', 7],
        ['Izquierdoz, Carlos', 'DEF', 13],
        ['Canale, José María', 'DEF', 9],
        ['Marcich, Sasha', 'DEF', 9],
        ['Guidara, Tomás', 'DEF', 5],
        ['Petroli, Franco', 'GK', 8],
    ],
    BEL: [
        ['Vicentini, Manuel', 'GK', 5],
        ['Cardozo, Thiago', 'GK', 5],
        ['Zelarayán, Lucas', 'MID', 14],
        ['Vázquez, Franco', 'MID', 12],
        ['Longo, Santiago', 'MID', 8],
        ['González Metilli, Francisco', 'MID', 8],
        ['Sánchez, Adrián', 'MID', 5],
        ['Rigoni, Emiliano', 'FWD', 12],
        ['Fernández, Nicolás Emanuel', 'FWD', 11],
        ['Passerini, Lucas', 'FWD', 10],
        ['López, Lisandro', 'DEF', 11],
        ['Morales, Leonardo', 'DEF', 10],
        ['Ricca, Federico', 'DEF', 4],
        ['Maldonado, Alexis', 'DEF', 4],
        ['Spörle, Adrián', 'DEF', 4],
        ['Benítez, Alcides', 'DEF', 4],
    ],
    ROS: [
        ['Ledesma, Jeremías', 'GK', 12],
        ['Di María, Ángel', 'MID', 18],
        ['Fernández, Guillermo', 'MID', 11],
        ['Navarro, Federico', 'MID', 11],
        ['Ibarra, Franco', 'MID', 8],
        ['Pizarro, Vicente', 'MID', 10],
        ['Fernández, Julián', 'MID', 7],
        ['Veliz, Alejo', 'FWD', 15],
        ['Campaz, Jaminton', 'FWD', 13],
        ['Copetti, Enzo', 'FWD', 11],
        ['Ruben, Marco', 'FWD', 7],
        ['Ávila, Gastón', 'DEF', 12],
        ['Quintana, Carlos', 'DEF', 10],
        ['Mallo, Facundo', 'DEF', 8],
        ['Komar, Juan Cruz', 'DEF', 6],
        ['Broun, Jorge', 'GK', 10],
    ],
    HUR: [
        ['Galíndez, Hernán', 'GK', 12],
        ['Gil, Leonardo', 'MID', 7],
        ['Romero, Óscar', 'MID', 6],
        ['Ojeda, Emmanuel', 'MID', 6],
        ['Waller, Facundo', 'MID', 4],
        ['Blondel, Lucas', 'DEF', 8],
        ['Ibáñez, César', 'DEF', 8],
        ['Nervo, Hugo Martín', 'DEF', 6],
        ['Vera, Federico', 'DEF', 7],
        ['Pereyra, Fabio', 'DEF', 7],
        ['Paz, Nehuén', 'DEF', 6],
        ['Carrizo, Lucas', 'DEF', 6],
        ['Martínez, Alejandro', 'FWD', 7],
        ['Bisanz, Juan Francisco', 'FWD', 6],
        ['Sequeira, Leonardo', 'FWD', 6],
        ['Caicedo, Jordy', 'FWD', 5],
    ],
    ARG: [
        ['Rodríguez, Diego', 'GK', 12],
        ['Lescano, Alan', 'MID', 13],
        ['López Muñoz, Hernán', 'MID', 12],
        ['Fattori, Federico', 'MID', 12],
        ['Pérez, Enzo', 'MID', 11],
        ['Infantino, Gino', 'MID', 10],
        ['Oroz, Nicolás', 'MID', 6],
        ['Molina, Tomás', 'FWD', 10],
        ['Fernández, Leandro', 'FWD', 10],
        ['Verón, Gastón', 'FWD', 6],
        ['Giménez, Matías', 'FWD', 6],
        ['Álvarez, Francisco', 'DEF', 10],
        ['Godoy, Erik', 'DEF', 8],
        ['Lozano, Leandro', 'DEF', 5],
        ['Coronel, Kevin', 'DEF', 5],
        ['Prieto, Sebastián', 'DEF', 5],
    ],
    TIG: [
        ['Zenobio, Felipe', 'GK', 13],
        ['Martínez, Gonzalo', 'MID', 11],
        ['Saralegui, Jabes', 'MID', 10],
        ['Mosqueira, Joaquín', 'MID', 9],
        ['González, Santiago', 'MID', 7],
        ['Elías, Jalil', 'MID', 6],
        ['Leyes, Bruno', 'MID', 4],
        ['Russo, Ignacio', 'FWD', 11],
        ['Romero, David', 'FWD', 10],
        ['Laso, Joaquín', 'DEF', 9],
        ['Arias, Ramón', 'DEF', 5],
        ['Garay, Martín', 'DEF', 4],
        ['Barrionuevo, Alan', 'DEF', 5],
        ['Soto, Guillermo', 'DEF', 5],
        ['Banegas, Nahuel', 'DEF', 4],
        ['Guiffrey, Germán', 'DEF', 4],
    ],
    GLP: [
        ['Insfrán, Nelson', 'GK', 4],
        ['Fernández, Ignacio', 'MID', 11],
        ['Castro, Lucas', 'MID', 9],
        ['Miramón, Ignacio', 'MID', 9],
        ['Max, Augusto', 'MID', 4],
        ['Barros Schelotto, Nicolás', 'MID', 4],
        ['Torres, Marcelo', 'FWD', 6],
        ['Mammini, Ivo', 'FWD', 4],
        ['Panaro, Manuel', 'FWD', 4],
        ['Zalazar, Maximiliano', 'FWD', 4],
        ['Giampaoli, Renzo', 'DEF', 6],
        ['Conti, Germán', 'DEF', 5],
        ['Martínez, Enzo', 'DEF', 4],
        ['Melluso, Matías', 'DEF', 4],
        ['Barros Schelotto, Bautista', 'DEF', 4],
        ['Silva Torrejón, Pedro', 'DEF', 4],
    ],
    IRV: [
        ['Macagno, Ramiro', 'GK', 7],
        ['Villa, Sebastián', 'FWD', 17],
        ['Atencio, Rodrigo', 'FWD', 8],
        ['Arce, Alex', 'FWD', 9],
        ['Florentín, José', 'MID', 10],
        ['Bottari, Tomás', 'MID', 7],
        ['Sequeira, Luis', 'MID', 6],
        ['Vázquez, Kevin', 'MID', 4],
        ['Studer, Sheyko', 'DEF', 11],
        ['Villalba, Iván', 'DEF', 5],
        ['Gómez, Luciano', 'DEF', 5],
        ['Elordi, Juan Manuel', 'DEF', 4],
        ['Sartori, Fabrizio', 'FWD', 5],
        ['Fernández, Matías', 'FWD', 5],
        ['Ramis, Victorio', 'FWD', 4],
        ['Arena, Nahuel', 'DEF', 4],
    ],
    BAN: [
        ['Sanguinetti, Facundo', 'GK', 4],
        ['Méndez, Mauro', 'FWD', 8],
        ['Zalazar, David', 'FWD', 4],
        ['Sepúlveda, Bruno', 'FWD', 4],
        ['Álvarez, Favio', 'MID', 4],
        ['López García, Santiago', 'MID', 4],
        ['Adoryan, Tomás', 'MID', 4],
        ['Moreno, Neyder', 'MID', 4],
        ['Pais, Ignacio', 'MID', 4],
        ['Ríos, Lautaro', 'MID', 4],
        ['Vittor, Sergio', 'DEF', 4],
        ['Abraham, Ignacio', 'DEF', 4],
        ['Colazo, Nicolás', 'DEF', 4],
        ['Arboleda, Danilo', 'DEF', 4],
        ['Alfaro, Juan Luis', 'DEF', 4],
        ['Meriano, Nicolás', 'DEF', 4],
    ],
    ALD: [
        ['Chicco, Ignacio', 'GK', 5],
        ['Rolón, Esteban', 'MID', 9],
        ['Bochi, Roberto', 'MID', 5],
        ['Gino, Federico', 'MID', 5],
        ['Leys, Franco', 'MID', 4],
        ['Cordero, Nicolás', 'FWD', 4],
        ['Arias, Junior', 'FWD', 4],
        ['Da Luz, Mauro', 'FWD', 4],
        ['Rodríguez, Lucas', 'DEF', 5],
        ['Enrique, Guillermo', 'DEF', 5],
        ['Novillo, Joaquín', 'DEF', 4],
        ['Breitenbruch, Néstor', 'DEF', 4],
        ['Moya, Santiago', 'DEF', 4],
        ['Fernández, Tomás', 'FWD', 4],
        ['Villarreal, Alejandro', 'FWD', 4],
        ['Zalazar, Nicolás', 'DEF', 4],
    ],
    ATU: [
        ['Ingolotti, Luis', 'GK', 4],
        ['Tesuri, Renzo', 'MID', 7],
        ['Ham, Ezequiel', 'MID', 4],
        ['Laméndola, Nicolás', 'MID', 4],
        ['Ortiz, Kevin', 'MID', 4],
        ['Román, Lucas', 'MID', 4],
        ['Díaz, Leandro', 'FWD', 7],
        ['Benítez, Martín', 'FWD', 6],
        ['Ruiz Rodríguez, Ramiro', 'FWD', 5],
        ['Nicola, Franco', 'FWD', 4],
        ['Suso, Gastón', 'DEF', 6],
        ['Infante, Juan José', 'DEF', 5],
        ['Compagnucci, Gabriel', 'DEF', 4],
        ['Di Plácido, Leonel', 'DEF', 4],
        ['Ferrari, Gianluca', 'DEF', 4],
        ['Durso, Tomás', 'GK', 4],
    ],
    SAR: [
        ['Burrai, Javier', 'GK', 4],
        ['Martínez, Mauricio', 'MID', 8],
        ['Zabala, Cristian', 'MID', 5],
        ['Gómez, Jonatan', 'MID', 6],
        ['Mónaco, Manuel', 'MID', 5],
        ['Arismendi, Yair', 'MID', 4],
        ['Quiroga, Sergio', 'MID', 4],
        ['Churín, Diego', 'FWD', 8],
        ['González, Gastón', 'FWD', 5],
        ['Magnín, Pablo', 'FWD', 5],
        ['Rentería, Jhon', 'FWD', 4],
        ['Insaurralde, Juan Manuel', 'DEF', 9],
        ['Suárez, Lucas', 'DEF', 5],
        ['Díaz, Gabriel', 'DEF', 4],
        ['Arturia, Gastón', 'DEF', 4],
        ['Pasquini, Nicolás', 'DEF', 4],
    ],
    DYJ: [
        ['Fiermarín, Cristopher', 'GK', 4],
        ['Banega, Ever', 'MID', 13],
        ['Botta, Rubén', 'MID', 12],
        ['Barbona, David', 'MID', 7],
        ['Molinas, Aarón', 'MID', 8],
        ['López, Julián', 'MID', 4],
        ['Pérez, César', 'MID', 4],
        ['Osorio, Abiel', 'FWD', 6],
        ['Altamira, Facundo', 'FWD', 4],
        ['Gutiérrez, Juan Manuel', 'FWD', 4],
        ['Amor, Emiliano', 'DEF', 11],
        ['Martínez, David', 'DEF', 8],
        ['Fernández, Damián', 'DEF', 4],
        ['Pereyra, Elías', 'DEF', 4],
        ['Cáceres, Darío', 'DEF', 4],
        ['Portillo, Ayrton', 'DEF', 4],
    ],
    CCO: [
        ['Aguerre, Alan', 'GK', 9],
        ['Juárez, Fernando', 'MID', 5],
        ['González, Lucas', 'MID', 4],
        ['Cravero, Tiago', 'MID', 4],
        ['Cardozo, Juan José', 'MID', 4],
        ['Iacobellis, Marco', 'MID', 4],
        ['Tijanovich, Horacio', 'MID', 4],
        ['Santos, Michael', 'FWD', 9],
        ['Naya, Ezequiel', 'FWD', 5],
        ['Barrera, Diego', 'FWD', 4],
        ['Flores, Joaquín', 'FWD', 4],
        ['Mansilla, Facundo', 'DEF', 4],
        ['Maciel, Alejandro', 'DEF', 4],
        ['Moyano, Santiago', 'DEF', 4],
        ['Casermeiro, Yuri', 'DEF', 4],
        ['Quiroga, Agustín', 'DEF', 4],
    ],
    RIE: [
        ['Arce, Ignacio', 'GK', 12],
        ['Monje, Pablo', 'MID', 5],
        ['Watson, Nicolás', 'MID', 4],
        ['Goitía, Jonatan', 'MID', 4],
        ['Dramisino, Alejo', 'MID', 4],
        ['Landriel, Leonardo', 'MID', 4],
        ['Herrera, Jonathan', 'FWD', 10],
        ['Benegas, Nicolás', 'FWD', 5],
        ['Alonso, Antony', 'FWD', 5],
        ['Díaz, Alexander', 'FWD', 4],
        ['Barbieri, Miguel Ángel', 'DEF', 5],
        ['Sansotre, Nicolás', 'DEF', 4],
        ['Caro Torres, Nicolás', 'DEF', 4],
        ['Ramírez, Pedro', 'DEF', 4],
        ['Bracamonte, Mariano', 'DEF', 4],
        ['Miño, Facundo', 'DEF', 4],
    ],
    INS: [
        ['Roffo, Manuel', 'GK', 7],
        ['Lodico, Gastón', 'MID', 9],
        ['Luna, Alex', 'MID', 8],
        ['Acevedo, Jonás', 'MID', 6],
        ['Méndez, Juan Ignacio', 'MID', 5],
        ['Moyano, Franco', 'MID', 5],
        ['Jara, Franco', 'FWD', 8],
        ['Suárez, Facundo', 'FWD', 5],
        ['Guerra, Nicolás', 'FWD', 4],
        ['Tissera, Matías', 'FWD', 4],
        ['Alarcón, Fernando', 'DEF', 10],
        ['De La Fuente, Hernán', 'DEF', 6],
        ['Cerato, Giuliano', 'DEF', 5],
        ['Galván, Jonatan', 'DEF', 5],
        ['Mosevich, Leonel', 'DEF', 4],
        ['Bravo, Agustín', 'DEF', 4],
    ],
    PLA: [
        ['Vázquez, Ignacio', 'DEF', 12],
        ['Mainero, Guido', 'MID', 10],
        ['Gómez, Iván', 'MID', 7],
        ['Zapiola, Franco', 'MID', 6],
        ['Luna Diale, Mauro', 'MID', 5],
        ['Amarfil, Maximiliano', 'MID', 4],
        ['Barrios, Martín', 'MID', 4],
        ['Gauto, Juan Carlos', 'FWD', 8],
        ['Merlini, Bautista', 'FWD', 6],
        ['Lotti, Augusto', 'FWD', 6],
        ['Heredia, Leonardo', 'FWD', 6],
        ['Lencina, Gonzalo', 'FWD', 5],
        ['Borgogno, Matías', 'GK', 4],
        ['Cuesta, Víctor', 'DEF', 5],
        ['Saborido, Juan Ignacio', 'DEF', 5],
        ['Silva, Tomás', 'DEF', 5],
    ],
    GME: [
        ['Rigamonti, César', 'GK', 5],
        ['Sánchez, Ulises', 'MID', 8],
        ['Álvarez, Juan Pablo', 'MID', 5],
        ['Linares, Nicolás', 'MID', 5],
        ["O'Connor, Tomás", 'MID', 4],
        ['Lencioni, Facundo', 'MID', 4],
        ['Rodríguez, Santiago', 'FWD', 5],
        ['Armoa, Blas', 'FWD', 4],
        ['Muñoz, Ezequiel', 'DEF', 6],
        ['Franco, Juan José', 'DEF', 5],
        ['Mondino, Diego', 'DEF', 4],
        ['Cortez, Ismael', 'DEF', 4],
        ['González, Imanol', 'DEF', 4],
        ['Simoni, Valentino', 'FWD', 4],
        ['Cervera, Tobías', 'FWD', 4],
        ['Cingolani, Luciano', 'FWD', 4],
    ],
    NEW: [
        ['Arias, Gabriel', 'GK', 12],
        ['Cóccaro, Matías', 'FWD', 11],
        ['Mazzantti, Walter', 'FWD', 12],
        ['Hoyos, Michael', 'FWD', 8],
        ['Herrera, Luciano', 'FWD', 6],
        ['Ramírez, Juan Ignacio', 'FWD', 6],
        ['Orozco, Franco', 'FWD', 4],
        ['Méndez, Armando', 'DEF', 9],
        ['Risso Patrón, Gabriel', 'DEF', 6],
        ['Salcedo, Saúl', 'DEF', 5],
        ['Salomón, Oscar', 'DEF', 5],
        ['Luciano, Martín', 'DEF', 5],
        ['Noguera, Fabián', 'DEF', 4],
        ['Glavinovich, Ian', 'DEF', 4],
        ['Cabrera, Bruno', 'DEF', 4],
        ['Barlasina, Williams', 'GK', 4],
    ],
    SLO: [
        ['Gill, Orlando', 'GK', 10],
        ['Romaña, Jhohan', 'DEF', 11],
        ['Hernández, Gastón', 'DEF', 10],
        ['Tripichio, Nicolás', 'DEF', 9],
        ['Corujo, Guzmán', 'DEF', 5],
        ['Barrios, Nahuel', 'MID', 11],
        ['Abrego, Gonzalo', 'MID', 7],
        ['Cuello, Alexis', 'FWD', 10],
        ['Vietto, Luciano', 'FWD', 11],
        ['Cerutti, Ezequiel', 'FWD', 8],
        ['Reali, Matías', 'FWD', 6],
        ['Auzmendi, Rodrigo', 'FWD', 5],
        ['Herazo, Diego', 'FWD', 5],
        ['Perruzzi, Ignacio', 'MID', 5],
        ['Cardillo, Mauricio', 'MID', 5],
        ['Altamirano, Facundo', 'GK', 8],
    ],
    BAR: [
        ['Espínola, Juan', 'GK', 5],
        ['Tobio, Fernando', 'DEF', 8],
        ['Martínez, Damián', 'DEF', 8],
        ['Campi, Gastón', 'DEF', 6],
        ['Insúa, Rodrigo', 'DEF', 5],
        ['Barrios, Rafael', 'DEF', 5],
        ['Maroni, Gonzalo', 'MID', 9],
        ['Gordillo, Yeison', 'MID', 6],
        ['Tapia, Iván', 'MID', 6],
        ['Arce, Carlos', 'MID', 4],
        ['Gamba, Lucas', 'FWD', 9],
        ['Candia, Jhonatan', 'FWD', 8],
        ['Bogarín, Rodrigo', 'FWD', 7],
        ['Briasco, Norberto', 'FWD', 6],
        ['Morales, Gonzalo', 'FWD', 6],
        ['Bruera, Facundo', 'FWD', 6],
    ],
    ERC: [
        ['Bacchia, Renzo', 'GK', 4],
        ['Lozano, Raúl', 'DEF', 5],
        ['Ostchega, Tobías', 'DEF', 4],
        ['Bersano, Fernando', 'DEF', 4],
        ['Ojeda, Sergio', 'DEF', 4],
        ['Maffini, Gonzalo', 'DEF', 4],
        ['Cobos, Facundo', 'DEF', 4],
        ['Alanís, Gabriel', 'MID', 5],
        ['Cabrera, Alejandro', 'MID', 5],
        ['Ábila, Ramón', 'FWD', 7],
        ['Bajamich, Mateo', 'FWD', 5],
        ['Garnerone, Martín', 'FWD', 4],
        ['Talpone, Nicolás', 'MID', 4],
        ['Forclaz, Ezequiel', 'MID', 4],
        ['Morales, Agustín', 'FWD', 4],
        ['Valiente, Mauro', 'MID', 4],
    ],
    UNI: [
        ['Mansilla, Matías', 'GK', 9],
        ['Del Blanco, Mateo', 'MID', 9],
        ['Solari, Augusto', 'MID', 8],
        ['Menossi, Lucas', 'MID', 8],
        ['Pittón, Mauro', 'MID', 7],
        ['Palacios, Julián', 'MID', 5],
        ['Tarragona, Cristian', 'FWD', 10],
        ['Fragapane, Franco', 'FWD', 8],
        ['Estigarribia, Marcelo', 'FWD', 6],
        ['Díaz, Diego Armando', 'FWD', 5],
        ['Pittón, Bruno', 'DEF', 8],
        ['Fascendini, Valentín', 'DEF', 5],
        ['Ludueña, Juan Pablo', 'DEF', 4],
        ['Paz, Nicolás', 'DEF', 4],
        ['Cuello, Brahian', 'MID', 4],
        ['Colazo, Agustín', 'FWD', 4],
    ],
};

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (user?.role !== 'admin') {
            return Response.json({ error: 'Admin access required' }, { status: 403 });
        }

        const body = await req.json();
        const { action } = body;

        // ── ACTION: wipe_data ──
        // Deletes teams, players, matches in fast parallel chunks. Run this first.
        if (action === 'wipe_data') {
            console.log('Fetching existing data counts...');
            const [existingTeams, existingPlayers, existingMatches] = await Promise.all([
                base44.asServiceRole.entities.Team.list(),
                base44.asServiceRole.entities.Player.list(),
                base44.asServiceRole.entities.Match.list(),
            ]);
            console.log(`Deleting ${existingTeams.length} teams, ${existingPlayers.length} players, ${existingMatches.length} matches...`);

            async function deleteInChunks(entity, items) {
                for (let i = 0; i < items.length; i += 50) {
                    const chunk = items.slice(i, i + 50);
                    await Promise.all(chunk.map(x => entity.delete(x.id)));
                    if (i + 50 < items.length) await new Promise(r => setTimeout(r, 100));
                }
            }

            await Promise.all([
                deleteInChunks(base44.asServiceRole.entities.Match, existingMatches),
                deleteInChunks(base44.asServiceRole.entities.Player, existingPlayers),
                deleteInChunks(base44.asServiceRole.entities.Team, existingTeams),
            ]);

            return Response.json({
                success: true,
                message: 'All data deleted',
                deleted: {
                    teams: existingTeams.length,
                    players: existingPlayers.length,
                    matches: existingMatches.length,
                }
            });
        }

        // ── ACTION: seed_teams_and_matches ──
        // Creates teams, players, matches, updates AppConfig. Run AFTER delete_all_data.
        if (action === 'seed_teams_and_matches') {
            // ── 1. Create teams ──
            console.log('Creating 30 Liga AFA teams...');
            const teamData = ALL_TEAMS.map(t => ({
                name: t.name,
                fifa_code: t.code,
                is_qualified: true,
                group_code: t.group,
            }));
            const createdTeams = await base44.asServiceRole.entities.Team.bulkCreate(teamData);
            const teamMap = {};
            for (const t of createdTeams) teamMap[t.fifa_code] = t;
            console.log(`Created ${createdTeams.length} teams`);

            // ── 2. Create players ──
            console.log('Creating players...');
            const allPlayerData = [];
            for (const t of ALL_TEAMS) {
                const teamId = teamMap[t.code]?.id;
                if (!teamId) continue;
                const players = PLAYERS_BY_CODE[t.code] || [];
                for (const [full_name, position, price] of players) {
                    allPlayerData.push({ full_name, team_id: teamId, position, price, is_active: true });
                }
            }

            let players_created = 0;
            for (let i = 0; i < allPlayerData.length; i += 200) {
                const chunk = allPlayerData.slice(i, i + 200);
                const created = await base44.asServiceRole.entities.Player.bulkCreate(chunk);
                players_created += created.length;
            }
            console.log(`Created ${players_created} players`);

            // ── 3. Create matches ──
            console.log('Creating matches...');
            const fecha10Matches = FECHA_10.map(([home, away, kickoff]) => ({
                phase: 'APERTURA_ZONE',
                kickoff_at: kickoff,
                home_team_id: teamMap[home].id,
                away_team_id: teamMap[away].id,
                status: 'SCHEDULED',
                venue: 'Fecha 10',
            }));
            const fecha11Matches = FECHA_11.map(([home, away, kickoff]) => ({
                phase: 'APERTURA_ZONE',
                kickoff_at: kickoff,
                home_team_id: teamMap[home].id,
                away_team_id: teamMap[away].id,
                status: 'SCHEDULED',
                venue: 'Fecha 11',
            }));

            const allMatchData = [...fecha10Matches, ...fecha11Matches];
            const createdMatches = await base44.asServiceRole.entities.Match.bulkCreate(allMatchData);
            console.log(`Created ${createdMatches.length} matches`);

            // ── 4. Update AppConfig ──
            const configs = await base44.asServiceRole.entities.AppConfig.list();
            const configData = {
                tournament_start_at: '2026-04-05T16:00:00Z',
                tournament_phase: 'APERTURA_ZONE',
                transfer_window_state: 'OPEN',
                squad_lock_at: '2026-04-04T12:00:00Z',
            };
            if (configs.length > 0) {
                await base44.asServiceRole.entities.AppConfig.update(configs[0].id, configData);
            } else {
                await base44.asServiceRole.entities.AppConfig.create(configData);
            }

            return Response.json({
                success: true,
                message: 'Liga AFA Apertura data seeded successfully',
                summary: {
                    teams_created: createdTeams.length,
                    players_created,
                    matches_created: createdMatches.length,
                    fecha_10_matches: fecha10Matches.length,
                    fecha_11_matches: fecha11Matches.length,
                },
            });
        }

        return Response.json({ error: 'Invalid action. Use wipe_data or seed_teams_and_matches' }, { status: 400 });

    } catch (error) {
        console.error('ligaAfaSeedService error:', error);
        return Response.json({ error: error.message, stack: error.stack?.substring(0, 500) }, { status: 500 });
    }
});