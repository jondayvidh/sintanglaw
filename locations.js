export const IMAGE_WIDTH = 1698;
export const IMAGE_HEIGHT = 926;
export const WORLD_W = 170;
export const WORLD_H = (WORLD_W * IMAGE_HEIGHT) / IMAGE_WIDTH;

export const METERS_PER_PX = 0.22;

export const M = WORLD_W / (IMAGE_WIDTH * METERS_PER_PX);

export const pxToM = (px, py) => [(px - IMAGE_WIDTH / 2) * METERS_PER_PX, (py - IMAGE_HEIGHT / 2) * METERS_PER_PX];

const BLANK_IMAGE_URL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

const PLACE_IMAGE_IDS = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50]);

export function placeImage(id) {
  return PLACE_IMAGE_IDS.has(Number(id)) ? `images/${id}.jpg` : BLANK_IMAGE_URL;
}

function circle(cx, cy, r) {
  return {
    shape: "circle",
    cx,
    cy,
    r,
    center: { x: cx, y: cy }
  };
}

export const campusLocations = [
  { id: 1, title: "The Pylon", description: "A recognizable campus landmark near the main entrance.", imageUrl: placeImage(1), coordinates: circle(1294, 678, 26) },
  { id: 2, title: "The Mural", description: "A visual landmark located near the entrance area.", imageUrl: placeImage(2), coordinates: circle(1205, 699, 26) },
  { id: 3, title: "Visitor's Lounge", description: "A receiving area for visitors and guests near the entrance.", imageUrl: placeImage(3), coordinates: circle(1229, 626, 26) },
  { id: 4, title: "Open Court", description: "An open activity court within the front campus area.", imageUrl: placeImage(4), coordinates: circle(1291, 606, 26) },
  { id: 5, title: "Lawn Tennis Court", description: "Outdoor tennis court facility for sports activities.", imageUrl: placeImage(5), coordinates: circle(1160, 546, 26) },
  { id: 6, title: "Basketball Court", description: "Outdoor basketball court for campus recreation and events.", imageUrl: placeImage(6), coordinates: circle(1048, 474, 26) },
  { id: 7, title: "Souvenir Shop", description: "Campus shop area for PUP souvenir items.", imageUrl: placeImage(7), coordinates: circle(935, 544, 26) },
  { id: 8, title: "Mabini Shrine", description: "A historical site dedicated to Apolinario Mabini.", imageUrl: placeImage(8), coordinates: circle(835, 489, 26) },
  { id: 9, title: "Mabini Museum", description: "Museum area connected to the Mabini heritage site.", imageUrl: placeImage(9), coordinates: circle(749, 497, 26) },
  { id: 10, title: "Obelisk", description: "A prominent symbolic structure inside the campus.", imageUrl: placeImage(10), coordinates: circle(886, 452, 26) },
  { id: 11, title: "Freedom Park", description: "An open campus park for gatherings and student activities.", imageUrl: placeImage(11), coordinates: circle(683, 473, 26) },
  { id: 12, title: "Fountain Park", description: "A landscaped park area with a central fountain feature.", imageUrl: placeImage(12), coordinates: circle(566, 512, 26) },
  { id: 13, title: "Inter Faith Chapel", description: "A chapel space for prayer and reflection.", imageUrl: placeImage(13), coordinates: circle(363, 519, 26) },
  { id: 14, title: "Main Academic Building", description: "The main academic building complex of the campus.", imageUrl: placeImage(14), coordinates: circle(384, 363, 26) },
  { id: 15, title: "Gazebo", description: "A small open structure used as a resting or waiting area.", imageUrl: placeImage(15), coordinates: circle(116, 436, 26) },
  { id: 16, title: "Grandstand", description: "Seating structure facing the oval and open field.", imageUrl: placeImage(16), coordinates: circle(703, 554, 26) },
  { id: 17, title: "Oval", description: "Large open field and track area for sports and events.", imageUrl: placeImage(17), coordinates: circle(658, 658, 26) },
  { id: 18, title: "Tahanan ng Atleta", description: "Athlete-related campus facility near the oval area.", imageUrl: placeImage(18), coordinates: circle(631, 772, 26) },
  { id: 19, title: "Gabriela Silang Building", description: "A campus building located near the lower-left area of the map.", imageUrl: placeImage(19), coordinates: circle(486, 793, 26) },
  { id: 20, title: "Food and Nutrition Building", description: "Building associated with food and nutrition programs.", imageUrl: placeImage(20), coordinates: circle(149, 489, 26) },
  { id: 21, title: "Facility Management Office", description: "Office responsible for campus facility management functions.", imageUrl: placeImage(21), coordinates: circle(320, 385, 26) },
  { id: 22, title: "Sampaguita Building", description: "Sampaguita Building area in the PUP Sta. Mesa campus vicinity map.", imageUrl: placeImage(22), coordinates: circle(509, 287, 26) },
  { id: 23, title: "Student Center", description: "Student Center area in the PUP Sta. Mesa campus vicinity map.", imageUrl: placeImage(23), coordinates: circle(550, 308, 26) },
  { id: 24, title: "Charlie Del Rosario Building", description: "Charlie Del Rosario Building area in the PUP Sta. Mesa campus vicinity map.", imageUrl: placeImage(24), coordinates: circle(641, 325, 26) },
  { id: 25, title: "Linear Park", description: "Linear Park area in the PUP Sta. Mesa campus vicinity map.", imageUrl: placeImage(25), coordinates: circle(630, 255, 26) },
  { id: 26, title: "Laboratory High School Building", description: "Laboratory High School Building area in the PUP Sta. Mesa campus vicinity map.", imageUrl: placeImage(26), coordinates: circle(723, 273, 26) },
  { id: 27, title: "Printing Press Building", description: "Campus building associated with printing press operations.", imageUrl: placeImage(27), coordinates: circle(753, 196, 26) },
  { id: 28, title: "Property and Supply Management Office", description: "Office for property and supply management functions.", imageUrl: placeImage(28), coordinates: circle(829, 217, 26) },
  { id: 29, title: "Water Tower", description: "Water Tower area in the PUP Sta. Mesa campus vicinity map.", imageUrl: placeImage(29), coordinates: circle(869, 252, 26) },
  { id: 30, title: "Ninoy Aquino Learning Resource Center", description: "Learning resource center and library-related facility.", imageUrl: placeImage(30), coordinates: circle(898, 316, 26) },
  { id: 31, title: "Lagoon Commercial Spaces", description: "Commercial spaces located near the lagoon area.", imageUrl: placeImage(31), coordinates: circle(678, 362, 26) },
  { id: 32, title: "Amphitheater", description: "Outdoor amphitheater space for programs and gatherings.", imageUrl: placeImage(32), coordinates: circle(581, 363, 26) },
  { id: 33, title: "Lagoon Park", description: "Park area surrounding the campus lagoon.", imageUrl: placeImage(33), coordinates: circle(650, 415, 26) },
  { id: 34, title: "Nutrition and Food Technology Research and Development Center Building", description: "Research and development building for nutrition and food technology.", imageUrl: placeImage(34), coordinates: circle(1003, 306, 26) },
  { id: 35, title: "Human Kinetics Building", description: "Building associated with human kinetics and physical education.", imageUrl: placeImage(35), coordinates: circle(980, 392, 26) },
  { id: 36, title: "Tahanan ng Alumni", description: "Tahanan ng Alumni area in the PUP Sta. Mesa campus vicinity map.", imageUrl: placeImage(36), coordinates: circle(1087, 383, 26) },
  { id: 37, title: "Swimming Pool", description: "Swimming Pool area in the PUP Sta. Mesa campus vicinity map.", imageUrl: placeImage(37), coordinates: circle(1117, 427, 26) },
  { id: 38, title: "Multi-Purpose Building", description: "Large multi-purpose facility for campus activities.", imageUrl: placeImage(38), coordinates: circle(1315, 453, 26) },
  { id: 39, title: "Engineering and Science Research Center", description: "Research center for engineering and science-related work.", imageUrl: placeImage(39), coordinates: circle(1432, 545, 26) },
  { id: 40, title: "Communication Building", description: "Campus building for communication-related programs.", imageUrl: placeImage(40), coordinates: circle(1186, 184, 26) },
  { id: 41, title: "PUP Theater", description: "Theater facility for performances, assemblies, and events.", imageUrl: placeImage(41), coordinates: circle(1204, 149, 26) },
  { id: 42, title: "Engineering and Architecture Building", description: "Building used for engineering and architecture programs.", imageUrl: placeImage(42), coordinates: circle(1262, 144, 26) },
  { id: 43, title: "Condotel", description: "Condotel area in the PUP Sta. Mesa campus vicinity map.", imageUrl: placeImage(43), coordinates: circle(1108, 104, 26) },
  { id: 44, title: "NDC Tennis Court and Club House", description: "Tennis court and clubhouse facility in the NDC area.", imageUrl: placeImage(44), coordinates: circle(1334, 164, 26) },
  { id: 45, title: "NDC Covered Court", description: "NDC Covered Court area in the PUP Sta. Mesa campus vicinity map.", imageUrl: placeImage(45), coordinates: circle(1334, 129, 26) },
  { id: 46, title: "Business Processing Office", description: "Business Processing Office area in the PUP Sta. Mesa campus vicinity map.", imageUrl: placeImage(46), coordinates: circle(1418, 129, 26) },
  { id: 47, title: "Information Technology Building", description: "Building associated with information technology programs or offices.", imageUrl: placeImage(47), coordinates: circle(1399, 79, 26) },
  { id: 48, title: "Antique House", description: "A heritage-style structure identified as the Antique House.", imageUrl: placeImage(48), coordinates: circle(1311, 96, 26) },
  { id: 49, title: "Graduate School", description: "Graduate School area in the PUP Sta. Mesa campus vicinity map.", imageUrl: placeImage(49), coordinates: circle(1518, 38, 26) },
  { id: 50, title: "Hasmin Building", description: "Hasmin Building area in the PUP Sta. Mesa campus vicinity map.", imageUrl: placeImage(50), coordinates: circle(1628, 74, 26) }
];

