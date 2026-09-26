/**
 * Heat-Map Matrix – script.js
 * Reproduces the "nazrie file.xlsx" number-pattern matrix with interactive
 * Tier/Day selection and heat-map highlighting.
 *
 * Sections:
 *  1. DATA          – raw matrix and tier/day arrays
 *  2. NORMALIZATION – leading-O → leading-0 conversion
 *  3. STATE         – shared mutable state
 *  4. RENDERING     – build DOM tables
 *  5. DRAG SELECT   – mouse-drag selection on the tier/day table
 *  6. VALIDATION    – four-char code validation + live editing
 *  7. ADDING DAYS   – append Day-N columns
 *  8. HEAT MAP      – exact match + surrounding cell logic
 *  9. STATISTICS    – update stat counters
 * 10. SEARCH        – outline matching cells without changing heat-map
 * 11. PATTERN SUMMARY – per-day pattern-type % breakdown
 * 12. INIT          – wire everything up on DOMContentLoaded
 */

/* =====================================================================
   1. DATA
   ===================================================================== */

/** Column header labels (C1–C29). */
const COL_HEADERS = ["C1","C2","C3","C4","C5","C6","C7","C8","C9","C10","C11","C12","C13","C14","C15","C16","C17","C18","C19","C20","C21","C22","C23","C24","C25","C26","C27","C28","C29"];

/** Combination-type sub-headers aligned to COL_HEADERS. */
const PATTERN_TYPES = ["ABCD","AABC","AABB","AAAB","AAAA","ABCD","AABC","AABB","AAAB","ABCD","AABC","AABB","AAAB","ABCD","AABC","AABB","AAAB","ABCD","AABC","AABB","AAAB","ABCD","AABC","AABB","AAAB","ABCD","AABC","AABB","AAAB"];

/**
 * PRIME_COLS – 0-indexed positions into COL_HEADERS / each MATRIX_ROWS row's
 * `cells` array making up the "Prime Code" condensed reference set:
 * C1, C2, C6, C7, C11, C14, C15.
 * This exact 7-column subset is not arbitrary – it reproduces the "Prime
 * Code" block in Prediction_Analysis.xlsx ("... Prediction vs Actual"
 * sheets, columns AH:AN), which is the spreadsheet's own condensed
 * tracking view of the full 29-column matrix.
 */
const PRIME_COLS = [0, 1, 5, 6, 10, 13, 14];

/**
 * MATRIX_ROWS – `let`, not `const`: this is the DEFAULT data, but
 * "Upload Prediction Analysis" (section 13, IMPORT) replaces it wholesale
 * with whatever the uploaded workbook contains, so every function that
 * reads it does so live rather than capturing a snapshot at load time.
 * Each entry: { label: "R1", cells: [ "1123", null, … ] }
 * null = originally empty cell; string = code to display.
 * Values are already strings so leading zeros are preserved.
 * The "O" prefix from Excel is kept here exactly as in the source;
 * normalizeCode() converts it at runtime.
 * ↓↓↓ Replace this array with updated data when needed. ↓↓↓
 */
