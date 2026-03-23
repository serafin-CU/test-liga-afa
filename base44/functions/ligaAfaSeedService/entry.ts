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

// Fecha 10 fixtures: [homeCode, awayCode, kickoff_utc]
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

// Fecha 11 fixtures: [homeCode, awayCode, kickoff_utc]
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
    ['BOC', 'RIV', '2026-04-13T20:30:00Z'], // Superclásico
];

// ── Real player data: 14 players per team ──
// Format: [full_name, position, price]
const PLAYERS_BY_CODE = {
    BOC: [
        ['Agustín Marchesín', 'GK', 7],
        ['Luis Advíncula', 'DEF', 6],
        ['Cristian Lema', 'DEF', 6],
        ['Lautaro Blanco', 'DEF', 8],
        ['Frank Fabra', 'DEF', 6],
        ['Leandro Paredes', 'MID', 11],
        ['Ander Herrera', 'MID', 8],
        ['Pol Fernández', 'MID', 7],
        ['Kevin Zenón', 'MID', 10],
        ['Ignacio Miramón', 'MID', 7],
        ['Edinson Cavani', 'FWD', 8],
        ['Miguel Merentiel', 'FWD', 8],
        ['Milton Giménez', 'FWD', 7],
        ['Exequiel Zeballos', 'FWD', 9],
    ],
    RIV: [
        ['Franco Armani', 'GK', 7],
        ['Paulo Díaz', 'DEF', 8],
        ['Germán Pezzella', 'DEF', 8],
        ['Marcos Acuña', 'DEF', 7],
        ['Fabricio Bustos', 'DEF', 7],
        ['Enzo Pérez', 'MID', 6],
        ['Nicolás De La Cruz', 'MID', 10],
        ['Kendry Páez', 'MID', 12],
        ['Manuel Lanzini', 'MID', 7],
        ['Giuliano Galoppo', 'MID', 8],
        ['Miguel Borja', 'FWD', 7],
        ['Pablo Solari', 'FWD', 8],
        ['Facundo Colidio', 'FWD', 7],
        ['Adam Bareiro', 'FWD', 6],
    ],
    RAC: [
        ['Gabriel Arias', 'GK', 6],
        ['Marco Di Cesare', 'DEF', 6],
        ['Agustín García Basso', 'DEF', 5],
        ['Facundo Mura', 'DEF', 6],
        ['Gonzalo Luzzi', 'DEF', 5],
        ['Valentín Carboni', 'MID', 11],
        ['Juan Fernando Quintero', 'MID', 7],
        ['Agustín Almendra', 'MID', 6],
        ['Santiago Sosa', 'MID', 8],
        ['Baltasar Rodríguez', 'MID', 5],
        ['Adrián Martínez', 'FWD', 6],
        ['Johan Carbonero', 'FWD', 6],
        ['Roger Martínez', 'FWD', 6],
        ['Maximiliano Salas', 'FWD', 5],
    ],
    IND: [
        ['Rodrigo Rey', 'GK', 6],
        ['Joaquín Laso', 'DEF', 6],
        ['Marco Pellegrino', 'DEF', 8],
        ['Iván Marcone', 'DEF', 5],
        ['Matías Vera', 'DEF', 6],
        ['Kevin Lomónaco', 'MID', 12],
        ['Lucas González', 'MID', 7],
        ['Rodrigo Atencio', 'MID', 5],
        ['Diego Tarzia', 'MID', 7],
        ['Gonzalo Asís', 'MID', 6],
        ['Gabriel Ávalos', 'FWD', 6],
        ['Santiago López', 'FWD', 5],
        ['Matías Giménez', 'FWD', 5],
        ['Ricardo Centurión', 'FWD', 5],
    ],
    // ── Strong clubs ──
    VEL: [
        ['Lucas Hoyos', 'GK', 6],
        ['Damián Fernández', 'DEF', 6],
        ['Valentín Gómez', 'DEF', 9],
        ['Mauricio Isla', 'DEF', 6],
        ['Lucas Orellano', 'DEF', 7],
        ['Thiago Fernández', 'MID', 8],
        ['Maxi Romero', 'MID', 7],
        ['Francisco Pizzini', 'MID', 7],
        ['Claudio Aquino', 'MID', 6],
        ['Matías Vargas', 'MID', 8],
        ['Braian Cufré', 'FWD', 5],
        ['Tomás Guidara', 'FWD', 6],
        ['Lucas Janson', 'FWD', 7],
        ['Pablo Galdames', 'FWD', 6],
    ],
    TAL: [
        ['Guido Herrera', 'GK', 7],
        ['Gastón Benavídez', 'DEF', 5],
        ['Franco Fragapane', 'DEF', 6],
        ['Matías Catalán', 'DEF', 6],
        ['Pedro Velurtas', 'DEF', 5],
        ['Rodrigo Villagra', 'MID', 7],
        ['Carlos Auzqui', 'MID', 6],
        ['Giuliano Galoppo', 'MID', 7],
        ['Ángel Canobbio', 'MID', 8],
        ['Diego Valoyes', 'MID', 7],
        ['Héctor Fértoli', 'FWD', 5],
        ['Marcos Ybáñez', 'FWD', 5],
        ['Nahuel Tenaglia', 'FWD', 5],
        ['Tomás Márquez', 'FWD', 6],
    ],
    BEL: [
        ['Ignacio Chicco', 'GK', 6],
        ['Juan Cruz Komar', 'DEF', 7],
        ['Gastón Avila', 'DEF', 8],
        ['Hernán Galíndez', 'DEF', 5],
        ['Gonzalo Montiel', 'DEF', 7],
        ['Ignacio Vélez', 'MID', 6],
        ['Rodrigo Aliendro', 'MID', 6],
        ['Matías Suárez', 'MID', 7],
        ['Lucas Passerini', 'MID', 7],
        ['Santiago Longo', 'MID', 5],
        ['Cristian Romero', 'FWD', 8],
        ['Nicolás Merino', 'FWD', 5],
        ['Ulises Sánchez', 'FWD', 5],
        ['Facundo Buonanotte', 'FWD', 9],
    ],
    EDL: [
        ['Javier García', 'GK', 6],
        ['Santiago Ascacíbar', 'DEF', 7],
        ['Fernando Zuqui', 'DEF', 6],
        ['Lucas Rodríguez', 'DEF', 6],
        ['Javier Correa', 'DEF', 7],
        ['Manuel Castro', 'MID', 6],
        ['Rodrigo Buti', 'MID', 5],
        ['Franco Zapiola', 'MID', 5],
        ['Leandro Díaz', 'MID', 7],
        ['Nahuel Di Pierro', 'MID', 5],
        ['Guido Carrillo', 'FWD', 8],
        ['Gonzalo Morales', 'FWD', 6],
        ['Jorge Rodríguez', 'FWD', 5],
        ['Mauro Boselli', 'FWD', 6],
    ],
    LAN: [
        ['Nahuel Losada', 'GK', 6],
        ['Nelson Acevedo', 'DEF', 6],
        ['Matías Pérez García', 'DEF', 7],
        ['Alexis González', 'DEF', 6],
        ['Luciano Boggio', 'DEF', 5],
        ['Tomás Belmonte', 'MID', 9],
        ['Brian Aguirre', 'MID', 8],
        ['José Sand', 'MID', 5],
        ['Iván Risso Patrón', 'MID', 5],
        ['Marcelino Moreno', 'MID', 8],
        ['Lautaro Acosta', 'FWD', 7],
        ['Facundo Ferreyra', 'FWD', 6],
        ['Nicolás Orsini', 'FWD', 7],
        ['Leonel Miranda', 'FWD', 5],
    ],
    HUR: [
        ['Sebastián Rincón', 'GK', 5],
        ['Jonathan Galván', 'DEF', 5],
        ['Ignacio Arce', 'DEF', 5],
        ['Carlos Pompeya', 'DEF', 5],
        ['Rodrigo Echeverría', 'DEF', 5],
        ['Santiago Hezze', 'MID', 6],
        ['Rodrigo Contreras', 'MID', 6],
        ['Ezequiel Cano', 'MID', 5],
        ['Leonel Galeano', 'MID', 8],
        ['Nelson Acevedo', 'MID', 6],
        ['Julián Aude', 'FWD', 9],
        ['Nicolás Cordero', 'FWD', 5],
        ['Franco Cristaldo', 'FWD', 7],
        ['Luciano Pons', 'FWD', 6],
    ],
    // ── Mid clubs ──
    BAN: [
        ['Facundo Altamirano', 'GK', 5],
        ['Emanuel Coronel', 'DEF', 5],
        ['Alexis Martín Arias', 'DEF', 5],
        ['Juan Cruz Kaprof', 'DEF', 5],
        ['Luciano Lollo', 'DEF', 5],
        ['Nicolás Bertolo', 'MID', 6],
        ['Agustín Fontana', 'MID', 6],
        ['Jesús Dátolo', 'MID', 5],
        ['Lautaro Geminiani', 'MID', 5],
        ['Juan Álvarez', 'MID', 5],
        ['Ramiro Enrique', 'FWD', 4],
        ['Gonzalo Maroni', 'FWD', 6],
        ['Carlos Benítez', 'FWD', 5],
        ['Sebastián Villa', 'FWD', 7],
    ],
    ARG: [
        ['Germán Lux', 'GK', 5],
        ['Francisco Lescano', 'DEF', 4],
        ['Lucas Villalba', 'DEF', 4],
        ['Luciano Sánchez', 'DEF', 4],
        ['Gabriel Ávalos', 'DEF', 5],
        ['Fausto Vera', 'MID', 8],
        ['Lucas Castro', 'MID', 6],
        ['Claudio Spinelli', 'MID', 5],
        ['Matías Romero', 'MID', 5],
        ['Federico Lértora', 'MID', 5],
        ['Luciano Gondou', 'FWD', 7],
        ['Gabriel Hauche', 'FWD', 5],
        ['Enrique Triverio', 'FWD', 6],
        ['Rodrigo Contreras', 'FWD', 5],
    ],
    TIG: [
        ['Gonzalo Marinelli', 'GK', 5],
        ['Sebastián Prediger', 'DEF', 5],
        ['Marcos Garriga', 'DEF', 4],
        ['Rodrigo Villagra', 'DEF', 5],
        ['Julio Buffarini', 'DEF', 5],
        ['Sebastián Fernández', 'MID', 6],
        ['Federico Andrada', 'MID', 6],
        ['Alexis Castro', 'MID', 5],
        ['Diego Morales', 'MID', 5],
        ['Facundo Colidio', 'MID', 6],
        ['Lucas Menossi', 'FWD', 5],
        ['Julián Aude', 'FWD', 5],
        ['Tomás Pozzo', 'FWD', 4],
        ['Ezequiel Cerutti', 'FWD', 5],
    ],
    ROS: [
        ['Jorge Broun', 'GK', 6],
        ['Facundo Almada', 'DEF', 5],
        ['Lautaro Blanco', 'DEF', 5],
        ['Paulo Gazzaniga', 'DEF', 6],
        ['Emanuel Ojeda', 'DEF', 5],
        ['Marco Ruben', 'MID', 5],
        ['Emiliano Vecchio', 'MID', 7],
        ['Ignacio Russo', 'MID', 5],
        ['Alejo Véliz', 'MID', 8],
        ['Enzo Copetti', 'MID', 7],
        ['Nahuel Bustos', 'FWD', 7],
        ['Ángel Di María', 'FWD', 9],
        ['Marco Ruben', 'FWD', 5],
        ['Gustavo Bou', 'FWD', 6],
    ],
    NEW: [
        ['Alan Aguerre', 'GK', 5],
        ['Franco Troyansky', 'DEF', 5],
        ['Gustavo Velásquez', 'DEF', 5],
        ['Facundo Mansilla', 'DEF', 5],
        ['Lucas Hoyos', 'DEF', 5],
        ['Justo Giani', 'MID', 6],
        ['Nicolás Méndez', 'MID', 5],
        ['Cristian Lema', 'MID', 5],
        ['Jerónimo Cacciabue', 'MID', 6],
        ['Martín Lucero', 'MID', 5],
        ['Ignacio Scocco', 'FWD', 5],
        ['Lucas Albertengo', 'FWD', 5],
        ['Ramiro Funes Mori', 'FWD', 6],
        ['Santiago Gentiletti', 'FWD', 5],
    ],
    DYJ: [
        ['Ezequiel Unsain', 'GK', 6],
        ['Héctor Martínez', 'DEF', 5],
        ['Juan Rodríguez', 'DEF', 5],
        ['Marcelo Benítez', 'DEF', 5],
        ['Alexander Barboza', 'DEF', 7],
        ['Tomás Escalante', 'MID', 7],
        ['Lucas Menossi', 'MID', 6],
        ['Emmanuel Mas', 'MID', 5],
        ['Raúl Loaiza', 'MID', 5],
        ['Brian Montenegro', 'MID', 5],
        ['Braian Romero', 'FWD', 8],
        ['Agustín Urzi', 'FWD', 7],
        ['Walter Bou', 'FWD', 5],
        ['Jonathan Herrera', 'FWD', 5],
    ],
    ATU: [
        ['Tomás Marchiori', 'GK', 5],
        ['Ignacio Maestro Puch', 'DEF', 5],
        ['Federico Gino', 'DEF', 5],
        ['Álvaro Díaz', 'DEF', 5],
        ['Guillermo Acosta', 'DEF', 4],
        ['Renzo Tesuri', 'MID', 5],
        ['David Barbona', 'MID', 6],
        ['Pablo Vegetti', 'MID', 6],
        ['Matías Alustiza', 'MID', 5],
        ['Cristian Erbes', 'MID', 5],
        ['Ramiro Ruiz Rodríguez', 'FWD', 5],
        ['Luis Rodríguez', 'FWD', 6],
        ['Nicolás Delgadillo', 'FWD', 4],
        ['Abel Luciatti', 'FWD', 4],
    ],
    UNI: [
        ['Sebastián Moyano', 'GK', 5],
        ['Jonathan Bottinelli', 'DEF', 5],
        ['Claudio Corvalán', 'DEF', 5],
        ['Bruno Pittón', 'DEF', 5],
        ['Emmanuel Brítez', 'DEF', 5],
        ['Mauro Pittón', 'MID', 6],
        ['Federico Vera', 'MID', 5],
        ['Juan Nardoni', 'MID', 6],
        ['Ezequiel Cañete', 'MID', 5],
        ['Franco Troyansky', 'MID', 5],
        ['Nicolás Orsini', 'FWD', 6],
        ['Lucas Di Yorio', 'FWD', 5],
        ['Santiago González', 'FWD', 5],
        ['Joaquín Mosqueira', 'FWD', 4],
    ],
    SLO: [
        ['Fernando Monetti', 'GK', 5],
        ['Facundo Cuadrado', 'DEF', 5],
        ['Bruno Pittón', 'DEF', 5],
        ['Cristian Zapata', 'DEF', 6],
        ['Lucas Menossi', 'DEF', 5],
        ['Ezequiel Cerutti', 'MID', 6],
        ['Gustavo Torres', 'MID', 5],
        ['Pablo De Blasis', 'MID', 6],
        ['Nicolás Fernández', 'MID', 5],
        ['Enzo Kalinski', 'MID', 5],
        ['Nicolás Blandi', 'FWD', 7],
        ['Mauro Cauteruccio', 'FWD', 5],
        ['Adam Bareiro', 'FWD', 6],
        ['Juan Ramírez', 'FWD', 5],
    ],
    // ── Lower clubs ──
    RIE: [
        ['Facundo Cambeses', 'GK', 5],
        ['Lautaro Montoya', 'DEF', 4],
        ['Fernando Torrent', 'DEF', 4],
        ['Nicolás Pasquini', 'DEF', 4],
        ['Diego Ballesteros', 'DEF', 4],
        ['Sebastián Escudero', 'MID', 4],
        ['Alexis Flores', 'MID', 4],
        ['Carlos Quintana', 'MID', 4],
        ['Facundo Coria', 'MID', 4],
        ['Juan Cruz Esquivel', 'MID', 4],
        ['Carlos Luna', 'FWD', 5],
        ['Dante López', 'FWD', 4],
        ['Erik Luna', 'FWD', 5],
        ['Walter Mazzantti', 'FWD', 4],
    ],
    INS: [
        ['Facundo Chicco', 'GK', 4],
        ['Gabriel Gudiño', 'DEF', 4],
        ['Juan Pablo Zárate', 'DEF', 4],
        ['Hernán De La Fuente', 'DEF', 5],
        ['Nicolás Aguilar', 'DEF', 4],
        ['Emilio Pereyra', 'MID', 4],
        ['Matías Suárez', 'MID', 5],
        ['Carlos Sánchez', 'MID', 4],
        ['Pablo Vegetti', 'MID', 5],
        ['Leandro Vella', 'MID', 4],
        ['Alejandro Martínez', 'FWD', 4],
        ['Rodrigo Gómez', 'FWD', 4],
        ['Jonatán Cristaldo', 'FWD', 5],
        ['Mauricio Cuero', 'FWD', 5],
    ],
    PLA: [
        ['José Devecchi', 'GK', 4],
        ['Lucas Acevedo', 'DEF', 4],
        ['Fausto Vera', 'DEF', 5],
        ['Federico Pereyra', 'DEF', 4],
        ['Miguel Leal', 'DEF', 4],
        ['Kevin Mac Allister', 'MID', 6],
        ['Leandro Díaz', 'MID', 5],
        ['Emanuel Dening', 'MID', 4],
        ['Mauro Bogado', 'MID', 4],
        ['Jonathan Gómez', 'MID', 4],
        ['Nicolás Miracco', 'FWD', 4],
        ['Franco Di Santo', 'FWD', 5],
        ['Santiago Solari', 'FWD', 4],
        ['Gabriel Compagnucci', 'FWD', 4],
    ],
    GME: [
        ['Cristian Lucchetti', 'GK', 4],
        ['Federico Milo', 'DEF', 4],
        ['Jonás Aguirre', 'DEF', 4],
        ['Axel Werner', 'DEF', 5],
        ['Guillermo Ferreira', 'DEF', 4],
        ['Enzo Boyco', 'MID', 4],
        ['Marcos Borgogno', 'MID', 4],
        ['Rodrigo Insúa', 'MID', 4],
        ['Maxi Rodríguez', 'MID', 5],
        ['Miguel Caneo', 'MID', 4],
        ['Gabriel Alanís', 'FWD', 4],
        ['Facundo Godoy', 'FWD', 4],
        ['Juan Pablo Narváez', 'FWD', 4],
        ['Matías Mugni', 'FWD', 5],
    ],
    CCO: [
        ['Facundo Esperón', 'GK', 4],
        ['Lautaro Comas', 'DEF', 4],
        ['Jonathan Martínez', 'DEF', 4],
        ['Mauro Ortiz', 'DEF', 4],
        ['Lucas Suárez', 'DEF', 4],
        ['Javier Toledo', 'MID', 5],
        ['Mauricio Cuero', 'MID', 5],
        ['Renato Sobis', 'MID', 4],
        ['Marcos Rivadero', 'MID', 4],
        ['Cristian Núñez', 'MID', 4],
        ['Lautaro Tejeda', 'FWD', 4],
        ['Gonzalo Verón', 'FWD', 4],
        ['Federico Navarro', 'FWD', 4],
        ['Germán Voboril', 'FWD', 4],
    ],
    BAR: [
        ['Diego Rodríguez', 'GK', 4],
        ['Enzo Kalinski', 'DEF', 4],
        ['Jonathan Bauman', 'DEF', 4],
        ['Cristian Tarragona', 'DEF', 5],
        ['Facundo Quignon', 'DEF', 5],
        ['Leandro Fernández', 'MID', 5],
        ['Christian Bernardi', 'MID', 5],
        ['Iván Tapia', 'MID', 4],
        ['Matías Gracia', 'MID', 4],
        ['Lucas Accardi', 'MID', 4],
        ['Fausto Soria', 'FWD', 5],
        ['Ramiro Funes Mori', 'FWD', 5],
        ['Ramiro Enrique', 'FWD', 4],
        ['Gastón Díaz', 'FWD', 4],
    ],
    GLP: [
        ['Rodrigo Rey', 'GK', 5],
        ['Cristian Ferreira', 'DEF', 4],
        ['Nelson Ibáñez', 'DEF', 4],
        ['Joaquín Ibáñez', 'DEF', 4],
        ['Luciano Lollo', 'DEF', 4],
        ['Alexis Domínguez', 'MID', 4],
        ['Alex Luna', 'MID', 4],
        ['Guillermo Enrique', 'MID', 4],
        ['Leonardo Morales', 'MID', 4],
        ['Brahian Alemán', 'MID', 5],
        ['Rodrigo Castillo', 'FWD', 4],
        ['Eric Ramírez', 'FWD', 4],
        ['Augusto Solari', 'FWD', 4],
        ['Nery Leyes', 'FWD', 5],
    ],
    IRV: [
        ['Rodrigo Bossio', 'GK', 4],
        ['Gonzalo Bueno', 'DEF', 4],
        ['Fernando Juárez', 'DEF', 4],
        ['Ariel Kippes', 'DEF', 5],
        ['Federico Bravo', 'DEF', 4],
        ['Álvaro Lucero', 'MID', 4],
        ['Renzo Vera', 'MID', 4],
        ['Lucas González Pirez', 'MID', 5],
        ['Franco Torres', 'MID', 4],
        ['Felipe Hernández', 'MID', 4],
        ['Eric Cantero', 'FWD', 4],
        ['Jerónimo Cacciabue', 'FWD', 4],
        ['Franco Ibáñez', 'FWD', 4],
        ['Lucas Cañete', 'FWD', 4],
    ],
    ALD: [
        ['Germán Montoya', 'GK', 4],
        ['Cristian Tejeda', 'DEF', 4],
        ['Facundo Mura', 'DEF', 4],
        ['Federico Andrada', 'DEF', 4],
        ['Iván Ramírez', 'DEF', 4],
        ['Santiago Rosales', 'MID', 4],
        ['Nicolás Meza', 'MID', 4],
        ['Lionel González', 'MID', 4],
        ['Agustín Urzi', 'MID', 5],
        ['Nicolás Servetto', 'MID', 4],
        ['Franco Jara', 'FWD', 4],
        ['Brian Fernández', 'FWD', 5],
        ['Álvaro Barreal', 'FWD', 4],
        ['Santiago García', 'FWD', 4],
    ],
    ERC: [
        ['Facundo Sarco', 'GK', 4],
        ['Lautaro Geminiani', 'DEF', 4],
        ['Luciano Sánchez', 'DEF', 4],
        ['Marcos Pérez', 'DEF', 4],
        ['Franco Tormena', 'DEF', 4],
        ['Ignacio Pussetto', 'MID', 5],
        ['Emanuel Coronel', 'MID', 4],
        ['Santiago Torres', 'MID', 4],
        ['Gustavo Del Prete', 'MID', 4],
        ['Facundo Curuchet', 'MID', 4],
        ['Facundo Maciel', 'FWD', 4],
        ['Cristian Ramírez', 'FWD', 4],
        ['Paulo Dybala', 'FWD', 5],
        ['Rodrigo Herrera', 'FWD', 4],
    ],
    SAR: [
        ['Pablo Migliore', 'GK', 4],
        ['Matías Escudero', 'DEF', 4],
        ['Iván Erlich', 'DEF', 4],
        ['Jonás Aguirre', 'DEF', 4],
        ['Federico Varesio', 'DEF', 4],
        ['David Villalba', 'MID', 4],
        ['Rodrigo Herrera', 'MID', 4],
        ['Christian Vital', 'MID', 5],
        ['Ignacio Lores Varela', 'MID', 5],
        ['Carlos Luna', 'MID', 4],
        ['Mauricio Cuero', 'FWD', 4],
        ['Lucas Campana', 'FWD', 5],
        ['Renzo Tesuri', 'FWD', 4],
        ['Fabricio Oviedo', 'FWD', 4],
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

        if (body.action !== 'seed_teams_and_matches') {
            return Response.json({ error: 'Invalid action. Use seed_teams_and_matches' }, { status: 400 });
        }

        // ── 1. Wipe existing teams, players, matches ──
        console.log('Clearing existing data...');
        const [existingTeams, existingPlayers, existingMatches] = await Promise.all([
            base44.asServiceRole.entities.Team.list(),
            base44.asServiceRole.entities.Player.list(),
            base44.asServiceRole.entities.Match.list(),
        ]);

        async function deleteInChunks(entity, items) {
            for (let i = 0; i < items.length; i += 20) {
                const chunk = items.slice(i, i + 20);
                await Promise.all(chunk.map(x => entity.delete(x.id)));
                if (i + 20 < items.length) await new Promise(r => setTimeout(r, 300));
            }
        }

        await Promise.all([
            deleteInChunks(base44.asServiceRole.entities.Match, existingMatches),
            deleteInChunks(base44.asServiceRole.entities.Player, existingPlayers),
            deleteInChunks(base44.asServiceRole.entities.Team, existingTeams),
        ]);

        // ── 2. Create teams ──
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

        // ── 3. Create real players per team ──
        console.log('Creating players with real names...');
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
        for (let i = 0; i < allPlayerData.length; i += 100) {
            const chunk = allPlayerData.slice(i, i + 100);
            const created = await base44.asServiceRole.entities.Player.bulkCreate(chunk);
            players_created += created.length;
        }
        console.log(`Created ${players_created} players`);

        // ── 4. Create matches ──
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

        // ── 5. Update AppConfig ──
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

    } catch (error) {
        console.error('ligaAfaSeedService error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});