const LANDMARK_IDS = new Set([1, 2, 8, 9, 10, 11, 12, 13, 15, 16, 17, 25, 29, 32, 33, 48]);
export const categoryOf = (l) => (LANDMARK_IDS.has(l.id) ? "landmark" : "academic");
export const categoryLabel = (c) => (c === "landmark" ? "Landmark" : "Academic");
export const locById = new Map(campusLocations.map((l) => [l.id, l]));


export const SITE_OFFSETS = Object.freeze({
  22: [-3.75, 0], 23: [3.75, 0], 26: [-7.07, 0], 28: [7.07, 0],
  30: [-6.38, 0], 34: [6.09, -5.58], 35: [-8.02, 0.42], 36: [8.32, 5.16],
  40: [0, 1], 41: [10.05, 0], 42: [-1.25, -1], 43: [-10.05, 0], 48: [1.25, 0]
});

export function applySiteOffset(id, p) {
  const offset = SITE_OFFSETS[id];
  return offset ? { ...p, cx: p.cx + offset[0], cy: p.cy + offset[1] } : p;
}

export const COURT_LAYOUT = Object.freeze([
  { id: 4, x: 1282.4, y: 603.2, w: 130, d: 38, rot: 24, kind: "basketball" },
  { id: 5, x: 1168, y: 540, w: 125, d: 55, rot: 22, kind: "tennis" },
  { id: 6, x: 1081.5, y: 481.9, w: 75, d: 36, rot: 24, kind: "basketball" },
  { id: 44, x: 1334, y: 182, w: 44, d: 24, rot: 0, kind: "tennis" }
]);