let MATRIX_ROWS = [
  {label:"R1",  cells:["1123","1112","1111","1111","OOOO","1234","1123","1122","1112","2345","2234","2233","2223","3456","3345","3344","3334","4567","4456","4455","4445","5678","5567","5566","5556","6789","6678","6677","6667"]},
  {label:"R2",  cells:["1124","1113","1122","1222","1111","1235","1124","1133","1113","2346","2235","2244","2224","3457","3346","3355","3335","4568","4457","4466","4446","5679","5568","5577","5557",null,"6679","6688","6668"]},
  {label:"R3",  cells:["1125","1114","1133","1333","2222","1236","1125","1144","1114","2347","2236","2255","2225","3458","3347","3366","3336","4569","4458","4477","4447","5689","5569","5588","5558",null,"6689","6699","6669"]},
  {label:"R4",  cells:["1126","1115","1144","1444","3333","1237","1126","1155","1115","2348","2237","2266","2226","3459","3348","3377","3337","4578","4459","4488","4448","5789","5578","5599","5559",null,"6778","7799","6777"]},
  {label:"R5",  cells:["1127","1116","1155","1555","4444","1238","1127","1166","1116","2349","2238","2277","2227","3467","3349","3388","3338","4579","4467","4499","4449",null,"5579",null,"5666",null,"6779",null,"6888"]},
  {label:"R6",  cells:["1128","1117","1166","1666","5555","1239","1128","1177","1117","2356","2239","2288","2228","3468","3356","3399","3339","4589","4468",null,"4555",null,"5589",null,"5777",null,"6788",null,"6999"]},
  {label:"R7",  cells:["1129","1118","1177","1777","6666","1245","1129","1188","1118","2357","2245","2299","2229","3469","3357","3455","3444","4678","4469",null,"4666",null,"5667",null,"5888",null,"6799",null,null]},
  {label:"R8",  cells:["1134","1119","1188","1888","7777","1246","1134","1199","1119","2358","2246",null,"2333","3478","3358",null,"3555","4679","4478",null,"4777",null,"5668",null,"5999",null,"6889",null,null]},
  {label:"R9",  cells:["1135","1122","1199","1999","8888","1247","1135",null,"1222","2359","2247",null,"2444","3479","3359",null,"3666","4689","4479",null,"4888",null,"5669",null,null,null,"6899",null,null]},
  {label:"R10", cells:["1136","1133","7788","1111","9999","1248","1136",null,"1333","2367","2248",null,"2555","3489","3367",null,"3777","4789","4489",null,"4999",null,"5677",null,null,null,"7789",null,null]},
  {label:"R11", cells:["1137","1144","8899","1112",null,"1249","1137",null,"1444","2368","2249",null,"2666","3567","3368",null,"3888",null,"4556",null,null,null,"5688",null,null,null,"7889",null,null]},
  {label:"R12", cells:["1138","1155",null,"1113",null,"1256","1138",null,"1555","2369","2256",null,"2777","3568","3369",null,"3999",null,"4557",null,null,null,"5699",null,null,null,"7899",null,null]},
  {label:"R13", cells:["1139","1166",null,"1114",null,"1257","1139",null,"1666","2378","2257",null,"2888","3569","3378",null,null,null,"4558",null,null,null,"5778",null,null,null,null,null,null]},
  {label:"R14", cells:["1145","1177",null,"1115",null,"1258","1145",null,"1777","2379","2258",null,"2999","3578","3379",null,null,null,"4559",null,null,null,"5779",null,null,null,null,null,null]},
  {label:"R15", cells:["1146","1188",null,"1116",null,"1259","1146",null,"1888","2389","2259",null,null,"3579","3389",null,null,null,"4566",null,null,null,"5788",null,null,null,null,null,null]},
  {label:"R16", cells:["1147","1199",null,"1117",null,"1267","1147",null,"1999","2456","2267",null,null,"3589","3445",null,null,null,"4577",null,null,null,"5799",null,null,null,null,null,null]},
  {label:"R17", cells:["1148","1223",null,"1118",null,"1268","1148",null,null,"2457","2268",null,null,"3678","3446",null,null,null,"4588",null,null,null,"5889",null,null,null,null,null,null]},
  {label:"R18", cells:["1149","1224",null,"1119",null,"1269","1149",null,null,"2458","2269",null,null,"3679","3447",null,null,null,"4599",null,null,null,"5899",null,null,null,null,null,null]},
  {label:"R19", cells:["1156","1225",null,"7778",null,"1278","1156",null,null,"2459","2278",null,null,"3689","3448",null,null,null,"4667",null,null,null,null,null,null,null,null,null,null]},
  {label:"R20", cells:["1157","1226",null,"7779",null,"1279","1157",null,null,"2467","2279",null,null,"3789","3449",null,null,null,"4668",null,null,null,null,null,null,null,null,null,null]},
  {label:"R21", cells:["1158","1227",null,"7888",null,"1289","1158",null,null,"2468","2289",null,null,null,"3466",null,null,null,"4669",null,null,null,null,null,null,null,null,null,null]},
  {label:"R22", cells:["1159","1228",null,"7999",null,"1345","1159",null,null,"2469","2334",null,null,null,"3477",null,null,null,"4677",null,null,null,null,null,null,null,null,null,null]},
  {label:"R23", cells:["1167","1229",null,"8889",null,"1346","1167",null,null,"2478","2335",null,null,null,"3488",null,null,null,"4688",null,null,null,null,null,null,null,null,null,null]},
  {label:"R24", cells:["1168","1233",null,"8999",null,"1347","1168",null,null,"2479","2336",null,null,null,"3499",null,null,null,"4699",null,null,null,null,null,null,null,null,null,null]},
  {label:"R25", cells:["1169","1244",null,null,null,"1348","1169",null,null,"2489","2337",null,null,null,"3556",null,null,null,"4778",null,null,null,null,null,null,null,null,null,null]},
  {label:"R26", cells:["1178","1255",null,null,null,"1349","1178",null,null,"2567","2338",null,null,null,"3557",null,null,null,"4779",null,null,null,null,null,null,null,null,null,null]},
  {label:"R27", cells:["1179","1266",null,null,null,"1356","1179",null,null,"2568","2339",null,null,null,"3558",null,null,null,"4788",null,null,null,null,null,null,null,null,null,null]},
  {label:"R28", cells:["1189","1277",null,null,null,"1357","1189",null,null,"2569","2344",null,null,null,"3559",null,null,null,"4799",null,null,null,null,null,null,null,null,null,null]},
  {label:"R29", cells:["1234","1288",null,null,null,"1358","1223",null,null,"2578","2355",null,null,null,"3566",null,null,null,"4889",null,null,null,null,null,null,null,null,null,null]},
  {label:"R30", cells:["1235","1299",null,null,null,"1359","1224",null,null,"2579","2366",null,null,null,"3577",null,null,null,"4899",null,null,null,null,null,null,null,null,null,null]},
  {label:"R31", cells:["1236","1334",null,null,null,"1366","1225",null,null,"2589","2377",null,null,null,"3588",null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R32", cells:["1237","1335",null,null,null,"1367","1226",null,null,"2678","2388",null,null,null,"3599",null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R33", cells:["1238","1336",null,null,null,"1368","1227",null,null,"2679","2399",null,null,null,"3667",null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R34", cells:["1239","1337",null,null,null,"1369","1228",null,null,"2689","2445",null,null,null,"3668",null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R35", cells:["1245","1338",null,null,null,"1378","1229",null,null,"2789","2446",null,null,null,"3669",null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R36", cells:["1246","1339",null,null,null,"1379","1233",null,null,null,"2447",null,null,null,"3677",null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R37", cells:["O247","O344",null,null,null,"1389","1244",null,null,null,"2448",null,null,null,"3688",null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R38", cells:["O248","O355",null,null,null,"1456","1255",null,null,null,"2449",null,null,null,"3699",null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R39", cells:["O249","O366",null,null,null,"1457","1266",null,null,null,"2455",null,null,null,"3778",null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R40", cells:["O256","O377",null,null,null,"1458","1277",null,null,null,"2466",null,null,null,"3779",null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R41", cells:["O257","O388",null,null,null,"1459","1288",null,null,null,"2477",null,null,null,"3788",null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R42", cells:["O258","O399",null,null,null,"1467","1299",null,null,null,"2488",null,null,null,"3799",null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R43", cells:["O259","O445",null,null,null,"1468","1334",null,null,null,"2499",null,null,null,"3889",null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R44", cells:["O267","O446",null,null,null,"1469","1335",null,null,null,"2556",null,null,null,"3899",null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R45", cells:["O268","O447",null,null,null,"1478","1336",null,null,null,"2557",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R46", cells:["O269","O448",null,null,null,"1479","1337",null,null,null,"2558",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R47", cells:["O278","O449",null,null,null,"1489","1338",null,null,null,"2559",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R48", cells:["O279","O455",null,null,null,"1567","1339",null,null,null,"2566",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R49", cells:["O289","O466",null,null,null,"1568","1344",null,null,null,"2577",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R50", cells:["O345","O477",null,null,null,"1569","1355",null,null,null,"2588",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R51", cells:["O346","O488",null,null,null,"1577","1377",null,null,null,"2599",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R52", cells:["O347","O499",null,null,null,"1578","1388",null,null,null,"2667",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R53", cells:["O348","O556",null,null,null,"1579","1399",null,null,null,"2668",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R54", cells:["O349","O557",null,null,null,"1589","1445",null,null,null,"2669",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R55", cells:["O356","O558",null,null,null,"1678","1446",null,null,null,"2677",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R56", cells:["O357","O559",null,null,null,"1679","1447",null,null,null,"2688",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R57", cells:["O358","O566",null,null,null,"1689","1448",null,null,null,"2699",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R58", cells:["O359","O577",null,null,null,"1789","1449",null,null,null,"2778",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R59", cells:["O367","O588",null,null,null,null,"1455",null,null,null,"2779",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R60", cells:["O368","O599",null,null,null,null,"1466",null,null,null,"2788",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R61", cells:["O369","O667",null,null,null,null,"1477",null,null,null,"2799",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R62", cells:["O378","O668",null,null,null,null,"1488",null,null,null,"2889",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R63", cells:["O379","O669",null,null,null,null,"1499",null,null,null,"2899",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R64", cells:["O389","O677",null,null,null,null,"1556",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R65", cells:["O456","O688",null,null,null,null,"1557",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R66", cells:["O457","O699",null,null,null,null,"1558",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R67", cells:["O458","O778",null,null,null,null,"1559",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R68", cells:["2459","2779",null,null,null,null,"1566",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R69", cells:["2467","2788",null,null,null,null,"1588",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R70", cells:["2468","2799",null,null,null,null,"1599",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R71", cells:["2469","2889",null,null,null,null,"1667",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R72", cells:["2478","2899",null,null,null,null,"1668",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R73", cells:["2479","2212",null,null,null,null,"1669",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R74", cells:["2489","2213",null,null,null,null,"1677",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R75", cells:["2567","2214",null,null,null,null,"1688",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R76", cells:["2568","2215",null,null,null,null,"1699",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R77", cells:["2569","2216",null,null,null,null,"1778",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R78", cells:["2578","2217",null,null,null,null,"1779",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R79", cells:["2579","2218",null,null,null,null,"1788",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R80", cells:["2589","2219",null,null,null,null,"1799",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R81", cells:["2678","2223",null,null,null,null,"1889",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R82", cells:["2679","2224",null,null,null,null,"1899",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R83", cells:["2689","2225",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R84", cells:["2789","2226",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R85", cells:[null,"2227",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R86", cells:[null,"2228",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R87", cells:[null,"2229",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R88", cells:[null,"2234",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R89", cells:[null,"2235",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R90", cells:[null,"2236",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R91", cells:[null,"2237",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R92", cells:[null,"2238",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R93", cells:[null,"2239",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R94", cells:[null,"2245",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R95", cells:[null,"2246",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R96", cells:[null,"2247",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R97", cells:[null,"2248",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R98", cells:[null,"2249",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R99", cells:[null,"2256",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R100",cells:[null,"2257",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R101",cells:[null,"2258",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R102",cells:[null,"2259",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R103",cells:[null,"2267",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R104",cells:[null,"2268",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R105",cells:[null,"2269",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R106",cells:[null,"2278",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R107",cells:[null,"2279",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]},
  {label:"R108",cells:[null,"2289",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]}
];

/**
 * TIER_DATA – fixed rows grouped into tiers.
 * Each row: array of values per day column (Day-1, Day-2, Day-3, …).
 * null = originally blank cell.
 * ↓↓↓ Replace tier row values here when needed. ↓↓↓
 */
const TIER_DATA = {
  tier1: [
    ["OO11","3345","O226"],
    ["OO22","3346","O227"],
    ["OO33","3347","O228"]
  ],
  tier2: [
    ["OO44","3348","O229"],
    ["OO55","3349","O233"],
    ["OO66","3356","O244"],
    ["OO77","3357","O255"],
    ["OO88","3358","O266"],
    ["OO99","3359","O277"],
    ["7788","3367","O288"],
    ["8899","3368","O299"],
    ["2223","3369","O334"],
    ["2224","3378","O335"]
  ],
  tier3: [
    ["2225","3379","O336"],
    ["2226","5556","O337"],
    ["2227","5557","O338"],
    ["2228","5558","O339"],
    ["2229","5559","O344"],
    ["3359","OO88","3346"],
    ["3367","OO99","3347"],
    ["3368","7788","3348"],
    ["3369","8899","3349"],
    ["3378","2223","3356"]
  ]
};

/* =====================================================================
   2. NORMALIZATION
   ===================================================================== */

/**
 * Normalize a raw code string:
 * - Trim whitespace.
 * - Convert ALL consecutive leading uppercase or lowercase "O" characters to "0".
 *   This handles cases like "OO11" → "0011" and "OOOO" → "0000" where Excel
 *   replaced multiple leading zeros with O's.
 *   "O" characters elsewhere in the string are left untouched.
 * - Return null for empty/falsy input.
 */
function normalizeCode(raw) {
  if (!raw && raw !== 0) return null;
  let s = String(raw).trim();
  if (!s) return null;
  // Replace every leading O (upper or lower) with '0'
  s = s.replace(/^[Oo]+/, match => '0'.repeat(match.length));
  return s;
}

/**
 * Validate that a code is exactly four characters of digits (after normalization).
 * Returns true if valid.
 */
function isValidCode(code) {
  if (!code) return false;
  return /^\d{4}$/.test(code);
}

/**
 * Prime Code (box) of a 4-digit code: its digits sorted ascending.
 * Every permutation of a number shares one Prime Code, so the 10,000
 * possible 4D numbers collapse into 715 boxes – the codes the matrix holds.
 *   getPrimeCode('3142') -> '1234'
 *   getPrimeCode('4321') -> '1234'
 *   getPrimeCode('1123') -> '1123'
 * Returns null for anything that isn't exactly four digits.
 */
function getPrimeCode(code) {
  if (!isValidCode(code)) return null;
  return code.split('').sort().join('');
}

/* =====================================================================
   3. STATE
   ===================================================================== */

/**
 * state.selectedCells – Set of strings "tierName-rowIdx-dayIdx"
 *   identifying which Tier/Day cells are currently selected.
 * state.dayCount – current number of day columns (starts at 3).
 * state.dayLabels – ordered day column labels.
 * state.tierDayData – live working copy of TIER_DATA (mutable on edits/addDay).
 * state.editMode – whether the tier/day table is in edit mode.
 */
const state = {
  selectedCells: new Set(),
  dayCount: 3,
  dayLabels: ['Day-1', 'Day-2', 'Day-3'],
  dayDates: [null, null, null],   // ISO date strings per column, null = not set
  editMode: false,
  searchQuery: '',
  // Deep clone so original DATA is not mutated
  tierDayData: {
    tier1: TIER_DATA.tier1.map(r => [...r]),
    tier2: TIER_DATA.tier2.map(r => [...r]),
    tier3: TIER_DATA.tier3.map(r => [...r])
  }
};

/**
 * NORM_MATRIX – the normalised matrix (array of arrays of strings|null).
 * MATRIX_BOX_INDEX – Prime Code -> every matrix position whose cell has
 * that Prime Code, so a lookup is one Map read instead of a 108 x 29 scan.
 * Both are rebuilt by rebuildNormMatrix() whenever a workbook is uploaded.
 */
let NORM_MATRIX = [];
let MATRIX_BOX_INDEX = new Map();

/**
 * PRIME_ROWS – null in the default state, meaning "derive the Prime Code
 * table from MATRIX_ROWS via PRIME_COLS" (the original behaviour). After a
 * successful upload that finds its own Prime Code block, this becomes an
 * independent array – { label, cells } per row, parallel to MATRIX_ROWS but
 * not a slice of it – because the uploaded sheet's Prime Code columns are
 * their own source of truth, not guaranteed to be a subset of the main
 * matrix. PRIME_COL_INDICES are the logical column positions (0-based,
 * into COL_HEADERS) those values correspond to, used to keep heat-map and
 * search matching the main matrix at the right (row, col) positions.
 */
let PRIME_ROWS = null;
let PRIME_COL_INDICES = PRIME_COLS;

/** Recompute NORM_MATRIX and MATRIX_BOX_INDEX from MATRIX_ROWS. */
function rebuildNormMatrix() {
  NORM_MATRIX = MATRIX_ROWS.map(row => row.cells.map(c => normalizeCode(c)));
  MATRIX_BOX_INDEX = new Map();
  NORM_MATRIX.forEach((row, ri) => {
    row.forEach((val, ci) => {
      const box = getPrimeCode(val);
      if (!box) return;
      if (!MATRIX_BOX_INDEX.has(box)) MATRIX_BOX_INDEX.set(box, []);
      MATRIX_BOX_INDEX.get(box).push({ row: ri, col: ci });
    });
  });
}
rebuildNormMatrix();

/* =====================================================================
   4. RENDERING
   ===================================================================== */

/** Build and mount the combined Tier/Day + Pattern Summary table into #selection-table-container. */
function renderSelectionTable() {
  const container = document.getElementById('selection-table-container');
  const table = document.createElement('table');
  table.id = 'selection-table';

  // colgroup ensures pixel-identical column widths across tier rows and pattern rows
  const colgroup = document.createElement('colgroup');
  // first col = row-label col
  colgroup.appendChild(document.createElement('col'));
  state.dayLabels.forEach(() => colgroup.appendChild(document.createElement('col')));
  table.appendChild(colgroup);

  // ── Header row ──────────────────────────────────────────────────────────
  const thead = table.createTHead();
  const hRow = thead.insertRow();
  const thTier = document.createElement('th');
  thTier.textContent = 'Tier';
  hRow.appendChild(thTier);

  state.dayLabels.forEach((label, dayIdx) => {
    const th = document.createElement('th');
    th.className = 'day-header-th';

    // Day label (e.g. "Day-1") shown above the date input
    const daySpan = document.createElement('div');
    daySpan.className = 'day-label';
    daySpan.textContent = label;

    // Date input – opens native calendar picker on click, also manually editable
    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.className = 'day-date-input';
    dateInput.value = state.dayDates[dayIdx] || '';
    dateInput.title = 'Click to pick a date, or type manually';

    dateInput.addEventListener('change', () => {
      state.dayDates[dayIdx] = dateInput.value || null;
      renderPrimeCodeTable(); // its day columns show these dates
    });
    // Allow manual keyboard input (browser handles validation)
    dateInput.addEventListener('blur', () => {
      state.dayDates[dayIdx] = dateInput.value || null;
    });

    th.appendChild(daySpan);
    th.appendChild(dateInput);
    hRow.appendChild(th);
  });

  const tbody = table.createTBody();

  // ── Tier sections ────────────────────────────────────────────────────────
  function renderTierSection(tierName, rows, label) {
    const headerRow = tbody.insertRow();
    const tierCell = headerRow.insertCell();
    tierCell.colSpan = state.dayLabels.length + 1;
    tierCell.className = 'tier-header';
    tierCell.textContent = label;
    // Clicking the header selects every number in this tier (all days);
    // clicking again clears them. Keyboard: Enter / Space.
    tierCell.dataset.tierHeader = tierName;
    tierCell.tabIndex = 0;
    tierCell.setAttribute('role', 'button');
    tierCell.title = `Click to select all ${label} numbers (click again to clear)`;
    tierCell.addEventListener('click', () => toggleTierSelection(tierName));
    tierCell.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleTierSelection(tierName);
      }
    });

    rows.forEach((rowData, rowIdx) => {
      const tr = tbody.insertRow();
      const labelCell = tr.insertCell();
      labelCell.textContent = `${rowIdx + 1}`;
      labelCell.style.color = '#78909c';
      labelCell.style.fontSize = '.75rem';
      labelCell.style.padding = '4px 6px';

      state.dayLabels.forEach((_, dayIdx) => {
        const td = tr.insertCell();
        const rawVal = rowData[dayIdx] || null;
        const norm = normalizeCode(rawVal);
        td.textContent = norm || '';
        td.dataset.tier = tierName;
        td.dataset.row = rowIdx;
        td.dataset.day = dayIdx;

        makeCellEditable(td);
        setTdEditable(td, state.editMode);

        if (norm && !isValidCode(norm)) {
          td.classList.add('invalid');
          td.title = 'Invalid code (must be 4 digits)';
        }
      });
    });
  }

  renderTierSection('tier1', state.tierDayData.tier1, 'Tier 1');
  renderTierSection('tier2', state.tierDayData.tier2, 'Tier 2');
  renderTierSection('tier3', state.tierDayData.tier3, 'Tier 3');

  // ── Pattern probability rows (appended to same tbody / table) ────────────
  appendPatternRows(tbody);

  container.innerHTML = '';
  container.appendChild(table);

  attachDragSelection();
  if (state.searchQuery) handleSearch(state.searchQuery);
}

/** Build and mount the main matrix table into #matrix-wrapper. */
function renderMatrixTable() {
  const wrapper = document.getElementById('matrix-wrapper');
  const table = document.createElement('table');
  table.id = 'matrix-table';

  // Column headers
  const thead = table.createTHead();
  const colRow = thead.insertRow();
  const cornerTh = document.createElement('th');
  cornerTh.textContent = '';
  colRow.appendChild(cornerTh);
  COL_HEADERS.forEach(h => {
    const th = document.createElement('th');
    th.textContent = h;
    colRow.appendChild(th);
  });

  // Pattern type sub-header
  const patRow = thead.insertRow();
  patRow.className = 'pattern-row';
  const patCorner = document.createElement('th');
  patCorner.textContent = '';
  patRow.appendChild(patCorner);
  PATTERN_TYPES.forEach(p => {
    const th = document.createElement('th');
    th.textContent = p;
    patRow.appendChild(th);
  });

  // Data rows
  const tbody = table.createTBody();
  MATRIX_ROWS.forEach((rowDef, rowIdx) => {
    const tr = tbody.insertRow();
    // Row label cell
    const labelTd = tr.insertCell();
    labelTd.textContent = rowDef.label || '';

    // Data cells
    rowDef.cells.forEach((rawVal, colIdx) => {
      const td = tr.insertCell();
      const norm = NORM_MATRIX[rowIdx][colIdx];
      if (norm) {
        td.textContent = norm;
      } else {
        td.classList.add('empty');
      }
      td.dataset.row = rowIdx;
      td.dataset.col = colIdx;
    });
  });

  wrapper.innerHTML = '';
  wrapper.appendChild(table);
}

/**
 * Index the Tier/Day numbers by Prime Code, overall and per day column.
 * Permutation-aware, like the heat map: '7379' and '9377' both count
 * towards the '3779' Prime Code.
 *   total – Map(primeCode -> count across every day)
 *   byDay – one Map per day column: primeCode -> [{ tier, row, value }]
 * This is the live equivalent of the spreadsheet's per-day COUNTIF columns
 * against past draws (Prediction_Analysis.xlsx, "R" columns) – it
 * re-evaluates against whatever is in the Tier/Day table right now, so it
 * stays correct as days are fetched, added or edited.
 * One pass over the table, built once per Prime Code render.
 */
function buildAppearanceIndexes() {
  const total = new Map();
  const byDay = state.dayLabels.map(() => new Map());
  ['tier1', 'tier2', 'tier3'].forEach(tier => {
    state.tierDayData[tier].forEach((row, rowIdx) => {
      row.forEach((raw, dayIdx) => {
        const value = normalizeCode(raw);
        const box = getPrimeCode(value);
        if (!box || !byDay[dayIdx]) return;
        total.set(box, (total.get(box) || 0) + 1);
        const dayMap = byDay[dayIdx];
        if (!dayMap.has(box)) dayMap.set(box, []);
        dayMap.get(box).push({ tier, row: rowIdx, value });
      });
    });
  });
  return { total, byDay };
}

/** "2026-09-12" -> "12/09" for the compact day headers. */
function shortDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}` : '';
}

/**
 * Day-column indices ordered oldest -> newest by date, for the Prime Code
 * table's day columns. Sorted by date rather than simply reversed, so the
 * order stays right after Add Day or a date edit. Days without a date go to
 * the right (newest end) - a freshly added day is normally the next draw.
 * Ties and undated days keep their Tier/Day order.
 */
function chronologicalDayOrder() {
  return state.dayLabels.map((_, i) => i).sort((a, b) => {
    const da = state.dayDates[a], db = state.dayDates[b];
    if (da && db && da !== db) return da < db ? -1 : 1; // ISO dates sort as text
    if (da && !db) return -1;
    if (!da && db) return 1;
    return a - b;
  });
}

/**
 * Build and mount the Prime Code reference table into #primecode-wrapper.
 *
 * Two data sources, chosen automatically:
 *  - PRIME_ROWS === null (default, nothing uploaded yet): derive it from
 *    MATRIX_ROWS via the fixed PRIME_COLS subset, exactly as before.
 *  - PRIME_ROWS is an array (a workbook was uploaded and had its own Prime
 *    Code block): use that data directly, independent of MATRIX_ROWS.
 * Either way, PRIME_COL_INDICES gives the logical column position (into
 * COL_HEADERS) each rendered column corresponds to, so cells carry the same
 * data-row/data-col indices the main matrix uses and the shared heat-map /
 * search logic highlights both tables from one pass.
 * Appearance columns (the spreadsheet's "R" / "R/SUM" columns, live):
 *  - one column per Tier/Day day column (same DrawID labels, ordered oldest
 *    -> newest by date via chronologicalDayOrder()), with
 *    how many of that day's numbers are permutations of this row's codes
 *    (hover for which numbers, and which tier they came from);
 *  - a Total column; and a small badge on each code with its overall count.
 */
function renderPrimeCodeTable() {
  const wrapper = document.getElementById('primecode-wrapper');
  if (!wrapper) return;

  const usingUpload = Array.isArray(PRIME_ROWS);
  const colIndices  = PRIME_COL_INDICES;
  const rowCount    = usingUpload ? PRIME_ROWS.length : MATRIX_ROWS.length;
  const { total: appearances, byDay } = buildAppearanceIndexes();
  const dayOrder = chronologicalDayOrder(); // day columns run oldest -> newest

  const table = document.createElement('table');
  table.id = 'primecode-table';

  const thead = table.createTHead();
  const colRow = thead.insertRow();
  colRow.appendChild(document.createElement('th'));
  colIndices.forEach(colIdx => {
    const th = document.createElement('th');
    th.textContent = COL_HEADERS[colIdx] || `col${colIdx + 1}`;
    colRow.appendChild(th);
  });
  dayOrder.forEach((dayIdx, pos) => {
    const label = state.dayLabels[dayIdx];
    const th = document.createElement('th');
    th.className = 'appear-day-th' + (pos === 0 ? ' appear-first' : '');
    th.textContent = label;
    th.title = `${label}${state.dayDates[dayIdx] ? ' · ' + state.dayDates[dayIdx] : ''}`;
    colRow.appendChild(th);
  });
  const totalTh = document.createElement('th');
  totalTh.className = 'appear-total-th';
  totalTh.textContent = 'Total';
  totalTh.title = 'Tier/Day numbers matching this row, across all days';
  colRow.appendChild(totalTh);

  const patRow = thead.insertRow();
  patRow.className = 'pattern-row';
  patRow.appendChild(document.createElement('th'));
  colIndices.forEach(colIdx => {
    const th = document.createElement('th');
    th.textContent = PATTERN_TYPES[colIdx] || '';
    patRow.appendChild(th);
  });
  dayOrder.forEach((dayIdx, pos) => {
    const th = document.createElement('th');
    th.className = 'appear-day-th' + (pos === 0 ? ' appear-first' : '');
    th.textContent = shortDate(state.dayDates[dayIdx]);
    patRow.appendChild(th);
  });
  patRow.appendChild(document.createElement('th'));

  const tbody = table.createTBody();
  for (let rowIdx = 0; rowIdx < rowCount; rowIdx++) {
    const tr = tbody.insertRow();
    const labelTd = tr.insertCell();
    labelTd.textContent = (usingUpload ? PRIME_ROWS[rowIdx].label : MATRIX_ROWS[rowIdx].label) || '';

    const rowBoxes = new Set(); // distinct Prime Codes in this row, for the day columns
    colIndices.forEach((colIdx, k) => {
      const td = tr.insertCell();
      // Uploaded Prime Code cells are raw and need normalising, same as
      // MATRIX_ROWS; the derived (default) path already reads NORM_MATRIX.
      const norm = usingUpload
        ? normalizeCode(PRIME_ROWS[rowIdx].cells[k])
        : NORM_MATRIX[rowIdx][colIdx];
      td.dataset.row = rowIdx;
      td.dataset.col = colIdx;
      if (norm) {
        const box = getPrimeCode(norm);
        if (box) {
          rowBoxes.add(box);
          td.dataset.box = box; // lets a clicked count find the codes it matched
        }
        const n = appearances.get(box) || 0;
        td.textContent = norm;
        if (n > 0) {
          const badge = document.createElement('sup');
          badge.className = 'appear-badge';
          badge.textContent = n;
          td.appendChild(badge);
          td.title = `${n} Tier/Day number(s) are permutations of ${norm}`;
        }
      } else {
        td.classList.add('empty');
      }
    });

    // One cell per day: how many of that day's numbers are permutations of
    // any code in this row. A code repeated within the row (e.g. 1123 in both
    // C1 and C7) is counted once, so each drawn number counts once per row.
    // data-boxes on each count = the Prime Codes it matched, used by a click to
    // highlight those codes' boxes in this row (see focusAppearance()).
    let rowTotal = 0;
    const rowHitBoxes = new Set();
    dayOrder.forEach((dayIdx, pos) => {
      const dayMap = byDay[dayIdx];
      const hits = [];
      const hitBoxes = [];
      rowBoxes.forEach(box => {
        if (dayMap.has(box)) { hits.push(...dayMap.get(box)); hitBoxes.push(box); rowHitBoxes.add(box); }
      });
      const td = tr.insertCell();
      td.className = 'appear-day' + (pos === 0 ? ' appear-first' : '');
      if (hits.length) {
        rowTotal += hits.length;
        td.textContent = hits.length;
        td.classList.add(hits.length > 1 ? 'appear-day-2' : 'appear-day-1');
        td.dataset.boxes = hitBoxes.join(',');
        td.title = `${state.dayLabels[dayIdx]}${state.dayDates[dayIdx] ? ' (' + state.dayDates[dayIdx] + ')' : ''}: ` +
          hits.map(h => `${h.value} – ${TIER_COLORS[h.tier].label} row ${h.row + 1} → ${getPrimeCode(h.value)}`).join('; ') +
          ' (click to highlight the code)';
      }
    });

    const appearTd = tr.insertCell();
    appearTd.className = 'appear-cell';
    appearTd.textContent = rowTotal > 0 ? rowTotal : '–';
    if (rowTotal > 0) {
      appearTd.classList.add('appear-hit');
      appearTd.dataset.boxes = [...rowHitBoxes].join(',');
      appearTd.title = 'Click to highlight every code in this row that appeared';
    }
  }

  // Click a count -> highlight the matching code boxes in its row.
  table.addEventListener('click', e => {
    const td = e.target.closest('td.appear-day, td.appear-cell');
    if (td) focusAppearance(td);
  });

  wrapper.innerHTML = '';
  wrapper.appendChild(table);
}

/**
 * Highlight which Prime Code boxes a clicked count refers to: every code cell
 * in the same row whose Prime Code is in the count's data-boxes (a code listed
 * twice in the row lights up in both places). Clicking the same count again
 * clears it; clicking another count moves the highlight. Counts with no hits
 * do nothing. Uses its own classes, so heat-map colours stay visible.
 */
function focusAppearance(td) {
  const table = document.getElementById('primecode-table');
  if (!table || !td.dataset.boxes) return;
  const wasFocused = td.classList.contains('appear-focus');
  table.querySelectorAll('.appear-focus, .appear-source').forEach(el => {
    el.classList.remove('appear-focus', 'appear-source');
  });
  if (wasFocused) return;

  const boxes = new Set(td.dataset.boxes.split(','));
  td.classList.add('appear-focus');
  td.parentElement.querySelectorAll('td[data-box]').forEach(cell => {
    if (boxes.has(cell.dataset.box)) cell.classList.add('appear-source');
  });
}

/* =====================================================================
   5. DRAG SELECTION
   ===================================================================== */

let isDragging = false;
let dragMode = null; // 'select' | 'deselect'

/** Attach mousedown/mouseover/mouseup listeners to tier/day table cells. */
function attachDragSelection() {
  const table = document.getElementById('selection-table');
  if (!table) return;

  // Use event delegation on the table body
  table.addEventListener('mousedown', onDragStart);
  table.addEventListener('mouseover', onDragMove);
  document.addEventListener('mouseup', onDragEnd, { once: false });
}

function onDragStart(e) {
  const td = e.target.closest('td[data-tier]');
  if (!td) return;
  // In edit mode let the browser handle focus/click for typing; skip drag logic
  if (state.editMode) return;
  e.preventDefault();
  isDragging = true;
  const key = cellKey(td);
  // Toggle: if already selected start in deselect mode
  dragMode = state.selectedCells.has(key) ? 'deselect' : 'select';
  applyDragToCell(td);
}

function onDragMove(e) {
  if (!isDragging || state.editMode) return;
  const td = e.target.closest('td[data-tier]');
  if (!td) return;
  applyDragToCell(td);
}

function onDragEnd() {
  isDragging = false;
  dragMode = null;
  recalculateHeatMap();
}

function applyDragToCell(td) {
  const key = cellKey(td);
  if (dragMode === 'select') {
    state.selectedCells.add(key);
    td.classList.add('selected');
  } else {
    state.selectedCells.delete(key);
    td.classList.remove('selected');
  }
}

function cellKey(td) {
  return `${td.dataset.tier}-${td.dataset.row}-${td.dataset.day}`;
}

/** Restore visual selected state on all cells (used after re-render). */
function restoreSelectionVisuals() {
  const table = document.getElementById('selection-table');
  if (!table) return;
  table.querySelectorAll('td[data-tier]').forEach(td => {
    if (state.selectedCells.has(cellKey(td))) {
      td.classList.add('selected');
    } else {
      td.classList.remove('selected');
    }
  });
  updateTierHeaderStates();
}

/** Selection keys for every cell in a tier that holds a valid 4-digit code
 *  (blank / invalid cells are skipped – selecting them would do nothing). */
function tierCellKeys(tier) {
  const keys = [];
  state.tierDayData[tier].forEach((row, rowIdx) => {
    row.forEach((raw, dayIdx) => {
      if (isValidCode(normalizeCode(raw))) keys.push(`${tier}-${rowIdx}-${dayIdx}`);
    });
  });
  return keys;
}

/**
 * Tier header click: select every number in the tier across all days.
 * If the whole tier is already selected, clear it instead; if only part of
 * it is selected, the first click completes the selection.
 * Ignored in edit mode, where clicks are for typing (as with drag-select).
 */
function toggleTierSelection(tier) {
  if (state.editMode) return;
  const keys = tierCellKeys(tier);
  if (!keys.length) return;
  const allSelected = keys.every(k => state.selectedCells.has(k));
  keys.forEach(k => (allSelected ? state.selectedCells.delete(k) : state.selectedCells.add(k)));
  restoreSelectionVisuals();
  recalculateHeatMap();
}

/** Mark a tier header as active when every number in that tier is selected. */
function updateTierHeaderStates() {
  document.querySelectorAll('#selection-table td[data-tier-header]').forEach(th => {
    const keys = tierCellKeys(th.dataset.tierHeader);
    const active = keys.length > 0 && keys.every(k => state.selectedCells.has(k));
    th.classList.toggle('tier-header-active', active);
    th.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

/* =====================================================================
   6. VALIDATION & EDITING
   ===================================================================== */

/** Make a tier/day td contenteditable and wire up live validation + heat-map recalc.
 *  The cell starts read-only; call setTdEditable(td, true) to enable editing. */
function makeCellEditable(td) {
  // Store handlers so we can attach once; editability is toggled via setTdEditable()
  td.setAttribute('spellcheck', 'false');
  td.dataset.editable = 'wired'; // mark as wired

  // When clicked in edit mode, select all existing text so user can overtype immediately
  td.addEventListener('focus', () => {
    if (td.contentEditable !== 'true') return;
    const range = document.createRange();
    range.selectNodeContents(td);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  });

  td.addEventListener('keydown', e => {
    if (td.contentEditable !== 'true') return;
    if (e.key === 'Enter') { e.preventDefault(); td.blur(); }
    // Tab to next cell
    if (e.key === 'Tab') {
      e.preventDefault();
      const cells = [...document.querySelectorAll('#selection-table td[data-tier]')];
      const idx = cells.indexOf(td);
      const next = cells[e.shiftKey ? idx - 1 : idx + 1];
      if (next) next.focus();
    }
  });

  td.addEventListener('input', () => {
    if (td.contentEditable !== 'true') return;
    validateAndUpdateCell(td);
    recalculateHeatMap();
    updateStats();
  });

  td.addEventListener('blur', () => {
    if (td.contentEditable !== 'true') return;
    // Commit value to state
    const tier = td.dataset.tier;
    const rowIdx = parseInt(td.dataset.row, 10);
    const dayIdx = parseInt(td.dataset.day, 10);
    const norm = normalizeCode(td.textContent);
    state.tierDayData[tier][rowIdx][dayIdx] = norm;
    // Update displayed text to normalised form
    td.textContent = norm || '';
    validateAndUpdateCell(td);
    recalculateHeatMap();
    updateStats();
    renderPatternSummary();
    renderPrimeCodeTable();   // day/appearance columns depend on tierDayData, refresh
  });
}

/**
 * Enable or disable editing on a single tier/day cell.
 * When disabled the cell is not focusable and shows no edit cursor.
 */
function setTdEditable(td, editable) {
  td.contentEditable = editable ? 'true' : 'false';
  td.tabIndex = editable ? 0 : -1;
  td.classList.toggle('cell-editable', editable);
}

/**
 * Toggle edit mode for the entire tier/day table.
 * Updates the button label and applies/removes editability on all data cells.
 */
function toggleEditMode() {
  state.editMode = !state.editMode;
  const btn = document.getElementById('btn-edit-table');
  if (state.editMode) {
    btn.textContent = '💾 Done Editing';
    btn.classList.replace('btn-secondary', 'btn-primary');
  } else {
    btn.textContent = '✏️ Edit Table';
    btn.classList.replace('btn-primary', 'btn-secondary');
  }
  // Apply to every data cell
  const table = document.getElementById('selection-table');
  if (!table) return;
  table.querySelectorAll('td[data-tier]').forEach(td => {
    setTdEditable(td, state.editMode);
  });
}

function validateAndUpdateCell(td) {
  const norm = normalizeCode(td.textContent);
  if (norm && !isValidCode(norm)) {
    td.classList.add('invalid');
    td.title = 'Invalid code (must be 4 digits)';
  } else {
    td.classList.remove('invalid');
    td.title = '';
  }
}

/* =====================================================================
   7. ADDING DAYS
   ===================================================================== */

/** Append a new day column (Day-4, Day-5 …) to the selection table. */
function addDay() {
  state.dayCount += 1;
  const label = `Day-${state.dayCount}`;
  state.dayLabels.push(label);
  state.dayDates.push(null);   // new column starts with no date

  // Extend each tier row's data array with a null slot
  ['tier1', 'tier2', 'tier3'].forEach(t => {
    state.tierDayData[t].forEach(row => row.push(null));
  });

  // Re-render the selection table (preserves existing selections by key)
  renderSelectionTable();
  restoreSelectionVisuals();
  renderPatternSummary();
  renderPrimeCodeTable();   // new day = new codes to count against "Appear"
  recalculateHeatMap();
}

/* =====================================================================
   8. HEAT MAP
   ===================================================================== */

/** Tier colour definitions – used for CSS classes and the legend. */
const TIER_COLORS = {
  tier1: { exact: 'exact-tier1', surround: 'surround-tier1', label: 'Tier 1', exactHex: '#e53935', surroundHex: '#ffcdd2' },
  tier2: { exact: 'exact-tier2', surround: 'surround-tier2', label: 'Tier 2', exactHex: '#1565c0', surroundHex: '#bbdefb' },
  tier3: { exact: 'exact-tier3', surround: 'surround-tier3', label: 'Tier 3', exactHex: '#2e7d32', surroundHex: '#c8e6c9' },
};

/**
 * Collect selected codes grouped by tier.
 * Returns Map<tierName, Set<code>>.
 */
function getSelectedCodesByTier() {
  const byTier = new Map([['tier1', new Set()], ['tier2', new Set()], ['tier3', new Set()]]);
  state.selectedCells.forEach(key => {
    // key format: "tier1-0-2"
    const match = key.match(/^(tier\d+)-(\d+)-(\d+)$/);
    if (!match) return;
    const [, tier, rowStr, dayStr] = match;
    const tierRows = state.tierDayData[tier];
    if (!tierRows) return;
    const rowIdx = parseInt(rowStr, 10);
    const dayIdx = parseInt(dayStr, 10);
    const raw = (tierRows[rowIdx] || [])[dayIdx];
    const norm = normalizeCode(raw);
    if (norm && isValidCode(norm)) byTier.get(tier).add(norm);
  });
  return byTier;
}

/**
 * Flat Set of all selected codes (for stats / search compatibility).
 */
function getSelectedCodes() {
  const codes = new Set();
  getSelectedCodesByTier().forEach(set => set.forEach(c => codes.add(c)));
  return codes;
}

/**
 * Find every matrix position holding `code`'s Prime Code (box).
 * Permutation-aware: '4321', '3142' and '1234' all return the positions of
 * the '1234' cells, because the matrix is laid out by Prime Code, not by the
 * individual numbers drawn. Returns Array<{row, col}> (empty for invalid codes).
 */
function findExactMatches(code) {
  const box = getPrimeCode(code);
  return box ? (MATRIX_BOX_INDEX.get(box) || []) : [];
}

/**
 * Return the eight surrounding (row,col) positions of a cell, clamped to matrix bounds.
 */
function getSurroundingCells(row, col) {
  const results = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const r = row + dr, c = col + dc;
      if (r >= 0 && r < NORM_MATRIX.length && c >= 0 && c < COL_HEADERS.length)
        results.push({ row: r, col: c });
    }
  }
  return results;
}

/**
 * Full heat-map recalculation with per-tier colouring.
 * Permutation-aware: a selected Tier/Day number (e.g. '4321') lights up its
 * Prime Code cell in the matrix ('1234'), via findExactMatches(). The
 * Tier/Day table itself keeps showing the number exactly as entered.
 * Priority: exact-match always beats surrounding; higher tier number beats lower
 * only for surrounding (exact match of any tier beats surrounding of any tier).
 * When two tiers share an exact match on the same cell, the first tier processed wins.
 */
function recalculateHeatMap() {
  const table = document.getElementById('matrix-table');
  if (!table) return;

  // Apply to both the full matrix and the Prime Code table – the latter
  // shares the same data-row/data-col indexing (a column subset), so the
  // same exact/surround maps light up matching cells in each.
  const heatCells = () => document.querySelectorAll(
    '#matrix-table tbody td[data-row], #primecode-table tbody td[data-row]'
  );

  // Clear ALL previous tier highlight classes
  const allExact    = Object.values(TIER_COLORS).map(t => t.exact);
  const allSurround = Object.values(TIER_COLORS).map(t => t.surround);
  heatCells().forEach(td => {
    td.classList.remove(...allExact, ...allSurround);
  });

  const byTier = getSelectedCodesByTier();

  // Maps: "row-col" → tierName (first exact match tier wins)
  const exactMap    = new Map();   // key → tierName
  const surroundMap = new Map();   // key → tierName

  ['tier1', 'tier2', 'tier3'].forEach(tier => {
    byTier.get(tier).forEach(code => {
      findExactMatches(code).forEach(({ row, col }) => {
        const key = `${row}-${col}`;
        if (!exactMap.has(key)) exactMap.set(key, tier);   // first tier wins exact
        getSurroundingCells(row, col).forEach(({ row: sr, col: sc }) => {
          const sk = `${sr}-${sc}`;
          if (!surroundMap.has(sk)) surroundMap.set(sk, tier);
        });
      });
    });
  });

  // Apply classes — exact always overrides surround
  heatCells().forEach(td => {
    const key = `${td.dataset.row}-${td.dataset.col}`;
    if (exactMap.has(key)) {
      td.classList.add(TIER_COLORS[exactMap.get(key)].exact);
    } else if (surroundMap.has(key)) {
      td.classList.add(TIER_COLORS[surroundMap.get(key)].surround);
    }
  });

  updateStats(byTier, exactMap, surroundMap);
  renderLegend();
  updateTierHeaderStates(); // keeps headers right after drag-select / Clear
}

/* =====================================================================
   9. STATISTICS & LEGEND
   ===================================================================== */

/** Update the stat counters and per-tier breakdown. */
function updateStats(byTier, exactMap, surroundMap) {
  // Allow calling without args
  if (!byTier) {
    byTier    = getSelectedCodesByTier();
    exactMap  = new Map();
    surroundMap = new Map();
    ['tier1','tier2','tier3'].forEach(tier => {
      byTier.get(tier).forEach(code => {
        findExactMatches(code).forEach(({ row, col }) => {
          const key = `${row}-${col}`;
          if (!exactMap.has(key)) exactMap.set(key, tier);
          getSurroundingCells(row, col).forEach(({ row: sr, col: sc }) => {
            const sk = `${sr}-${sc}`;
            if (!surroundMap.has(sk)) surroundMap.set(sk, tier);
          });
        });
      });
    });
  }

  const totalCodes   = [...byTier.values()].reduce((s, v) => s + v.size, 0);
  const surroundOnly = [...surroundMap.keys()].filter(k => !exactMap.has(k)).length;

  document.getElementById('stat-selected').textContent = totalCodes;
  document.getElementById('stat-exact').textContent    = exactMap.size;
  document.getElementById('stat-surround').textContent = surroundOnly;

  // Per-tier breakdown
  ['tier1','tier2','tier3'].forEach(tier => {
    const el = document.getElementById(`stat-${tier}`);
    if (el) el.textContent = byTier.get(tier).size;
  });
}

/** Render / refresh the legend to reflect active tiers and their colours. */
function renderLegend() {
  const container = document.getElementById('legend-container');
  if (!container) return;

  const byTier = getSelectedCodesByTier();
  const activeTiers = ['tier1','tier2','tier3'].filter(t => byTier.get(t).size > 0);

  // If nothing selected, show generic legend
  if (activeTiers.length === 0) {
    container.innerHTML = `
      <div class="legend-item"><span class="legend-swatch" style="background:#e53935"></span> Prime Code match</div>
      <div class="legend-item"><span class="legend-swatch" style="background:#ffcdd2;border:1px solid #ef9a9a"></span> Adjacent cell</div>
      <div class="legend-item"><span class="legend-swatch none"></span> Unrelated</div>`;
    return;
  }

  let html = '';
  activeTiers.forEach(tier => {
    const c = TIER_COLORS[tier];
    html += `
      <div class="legend-group">
        <span class="legend-tier-label">${c.label}</span>
        <div class="legend-item"><span class="legend-swatch" style="background:${c.exactHex}"></span> Prime Code match</div>
        <div class="legend-item"><span class="legend-swatch" style="background:${c.surroundHex};border:1px solid ${c.exactHex}55"></span> Adjacent</div>
      </div>`;
  });
  html += `<div class="legend-item" style="margin-left:8px"><span class="legend-swatch none"></span> Unrelated</div>`;
  container.innerHTML = html;
}


/* =====================================================================
   10. SEARCH
   ===================================================================== */

/**
 * Search for a code and outline matches without altering the heat-map.
 * Permutation-aware: searching any arrangement (e.g. '2431') outlines
 *  - its Prime Code cell ('1234') in the matrix and Prime Code tables, and
 *  - every Tier/Day number that is a permutation of it ('1234', '4321', …).
 */
function handleSearch(query) {
  const matrixTable    = document.getElementById('matrix-table');
  const primeTable     = document.getElementById('primecode-table');
  const selectionTable = document.getElementById('selection-table');

  // Clear previous search highlights in all tables
  [matrixTable, primeTable, selectionTable].forEach(t => {
    if (t) t.querySelectorAll('td.search-highlight, th.search-highlight').forEach(el => {
      el.classList.remove('search-highlight');
    });
  });

  const norm = normalizeCode(query);
  state.searchQuery = norm || '';
  if (!norm) return;

  // ── Matrix table + Prime Code table ─────────────────────────────────────
  // Both share data-row/data-col indexing, so one match lookup covers both.
  findExactMatches(norm).forEach(({ row, col }) => {
    [matrixTable, primeTable].forEach(t => {
      if (!t) return;
      const td = t.querySelector(`tbody td[data-row="${row}"][data-col="${col}"]`);
      if (td) td.classList.add('search-highlight');
    });
  });

  // ── Tier/Day selection table: any permutation of the searched code ───────
  const box = getPrimeCode(norm);
  if (selectionTable && box) {
    selectionTable.querySelectorAll('td[data-tier]').forEach(td => {
      if (getPrimeCode(normalizeCode(td.textContent)) === box) {
        td.classList.add('search-highlight');
      }
    });
  }
}

/* =====================================================================
   11. PATTERN SUMMARY
   ===================================================================== */

/**
 * Classify a 4-digit normalised code into one of five pattern types:
 *   AAAA – all four digits the same            e.g. 1111
 *   AAAB – three same + one different          e.g. 1112
 *   AABB – two pairs                           e.g. 1122
 *   AABC – one pair + two different            e.g. 1123
 *   ABCD – all four digits different           e.g. 1234
 * Returns null for invalid codes.
 */
function classifyPattern(code) {
  if (!code || !/^\d{4}$/.test(code)) return null;
  const freq = {};
  for (const ch of code) freq[ch] = (freq[ch] || 0) + 1;
  const counts = Object.values(freq).sort((a, b) => b - a);
  const key = counts.join('');
  if (key === '4')    return 'AAAA';
  if (key === '31')   return 'AAAB';
  if (key === '22')   return 'AABB';
  if (key === '211')  return 'AABC';
  if (key === '1111') return 'ABCD';
  return null;
}

const PATTERN_ORDER = ['ABCD', 'AABC', 'AABB', 'AAAB', 'AAAA'];

/**
 * Compute per-day pattern counts from current state.
 * Returns array of { label, counts, total } aligned to state.dayLabels.
 */
function computeDaySummaries() {
  const allTierRows = [
    ...state.tierDayData.tier1,
    ...state.tierDayData.tier2,
    ...state.tierDayData.tier3
  ];
  return state.dayLabels.map((label, dayIdx) => {
    const counts = { ABCD: 0, AABC: 0, AABB: 0, AAAB: 0, AAAA: 0 };
    let total = 0;
    allTierRows.forEach(row => {
      const pat = classifyPattern(normalizeCode(row[dayIdx]));
      if (pat) { counts[pat]++; total++; }
    });
    return { label, counts, total };
  });
}

/**
 * Append pattern-probability rows directly into an existing <tbody>.
 * These rows share the same columns as the tier data rows, so they align perfectly.
 */
function appendPatternRows(tbody) {
  const daySummaries = computeDaySummaries();

  // ── Divider / section header ─────────────────────────────────────────────
  const divRow = tbody.insertRow();
  const divCell = divRow.insertCell();
  divCell.colSpan = state.dayLabels.length + 1;
  divCell.className = 'pattern-section-header';
  divCell.textContent = 'Pattern Probability';

  // ── One row per pattern ──────────────────────────────────────────────────
  PATTERN_ORDER.forEach(pat => {
    const tr = tbody.insertRow();
    tr.className = 'pattern-data-row';

    // Label cell — right-aligned % label + green badge
    const labelTd = tr.insertCell();
    labelTd.className = 'pattern-label';
    labelTd.innerHTML = `<span class="pattern-badge">${pat}</span>`;

    daySummaries.forEach(({ counts, total }) => {
      const td = tr.insertCell();
      td.className = 'pattern-pct';
      if (total > 0) {
        const pct = ((counts[pat] / total) * 100).toFixed(1);
        td.textContent = `${pct}%`;
        td.title = `${counts[pat]} of ${total} codes`;
        const intensity = counts[pat] / total;
        const lightness = Math.round(95 - intensity * 45);
        td.style.background = `hsl(123, 43%, ${lightness}%)`;
        td.style.color = lightness < 70 ? '#fff' : '#1b5e20';
        td.style.fontWeight = intensity > 0.3 ? '700' : '400';
      } else {
        td.textContent = '–';
        td.style.color = '#b0bec5';
      }
    });
  });

  // ── Total codes row ──────────────────────────────────────────────────────
  const totalRow = tbody.insertRow();
  totalRow.className = 'pattern-total-row';
  const totalLabel = totalRow.insertCell();
  totalLabel.className = 'pattern-label';
  totalLabel.innerHTML = '<span style="color:#546e7a;font-size:.8rem;font-weight:600;">Total</span>';
  daySummaries.forEach(({ total }) => {
    const td = totalRow.insertCell();
    td.textContent = total;
    td.className = 'pattern-total-cell';
  });
}

/**
 * Re-render is just re-building the whole selection table
 * (which now includes pattern rows at the bottom).
 */
function renderPatternSummary() {
  renderSelectionTable();
  restoreSelectionVisuals();
}

/* =====================================================================
   13. XLSX IMPORT  (Prediction_Analysis.xlsx → live matrix + prime code)
   ===================================================================== */

/**
 * Read a cell's displayed value as a plain string, matching the format
 * MATRIX_ROWS literals already use (numbers become their decimal string;
 * Excel already stores O-prefixed leading-zero codes as text, so those
 * come through unchanged).
 */
function cellToRawString(cell) {
  if (!cell || cell.v === undefined || cell.v === null || cell.v === '') return null;
  if (typeof cell.v === 'number') return String(Math.round(cell.v));
  const s = String(cell.v).trim();
  return s || null;
}

/**
 * Parse an uploaded workbook (SheetJS format) into matrix + Prime Code
 * data. Layout expected – matching Prediction_Analysis.xlsx's "Heat Map"
 * sheet (verified directly against that file, not assumed):
 *   - a header row (scanned for, not hardcoded to a row number) with "C1"
 *     in column B
 *   - column A = row label ("R1", "R2", …); columns B..AD = the 29 Number
 *     Pattern Matrix columns (C1..C29) – "column A until AD"
 *   - starting around column AF, a second run of "Cn"-labelled columns on
 *     the SAME header row = the Prime Code subset – "starts from AF
 *     onwards"; wherever it actually starts is discovered, not assumed,
 *     so a one-column drift in a future export doesn't break the import
 *   - a nearby "Rn" column on the data rows carries the Prime Code block's
 *     own row labels; falls back to the main row label if not found
 *   - data starts two rows below the header row (header, then a
 *     pattern-type row, then data – the same convention COL_HEADERS /
 *     PATTERN_TYPES already encode)
 * Throws a descriptive Error on anything that doesn't match; never
 * partially applies a bad parse.
 */
function parseWorkbook(wb) {
  const sheetName = wb.SheetNames.find(n => n.trim().toLowerCase() === 'heat map') || wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  if (!ws || !ws['!ref']) {
    throw new Error(`Sheet "${sheetName}" is empty or unreadable.`);
  }
  const range = XLSX.utils.decode_range(ws['!ref']);
  const cellStr = (r, c) => cellToRawString(ws[XLSX.utils.encode_cell({ r, c })]);

  // 1. Header row: first row (scanning the top 20) with "C1" in column B.
  let headerRow = -1;
  for (let r = range.s.r; r <= Math.min(range.s.r + 20, range.e.r); r++) {
    if ((cellStr(r, 1) || '').toUpperCase() === 'C1') { headerRow = r; break; }
  }
  if (headerRow === -1) {
    throw new Error(
      `Could not find "C1" in column B of sheet "${sheetName}". ` +
      `Expected the same layout as Prediction_Analysis.xlsx's "Heat Map" sheet.`
    );
  }

  // 2. Main matrix: fixed-width B..AD (29 columns) – verify, don't assume.
  const mainColStart = 1; // column B, 0-indexed
  const mainColCount = COL_HEADERS.length;
  for (let i = 0; i < mainColCount; i++) {
    const label = (cellStr(headerRow, mainColStart + i) || '').toUpperCase();
    if (label !== COL_HEADERS[i].toUpperCase()) {
      throw new Error(
        `Expected column ${XLSX.utils.encode_col(mainColStart + i)} on row ${headerRow + 1} ` +
        `to be "${COL_HEADERS[i]}", found "${label || '(blank)'}". This sheet's layout doesn't ` +
        `match what this tool expects.`
      );
    }
  }

  // 3. Prime Code columns: scan from column AF onward on the SAME header
  //    row for "Cn" labels, wherever they actually land.
  const primeColIndices = []; // logical index into COL_HEADERS (0-based)
  const primeSheetCols   = []; // actual sheet column for each
  const scanStart = 31; // column AF, 0-indexed
  const scanEnd   = Math.min(range.e.c, scanStart + 60);
  for (let c = scanStart; c <= scanEnd; c++) {
    const label = (cellStr(headerRow, c) || '').toUpperCase();
    const m = /^C(\d{1,2})$/.exec(label);
    if (m) {
      const idx = COL_HEADERS.indexOf('C' + m[1]);
      if (idx !== -1) { primeColIndices.push(idx); primeSheetCols.push(c); }
    }
  }

  // 4. Data starts two rows below the header (header, pattern-type row, data).
  const dataStartRow = headerRow + 2;

  // 5. Prime Code's own row-label column: look just left of its first
  //    value column, on the first data row, for something matching /^R\d+$/.
  let primeLabelCol = -1;
  if (primeSheetCols.length) {
    for (let c = primeSheetCols[0] - 1; c >= Math.max(scanStart - 2, 0); c--) {
      const v = cellStr(dataStartRow, c);
      if (v && /^R\d+$/i.test(v)) { primeLabelCol = c; break; }
    }
  }

  // 6. Read data rows until column A goes blank (capped as a safety net).
  const matrixRows = [];
  const primeRows   = [];
  for (let r = dataStartRow, i = 0; i < 500; r++, i++) {
    const label = cellStr(r, 0);
    if (!label) break;
    matrixRows.push({
      label,
      cells: Array.from({ length: mainColCount }, (_, k) => cellStr(r, mainColStart + k)),
    });
    if (primeSheetCols.length) {
      primeRows.push({
        label: (primeLabelCol !== -1 ? cellStr(r, primeLabelCol) : null) || label,
        cells: primeSheetCols.map(c => cellStr(r, c)),
      });
    }
  }

  if (!matrixRows.length) {
    throw new Error(`No data rows found below row ${dataStartRow + 1} (column A is blank there).`);
  }

  return { sheetName, matrixRows, primeRows, primeColIndices };
}

/** Apply a successful parse: replace the live matrix + Prime Code data and
 *  re-render everything that depends on it. */
function applyParsedWorkbook(parsed) {
  MATRIX_ROWS = parsed.matrixRows;
  rebuildNormMatrix();

  if (parsed.primeRows.length) {
    PRIME_ROWS = parsed.primeRows;
    PRIME_COL_INDICES = parsed.primeColIndices;
  } else {
    PRIME_ROWS = null;              // no Prime Code block found in the file
    PRIME_COL_INDICES = PRIME_COLS; // fall back to deriving from the main matrix
  }

  renderMatrixTable();
  renderPrimeCodeTable();
  recalculateHeatMap();
  updateStats();
  if (state.searchQuery) handleSearch(state.searchQuery);

  const noteEl = document.getElementById('primecode-note');
  if (noteEl) {
    noteEl.textContent = PRIME_ROWS
      ? `Loaded from "${parsed.sheetName}": ${PRIME_COL_INDICES.map(i => COL_HEADERS[i]).join(', ')}. ` +
        `The purple day columns run from the oldest draw (left) to the newest (right); each shows how many of that day's numbers are permutations of the row's codes (e.g. 7379 counts for 3779). Hover a count to see which numbers; click it to highlight the matching code in that row.`
      : `No Prime Code block found in "${parsed.sheetName}" – showing the default view derived from ` +
        `the Number Pattern Matrix (C1, C2, C6, C7, C11, C14, C15).`;
  }
}

/** Wire the file input: read → parse → apply, with status feedback and no
 *  partial application on failure. */
function handleXlsxUpload(file) {
  const statusEl = document.getElementById('upload-status');
  const setStatus = (text, cls) => {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.className = `upload-status${cls ? ' ' + cls : ''}`;
  };

  setStatus('Reading…');
  const reader = new FileReader();
  reader.onerror = () => setStatus('Could not read the file.', 'error');
  reader.onload = (e) => {
    try {
      if (typeof XLSX === 'undefined') {
        throw new Error('The Excel-reading library did not load (no internet access?). ' +
          'Upload needs a one-time fetch from a CDN; the rest of the app works offline.');
      }
      const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
      const parsed = parseWorkbook(wb);
      applyParsedWorkbook(parsed);
      setStatus(
        `Loaded ${parsed.matrixRows.length} rows from "${parsed.sheetName}"` +
        (parsed.primeRows.length
          ? `, Prime Code: ${parsed.primeColIndices.length} columns.`
          : ' (no Prime Code block found).'),
        'ok'
      );
    } catch (err) {
      setStatus(`Import failed: ${err.message}`, 'error');
    }
  };
  reader.readAsArrayBuffer(file);
}

/* =====================================================================
   14. MAGNUM RESULTS FETCH  (fills the Tier/Day table with real draws)
   ===================================================================== */

const MAGNUM_ORIGIN = 'https://www.magnum4d.my';
// Served by scripts/serve.py: the helper fetches Magnum server-side, which
// is not subject to the browser's cross-site (CORS) restrictions.
const MAGNUM_PROXY_PREFIX = '/api/magnum/';

/**
 * Magnum's JSON field names -> Tier/Day rows, per the mapping requested:
 *   FirstPrize/SecondPrize/ThirdPrize -> Tier 1 rows 1-3
 *   Special1..Special10               -> Tier 2 rows 1-10
 *   Console1..Console10               -> Tier 3 rows 1-10
 * ("Console" is Magnum's own spelling in the API; "Consolation" is accepted too.)
 */
const PRIZE_FIELDS = {
  tier1: [['FirstPrize'], ['SecondPrize'], ['ThirdPrize']],
  tier2: Array.from({ length: 10 }, (_, i) => [`Special${i + 1}`]),
  tier3: Array.from({ length: 10 }, (_, i) => [`Console${i + 1}`, `Consolation${i + 1}`]),
};

function magnumPath(endDate, count) {
  return `results/past/between-dates/null/${endDate}/${count}`;
}

/** "12/09/2026" (dd/mm/yyyy, Magnum's format) -> "2026-09-12" for <input type=date>. */
function magnumDateToIso(raw) {
  const s = String(raw || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
}

/** Accept a bare array, or an object wrapping one; keep only real draw records. */
function extractDraws(data) {
  let list = null;
  if (Array.isArray(data)) list = data;
  else if (data && typeof data === 'object') {
    list = Object.values(data).find(v => Array.isArray(v)) || null;
  }
  if (!list) throw new Error('The data is not a list of draws.');
  const draws = list.filter(d => d && typeof d === 'object' && 'FirstPrize' in d);
  if (!draws.length) {
    throw new Error('No draw records found (expected fields like "FirstPrize", "Special1", "Console1").');
  }
  return draws;
}

/** A prize value: a 4-digit string, or null for blanks / "----" placeholders. */
function prizeValue(draw, keys) {
  for (const k of keys) {
    const v = draw[k];
    if (v !== undefined && v !== null) {
      const s = String(v).trim();
      return /^\d{4}$/.test(s) ? s : null;
    }
  }
  return null;
}

/**
 * Replace the Tier/Day table with one day column per draw.
 * Day-1 is the first record Magnum returns (the most recent draw), matching
 * the requested layout. The column header shows the DrawID, the date picker
 * gets the DrawDate.
 */
function applyDrawsToTierDay(draws) {
  const tierDayData = {};
  Object.entries(PRIZE_FIELDS).forEach(([tier, rows]) => {
    tierDayData[tier] = rows.map(keys => draws.map(d => prizeValue(d, keys)));
  });

  state.tierDayData = tierDayData;
  state.dayLabels   = draws.map((d, i) => String(d.DrawID || `Day-${i + 1}`).trim());
  state.dayDates    = draws.map(d => magnumDateToIso(d.DrawDate));
  state.dayCount    = draws.length;
  state.selectedCells.clear(); // old selections pointed at columns that no longer exist

  renderSelectionTable();
  restoreSelectionVisuals();
  renderPrimeCodeTable();
  recalculateHeatMap();

  const blanks = Object.values(tierDayData).flat(2).filter(v => v === null).length;
  return { draws: draws.length, blanks };
}

/**
 * Try the local helper first (works whenever the page is served by
 * scripts/serve.py), then Magnum directly (works only if Magnum allows
 * cross-site requests). Returns the draw list, or throws with every
 * attempt's reason attached.
 */
async function fetchMagnumDraws(endDate, count) {
  const path = magnumPath(endDate, count);
  const attempts = [];
  if (location.protocol === 'http:' || location.protocol === 'https:') {
    attempts.push(MAGNUM_PROXY_PREFIX + path);
  }
  attempts.push(`${MAGNUM_ORIGIN}/${path}`);

  const failures = [];
  for (const url of attempts) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) { failures.push(`${url}: HTTP ${res.status}`); continue; }
      return extractDraws(await res.json());
    } catch (err) {
      failures.push(`${url}: ${err.message}`);
    }
  }
  const err = new Error('Could not load results automatically.');
  err.failures = failures;
  throw err;
}

function setFetchStatus(text, cls) {
  const el = document.getElementById('fetch-status');
  if (!el) return;
  el.textContent = text;
  el.className = `fetch-status${cls ? ' ' + cls : ''}`;
}

function currentFetchParams() {
  const endDate = document.getElementById('fetch-end-date').value;
  const count = parseInt(document.getElementById('fetch-count').value, 10);
  return { endDate, count };
}

function validateFetchParams({ endDate, count }) {
  if (!endDate) return 'Choose the "Up to date" first.';
  if (!Number.isInteger(count) || count < 1 || count > 1000) return 'Number of draws must be between 1 and 1000.';
  return null;
}

/** Keep the paste panel's link in sync with the chosen date and count. */
function updatePasteLink() {
  const link = document.getElementById('paste-link');
  if (!link) return;
  const params = currentFetchParams();
  if (validateFetchParams(params)) {
    link.textContent = '(choose a date and number of draws above)';
    link.removeAttribute('href');
    return;
  }
  const url = `${MAGNUM_ORIGIN}/${magnumPath(params.endDate, params.count)}`;
  link.href = url;
  link.textContent = url;
}

function describeResult({ draws, blanks }, via) {
  return `Loaded ${draws} draw${draws === 1 ? '' : 's'} ${via}` +
    (blanks ? ` (${blanks} empty prize slot${blanks === 1 ? '' : 's'} left blank).` : '.');
}

async function handleFetchDraws() {
  const params = currentFetchParams();
  const problem = validateFetchParams(params);
  if (problem) { setFetchStatus(problem, 'error'); return; }

  const toto = currentSource() === 'toto';
  const btn = document.getElementById('btn-fetch-draws');
  btn.disabled = true;
  setFetchStatus(`Fetching ${params.count} ${toto ? 'Sports Toto' : 'Magnum'} ` +
    `draw${params.count === 1 ? '' : 's'} up to ${params.endDate}…`);
  try {
    if (toto) {
      const { draws, via } = await getTotoDraws();
      setFetchStatus(loadTotoSelection(draws, via, params), 'ok');
    } else {
      const draws = await fetchMagnumDraws(params.endDate, params.count);
      setFetchStatus(describeResult(applyDrawsToTierDay(draws), 'from Magnum'), 'ok');
    }
  } catch (err) {
    if (!err.failures) {           // the data arrived but didn't fit, e.g. no draws that early
      setFetchStatus(err.message, 'error');
    } else if (toto) {
      console.warn('Sports Toto download failed:', err.failures);
      setFetchStatus(
        'Could not download automatically - your browser blocks this page from reading Sports Toto directly. ' +
        'Run the tool with "python3 scripts/serve.py" for one-click fetching, or download the file and use "Load file instead".',
        'error'
      );
      document.getElementById('toto-panel').hidden = false;
    } else {
      console.warn('Magnum fetch failed:', err.failures);
      setFetchStatus(
        'Could not fetch automatically - your browser blocks this page from reading Magnum directly. ' +
        'Run the tool with "python3 scripts/serve.py" for one-click fetching, or use "Paste JSON instead".',
        'error'
      );
      updatePasteLink();
      document.getElementById('paste-panel').hidden = false;
    }
  } finally {
    btn.disabled = false;
  }
}

function handlePasteLoad() {
  const text = document.getElementById('paste-json').value.trim();
  if (!text) { setFetchStatus('Paste the results first.', 'error'); return; }
  try {
    let data;
    try { data = JSON.parse(text); }
    catch { throw new Error('That is not valid JSON - make sure you copied the whole page.'); }
    setFetchStatus(describeResult(applyDrawsToTierDay(extractDraws(data)), 'from pasted data'), 'ok');
  } catch (err) {
    setFetchStatus(`Could not load pasted data: ${err.message}`, 'error');
  }
}

/* =====================================================================
   15. SPORTS TOTO RESULTS
   Sports Toto publishes its full 4D history as one zip holding a CSV
   ("4D.txt"): DrawNo,DrawDate,1stPrizeNo,…,SpecialNo1-10,ConsolationNo1-10,
   oldest draw first. There is no date-range query, so the whole file is
   downloaded and the draws up to the chosen date are picked locally.
   ===================================================================== */

const TOTO_ZIP_URL    = 'https://rst.sportstoto.com.my/upload/4D.zip';
const TOTO_PROXY_PATH = '/api/toto/4D.txt'; // served by scripts/serve.py (already unzipped)
const TOTO_CACHE_MS   = 10 * 60 * 1000;     // reuse a download for 10 minutes
let totoCache = null;                        // { draws, at, via }

function currentSource() {
  const el = document.getElementById('fetch-source');
  return el ? el.value : 'magnum';
}

/**
 * Read the first .txt/.csv file out of a .zip, entirely in the browser.
 * Uses the browser's built-in DecompressionStream, so no library and no
 * internet access are needed. Handles stored and deflated entries (what
 * ordinary zip tools produce); throws a readable Error for anything else.
 */
async function readTextFromZip(buffer) {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const decoder = new TextDecoder();

  // End-of-central-directory record, searched backwards past any comment.
  let eocd = -1;
  for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('This is not a valid .zip file.');

  // Central directory: find the first .txt / .csv entry.
  const entryCount = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  let entry = null;
  for (let n = 0; n < entryCount; n++) {
    if (view.getUint32(p, true) !== 0x02014b50) throw new Error('The .zip file is damaged.');
    const nameLen = view.getUint16(p + 28, true);
    const name = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    if (!entry && /\.(txt|csv)$/i.test(name)) {
      entry = {
        method: view.getUint16(p + 10, true),
        size: view.getUint32(p + 20, true),         // compressed size
        offset: view.getUint32(p + 42, true),       // local header position
      };
    }
    p += 46 + nameLen + view.getUint16(p + 30, true) + view.getUint16(p + 32, true);
  }
  if (!entry) throw new Error('No .txt file found inside the .zip.');

  const lh = entry.offset;
  if (view.getUint32(lh, true) !== 0x04034b50) throw new Error('The .zip file is damaged.');
  const start = lh + 30 + view.getUint16(lh + 26, true) + view.getUint16(lh + 28, true);
  const data = bytes.subarray(start, start + entry.size);

  if (entry.method === 0) return decoder.decode(data);
  if (entry.method !== 8) throw new Error(`Unsupported compression in the .zip (method ${entry.method}).`);
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('This browser cannot unzip files - choose the 4D.txt from inside the .zip instead.');
  }
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Response(stream).text();
}

/**
 * Parse Sports Toto's 4D.txt into draw records using the same field names
 * as Magnum's (FirstPrize, Special1…, Console1…), so both sources share
 * applyDrawsToTierDay(). Columns are found by header name, not position.
 * DrawNo "618826" -> DrawID "6188/26"; DrawDate "20260920" -> "20/09/2026".
 * Returns draws oldest first.
 */
function parseTotoText(text) {
  const lines = String(text).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) throw new Error('The Sports Toto file is empty.');
  const header = lines[0].split(',').map(h => h.trim());
  const col = name => header.indexOf(name);
  const fields = {
    FirstPrize: '1stPrizeNo', SecondPrize: '2ndPrizeNo', ThirdPrize: '3rdPrizeNo',
  };
  for (let i = 1; i <= 10; i++) {
    fields[`Special${i}`] = `SpecialNo${i}`;
    fields[`Console${i}`] = `ConsolationNo${i}`;
  }
  const missing = ['DrawNo', 'DrawDate', ...Object.values(fields)].filter(n => col(n) < 0);
  if (missing.length) {
    throw new Error(`This is not a Sports Toto 4D results file (missing ${missing.slice(0, 3).join(', ')}).`);
  }

  const draws = [];
  for (const line of lines.slice(1)) {
    const f = line.split(',').map(v => v.trim());
    const d = /^(\d{4})(\d{2})(\d{2})$/.exec(f[col('DrawDate')] || '');
    if (!d) continue;
    const no = f[col('DrawNo')] || '';
    const rec = {
      DrawID: /^\d{6}$/.test(no) ? `${no.slice(0, 4)}/${no.slice(4)}` : no,
      DrawDate: `${d[3]}/${d[2]}/${d[1]}`,
      isoDate: `${d[1]}-${d[2]}-${d[3]}`,
    };
    Object.entries(fields).forEach(([key, name]) => { rec[key] = f[col(name)] || ''; });
    draws.push(rec);
  }
  if (!draws.length) throw new Error('No draws found in the Sports Toto file.');
  draws.sort((a, b) => (a.isoDate < b.isoDate ? -1 : a.isoDate > b.isoDate ? 1 : 0));
  return draws;
}

/** The last `count` draws on or before `endDate`, newest first (Day-1 = newest). */
function selectDrawsUpTo(draws, endDate, count) {
  const upTo = draws.filter(d => d.isoDate <= endDate);
  if (!upTo.length) {
    throw new Error(`No Sports Toto draws on or before ${endDate} ` +
      `(the file covers ${draws[0].isoDate} to ${draws[draws.length - 1].isoDate}).`);
  }
  return upTo.slice(-count).reverse();
}

/**
 * Get the parsed Sports Toto history: from the 10-minute cache, the local
 * helper (already unzipped), or the zip directly (works only if the site
 * allows cross-site requests). Throws with every attempt's reason attached.
 */
async function getTotoDraws() {
  if (totoCache && Date.now() - totoCache.at < TOTO_CACHE_MS) return totoCache;

  const failures = [];
  if (location.protocol === 'http:' || location.protocol === 'https:') {
    try {
      const res = await fetch(TOTO_PROXY_PATH);
      if (res.ok) {
        totoCache = { draws: parseTotoText(await res.text()), at: Date.now(), via: 'from Sports Toto' };
        return totoCache;
      }
      failures.push(`${TOTO_PROXY_PATH}: HTTP ${res.status}`);
    } catch (err) { failures.push(`${TOTO_PROXY_PATH}: ${err.message}`); }
  }
  try {
    const res = await fetch(TOTO_ZIP_URL);
    if (res.ok) {
      const text = await readTextFromZip(await res.arrayBuffer());
      totoCache = { draws: parseTotoText(text), at: Date.now(), via: 'from Sports Toto' };
      return totoCache;
    }
    failures.push(`${TOTO_ZIP_URL}: HTTP ${res.status}`);
  } catch (err) { failures.push(`${TOTO_ZIP_URL}: ${err.message}`); }

  const err = new Error('Could not download the Sports Toto results automatically.');
  err.failures = failures;
  throw err;
}

/** Pick and load the requested Toto draws; returns the status message. */
function loadTotoSelection(draws, via, params) {
  const picked = selectDrawsUpTo(draws, params.endDate, params.count);
  const result = applyDrawsToTierDay(picked);
  const range = picked.length > 1
    ? `${picked[picked.length - 1].DrawID} – ${picked[0].DrawID}` : picked[0].DrawID;
  const short = picked.length < params.count
    ? ` Only ${picked.length} draw${picked.length === 1 ? ' is' : 's are'} available up to that date.` : '';
  return describeResult(result, `${via} (${range})`) + short;
}

/** Manual path: the user picked 4D.zip or 4D.txt from their computer. */
async function handleTotoFile(file) {
  const params = currentFetchParams();
  const problem = validateFetchParams(params);
  if (problem) { setFetchStatus(problem, 'error'); return; }
  setFetchStatus('Reading the Sports Toto file…');
  try {
    const buffer = await file.arrayBuffer();
    const isZip = buffer.byteLength > 4 && new DataView(buffer).getUint32(0, true) === 0x04034b50;
    const text = isZip ? await readTextFromZip(buffer) : new TextDecoder().decode(buffer);
    const draws = parseTotoText(text);
    // Keep it, so changing the date or count and clicking Fetch reuses it.
    totoCache = { draws, at: Date.now(), via: 'from your Sports Toto file' };
    setFetchStatus(loadTotoSelection(draws, totoCache.via, params), 'ok');
  } catch (err) {
    setFetchStatus(`Could not load that file: ${err.message}`, 'error');
  }
}

/** Switch the fetch bar between Magnum and Sports Toto. */
function applySourceUi() {
  const toto = currentSource() === 'toto';
  document.getElementById('btn-fetch-draws').textContent =
    toto ? '⬇ Fetch Sports Toto results' : '⬇ Fetch Magnum results';
  document.getElementById('btn-paste-toggle').textContent =
    toto ? 'Load file instead' : 'Paste JSON instead';
  document.getElementById('paste-panel').hidden = true;
  document.getElementById('toto-panel').hidden = true;
  setFetchStatus('');
}

/** Today's date as yyyy-mm-dd in the viewer's local time zone. */
function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* =====================================================================
   12. INIT
   ===================================================================== */

document.addEventListener('DOMContentLoaded', () => {

  // Initial renders
  renderMatrixTable();
  renderSelectionTable();   // pattern rows are embedded inside
  renderPrimeCodeTable();
  updateStats();
  renderLegend();

  // Add Day button
  document.getElementById('btn-add-day').addEventListener('click', addDay);
  document.getElementById('btn-edit-table').addEventListener('click', toggleEditMode);

  // Clear Selection button
  document.getElementById('btn-clear').addEventListener('click', () => {
    state.selectedCells.clear();
    restoreSelectionVisuals();
    recalculateHeatMap();
  });

  // Search box
  const searchInput = document.getElementById('search-input');
  const btnSearch   = document.getElementById('btn-search');
  const btnClearSearch = document.getElementById('btn-clear-search');

  btnSearch.addEventListener('click', () => handleSearch(searchInput.value));
  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleSearch(searchInput.value);
  });
  btnClearSearch.addEventListener('click', () => {
    searchInput.value = '';
    handleSearch('');
  });
  searchInput.addEventListener('input', () => {
    if (!searchInput.value) handleSearch('');
  });

  // Magnum results fetch → fills the Tier/Day table with real draws
  const endDateInput = document.getElementById('fetch-end-date');
  const countInput   = document.getElementById('fetch-count');
  endDateInput.value = todayIso();
  endDateInput.addEventListener('change', updatePasteLink);
  countInput.addEventListener('input', updatePasteLink);
  updatePasteLink();
  document.getElementById('btn-fetch-draws').addEventListener('click', handleFetchDraws);
  document.getElementById('btn-paste-load').addEventListener('click', handlePasteLoad);
  document.getElementById('btn-paste-toggle').addEventListener('click', () => {
    // Magnum: paste JSON; Sports Toto: choose the downloaded 4D.zip / 4D.txt
    const panel = document.getElementById(currentSource() === 'toto' ? 'toto-panel' : 'paste-panel');
    panel.hidden = !panel.hidden;
    updatePasteLink();
  });
  document.getElementById('fetch-source').addEventListener('change', applySourceUi);
  document.getElementById('toto-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleTotoFile(file);
    e.target.value = ''; // allow choosing the same file again
  });
  applySourceUi();

  // Upload Prediction Analysis (.xlsx) → replaces the live matrix + Prime Code data
  const xlsxInput = document.getElementById('xlsx-upload');
  xlsxInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleXlsxUpload(file);
    e.target.value = ''; // allow re-selecting the same filename later
  });
});
