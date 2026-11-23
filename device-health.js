/* LEGO Mario Monitor · Device Health report helpers
 * Based on LEGO Wireless Protocol 3.0.00. This file only summarizes
 * observations supplied by the main page; it does not send BLE commands.
 */
(function (root) {
  "use strict";
  const PROPERTY_NAMES = {
    1: "Advertising name", 2: "Button state", 3: "Firmware version",
    4: "Hardware version", 5: "RSSI", 6: "Battery level",
    7: "Battery type", 8: "Manufacturer", 9: "Radio firmware",
    10: "LWP protocol version", 11: "System type", 12: "Hardware network ID",
    13: "Primary MAC", 14: "Secondary MAC", 15: "Hardware network family"
  };
  const ALERT_NAMES = {
    1: "Low voltage", 2: "High current",
    3: "Low signal strength", 4: "Over-power condition"
  };
  const ERROR_NAMES = {
    1: "ACK", 2: "MACK", 3: "Buffer overflow", 4: "Timeout",
    5: "Command not recognized", 6: "Invalid command/parameters",
    7: "Overcurrent", 8: "Internal hub error"
  };
  const MODE_NAMES = ["NAME", "RAW", "PCT", "SI", "SYMBOL", "MAPPING", "INTERNAL", "MOTOR BIAS", "CAPABILITIES", "VALUE FORMAT"];
  const IO_TYPE_NAMES = {
    1:"Motor",2:"System train motor",5:"Button",8:"LED light",
    20:"Voltage sensor",21:"Current sensor",22:"Piezo tone",23:"RGB light",
    34:"External tilt sensor",35:"Motion sensor",37:"Vision sensor",
    38:"External motor with tacho",39:"Internal motor with tacho",40:"Internal tilt"
  };
  const has = (value) => value !== undefined && value !== null && value !== "";
  const row = (name, status, detail, group) => ({ name, status, detail: String(detail || ""), group: group || "General" });

  function buildReport(s) {
    const rows = [];
    const props = s.properties || {};
    const alerts = s.alerts || {};
    const ports = s.ports || [];
    const add = (name, status, detail, group) => rows.push(row(name, status, detail, group));

    add("Bluetooth / GATT connection", s.connected ? "PASS" : "UNAVAILABLE",
      s.connected ? "LEGO Hub service and characteristic are connected." : "No active connection.", "Connection");
    add("Notification stream", s.connected ? (s.notificationCount > 0 ? "PASS" : "WAITING") : "UNAVAILABLE",
      s.connected ? (s.notificationCount + " notification packet(s) received during this session.") : "Connect to collect notifications.", "Connection");

    for (const [id, name] of Object.entries(PROPERTY_NAMES)) {
      const value = props[id];
      add(name, has(value) ? "PASS" : "NO RESPONSE",
        has(value) ? value : "No reply received; this may be unsupported by this hub.", "Hub properties");
    }

    const battery = props[6];
    if (has(battery)) {
      const n = Number(String(battery).match(/-?\d+(?:\.\d+)?/)?.[0]);
      const status = Number.isFinite(n) ? (n <= 15 ? "WARNING" : "PASS") : "INFO";
      add("Battery level assessment", status,
        Number.isFinite(n) ? (n + "% reported. This is a simple low-charge indicator, not a battery-capacity test.") : String(battery),
        "Power");
    } else add("Battery level assessment", "UNAVAILABLE", "Battery percentage was not reported.", "Power");

    for (const [id, name] of Object.entries(ALERT_NAMES)) {
      const value = alerts[id];
      add(name + " alert state", value === true ? "WARNING" : value === false ? "PASS" : "NO RESPONSE",
        value === true ? "Hub reported this alert as active." : value === false ? "Hub reported status OK." : "No alert-state response received.",
        "Hub alerts");
    }

    add("Attached I/O ports", ports.length ? "PASS" : "NO PORTS REPORTED",
      ports.length ? ports.length + " port(s): " + ports.map(p => "0x" + Number(p.id).toString(16).padStart(2,"0").toUpperCase()).join(", ") : "No attached-port messages received. This can be normal for a hub without external ports.",
      "Ports");

    for (const p of ports) {
      const c = Number(p.capabilities || 0);
      const caps = [
        (c & 1) ? "output" : null, (c & 2) ? "input" : null,
        (c & 4) ? "logical combinable" : null, (c & 8) ? "logical synchronizable" : null
      ].filter(Boolean);
      if (has(p.ioType)) {
        const typeName = IO_TYPE_NAMES[p.ioType] || "Unlisted I/O device";
        add("Port " + p.id + " device type", "INFO",
          typeName + " · type ID 0x" + Number(p.ioType).toString(16).padStart(4,"0").toUpperCase(),
          "Ports");
      }
      if (p.hardwareRevision || p.softwareRevision) {
        add("Port " + p.id + " device revisions", "INFO",
          "Hardware: " + (p.hardwareRevision || "not supplied") + " · Software: " + (p.softwareRevision || "not supplied"),
          "Ports");
      }
      if (p.virtualPorts) {
        add("Port " + p.id + " virtual-port mapping", "INFO",
          "Formed from ports " + p.virtualPorts.join(" and ") + ".", "Ports");
      }
      add("Port " + p.id + " capabilities", has(p.capabilities) ? "PASS" : "WAITING",
        has(p.capabilities) ? (caps.join(", ") || "No capability bits set") + "; " + (p.modeCount || 0) + " total mode(s)." : "Capability response not received.",
        "Ports");
      if (p.inputFormat) add("Port " + p.id + " acknowledged input format", "INFO",
        "Mode " + p.inputFormat.mode + " · delta interval " + p.inputFormat.deltaInterval + " · notifications " + (p.inputFormat.notificationsEnabled ? "enabled" : "disabled") + ".",
        "Sensor configuration");
      if (p.combinedInputFormat) add("Port " + p.id + " acknowledged combined format", "INFO",
        "Combination index " + p.combinedInputFormat.combinationIndex + " · multi-update " + (p.combinedInputFormat.multiUpdate ? "enabled" : "disabled") + " · mode/data pointer 0x" + p.combinedInputFormat.modeDataPointer.toString(16).padStart(4,"0") + ".",
        "Sensor configuration");
      const modes = p.modes || {};
      const modeIds = Object.keys(modes);
      const modeTotal = modeIds.length;
      const metadataCount = modeIds.reduce((n, id) => n + Object.keys(modes[id] || {}).length, 0);
      add("Port " + p.id + " mode metadata", modeTotal ? "PASS" : "WAITING",
        modeTotal + " mode(s) described; " + metadataCount + " metadata field(s) received.",
        "Sensor metadata");
      add("Port " + p.id + " input values", p.valueCount > 0 ? "PASS" : "NO VALUE",
        (p.valueCount || 0) + " value packet(s) observed. No values may simply mean the port has no active input mode.",
        "Sensor data");
      if (p.combinations !== undefined) {
        add("Port " + p.id + " combined-mode support", "PASS",
          (p.combinations.length || 0) + " supported combination(s) reported.", "Sensor metadata");
      } else if (c & 4) {
        add("Port " + p.id + " combined-mode support", "WAITING",
          "Port advertises logical-combinable capability; combination list has not replied.", "Sensor metadata");
      }
    }

    const modes = s.modeAcks || 0, combinedAcks = s.combinedAcks || 0;
    add("Input-format acknowledgements", modes || combinedAcks ? "PASS" : "NO RESPONSE",
      modes + " single-mode and " + combinedAcks + " combined-mode input-format acknowledgement(s) received.", "Sensor configuration");
    add("Combined sensor value packets", s.combinedValues ? "PASS" : "NO DATA",
      (s.combinedValues || 0) + " combined-mode value packet(s) observed.", "Sensor data");
    const protocolFaults = (s.errors || []).filter(e => [3,4,7,8].includes(e.code));
    const unsupportedRequests = (s.errors || []).filter(e => e.code === 5 || e.code === 6);
    const acknowledgements = (s.errors || []).filter(e => e.code === 1 || e.code === 2);
    add("Hub generic errors", protocolFaults.length ? "WARNING" : unsupportedRequests.length ? "INFO" : "PASS",
      protocolFaults.length ? protocolFaults.map(e => (ERROR_NAMES[e.code] || ("Error 0x" + e.code.toString(16))) + " on command 0x" + e.command.toString(16)).join("; ") : unsupportedRequests.length ? unsupportedRequests.length + " unsupported/invalid request response(s) captured; these do not by themselves indicate a hardware fault." : "No protocol fault codes received.",
      "Protocol");
    add("Protocol acknowledgements", acknowledgements.length ? "INFO" : "NO ACK",
      acknowledgements.length ? acknowledgements.length + " ACK/MACK response(s) received; these are informational, not faults." : "No ACK/MACK packets observed.",
      "Protocol");
    add("Hub-originated action events", (s.hubEvents || []).length ? "INFO" : "NO EVENT",
      (s.hubEvents || []).map(e => e.label).join(", ") || "No switch-off/disconnect/boot-mode event received.",
      "Events");
    add("Attached-I/O event history", (s.ioEvents || []).length ? "INFO" : "NO EVENT",
      (s.ioEvents || []).length ? s.ioEvents.length + " attach/detach/virtual-port event(s) observed." : "No attached-I/O event observed in this session.",
      "Events");
    add("Speaker volume extension", has(props[18]) ? "PASS" : "NOT REPORTED",
      has(props[18]) ? "Mario-specific volume property replied: " + props[18] : "The extension is not part of standard LWP; no response was recorded.",
      "Mario-specific");
    add("LCD framebuffer / screen stream", "NOT AVAILABLE",
      "No display-frame or framebuffer channel is defined by standard LWP 3.0.00.", "Capabilities");

    // Deeper, derived checks. These are interpretations of received data, not extra
    // hardware tests; unknown or absent values remain explicitly inconclusive.
    const numeric = (value) => {
      const match = has(value) ? String(value).match(/-?\d+(?:\.\d+)?/) : null;
      return match ? Number(match[0]) : NaN;
    };
    const batteryPct = numeric(props[6]);
    if (Number.isFinite(batteryPct)) {
      add("Battery percentage range", batteryPct >= 0 && batteryPct <= 100 ? "PASS" : "WARNING",
        "Reported value " + batteryPct + "% " + (batteryPct >= 0 && batteryPct <= 100 ? "is within the expected 0–100 range." : "is outside the expected 0–100 range; verify the property parser."),
        "Power");
      add("Battery charge band", batteryPct <= 15 ? "WARNING" : batteryPct <= 30 ? "INFO" : "PASS",
        batteryPct + "% reported. Bands are simple display guidance, not LEGO-defined battery thresholds.",
        "Power");
    }
    const rssi = numeric(props[5]);
    if (Number.isFinite(rssi)) {
      add("RSSI interpretation", rssi === 0 ? "INFO" : "INFO",
        rssi === 0 ? "Zero is inconclusive: this may be an unavailable/unreported value, not a signal-quality measurement." : "Hub-reported RSSI value: " + rssi + ". The report does not convert it to distance or guarantee link quality.",
        "Connection");
    }
    if (has(props[13])) add("Primary MAC privacy", "INFO",
      "A hardware/network identifier is present. Consider redacting it before sharing this report publicly.", "Privacy");
    if (has(props[14])) {
      const secondary = String(props[14]).toUpperCase();
      add("Secondary MAC interpretation", secondary === "00:00:00:00:00:00" ? "INFO" : "INFO",
        secondary === "00:00:00:00:00:00" ? "All-zero address may mean unassigned or not exposed; it is not by itself a fault." : "Secondary address reported. Treat it as a device identifier.",
        "Privacy");
    }
    if (has(props[3])) add("Firmware version captured", "INFO", String(props[3]) + " · retain this value when comparing later sessions.", "Identification");
    if (has(props[4])) add("Hardware version captured", "INFO", String(props[4]) + " · useful for compatibility comparisons.", "Identification");
    if (has(props[10])) add("Protocol version captured", "INFO", String(props[10]) + " · parser and feature support should be checked against this version.", "Identification");
    if (has(props[18])) {
      const volume = numeric(props[18]);
      add("Speaker volume range", Number.isFinite(volume) && volume >= 0 && volume <= 100 ? "PASS" : "INFO",
        Number.isFinite(volume) ? "Reported " + volume + "%." : "Volume response was received but could not be interpreted as a percentage.",
        "Mario-specific");
    }

    const allModeNames = [];
    let inputModeCount = 0, outputModeCount = 0, metadataFields = 0, namedModes = 0;
    let portsWithInput = 0, portsWithOutput = 0, combinablePorts = 0;
    for (const p of ports) {
      const inputMask = Number(p.inputModes || 0), outputMask = Number(p.outputModes || 0);
      const inputIds = Array.from({length:16}, (_, i) => i).filter(i => inputMask & (1 << i));
      const outputIds = Array.from({length:16}, (_, i) => i).filter(i => outputMask & (1 << i));
      inputModeCount += inputIds.length; outputModeCount += outputIds.length;
      if (inputIds.length) portsWithInput++;
      if (outputIds.length) portsWithOutput++;
      if (Number(p.capabilities || 0) & 4) combinablePorts++;
      const modesForPort = p.modes || {};
      for (const [modeId, meta] of Object.entries(modesForPort)) {
        const fields = Object.keys(meta || {});
        metadataFields += fields.length;
        if (has(meta.name)) namedModes++;
        allModeNames.push("P" + p.id + "/M" + modeId + (has(meta.name) ? " " + meta.name : ""));
        add("Port " + p.id + " mode " + modeId + " metadata fields", fields.length ? "INFO" : "WAITING",
          fields.length ? fields.join(", ") + (has(meta.name) ? " · name: " + meta.name : "") +
            (has(meta.valueFormat) ? " · value format: " + meta.valueFormat : "") : "No metadata fields received.",
          "Mode detail");
      }
      if (has(p.inputModes)) add("Port " + p.id + " input-mode bitmap", "INFO",
        "0x" + inputMask.toString(16).padStart(4,"0").toUpperCase() + " · modes " + (inputIds.join(", ") || "none"),
        "Sensor metadata");
      if (has(p.outputModes)) add("Port " + p.id + " output-mode bitmap", "INFO",
        "0x" + outputMask.toString(16).padStart(4,"0").toUpperCase() + " · modes " + (outputIds.join(", ") || "none"),
        "Sensor metadata");
      if (p.latest && has(p.latest.hex)) add("Port " + p.id + " latest sample", "INFO",
        "Mode " + p.latest.mode + " · HEX " + p.latest.hex + (has(p.latest.bytes) ? " · bytes " + p.latest.bytes : ""),
        "Sensor data");
    }
    add("Port mode inventory", ports.length ? "INFO" : "UNAVAILABLE",
      inputModeCount + " input mode(s), " + outputModeCount + " output mode(s) across " + ports.length + " reported port(s).",
      "Sensor metadata");
    add("Port capability inventory", "INFO",
      portsWithInput + " port(s) advertise input modes; " + portsWithOutput + " advertise output modes; " + combinablePorts + " advertise logical-combinable capability.",
      "Ports");
    add("Mode metadata coverage", metadataFields ? "INFO" : "WAITING",
      metadataFields + " metadata field(s) across " + namedModes + " named mode(s).",
      "Sensor metadata");
    add("Named sensor modes", namedModes ? "INFO" : "WAITING",
      allModeNames.length ? allModeNames.join("; ") : "No mode names have been received yet.",
      "Sensor metadata");

    const errors = s.errors || [];
    const errorGroups = new Map();
    for (const e of errors) {
      const key = "command 0x" + Number(e.command || 0).toString(16).padStart(2,"0").toUpperCase() +
        " / " + (ERROR_NAMES[e.code] || ("code " + e.code));
      errorGroups.set(key, (errorGroups.get(key) || 0) + 1);
    }
    const invalidPortQueries = errors.filter(e => e.code === 6 && e.command === 0x21).length;
    add("Protocol error breakdown", errors.length ? "INFO" : "INFO",
      errors.length ? [...errorGroups.entries()].map(([k,v]) => k + ": " + v).join("; ") : "No generic error packets captured.",
      "Protocol");
    add("Port-info request compatibility", invalidPortQueries ? "INFO" : "PASS",
      invalidPortQueries ? invalidPortQueries + " invalid-command/parameter response(s) for port-info command 0x21. Some queried port/request combinations may be unsupported; correlate with the port ID and info type before treating this as a device fault." : "No invalid-command/parameter response for port-info command 0x21 was captured.",
      "Protocol");
    add("Protocol error rate", errors.length ? "INFO" : "PASS",
      errors.length + " captured error/ack packet(s) across " + (s.notificationCount || 0) + " notifications. This is a session sample, not a certified reliability score.",
      "Protocol");

    const ioEvents = s.ioEvents || [];
    const attachCount = ioEvents.filter(e => e.event === "attached").length;
    const detachCount = ioEvents.filter(e => e.event === "detached").length;
    const virtualCount = ioEvents.filter(e => e.event === "virtual attached").length;
    add("I/O attachment event counts", ioEvents.length ? "INFO" : "NO EVENT",
      attachCount + " attached, " + detachCount + " detached, " + virtualCount + " virtual-attached event(s).",
      "Events");
    add("Hub event count", (s.hubEvents || []).length ? "INFO" : "NO EVENT",
      (s.hubEvents || []).length + " hub-originated action notification(s) captured.",
      "Events");
    add("Sensor packet coverage", ports.some(p => p.valueCount > 0) ? "INFO" : "NO DATA",
      ports.reduce((n,p) => n + (p.valueCount || 0), 0) + " single-port value packet(s) observed across " + ports.length + " port(s).",
      "Sensor data");
    add("Connection data volume", s.connected ? "INFO" : "UNAVAILABLE",
      (s.notificationCount || 0) + " notifications received during the current connection session.",
      "Connection");

    const counts = rows.reduce((o, r) => { o[r.status] = (o[r.status] || 0) + 1; return o; }, {});
    const unavailableStatuses = ["UNAVAILABLE","NO RESPONSE","NOT AVAILABLE","NO DATA","NO VALUE","NO PORTS REPORTED","NOT REPORTED","NO ACK","NO EVENT"];
    const unavailable = unavailableStatuses.reduce((n, status) => n + (counts[status] || 0), 0);
    return {
      schema: "lego-mario-device-health/2",
      generatedAt: new Date().toISOString(),
      summary: {
        checks: rows.length,
        pass: counts.PASS || 0,
        warning: counts.WARNING || 0,
        waiting: counts.WAITING || 0,
        info: counts.INFO || 0,
        unavailable,
        statusCounts: counts
      },
      diagnostics: {
        portCount: ports.length, inputModeCount, outputModeCount, metadataFields,
        namedModes, portsWithInput, portsWithOutput, combinablePorts,
        capturedErrors: errors.length, invalidPortInfoRequests: invalidPortQueries,
        singlePortValuePackets: ports.reduce((n,p) => n + (p.valueCount || 0), 0),
        combinedValuePackets: s.combinedValues || 0,
        singleFormatAcks: modes,
        combinedFormatAcks: combinedAcks,
        notificationPackets: s.notificationCount || 0,
        ioEvents: {attached:attachCount,detached:detachCount,virtualAttached:virtualCount}
      },
      rows
    };
  }

  root.DeviceHealthDiagnostics = Object.freeze({
    buildReport,
    propertyNames: Object.freeze(PROPERTY_NAMES),
    alertNames: Object.freeze(ALERT_NAMES),
    errorNames: Object.freeze(ERROR_NAMES),
    modeNames: Object.freeze(MODE_NAMES),
    ioTypeNames: Object.freeze(IO_TYPE_NAMES)
  });
})(typeof window !== "undefined" ? window : globalThis);