const MAROON = { type: "hip", mat: "maroon" };

export const BLOCKS = {
  14: [
    { cx: 243, cy: 374, w: 237, d: 44, rot: -2, floors: 6, style: "balcony", roof: { ...MAROON, rise: 2.9 }, balcony: { depth: 1.6 }, entrance: { x: -0.3, w: 4.5 } },
    { cx: 256, cy: 328, w: 212, d: 50, rot: -2, floors: 5, style: "balcony", roof: { type: "flat", lightwells: 3, parapetColor: "accent" }, bands: true, balconyBack: true },
    { cx: 426, cy: 334, w: 118, d: 72, rot: 0, floors: 6, style: "balcony", roof: { ...MAROON, rise: 3.3, skylight: true } },
    { cx: 480, cy: 380, w: 255, d: 42, rot: 4, floors: 6, style: "balcony", roof: { ...MAROON, rise: 2.9 }, balcony: { depth: 1.6 }, pilasters: { w: 1.1, color: "accent" } },
  ],
  18: [{ cx: 628, cy: 782, w: 96, d: 56, rot: 0, floors: 3, style: "colonial", roof: { type: "flat", parapet: 0.8 }, entrance: { x: 0, w: 3.4 } }],
  19: [{ cx: 492, cy: 812, w: 72, d: 52, rot: 0, floors: 3, style: "brick", roof: { ...MAROON, rise: 2.6 }, entrance: { x: 0, w: 2.6 } }],
  20: [{ cx: 147, cy: 497, w: 52, d: 82, rot: -10, floors: 2, style: "colonial", roof: { ...MAROON, rise: 2.0 }, entrance: { x: 0, w: 3.2 } }],
  22: [{ cx: 522, cy: 288, w: 44, d: 30, rot: 0, floors: 3, style: "terracotta", roof: { type: "flat", parapet: 0.5 }, entrance: { x: 0.2, w: 3 } }],
  23: [{ cx: 553, cy: 300, w: 30, d: 24, rot: 0, floors: 2, style: "whitemod", roof: { ...MAROON, rise: 2.0 }, entrance: { x: 0, w: 2.8 } }],
  24: [{ cx: 598, cy: 296, w: 52, d: 44, rot: 0, floors: 3, style: "whitered", roof: { ...MAROON, rise: 2.6 }, pilasters: { w: 0.9, color: "red", every: 4.4 }, entrance: { x: 0, w: 4.2 } }],
  26: [{ cx: 753, cy: 240, w: 156, d: 46, rot: 0, floors: 5, style: "redlab", roof: { ...MAROON, rise: 2.3 }, pilasters: { w: 1.4, color: "white" }, balcony: { depth: 1.3 }, entrance: { x: 0.1, w: 3.6 } }],
  27: [{ cx: 753, cy: 198, w: 44, d: 22, rot: 0, floors: 2, style: "whitemod", roof: { type: "flat" } }],
  28: [{ cx: 832, cy: 222, w: 26, d: 20, rot: 0, floors: 2, style: "cream", roof: { type: "flat" } }],
  30: [
    { cx: 827, cy: 318, w: 252, d: 52, rot: -14, floors: 3, style: "whitemod", roof: { type: "flat", inner: true, parapet: 1.0 }, entrance: { x: -0.1, w: 5.0 } },
    { cx: 915, cy: 322, w: 120, d: 60, rot: 0, floors: 4, style: "whitemod", roof: { type: "flat", inner: true, parapet: 1.0 } },
  ],
  31: [{ cx: 678, cy: 360, w: 36, d: 14, rot: 0, floors: 1, style: "shop", roof: { type: "flat", parapet: 0.4, plant: false } }],
  34: [{ cx: 1012, cy: 326, w: 90, d: 40, rot: 10, floors: 3, style: "whitemod", roof: { type: "flat", parapet: 0.9 }, balcony: { depth: 1.4 } }],
  35: [{ cx: 968, cy: 372, w: 105, d: 32, rot: -4, floors: 2, style: "cream", roof: { ...MAROON, rise: 2.4, ov: 1.2 }, balcony: { depth: 1.4 }, entrance: { x: 0.2, w: 3.4 } }],
  36: [{ cx: 1050, cy: 366, w: 88, d: 38, rot: -3, floors: 2, style: "pinkhouse", roof: { ...MAROON, rise: 2.5, ov: 1.0 }, entrance: { x: 0, w: 3 } }],
  3:  [{ cx: 1235, cy: 632, w: 38, d: 22, rot: 22, floors: 1, style: "brick", roof: { ...MAROON, rise: 1.6, ov: 1.4 }, minD: 7, entrance: { x: 0, w: 2.4, canopy: false } }],
  7:  [{ cx: 935, cy: 544, w: 28, d: 18, rot: 24, floors: 1, style: "shop", roof: { type: "hip", mat: "clay", rise: 1.3, ov: 0.9 }, minD: 4.5, minW: 6 }],
  9:  [{ cx: 749, cy: 497, w: 36, d: 24, rot: 0, floors: 1, style: "whitered", roof: { type: "hip", mat: "redtrim", rise: 1.7, ov: 1.1 }, minD: 6, entrance: { x: 0.3, w: 2.2, canopy: false } }],
  40: [{ cx: 1220, cy: 180, w: 40, d: 35, rot: 0, floors: 2, style: "louver", roof: { type: "flat", parapet: 0.7 }, entrance: { x: 0, w: 4 } }],
  41: [{ cx: 1170, cy: 130, w: 62, d: 55, rot: 30, floors: 3, style: "whitehall", roof: { type: "flat", parapet: 1.0 }, fh: 4.2, entrance: { x: 0, w: 4.5 } }],
  42: [{ cx: 1262, cy: 138, w: 60, d: 22, rot: 0, floors: 3, style: "whitered", roof: { type: "flat", parapet: 0.8 }, pilotis: true, minD: 11 }],
  43: [
    { cx: 1124, cy: 137, w: 48, d: 47, rot: 0, floors: 5, style: "condo", roof: { type: "flat", parapet: 0.9 }, pilasters: { w: 0.9, color: "accent" }, entrance: { x: 0, w: 3.6 } },
    { cx: 1123, cy: 98, w: 20, d: 20, rot: 0, floors: 8, style: "condo", roof: { type: "flat", parapet: 0.6 } },
  ],
  44: [{ cx: 1340, cy: 150, w: 26, d: 14, rot: 0, floors: 1, style: "cream", roof: { ...MAROON, rise: 1.5 }, minD: 6, entrance: { x: 0, w: 2 } }],
  46: [{ cx: 1418, cy: 129, w: 34, d: 18, rot: 0, floors: 2, style: "orange", roof: { type: "flat", parapet: 0.5 }, minD: 7, entrance: { x: 0, w: 3 } }],
  47: [{ cx: 1399, cy: 80, w: 50, d: 22, rot: 0, floors: 3, style: "cream", roof: { type: "hip", mat: "pinkred", rise: 2.0 }, balcony: { depth: 1.3 }, entrance: { x: 0, w: 3 } }],
  48: [{ cx: 1311, cy: 98, w: 40, d: 24, rot: 0, floors: 2, style: "heritage", roof: { type: "hip", mat: "clay", rise: 3.4, ov: 1.3 }, minD: 8, entrance: { x: 0, w: 2.4 } }],
  49: [{ cx: 1518, cy: 40, w: 46, d: 20, rot: 0, floors: 3, style: "awning", roof: { type: "flat", parapet: 0.6 }, entrance: { x: 0, w: 3 } }],
  50: [{ cx: 1628, cy: 76, w: 58, d: 18, rot: 0, floors: 5, style: "greypunch", roof: { type: "flat", parapet: 0.7 }, minD: 11 }],
  39: [{ cx: 1468, cy: 505, w: 130, d: 55, rot: -14, floors: 4, style: "esrc", roof: { type: "flat", parapet: 0.7, solar: true }, pilotis: true, minD: 13, entrance: { x: 0.3, w: 3.6 } }],
};

