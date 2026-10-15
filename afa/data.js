/**
 * 23 Sung On Street - AFA 消防設備完整資料庫 (Panel 1, 2, 3)
 * 支援前台查詢 (index.html) 與 後台管理系統 (admin.html)
 */
(function () {
  const rawList = [];
  let seq = 1;
  const addPt = (panel, loop, add, type, label, sub, zone, floor, note = "") => {
    rawList.push({
      id: `${panel.replace(/\s+/g, '')}_${add}_${seq++}`,
      panel,
      loop,
      add,
      type,
      label,
      sub,
      zone,
      floor,
      note
    });
  };

  // =========================================================================
  // 1. 住宅標準樓層產生器 (涵蓋 Panel 1: 3F-26F 及 Panel 2: 27F-35F 所有單位、大堂、水流掣、BGU)
  // =========================================================================
  const flats1A = ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L", "M", "N", "P"]; // D001-D014 / D050-D063
  const flats1B = ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K"];                     // D015-D024 / D064-D073
  const flats1C = ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L", "M"];           // D025-D036 / D074-D085

  function pad3(n) { return String(n).padStart(3, "0"); }

  function buildResidentialFloor(panel, loopStr, isSecondHalf, flrNum, zLobby, zFloor, zFlat, zWF, zBGU) {
    const flr = `${flrNum}F`;
    const dOffset = isSecondHalf ? 49 : 0; // 第一層 D001-D046, 第二層 D050-D095

    // Tower 1A Flats A-P (1-14)
    flats1A.forEach((f, idx) => {
      const code = `${loopStr}D${pad3(dOffset + 1 + idx)}`;
      addPt(panel, loopStr, code, "Smoke (Photo)", `${flr} TOWER 1A FLAT ${f}`, "", `${zFlat} ${zFloor}`, flr);
    });

    // Tower 1B Flats A-K (15-24)
    flats1B.forEach((f, idx) => {
      const code = `${loopStr}D${pad3(dOffset + 15 + idx)}`;
      addPt(panel, loopStr, code, "Smoke (Photo)", `${flr} TOWER 1B FLAT ${f}`, "", `${zFlat} ${zFloor}`, flr);
    });

    // Tower 1C Flats A-M (25-36)
    flats1C.forEach((f, idx) => {
      const code = `${loopStr}D${pad3(dOffset + 25 + idx)}`;
      addPt(panel, loopStr, code, "Smoke (Photo)", `${flr} TOWER 1C FLAT ${f}`, "", `${zFlat} ${zFloor}`, flr);
    });

    // 10 個電梯大堂煙感 (37-46 / 86-95)
    const lift1C = (flrNum === 3 || flrNum >= 27) ? "(LIFT 6)" : "(LIFT 7,8)";
    const tower1CLobbyName = (flrNum === 3) ? `${flr} TOWER 1B LOBBY` : `${flr} TOWER 1C LOBBY`;
    const lobbies = [
      { n: 37, lbl: `${flr} TOWER 1A LOBBY`, sub: "(FLAT C)" },
      { n: 38, lbl: `${flr} TOWER 1A LOBBY`, sub: "(FLAT G)" },
      { n: 39, lbl: `${flr} TOWER 1A LOBBY`, sub: "(FLAT L)" },
      { n: 40, lbl: `${flr} TOWER 1B LOBBY`, sub: "(FLAT K)" },
      { n: 41, lbl: `${flr} TOWER 1B LOBBY`, sub: "(LIFT 4,5)" },
      { n: 42, lbl: `${flr} TOWER 1B LOBBY`, sub: "(LIFT 3,4)" },
      { n: 43, lbl: `${flr} TOWER 1B LOBBY`, sub: "(FLAT F)" },
      { n: 44, lbl: tower1CLobbyName, sub: "(FLAT K)" },
      { n: 45, lbl: tower1CLobbyName, sub: lift1C },
      { n: 46, lbl: tower1CLobbyName, sub: "(FLAT E)" }
    ];
    lobbies.forEach(lb => {
      const code = `${loopStr}D${pad3(dOffset + lb.n)}`;
      addPt(panel, loopStr, code, "Smoke (Photo)", lb.lbl, lb.sub, `${zLobby} ${zFloor} Z100`, flr);
    });

    // 模組點位 M002-M009 (第一層) / M011-M018 (第二層)
    const mOffset = isSecondHalf ? 9 : 0;
    addPt(panel, loopStr, `${loopStr}M${pad3(mOffset + 2)}`, "Waterflow", `${flr} FLOWSWITCH`, "", `${zWF} ${zFloor} Z97 Z100`, flr);
    addPt(panel, loopStr, `${loopStr}M${pad3(mOffset + 3)}`, "Track Superv", `${flr} SUB VALVE`, "", "", flr);
    addPt(panel, loopStr, `${loopStr}M${pad3(mOffset + 4)}`, "Monitor", `${flr} ST-3 EXIT`, "BGU", `${zBGU} ${zFloor} Z99 Z100`, flr);
    addPt(panel, loopStr, `${loopStr}M${pad3(mOffset + 5)}`, "Monitor", `${flr} ST-3 HR`, "BGU", `${zBGU} ${zFloor} Z99 Z100`, flr);
    addPt(panel, loopStr, `${loopStr}M${pad3(mOffset + 6)}`, "Monitor", `${flr} ST-2 EXIT`, "BGU", `${zBGU} ${zFloor} Z99 Z100`, flr);
    addPt(panel, loopStr, `${loopStr}M${pad3(mOffset + 7)}`, "Monitor", `${flr} ST-2 HR`, "BGU", `${zBGU} ${zFloor} Z99 Z100`, flr);
    addPt(panel, loopStr, `${loopStr}M${pad3(mOffset + 8)}`, "Monitor", `${flr} ST-1 HR`, "BGU", `${zBGU} ${zFloor} Z99 Z100`, flr);
    addPt(panel, loopStr, `${loopStr}M${pad3(mOffset + 9)}`, "Monitor", `${flr} ST-1 METER RM`, "BGU", `${zBGU} ${zFloor} Z99 Z100`, flr);
  }

  // 建立 Panel 1 (3F - 26F) 住宅層
  const panel1Loops = [
    ["L01", 3, "Z5", "Z115", "Z205", "Z155", "Z45", 5, "Z7", "Z117", "Z207", "Z157", "Z47"],
    ["L02", 6, "Z8", "Z118", "Z208", "Z158", "Z48", 7, "Z9", "Z119", "Z209", "Z159", "Z49"],
    ["L03", 8, "Z10", "Z120", "Z210", "Z160", "Z50", 9, "Z11", "Z121", "Z211", "Z161", "Z51"],
    ["L04", 10, "Z12", "Z122", "Z212", "Z162", "Z52", 11, "Z13", "Z123", "Z213", "Z163", "Z53"],
    ["L05", 12, "Z14", "Z124", "Z214", "Z164", "Z54", 15, "Z17", "Z127", "Z217", "Z167", "Z57"],
    ["L06", 16, "Z18", "Z128", "Z218", "Z168", "Z58", 17, "Z19", "Z129", "Z219", "Z169", "Z59"],
    ["L07", 18, "Z20", "Z130", "Z220", "Z170", "Z60", 19, "Z21", "Z131", "Z221", "Z171", "Z61"],
    ["L08", 20, "Z22", "Z132", "Z222", "Z172", "Z62", 21, "Z23", "Z133", "Z223", "Z173", "Z63"],
    ["L09", 22, "Z24", "Z134", "Z224", "Z174", "Z64", 23, "Z25", "Z135", "Z225", "Z175", "Z65"],
    ["L10", 25, "Z27", "Z137", "Z227", "Z177", "Z67", 26, "Z28", "Z138", "Z228", "Z178", "Z68"]
  ];
  panel1Loops.forEach(cfg => {
    const [lp, f1, zl1, zf1, zfl1, zw1, zb1, f2, zl2, zf2, zfl2, zw2, zb2] = cfg;
    buildResidentialFloor("Panel 1", lp, false, f1, zl1, zf1, zfl1, zw1, zb1);
    buildResidentialFloor("Panel 1", lp, true, f2, zl2, zf2, zfl2, zw2, zb2);
    if (lp === "L04") {
      addPt("Panel 1", "L04", "L04M150", "Power Monitr", "AFA PANEL 1", "CHARGER COMMON FAULT", "", "PANEL");
      addPt("Panel 1", "L04", "L04M151", "Power Monitr", "AFA PANEL 1", "AC POWER FAILURE", "", "PANEL");
      addPt("Panel 1", "L04", "L04M152", "Power Monitr", "AFA PANEL 1", "BATTERY POWER FAULT", "", "PANEL");
      addPt("Panel 1", "L04", "L04M153", "Power Monitr", "AFA PANEL 1", "CHARGER GROUND FAULT", "", "PANEL");
      addPt("Panel 1", "L04", "L04M154", "Power Monitr", "AFA PANEL 1", "CHARGER FAULT", "", "PANEL");
    }
  });

  // 建立 Panel 2 (27F - 35F) 住宅層
  const panel2Loops = [
    ["L01", 27, "Z29", "Z139", "Z229", "Z179", "Z69", 28, "Z30", "Z140", "Z230", "Z180", "Z70"],
    ["L02", 29, "Z31", "Z141", "Z231", "Z181", "Z71", 30, "Z32", "Z142", "Z232", "Z182", "Z72"],
    ["L03", 31, "Z33", "Z143", "Z233", "Z183", "Z73", 32, "Z34", "Z144", "Z234", "Z184", "Z74"],
    ["L04", 33, "Z35", "Z145", "Z235", "Z185", "Z75", 35, "Z37", "Z147", "Z237", "Z187", "Z77"]
  ];
  panel2Loops.forEach(cfg => {
    const [lp, f1, zl1, zf1, zfl1, zw1, zb1, f2, zl2, zf2, zfl2, zw2, zb2] = cfg;
    buildResidentialFloor("Panel 2", lp, false, f1, zl1, zf1, zfl1, zw1, zb1);
    buildResidentialFloor("Panel 2", lp, true, f2, zl2, zf2, zfl2, zw2, zb2);
    if (lp === "L04") {
      addPt("Panel 2", "L04", "L04M150", "Power Monitr", "AFA PANEL 2", "CHARGER COMMON FAULT", "", "PANEL");
      addPt("Panel 2", "L04", "L04M151", "Power Monitr", "AFA PANEL 2", "AC POWER FAILURE", "", "PANEL");
      addPt("Panel 2", "L04", "L04M152", "Power Monitr", "AFA PANEL 2", "BATTERY POWER FAULT", "", "PANEL");
      addPt("Panel 2", "L04", "L04M153", "Power Monitr", "AFA PANEL 2", "CHARGER GROUND FAULT", "", "PANEL");
      addPt("Panel 2", "L04", "L04M154", "Power Monitr", "AFA PANEL 2", "CHARGER FAULT", "", "PANEL");
    }
  });

  // Panel 2: L05 & L06 (R/F 天台及全棟警鐘/聯動控制)
  const panel2Extra = [
    ["L05", "L05M001", "Track Superv", "R/F FSI GENSET", "RUNNING", "", "R/F"],
    ["L05", "L05M002", "Track Superv", "R/F FSI GENSET", "MCCB OFF", "", "R/F"],
    ["L05", "L05M003", "Track Superv", "R/F FSI GENSET", "MANUAL MODE", "", "R/F"],
    ["L05", "L05M004", "Track Superv", "R/F FSI GENSET", "FAULT", "", "R/F"],
    ["L05", "L05M011", "Control", "RF LIFT HOMING", "L1 & L2", "Z104 ZL100", "R/F"],
    ["L05", "L05M012", "Control", "RF LIFT HOMING", "L3 & L4 & L5", "Z104 ZL100", "R/F"],
    ["L05", "L05M013", "Control", "RF LIFT HOMING", "L6", "Z104 ZL100", "R/F"],
    ["L05", "L05M014", "Control", "RF LIFT HOMING", "L7 & L8", "Z104 ZL100", "R/F"],
    ["L05", "L05M019", "Monitor", "RF LIFT MACHINE RM A", "BGU", "Z148 Z78 Z99 Z100", "R/F"],
    ["L05", "L05M020", "Monitor", "R/F ST-03", "HR BGU (WP)", "Z78 Z99 Z148 Z100", "R/F"],
    ["L05", "L05M021", "Monitor", "R/F ST-03", "BGU", "Z78 Z99 Z148 Z100", "R/F"],
    ["L05", "L05M022", "Monitor", "R/F FLUSHING PUMP RM", "BGU", "Z78 Z99 Z148 Z100", "R/F"],
    ["L05", "L05M023", "Monitor", "R/F EMER GENERATOR RM", "BGU", "Z78 Z99 Z148 Z100", "R/F"],
    ["L05", "L05M024", "Monitor", "R/F LMR (L3&L4&L5)", "BGU", "Z78 Z99 Z148 Z100", "R/F"],
    ["L05", "L05M025", "Monitor", "R/F LMR (L6)", "BGU", "Z78 Z99 Z148 Z100", "R/F"],
    ["L05", "L05M026", "Monitor", "R/F FAN RM", "BGU", "Z78 Z99 Z148 Z100", "R/F"],
    ["L05", "L05M027", "Monitor", "R/F ST-2", "BGU", "Z78 Z99 Z148 Z100", "R/F"],
    ["L05", "L05M028", "Monitor", "R/F ST-2", "HR BGU (WP)", "Z78 Z99 Z148 Z100", "R/F"],
    ["L05", "L05M029", "Monitor", "R/F ST-1", "BGU", "Z78 Z99 Z148 Z100", "R/F"],
    ["L05", "L05M030", "Monitor", "R/F BOOSTER PUMP RM", "BGU", "Z78 Z99 Z148 Z100", "R/F"],
    ["L05", "L05M031", "Monitor", "R/F LMR (L7&L8)", "BGU", "Z78 Z99 Z148 Z100", "R/F"],
    ["L05", "L05M032", "Monitor", "R/F GENERATOR RM", "BGU", "Z78 Z99 Z148 Z100", "R/F"],
    ["L05", "L05M033", "Control", "R/F ALARM BELL", "LIFT MACH A", "Z101 ZL100", "R/F"],
    ["L05", "L05M034", "Control", "R/F ALARM BELL", "ST-3", "Z101 ZL100", "R/F"],
    ["L05", "L05M035", "Control", "R/F ALARM BELL", "ST-3", "Z101 ZL100", "R/F"],
    ["L05", "L05M036", "Control", "R/F ALARM BELL", "F. PUMP RM", "Z101 ZL100", "R/F"],
    ["L05", "L05M037", "Control", "R/F ALARM BELL", "E. GEN. RM", "Z101 ZL100", "R/F"],
    ["L05", "L05M038", "Control", "R/F ALARM BELL", "LMR L3&L4&L5", "Z101 ZL100", "R/F"],
    ["L05", "L05M039", "Control", "R/F ALARM BELL", "LMR L6", "Z101 ZL100", "R/F"],
    ["L05", "L05M040", "Control", "R/F ALARM BELL", "FAN RM", "Z101 ZL100", "R/F"],
    ["L05", "L05M041", "Control", "R/F ALARM BELL", "ST-2", "Z101 ZL100", "R/F"],
    ["L05", "L05M042", "Control", "R/F ALARM BELL", "ST-2", "Z101 ZL100", "R/F"],
    ["L05", "L05M043", "Control", "R/F ALARM BELL", "ST-1", "Z101 ZL100", "R/F"],
    ["L05", "L05M044", "Control", "R/F ALARM BELL", "B. PUMP RM", "Z101 ZL100", "R/F"],
    ["L05", "L05M045", "Control", "R/F ALARM BELL", "LMR L7 & L8", "Z101 ZL100", "R/F"],
    ["L05", "L05M046", "Control", "R/F ALARM BELL", "GEN. RM", "Z101 ZL100", "R/F"],
    ["L06", "L06M002", "Control", "B/F NON-PA AREA", "ALARM BELL", "Z101 ZL100", "B/F"],
    ["L06", "L06M004", "Control", "G/F NON-PA AREA", "ALARM BELL", "Z101 ZL100", "G/F"],
    ["L06", "L06M005", "Control", "1/F", "ALARM BELL", "Z101 ZL100", "1/F"],
    ["L06", "L06M006", "Control", "2/F", "ALARM BELL", "Z101 ZL100", "2/F"],
    ["L06", "L06M007", "Control", "3/F-7/F", "ALARM BELL", "Z101 ZL100", "PANEL"],
    ["L06", "L06M008", "Control", "8/F-11/F", "ALARM BELL", "Z101 ZL100", "PANEL"],
    ["L06", "L06M009", "Control", "12/F-17/F", "ALARM BELL", "Z101 ZL100", "PANEL"],
    ["L06", "L06M010", "Control", "18/F-21/F", "ALARM BELL", "Z101 ZL100", "PANEL"],
    ["L06", "L06M012", "Control", "MASTER ALARM BELL", "", "Z101 ZL100", "PANEL"],
    ["L06", "L06M013", "Relay", "B/F", "VFA", "Z102 ZL100", "B/F"],
    ["L06", "L06M017", "Relay", "DIRECT LINK ACTIVATE", "", "ZL100", "PANEL"],
    ["L06", "L06M018", "Track Superv", "DIRECT LINK FAULT", "", "", "PANEL"],
    ["L06", "L06M019", "Relay", "VAC TRIP", "", "Z103 ZL100", "PANEL"],
    ["L06", "L06M020", "Relay", "PA", "", "ZL100", "PANEL"],
    ["L06", "L06M024", "Control", "22/F-26/F", "ALARM BELL", "Z101 ZL100", "PANEL"],
    ["L06", "L06M025", "Control", "27/F-30/F", "ALARM BELL", "Z101 ZL100", "PANEL"],
    ["L06", "L06M026", "Control", "31/F-35/F", "ALARM BELL", "Z101 ZL100", "PANEL"],
    ["L06", "L06M028", "Control", "EXIT SIGN", "", "Z100 Z102", "PANEL"]
  ];
  panel2Extra.forEach(r => addPt("Panel 2", r[0], r[1], r[2], r[3], r[4], r[5], r[6]));

  // =========================================================================
  // 2. Panel 3 (B/F - 2/F) 完整點位清單
  // =========================================================================
  function addRange(panel, loop, prefix, start, end, type, label, sub, zone, floor) {
    for (let i = start; i <= end; i++) {
      addPt(panel, loop, `${prefix}${pad3(i)}`, type, label, sub, zone, floor);
    }
  }

  // Panel 3 - L01D (B/F 探測器)
  addRange("Panel 3", "L01", "L01D", 1, 6, "Heat(Rate of Rise)", "B/F REFUSE STORAGE", "", "Z1 Z111 Z98 Z100", "B/F");
  addRange("Panel 3", "L01", "L01D", 7, 10, "Heat(Rate of Rise)", "B/F SPR PUMP RM", "", "Z1 Z111 Z98 Z100", "B/F");
  addRange("Panel 3", "L01", "L01D", 11, 12, "Heat(Rate of Rise)", "B/F EV METERING RM", "", "Z1 Z111 Z98 Z100", "B/F");
  addRange("Panel 3", "L01", "L01D", 13, 17, "Heat(Rate of Rise)", "B/F FAN RM", "", "Z1 Z111 Z98 Z100", "B/F");
  addRange("Panel 3", "L01", "L01D", 18, 22, "Smoke (Photo)", "B/F ST-6", "", "Z1 Z111 Z98 Z100", "B/F");
  addRange("Panel 3", "L01", "L01D", 23, 24, "Smoke (Photo)", "B/F ST-10", "", "Z1 Z111 Z98 Z100", "B/F");
  addRange("Panel 3", "L01", "L01D", 25, 27, "Heat(Rate of Rise)", "B/F CORR(L11)", "", "Z1 Z111 Z98 Z100", "B/F");
  addRange("Panel 3", "L01", "L01D", 28, 30, "Smoke (Photo)", "B/F L6 LIFT LOBBY", "", "Z1 Z111 Z98 Z100", "B/F");
  addRange("Panel 3", "L01", "L01D", 31, 37, "Smoke (Photo)", "B/F ST-8", "", "Z1 Z111 Z98 Z100", "B/F");
  addRange("Panel 3", "L01", "L01D", 38, 44, "Smoke (Photo)", "B/F ST-7", "", "Z1 Z111 Z98 Z100", "B/F");
  addRange("Panel 3", "L01", "L01D", 45, 50, "Smoke (Photo)", "B/F ST-5", "", "Z1 Z111 Z98 Z100", "B/F");
  addPt("Panel 3", "L01", "L01D051", "Smoke (Photo)", "B/F ST-8 LOBBY", "", "Z1 Z111 Z98 Z100", "B/F");
  addRange("Panel 3", "L01", "L01D", 52, 54, "Heat(Rate of Rise)", "B/F FAN RM", "", "Z1 Z111 Z98 Z100", "B/F");
  addRange("Panel 3", "L01", "L01D", 55, 57, "Heat(Rate of Rise)", "B/F LIFT9 LIFT LOBBY", "", "Z1 Z111 Z98 Z100", "B/F");
  addRange("Panel 3", "L01", "L01D", 58, 59, "Heat(Rate of Rise)", "B/F POT. WATER TRAN.", "PUMP RM", "Z1 Z111 Z98 Z100", "B/F");
  addRange("Panel 3", "L01", "L01D", 60, 61, "Smoke (Photo)", "B/F CORR ST-5", "UPPER", "Z1 Z111 Z98 Z100", "B/F");
  addPt("Panel 3", "L01", "L01D062", "Smoke (Photo)", "B/F CORR ST-5", "LOWER", "Z1 Z111 Z98 Z100", "B/F");
  addPt("Panel 3", "L01", "L01D063", "Heat(Rate of Rise)", "B/F FS PUMP RM", "SMOKE LOBBY", "Z1 Z111 Z98 Z100", "B/F");
  addRange("Panel 3", "L01", "L01D", 64, 66, "Heat(Rate of Rise)", "B/F LIFT13 LFT LOBBY", "", "Z1 Z111 Z98 Z100", "B/F");
  addRange("Panel 3", "L01", "L01D", 67, 68, "Heat(Rate of Rise)", "B/F FLUSHING PUMP RM", "", "Z1 Z111 Z98 Z100", "B/F");
  addRange("Panel 3", "L01", "L01D", 69, 71, "Heat(Rate of Rise)", "B/F FS PUMP RM", "", "Z1 Z111 Z98 Z100", "B/F");
  addRange("Panel 3", "L01", "L01D", 72, 77, "Heat(Rate of Rise)", "B/F POT. FLU. & IRR.", "PUMP RM", "Z1 Z111 Z98 Z100", "B/F");
  addPt("Panel 3", "L01", "L01D081", "Smoke (Photo)", "B/F L6 LOBBY", "LOWER", "Z1 Z111 Z98 Z100", "B/F");
  addPt("Panel 3", "L01", "L01D082", "Heat(Rate of Rise)", "B/F ELE RM", "", "Z1 Z111 Z98 Z100", "B/F");
  addRange("Panel 3", "L01", "L01D", 84, 89, "Heat(Rate of Rise)", "B/F LOADING/UNLOAD", "AREA", "Z1 Z111 Z98 Z100", "B/F");
  addPt("Panel 3", "L01", "L01D107", "Smoke (Photo)", "B/F LOADING/UNLOAD", "AREA", "Z1 Z111 Z98 Z100", "B/F");
  addPt("Panel 3", "L01", "L01D109", "Heat(Rate of Rise)", "B/F L11 LOBBY", "", "Z1 Z111 Z98 Z100", "B/F");
  addPt("Panel 3", "L01", "L01D110", "Smoke (Photo)", "B/F ST-06", "SMOKE LOBBY", "Z1 Z111 Z98 Z100", "B/F");

  // Panel 3 - L01M (B/F 泵房、閥門、水流掣及 BGU)
  const p3L01M = [
    ["L01M001", "Track Superv", "FP-1 POWER FAILURE", "", ""],
    ["L01M002", "Track Superv", "FP-1 RUNNING", "", ""],
    ["L01M003", "Track Superv", "FP-1 FAULT", "", ""],
    ["L01M004", "Track Superv", "FP-2 POWER FAILURE", "", ""],
    ["L01M005", "Track Superv", "FP-2 RUNNING", "", ""],
    ["L01M006", "Track Superv", "FP-2 FAULT", "", ""],
    ["L01M007", "Track Superv", "FJP POWER FAILURE", "", ""],
    ["L01M008", "Track Superv", "FJP RUNNING", "", ""],
    ["L01M009", "Track Superv", "FJP FAULT", "", ""],
    ["L01M010", "Track Superv", "FS WATER TANK L/L", "", ""],
    ["L01M011", "Track Superv", "FS WATER TANK H/L", "", ""],
    ["L01M012", "Relay", "BGU CALL FS PUMP", "", "ZL99"],
    ["L01M013", "Track Superv", "SP-1 POWER FAILURE", "", ""],
    ["L01M014", "Track Superv", "SP-1 RUNNING", "", "Z90"],
    ["L01M015", "Track Superv", "SP-1 FAULT", "", ""],
    ["L01M016", "Track Superv", "SP-2 POWER FAILURE", "", ""],
    ["L01M017", "Track Superv", "SP-2 RUNNING", "", "Z90"],
    ["L01M018", "Track Superv", "SP-2 FAULT", "", ""],
    ["L01M019", "Track Superv", "SP CONTROL FAULT", "", ""],
    ["L01M020", "Track Superv", "SJP POWER FAILURE", "(HZ)", ""],
    ["L01M021", "Track Superv", "SJP POWER RUNNING", "(HZ)", ""],
    ["L01M022", "Track Superv", "SJP FAULT", "(HZ)", ""],
    ["L01M023", "Track Superv", "SJP POWER FAILURE", "(MZ)", ""],
    ["L01M024", "Track Superv", "SJP POWER RUNNING", "(MZ)", ""],
    ["L01M025", "Track Superv", "SJP FAULT", "(MZ)", ""],
    ["L01M026", "Track Superv", "SJP POWER FAILURE", "(LZ)", ""],
    ["L01M027", "Track Superv", "SJP POWER RUNNING", "(LZ)", ""],
    ["L01M028", "Track Superv", "SJP FAULT", "(LZ)", ""],
    ["L01M029", "Track Superv", "SPR. SYSTEM 0.5BAR", "(HZ)", ""],
    ["L01M030", "Track Superv", "SPR. SYSTEM 0.5BAR", "(MZ)", ""],
    ["L01M031", "Track Superv", "SPR. SYSTEM 0.5BAR", "(LZ)", ""],
    ["L01M032", "Track Superv", "SPR. SYSTEM 80%", "(HZ)", ""],
    ["L01M033", "Track Superv", "SPR. SYSTEM 80%", "(MZ)", ""],
    ["L01M034", "Track Superv", "SPR. SYSTEM 80%", "(LZ)", ""],
    ["L01M035", "Track Superv", "SPR. WATER TANK L/L", "", ""],
    ["L01M036", "Track Superv", "SPR. WATER TANK H/L", "", ""],
    ["L01M037", "Track Superv", "SPR. WATER TANK 90%", "", ""],
    ["L01M038", "Track Superv", "SPR. TANK OUTLET", "VALVE CLOSE", ""],
    ["L01M039", "Track Superv", "SP-1 SUCTION VALVE", "CLOSE", ""],
    ["L01M040", "Track Superv", "SP-1 DISCHARGE VALVE", "CLOSE (HZ)", ""],
    ["L01M041", "Track Superv", "SP-1 DISCHARGE VALVE", "CLOSE (MZ)", ""],
    ["L01M042", "Track Superv", "SP-1 DISCHARGE VALVE", "CLOSE (LZ)", ""],
    ["L01M043", "Track Superv", "SP-2 SUCTION VALVE", "CLOSE", ""],
    ["L01M044", "Track Superv", "SP-2 DISCHARGE VALVE", "CLOSE (HZ)", ""],
    ["L01M045", "Track Superv", "SP-2 DISCHARGE VALVE", "CLOSE (MZ)", ""],
    ["L01M046", "Track Superv", "SP-2 DISCHARGE VALVE", "CLOSE (LZ)", ""],
    ["L01M047", "Track Superv", "SP BYPASS SUCTION", "VAL.CLOSE HZ", ""],
    ["L01M048", "Track Superv", "SP BYPASS SUCTION", "VAL.CLOSE MZ", ""],
    ["L01M049", "Track Superv", "SP BYPASS SUCTION", "VAL.CLOSE LZ", ""],
    ["L01M050", "Track Superv", "SP BYPASS DISCHARGE", "VAL.CLOSE HZ", ""],
    ["L01M051", "Track Superv", "SP BYPASS DISCHARGE", "VAL.CLOSE MZ", ""],
    ["L01M052", "Track Superv", "SP BYPASS DISCHARGE", "VAL.CLOSE LZ", ""],
    ["L01M053", "Track Superv", "SJP DISCHARGE VALVE", "CLOSE (HZ)", ""],
    ["L01M054", "Track Superv", "SJP DISCHARGE VALVE", "CLOSE (MZ)", ""],
    ["L01M055", "Track Superv", "SJP DISCHARGE VALVE", "CLOSE (LZ)", ""],
    ["L01M056", "Track Superv", "SJP SUCTION VALVE", "CLOSE (HZ)", ""],
    ["L01M057", "Track Superv", "SJP SUCTION VALVE", "CLOSE (MZ)", ""],
    ["L01M058", "Track Superv", "SJP SUCTION VALVE", "CLOSE (LZ)", ""],
    ["L01M059", "Track Superv", "SP-1 PRESS. SW VALVE", "CLOSE (HZ)", ""],
    ["L01M060", "Track Superv", "SP-1 PRESS. SW VALVE", "CLOSE (MZ)", ""],
    ["L01M061", "Track Superv", "SP-1 PRESS. SW VALVE", "CLOSE (LZ)", ""],
    ["L01M062", "Track Superv", "SP-2 PRESS. SW VALVE", "CLOSE (HZ)", ""],
    ["L01M063", "Track Superv", "SP-2 PRESS. SW VALVE", "CLOSE (MZ)", ""],
    ["L01M064", "Track Superv", "SP-2 PRESS. SW VALVE", "CLOSE (LZ)", ""],
    ["L01M065", "Track Superv", "SPR MAIN PRESS.SW", "VAL.CLOSE HZ", ""],
    ["L01M066", "Track Superv", "SPR MAIN PRESS.SW", "VAL.CLOSE MZ", ""],
    ["L01M067", "Track Superv", "SPR MAIN PRESS.SW", "VAL.CLOSE LZ", ""],
    ["L01M068", "Track Superv", "SPR PRV. SUC. VAL.UP", "VAL CLOSE(1)", ""],
    ["L01M069", "Track Superv", "SPR PRV. SUC. VAL.DN", "VAL CLOSE(1)", ""],
    ["L01M070", "Track Superv", "SPR PRV. SUC. VAL.UP", "VAL CLOSE(2)", ""],
    ["L01M071", "Track Superv", "SPR PRV. SUC. VAL.DN", "VAL CLOSE(2)", ""],
    ["L01M072", "Track Superv", "SPR SJP PRES SWIT", "VAL CLOSE HZ", ""],
    ["L01M073", "Track Superv", "SPR SJP PRES SWIT", "VAL CLOSE MZ", ""],
    ["L01M074", "Track Superv", "SPR SJP PRES SWIT", "VAL CLOSE LZ", ""],
    ["L01M075", "Track Superv", "SPR BOOSTER MODE", "", ""],
    ["L01M079", "Waterflow", "BF FLOWSWITCH", "", "Z97 Z111 Z151 Z100"],
    ["L01M080", "Track Superv", "BF SUB VALVE", "", ""],
    ["L01M081", "Waterflow", "BF FLOWSWITCH", "", "Z97 Z111 Z151 Z100"],
    ["L01M082", "Track Superv", "BF SUB VALVE", "", ""],
    ["L01M083", "Track Superv", "FS PRV. SUC. VAL.UP", "VAL CLOSE(1)", ""],
    ["L01M084", "Track Superv", "FS PRV. SUC. VAL.DN", "VAL CLOSE(1)", ""],
    ["L01M085", "Track Superv", "FS PRV. SUC. VAL.UP", "VAL CLOSE(2)", ""],
    ["L01M086", "Track Superv", "FS PRV. SUC. VAL.DN", "VAL CLOSE(2)", ""],
    ["L01M087", "Track Superv", "FS BOOSTER MODE", "", ""],
    ["L01M090", "Monitor", "B/F L9", "HR BGU", "Z99 Z41 Z111 Z100"],
    ["L01M091", "Monitor", "B/F CAR PARK", "HR BGU", "Z99 Z41 Z111 Z100"],
    ["L01M092", "Monitor", "B/F ST-7", "BGU", "Z99 Z41 Z111 Z100"],
    ["L01M093", "Monitor", "B/F ST-8", "BGU", "Z99 Z41 Z111 Z100"],
    ["L01M094", "Monitor", "B/F L6", "HR BGU", "Z99 Z41 Z111 Z100"],
    ["L01M095", "Monitor", "B/F CAR PARK", "BGU", "Z99 Z41 Z111 Z100"],
    ["L01M096", "Monitor", "B/F", "HR BGU", "Z99 Z41 Z111 Z100"],
    ["L01M097", "Monitor", "B/F L11", "HR BGU", "Z99 Z41 Z111 Z100"],
    ["L01M098", "Monitor", "B/F LOADING AREA", "HR BGU", "Z99 Z41 Z111 Z100"],
    ["L01M099", "Monitor", "B/F LOADING AREA", "HR BGU", "Z99 Z41 Z111 Z100"],
    ["L01M100", "Monitor", "B/F ST-5", "BGU", "Z99 Z41 Z111 Z100"],
    ["L01M101", "Monitor", "B/F ST-5", "BGU", "Z99 Z41 Z111 Z100"],
    ["L01M102", "Monitor", "B/F ST-6", "BGU", "Z99 Z41 Z111 Z100"],
    ["L01M103", "Monitor", "B/F ST-7", "BGU", "Z99 Z41 Z111 Z100"],
    ["L01M104", "Monitor", "B/F ST-8", "BGU", "Z99 Z41 Z111 Z100"],
    ["L01M105", "Track Superv", "FS PRV. SUC. VAL.UP", "VAL CLOSE(3)", ""],
    ["L01M106", "Track Superv", "FS PRV. SUC. VAL.DN", "VAL CLOSE(3)", ""],
    ["L01M107", "Track Superv", "FS PRV. SUC. VAL.UP", "VAL CLOSE(4)", ""],
    ["L01M108", "Track Superv", "FS PRV. SUC. VAL.DN", "VAL CLOSE(4)", ""],
    ["L01M150", "Power Monitr", "AFA PANEL 3", "CHARGER COMMON FAULT", ""],
    ["L01M151", "Power Monitr", "AFA PANEL 3", "AC POWER FAILURE", ""],
    ["L01M152", "Power Monitr", "AFA PANEL 3", "BATTERY POWER FAULT", ""],
    ["L01M153", "Power Monitr", "AFA PANEL 3", "CHARGER GROUND FAULT", ""],
    ["L01M154", "Power Monitr", "AFA PANEL 3", "CHARGER FAULT", ""]
  ];
  p3L01M.forEach(r => addPt("Panel 3", "L01", r[0], r[1], r[2], r[3], r[4], r[0].startsWith("L01M15") ? "PANEL" : "B/F"));

  // Panel 3 - L02D & L02M (G/F 探測器、防煙閘、商舖 BGU、水流掣)
  addRange("Panel 3", "L02", "L02D", 1, 14, "Smoke (Photo)", "GF FIRE SHUTTER", "", "Z81", "G/F");
  addPt("Panel 3", "L02", "L02D021", "Heat(Rate of Rise)", "GF ELECT RM", "ST-03", "Z2 Z112 Z98 Z100", "G/F");
  addPt("Panel 3", "L02", "L02D030", "Heat(Rate of Rise)", "GF FS CONTROL RM", "LOWER", "Z2 Z112 Z98 Z100", "G/F");
  addPt("Panel 3", "L02", "L02D031", "Heat(Rate of Rise)", "GF FS CONTROL RM", "UPPER", "Z2 Z112 Z98 Z100", "G/F");
  addRange("Panel 3", "L02", "L02D", 33, 34, "Heat(Rate of Rise)", "GF ELV RM", "UPPER", "Z2 Z112 Z98 Z100", "G/F");
  addPt("Panel 3", "L02", "L02D035", "Heat(Rate of Rise)", "GF ELV RM", "LOWER", "Z2 Z112 Z98 Z100", "G/F");
  addRange("Panel 3", "L02", "L02D", 80, 82, "Heat(Rate of Rise)", "GF ELECT RM", "", "Z2 Z112 Z98 Z100", "G/F");

  const p3L02M = [
    ["L02M001", "Track Superv", "SPR MAIN FLOWSWITCH", "(HZ)", ""],
    ["L02M002", "Track Superv", "SPR MAIN FLOWSWITCH", "(MZ)", ""],
    ["L02M003", "Track Superv", "SPR MAIN FLOWSWITCH", "(LZ)", ""],
    ["L02M004", "Track Superv", "SPR CTRL.VALVE UP.", "VAL.CLOSE HZ", ""],
    ["L02M005", "Track Superv", "SPR CTRL.VALVE DN.", "VAL.CLOSE HZ", ""],
    ["L02M006", "Track Superv", "SPR CTRL.VALVE BYP.", "VAL.CLOSE HZ", ""],
    ["L02M007", "Track Superv", "SPR CTRL.VALVE UP.", "VAL.CLOSE MZ", ""],
    ["L02M008", "Track Superv", "SPR CTRL.VALVE DN.", "VAL.CLOSE MZ", ""],
    ["L02M009", "Track Superv", "SPR CTRL.VALVE BYP.", "VAL.CLOSE MZ", ""],
    ["L02M010", "Track Superv", "SPR CTRL.VALVE UP.", "VAL.CLOSE LZ", ""],
    ["L02M011", "Track Superv", "SPR CTRL.VALVE DN.", "VAL.CLOSE LZ", ""],
    ["L02M012", "Track Superv", "SPR CTRL.VALVE BYP.", "VAL.CLOSE LZ", ""],
    ["L02M013", "Track Superv", "WATER GONG VALVE", "CLOSE (HZ)", ""],
    ["L02M014", "Track Superv", "WATER GONG VALVE", "CLOSE (MZ)", ""],
    ["L02M015", "Track Superv", "WATER GONG VALVE", "CLOSE (LZ)", ""],
    ["L02M020", "Relay", "GF FSH OPENED", "", "Z81 Z105"],
    ["L02M021", "Track Superv", "GF FSH CLOSED", "", ""],
    ["L02M022", "Relay", "GF FSH OPENED", "", "Z81 Z105"],
    ["L02M023", "Track Superv", "GF FSH CLOSED", "", ""],
    ["L02M024", "Relay", "GF FSH OPENED", "", "Z81 Z105"],
    ["L02M025", "Track Superv", "GF FSH CLOSED", "", ""],
    ["L02M034", "Waterflow", "GF FLOWSWITCH", "", "Z152 Z112 Z97 Z100"],
    ["L02M035", "Track Superv", "GF SUB VALVE", "", ""],
    ["L02M036", "Waterflow", "GF FLOWSWITCH", "", "Z152 Z112 Z97 Z100"],
    ["L02M037", "Track Superv", "GF SUB VALVE", "", ""],
    ["L02M038", "Waterflow", "GF FLOWSWITCH", "", "Z152 Z112 Z97 Z100"],
    ["L02M039", "Track Superv", "GF SUB VALVE", "", ""],
    ["L02M040", "Monitor", "GF ST-02", "EXIT BGU", "Z42 Z112 Z99 Z100"],
    ["L02M041", "Monitor", "GF E1 E2", "EXIT BGU", "Z42 Z112 Z99 Z100"],
    ["L02M042", "Monitor", "GF ST-01", "HR BGU", "Z42 Z112 Z99 Z100"],
    ["L02M043", "Monitor", "GF ST-01", "EXIT BGU", "Z42 Z112 Z99 Z100"],
    ["L02M044", "Monitor", "GF BMO", "BGU", "Z42 Z112 Z99 Z100"],
    ["L02M046", "Monitor", "GF SHOP3", "HR BGU", "Z42 Z112 Z99 Z100"],
    ["L02M047", "Monitor", "GF SHOP3", "BGU", "Z42 Z112 Z99 Z100"],
    ["L02M048", "Monitor", "GF SHOP1", "BGU", "Z42 Z112 Z99 Z100"],
    ["L02M049", "Monitor", "GF BACK LANE", "EXIT BGU", "Z42 Z112 Z99 Z100"],
    ["L02M050", "Monitor", "GF LIFT 11 LOBBY", "BGU", "Z42 Z112 Z99 Z100"],
    ["L02M051", "Monitor", "GF SHOP4", "BGU", "Z42 Z112 Z99 Z100"],
    ["L02M052", "Monitor", "GF SHOP2", "HR BGU", "Z42 Z112 Z99 Z100"],
    ["L02M053", "Monitor", "GF E3, E4", "EXIT BGU", "Z42 Z112 Z99 Z100"],
    ["L02M054", "Monitor", "GF E3, E4", "HR BGU", "Z42 Z112 Z99 Z100"],
    ["L02M055", "Monitor", "GF LIFT 12,13 LOBBY", "BGU", "Z42 Z112 Z99 Z100"],
    ["L02M056", "Monitor", "GF ST-03", "EXIT BGU", "Z42 Z112 Z99 Z100"],
    ["L02M057", "Monitor", "GF ST-03", "EXIT BGU", "Z42 Z112 Z99 Z100"],
    ["L02M058", "Monitor", "GF ST-03", "HR BGU", "Z42 Z112 Z99 Z100"],
    ["L02M059", "Monitor", "GF SHOP6", "EXIT BGU", "Z42 Z112 Z99 Z100"],
    ["L02M060", "Monitor", "GF SHOP6", "HR BGU", "Z42 Z112 Z99 Z100"],
    ["L02M061", "Monitor", "GF SHOP4", "EXIT BGU", "Z42 Z112 Z99 Z100"],
    ["L02M062", "Monitor", "GF ST-04", "EXIT BGU", "Z42 Z112 Z99 Z100"],
    ["L02M063", "Monitor", "GF SHOP1", "EXIT BGU", "Z42 Z112 Z99 Z100"],
    ["L02M064", "Monitor", "GF FS CONTROL RM", "BGU", "Z42 Z112 Z99 Z100"],
    ["L02M070", "Waterflow", "G/F FLOW SWITCH", "SHOP6", "Z152 Z112 Z97 Z100"],
    ["L02M071", "Track Superv", "G/F SUB VALVE", "SHOP6", ""]
  ];
  p3L02M.forEach(r => addPt("Panel 3", "L02", r[0], r[1], r[2], r[3], r[4], "G/F"));

  // Panel 3 - L03D & L03M (1/F & 2/F 設備)
  addRange("Panel 3", "L03", "L03D", 1, 26, "Heat(Rate of Rise)", "1/F TX RM", "", "Z3 Z98 Z113 Z100", "1/F");
  addRange("Panel 3", "L03", "L03D", 35, 39, "Heat(Rate of Rise)", "1/F MAIN SWITCH RM", "", "Z3 Z98 Z113 Z100", "1/F");
  addPt("Panel 3", "L03", "L03D042", "Heat(Rate of Rise)", "1/F SWITCH RM", "", "Z3 Z98 Z113 Z100", "1/F");
  addRange("Panel 3", "L03", "L03D", 43, 53, "Smoke (Photo)", "1/F FIRE SHUTTER", "", "Z3 Z98 Z301", "1/F");
  addRange("Panel 3", "L03", "L03D", 55, 56, "Heat(Rate of Rise)", "1/F ELEC RM", "", "Z3 Z98 Z113 Z100", "1/F");
  addRange("Panel 3", "L03", "L03D", 59, 64, "Heat(Rate of Rise)", "1/F TBE RM2", "", "Z3 Z98 Z113 Z100", "1/F");
  addRange("Panel 3", "L03", "L03D", 65, 77, "Heat(Rate of Rise)", "1/F AHU RM", "", "Z3 Z98 Z113 Z100", "1/F");
  addPt("Panel 3", "L03", "L03D079", "Heat(Rate of Rise)", "1/F TBE RM1", "", "Z3 Z98 Z113 Z100", "1/F");
  addPt("Panel 3", "L03", "L03D080", "Heat(Rate of Rise)", "1/F AHU RM", "", "Z3 Z98 Z113 Z100", "1/F");
  addRange("Panel 3", "L03", "L03D", 81, 83, "Heat(Rate of Rise)", "1/F TBE RM1", "", "Z3 Z98 Z113 Z100", "1/F");
  addRange("Panel 3", "L03", "L03D", 84, 85, "Heat(Rate of Rise)", "1/F AHU RM", "", "Z3 Z98 Z113 Z100", "1/F");
  addRange("Panel 3", "L03", "L03D", 86, 88, "Heat(Rate of Rise)", "1/F CHILLER RM", "", "Z3 Z98 Z113 Z100", "1/F");
  addPt("Panel 3", "L03", "L03D092", "Heat(Rate of Rise)", "1/F FILTRATION RM", "", "Z3 Z98 Z113 Z100", "1/F");
  addRange("Panel 3", "L03", "L03D", 93, 97, "Smoke (Photo)", "1/F FIRE SHUTTER", "", "Z3 Z98 Z302", "1/F");
  addRange("Panel 3", "L03", "L03D", 100, 101, "Heat(Rate of Rise)", "1/F AHU RM(DOG HOUSE)", "", "Z3 Z98 Z113 Z100", "1/F");
  addRange("Panel 3", "L03", "L03D", 107, 108, "Heat(Rate of Rise)", "1/F ELECT RM", "", "Z3 Z98 Z113 Z100", "1/F");
  addPt("Panel 3", "L03", "L03D121", "Heat(Rate of Rise)", "2/F AHU RM", "", "Z4 Z98 Z114 Z100", "2/F");
  addPt("Panel 3", "L03", "L03D125", "Heat(Rate of Rise)", "2/F ELECT RM", "", "Z4 Z98 Z114 Z100", "2/F");
  addPt("Panel 3", "L03", "L03D130", "Smoke (Photo)", "2/F L9 LIFT SHAFT", "", "Z4 Z98 Z114 Z100", "2/F");
  addPt("Panel 3", "L03", "L03D131", "Smoke (Photo)", "2/F L10 LIFT SHAFT", "", "Z4 Z98 Z114 Z100", "2/F");
  addPt("Panel 3", "L03", "L03D132", "Smoke (Photo)", "1/F L11 LIFT SHAFT", "", "Z3 Z98 Z113 Z100", "1/F");
  addPt("Panel 3", "L03", "L03D133", "Smoke (Photo)", "2/F L12 LIFT SHAFT", "", "Z4 Z98 Z114 Z100", "2/F");
  addPt("Panel 3", "L03", "L03D134", "Smoke (Photo)", "2/F L13 LIFT SHAFT", "", "Z4 Z98 Z114 Z100", "2/F");

  const p3L03M = [
    ["L03M001", "Waterflow", "1/F FLOW SWITCH", "", "Z153 Z97 Z113 Z100", "1/F"],
    ["L03M002", "Non Fire", "1/F SUB VALVE", "", "", "1/F"],
    ["L03M003", "Waterflow", "1/F FLOW SWITCH", "", "Z153 Z97 Z113 Z100", "1/F"],
    ["L03M004", "Non Fire", "1/F SUB VALVE", "", "", "1/F"],
    ["L03M005", "Waterflow", "1/F FLOW SWITCH", "", "Z153 Z97 Z113 Z100", "1/F"],
    ["L03M006", "Non Fire", "1/F SUB VALVE", "", "", "1/F"],
    ["L03M007", "Monitor", "1/F TX RM", "BGU", "Z43 Z99 Z113 Z100", "1/F"],
    ["L03M008", "Monitor", "1/F ST-02", "BGU", "Z43 Z99 Z113 Z100", "1/F"],
    ["L03M009", "Monitor", "1/F ST-02", "BGU", "Z43 Z99 Z113 Z100", "1/F"],
    ["L03M010", "Monitor", "1/F ST-02", "BGU", "Z43 Z99 Z113 Z100", "1/F"],
    ["L03M011", "Monitor", "1/F ST-1", "HR BGU", "Z43 Z99 Z113 Z100", "1/F"],
    ["L03M012", "Monitor", "1/F SHOP 2", "HR BGU", "Z43 Z99 Z113 Z100", "1/F"],
    ["L03M013", "Monitor", "1/F CORRIDOR", "HR BGU", "Z43 Z99 Z113 Z100", "1/F"],
    ["L03M014", "Monitor", "1/F ST-04", "HR BGU", "Z43 Z99 Z113 Z100", "1/F"],
    ["L03M015", "Monitor", "1/F ST-04", "BGU", "Z43 Z99 Z113 Z100", "1/F"],
    ["L03M016", "Monitor", "1/F SHOP 3", "HR BGU", "Z43 Z99 Z113 Z100", "1/F"],
    ["L03M017", "Monitor", "1/F SHOP 3 ST-04", "EXIT BGU", "Z43 Z99 Z113 Z100", "1/F"],
    ["L03M018", "Monitor", "1/F ST-03", "BGU", "Z43 Z99 Z113 Z100", "1/F"],
    ["L03M019", "Monitor", "1/F SHOP 3 ST-03", "EXIT BGU", "Z43 Z99 Z113 Z100", "1/F"],
    ["L03M020", "Monitor", "1/F ST-03", "EXIT BGU", "Z43 Z99 Z113 Z100", "1/F"],
    ["L03M021", "Monitor", "1/F MAIN SWITCH RM", "BGU", "Z43 Z99 Z113 Z100", "1/F"],
    ["L03M022", "Monitor", "G/F CABLE RISER", "EXIT BGU", "Z42 Z99 Z112 Z100", "G/F"],
    ["L03M023", "Monitor", "G/F TX RM", "EXIT BGU", "Z42 Z99 Z112 Z100", "G/F"],
    ["L03M040", "Relay", "1F FSH ACT.", "", "Z105 Z301 Z302", "1/F"],
    ["L03M041", "Track Superv", "1F FSH CLOSED", "", "", "1/F"],
    ["L03M042", "Relay", "1F FSH ACT.", "", "Z105 Z302 Z301", "1/F"],
    ["L03M043", "Track Superv", "1F FSH CLOSED", "", "", "1/F"],
    ["L03M050", "Waterflow", "2/F FLOW SWITCH", "", "Z154 Z97 Z114 Z100", "2/F"],
    ["L03M051", "Non Fire", "2/F SUB VALVE", "", "", "2/F"],
    ["L03M052", "Waterflow", "2/F FLOW SWITCH", "", "Z154 Z97 Z114 Z100", "2/F"],
    ["L03M053", "Non Fire", "2/F SUB VALVE", "", "", "2/F"],
    ["L03M054", "Waterflow", "2/F FLOW SWITCH", "", "Z154 Z97 Z114 Z100", "2/F"],
    ["L03M055", "Non Fire", "2/F SUB VALVE", "", "", "2/F"],
    ["L03M056", "Monitor", "2/F ST-01", "EXIT BGU", "Z44 Z99 Z114 Z100", "2/F"],
    ["L03M057", "Monitor", "2/F ST-01", "HR BGU", "Z44 Z99 Z114 Z100", "2/F"],
    ["L03M058", "Monitor", "2/F ST-02", "EXIT BGU", "Z44 Z99 Z114 Z100", "2/F"],
    ["L03M059", "Monitor", "2/F ST-02", "HR BGU", "Z44 Z99 Z114 Z100", "2/F"],
    ["L03M060", "Monitor", "2/F AC RM", "HR BGU", "Z44 Z99 Z114 Z100", "2/F"],
    ["L03M061", "Monitor", "2/F LOUNGE AREA", "HR BGU", "Z44 Z99 Z114 Z100", "2/F"],
    ["L03M062", "Monitor", "2/F CORRIDOR", "HR BGU", "Z44 Z99 Z114 Z100", "2/F"],
    ["L03M063", "Monitor", "2/F ST-03", "HR BGU", "Z44 Z99 Z114 Z100", "2/F"],
    ["L03M064", "Monitor", "2/F LIFT LOBBY 1", "HR BGU(WP)", "Z44 Z99 Z114 Z100", "2/F"],
    ["L03M065", "Monitor", "2/F ST-04", "EXIT BGU", "Z44 Z99 Z114 Z100", "2/F"],
    ["L03M066", "Monitor", "2/F ST-03", "EXIT BGU", "Z44 Z99 Z114 Z100", "2/F"],
    ["L03M067", "Monitor", "2/F LIFT LOBBY 1A", "EXIT BGU", "Z44 Z99 Z114 Z100", "2/F"],
    ["L03M068", "Monitor", "2/F ST-02", "EXIT BGU", "Z44 Z99 Z114 Z100", "2/F"],
    ["L03M080", "Relay", "2/F LIFT HOMING", "", "Z104 ZL100", "2/F"],
    ["L03M081", "Relay", "2/F LIFT HOMING", "", "Z104 ZL100", "2/F"],
    ["L03M082", "Relay", "1/F LIFT HOMING", "", "Z104 ZL100", "1/F"]
  ];
  p3L03M.forEach(r => addPt("Panel 3", "L03", r[0], r[1], r[2], r[3], r[4], r[5]));

  // 預設原始資料
  window.AFA_DEFAULT_DATA = rawList;

  // 載入函數：優先讀取後台儲存在 localStorage 的自訂更新資料
  window.getAFAData = function () {
    try {
      const saved = localStorage.getItem("AFA_CUSTOM_DATA_V1");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn("讀取 localStorage 失敗，使用預設資料庫", e);
    }
    return window.AFA_DEFAULT_DATA;
  };

  window.AFA_DATA = window.getAFAData();
})();