export const STREET_WALL = [[[440, 912], [600, 872], [800, 822], [1000, 768], [1100, 738], [1190, 712]], [[1335, 676], [1500, 628], [1640, 584]]];

export const TREE_DATA = "245,573,21;912,512,20.7;327,695,13;158,599,16.2;751,733,13.6;560,810,14.5;961,710,21;415,476,17;423,822,19.6;655,374,15.2;1070,275,11;781,733,15.7;641,829,21;437,769,21;251,526,13.6;435,526,20.9;147,571,12.9;1287,643,13.3;936,417,12.8;836,785,21;1004,526,21;538,487,13.8;482,716,15.9;1329,636,21;1158,619,15.6;1188,586,14.8;233,706,18.3;202,566,14.5;369,700,15.9;755,771,21;386,757,18.3;466,567,19.6;1008,283,10;800,403,10;942,576,9.9;836,516,17;435,564,13.5;262,455,10.3;462,447,15.5;1198,676,13.2;827,729,15.6;746,595,10.9;755,412,13.4;513,753,21;942,467,13.3;866,751,11.8;991,577,11.7;790,360,21;1095,581,18.2;219,458,10.5;372,181,17.2;967,296,10.9;365,733,15.8;917,755,21;708,823,15.3;370,441,15.1;765,815,18.3;717,729,13.5;595,243,20.2;1092,441,14.8;182,645,21;811,525,11;635,277,12.9;558,467,12.6;992,460,16.1;1123,594,12.1;450,266,14.3;982,760,15.8;1049,435,13.4;343,509,12.3;535,790,17.1;567,247,10.1;330,197,20.8;902,256,16.4;703,507,11.9;1009,721,16.7;612,503,13.1;785,514,10.6;528,517,16;1104,661,10.2;1194,298,11;280,715,16.6;1417,570,10.9;1140,308,11.2;696,301,19.1;1062,299,12;312,451,15;334,437,9.6;820,341,15.6;311,539,11.8;290,206,13.2;691,757,21;289,289,16.9;949,747,14.9;804,202,13.5;1012,487,15.2;423,707,11.3;799,773,15.5;1078,651,11;546,242,10.4;1054,339,16.5;207,678,14.3;742,470,17.4;1050,718,15.9;1123,338,18.9;279,775,14.2;1150,659,10;566,773,13.2;404,735,12.2;713,204,13.9;1249,529,16.2;417,229,16.4;732,802,19.2;1108,632,15.5;882,477,18.9;322,773,16.8;1066,205,16.1;348,863,13.1;1091,519,19.8;1061,493,10.2;1043,269,13.5;1019,200,19.5;227,636,20.6;550,350,12.9;1142,701,9;643,221,12;789,462,12;1254,616,9.7;392,261,13;617,856,17.6;1277,183,12.1;707,594,11.8;622,305,9.9;966,477,10.9;292,588,10.5;662,468,12.1;547,750,16.4;616,467,21;346,821,13.6;1043,554,10.3;1125,453,12.8;875,162,12.5;327,489,9.9;697,388,13.1;511,247,9.3;1030,745,16.1;750,297,12.7;976,260,15.9;622,571,11;1013,412,15.4;883,526,14.2;288,751,11.3;260,620,12;451,475,13.2;354,671,14.3;1143,274,12.7;345,284,13;200,600,21;674,848,10.1;373,818,15.2;1167,454,14.7;1126,565,15.1;1165,685,17.8;1012,578,9.4;667,796,11.1;510,357,12.7;799,293,11.2;976,214,11.4;811,495,13.1;900,721,14.4;959,522,16.8;1203,633,14;664,284,17.4;761,517,10.9;321,881,13;1110,733,14.4;474,280,10.6;458,887,15.5;709,457,13.1;406,863,14.4;225,516,14.1;587,465,9.4;241,752,14.5;725,579,9.8;269,849,13.4;1061,121,9.1;1218,301,13;381,869,12.4;941,270,11.7;238,488,11;372,284,11.3;348,757,15.2;1157,481,15.2;824,453,15.5;338,720,14.4;987,681,12.4;290,680,11.7;827,402,14.3;1161,582,12;960,445,14.7;1363,647,13;1016,671,11.3;515,556,10.7;1012,237,13.5;645,409,11.2;1232,281,10;1146,366,10.3;812,572,9;910,400,11.9;607,377,10.1;938,782,16;961,594,12.9;607,326,10.4;1224,192,9.3;515,471,16;575,327,9.9;1041,515,21;1178,359,12.9;681,216,14.6;264,497,11.5;550,857,9.7;1133,233,13.6;1210,606,13.6;193,520,13.4;613,814,9;825,370,10.2;866,798,14;591,516,10.5;202,475,9;1065,543,14.9;1217,386,9.4;633,590,11.1;407,502,11;872,552,13.3;692,332,11.7;917,441,15.4;1062,746,13.7;1069,632,9.8;546,271,10.9;1268,399,15.3;448,716,10.6;801,807,21;930,709,9.3;1252,193,13.3;1392,553,10.6;590,864,10.5;835,279,13.9;762,381,11;261,681,13.7;678,449,11.8;732,387,13.5;725,421,9.9;1159,711,9.9;1176,288,9.3;1140,724,10;1094,233,14.1;239,465,10.9;153,215,11.4;933,391,12;491,332,11.6;965,145,9.9;505,575,10;1089,260,14.1;967,420,10.8;337,547,10.1;467,515,11.2;227,543,12.6;858,448,10.4;1173,646,13.3;308,268,10.9;781,210,11.8;881,776,11.2;891,798,12.2;474,753,16.6;421,288,13.1;1089,339,14.7;414,579,10.7;659,240,13;578,267,9.7;422,447,11.8;1029,296,14.1;270,551,15.1;205,726,10.9;1299,364,10.3;247,812,13;913,792,10.8;864,506,11.5;272,599,10.6;395,706,12.4;1156,333,15.2;982,494,12;1280,258,10.2;612,219,9.9;173,564,12.9;731,358,11.4;918,483,10.2;539,448,12;699,416,11.3;628,802,9.6;618,528,11.8;602,349,10.9;437,588,9.9;594,590,12.6;1184,618,10.3;974,612,9.2;657,567,9.7;496,525,13.4;311,570,12.4;465,539,10.2;724,494,9.8;1095,469,13.6;839,552,12.7;322,821,11.2;641,298,9;403,526,9.9;367,321,10.3;770,580,12.9;389,796,11.2;1319,604,14.9;388,470,9.6;434,862,14.9;651,346,11.8;931,248,10.4;692,794,14.1;317,517,11.7;1238,312,10.4;1068,459,9.6;291,839,10.4;695,845,11;240,667,12.4;385,300,9.2;1297,395,12.3;531,817,10.1;230,236,10.2;1039,408,11.4;1174,263,10.8;1085,312,14.3;1407,631,13.6;268,308,10.8;650,486,9.9;1258,637,10.7;1181,711,11.2;297,181,9.1;623,345,10.3;289,498,10.2;256,728,10.5;1112,540,9.4;551,530,10.2;761,450,11.1;661,311,9.1;266,748,11.2;863,577,13.1;840,255,10;417,793,9;1008,762,11.6;786,488,12.6;99,238,12.3;180,675,9.2;187,463,9.2;1079,729,10.6;414,264,9;1030,344,9;508,724,10.1;1092,611,10.3;496,265,13.1;989,554,10.4;1025,434,9.8;455,289,9.5;836,813,9;954,249,9;928,148,11.9;808,748,11.5;398,839,9;285,452,11.6;441,436,9;1208,281,9.1;782,389,9.3;178,539,10.8;686,591,9.4;526,265,10.1;129,408,13.7;632,366,9;1143,638,9.2;1130,622,9;613,438,9.3;567,871,9.5;987,287,10.7;728,443,11.4;1022,258,9.9;485,456,9;300,732,10.1;576,793,9.2;710,481,9;652,855,9;530,542,9.3;888,754,9.1;487,587,10.8;453,498,9.7;561,227,10.5;859,528,10;309,497,9.2;768,474,10;933,595,10.6;205,701,9.3";

export const SPECIAL_R = { 1: [1294, 678, 6], 2: [1205, 699, 8], 4: [1262, 595, 16], 5: [1168, 540, 16], 6: [1100, 490, 12], 8: [835, 489, 6], 10: [886, 452, 6], 11: [683, 473, 9], 12: [566, 512, 7], 13: [330, 480, 14], 15: [116, 436, 4], 16: [718, 545, 22], 25: [630, 262, 8], 29: [869, 252, 6], 32: [581, 363, 8], 37: [1125, 425, 20], 38: [1324, 468, 36], 44: [1334, 182, 13], 45: [1334, 129, 14] };

export const CONTEXT_BLOCKS = [
  { cx: 485, cy: 118, w: 112, d: 48, rot: 0, floors: 3, fh: 4.4, style: "stone", roof: { type: "flat", parapet: 1.2 }, bands: false },
  { cx: 640, cy: 118, w: 112, d: 48, rot: 0, floors: 3, fh: 4.4, style: "stone", roof: { type: "flat", parapet: 1.2 }, bands: false },
  { cx: 562, cy: 114, w: 64, d: 56, rot: 0, floors: 3, fh: 5.0, style: "stone", roof: { type: "hip", mat: "steel", rise: 3.2, ov: 0.6 }, entrance: { x: 0, w: 5, canopy: false } },
];

export const PEDESTRIAN_LINKS = Object.freeze([[22, 23], [23, 24], [41, 43], [46, 47]]);
